import { NextResponse } from "next/server"

export const runtime = "nodejs"

// ── In-memory cache (5 min) ────────────────────────────────────────────────────
let cache: { data: unknown; ts: number } | null = null
const CACHE_TTL = 5 * 60 * 1000

async function fetchSymbol(symbol: string, key: string): Promise<{
  key: string; price: number; change1d: number; change1m: number
} | null> {
  try {
    const encoded = encodeURIComponent(symbol)
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encoded}?interval=1d&range=2mo`,
      {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; TradexBot/1.0)" },
        signal: AbortSignal.timeout(5000),
      }
    )
    if (!res.ok) return null
    const data   = await res.json()
    const result = data.chart?.result?.[0]
    const closes = (result?.indicators?.quote?.[0]?.close ?? []).filter(Boolean) as number[]
    const n      = closes.length
    if (n < 2) return null

    const price   = closes[n - 1]
    const change1d = n > 1  ? ((closes[n - 1] - closes[n - 2])  / closes[n - 2])  * 100 : 0
    const change1m = n > 21 ? ((closes[n - 1] - closes[n - 21]) / closes[n - 21]) * 100 : 0

    return { key, price, change1d, change1m }
  } catch {
    return null
  }
}

export async function GET() {
  // Return cached data if fresh
  if (cache && Date.now() - cache.ts < CACHE_TTL) {
    return NextResponse.json(cache.data)
  }

  // Fetch main symbols in parallel
  const SYMBOLS: Record<string, string> = {
    spy:  "SPY",
    vix:  "%5EVIX",     // ^VIX — pre-encoded
    gold: "GLD",
    tlt:  "TLT",
    dxy:  "DX-Y.NYB",
  }

  const results = await Promise.allSettled(
    Object.entries(SYMBOLS).map(([key, sym]) => fetchSymbol(sym, key))
  )

  const snapshot: Record<string, { price: number; change1d: number; change1m: number } | null> = {}
  for (const r of results) {
    if (r.status === "fulfilled" && r.value) {
      snapshot[r.value.key] = { price: r.value.price, change1d: r.value.change1d, change1m: r.value.change1m }
    }
  }

  // Yield curve: 10Y minus 2Y (^TNX minus ^IRX)
  let yieldCurve: number | null = null
  try {
    const [r10, r2] = await Promise.all([
      fetch("https://query1.finance.yahoo.com/v8/finance/chart/%5ETNX?interval=1d&range=5d", {
        headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(3000),
      }),
      fetch("https://query1.finance.yahoo.com/v8/finance/chart/%5EIRX?interval=1d&range=5d", {
        headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(3000),
      }),
    ])
    const [d10, d2] = await Promise.all([r10.json(), r2.json()])
    const rate10 = (d10.chart?.result?.[0]?.indicators?.quote?.[0]?.close as number[] | undefined)
      ?.filter(Boolean).at(-1)
    const rate2 = (d2.chart?.result?.[0]?.indicators?.quote?.[0]?.close as number[] | undefined)
      ?.filter(Boolean).at(-1)
    if (rate10 != null && rate2 != null) yieldCurve = rate10 - rate2
  } catch {}

  const responseData = {
    ...snapshot,
    yieldCurve,
    updatedAt: new Date().toISOString(),
  }

  cache = { data: responseData, ts: Date.now() }
  return NextResponse.json(responseData)
}
