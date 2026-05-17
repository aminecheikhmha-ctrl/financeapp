import { NextRequest } from "next/server"

// ── Indicator helpers (all operate on full arrays for accuracy) ───────────────

function smaSeries(v: number[], period: number): (number | null)[] {
  return v.map((_, i) => {
    if (i < period - 1) return null
    return v.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period
  })
}

function emaSeries(v: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(v.length).fill(null)
  if (v.length < period) return out
  out[period - 1] = v.slice(0, period).reduce((a, b) => a + b, 0) / period
  const k = 2 / (period + 1)
  for (let i = period; i < v.length; i++) {
    out[i] = v[i] * k + out[i - 1]! * (1 - k)
  }
  return out
}

function rsiSeries(closes: number[], period = 14): (number | null)[] {
  const out: (number | null)[] = new Array(closes.length).fill(null)
  for (let i = period; i < closes.length; i++) {
    let gains = 0, losses = 0
    for (let j = i - period + 1; j <= i; j++) {
      const d = closes[j] - closes[j - 1]
      if (d > 0) gains += d; else losses -= d
    }
    const ag = gains / period, al = losses / period
    out[i] = al === 0 ? 100 : 100 - 100 / (1 + ag / al)
  }
  return out
}

function bbSeries(closes: number[], period = 20): {
  upper: (number | null)[]
  middle: (number | null)[]
  lower: (number | null)[]
} {
  const sma = smaSeries(closes, period)
  const upper: (number | null)[] = new Array(closes.length).fill(null)
  const lower: (number | null)[] = new Array(closes.length).fill(null)
  for (let i = period - 1; i < closes.length; i++) {
    const m = sma[i]!
    const variance = closes.slice(i - period + 1, i + 1).reduce((a, c) => a + (c - m) ** 2, 0) / period
    const std = Math.sqrt(variance)
    upper[i] = m + 2 * std
    lower[i] = m - 2 * std
  }
  return { upper, middle: sma, lower }
}

function macdSeries(closes: number[]): {
  line: (number | null)[]
  signal: (number | null)[]
  hist: (number | null)[]
} {
  const ema12 = emaSeries(closes, 12)
  const ema26 = emaSeries(closes, 26)
  const line: (number | null)[] = closes.map((_, i) =>
    ema12[i] != null && ema26[i] != null ? ema12[i]! - ema26[i]! : null
  )
  // EMA-9 of MACD line (starting at first non-null)
  const firstMacd = line.findIndex(v => v != null)
  const signalArr: (number | null)[] = new Array(closes.length).fill(null)
  if (firstMacd >= 0) {
    const macdSlice = line.slice(firstMacd) as number[]
    const sigSlice = emaSeries(macdSlice, 9)
    sigSlice.forEach((v, i) => { signalArr[firstMacd + i] = v })
  }
  const hist: (number | null)[] = closes.map((_, i) =>
    line[i] != null && signalArr[i] != null ? line[i]! - signalArr[i]! : null
  )
  return { line, signal: signalArr, hist }
}

function atrSeries(highs: number[], lows: number[], closes: number[], period = 14): (number | null)[] {
  const out: (number | null)[] = new Array(closes.length).fill(null)
  const tr = closes.map((c, i) =>
    i === 0
      ? highs[0] - lows[0]
      : Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1]))
  )
  if (tr.length < period) return out
  let atr = tr.slice(0, period).reduce((a, b) => a + b, 0) / period
  out[period - 1] = atr
  for (let i = period; i < tr.length; i++) {
    atr = (atr * (period - 1) + tr[i]) / period
    out[i] = atr
  }
  return out
}

function stochSeries(highs: number[], lows: number[], closes: number[], period = 14): {
  k: (number | null)[]
  d: (number | null)[]
} {
  const k: (number | null)[] = new Array(closes.length).fill(null)
  for (let i = period - 1; i < closes.length; i++) {
    const hh = Math.max(...highs.slice(i - period + 1, i + 1))
    const ll = Math.min(...lows.slice(i - period + 1, i + 1))
    k[i] = hh === ll ? 50 : ((closes[i] - ll) / (hh - ll)) * 100
  }
  const d: (number | null)[] = new Array(closes.length).fill(null)
  for (let i = period + 1; i < closes.length; i++) {
    if (k[i] != null && k[i - 1] != null && k[i - 2] != null)
      d[i] = (k[i]! + k[i - 1]! + k[i - 2]!) / 3
  }
  return { k, d }
}

function obvSeries(closes: number[], volumes: number[]): number[] {
  const obv = [0]
  for (let i = 1; i < closes.length; i++) {
    obv.push(closes[i] > closes[i - 1] ? obv[i - 1] + volumes[i]
           : closes[i] < closes[i - 1] ? obv[i - 1] - volumes[i]
           : obv[i - 1])
  }
  return obv
}

function williamsRSeries(highs: number[], lows: number[], closes: number[], period = 14): (number | null)[] {
  const out: (number | null)[] = new Array(closes.length).fill(null)
  for (let i = period - 1; i < closes.length; i++) {
    const hh = Math.max(...highs.slice(i - period + 1, i + 1))
    const ll = Math.min(...lows.slice(i - period + 1, i + 1))
    out[i] = hh === ll ? -50 : ((hh - closes[i]) / (hh - ll)) * -100
  }
  return out
}

function vwapSeries(
  highs: number[], lows: number[], closes: number[], volumes: number[], timestamps: number[]
): (number | null)[] {
  const out: (number | null)[] = new Array(closes.length).fill(null)
  const tp = closes.map((c, i) => (highs[i] + lows[i] + c) / 3)
  const isIntraday = timestamps.length > 1 && timestamps[1] - timestamps[0] < 86400

  if (isIntraday) {
    let cumTPV = 0, cumVol = 0, curDay = -1
    for (let i = 0; i < closes.length; i++) {
      const day = Math.floor(timestamps[i] / 86400)
      if (day !== curDay) { cumTPV = 0; cumVol = 0; curDay = day }
      cumTPV += tp[i] * volumes[i]; cumVol += volumes[i]
      out[i] = cumVol > 0 ? cumTPV / cumVol : closes[i]
    }
  } else {
    // Rolling 20-period for daily+
    for (let i = 0; i < closes.length; i++) {
      const s = Math.max(0, i - 19)
      let sumTPV = 0, sumVol = 0
      for (let j = s; j <= i; j++) { sumTPV += tp[j] * volumes[j]; sumVol += volumes[j] }
      out[i] = sumVol > 0 ? sumTPV / sumVol : closes[i]
    }
  }
  return out
}

// ── Confluence signal detection ────────────────────────────────────────────────

type BarSignal = {
  type: "buy" | "sell"
  strength: "weak" | "moderate" | "strong"
  confluence: string[]
  confluence_count: number
}

function detectSignal(
  i: number,
  closes: number[],
  ema9: (number | null)[],
  ema21: (number | null)[],
  rsi: (number | null)[],
  macdHist: (number | null)[],
  stochK: (number | null)[],
  bbUpper: (number | null)[],
  bbLower: (number | null)[],
  willR: (number | null)[],
  obv: number[]
): BarSignal | null {
  if (i < 30) return null
  const c = closes[i]
  const r = rsi[i], mH = macdHist[i], pmH = macdHist[i - 1]
  const sK = stochK[i], bU = bbUpper[i], bL = bbLower[i]
  const e9 = ema9[i], e21 = ema21[i], pe9 = ema9[i - 1], pe21 = ema21[i - 1]
  const wr = willR[i]
  const oNow = obv[i], oPrev = obv[Math.max(0, i - 5)]

  const bull: string[] = []
  const bear: string[] = []

  if (r != null) {
    if (r < 35) bull.push(`RSI survendu (${r.toFixed(1)})`)
    else if (r > 65) bear.push(`RSI suracheté (${r.toFixed(1)})`)
  }
  if (mH != null && pmH != null) {
    if (mH > 0 && pmH <= 0) bull.push("MACD crossover haussier")
    else if (mH < 0 && pmH >= 0) bear.push("MACD crossover baissier")
  }
  if (bL != null && c < bL) bull.push("Prix sous BB lower")
  if (bU != null && c > bU) bear.push("Prix sur BB upper")
  if (sK != null) {
    if (sK < 20) bull.push(`Stoch survendu (${sK.toFixed(1)})`)
    else if (sK > 80) bear.push(`Stoch suracheté (${sK.toFixed(1)})`)
  }
  if (e9 != null && e21 != null && pe9 != null && pe21 != null) {
    if (e9 > e21 && pe9 <= pe21) bull.push("EMA9 × EMA21 golden cross")
    else if (e9 < e21 && pe9 >= pe21) bear.push("EMA9 × EMA21 death cross")
  }
  if (wr != null) {
    if (wr < -80) bull.push(`Williams %R survendu (${wr.toFixed(1)})`)
    else if (wr > -20) bear.push(`Williams %R suracheté (${wr.toFixed(1)})`)
  }
  if (oPrev !== 0) {
    if (oNow > oPrev * 1.01) bull.push("OBV haussier")
    else if (oNow < oPrev * 0.99) bear.push("OBV baissier")
  }

  const dom = bull.length >= bear.length ? bull : bear
  const type = bull.length >= bear.length ? "buy" : "sell"
  if (dom.length < 2) return null
  return {
    type,
    strength: dom.length >= 4 ? "strong" : "moderate",
    confluence: dom,
    confluence_count: dom.length,
  }
}

// ── Yahoo Finance interval config ─────────────────────────────────────────────

const INTERVAL_MAX_RANGE: Record<string, string> = {
  "1m":  "7d",
  "5m":  "60d",
  "15m": "60d",
  "60m": "730d",
  "1d":  "max",
  "1wk": "max",
  "1mo": "max",
}

const DATE_ONLY = new Set(["1d", "1wk", "1mo"])

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const symbol   = searchParams.get("symbol")
  const interval = searchParams.get("interval") ?? "1d"
  const range    = searchParams.get("range")    ?? INTERVAL_MAX_RANGE[interval] ?? "max"

  if (!symbol)                      return Response.json({ error: "Symbol manquant" }, { status: 400 })
  if (!INTERVAL_MAX_RANGE[interval]) return Response.json({ error: "Interval invalide" }, { status: 400 })

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: DATE_ONLY.has(interval) ? 300 : 60 },
    })
    if (!res.ok) throw new Error(`Yahoo ${res.status}`)

    const json   = await res.json()
    const result = json?.chart?.result?.[0]
    if (!result) throw new Error("No data")

    const timestamps: number[] = result.timestamp ?? []
    const q = result.indicators?.quote?.[0] ?? {}
    const closes:  number[] = q.close  ?? []
    const opens:   number[] = q.open   ?? []
    const highs:   number[] = q.high   ?? []
    const lows:    number[] = q.low    ?? []
    const volumes: number[] = q.volume ?? []

    // ── Compute all indicators on full dataset ────────────────────────────────
    const ma20Arr  = smaSeries(closes, 20)
    const ma50Arr  = smaSeries(closes, 50)
    const ema9Arr  = emaSeries(closes, 9)
    const ema21Arr = emaSeries(closes, 21)
    const rsiArr   = rsiSeries(closes, 14)
    const bb       = bbSeries(closes, 20)
    const macd     = macdSeries(closes)
    const atrArr   = atrSeries(highs, lows, closes, 14)
    const stoch    = stochSeries(highs, lows, closes, 14)
    const obvArr   = obvSeries(closes, volumes)
    const wrArr    = williamsRSeries(highs, lows, closes, 14)
    const vwapArr  = vwapSeries(highs, lows, closes, volumes, timestamps)

    const isDateOnly = DATE_ONLY.has(interval)

    const allBars = []
    for (let i = 0; i < timestamps.length; i++) {
      if (closes[i] == null || opens[i] == null) continue

      const d    = new Date(timestamps[i] * 1000)
      const date = isDateOnly
        ? d.toISOString().slice(0, 10)
        : d.toISOString().slice(0, 16).replace("T", " ")

      const sig = detectSignal(
        i, closes, ema9Arr, ema21Arr, rsiArr,
        macd.hist, stoch.k, bb.upper, bb.lower, wrArr, obvArr
      )

      allBars.push({
        ts:          timestamps[i],
        date,
        open:        opens[i],
        high:        highs[i]   ?? closes[i],
        low:         lows[i]    ?? closes[i],
        close:       closes[i],
        volume:      volumes[i] ?? 0,
        // Classic
        ma20:        ma20Arr[i],
        ma50:        ma50Arr[i],
        rsi:         rsiArr[i],
        bb_upper:    bb.upper[i],
        bb_middle:   bb.middle[i],
        bb_lower:    bb.lower[i],
        // New
        ema9:        ema9Arr[i],
        ema21:       ema21Arr[i],
        vwap:        vwapArr[i],
        atr:         atrArr[i],
        stoch_k:     stoch.k[i],
        stoch_d:     stoch.d[i],
        obv:         obvArr[i],
        macd_line:   macd.line[i],
        macd_signal: macd.signal[i],
        macd_hist:   macd.hist[i],
        williams_r:  wrArr[i],
        // Confluence signal
        bar_signal:  sig,
      })
    }

    return Response.json(allBars)
  } catch {
    return Response.json({ error: "Erreur données" }, { status: 500 })
  }
}
