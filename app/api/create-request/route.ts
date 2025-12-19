import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const allowedOrigins = [
  "https://gsmteam.nl",
  "https://www.gsmteam.nl",
  "https://gsm-team-2.myshopify.com",
];

function getOrigin(req: Request) {
  const origin = req.headers.get("origin") || "";
  return allowedOrigins.includes(origin) ? origin : "";
}

function corsHeaders(req: Request) {
  const origin = getOrigin(req);
  const base: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Credentials": "true",
    Vary: "Origin",
  };
  if (origin) base["Access-Control-Allow-Origin"] = origin;
  return base;
}

function safe(v: any) {
  return String(v ?? "").replace(/[<>]/g, "");
}

function json(req: Request, body: any, status = 200) {
  return NextResponse.json(body, { status, headers: corsHeaders(req) });
}

export async function OPTIONS(req: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

async function sendMailgun({
  apiKey,
  domain,
  region,
  from,
  to,
  subject,
  html,
}: {
  apiKey: string;
  domain: string;
  region: "eu" | "us";
  from: string;
  to: string;
  subject: string;
  html: string;
}) {
  const baseUrl = region === "eu" ? "https://api.eu.mailgun.net" : "https://api.mailgun.net";
  const url = `${baseUrl}/v3/${domain}/messages`;

  const form = new URLSearchParams();
  form.append("from", from);
  form.append("to", to);
  form.append("subject", subject);
  form.append("html", html);

  const auth = Buffer.from(`api:${apiKey}`).toString("base64");

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`Mailgun error ${res.status}: ${text}`);
  return text;
}

export async function POST(req: Request) {
  try {
    // --- ENV ---
    const SUPABASE_URL = requireEnv("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

    const MAILGUN_API_KEY = requireEnv("MAILGUN_API_KEY");
    const MAILGUN_DOMAIN = requireEnv("MAILGUN_DOMAIN");
    const MAILGUN_REGION = (process.env.MAILGUN_REGION || "us") as "eu" | "us";
    const MAIL_FROM =
      (process.env.MAIL_FROM || `GSM Team <postmaster@${MAILGUN_DOMAIN}>`).trim();

    // optioneel: als gevuld, stuur alles naar jou
    const MAIL_DEBUG_TO = (process.env.MAIL_DEBUG_TO || "").trim();

    // --- BODY ---
    const body = await req.json().catch(() => ({}));

    const customer_email = safe(body.customer_email).trim();
    const customer_name = safe(body.customer_name).trim();

    if (!customer_email) {
      return json(req, { error: "Missing customer_email" }, 400);
    }

    // --- SUPABASE ---
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const insertPayload = {
      customer_name,
      customer_email,
      customer_phone: safe(body.customer_phone).trim(),
      brand: safe(body.brand).trim(),
      model: safe(body.model).trim(),
      color: safe(body.color).trim(),
      issue: safe(body.issue).trim(),
      price_text: safe(body.price_text).trim(),
      preferred_date: safe(body.preferred_date).trim(),
      preferred_time: safe(body.preferred_time).trim(),
      status: "pending" as const,
    };

    const { data, error } = await supabaseAdmin
      .from("repair_requests")
      .insert(insertPayload)
      .select("id")
      .single();

    if (error || !data?.id) {
      console.error("Supabase insert error:", error);
      return json(req, { error: "Database error", detail: safe(error?.message) }, 500);
    }

    // --- EMAIL CONTENT ---
    const toestel = [insertPayload.brand, insertPayload.model, insertPayload.color]
      .filter(Boolean)
      .join(" ")
      .trim();

    const voorkeur = [insertPayload.preferred_date, insertPayload.preferred_time]
      .filter(Boolean)
      .join(" ")
      .trim();

    const subject = "Bevestiging reparatie-aanvraag – GSM Team";

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;line-height:1.5;color:#111">
        <div style="padding:18px 18px;border:1px solid #e6ecf5;border-radius:14px;background:#ffffff">
          <h2 style="margin:0 0 10px 0;">Bevestiging reparatie-aanvraag</h2>
          <p style="margin:0 0 14px 0;color:#444">
            Bedankt${customer_name ? " " + safe(customer_name) : ""}! We hebben je aanvraag ontvangen.
          </p>

          <div style="padding:12px 14px;border-radius:12px;background:#f6f8fc;border:1px solid #e6ecf5">
            <div style="margin:0 0 6px 0;"><strong>Toestel:</strong> ${safe(toestel) || "-"}</div>
            <div style="margin:0 0 6px 0;"><strong>Reparatie:</strong> ${safe(insertPayload.issue) || "-"}</div>
            <div style="margin:0 0 6px 0;"><strong>Richtprijs:</strong> ${safe(insertPayload.price_text) || "-"}</div>
            <div style="margin:0;"><strong>Voorkeur:</strong> ${safe(voorkeur) || "-"}</div>
          </div>

          <p style="margin:14px 0 0 0;color:#444">
            Dit is een richtprijs. Na controle van het toestel laten we je weten als de prijs afwijkt.
          </p>

          <p style="margin:14px 0 0 0;color:#444">
            Met vriendelijke groet,<br><strong>GSM Team</strong>
          </p>
        </div>
        <p style="font-size:12px;color:#6b7280;margin:10px 0 0 0;">
          Referentie: ${safe(data.id)}
        </p>
      </div>
    `;

    // --- SEND VIA MAILGUN ---
    try {
      const toAddress = MAIL_DEBUG_TO || customer_email;

      const resp = await sendMailgun({
        apiKey: MAILGUN_API_KEY,
        domain: MAILGUN_DOMAIN,
        region: MAILGUN_REGION,
        from: MAIL_FROM,
        to: toAddress,
        subject: MAIL_DEBUG_TO ? `[DEBUG] ${subject}` : subject,
        html,
      });

      console.log("MAILGUN SENT:", { toAddress, resp });

      return json(req, { ok: true, id: data.id, mail_sent: true }, 200);
    } catch (mailErr: any) {
      console.error("MAILGUN SEND ERROR:", mailErr);
      return json(
        req,
        {
          ok: true,
          id: data.id,
          mail_sent: false,
          stage: "send_mailgun",
          mail_error: safe(mailErr?.message || "Mailgun error"),
        },
        200
      );
    }
  } catch (err: any) {
    console.error("create-request error:", err);
    return json(req, { error: "Server error", detail: safe(err?.message) }, 500);
  }
}
