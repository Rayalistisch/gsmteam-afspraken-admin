import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

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

/* -------------------- money helpers -------------------- */

// probeert een getal uit price_text te halen (bv "€ 79,95", "79.95", "79,95 incl")
function parseEuroAmount(input?: string | null): number | null {
  const s = String(input ?? "").trim();
  if (!s) return null;

  // pak eerste "nummerachtige" match (met , of .)
  const m = s.match(/-?\d+(?:[.,]\d{1,2})?/);
  if (!m) return null;

  const normalized = m[0].replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function fmtEUR(n: number) {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(n);
}

function calcFromIncl21(incl: number) {
  const excl = incl / 1.21;
  const btw = incl - excl;
  // rond netjes op 2 decimals
  const round2 = (x: number) => Math.round(x * 100) / 100;
  return { excl: round2(excl), btw: round2(btw), incl: round2(incl) };
}

/* -------------------- Mailgun (multipart w/ attachment) -------------------- */

async function sendMailgun({
  apiKey,
  domain,
  region,
  from,
  to,
  subject,
  html,
  attachments,
}: {
  apiKey: string;
  domain: string;
  region: "eu" | "us";
  from: string;
  to: string;
  subject: string;
  html: string;
  attachments?: Array<{ filename: string; contentType: string; data: Buffer }>;
}) {
  const baseUrl = region === "eu" ? "https://api.eu.mailgun.net" : "https://api.mailgun.net";
  const url = `${baseUrl}/v3/${domain}/messages`;

  const form = new FormData();
  form.append("from", from);
  form.append("to", to);
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

/* -------------------- PDF generator -------------------- */

async function buildOfferPdf(input: {
  id: string;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  brand?: string;
  model?: string;
  color?: string;
  issue?: string;
  price_text?: string;
  preferred_date?: string;
  preferred_time?: string;
}) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const margin = 48;
  let y = height - margin;

  const line = (dy = 10) => {
    y -= dy;
    page.drawLine({
      start: { x: margin, y },
      end: { x: width - margin, y },
      thickness: 1,
      color: rgb(0.9, 0.92, 0.96),
    });
    y -= 16;
  };

  const draw = (txt: string, size = 11, bold = false, color = rgb(0.06, 0.07, 0.1)) => {
    page.drawText(txt, { x: margin, y, size, font: bold ? fontBold : font, color });
    y -= size + 7;
  };

  const drawKV = (k: string, v: string) => {
    const key = `${k}:`;
    page.drawText(key, { x: margin, y, size: 10, font: fontBold, color: rgb(0.35, 0.4, 0.48) });
    page.drawText(v || "-", { x: margin + 120, y, size: 10, font, color: rgb(0.06, 0.07, 0.1) });
    y -= 16;
  };

  const toestel = [input.brand, input.model, input.color].filter(Boolean).join(" ").trim();
  const voorkeur = [input.preferred_date, input.preferred_time].filter(Boolean).join(" ").trim();

  // prijsberekening
  const incl = parseEuroAmount(input.price_text);
  const computed = incl != null ? calcFromIncl21(incl) : null;

  // Header
  draw("GSM Team", 18, true);
  draw("Offerte – Reparatie (goedgekeurd)", 12, true, rgb(0.12, 0.39, 1));
  line(8);

  // Klant
  draw("Klantgegevens", 12, true);
  drawKV("Naam", input.customer_name || "-");
  drawKV("E-mail", input.customer_email || "-");
  drawKV("Telefoon", input.customer_phone || "-");
  y -= 6;

  // Aanvraag
  draw("Aanvraag", 12, true);
  drawKV("Referentie", input.id);
  drawKV("Toestel", toestel || "-");
  drawKV("Reparatie", input.issue || "-");
  drawKV("Voorkeur", voorkeur || "-");
  y -= 6;

  // Prijs
  draw("Prijsindicatie", 12, true);
  if (computed) {
    drawKV("Richtprijs (incl. 21% btw)", fmtEUR(computed.incl));
    drawKV("Richtprijs (excl. btw)", fmtEUR(computed.excl));
    drawKV("BTW (21%)", fmtEUR(computed.btw));
  } else {
    drawKV("Richtprijs", input.price_text || "-");
    draw("Let op: kon geen bedrag herkennen om excl./btw te berekenen.", 10, false, rgb(0.45, 0.47, 0.52));
    y -= 6;
  }

  draw(
    "Deze prijs is een indicatie. Definitieve prijs volgt na controle van het toestel.",
    10,
    false,
    rgb(0.45, 0.47, 0.52)
  );

  // Footer
  const footer = "GSM Team • Dit document is automatisch gegenereerd.";
  page.drawText(footer, {
    x: margin,
    y: 28,
    size: 9,
    font,
    color: rgb(0.42, 0.45, 0.5),
  });

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
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
        "id, status, customer_name, customer_email, customer_phone, brand, model, color, issue, price_text, preferred_date, preferred_time"
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

      const subject = "Reparatie goedgekeurd + offerte – GSM Team";

      const html = `
        <div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;line-height:1.5;color:#111">
          <div style="padding:18px;border:1px solid #e6ecf5;border-radius:14px;background:#fff">
            <h2 style="margin:0 0 10px 0;">Goedgekeurd ✅</h2>
            <p style="margin:0 0 14px 0;color:#444">
              Hallo${customer_name ? " " + safe(customer_name) : ""},<br>
              Je reparatie-aanvraag is goedgekeurd. In de bijlage vind je de offerte als PDF.
            </p>
            <p style="margin:0;color:#444">
              Met vriendelijke groet,<br><strong>GSM Team</strong>
            </p>
          </div>
          <p style="font-size:12px;color:#6b7280;margin:10px 0 0 0;">
            Referentie: ${safe(data?.id)}
          </p>
        </div>
      `;

      const pdf = await buildOfferPdf({
        id: data.id,
        customer_name: data.customer_name,
        customer_email: data.customer_email,
        customer_phone: data.customer_phone,
        brand: data.brand,
        model: data.model,
        color: data.color,
        issue: data.issue,
        price_text: data.price_text,
        preferred_date: data.preferred_date,
        preferred_time: data.preferred_time,
      });

      const toAddress = MAIL_DEBUG_TO || customer_email;

      await sendMailgun({
        apiKey: MAILGUN_API_KEY,
        domain: MAILGUN_DOMAIN,
        region: MAILGUN_REGION,
        from: MAIL_FROM,
        to: toAddress,
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
