import { NextResponse } from "next/server";
import { buildOfferPdf } from "@/app/lib/offer-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const input = {
    id:             searchParams.get("id")            || "VOORBEELD-001",
    customer_name:  searchParams.get("name")          || "Jan de Vries",
    customer_email: searchParams.get("email")         || "jan@example.com",
    customer_phone: searchParams.get("phone")         || "06 12345678",
    brand:          searchParams.get("brand")         || "Apple",
    model:          searchParams.get("model")         || "iPhone 15",
    color:          searchParams.get("color")         || "Zwart",
    issue:          searchParams.get("issue")         || "Schermmodule",
    quality:        searchParams.get("quality")       || "Officieel",
    price_text:     searchParams.get("price")         || "€ 149,95",
    preferred_date: searchParams.get("date")          || "2026-04-15",
    preferred_time: searchParams.get("time")          || "14:00",
  };

  try {
    const pdf = await buildOfferPdf(input);
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "inline; filename=preview-offerte.pdf",
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
