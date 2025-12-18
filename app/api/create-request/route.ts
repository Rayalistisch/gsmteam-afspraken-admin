import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as nodemailer from "nodemailer";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function safe(v: any) {
  return String(v ?? "").replace(/[<>]/g, "");
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const customer_email = safe(body.customer_email);
    const customer_name = safe(body.customer_name);

    if (!customer_email) {
      return NextResponse.json({ error: "Missing customer_email" }, { status: 400 });
    }

    // 1) Insert
    const insertPayload = {
      customer_name,
      customer_email,
      customer_phone: safe(body.customer_phone),
      brand: safe(body.brand),
      model: safe(body.model),
      color: safe(body.color),
      issue: safe(body.issue),
      price_text: safe(body.price_text),
      preferred_date: safe(body.preferred_date),
      preferred_time: safe(body.preferred_time),
      status: "pending",
    };

    const { data, error } = await supabaseAdmin
      .from("repair_requests")
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      console.error("Supabase insert error:", error);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    // 2) Mail
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST!,
      port: Number(process.env.SMTP_PORT || 465),
      secure: true,
      auth: {
        user: process.env.SMTP_USER!,
        pass: process.env.SMTP_PASS!,
      },
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
            Bedankt${customer_name ? " " + customer_name : ""}! We hebben je aanvraag ontvangen.
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

    await transporter.sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER!,
      to: customer_email,
      subject: "Bevestiging reparatie-aanvraag – GSM Team",
      html,
    });

    return NextResponse.json({ ok: true, id: data.id }, { status: 200 });
  } catch (err) {
    console.error("create-request error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
