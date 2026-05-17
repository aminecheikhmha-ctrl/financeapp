import { NextRequest } from "next/server"
import { fetchYahoo, jsonResponse, CORS_HEADERS } from "@/app/lib/api"

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol")
  if (!symbol) return jsonResponse({ error: "No symbol" }, { status: 400 })

  const data = await fetchYahoo(symbol, "interval=1d&range=1mo")

  if (!data) {
    return jsonResponse({
      symbol,
      name: symbol,
      price: 0,
      previousClose: 0,
      change: 0,
      currency: "USD",
      marketCap: null,
      volume: null,
      high: null,
      low: null,
      history: [],
    })
  }

  const meta = data?.chart?.result?.[0]?.meta
  const closes = data?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? []
  const timestamps = data?.chart?.result?.[0]?.timestamp ?? []

  const price = meta?.regularMarketPrice ?? 0
  const previousClose = meta?.previousClose ?? meta?.chartPreviousClose ?? 0
  const change = previousClose ? ((price - previousClose) / previousClose) * 100 : 0

  return jsonResponse({
    symbol: meta?.symbol ?? symbol,
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
}
