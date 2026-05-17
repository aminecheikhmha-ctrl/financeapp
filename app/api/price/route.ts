import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol")
  if (!symbol) return NextResponse.json({ error: "Symbol requis" }, { status: 400 })

  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1m&range=1d`,
      { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" }
    )
    if (!res.ok) return NextResponse.json({ error: "Upstream error" }, { status: 502 })

    const json = await res.json()
    const meta = json?.chart?.result?.[0]?.meta
    if (!meta) return NextResponse.json({ error: "No data" }, { status: 404 })

    const price = meta.regularMarketPrice as number
    const prev  = (meta.previousClose ?? meta.chartPreviousClose ?? price) as number
    const change = prev ? ((price - prev) / prev) * 100 : 0

    return NextResponse.json({ price, change })
  } catch {
    return NextResponse.json({ error: "Erreur" }, { status: 500 })
  }
}
