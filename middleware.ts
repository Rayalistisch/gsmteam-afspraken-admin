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
  // api/auth/pin  → PIN-login zelf
  // api/create-request → Shopify form submit (cross-origin, geen cookie)
  // api/catalog        → Shopify catalogus ophalen (cross-origin)
  matcher: ["/((?!login|api/auth/pin|api/create-request|api/catalog|_next|favicon.ico).*)"],
};
