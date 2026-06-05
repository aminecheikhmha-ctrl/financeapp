import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Api-Key",
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS })
}

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol")
  if (!symbol) return NextResponse.json({ error: "symbol required" }, { status: 400, headers: CORS })

  const res  = await fetch(new URL(`/api/quote?symbol=${symbol}`, req.nextUrl.origin).toString())
  const data = await res.json()

  return NextResponse.json({
    success:   true,
    version:   "1.0",
    timestamp: new Date().toISOString(),
    quote:     data,
  }, { headers: CORS })
}
