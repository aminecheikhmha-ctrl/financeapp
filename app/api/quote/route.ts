import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const symbol = searchParams.get("symbol")

  if (!symbol) {
    return NextResponse.json({ error: "Symbol manquant" }, { status: 400 })
  }

  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`,
      { headers: { "User-Agent": "Mozilla/5.0" } }
    )
    const json = await res.json()
    const meta = json.chart.result[0].meta

    return NextResponse.json({
      price: meta.regularMarketPrice,
      change: ((meta.regularMarketPrice - meta.previousClose) / meta.previousClose) * 100,
      name: meta.shortName || symbol,
    })
  } catch (e) {
    return NextResponse.json({ error: "Ticker introuvable" }, { status: 404 })
  }
}