import { NextResponse } from "next/server"
import { getFredSeries, FRED_SERIES } from "@/lib/marketData"

export const runtime   = "nodejs"
export const maxDuration = 30  // Pro only; harmless on Hobby

// ── In-memory cache (5 min) ────────────────────────────────────────────────────
let cache: { data: SnapshotResponse; ts: number } | null = null
const CACHE_TTL = 5 * 60 * 1000

// ── Types ──────────────────────────────────────────────────────────────────────
export type AssetData = {
  symbol: string
  label:  string
  flag:   string
  price:     number
  change_1d: number
  change_1w: number
  change_1m: number
  change_ytd:number
  rsi:       number
  sparkline: number[]
}

export type SnapshotResponse = {
  indices:     Record<string, AssetData>
  sectors:     Record<string, AssetData>
  bonds:       Record<string, AssetData>
  currencies:  Record<string, AssetData>
  commodities: Record<string, AssetData>
  crypto:      Record<string, AssetData>
  vix:         number
  yieldCurve:  number | null
  fedRate:     number
  // Backward-compat fields consumed by old code
  spy:  { price: number; change1d: number; change1m: number } | null
  gold: { price: number; change1d: number; change1m: number } | null
  dxy:  { price: number; change1m: number } | null
  updatedAt: string
}

type AssetMeta = {
  symbol: string   // raw Yahoo Finance symbol
  key:    string   // short key used as dict key in response
  label:  string
  flag:   string
  group:  "indices" | "sectors" | "bonds" | "currencies" | "commodities" | "crypto" | "vix"
}

// ── Symbol list (39 symbols) ───────────────────────────────────────────────────
const SYMBOLS: AssetMeta[] = [
  // US + Global Indices
  { symbol: "SPY",      key: "SPY",    label: "S&P 500",      flag: "🇺🇸", group: "indices" },
  { symbol: "QQQ",      key: "QQQ",    label: "Nasdaq 100",   flag: "🇺🇸", group: "indices" },
  { symbol: "DIA",      key: "DIA",    label: "Dow Jones",    flag: "🇺🇸", group: "indices" },
  { symbol: "IWM",      key: "IWM",    label: "Russell 2000", flag: "🇺🇸", group: "indices" },
  { symbol: "EWG",      key: "EWG",    label: "DAX (DE)",     flag: "🇩🇪", group: "indices" },
  { symbol: "EWJ",      key: "EWJ",    label: "Nikkei (JP)",  flag: "🇯🇵", group: "indices" },
  { symbol: "EWU",      key: "EWU",    label: "FTSE (UK)",    flag: "🇬🇧", group: "indices" },
  { symbol: "FXI",      key: "FXI",    label: "China",        flag: "🇨🇳", group: "indices" },
  { symbol: "VWO",      key: "VWO",    label: "Émergents",    flag: "🌍",  group: "indices" },
  // US Sector ETFs
  { symbol: "XLK",      key: "XLK",    label: "Technology",   flag: "💻",  group: "sectors" },
  { symbol: "XLF",      key: "XLF",    label: "Finance",      flag: "🏦",  group: "sectors" },
  { symbol: "XLE",      key: "XLE",    label: "Énergie",      flag: "⚡",  group: "sectors" },
  { symbol: "XLV",      key: "XLV",    label: "Santé",        flag: "🏥",  group: "sectors" },
  { symbol: "XLC",      key: "XLC",    label: "Comm. Svcs",   flag: "📡",  group: "sectors" },
  { symbol: "XLY",      key: "XLY",    label: "Conso. Disc.", flag: "🛒",  group: "sectors" },
  { symbol: "XLI",      key: "XLI",    label: "Industriels",  flag: "🏭",  group: "sectors" },
  { symbol: "XLP",      key: "XLP",    label: "Conso. Base",  flag: "🛍️", group: "sectors" },
  // Yields (price = yield in %)
  { symbol: "^IRX",     key: "IRX",    label: "US 3 mois",    flag: "🇺🇸", group: "bonds" },
  { symbol: "^FVX",     key: "FVX",    label: "US 5 ans",     flag: "🇺🇸", group: "bonds" },
  { symbol: "^TNX",     key: "TNX",    label: "US 10 ans",    flag: "🇺🇸", group: "bonds" },
  { symbol: "^TYX",     key: "TYX",    label: "US 30 ans",    flag: "🇺🇸", group: "bonds" },
  // Currencies
  { symbol: "DX-Y.NYB", key: "DXY",    label: "DXY",          flag: "💵",  group: "currencies" },
  { symbol: "EURUSD=X", key: "EURUSD", label: "EUR/USD",      flag: "🇪🇺", group: "currencies" },
  { symbol: "USDJPY=X", key: "USDJPY", label: "USD/JPY",      flag: "🇯🇵", group: "currencies" },
  { symbol: "GBPUSD=X", key: "GBPUSD", label: "GBP/USD",      flag: "🇬🇧", group: "currencies" },
  { symbol: "USDCHF=X", key: "USDCHF", label: "USD/CHF",      flag: "🇨🇭", group: "currencies" },
  { symbol: "AUDUSD=X", key: "AUDUSD", label: "AUD/USD",      flag: "🇦🇺", group: "currencies" },
  { symbol: "USDCNY=X", key: "USDCNY", label: "USD/CNY",      flag: "🇨🇳", group: "currencies" },
  // Commodities
  { symbol: "GLD",      key: "GLD",    label: "Or",           flag: "🥇",  group: "commodities" },
  { symbol: "SLV",      key: "SLV",    label: "Argent",       flag: "⚪",  group: "commodities" },
  { symbol: "USO",      key: "USO",    label: "Pétrole WTI",  flag: "🛢️", group: "commodities" },
  { symbol: "UNG",      key: "UNG",    label: "Gaz naturel",  flag: "⛽",  group: "commodities" },
  { symbol: "WEAT",     key: "WEAT",   label: "Blé",          flag: "🌾",  group: "commodities" },
  // Crypto
  { symbol: "BTC-USD",  key: "BTC",    label: "Bitcoin",      flag: "₿",   group: "crypto" },
  { symbol: "ETH-USD",  key: "ETH",    label: "Ethereum",     flag: "⟠",  group: "crypto" },
  { symbol: "SOL-USD",  key: "SOL",    label: "Solana",       flag: "◎",  group: "crypto" },
  { symbol: "BNB-USD",  key: "BNB",    label: "BNB",          flag: "🔶", group: "crypto" },
  { symbol: "XRP-USD",  key: "XRP",    label: "XRP",          flag: "✕",  group: "crypto" },
  // VIX
  { symbol: "^VIX",     key: "VIX",    label: "VIX",          flag: "😨",  group: "vix" },
]

// ── RSI helper ────────────────────────────────────────────────────────────────
function calcRsi(closes: number[], period = 14): number {
  if (closes.length <= period) return 50
  let gains = 0, losses = 0
  for (let i = closes.length - period; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1]
    if (d > 0) gains += d; else losses -= d
  }
  const ag = gains / period, al = losses / period
  return al === 0 ? 100 : parseFloat((100 - 100 / (1 + ag / al)).toFixed(1))
}

// ── Fetch one symbol ──────────────────────────────────────────────────────────
async function fetchSymbolData(meta: AssetMeta): Promise<(AssetData & { key: string; group: string }) | null> {
  try {
    const encoded = encodeURIComponent(meta.symbol)

    const tryFetch = async (base: string) =>
      fetch(`${base}${encoded}?interval=1d&range=1y`, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept":     "application/json",
        },
        signal: AbortSignal.timeout(6000),
      })

    let res = await tryFetch("https://query2.finance.yahoo.com/v8/finance/chart/")
    if (!res.ok) res = await tryFetch("https://query1.finance.yahoo.com/v8/finance/chart/")
    if (!res.ok) return null

    const data   = await res.json()
    const result = data?.chart?.result?.[0]
    if (!result) return null

    const timestamps: number[]            = result.timestamp ?? []
    const rawCloses:  (number | null)[]   = result.indicators?.quote?.[0]?.close ?? []

    // Filter nulls while keeping timestamp alignment
    const closes: number[]  = []
    const tsAligned: number[] = []
    for (let i = 0; i < rawCloses.length; i++) {
      const v = rawCloses[i]
      if (v != null && v > 0) {
        closes.push(v)
        tsAligned.push(timestamps[i] ?? 0)
      }
    }
    if (closes.length < 5) return null

    const n       = closes.length
    const price   = closes[n - 1]
    const c1d = n > 1  ? ((price - closes[n - 2])  / closes[n - 2])  * 100 : 0
    const c1w = n > 5  ? ((price - closes[n - 6])  / closes[n - 6])  * 100 : c1d
    const c1m = n > 21 ? ((price - closes[n - 22]) / closes[n - 22]) * 100 : c1d

    // YTD: first bar of current year
    const yearStart = new Date(new Date().getFullYear(), 0, 1).getTime() / 1000
    let ytdClose    = closes[0]
    for (let i = 0; i < tsAligned.length; i++) {
      if (tsAligned[i] >= yearStart) { ytdClose = closes[i]; break }
    }
    const cYtd = ytdClose ? ((price - ytdClose) / ytdClose) * 100 : c1m

    return {
      key:    meta.key,
      group:  meta.group,
      symbol: meta.symbol,
      label:  meta.label,
      flag:   meta.flag,
      price:       parseFloat(price.toFixed(4)),
      change_1d:   parseFloat(c1d.toFixed(2)),
      change_1w:   parseFloat(c1w.toFixed(2)),
      change_1m:   parseFloat(c1m.toFixed(2)),
      change_ytd:  parseFloat(cYtd.toFixed(2)),
      rsi:         calcRsi(closes),
      sparkline:   closes.slice(-30),
    }
  } catch {
    return null
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function GET() {
  if (cache && Date.now() - cache.ts < CACHE_TTL) {
    return NextResponse.json(cache.data)
  }

  const [results, fredFedRate] = await Promise.all([
    Promise.allSettled(SYMBOLS.map(m => fetchSymbolData(m))),
    getFredSeries(FRED_SERIES.FED_RATE).catch(() => null),
  ])

  const grouped: Record<string, Record<string, AssetData>> = {
    indices: {}, sectors: {}, bonds: {}, currencies: {}, commodities: {}, crypto: {},
  }
  let vix = 18

  for (const r of results) {
    if (r.status !== "fulfilled" || !r.value) continue
    const { key, group, ...data } = r.value
    if (group === "vix") {
      vix = data.price
    } else if (group in grouped) {
      grouped[group][key] = data
    }
  }

  // 10Y - 3M yield spread
  const tnx = grouped.bonds["TNX"]?.price ?? null
  const irx = grouped.bonds["IRX"]?.price ?? null
  const yieldCurve = tnx != null && irx != null ? parseFloat((tnx - irx).toFixed(2)) : null

  const spy  = grouped.indices["SPY"]     ?? null
  const gold = grouped.commodities["GLD"] ?? null
  const dxy  = grouped.currencies["DXY"]  ?? null

  const responseData: SnapshotResponse = {
    indices:     grouped.indices,
    sectors:     grouped.sectors,
    bonds:       grouped.bonds,
    currencies:  grouped.currencies,
    commodities: grouped.commodities,
    crypto:      grouped.crypto,
    vix,
    yieldCurve,
    fedRate: fredFedRate?.value ?? 5.25,
    spy:  spy  ? { price: spy.price,   change1d: spy.change_1d,   change1m: spy.change_1m  } : null,
    gold: gold ? { price: gold.price,  change1d: gold.change_1d,  change1m: gold.change_1m } : null,
    dxy:  dxy  ? { price: dxy.price,   change1m: dxy.change_1m   } : null,
    updatedAt: new Date().toISOString(),
  }

  cache = { data: responseData, ts: Date.now() }
  return NextResponse.json(responseData)
}
