import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  if (!process.env.ADMIN_PIN) return NextResponse.next();

  const cookie = req.cookies.get("gsm_pin_auth")?.value;
  if (cookie === process.env.AUTH_SECRET) return NextResponse.next();

  const login = new URL("/login", req.url);
  login.searchParams.set("from", req.nextUrl.pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!login|api/auth/pin|_next|favicon.ico).*)"],
};
