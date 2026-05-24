import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// Routes that require hard auth (cookie-based redirect)
const HARD_PROTECTED = ["/portfolio", "/reports", "/profil", "/parametres", "/coach"]

// Routes that require the onboarding_done cookie (soft auth gate)
// Real auth is enforced client-side via supabase.auth.getUser() in each page.
// Supabase stores sessions in localStorage (not cookies), so we use onboarding_done
// as a lightweight gate to avoid flashing protected pages to obviously unauthenticated users.
// NOTE: /dashboard, /signaux, /analyses, /apprendre are now accessible in demo mode (no gate)
const PROTECTED_ROUTES = [
  "/portfolio",
  "/signaux",
  "/analyses",
  "/apprendre",
  "/forum",
  "/profil",
]

// Public routes that bypass even the soft gate
const PUBLIC_ROUTES = ["/login", "/signup", "/onboarding", "/auth", "/pricing", "/preuves", "/", "/dashboard"]

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ── Hard auth gate for sensitive routes ────────────────────────────────────
  const isHardProtected = HARD_PROTECTED.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  )
  if (isHardProtected) {
    const token = request.cookies.get("sb-access-token")?.value
      || request.cookies.get("supabase-auth-token")?.value
    if (!token) {
      return NextResponse.redirect(new URL("/login", request.url))
    }
  }

  // ── Soft auth gate (onboarding_done cookie) ────────────────────────────────
  const isProtected = PROTECTED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  )
  const isPublic = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  )

  if (isProtected && !isPublic) {
    const hasSession = request.cookies.get("onboarding_done")?.value === "1"
    if (!hasSession) {
      const loginUrl = new URL("/login", request.url)
      loginUrl.searchParams.set("redirect", pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  // ── Security headers ───────────────────────────────────────────────────────
  const response = NextResponse.next()

  response.headers.set("X-Content-Type-Options", "nosniff")
  response.headers.set("X-Frame-Options", "DENY")
  response.headers.set("X-XSS-Protection", "1; mode=block")
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")

  if (process.env.NODE_ENV === "production") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload"
    )
  }

  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com https://*.vercel-insights.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https://img.youtube.com https://i.ytimg.com",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.groq.com https://va.vercel-scripts.com https://*.vercel-insights.com",
    "frame-src https://www.youtube.com https://www.tradingview.com",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
  ].join("; ")

  response.headers.set("Content-Security-Policy", csp)

  return response
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon-192.png|icon-512.png|manifest.json|sw.js).*)",
  ],
}
