import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const symbol = searchParams.get("symbol")

  if (!symbol) {
    return NextResponse.json({ error: "Symbol manquant" }, { status: 400 })
  }

  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=3mo`,
      { headers: { "User-Agent": "Mozilla/5.0" } }
    )
    const json = await res.json()
    const result = json.chart.result[0]
    const timestamps = result.timestamp
    const closes = result.indicators.quote[0].close

    const data = timestamps.map((ts: number, i: number) => ({
      time: new Date(ts * 1000).toISOString().split("T")[0],
      value: closes[i],
    })).filter((d: any) => d.value !== null)

    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: "Erreur données" }, { status: 500 })
  }
}