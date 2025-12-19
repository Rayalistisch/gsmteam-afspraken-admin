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
    const body = await req.json().catch(() => ({}));
    const id = String(body?.id || "").trim();

    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    // ✅ 1) Jouw bestaande update blijft exact hetzelfde conceptueel
    // Alleen: we selecteren nu alleen velden die we nodig hebben voor mail (plus id/status).
    const { data, error } = await supabaseAdmin
      .from("repair_requests")
      .update({ status: "approved" })
      .eq("id", id)
      .select(
        "id, status, customer_name, customer_email, brand, model, color, issue, price_text, preferred_date, preferred_time"
      )
      .single();

    if (error) {
      console.error("Approve update error:", error);
      return NextResponse.json({ error: safe(error.message) }, { status: 500 });
    }

    // ✅ 2) Mailgun mail proberen (maar nooit je approve kapot maken)
    // Als mail faalt, blijft approve alsnog ok:true teruggeven (net als nu),
    // alleen met extra mail_sent=false info.
    try {
      const MAILGUN_API_KEY = requireEnv("MAILGUN_API_KEY");
      const MAILGUN_DOMAIN = requireEnv("MAILGUN_DOMAIN");
      const MAILGUN_REGION = (process.env.MAILGUN_REGION || "eu") as "eu" | "us";
      const MAIL_FROM =
        (process.env.MAIL_FROM || `GSM Team <postmaster@${MAILGUN_DOMAIN}>`).trim();

      // Optioneel: als gezet, gaat alle mail naar jou (testen)
      const MAIL_DEBUG_TO = (process.env.MAIL_DEBUG_TO || "").trim();

      const customer_email = safe(data?.customer_email).trim();
      const customer_name = safe(data?.customer_name).trim();

      if (!customer_email) {
        // geen mail mogelijk, maar approve is al gelukt
        return NextResponse.json(
          { ok: true, data, mail_sent: false, stage: "approve_no_customer_email" },
          { status: 200 }
        );
      }

      const toestel = [data?.brand, data?.model, data?.color].filter(Boolean).join(" ").trim();
      const voorkeur = [data?.preferred_date, data?.preferred_time].filter(Boolean).join(" ").trim();

      const subject = "Reparatie goedgekeurd – GSM Team";

      const html = `
        <div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;line-height:1.5;color:#111">
          <div style="padding:18px 18px;border:1px solid #e6ecf5;border-radius:14px;background:#ffffff">
            <h2 style="margin:0 0 10px 0;">Je reparatie is goedgekeurd ✅</h2>

            <p style="margin:0 0 14px 0;color:#444">
              Hallo${customer_name ? " " + safe(customer_name) : ""},<br>
              Goed nieuws: je reparatie-aanvraag is <strong>goedgekeurd</strong>.
            </p>

            <div style="padding:12px 14px;border-radius:12px;background:#f6f8fc;border:1px solid #e6ecf5">
              <div style="margin:0 0 6px 0;"><strong>Toestel:</strong> ${safe(toestel) || "-"}</div>
              <div style="margin:0 0 6px 0;"><strong>Reparatie:</strong> ${safe(data?.issue) || "-"}</div>
              <div style="margin:0 0 6px 0;"><strong>Richtprijs:</strong> ${safe(data?.price_text) || "-"}</div>
              <div style="margin:0;"><strong>Voorkeur:</strong> ${safe(voorkeur) || "-"}</div>
            </div>

            <p style="margin:14px 0 0 0;color:#444">
              Je kunt langskomen in de winkel of je afspraak plannen. 
              Reageer op deze mail als je een andere tijd wilt afspreken.
            </p>

            <p style="margin:14px 0 0 0;color:#444">
              Met vriendelijke groet,<br><strong>GSM Team</strong>
            </p>
          </div>
          <p style="font-size:12px;color:#6b7280;margin:10px 0 0 0;">
            Referentie: ${safe(data?.id)}
          </p>
        </div>
      `;

      const toAddress = MAIL_DEBUG_TO || customer_email;

      await sendMailgun({
        apiKey: MAILGUN_API_KEY,
        domain: MAILGUN_DOMAIN,
        region: MAILGUN_REGION,
        from: MAIL_FROM,
        to: toAddress,
        subject: MAIL_DEBUG_TO ? `[DEBUG] ${subject}` : subject,
        html,
      });

      // ✅ approve response blijft hetzelfde, alleen extra flag erbij
      return NextResponse.json({ ok: true, data, mail_sent: true }, { status: 200 });
    } catch (mailErr: any) {
      console.error("Approve mail error:", mailErr);
      // ✅ approve blijft ok:true, maar mail faalde
      return NextResponse.json(
        {
          ok: true,
          data,
          mail_sent: false,
          stage: "approve_send_mailgun",
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
