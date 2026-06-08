import { NextRequest, NextResponse } from "next/server"
import { getOHLCV, getOHLCVYahooFallback } from "@/lib/marketData"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const symbol = searchParams.get("symbol")
  if (!symbol) return NextResponse.json({ error: "Symbol manquant" }, { status: 400 })

  const range = searchParams.get("range") ?? "3mo"
  const to    = new Date().toISOString().slice(0, 10)
  const from  = new Date(Date.now() - (
    range === "1mo" ? 30  :
    range === "6mo" ? 180 :
    range === "1y"  ? 365 : 90
  ) * 86400_000).toISOString().slice(0, 10)

  try {
    const ohlcv = await getOHLCV(symbol, from, to, "day")
    const data  = ohlcv.length > 0 ? ohlcv : await getOHLCVYahooFallback(symbol)
    return NextResponse.json(
      data.map(d => ({ time: d.date, value: d.close }))
    )
  } catch {
    return NextResponse.json({ error: "Erreur données" }, { status: 500 })
  }
}
