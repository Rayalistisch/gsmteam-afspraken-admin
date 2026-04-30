import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHmac } from "crypto";
import { buildOfferPdf, buildOfferQuoteEmail } from "@/app/lib/offer-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safe(v: any) {
  return String(v ?? "").replace(/[<>]/g, "");
}

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  if (!url) throw new Error("Missing env: SUPABASE_URL");
  return createClient(url, requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false },
  });
}

function makeToken(id: string): string {
  const secret = process.env.OFFER_SECRET || process.env.AUTH_SECRET || "gsm-offer-fallback";
  return createHmac("sha256", secret).update(id).digest("hex");
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
  const text = await res.text();
  if (!res.ok) throw new Error(`Mailgun error ${res.status}: ${text}`);
  return text;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const id = String(body?.id || "").trim();
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const supabase = getSupabaseAdmin();

    // 1) Status → awaiting_approval
    const { data, error } = await supabase
      .from("repair_requests")
      .update({ status: "awaiting_approval" })
      .eq("id", id)
      .select("id, status, customer_name, customer_email, customer_phone, brand, model, color, issue, quality, price_text, preferred_date, preferred_time")
      .single();

    if (error) return NextResponse.json({ error: safe(error.message) }, { status: 500 });

    // 2) Mail + PDF best-effort
    try {
      const MAILGUN_API_KEY = requireEnv("MAILGUN_API_KEY");
      const MAILGUN_DOMAIN  = requireEnv("MAILGUN_DOMAIN");
      const MAILGUN_REGION  = (process.env.MAILGUN_REGION || "eu") as "eu" | "us";
      const MAIL_FROM       = (process.env.MAIL_FROM || `GSM Team <postmaster@${MAILGUN_DOMAIN}>`).trim();
      const MAIL_DEBUG_TO   = (process.env.MAIL_DEBUG_TO || "").trim();

      const customer_email = safe(data?.customer_email).trim();
      if (!customer_email) {
        return NextResponse.json({ ok: true, data, mail_sent: false, stage: "no_customer_email" });
      }

      const { data: catalogItem } = await supabase
        .from("repair_catalog")
        .select("show_quality")
        .ilike("brand", data.brand ?? "")
        .ilike("model", data.model ?? "")
        .ilike("color", data.color ?? "")
        .ilike("repair_type", data.issue ?? "")
        .maybeSingle();
      const showQuality = catalogItem?.show_quality === true;

      const origin = new URL(req.url).origin;
      const token  = makeToken(id);
      const acceptUrl = `${origin}/api/offer-confirm?id=${encodeURIComponent(id)}&token=${token}&action=accept`;
      const rejectUrl = `${origin}/api/offer-confirm?id=${encodeURIComponent(id)}&token=${token}&action=reject`;

      const html = buildOfferQuoteEmail({
        id:             data.id,
        customer_name:  safe(data.customer_name),
        brand:          data.brand,
        model:          data.model,
        color:          data.color,
        issue:          data.issue,
        quality:        showQuality ? data.quality : undefined,
        price_text:     data.price_text,
        preferred_date: data.preferred_date,
        preferred_time: data.preferred_time,
        acceptUrl,
        rejectUrl,
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

      const toAddress = MAIL_DEBUG_TO || customer_email;
      const subject   = "Offerte reparatie – GSM Team";

      await sendMailgun({
        apiKey: MAILGUN_API_KEY,
        domain: MAILGUN_DOMAIN,
        region: MAILGUN_REGION,
        from:   MAIL_FROM,
        to:     toAddress,
        subject: MAIL_DEBUG_TO ? `[DEBUG] ${subject}` : subject,
        html,
        attachments: [{ filename: `Offerte-GSM-Team-${data.id}.pdf`, contentType: "application/pdf", data: pdf }],
      });

      return NextResponse.json({ ok: true, data, mail_sent: true });
    } catch (mailErr: any) {
      console.error("Offer mail/pdf error:", mailErr);
      return NextResponse.json({ ok: true, data, mail_sent: false, mail_error: safe(mailErr?.message) });
    }
  } catch (err: any) {
    console.error("Offer route error:", err);
    return NextResponse.json({ error: "Server error", detail: safe(err?.message) }, { status: 500 });
  }
}
