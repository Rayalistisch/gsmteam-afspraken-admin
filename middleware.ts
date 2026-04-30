import { NextRequest, NextResponse } from "next/server";

// Routes die Shopify cross-origin aanroept — nooit blokkeren
const PUBLIC_API = ["/api/create-request", "/api/catalog", "/api/offer-confirm"];

export function middleware(req: NextRequest) {
  // CORS-preflight altijd doorlaten (anders blokkeert browser de POST)
  if (req.method === "OPTIONS") return NextResponse.next();

  // Shopify-facing API routes zijn publiek
  const path = req.nextUrl.pathname;
  if (PUBLIC_API.some((p) => path.startsWith(p))) return NextResponse.next();

  if (!process.env.ADMIN_PIN) return NextResponse.next();

  const cookie = req.cookies.get("gsm_pin_auth")?.value;
  if (cookie === process.env.AUTH_SECRET) return NextResponse.next();

  const login = new URL("/login", req.url);
  login.searchParams.set("from", path);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!login|offer-confirm|api/auth/pin|_next|favicon.ico).*)"],
};
