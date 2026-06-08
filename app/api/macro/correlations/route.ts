import { NextResponse } from "next/server"
import { getOHLCV, getOHLCVYahooFallback } from "@/lib/marketData"

export const runtime = "nodejs"

let cache: { data: CorrResponse; ts: number } | null = null
const CACHE_TTL = 15 * 60 * 1000  // 15 min

type CorrResponse = {
  matrix:  Record<string, Record<string, number>>
  symbols: { key: string; label: string }[]
  updatedAt: string
}

const ASSETS = [
  { symbol: "SPY",      key: "SPY",  label: "S&P 500" },
  { symbol: "BTC-USD",  key: "BTC",  label: "Bitcoin" },
  { symbol: "GLD",      key: "GLD",  label: "Or" },
  { symbol: "DX-Y.NYB", key: "DXY",  label: "Dollar" },
  { symbol: "TLT",      key: "TLT",  label: "Bonds" },
  { symbol: "USO",      key: "OIL",  label: "Pétrole" },
]

function pearson(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length)
  if (n < 5) return 0
  const xs = x.slice(-n), ys = y.slice(-n)
  const mx = xs.reduce((a, b) => a + b, 0) / n
  const my = ys.reduce((a, b) => a + b, 0) / n
  const num = xs.reduce((s, xi, i) => s + (xi - mx) * (ys[i] - my), 0)
  const den = Math.sqrt(
    xs.reduce((s, xi) => s + (xi - mx) ** 2, 0) *
    ys.reduce((s, yi) => s + (yi - my) ** 2, 0)
  )
  return den === 0 ? 0 : parseFloat((num / den).toFixed(2))
}

async function fetchCloses(symbol: string): Promise<number[]> {
  try {
    const to   = new Date().toISOString().slice(0, 10)
    const from = new Date(Date.now() - 60 * 86400_000).toISOString().slice(0, 10)
    const ohlcv = await getOHLCV(symbol, from, to, "day")
    const bars  = ohlcv.length > 0 ? ohlcv : await getOHLCVYahooFallback(symbol)
    return bars.map(b => b.close).filter(v => v > 0).slice(-30)
  } catch {
    return []
  }
}

export async function GET() {
  if (cache && Date.now() - cache.ts < CACHE_TTL) {
    return NextResponse.json(cache.data)
  }

  const results = await Promise.allSettled(
    ASSETS.map(async a => ({ key: a.key, closes: await fetchCloses(a.symbol) }))
  )

  const closesByKey: Record<string, number[]> = {}
  for (const r of results) {
    if (r.status === "fulfilled") closesByKey[r.value.key] = r.value.closes
  }

  const keys = ASSETS.map(a => a.key)
  const matrix: Record<string, Record<string, number>> = {}
  for (const k1 of keys) {
    matrix[k1] = {}
    for (const k2 of keys) {
      matrix[k1][k2] = k1 === k2 ? 1 : pearson(closesByKey[k1] ?? [], closesByKey[k2] ?? [])
    }
  }

  const responseData: CorrResponse = {
    matrix,
    symbols: ASSETS.map(a => ({ key: a.key, label: a.label })),
    updatedAt: new Date().toISOString(),
  }
  cache = { data: responseData, ts: Date.now() }
  return NextResponse.json(responseData)
}
