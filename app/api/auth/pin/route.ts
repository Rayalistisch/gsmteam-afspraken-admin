import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { pin } = await req.json().catch(() => ({}));

  if (!process.env.ADMIN_PIN || !process.env.AUTH_SECRET) {
    return NextResponse.json({ error: "PIN niet geconfigureerd" }, { status: 500 });
  }

  if (String(pin ?? "").trim() !== process.env.ADMIN_PIN) {
    return NextResponse.json({ error: "Onjuiste pincode" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set("gsm_pin_auth", process.env.AUTH_SECRET, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 dagen
  });
  return res;
}
