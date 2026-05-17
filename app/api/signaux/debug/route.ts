import { NextResponse } from "next/server"
import { analyserIndicateurs } from "@/lib/indicateurs"

const WATCHLIST = [
  "AAPL", "TSLA", "NVDA", "MSFT", "AMZN",
  "META", "GOOGL", "BTC-USD", "ETH-USD", "SPY"
]

async function fetchDonnees(ticker: string) {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1y`,
      { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" }
    )
    if (!res.ok) return { ticker, error: `HTTP ${res.status}` }
    const json = await res.json()
    const result = json?.chart?.result?.[0]
    if (!result) return { ticker, error: "no result" }

    const meta = result.meta
    const q = result.indicators?.quote?.[0] ?? {}
    const closes: number[]  = (q.close  ?? []).filter(Boolean)
    const volumes: number[] = (q.volume ?? []).filter(Boolean)
    const highs: number[]   = (q.high   ?? []).filter(Boolean)
    const lows: number[]    = (q.low    ?? []).filter(Boolean)

    if (closes.length < 50) return { ticker, error: `not enough data: ${closes.length} bars` }

    const ind = analyserIndicateurs(closes, volumes, meta.regularMarketPrice, highs, lows)

    return {
      ticker,
      prix: meta.regularMarketPrice,
      bars: closes.length,
      score: ind.score,
      trend: ind.trend,
      rsi: ind.rsi.toFixed(1),
      stoch_k: ind.stoch_k.toFixed(1),
      macd_hist: ind.macd.histogram.toFixed(4),
      bb_pos: ind.bb.position.toFixed(1),
      confluence: `${ind.confluence_count}/${ind.confluence_total}`,
      signals: ind.signals,
      would_generate: ind.score >= 50 && ind.trend !== "neutral",
    }
  } catch (e: any) {
    return { ticker, error: e?.message ?? "unknown error" }
  }
}

export async function GET() {
  const results = await Promise.all(WATCHLIST.map(fetchDonnees))
  return NextResponse.json(results, { status: 200 })
}
