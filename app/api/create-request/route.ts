import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";

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
    "Vary": "Origin",
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

// simpele helper: voorkomt dat je “from” random tekst is
function formatFrom(from: string) {
  // als er al "<...>" in zit, laat staan
  if (from.includes("<") && from.includes(">")) return from;
  return `GSM Team <${from}>`;
}

export async function POST(req: Request) {
  try {
    // --- ENV ---
    const SUPABASE_URL = requireEnv("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

    const SMTP_HOST = requireEnv("SMTP_HOST");
    const SMTP_PORT = Number(process.env.SMTP_PORT || "465");
    const SMTP_USER = requireEnv("SMTP_USER");
    const SMTP_PASS = requireEnv("SMTP_PASS");

    // optioneel: stuur altijd een kopie naar jezelf om te checken of SMTP werkt
    const MAIL_DEBUG_TO = (process.env.MAIL_DEBUG_TO || "").trim();

    // belangrijk: from moet meestal matchen met SMTP_USER / domein
    const MAIL_FROM = formatFrom((process.env.MAIL_FROM || SMTP_USER).trim());

    // --- BODY ---
    const body = await req.json();

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

    // --- MAIL ---
    const secure = SMTP_PORT === 465;

    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure, // 465 true, 587 false (STARTTLS)
      auth: { user: SMTP_USER, pass: SMTP_PASS },

      // Belangrijk: op sommige hosts geeft TLS chain gedoe; hiermee voorkom je harde fail.
      // (Als dit het oplost: later netjes oplossen met juiste SMTP host/cert.)
      tls: {
        rejectUnauthorized: false,
      },

      connectionTimeout: 15_000,
      greetingTimeout: 15_000,
      socketTimeout: 20_000,
    });

    // 1) verify SMTP zodat je direct foutmelding krijgt als login/poort fout is
    try {
      await transporter.verify();
      console.log("SMTP verify OK", { host: SMTP_HOST, port: SMTP_PORT, secure });
    } catch (verifyErr: any) {
      console.error("SMTP verify FAILED:", verifyErr);
      return json(
        req,
        {
          ok: true,
          id: data.id,
          mail_sent: false,
          stage: "smtp_verify",
          mail_error: safe(verifyErr?.message || "SMTP verify failed"),
        },
        200
      );
    }

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

    // 2) send mail + log accepted/rejected
    try {
      const info = await transporter.sendMail({
        from: MAIL_FROM,
        to: customer_email,
        // altijd een BCC naar jou als MAIL_DEBUG_TO is gezet
        bcc: MAIL_DEBUG_TO || undefined,
        subject,
        html,
      });

      console.log("MAIL SENT:", {
        messageId: info.messageId,
        accepted: info.accepted,
        rejected: info.rejected,
        response: info.response,
      });

      return json(req, { ok: true, id: data.id, mail_sent: true, mail: { accepted: info.accepted, rejected: info.rejected } }, 200);
    } catch (mailErr: any) {
      console.error("Mail send error:", mailErr);
      return json(
        req,
        {
          ok: true,
          id: data.id,
          mail_sent: false,
          stage: "send_mail",
          mail_error: safe(mailErr?.message || "Mail error"),
        },
        200
      );
    }
  } catch (err: any) {
    console.error("create-request error:", err);
    return json(req, { error: "Server error", detail: safe(err?.message) }, 500);
  }
}
