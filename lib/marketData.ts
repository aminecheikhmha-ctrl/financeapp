// lib/marketData.ts
// Hub centralisé pour toutes les données de marché
// Remplace les appels Yahoo Finance dispersés dans le projet

const POLYGON_KEY  = process.env.POLYGON_API_KEY   ?? ""
const FINNHUB_KEY  = process.env.FINNHUB_API_KEY   ?? ""
const AV_KEY       = process.env.ALPHA_VANTAGE_KEY ?? ""
const FRED_KEY     = process.env.FRED_API_KEY      ?? ""

// ── TYPES ────────────────────────────────────────────────────────────────────

export type OHLCV = {
  date:   string   // YYYY-MM-DD
  open:   number
  high:   number
  low:    number
  close:  number
  volume: number
}

export type Quote = {
  symbol:     string
  price:      number
  change:     number   // % sur 1 jour
  open:       number
  high:       number
  low:        number
  volume:     number
  prev_close: number
  market_cap?: number
  timestamp:  number
}

export type Fundamentals = {
  symbol:         string
  pe_ratio:       number | null
  eps:            number | null
  revenue:        number | null
  market_cap:     number | null
  beta:           number | null
  dividend_yield: number | null
  "52w_high":     number | null
  "52w_low":      number | null
  earnings_date:  string | null
  sector:         string | null
  industry:       string | null
  description:    string | null
}

export type MacroSeries = {
  id:    string
  name:  string
  value: number
  date:  string
  unit:  string
}

// ── CACHE IN-MEMORY ──────────────────────────────────────────────────────────

const _cache = new Map<string, { data: unknown; ts: number }>()

function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = _cache.get(key)
  if (hit && Date.now() - hit.ts < ttlMs) return Promise.resolve(hit.data as T)
  return fn().then(data => { _cache.set(key, { data, ts: Date.now() }); return data })
}

// ── POLYGON.IO — Prix en temps réel + OHLCV ──────────────────────────────────

export async function getQuote(symbol: string): Promise<Quote | null> {
  if (!POLYGON_KEY) return getQuoteYahooFallback(symbol)
  return cached(`quote:${symbol}`, 60_000, async () => {
    try {
      const res = await fetch(
        `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers/${symbol}?apiKey=${POLYGON_KEY}`,
        { next: { revalidate: 60 } }
      )
      if (!res.ok) return getQuoteYahooFallback(symbol)
      const data = await res.json()
      const t = data.ticker
      if (!t) return getQuoteYahooFallback(symbol)
      return {
        symbol,
        price:      t.day?.c ?? t.prevDay?.c ?? 0,
        change:     t.todaysChangePerc ?? 0,
        open:       t.day?.o ?? 0,
        high:       t.day?.h ?? 0,
        low:        t.day?.l ?? 0,
        volume:     t.day?.v ?? 0,
        prev_close: t.prevDay?.c ?? 0,
        timestamp:  Date.now(),
      } satisfies Quote
    } catch {
      return getQuoteYahooFallback(symbol)
    }
  })
}

export async function getOHLCV(
  symbol: string,
  from: string,       // YYYY-MM-DD
  to:   string,       // YYYY-MM-DD
  timespan: "minute" | "hour" | "day" = "day",
  multiplier = 1
): Promise<OHLCV[]> {
  if (!POLYGON_KEY) return getOHLCVYahooFallback(symbol, timespan)
  return cached(`ohlcv:${symbol}:${from}:${to}:${timespan}`, 5 * 60_000, async () => {
    try {
      const res = await fetch(
        `https://api.polygon.io/v2/aggs/ticker/${symbol}/range/${multiplier}/${timespan}/${from}/${to}?adjusted=true&sort=asc&limit=5000&apiKey=${POLYGON_KEY}`
      )
      if (!res.ok) return getOHLCVYahooFallback(symbol, timespan)
      const data = await res.json()
      if (!data.results?.length) return getOHLCVYahooFallback(symbol, timespan)
      return (data.results as any[]).map(r => ({
        date:   new Date(r.t).toISOString().slice(0, 10),
        open:   r.o,
        high:   r.h,
        low:    r.l,
        close:  r.c,
        volume: r.v,
      })) as OHLCV[]
    } catch {
      return getOHLCVYahooFallback(symbol, timespan)
    }
  })
}

// ── FINNHUB — Données fondamentales + Earnings ────────────────────────────────

export async function getFundamentals(symbol: string): Promise<Fundamentals | null> {
  if (!FINNHUB_KEY) return null
  return cached(`fundamentals:${symbol}`, 24 * 60 * 60_000, async () => {
    try {
      const [profileRes, metricsRes, earningsRes] = await Promise.allSettled([
        fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${FINNHUB_KEY}`),
        fetch(`https://finnhub.io/api/v1/stock/metric?symbol=${symbol}&metric=all&token=${FINNHUB_KEY}`),
        fetch(`https://finnhub.io/api/v1/calendar/earnings?symbol=${symbol}&token=${FINNHUB_KEY}`),
      ])
      const profile  = profileRes.status  === "fulfilled" ? await profileRes.value.json()  : {}
      const metrics  = metricsRes.status  === "fulfilled" ? await metricsRes.value.json()  : {}
      const earnings = earningsRes.status === "fulfilled" ? await earningsRes.value.json() : {}
      const m = metrics?.metric ?? {}
      const nextEarnings = earnings?.earningsCalendar?.[0]?.date ?? null
      return {
        symbol,
        pe_ratio:       m["peNormalizedAnnual"]      ?? m["peBasicExclExtraTTM"] ?? null,
        eps:            m["epsNormalizedAnnual"]      ?? null,
        revenue:        m["revenuePerShareAnnual"]    ?? null,
        market_cap:     profile.marketCapitalization ?? null,
        beta:           m["beta"]                    ?? null,
        dividend_yield: m["dividendYieldIndicatedAnnual"] ?? null,
        "52w_high":     m["52WeekHigh"] ?? null,
        "52w_low":      m["52WeekLow"]  ?? null,
        earnings_date:  nextEarnings,
        sector:         profile.finnhubIndustry ?? null,
        industry:       profile.finnhubIndustry ?? null,
        description:    profile.name            ?? null,
      } satisfies Fundamentals
    } catch {
      return null
    }
  })
}

export async function getEarningsDate(symbol: string): Promise<string | null> {
  const f = await getFundamentals(symbol)
  return f?.earnings_date ?? null
}

// ── ALPHA VANTAGE — Indicateurs techniques côté serveur ──────────────────────

export async function getRSI(symbol: string, period = 14): Promise<number | null> {
  if (!AV_KEY) return null
  return cached(`rsi:${symbol}:${period}`, 15 * 60_000, async () => {
    try {
      const res = await fetch(
        `https://www.alphavantage.co/query?function=RSI&symbol=${symbol}&interval=daily&time_period=${period}&series_type=close&apikey=${AV_KEY}`
      )
      const data = await res.json()
      const values = data["Technical Analysis: RSI"]
      if (!values) return null
      const lastKey = Object.keys(values)[0]
      return parseFloat(values[lastKey]?.RSI ?? "50")
    } catch {
      return null
    }
  })
}

export async function getMACD(symbol: string): Promise<{ macd: number; signal: number; histogram: number } | null> {
  if (!AV_KEY) return null
  return cached(`macd:${symbol}`, 15 * 60_000, async () => {
    try {
      const res = await fetch(
        `https://www.alphavantage.co/query?function=MACD&symbol=${symbol}&interval=daily&series_type=close&apikey=${AV_KEY}`
      )
      const data = await res.json()
      const values = data["Technical Analysis: MACD"]
      if (!values) return null
      const lastKey = Object.keys(values)[0]
      const v = values[lastKey]
      return {
        macd:      parseFloat(v.MACD        ?? "0"),
        signal:    parseFloat(v.MACD_Signal ?? "0"),
        histogram: parseFloat(v.MACD_Hist   ?? "0"),
      }
    } catch {
      return null
    }
  })
}

// ── FRED API — Données macro officielles ─────────────────────────────────────

export async function getFredSeries(seriesId: string): Promise<MacroSeries | null> {
  if (!FRED_KEY) return null
  return cached(`fred:${seriesId}`, 60 * 60_000, async () => {
    try {
      const [infoRes, obsRes] = await Promise.allSettled([
        fetch(`https://api.stlouisfed.org/fred/series?series_id=${seriesId}&api_key=${FRED_KEY}&file_type=json`),
        fetch(`https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${FRED_KEY}&file_type=json&sort_order=desc&limit=1`),
      ])
      const info = infoRes.status === "fulfilled" ? await infoRes.value.json() : {}
      const obs  = obsRes.status  === "fulfilled" ? await obsRes.value.json()  : {}
      const lastObs    = obs?.observations?.[0]
      const seriesInfo = info?.seriess?.[0]
      if (!lastObs) return null
      return {
        id:    seriesId,
        name:  seriesInfo?.title     ?? seriesId,
        value: parseFloat(lastObs.value ?? "0"),
        date:  lastObs.date          ?? "",
        unit:  seriesInfo?.units_short ?? "",
      } satisfies MacroSeries
    } catch {
      return null
    }
  })
}

// Séries FRED utiles pour Tradex
export const FRED_SERIES = {
  CPI:         "CPIAUCSL",   // Inflation US
  CORE_CPI:    "CPILFESL",   // Core CPI
  FED_RATE:    "FEDFUNDS",   // Taux Fed effectif
  UNEMPLOYMENT:"UNRATE",     // Chômage US
  GDP:         "GDP",        // PIB US
  YIELD_10Y:   "DGS10",      // Taux 10 ans US
  YIELD_2Y:    "DGS2",       // Taux 2 ans US
  YIELD_3M:    "DGS3MO",     // Taux 3 mois US
}

export async function getAllMacroData() {
  const results = await Promise.allSettled(
    Object.entries(FRED_SERIES).map(([key, id]) =>
      getFredSeries(id).then(data => [key, data] as [string, MacroSeries | null])
    )
  )
  const macro: Record<string, MacroSeries | null> = {}
  results.forEach(r => {
    if (r.status === "fulfilled") macro[r.value[0]] = r.value[1]
  })
  return macro
}

// ── COINGECKO — Crypto ────────────────────────────────────────────────────────

const CRYPTO_ID_MAP: Record<string, string> = {
  "BTC-USD":  "bitcoin",
  "ETH-USD":  "ethereum",
  "SOL-USD":  "solana",
  "BNB-USD":  "binancecoin",
  "XRP-USD":  "ripple",
  "ADA-USD":  "cardano",
  "DOGE-USD": "dogecoin",
  "MATIC-USD":"matic-network",
  "DOT-USD":  "polkadot",
  "LINK-USD": "chainlink",
  "AVAX-USD": "avalanche-2",
}

export async function getCryptoQuote(symbol: string): Promise<Quote | null> {
  const cgId = CRYPTO_ID_MAP[symbol.toUpperCase()]
  if (!cgId) return getQuoteYahooFallback(symbol)
  return cached(`crypto:${symbol}`, 60_000, async () => {
    try {
      const headers: HeadersInit = process.env.COINGECKO_API_KEY
        ? { "x-cg-demo-api-key": process.env.COINGECKO_API_KEY }
        : {}
      const res = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${cgId}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_market_cap=true`,
        { headers }
      )
      if (!res.ok) return getQuoteYahooFallback(symbol)
      const data = await res.json()
      const d = data[cgId]
      if (!d) return getQuoteYahooFallback(symbol)
      return {
        symbol,
        price:      d.usd             ?? 0,
        change:     d.usd_24h_change  ?? 0,
        open:       0,
        high:       0,
        low:        0,
        volume:     d.usd_24h_vol     ?? 0,
        prev_close: 0,
        market_cap: d.usd_market_cap  ?? undefined,
        timestamp:  Date.now(),
      } satisfies Quote
    } catch {
      return getQuoteYahooFallback(symbol)
    }
  })
}

// ── YAHOO FALLBACK — Si clé API manquante ─────────────────────────────────────

export async function getQuoteYahooFallback(symbol: string): Promise<Quote | null> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`,
      { headers: { "User-Agent": "Mozilla/5.0", "Referer": "https://finance.yahoo.com" } }
    )
    if (!res.ok) return null
    const json = await res.json()
    const meta  = json?.chart?.result?.[0]?.meta
    const quote = json?.chart?.result?.[0]?.indicators?.quote?.[0]
    const closes = quote?.close?.filter(Boolean) ?? []
    if (!meta || closes.length === 0) return null
    const price     = meta.regularMarketPrice ?? closes[closes.length - 1]
    const prevClose = meta.previousClose ?? meta.chartPreviousClose ?? price
    const change    = prevClose ? ((price - prevClose) / prevClose) * 100 : 0
    return {
      symbol,
      price,
      change,
      open:       meta.regularMarketOpen       ?? 0,
      high:       meta.regularMarketDayHigh    ?? 0,
      low:        meta.regularMarketDayLow     ?? 0,
      volume:     meta.regularMarketVolume     ?? 0,
      prev_close: prevClose,
      timestamp:  Date.now(),
    }
  } catch { return null }
}

export async function getOHLCVYahooFallback(symbol: string, timespan = "day"): Promise<OHLCV[]> {
  try {
    const interval = timespan === "hour" ? "1h" : timespan === "minute" ? "5m" : "1d"
    const range    = timespan === "hour" ? "1mo" : "3mo"
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`,
      { headers: { "User-Agent": "Mozilla/5.0", "Referer": "https://finance.yahoo.com" } }
    )
    if (!res.ok) return []
    const json   = await res.json()
    const result = json?.chart?.result?.[0]
    if (!result) return []
    const ts = result.timestamp ?? []
    const q  = result.indicators.quote[0]
    return (ts as number[]).map((t, i) => ({
      date:   new Date(t * 1000).toISOString().slice(0, 10),
      open:   q.open?.[i]   ?? 0,
      high:   q.high?.[i]   ?? 0,
      low:    q.low?.[i]    ?? 0,
      close:  q.close?.[i]  ?? 0,
      volume: q.volume?.[i] ?? 0,
    })).filter((d: OHLCV) => d.close > 0)
  } catch { return [] }
}

// ── HELPER UNIVERSEL — Détecte crypto vs stock ────────────────────────────────

export async function getUniversalQuote(symbol: string): Promise<Quote | null> {
  if (symbol.endsWith("-USD") && CRYPTO_ID_MAP[symbol.toUpperCase()]) {
    return getCryptoQuote(symbol)
  }
  return getQuote(symbol)
}
