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
type Asset = { symbol: string; name: string; category: Category; sector?: string }

const ASSETS: Asset[] = [
  { symbol: "AAPL",  name: "Apple",             category: "stock", sector: "Technology"  },
  { symbol: "MSFT",  name: "Microsoft",          category: "stock", sector: "Technology"  },
  { symbol: "GOOGL", name: "Alphabet",           category: "stock", sector: "Technology"  },
  { symbol: "AMZN",  name: "Amazon",             category: "stock", sector: "Consumer"    },
  { symbol: "NVDA",  name: "NVIDIA",             category: "stock", sector: "Technology"  },
  { symbol: "TSLA",  name: "Tesla",              category: "stock", sector: "Consumer"    },
  { symbol: "META",  name: "Meta",               category: "stock", sector: "Technology"  },
  { symbol: "BRK-B", name: "Berkshire B",        category: "stock", sector: "Finance"     },
  { symbol: "JPM",   name: "JPMorgan",           category: "stock", sector: "Finance"     },
  { symbol: "V",     name: "Visa",               category: "stock", sector: "Finance"     },
  { symbol: "MA",    name: "Mastercard",         category: "stock", sector: "Finance"     },
  { symbol: "UNH",   name: "UnitedHealth",       category: "stock", sector: "Healthcare"  },
  { symbol: "JNJ",   name: "Johnson & Johnson",  category: "stock", sector: "Healthcare"  },
  { symbol: "XOM",   name: "ExxonMobil",         category: "stock", sector: "Energy"      },
  { symbol: "PG",    name: "Procter & Gamble",   category: "stock", sector: "Consumer"    },
  { symbol: "HD",    name: "Home Depot",         category: "stock", sector: "Consumer"    },
  { symbol: "CVX",   name: "Chevron",            category: "stock", sector: "Energy"      },
  { symbol: "ABBV",  name: "AbbVie",             category: "stock", sector: "Healthcare"  },
  { symbol: "MRK",   name: "Merck",              category: "stock", sector: "Healthcare"  },
  { symbol: "LLY",   name: "Eli Lilly",          category: "stock", sector: "Healthcare"  },
  { symbol: "AVGO",  name: "Broadcom",           category: "stock", sector: "Technology"  },
  { symbol: "COST",  name: "Costco",             category: "stock", sector: "Consumer"    },
  { symbol: "PEP",   name: "PepsiCo",            category: "stock", sector: "Consumer"    },
  { symbol: "KO",    name: "Coca-Cola",          category: "stock", sector: "Consumer"    },
  { symbol: "WMT",   name: "Walmart",            category: "stock", sector: "Consumer"    },
  { symbol: "BAC",   name: "Bank of America",    category: "stock", sector: "Finance"     },
  { symbol: "TMO",   name: "Thermo Fisher",      category: "stock", sector: "Healthcare"  },
  { symbol: "ACN",   name: "Accenture",          category: "stock", sector: "Technology"  },
  { symbol: "MCD",   name: "McDonald's",         category: "stock", sector: "Consumer"    },
  { symbol: "NFLX",  name: "Netflix",            category: "stock", sector: "Technology"  },
  { symbol: "AMD",   name: "AMD",                category: "stock", sector: "Technology"  },
  { symbol: "INTC",  name: "Intel",              category: "stock", sector: "Technology"  },
  { symbol: "QCOM",  name: "Qualcomm",           category: "stock", sector: "Technology"  },
  { symbol: "TXN",   name: "Texas Instruments",  category: "stock", sector: "Technology"  },
  { symbol: "CRM",   name: "Salesforce",         category: "stock", sector: "Technology"  },
  { symbol: "ADBE",  name: "Adobe",              category: "stock", sector: "Technology"  },
  { symbol: "NOW",   name: "ServiceNow",         category: "stock", sector: "Technology"  },
  { symbol: "SNOW",  name: "Snowflake",          category: "stock", sector: "Technology"  },
  { symbol: "PLTR",  name: "Palantir",           category: "stock", sector: "Technology"  },
  { symbol: "BTC-USD", name: "Bitcoin",   category: "crypto", sector: "Crypto" },
  { symbol: "ETH-USD", name: "Ethereum",  category: "crypto", sector: "Crypto" },
  { symbol: "SOL-USD", name: "Solana",    category: "crypto", sector: "Crypto" },
  { symbol: "BNB-USD", name: "BNB",       category: "crypto", sector: "Crypto" },
  { symbol: "ADA-USD", name: "Cardano",   category: "crypto", sector: "Crypto" },
  { symbol: "SPY", name: "S&P 500 ETF",   category: "etf", sector: "ETF" },
  { symbol: "QQQ", name: "Nasdaq 100 ETF",category: "etf", sector: "ETF" },
  { symbol: "GLD", name: "Gold ETF",      category: "etf", sector: "Commodities" },
  { symbol: "TLT", name: "Bonds 20Y ETF", category: "etf", sector: "ETF" },
  { symbol: "IWM", name: "Russell 2000",  category: "etf", sector: "ETF" },
]

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

function ema(values: number[], period: number): number[] {
  const k = 2 / (period + 1)
  const result: number[] = [values[0]]
  for (let i = 1; i < values.length; i++) {
    result.push(values[i] * k + result[i - 1] * (1 - k))
  }
  return result
}

function macdSignal(closes: number[]): "bullish" | "bearish" | "neutral" {
  if (closes.length < 35) return "neutral"
  const ema12 = ema(closes, 12)
  const ema26 = ema(closes, 26)
  const macdLine = ema12.map((v, i) => v - ema26[i])
  const signal = ema(macdLine.slice(-15), 9)
  const lastMacd = macdLine.at(-1) ?? 0
  const lastSignal = signal.at(-1) ?? 0
  const prevMacd = macdLine.at(-2) ?? 0
  const prevSignal = signal.at(-2) ?? 0
  if (lastMacd > lastSignal && prevMacd <= prevSignal) return "bullish"
  if (lastMacd < lastSignal && prevMacd >= prevSignal) return "bearish"
  return lastMacd > lastSignal ? "bullish" : lastMacd < lastSignal ? "bearish" : "neutral"
}

function bbPosition(closes: number[], period = 20): "upper" | "middle" | "lower" | "above" | "below" {
  if (closes.length < period) return "middle"
  const slice = closes.slice(-period)
  const mean = slice.reduce((a, b) => a + b, 0) / period
  const std = Math.sqrt(slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period)
  const upper = mean + 2 * std
  const lower = mean - 2 * std
  const price = closes.at(-1) ?? mean
  if (price > upper) return "above"
  if (price < lower) return "below"
  const pct = (price - lower) / (upper - lower)
  if (pct > 0.75) return "upper"
  if (pct < 0.25) return "lower"
  return "middle"
}

function computeConfluence(rsi: number, macdSig: string, bbPos: string, change1d: number, price: number, ma20: number | null, ma50: number | null): number {
  let bullish = 0, bearish = 0
  // RSI
  if (rsi < 35) bullish += 20
  else if (rsi > 65) bearish += 20
  else if (rsi >= 45 && rsi <= 55) bullish += 5
  // MACD
  if (macdSig === "bullish") bullish += 25
  else if (macdSig === "bearish") bearish += 25
  // BB
  if (bbPos === "lower" || bbPos === "below") bullish += 20
  else if (bbPos === "upper" || bbPos === "above") bearish += 20
  // MA
  if (ma20 != null && price > ma20) bullish += 15
  else if (ma20 != null) bearish += 15
  if (ma50 != null && price > ma50) bullish += 15
  else if (ma50 != null) bearish += 15
  // Momentum
  if (change1d > 0 && change1d < 3) bullish += 5
  else if (change1d < 0 && change1d > -3) bullish += 3
  const total = bullish + bearish
  return total === 0 ? 50 : Math.round((bullish / total) * 100)
}

function computeScore(rsi: number, change: number, price: number, ma20: number | null, ma50: number | null, volRatio: number, sentimentScore?: number | null): number {
  const rsiScore = rsi < 30 ? 25 : rsi < 40 ? 20 : rsi < 50 ? 15 : rsi < 60 ? 10 : rsi < 70 ? 5 : 0
  const momentumScore = change >= -3 && change < 0 ? 22 : change >= 0 && change < 2 ? 17 : change >= -5 && change < -3 ? 14 : change >= 2 && change < 5 ? 10 : change < -5 ? 6 : 3
  let maScore = 12
  if (ma20 != null && ma50 != null) {
    if (price > ma20 && price > ma50 && ma20 > ma50) maScore = 25
    else if (price > ma50 && price < ma20) maScore = 18
    else if (price > ma50) maScore = 15
    else if (price < ma50 && price > ma20) maScore = 8
    else maScore = 2
  }
  const volScore = volRatio > 2 ? 13 : volRatio > 1.5 ? 10 : volRatio > 1 ? 7 : volRatio > 0.5 ? 3 : 0
  const newsScorePts = sentimentScore != null ? Math.round(((sentimentScore + 100) / 200) * 15) : 7
  return Math.min(100, Math.max(0, rsiScore + momentumScore + maScore + volScore + newsScorePts))
}

async function fetchAsset(asset: Asset, sentimentCache?: Record<string, number>) {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(asset.symbol)}?interval=1d&range=3mo`,
      { headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: 900 }, signal: AbortSignal.timeout(5000) }
    )
    if (!res.ok) return null
    const json   = await res.json()
    const result = json?.chart?.result?.[0]
    if (!result) return null

    const meta    = result.meta
    const q       = result.indicators?.quote?.[0] ?? {}
    const closes: number[] = (q.close ?? []).filter(Boolean)
    const volumes: number[] = (q.volume ?? []).filter((v: unknown) => v != null)
    if (closes.length < 20) return null

    const price     = meta.regularMarketPrice as number
    const prevClose = (meta.previousClose ?? meta.chartPreviousClose ?? price) as number
    const change1d  = prevClose ? ((price - prevClose) / prevClose) * 100 : 0
    const change1w  = closes.length >= 6 ? ((price - closes.at(-6)!) / closes.at(-6)!) * 100 : change1d
    const change1m  = closes.length >= 21 ? ((price - closes.at(-21)!) / closes.at(-21)!) * 100 : change1d

    const rsi      = rsiVal(closes)
    const ma20     = closes.length >= 20 ? closes.slice(-20).reduce((a, b) => a + b, 0) / 20 : null
    const ma50     = closes.length >= 50 ? closes.slice(-50).reduce((a, b) => a + b, 0) / 50 : null
    const macdSig  = macdSignal(closes)
    const bbPos    = bbPosition(closes)
    const confluence = computeConfluence(rsi, macdSig, bbPos, change1d, price, ma20, ma50)

    const currentVol = (meta.regularMarketVolume ?? volumes.at(-1) ?? 0) as number
    const slice20    = volumes.slice(-20).filter(Boolean) as number[]
    const avgVol     = slice20.length > 0 ? slice20.reduce((a, b) => a + b, 0) / slice20.length : 0
    const volRatio   = avgVol > 0 ? currentVol / avgVol : 1
    const sentimentScore = sentimentCache?.[asset.symbol] ?? null
    const score  = computeScore(rsi, change1d, price, ma20, ma50, volRatio, sentimentScore)

    // Map to new signal labels
    const signal = score >= 75 ? "ACHAT_FORT" : score >= 55 ? "ACHAT" : score < 25 ? "VENTE_FORT" : score < 40 ? "VENTE" : "NEUTRE"
    // Keep old labels for backward compat
    const signalLegacy = score >= 70 ? "ACHETER" : score < 30 ? "ÉVITER" : "ATTENDRE"

    return {
      ...asset,
      type: asset.category,
      name: meta.shortName ?? asset.name,
      price,
      change: parseFloat(change1d.toFixed(2)),
      change_1d: parseFloat(change1d.toFixed(2)),
      change_1w: parseFloat(change1w.toFixed(2)),
      change_1m: parseFloat(change1m.toFixed(2)),
      rsi: parseFloat(rsi.toFixed(1)),
      ma20: ma20 != null ? parseFloat(ma20.toFixed(2)) : null,
      ma50: ma50 != null ? parseFloat(ma50.toFixed(2)) : null,
      volume: currentVol,
      volume_ratio: parseFloat(volRatio.toFixed(2)),
      volRatio: parseFloat(volRatio.toFixed(2)),
      macd_signal: macdSig,
      bb_position: bbPos,
      confluence,
      news_sentiment: sentimentScore ?? 0,
      score,
      signal,
      category: signalLegacy,
      signal_legacy: signalLegacy,
      market_cap: (meta.marketCap ?? 0) as number,
      above_ma200: ma50 != null ? price > ma50 : false,
    }
  } catch {
    return null
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

export async function GET() {
  let sentimentCache: Record<string, number> = {}
  try {
    const supabase = makeSupabase()
    const { data } = await supabase.from("news_sentiment_cache").select("symbol, sentiment_score")
    if (data) {
      for (const row of data) {
        if (row.symbol && typeof row.sentiment_score === "number") sentimentCache[row.symbol] = row.sentiment_score
      }
    }
  } catch {}

  const results = await Promise.all(ASSETS.map(a => fetchAsset(a, sentimentCache)))
  const assets  = (results.filter(Boolean) as NonNullable<Awaited<ReturnType<typeof fetchAsset>>>[])
    .filter(a => a.score != null)
    .sort((a, b) => b.score - a.score)

  return NextResponse.json(
    {
      assets,
      top_buys:  assets.filter(a => a.signal_legacy === "ACHETER"),
      top_sells: assets.filter(a => a.signal_legacy === "ÉVITER"),
      neutral:   assets.filter(a => a.signal_legacy === "ATTENDRE"),
      updated_at: new Date().toISOString(),
    },
    { headers: CORS_HEADERS }
  )
}
