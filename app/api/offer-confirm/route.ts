import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHmac } from "crypto";
import { buildOfferPdf, buildOfferEmail } from "@/app/lib/offer-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safe(v: any) {
  return String(v ?? "").replace(/[<>]/g, "");
}

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env");
  return createClient(url, key, { auth: { persistSession: false } });
}

function verifyToken(id: string, token: string): boolean {
  const secret = process.env.OFFER_SECRET || process.env.AUTH_SECRET || "gsm-offer-fallback";
  const expected = createHmac("sha256", secret).update(id).digest("hex");
  return expected === token;
}

async function sendMailgun({
  apiKey, domain, region, from, to, cc, subject, html, attachments,
}: {
  apiKey: string; domain: string; region: "eu" | "us";
  from: string; to: string; cc?: string; subject: string; html: string;
  attachments?: Array<{ filename: string; contentType: string; data: Buffer }>;
}) {
  const baseUrl = region === "eu" ? "https://api.eu.mailgun.net" : "https://api.mailgun.net";
  const form = new FormData();
  form.append("from", from);
  form.append("to", to);
  if (cc) form.append("cc", cc);
  form.append("subject", subject);
  form.append("html", html);
  if (attachments?.length) {
    for (const a of attachments) {
      const blob = new Blob([new Uint8Array(a.data)], { type: a.contentType });
      form.append("attachment", blob, a.filename);
    }
  }
  const auth = Buffer.from(`api:${apiKey}`).toString("base64");
  const res = await fetch(`${baseUrl}/v3/${domain}/messages`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}` },
    body: form as any,
  });
  if (!res.ok) throw new Error(`Mailgun ${res.status}: ${await res.text()}`);
}

export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url);
  const id     = searchParams.get("id")     ?? "";
  const token  = searchParams.get("token")  ?? "";
  const action = searchParams.get("action") ?? "";

  const resultUrl = (result: string) => `${origin}/offer-confirm?result=${result}`;

  if (!id || !token || !["accept", "reject"].includes(action)) {
    return NextResponse.redirect(resultUrl("invalid"));
  }

  if (!verifyToken(id, token)) {
    return NextResponse.redirect(resultUrl("invalid"));
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("repair_requests")
    .select("id, status, customer_name, customer_email, customer_phone, brand, model, color, issue, quality, price_text, preferred_date, preferred_time")
    .eq("id", id)
    .single();

  if (error || !data) return NextResponse.redirect(resultUrl("invalid"));

  // Idempotency: al verwerkt
  if (data.status === "approved")  return NextResponse.redirect(resultUrl("accepted"));
  if (data.status === "rejected")  return NextResponse.redirect(resultUrl("rejected"));
  if (data.status !== "awaiting_approval") return NextResponse.redirect(resultUrl("invalid"));

  if (action === "reject") {
    await supabase.from("repair_requests").update({ status: "rejected" }).eq("id", id);
    return NextResponse.redirect(resultUrl("rejected"));
  }

  // Accept: status → approved + bevestigingsmail
  await supabase.from("repair_requests").update({ status: "approved" }).eq("id", id);

  // Stuur bevestigingsmail best-effort
  try {
    const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY;
    const MAILGUN_DOMAIN  = process.env.MAILGUN_DOMAIN;
    const MAILGUN_REGION  = (process.env.MAILGUN_REGION || "eu") as "eu" | "us";
    const MAIL_FROM       = (process.env.MAIL_FROM || `GSM Team <postmaster@${MAILGUN_DOMAIN}>`).trim();
    const MAIL_DEBUG_TO   = (process.env.MAIL_DEBUG_TO || "").trim();
    const NOTIFY_TO       = process.env.NOTIFY_EMAIL || "info@gsmteam.nl";

    if (MAILGUN_API_KEY && MAILGUN_DOMAIN && data.customer_email) {
      const { data: catalogItem } = await supabase
        .from("repair_catalog")
        .select("show_quality")
        .ilike("brand", data.brand ?? "")
        .ilike("model", data.model ?? "")
        .ilike("color", data.color ?? "")
        .ilike("repair_type", data.issue ?? "")
        .maybeSingle();
      const showQuality = catalogItem?.show_quality === true;

      const html = buildOfferEmail({
        id:             data.id,
        customer_name:  safe(data.customer_name),
        logoUrl:        `${origin}/favicon.ico`,
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
        id:             data.id,
        customer_name:  data.customer_name,
        customer_email: data.customer_email,
        customer_phone: data.customer_phone,
        brand:          data.brand,
        model:          data.model,
        color:          data.color,
        issue:          data.issue,
        quality:        showQuality ? data.quality : undefined,
        price_text:     data.price_text,
        preferred_date: data.preferred_date,
        preferred_time: data.preferred_time,
      });

      const toAddress = MAIL_DEBUG_TO || data.customer_email;
      const subject   = "Reparatie bevestigd – GSM Team";

      await sendMailgun({
        apiKey: MAILGUN_API_KEY,
        domain: MAILGUN_DOMAIN,
        region: MAILGUN_REGION,
        from:   MAIL_FROM,
        to:     toAddress,
        cc:     MAIL_DEBUG_TO ? undefined : NOTIFY_TO,
        subject: MAIL_DEBUG_TO ? `[DEBUG] ${subject}` : subject,
        html,
        attachments: [{ filename: `Bevestiging-GSM-Team-${data.id}.pdf`, contentType: "application/pdf", data: pdf }],
      });
    }
  } catch (err) {
    console.error("offer-confirm confirmation mail error:", err);
  }

  return NextResponse.redirect(resultUrl("accepted"));
}
