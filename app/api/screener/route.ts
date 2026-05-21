import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { CORS_HEADERS } from "@/app/lib/api"

function makeSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

type Category = "stock" | "crypto" | "etf"
type Asset = { symbol: string; name: string; category: Category }

const ASSETS: Asset[] = [
  // ── Stocks ────────────────────────────────────────────────────────────────
  { symbol: "AAPL",  name: "Apple",             category: "stock" },
  { symbol: "MSFT",  name: "Microsoft",          category: "stock" },
  { symbol: "GOOGL", name: "Alphabet",           category: "stock" },
  { symbol: "AMZN",  name: "Amazon",             category: "stock" },
  { symbol: "NVDA",  name: "NVIDIA",             category: "stock" },
  { symbol: "TSLA",  name: "Tesla",              category: "stock" },
  { symbol: "META",  name: "Meta",               category: "stock" },
  { symbol: "BRK-B", name: "Berkshire B",        category: "stock" },
  { symbol: "JPM",   name: "JPMorgan",           category: "stock" },
  { symbol: "V",     name: "Visa",               category: "stock" },
  { symbol: "MA",    name: "Mastercard",         category: "stock" },
  { symbol: "UNH",   name: "UnitedHealth",       category: "stock" },
  { symbol: "JNJ",   name: "Johnson & Johnson",  category: "stock" },
  { symbol: "XOM",   name: "ExxonMobil",         category: "stock" },
  { symbol: "PG",    name: "Procter & Gamble",   category: "stock" },
  { symbol: "HD",    name: "Home Depot",         category: "stock" },
  { symbol: "CVX",   name: "Chevron",            category: "stock" },
  { symbol: "ABBV",  name: "AbbVie",             category: "stock" },
  { symbol: "MRK",   name: "Merck",              category: "stock" },
  { symbol: "LLY",   name: "Eli Lilly",          category: "stock" },
  { symbol: "AVGO",  name: "Broadcom",           category: "stock" },
  { symbol: "COST",  name: "Costco",             category: "stock" },
  { symbol: "PEP",   name: "PepsiCo",            category: "stock" },
  { symbol: "KO",    name: "Coca-Cola",          category: "stock" },
  { symbol: "WMT",   name: "Walmart",            category: "stock" },
  { symbol: "BAC",   name: "Bank of America",    category: "stock" },
  { symbol: "TMO",   name: "Thermo Fisher",      category: "stock" },
  { symbol: "ACN",   name: "Accenture",          category: "stock" },
  { symbol: "MCD",   name: "McDonald's",         category: "stock" },
  { symbol: "NFLX",  name: "Netflix",            category: "stock" },
  { symbol: "AMD",   name: "AMD",                category: "stock" },
  { symbol: "INTC",  name: "Intel",              category: "stock" },
  { symbol: "QCOM",  name: "Qualcomm",           category: "stock" },
  { symbol: "TXN",   name: "Texas Instruments",  category: "stock" },
  { symbol: "CRM",   name: "Salesforce",         category: "stock" },
  { symbol: "ADBE",  name: "Adobe",              category: "stock" },
  { symbol: "NOW",   name: "ServiceNow",         category: "stock" },
  { symbol: "SNOW",  name: "Snowflake",          category: "stock" },
  { symbol: "PLTR",  name: "Palantir",           category: "stock" },
  // ── Crypto ────────────────────────────────────────────────────────────────
  { symbol: "BTC-USD", name: "Bitcoin",   category: "crypto" },
  { symbol: "ETH-USD", name: "Ethereum",  category: "crypto" },
  { symbol: "SOL-USD", name: "Solana",    category: "crypto" },
  { symbol: "BNB-USD", name: "BNB",       category: "crypto" },
  { symbol: "ADA-USD", name: "Cardano",   category: "crypto" },
  // ── ETFs ──────────────────────────────────────────────────────────────────
  { symbol: "SPY", name: "S&P 500 ETF",   category: "etf" },
  { symbol: "QQQ", name: "Nasdaq 100 ETF",category: "etf" },
  { symbol: "GLD", name: "Gold ETF",      category: "etf" },
  { symbol: "TLT", name: "Bonds 20Y ETF", category: "etf" },
  { symbol: "IWM", name: "Russell 2000",  category: "etf" },
]

// ── RSI scalar ───────────────────────────────────────────────────────────────
function rsiVal(closes: number[], period = 14): number {
  if (closes.length <= period) return 50
  let gains = 0, losses = 0
  for (let i = closes.length - period; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1]
    if (d > 0) gains += d; else losses -= d
  }
  const ag = gains / period, al = losses / period
  return al === 0 ? 100 : 100 - 100 / (1 + ag / al)
}

// ── Score 0-100 ───────────────────────────────────────────────────────────────
// sentimentScore: raw -100..100 from news_sentiment_cache
function computeScore(rsi: number, change: number, price: number, ma20: number | null, ma50: number | null, volRatio: number, sentimentScore?: number | null): number {
  // RSI (0-25 pts): oversold = bullish
  const rsiScore =
    rsi < 30 ? 25 : rsi < 40 ? 20 : rsi < 50 ? 15 : rsi < 60 ? 10 : rsi < 70 ? 5 : 0

  // Momentum (0-22 pts): slight dip is optimal entry
  const momentumScore =
    change >= -3 && change < 0 ? 22
    : change >= 0 && change < 2 ? 17
    : change >= -5 && change < -3 ? 14
    : change >= 2 && change < 5 ? 10
    : change < -5 ? 6
    : 3  // change >= 5 (overbought momentum)

  // MA structure (0-25 pts)
  let maScore = 12
  if (ma20 != null && ma50 != null) {
    if (price > ma20 && price > ma50 && ma20 > ma50) maScore = 25
    else if (price > ma50 && price < ma20)            maScore = 18
    else if (price > ma50)                            maScore = 15
    else if (price < ma50 && price > ma20)            maScore = 8
    else                                              maScore = 2
  }

  // Volume ratio (0-13 pts)
  const volScore =
    volRatio > 2 ? 13 : volRatio > 1.5 ? 10 : volRatio > 1 ? 7 : volRatio > 0.5 ? 3 : 0

  // News sentiment (0-15 pts): scale from -100..100 → 0..15
  const newsScorePts = sentimentScore != null
    ? Math.round(((sentimentScore + 100) / 200) * 15)
    : 7 // neutral default if no news data

  return Math.min(100, Math.max(0, rsiScore + momentumScore + maScore + volScore + newsScorePts))
}

// ── Per-asset fetch ───────────────────────────────────────────────────────────
async function fetchAsset(asset: Asset, sentimentCache?: Record<string, number>) {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(asset.symbol)}?interval=1d&range=3mo`,
      { headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: 900 }, signal: AbortSignal.timeout(5000) }
    )
    if (!res.ok) return { ...asset, price: null }
    const json   = await res.json()
    const result = json?.chart?.result?.[0]
    if (!result) return null

    const meta    = result.meta
    const q       = result.indicators?.quote?.[0] ?? {}
    const closes: number[] = (q.close  ?? []).filter(Boolean)
    const volumes: number[] = (q.volume ?? []).filter((v: unknown) => v != null)
    if (closes.length < 20) return null

    const price     = meta.regularMarketPrice as number
    const prevClose = (meta.previousClose ?? meta.chartPreviousClose ?? price) as number
    const change    = prevClose ? ((price - prevClose) / prevClose) * 100 : 0

    const rsi  = rsiVal(closes)
    const ma20 = closes.length >= 20 ? closes.slice(-20).reduce((a, b) => a + b, 0) / 20 : null
    const ma50 = closes.length >= 50 ? closes.slice(-50).reduce((a, b) => a + b, 0) / 50 : null

    const currentVol = (meta.regularMarketVolume ?? volumes.at(-1) ?? 0) as number
    const slice20    = volumes.slice(-20).filter(Boolean) as number[]
    const avgVol     = slice20.length > 0 ? slice20.reduce((a, b) => a + b, 0) / slice20.length : 0
    const volRatio   = avgVol > 0 ? currentVol / avgVol : 1

    const sentimentScore = sentimentCache?.[asset.symbol] ?? null
    const score  = computeScore(rsi, change, price, ma20, ma50, volRatio, sentimentScore)
    const signal = score >= 70 ? "ACHETER" : score < 30 ? "ÉVITER" : "ATTENDRE"
    const hasNewsBadge = sentimentScore != null

    return {
      ...asset,
      name:     meta.shortName ?? asset.name,
      price,
      change:   parseFloat(change.toFixed(2)),
      rsi:      parseFloat(rsi.toFixed(1)),
      ma20:     ma20 != null ? parseFloat(ma20.toFixed(2)) : null,
      ma50:     ma50 != null ? parseFloat(ma50.toFixed(2)) : null,
      volume:   currentVol,
      volRatio: parseFloat(volRatio.toFixed(2)),
      score,
      signal,
      news_sentiment_score: sentimentScore,
      has_news_badge: hasNewsBadge,
    }
  } catch {
    return { ...asset, price: null }
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

// ── Route ─────────────────────────────────────────────────────────────────────
export async function GET() {
  // Fetch news sentiment cache from Supabase (best-effort, doesn't block)
  let sentimentCache: Record<string, number> = {}
  try {
    const supabase = makeSupabase()
    const { data } = await supabase
      .from("news_sentiment_cache")
      .select("symbol, sentiment_score")
    if (data) {
      for (const row of data) {
        if (row.symbol && typeof row.sentiment_score === "number") {
          sentimentCache[row.symbol] = row.sentiment_score
        }
      }
    }
  } catch {}

  const results = await Promise.all(ASSETS.map(a => fetchAsset(a, sentimentCache)))
  const assets  = (results.filter(Boolean) as NonNullable<Awaited<ReturnType<typeof fetchAsset>>>[])
    .filter(a => (a as any).score != null)
    .sort((a, b) => (b as any).score - (a as any).score)

  return NextResponse.json(
    {
      assets,
      top_buys:  assets.filter((a: any) => a.signal === "ACHETER"),
      top_sells: assets.filter((a: any) => a.signal === "ÉVITER"),
      neutral:   assets.filter((a: any) => a.signal === "ATTENDRE"),
      updated_at: new Date().toISOString(),
    },
    { headers: CORS_HEADERS }
  )
}
