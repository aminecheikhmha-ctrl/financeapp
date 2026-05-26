import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// Pages nécessitant une session active
const PROTECTED_ROUTES = [
  "/portfolio",
  "/profil",
  "/parametres",
  "/reports",
  "/admin",
  "/coach",
]

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Routes API, assets Next.js, fichiers statiques → pass-through
  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/icon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next()
  }

  // Routes protégées → vérifie la présence du cookie de session Supabase
  if (PROTECTED_ROUTES.some(route => pathname.startsWith(route))) {
    const hasSession = req.cookies.getAll().some(
      c => c.name.startsWith("sb-") && c.name.endsWith("-auth-token")
    )

    if (!hasSession) {
      const loginUrl = new URL("/login", req.url)
      loginUrl.searchParams.set("redirect", pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon-|screenshot-|manifest.json|sw.js|robots.txt|sitemap.xml).*)",
  ],
}
