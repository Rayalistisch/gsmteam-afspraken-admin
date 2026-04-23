import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildOfferPdf, buildOfferEmail } from "@/app/lib/offer-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* -------------------- helpers (unchanged spirit) -------------------- */

function safe(v: any) {
  return String(v ?? "").replace(/[<>]/g, "");
}

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

// Maak de admin client pas aan tijdens runtime (binnen request)
function getSupabaseAdmin() {
  const url =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL || // fallback als je die al had staan
    "";

  if (!url) throw new Error("Missing env: SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL fallback)");

  const key = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

/* -------------------- Mailgun (multipart w/ attachment) -------------------- */

async function sendMailgun({
  apiKey,
  domain,
  region,
  from,
  to,
  cc,
  subject,
  html,
  attachments,
}: {
  apiKey: string;
  domain: string;
  region: "eu" | "us";
  from: string;
  to: string;
  cc?: string;
  subject: string;
  html: string;
  attachments?: Array<{ filename: string; contentType: string; data: Buffer }>;
}) {
  const baseUrl = region === "eu" ? "https://api.eu.mailgun.net" : "https://api.mailgun.net";
  const url = `${baseUrl}/v3/${domain}/messages`;

  const form = new FormData();
  form.append("from", from);
  form.append("to", to);
  if (cc) form.append("cc", cc);
  form.append("subject", subject);
  form.append("html", html);

  if (attachments?.length) {
    for (const a of attachments) {
    const bytes = new Uint8Array(a.data);
    const blob = new Blob([bytes], { type: a.contentType });
    form.append("attachment", blob, a.filename);
    }
  }

  const auth = Buffer.from(`api:${apiKey}`).toString("base64");

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      // geen Content-Type zetten; boundary wordt automatisch gezet
    },
    body: form as any,
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`Mailgun error ${res.status}: ${text}`);
  return text;
}

/* -------------------- route -------------------- */

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const id = String(body?.id || "").trim();

    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    // 1) Update status -> approved + select voor mail/pdf
    const { data, error } = await supabaseAdmin
      .from("repair_requests")
      .update({ status: "approved" })
      .eq("id", id)
      .select(
        "id, status, customer_name, customer_email, customer_phone, brand, model, color, issue, quality, price_text, preferred_date, preferred_time"
      )
      .single();

    if (error) {
      console.error("Approve update error:", error);
      return NextResponse.json({ error: safe(error.message) }, { status: 500 });
    }

    // 2) Mail + PDF best-effort (approve blijft ok:true)
    try {
      const MAILGUN_API_KEY = requireEnv("MAILGUN_API_KEY");
      const MAILGUN_DOMAIN = requireEnv("MAILGUN_DOMAIN");
      const MAILGUN_REGION = (process.env.MAILGUN_REGION || "eu") as "eu" | "us";
      const MAIL_FROM =
        (process.env.MAIL_FROM || `GSM Team <postmaster@${MAILGUN_DOMAIN}>`).trim();
      const MAIL_DEBUG_TO = (process.env.MAIL_DEBUG_TO || "").trim();

      const customer_email = safe(data?.customer_email).trim();
      const customer_name = safe(data?.customer_name).trim();

      if (!customer_email) {
        return NextResponse.json(
          { ok: true, data, mail_sent: false, pdf_sent: false, stage: "approve_no_customer_email" },
          { status: 200 }
        );
      }

      // Catalog-lookup: controleer of kwaliteit getoond moet worden (identiek aan website PDF)
      const { data: catalogItem } = await supabaseAdmin
        .from("repair_catalog")
        .select("show_quality")
        .ilike("brand", data.brand ?? "")
        .ilike("model", data.model ?? "")
        .ilike("color", data.color ?? "")
        .ilike("repair_type", data.issue ?? "")
        .maybeSingle();
      const showQuality = catalogItem?.show_quality === true;

      const subject = "Reparatie goedgekeurd + offerte – GSM Team";
      const logoUrl = `${new URL(req.url).origin}/favicon.ico`;
      const html = buildOfferEmail({
        customer_name,
        id:             data.id,
        logoUrl,
        brand:          data.brand,
        model:          data.model,
        color:          data.color,
        issue:          data.issue,
        quality:        showQuality ? data.quality : undefined,
        price_text:     data.price_text,
        preferred_date: data.preferred_date,
        preferred_time: data.preferred_time,
      });

      const pdf = await buildOfferPdf({
        id: data.id,
        customer_name: data.customer_name,
        customer_email: data.customer_email,
        customer_phone: data.customer_phone,
        brand: data.brand,
        model: data.model,
        color: data.color,
        issue: data.issue,
        quality:        showQuality ? data.quality : undefined,
        price_text: data.price_text,
        preferred_date: data.preferred_date,
        preferred_time: data.preferred_time,
      });

      const toAddress = MAIL_DEBUG_TO || customer_email;

      const NOTIFY_TO = process.env.NOTIFY_EMAIL || "info@gsmteam.nl";
      await sendMailgun({
        apiKey: MAILGUN_API_KEY,
        domain: MAILGUN_DOMAIN,
        region: MAILGUN_REGION,
        from: MAIL_FROM,
        to: toAddress,
        cc: MAIL_DEBUG_TO ? undefined : NOTIFY_TO,
        subject: MAIL_DEBUG_TO ? `[DEBUG] ${subject}` : subject,
        html,
        attachments: [
          {
            filename: `Offerte-GSM-Team-${data.id}.pdf`,
            contentType: "application/pdf",
            data: pdf,
          },
        ],
      });

      return NextResponse.json({ ok: true, data, mail_sent: true, pdf_sent: true }, { status: 200 });
    } catch (mailErr: any) {
      console.error("Approve mail/pdf error:", mailErr);
      return NextResponse.json(
        {
          ok: true,
          data,
          mail_sent: false,
          pdf_sent: false,
          stage: "approve_pdf_mail",
          mail_error: safe(mailErr?.message || "Mailgun error"),
        },
        { status: 200 }
      );
    }
  } catch (err: any) {
    console.error("Approve route error:", err);
    return NextResponse.json(
      { error: "Server error", detail: safe(err?.message || err) },
      { status: 500 }
    );
  }
}
