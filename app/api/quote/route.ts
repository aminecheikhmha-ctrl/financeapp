import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol")
  if (!symbol) return NextResponse.json({ error: "No symbol" }, { status: 400 })

  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1mo`,
      { headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: 60 } }
    )
    const data = await res.json()
    const meta = data?.chart?.result?.[0]?.meta
    const closes = data?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? []
    const timestamps = data?.chart?.result?.[0]?.timestamp ?? []

    const price = meta?.regularMarketPrice ?? 0
    const previousClose = meta?.previousClose ?? meta?.chartPreviousClose ?? 0
    const change = previousClose ? ((price - previousClose) / previousClose) * 100 : 0

    return NextResponse.json({
      symbol: meta?.symbol,
      name: meta?.shortName ?? symbol,
      price,
      previousClose,
      change,
      currency: meta?.currency ?? "USD",
      marketCap: meta?.marketCap ?? null,
      volume: meta?.regularMarketVolume ?? null,
      high: meta?.regularMarketDayHigh ?? null,
      low: meta?.regularMarketDayLow ?? null,
      history: timestamps.map((t: number, i: number) => ({
        date: new Date(t * 1000).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }),
        value: parseFloat((closes[i] ?? 0).toFixed(2)),
      })),
    })
  } catch {
    return NextResponse.json({ error: "Fetch failed" }, { status: 500 })
  }
}