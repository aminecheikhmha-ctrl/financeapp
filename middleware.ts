import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// Note: Supabase v2 stores sessions in localStorage (client-side), not cookies.
// Route protection is handled client-side in each protected page via useEffect + router.push("/login").
// This middleware only handles lightweight tasks that don't require auth state.

export function middleware(req: NextRequest) {
  return NextResponse.next()
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon-|screenshot-|manifest.json|sw.js|robots.txt|sitemap.xml).*)",
  ],
}
