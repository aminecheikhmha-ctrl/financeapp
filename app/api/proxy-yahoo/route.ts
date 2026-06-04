import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url")
  if (!url || !url.startsWith("https://query")) {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 })
  }
  try {
    const res  = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } })
    const json = await res.json()
    return NextResponse.json(json)
  } catch {
    return NextResponse.json({ error: "Fetch failed" }, { status: 500 })
  }
}
