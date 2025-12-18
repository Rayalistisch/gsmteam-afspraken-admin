import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";

// Nodemailer vereist Node runtime (NIET edge)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const allowedOrigins = [
  "https://gsmteam.nl",
  "https://www.gsmteam.nl",
  "https://gsm-team-2.myshopify.com",
];

function getOrigin(req: Request) {
  const origin = req.headers.get("origin") || "";
  if (allowedOrigins.includes(origin)) return origin;
  // Als origin ontbreekt (bijv. server-to-server) -> geen wildcard met credentials
  return "";
}

function corsHeaders(req: Request) {
  const origin = getOrigin(req);

  // Als we geen origin hebben, zetten we geen ACAO header
  // (anders kan het botsen met credentials/policies)
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

// Preflight
export async function OPTIONS(req: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export async function POST(req: Request) {
  try {
    // --- ENV (server-only) ---
    const SUPABASE_URL = requireEnv("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

    const SMTP_HOST = requireEnv("SMTP_HOST");
    const SMTP_PORT = Number(process.env.SMTP_PORT || "465");
    const SMTP_USER = requireEnv("SMTP_USER");
    const SMTP_PASS = requireEnv("SMTP_PASS");

    const MAIL_FROM = process.env.MAIL_FROM || SMTP_USER;

    // --- BODY ---
    const body = await req.json();

    const customer_email = safe(body.customer_email).trim();
    const customer_name = safe(body.customer_name).trim();

    if (!customer_email) {
      return json(req, { error: "Missing customer_email" }, 400);
    }

    // --- SUPABASE ADMIN CLIENT ---
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // 1) Insert repair request
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

    // 2) Mail (met veilige SMTP defaults)
    const secure = SMTP_PORT === 465; // 465 = SSL, 587 = STARTTLS
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
      // voorkomt “hang” bij rare SMTP issues
      connectionTimeout: 15_000,
      greetingTimeout: 15_000,
      socketTimeout: 20_000,
    });

    const toestel = [insertPayload.brand, insertPayload.model, insertPayload.color]
      .filter(Boolean)
      .join(" ")
      .trim();

    const voorkeur = [insertPayload.preferred_date, insertPayload.preferred_time]
      .filter(Boolean)
      .join(" ")
      .trim();

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

    try {
      await transporter.sendMail({
        from: MAIL_FROM,
        to: customer_email,
        subject: "Bevestiging reparatie-aanvraag – GSM Team",
        html,
      });
    } catch (mailErr: any) {
      // Belangrijk: aanvraag is al opgeslagen, dus geef duidelijke response terug
      console.error("Mail send error:", mailErr);
      return json(
        req,
        {
          ok: true,
          id: data.id,
          mail_sent: false,
          mail_error: safe(mailErr?.message || "Mail error"),
        },
        200
      );
    }

    return json(req, { ok: true, id: data.id, mail_sent: true }, 200);
  } catch (err: any) {
    console.error("create-request error:", err);
    return json(req, { error: "Server error", detail: safe(err?.message) }, 500);
  }
}
