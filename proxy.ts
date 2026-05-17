import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const PROTECTED_ROUTES = [
  "/dashboard",
  "/portfolio",
  "/signaux",
  "/analyses",
  "/apprendre",
  "/forum",
  "/profil",
]

function isTokenExpired(token: string): boolean {
  try {
    const [, payload] = token.split(".")
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString())
    return decoded.exp * 1000 < Date.now()
  } catch {
    return true
  }
}

function getSupabaseSession(req: NextRequest): boolean {
  // Supabase stores auth in cookie: sb-<ref>-auth-token
  const projectRef = "ngybxuseffhpgeiodtwa"
  const cookieName = `sb-${projectRef}-auth-token`

  const cookie = req.cookies.get(cookieName)?.value
  if (!cookie) return false

  try {
    // Cookie value is JSON: { access_token, refresh_token, ... }
    const parsed = JSON.parse(decodeURIComponent(cookie))
    const accessToken = parsed?.access_token ?? parsed?.[0]?.access_token
    if (!accessToken) return false
    return !isTokenExpired(accessToken)
  } catch {
    return false
  }
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ── Auth protection ────────────────────────────────────────────────────────
  const isProtected = PROTECTED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  )

  if (isProtected && !getSupabaseSession(request)) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("redirect", pathname)
    return NextResponse.redirect(loginUrl)
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
