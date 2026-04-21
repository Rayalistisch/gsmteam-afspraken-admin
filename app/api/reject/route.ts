import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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
  const url =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    "";
  if (!url) throw new Error("Missing env: SUPABASE_URL");
  const key = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function sendMailgun({
  apiKey, domain, region, from, to, subject, html,
}: {
  apiKey: string; domain: string; region: "eu" | "us";
  from: string; to: string; subject: string; html: string;
}) {
  const baseUrl = region === "eu" ? "https://api.eu.mailgun.net" : "https://api.mailgun.net";
  const form = new FormData();
  form.append("from", from);
  form.append("to", to);
  form.append("subject", subject);
  form.append("html", html);

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

function buildRejectEmail({
  customer_name, brand, model, reason, logoUrl,
}: {
  customer_name: string; brand?: string; model?: string;
  reason?: string; logoUrl: string;
}) {
  const toestel = [brand, model].filter(Boolean).join(" ") || "uw toestel";
  const reasonHtml = reason
    ? `<p style="margin:16px 0 0;color:#374151;">Reden: <em>${safe(reason)}</em></p>`
    : "";

  return `<!DOCTYPE html><html><body style="font-family:sans-serif;background:#f8fafc;margin:0;padding:32px 16px;">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;border:1px solid #e2e8f0;">
  <img src="${logoUrl}" alt="GSM Team" style="width:40px;height:40px;border-radius:8px;margin-bottom:20px;" />
  <h2 style="margin:0 0 8px;color:#0f172a;">Aanvraag afgewezen</h2>
  <p style="margin:0 0 16px;color:#374151;">Beste ${safe(customer_name)},</p>
  <p style="color:#374151;">Helaas kunnen wij uw reparatieaanvraag voor <strong>${safe(toestel)}</strong> op dit moment niet verwerken.</p>
  ${reasonHtml}
  <p style="margin:16px 0 0;color:#374151;">Neem gerust contact met ons op als u vragen heeft.</p>
  <p style="margin:24px 0 0;color:#94a3b8;font-size:13px;">Met vriendelijke groet,<br/>GSM Team</p>
</div></body></html>`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const id = String(body?.id || "").trim();
    const reason = String(body?.reason || "").trim();

    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const { data, error } = await supabaseAdmin
      .from("repair_requests")
      .update({ status: "rejected" })
      .eq("id", id)
      .select("id, status, customer_name, customer_email, brand, model")
      .single();

    if (error) {
      console.error("Reject update error:", error);
      return NextResponse.json({ error: safe(error.message) }, { status: 500 });
    }

    // Mail best-effort
    try {
      const MAILGUN_API_KEY = requireEnv("MAILGUN_API_KEY");
      const MAILGUN_DOMAIN = requireEnv("MAILGUN_DOMAIN");
      const MAILGUN_REGION = (process.env.MAILGUN_REGION || "eu") as "eu" | "us";
      const MAIL_FROM = (process.env.MAIL_FROM || `GSM Team <postmaster@${MAILGUN_DOMAIN}>`).trim();
      const MAIL_DEBUG_TO = (process.env.MAIL_DEBUG_TO || "").trim();

      const customer_email = safe(data?.customer_email).trim();
      const customer_name = safe(data?.customer_name).trim();

      if (!customer_email) {
        return NextResponse.json({ ok: true, data, mail_sent: false }, { status: 200 });
      }

      const logoUrl = `${new URL(req.url).origin}/favicon.ico`;
      const subject = "Reparatieaanvraag afgewezen – GSM Team";
      const html = buildRejectEmail({
        customer_name,
        brand: data.brand,
        model: data.model,
        reason,
        logoUrl,
      });

      await sendMailgun({
        apiKey: MAILGUN_API_KEY,
        domain: MAILGUN_DOMAIN,
        region: MAILGUN_REGION,
        from: MAIL_FROM,
        to: MAIL_DEBUG_TO || customer_email,
        subject: MAIL_DEBUG_TO ? `[DEBUG] ${subject}` : subject,
        html,
      });

      return NextResponse.json({ ok: true, data, mail_sent: true }, { status: 200 });
    } catch (mailErr: any) {
      console.error("Reject mail error:", mailErr);
      return NextResponse.json(
        { ok: true, data, mail_sent: false, mail_error: safe(mailErr?.message) },
        { status: 200 }
      );
    }
  } catch (err: any) {
    console.error("Reject route error:", err);
    return NextResponse.json(
      { error: "Server error", detail: safe(err?.message || err) },
      { status: 500 }
    );
  }
}
