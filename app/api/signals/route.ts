export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import Groq from "groq-sdk"
import { createClient } from "@supabase/supabase-js"
import { rateLimit, getClientIP } from "@/lib/rate-limit"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_KEY || "placeholder"
)

export const maxDuration = 60 // Pro plan; Hobby is capped at 10s by Vercel

// ─── Types ────────────────────────────────────────────────────────────────────

type AssetType = "stock" | "crypto" | "etf" | "commodity"

type Asset = {
  symbol: string
  name: string
  type: AssetType
}

export type SignalResult = {
  symbol: string
  name: string
  type: AssetType
  price: number
  change_24h: number
  signal: "ACHAT_FORT" | "ACHAT" | "VENTE_FORT" | "VENTE"
  strength: "strong" | "moderate" | "weak"
  confluence_score: number
  confluence_count: number
  total_indicators: number
  confirmed_by: string[]
  entry_price: number
  tp1: number
  tp2: number
  tp3: number
  sl: number
  risk_reward_tp1: number
  risk_reward_tp2: number
  atr: number
  rsi: number
  macd_hist: number
  volume_ratio: number
  bb_position: number
  ai_comment: string
  timestamp: string
  expires_at: string
  candle_pattern: string | null
  ichimoku_signal: "bullish" | "bearish" | "neutral"
  above_ma200: boolean
  volume_spike: boolean
  is_market_closed?: boolean
  low_volume_warning?: boolean
  trend_warning?: string
}

// ─── Asset list ───────────────────────────────────────────────────────────────
// Vercel Hobby = 10s max → keep to ~20 assets fetched in full parallel

const ASSETS: Asset[] = [
  // === STOCKS (8) ===
  { symbol: "AAPL",  name: "Apple",       type: "stock" },
  { symbol: "MSFT",  name: "Microsoft",   type: "stock" },
  { symbol: "NVDA",  name: "NVIDIA",      type: "stock" },
  { symbol: "TSLA",  name: "Tesla",       type: "stock" },
  { symbol: "META",  name: "Meta",        type: "stock" },
  { symbol: "AMZN",  name: "Amazon",      type: "stock" },
  { symbol: "GOOGL", name: "Alphabet",    type: "stock" },
  { symbol: "NFLX",  name: "Netflix",     type: "stock" },
  // === CRYPTO (7) ===
  { symbol: "BTC-USD",  name: "Bitcoin",   type: "crypto" },
  { symbol: "ETH-USD",  name: "Ethereum",  type: "crypto" },
  { symbol: "SOL-USD",  name: "Solana",    type: "crypto" },
  { symbol: "BNB-USD",  name: "BNB",       type: "crypto" },
  { symbol: "XRP-USD",  name: "Ripple",    type: "crypto" },
  { symbol: "DOGE-USD", name: "Dogecoin",  type: "crypto" },
  { symbol: "AVAX-USD", name: "Avalanche", type: "crypto" },
  // === ETF (3) ===
  { symbol: "SPY",  name: "S&P 500 ETF",      type: "etf" },
  { symbol: "QQQ",  name: "Nasdaq 100 ETF",   type: "etf" },
  { symbol: "ARKK", name: "ARK Innovation",   type: "etf" },
  // === COMMODITIES (2) ===
  { symbol: "GLD", name: "Or (Gold ETF)",     type: "commodity" },
  { symbol: "USO", name: "Pétrole (Oil ETF)", type: "commodity" },
]

// ─── Indicator calculations ────────────────────────────────────────────────────

function calcRSI(closes: number[], period: number): number {
  if (closes.length < period + 1) return 50
  let gains = 0
  let losses = 0
  for (let i = closes.length - period; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1]
    if (d > 0) gains += d
    else losses -= d
  }
  const ag = gains / period
  const al = losses / period
  if (al === 0) return 100
  return 100 - 100 / (1 + ag / al)
}

function calcStoch(
  closes: number[],
  highs: number[],
  lows: number[],
  kPeriod = 14,
  dPeriod = 3
): { k: number; d: number } {
  if (closes.length < kPeriod + dPeriod) return { k: 50, d: 50 }
  const ks: number[] = []
  for (let i = closes.length - kPeriod - dPeriod + 1; i <= closes.length - kPeriod; i++) {
    const slice_h = highs.slice(i, i + kPeriod)
    const slice_l = lows.slice(i, i + kPeriod)
    const hh = Math.max(...slice_h)
    const ll = Math.min(...slice_l)
    const c = closes[i + kPeriod - 1]
    ks.push(hh === ll ? 50 : ((c - ll) / (hh - ll)) * 100)
  }
  const k = ks[ks.length - 1]
  const d = ks.slice(-dPeriod).reduce((a, b) => a + b, 0) / dPeriod
  return { k, d }
}

function calcWilliamsR(
  closes: number[],
  highs: number[],
  lows: number[],
  period = 14
): number {
  if (closes.length < period) return -50
  const slice_h = highs.slice(-period)
  const slice_l = lows.slice(-period)
  const hh = Math.max(...slice_h)
  const ll = Math.min(...slice_l)
  const c = closes[closes.length - 1]
  if (hh === ll) return -50
  return ((hh - c) / (hh - ll)) * -100
}

function calcCCI(
  highs: number[],
  lows: number[],
  closes: number[],
  period = 20
): number {
  if (closes.length < period) return 0
  const tps: number[] = []
  for (let i = closes.length - period; i < closes.length; i++) {
    tps.push((highs[i] + lows[i] + closes[i]) / 3)
  }
  const smaTp = tps.reduce((a, b) => a + b, 0) / period
  const meanDev = tps.reduce((a, b) => a + Math.abs(b - smaTp), 0) / period
  if (meanDev === 0) return 0
  return (tps[tps.length - 1] - smaTp) / (0.015 * meanDev)
}

function calcEMA(closes: number[], period: number): number {
  if (closes.length < period) return closes[closes.length - 1] ?? 0
  const k = 2 / (period + 1)
  let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period
  for (let i = period; i < closes.length; i++) {
    ema = closes[i] * k + ema * (1 - k)
  }
  return ema
}

function calcSMA(closes: number[], period: number): number {
  if (closes.length < period) return closes[closes.length - 1] ?? 0
  const slice = closes.slice(-period)
  return slice.reduce((a, b) => a + b, 0) / slice.length
}

function calcMACD(closes: number[]): {
  line: number
  signal: number
  histogram: number
  prevHistogram: number
} {
  if (closes.length < 35) return { line: 0, signal: 0, histogram: 0, prevHistogram: 0 }
  const k12 = 2 / 13
  const k26 = 2 / 27
  const k9 = 2 / 10

  // Build EMA12 and EMA26 arrays for signal line calculation
  let ema12 = closes.slice(0, 12).reduce((a, b) => a + b, 0) / 12
  let ema26 = closes.slice(0, 26).reduce((a, b) => a + b, 0) / 26

  const macdLine: number[] = []
  for (let i = 12; i < closes.length; i++) {
    ema12 = closes[i] * k12 + ema12 * (1 - k12)
    if (i >= 25) {
      ema26 = closes[i] * k26 + ema26 * (1 - k26)
      macdLine.push(ema12 - ema26)
    }
  }

  if (macdLine.length < 9) return { line: 0, signal: 0, histogram: 0, prevHistogram: 0 }

  let signalEma = macdLine.slice(0, 9).reduce((a, b) => a + b, 0) / 9
  for (let i = 9; i < macdLine.length; i++) {
    signalEma = macdLine[i] * k9 + signalEma * (1 - k9)
  }

  const line = macdLine[macdLine.length - 1]
  const histogram = line - signalEma
  const prevLine = macdLine[macdLine.length - 2] ?? line
  const prevHistogram = prevLine - signalEma

  return { line, signal: signalEma, histogram, prevHistogram }
}

function calcBB(
  closes: number[],
  period = 20
): { upper: number; lower: number; width: number; widthAvg: number; position: number } {
  if (closes.length < period) {
    const c = closes[closes.length - 1] ?? 0
    return { upper: c, lower: c, width: 0, widthAvg: 0, position: 50 }
  }
  const slice = closes.slice(-period)
  const sma = slice.reduce((a, b) => a + b, 0) / period
  const variance = slice.reduce((a, b) => a + (b - sma) ** 2, 0) / period
  const std = Math.sqrt(variance)
  const upper = sma + 2 * std
  const lower = sma - 2 * std
  const width = upper - lower
  const position = width === 0 ? 50 : ((closes[closes.length - 1] - lower) / width) * 100

  // widthAvg over last 20 periods of width
  const widths: number[] = []
  for (let i = period; i <= closes.length; i++) {
    const s = closes.slice(i - period, i)
    const m = s.reduce((a, b) => a + b, 0) / period
    const v = s.reduce((a, b) => a + (b - m) ** 2, 0) / period
    widths.push(Math.sqrt(v) * 4)
  }
  const widthAvg = widths.length > 0 ? widths.reduce((a, b) => a + b, 0) / widths.length : width

  return { upper, lower, width, widthAvg, position }
}

function calcATR(
  highs: number[],
  lows: number[],
  closes: number[],
  period = 14
): { atr: number; atrAvg: number } {
  if (closes.length < period + 1) return { atr: 0, atrAvg: 0 }
  const trs: number[] = []
  for (let i = 1; i < closes.length; i++) {
    const hl = highs[i] - lows[i]
    const hc = Math.abs(highs[i] - closes[i - 1])
    const lc = Math.abs(lows[i] - closes[i - 1])
    trs.push(Math.max(hl, hc, lc))
  }
  const atr = trs.slice(-period).reduce((a, b) => a + b, 0) / period
  const atrAvg = trs.slice(-period * 2, -period).reduce((a, b) => a + b, 0) / period || atr
  return { atr, atrAvg }
}

function calcOBV(closes: number[], volumes: number[]): { value: number; rising: boolean } {
  if (closes.length < 2) return { value: 0, rising: false }
  let obv = 0
  const obvArr: number[] = [0]
  for (let i = 1; i < closes.length; i++) {
    if (closes[i] > closes[i - 1]) obv += volumes[i]
    else if (closes[i] < closes[i - 1]) obv -= volumes[i]
    obvArr.push(obv)
  }
  const last5 = obvArr.slice(-5)
  const prev10to20 = obvArr.slice(-20, -10)
  const avg5 = last5.reduce((a, b) => a + b, 0) / last5.length
  const avgPrev = prev10to20.length > 0 ? prev10to20.reduce((a, b) => a + b, 0) / prev10to20.length : 0
  return { value: obv, rising: avg5 > avgPrev }
}

function calcVWAP(
  highs: number[],
  lows: number[],
  closes: number[],
  volumes: number[],
  period = 20
): number {
  const len = Math.min(period, closes.length)
  let sumTPV = 0
  let sumV = 0
  for (let i = closes.length - len; i < closes.length; i++) {
    const tp = (highs[i] + lows[i] + closes[i]) / 3
    sumTPV += tp * volumes[i]
    sumV += volumes[i]
  }
  return sumV === 0 ? closes[closes.length - 1] : sumTPV / sumV
}

function calcSupportResistance(
  highs: number[],
  lows: number[],
  period = 20
): { support: number; resistance: number } {
  const slice_h = highs.slice(-period)
  const slice_l = lows.slice(-period)
  return {
    support: Math.min(...slice_l),
    resistance: Math.max(...slice_h),
  }
}

function calcPricePosition(price: number, support: number, resistance: number): number {
  if (resistance === support) return 50
  return ((price - support) / (resistance - support)) * 100
}

function calcIchimoku(highs: number[], lows: number[], closes: number[]) {
  if (highs.length < 26) return { bullish: false, bearish: false }
  const tenkan = (Math.max(...highs.slice(-9)) + Math.min(...lows.slice(-9))) / 2
  const kijun  = (Math.max(...highs.slice(-26)) + Math.min(...lows.slice(-26))) / 2
  const price  = closes[closes.length - 1]
  return {
    tenkan, kijun,
    bullish: price > tenkan && tenkan > kijun,
    bearish: price < tenkan && tenkan < kijun,
  }
}

function detectCandlePattern(bars: { open: number; high: number; low: number; close: number }[]): { pattern: string; type: "buy" | "sell" | "neutral"; strength: number } | null {
  const last = bars[bars.length - 1]
  const prev = bars[bars.length - 2]
  if (!last || !prev) return null

  const body = Math.abs(last.close - last.open)
  const range = last.high - last.low
  if (range === 0) return null
  const bodyRatio = body / range

  const lowerWick = Math.min(last.open, last.close) - last.low
  if (bodyRatio < 0.3 && lowerWick > body * 2 && last.close > last.open)
    return { pattern: "Hammer", type: "buy", strength: 0.7 }

  const upperWick = last.high - Math.max(last.open, last.close)
  if (bodyRatio < 0.3 && upperWick > body * 2 && last.close < last.open)
    return { pattern: "Shooting Star", type: "sell", strength: 0.7 }

  if (prev.close < prev.open && last.close > last.open &&
      last.open < prev.close && last.close > prev.open)
    return { pattern: "Bullish Engulfing", type: "buy", strength: 0.85 }

  if (prev.close > prev.open && last.close < last.open &&
      last.open > prev.close && last.close < prev.open)
    return { pattern: "Bearish Engulfing", type: "sell", strength: 0.85 }

  if (bodyRatio < 0.1)
    return { pattern: "Doji", type: "neutral", strength: 0.5 }

  return null
}

// ─── ADX (Average Directional Index) ─────────────────────────────────────────
// Returns ADX value (0-100). >25 = trending, <20 = ranging/choppy.

function calcADX(highs: number[], lows: number[], closes: number[], period = 14): number {
  const n = closes.length
  if (n < period * 2 + 1) return 20 // default neutral

  const dmPlus: number[] = []
  const dmMinus: number[] = []
  const trs: number[] = []

  for (let i = 1; i < n; i++) {
    const upMove   = highs[i]  - highs[i - 1]
    const downMove = lows[i - 1] - lows[i]
    dmPlus.push(upMove > downMove && upMove > 0 ? upMove : 0)
    dmMinus.push(downMove > upMove && downMove > 0 ? downMove : 0)
    trs.push(Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i]  - closes[i - 1]),
      Math.abs(lows[i]   - closes[i - 1]),
    ))
  }

  // Wilder smoothing over last `period` bars
  const smTR  = trs.slice(-period).reduce((a, b) => a + b, 0)
  const smDMP = dmPlus.slice(-period).reduce((a, b) => a + b, 0)
  const smDMM = dmMinus.slice(-period).reduce((a, b) => a + b, 0)

  const diPlus  = smTR > 0 ? (smDMP / smTR) * 100 : 0
  const diMinus = smTR > 0 ? (smDMM / smTR) * 100 : 0
  const dx      = diPlus + diMinus > 0
    ? (Math.abs(diPlus - diMinus) / (diPlus + diMinus)) * 100
    : 0

  return dx
}

// ─── RSI Divergence ───────────────────────────────────────────────────────────
// Compares price direction vs RSI direction over last ~lookback bars.
// Bullish: price lower low but RSI higher low  → hidden strength
// Bearish: price higher high but RSI lower high → hidden weakness

function calcRSIDivergence(
  closes: number[],
  lookback = 14,
): "bullish" | "bearish" | "none" {
  const n = closes.length
  if (n < lookback + 15) return "none" // not enough history

  // Build RSI series for the last (lookback + 14) bars
  const window = closes.slice(-(lookback + 14))
  const rsiSeries: number[] = []
  for (let i = 14; i <= window.length; i++) {
    rsiSeries.push(calcRSI(window.slice(0, i), 14))
  }
  if (rsiSeries.length < lookback) return "none"

  const priceWindow = closes.slice(-lookback)
  const rsiWindow   = rsiSeries.slice(-lookback)

  const firstHalf  = { price: priceWindow.slice(0, lookback >> 1),  rsi: rsiWindow.slice(0, lookback >> 1)  }
  const secondHalf = { price: priceWindow.slice(lookback >> 1),      rsi: rsiWindow.slice(lookback >> 1)      }

  const priceMin1 = Math.min(...firstHalf.price)
  const priceMin2 = Math.min(...secondHalf.price)
  const rsiMin1   = Math.min(...firstHalf.rsi)
  const rsiMin2   = Math.min(...secondHalf.rsi)

  // Bullish: price making lower low but RSI making higher low
  if (priceMin2 < priceMin1 * 0.999 && rsiMin2 > rsiMin1 + 1) return "bullish"

  const priceMax1 = Math.max(...firstHalf.price)
  const priceMax2 = Math.max(...secondHalf.price)
  const rsiMax1   = Math.max(...firstHalf.rsi)
  const rsiMax2   = Math.max(...secondHalf.rsi)

  // Bearish: price making higher high but RSI making lower high
  if (priceMax2 > priceMax1 * 1.001 && rsiMax2 < rsiMax1 - 1) return "bearish"

  return "none"
}

// ─── Weekly trend (from daily data) ──────────────────────────────────────────
// Approximate weekly candles by grouping every 5 trading days.
// Returns "bullish" | "bearish" | "neutral"

function calcWeeklyTrend(closes: number[]): "bullish" | "bearish" | "neutral" {
  if (closes.length < 25) return "neutral"
  // Build weekly closes: last close of each 5-day group
  const weekly: number[] = []
  for (let i = 4; i < closes.length; i += 5) weekly.push(closes[i])
  if (weekly.length < 5) return "neutral"

  const wEMA9  = calcEMA(weekly, Math.min(9,  weekly.length))
  const wEMA21 = calcEMA(weekly, Math.min(21, weekly.length))
  const wRSI   = calcRSI(weekly, Math.min(14, weekly.length - 1))

  if (wEMA9 > wEMA21 && wRSI > 50) return "bullish"
  if (wEMA9 < wEMA21 && wRSI < 50) return "bearish"
  return "neutral"
}

// ─── Volume+Price direction confirmation ─────────────────────────────────────
// Returns true when volume has been confirming the dominant price direction
// over the last `lookback` sessions (≥ half of sessions agree).

function calcVolumeConfirmation(
  closes: number[],
  volumes: number[],
  direction: "up" | "down",
  lookback = 5,
): boolean {
  const n = closes.length
  if (n < lookback + 2 || volumes.length < lookback + 2) return false

  let confirmed = 0
  for (let i = n - lookback; i < n; i++) {
    const priceUp  = closes[i] > closes[i - 1]
    const volAbove = volumes[i] > (volumes.slice(Math.max(0, i - 5), i).reduce((a, b) => a + b, 0) / 5 || 1)
    if (direction === "up"   && priceUp  && volAbove) confirmed++
    if (direction === "down" && !priceUp && volAbove) confirmed++
  }
  return confirmed >= Math.ceil(lookback / 2)
}

// ─── Pivot-based key levels (for TP / SL) ────────────────────────────────────
// Scans for swing highs/lows (simple 3-bar pivots) and returns the nearest
// resistance above and support below the current price.

function calcPivotLevels(
  highs: number[],
  lows: number[],
  price: number,
): { pivotSupport: number; pivotResistance: number } {
  const pivotHighs: number[] = []
  const pivotLows:  number[] = []

  for (let i = 2; i < highs.length - 2; i++) {
    if (highs[i] > highs[i - 1] && highs[i] > highs[i - 2] &&
        highs[i] > highs[i + 1] && highs[i] > highs[i + 2]) {
      pivotHighs.push(highs[i])
    }
    if (lows[i] < lows[i - 1] && lows[i] < lows[i - 2] &&
        lows[i] < lows[i + 1] && lows[i] < lows[i + 2]) {
      pivotLows.push(lows[i])
    }
  }

  const abovePrice = pivotHighs.filter(h => h > price * 1.001).sort((a, b) => a - b)
  const belowPrice = pivotLows.filter(l => l < price * 0.999).sort((a, b) => b - a)

  return {
    pivotResistance: abovePrice[0] ?? price * 1.05,
    pivotSupport:    belowPrice[0] ?? price * 0.95,
  }
}

// ─── Scoring checks ───────────────────────────────────────────────────────────

type IndicatorData = {
  rsi14: number
  rsi7: number
  stoch_k: number
  stoch_d: number
  williams_r: number
  cci: number
  bb_position: number
  bb_width: number
  bb_width_avg: number
  macd_hist: number
  macd_prev_hist: number
  ema9: number
  ema21: number
  price: number
  ma20: number
  support: number
  resistance: number
  obv_rising: boolean
  volume_ratio: number
  vwap: number
  atr: number
  atr_avg: number
  price_position: number
  // New fields
  adx: number
  weekly_trend: "bullish" | "bearish" | "neutral"
  rsi_divergence: "bullish" | "bearish" | "none"
  vol_confirms_buy: boolean
  vol_confirms_sell: boolean
}

type Check = {
  name: string
  points: number
  pass: (d: IndicatorData) => boolean
}

const BUY_CHECKS: Check[] = [
  // Momentum oscillators
  { name: "RSI·14",         points: 3, pass: (d) => d.rsi14 < 45 },
  { name: "RSI·7",          points: 2, pass: (d) => d.rsi7 < 40 },
  { name: "Stoch·%K",       points: 2, pass: (d) => d.stoch_k < 40 },
  { name: "Stoch·%D",       points: 1, pass: (d) => d.stoch_d < 40 },
  { name: "Williams·%R",    points: 1, pass: (d) => d.williams_r < -55 },
  { name: "CCI",            points: 1, pass: (d) => d.cci < -50 },
  // Bollinger
  { name: "BB·Lower",       points: 3, pass: (d) => d.bb_position < 25 },
  { name: "BB·Squeeze",     points: 1, pass: (d) => d.bb_width < d.bb_width_avg },
  // Trend
  { name: "MACD·Hist↑",    points: 3, pass: (d) => d.macd_hist > 0 && d.macd_hist > d.macd_prev_hist },
  { name: "EMA·Cross",      points: 2, pass: (d) => d.ema9 > d.ema21 },
  { name: "Prix·MA20",      points: 1, pass: (d) => d.price > d.ma20 },
  // Structure
  { name: "Support",        points: 1, pass: (d) => d.price_position < 35 },
  { name: "OBV↑",          points: 2, pass: (d) => d.obv_rising },
  { name: "Volume·élevé",   points: 2, pass: (d) => d.volume_ratio > 1.2 },
  { name: "VWAP",           points: 1, pass: (d) => d.price < d.vwap },
  { name: "ATR·élevé",     points: 1, pass: (d) => d.atr > d.atr_avg },
  // ── New ──────────────────────────────────────────────────────────────────
  { name: "ADX·Trend",      points: 2, pass: (d) => d.adx > 20 },
  { name: "Weekly·Haussier",points: 3, pass: (d) => d.weekly_trend === "bullish" },
  { name: "Divergence·RSI", points: 4, pass: (d) => d.rsi_divergence === "bullish" },
  { name: "Vol·Confirme",   points: 2, pass: (d) => d.vol_confirms_buy },
]

const SELL_CHECKS: Check[] = [
  // Momentum oscillators
  { name: "RSI·14",         points: 3, pass: (d) => d.rsi14 > 55 },
  { name: "RSI·7",          points: 2, pass: (d) => d.rsi7 > 60 },
  { name: "Stoch·%K",       points: 2, pass: (d) => d.stoch_k > 60 },
  { name: "Stoch·%D",       points: 1, pass: (d) => d.stoch_d > 60 },
  { name: "Williams·%R",    points: 1, pass: (d) => d.williams_r > -45 },
  { name: "CCI",            points: 1, pass: (d) => d.cci > 50 },
  // Bollinger
  { name: "BB·Upper",       points: 3, pass: (d) => d.bb_position > 75 },
  { name: "BB·Squeeze",     points: 1, pass: (d) => d.bb_width < d.bb_width_avg },
  // Trend
  { name: "MACD·Hist↓",    points: 3, pass: (d) => d.macd_hist < 0 && d.macd_hist < d.macd_prev_hist },
  { name: "EMA·Cross↓",    points: 2, pass: (d) => d.ema9 < d.ema21 },
  { name: "Prix·MA20↓",    points: 1, pass: (d) => d.price < d.ma20 },
  // Structure
  { name: "Résistance",     points: 1, pass: (d) => d.price_position > 65 },
  { name: "OBV↓",          points: 2, pass: (d) => !d.obv_rising },
  { name: "Volume·élevé",   points: 2, pass: (d) => d.volume_ratio > 1.2 },
  { name: "VWAP↓",         points: 1, pass: (d) => d.price > d.vwap },
  { name: "ATR·élevé",     points: 1, pass: (d) => d.atr > d.atr_avg },
  // ── New ──────────────────────────────────────────────────────────────────
  { name: "ADX·Trend",      points: 2, pass: (d) => d.adx > 20 },
  { name: "Weekly·Baissier",points: 3, pass: (d) => d.weekly_trend === "bearish" },
  { name: "Divergence·RSI", points: 4, pass: (d) => d.rsi_divergence === "bearish" },
  { name: "Vol·Confirme",   points: 2, pass: (d) => d.vol_confirms_sell },
]

// ─── Groq batch comment generator ─────────────────────────────────────────────

async function generateComments(fortSignals: SignalResult[]): Promise<Map<string, string>> {
  if (!fortSignals.length) return new Map()
  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
    const list = fortSignals
      .map(
        (s) =>
          `${s.symbol}(${s.signal}): RSI=${s.rsi.toFixed(0)}, Conf=${s.confluence_score.toFixed(0)}%, Vol×${s.volume_ratio.toFixed(1)}, MACD=${s.macd_hist > 0 ? "+" : ""}${s.macd_hist.toFixed(2)}`
      )
      .join("\n")

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content:
            "Tu es un analyste technique expert. Pour chaque actif fourni, génère un commentaire concis (max 15 mots) en français expliquant le signal. Réponds UNIQUEMENT avec un tableau JSON valide: [{\"symbol\": \"XXX\", \"comment\": \"...\"}]",
        },
        {
          role: "user",
          content: list,
        },
      ],
      max_tokens: 1024,
      temperature: 0.3,
    })

    const content = completion.choices[0]?.message?.content ?? ""
    // Extract JSON array defensively
    let parsed: { symbol: string; comment: string }[] = []
    try {
      parsed = JSON.parse(content)
    } catch {
      const match = content.match(/\[[\s\S]*\]/)
      if (match) {
        try {
          parsed = JSON.parse(match[0])
        } catch {
          parsed = []
        }
      }
    }

    const map = new Map<string, string>()
    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        if (item?.symbol && item?.comment) {
          map.set(item.symbol, item.comment)
        }
      }
    }
    return map
  } catch {
    return new Map()
  }
}

// ─── Market hours ─────────────────────────────────────────────────────────────

function isNYSEOpen(): boolean {
  const now = new Date()
  const day = now.getUTCDay() // 0=Sun, 6=Sat
  if (day === 0 || day === 6) return false
  // Approximate Eastern Time as UTC-4 (EDT); close enough for signal flagging
  const etHour = (now.getUTCHours() - 4 + 24) % 24
  const etTime = etHour * 60 + now.getUTCMinutes()
  return etTime >= 9 * 60 + 30 && etTime < 16 * 60
}

// ─── Per-asset fetch & compute ─────────────────────────────────────────────────

async function fetchYahoo(symbol: string): Promise<any | null> {
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://finance.yahoo.com",
  }
  // Try query2 first, fallback to query1
  for (const base of ["https://query2.finance.yahoo.com", "https://query1.finance.yahoo.com"]) {
    try {
      const res = await fetch(
        `${base}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=3mo`,
        { headers, cache: "no-store" }
      )
      if (!res.ok) {
        process.stdout.write(`[signals] ${symbol} HTTP ${res.status} on ${base}\n`)
        continue
      }
      const json = await res.json()
      const result = json?.chart?.result?.[0]
      if (result) return result
      process.stdout.write(`[signals] ${symbol} empty result from ${base}\n`)
    } catch (e) {
      process.stdout.write(`[signals] ${symbol} fetch error on ${base}: ${e}\n`)
      continue
    }
  }
  process.stdout.write(`[signals] ${symbol} ALL sources failed\n`)
  return null
}

async function processAsset(asset: Asset, sentimentScore?: number): Promise<SignalResult | null> {
  try {
    const result = await fetchYahoo(asset.symbol)
    if (!result) return null

    const q = result.indicators?.quote?.[0] ?? {}
    const meta = result.meta ?? {}

    const rawCloses: (number | null)[] = q.close ?? []
    const rawHighs: (number | null)[] = q.high ?? []
    const rawLows: (number | null)[] = q.low ?? []
    const rawOpens: (number | null)[] = q.open ?? []
    const rawVolumes: (number | null)[] = q.volume ?? []

    const closes = rawCloses.filter((v): v is number => v != null)
    const highs = rawHighs.filter((v): v is number => v != null)
    const lows = rawLows.filter((v): v is number => v != null)
    const opens = rawOpens.filter((v): v is number => v != null)
    const volumes = rawVolumes.map((v) => (v != null ? v : 0))

    if (closes.length < 20) return null

    const price = closes[closes.length - 1]
    const prevClose = closes[closes.length - 2] ?? price
    const change_24h = ((price - prevClose) / prevClose) * 100

    // Volume ratio — use last COMPLETED session (second-to-last candle) to avoid
    // partial-day bias: today's stock candle has 0 vol before NYSE opens, and
    // crypto intraday volume is a fraction of a full day. Using yesterday's
    // completed volume gives a reliable baseline for all asset types.
    const n = volumes.length
    const recentVol = n >= 2 ? (volumes[n - 2] ?? volumes[n - 1] ?? 0) : (volumes[n - 1] ?? 0)
    const avgSlice = n >= 22 ? volumes.slice(n - 22, n - 2) : volumes.slice(0, Math.max(1, n - 2))
    const avgVol = avgSlice.length > 0 ? avgSlice.reduce((a, b) => a + b, 0) / avgSlice.length : 1
    const volume_ratio = avgVol > 0 ? recentVol / avgVol : 1

    // Indicators
    const rsi14 = calcRSI(closes, 14)
    const rsi7 = calcRSI(closes, 7)
    const { k: stoch_k, d: stoch_d } = calcStoch(closes, highs, lows)
    const williams_r = calcWilliamsR(closes, highs, lows)
    const cci = calcCCI(highs, lows, closes)
    const { upper: _upper, lower: _lower, width: bb_width, widthAvg: bb_width_avg, position: bb_position } = calcBB(closes)
    const { line: _macdLine, signal: _signal, histogram: macd_hist, prevHistogram: macd_prev_hist } = calcMACD(closes)
    const ema9 = calcEMA(closes, 9)
    const ema21 = calcEMA(closes, 21)
    const ma20 = calcSMA(closes, 20)
    const { support, resistance } = calcSupportResistance(highs, lows)
    const { value: _obvVal, rising: obv_rising } = calcOBV(closes, volumes)
    const vwap = calcVWAP(highs, lows, closes, volumes)
    const { atr, atrAvg: atr_avg } = calcATR(highs, lows, closes)
    const price_position = calcPricePosition(price, support, resistance)

    // ── New indicators ────────────────────────────────────────────────────────
    const adx             = calcADX(highs, lows, closes)
    const weekly_trend    = calcWeeklyTrend(closes)
    const rsi_divergence  = calcRSIDivergence(closes)
    const vol_confirms_buy  = calcVolumeConfirmation(closes, volumes, "up")
    const vol_confirms_sell = calcVolumeConfirmation(closes, volumes, "down")

    const data: IndicatorData = {
      rsi14,
      rsi7,
      stoch_k,
      stoch_d,
      williams_r,
      cci,
      bb_position,
      bb_width,
      bb_width_avg,
      macd_hist,
      macd_prev_hist,
      ema9,
      ema21,
      price,
      ma20,
      support,
      resistance,
      obv_rising,
      volume_ratio,
      vwap,
      atr,
      atr_avg,
      price_position,
      adx,
      weekly_trend,
      rsi_divergence,
      vol_confirms_buy,
      vol_confirms_sell,
    }

    // New indicators
    const ichimoku = calcIchimoku(highs, lows, closes)
    const ichimoku_signal: "bullish" | "bearish" | "neutral" = ichimoku.bullish ? "bullish" : ichimoku.bearish ? "bearish" : "neutral"
    const ma200 = calcSMA(closes, 200)
    const above_ma200 = price > ma200
    const volume_spike = volume_ratio > 2.0
    const bars = closes.map((c, i) => ({ open: opens[i] ?? c, high: highs[i] ?? c, low: lows[i] ?? c, close: c }))
    const candlePattern = detectCandlePattern(bars)
    const candle_pattern = candlePattern ? candlePattern.pattern : null

    // Score
    let buy_score = 0
    const buy_confirmed: string[] = []
    for (const check of BUY_CHECKS) {
      if (check.pass(data)) {
        buy_score += check.points
        buy_confirmed.push(check.name)
      }
    }
    // Extra buy points from new indicators
    if (ichimoku.bullish) { buy_score += 2; buy_confirmed.push("Ichimoku·Bull") }
    if (candlePattern?.type === "buy") { buy_score += 2; buy_confirmed.push(candlePattern.pattern) }
    if (above_ma200) buy_score += 1
    if (volume_spike) buy_score += 3

    let sell_score = 0
    const sell_confirmed: string[] = []
    for (const check of SELL_CHECKS) {
      if (check.pass(data)) {
        sell_score += check.points
        sell_confirmed.push(check.name)
      }
    }
    // Extra sell points from new indicators
    if (ichimoku.bearish) { sell_score += 2; sell_confirmed.push("Ichimoku·Bear") }
    if (candlePattern?.type === "sell") { sell_score += 2; sell_confirmed.push(candlePattern.pattern) }
    if (!above_ma200) sell_score += 1
    if (volume_spike) sell_score += 3

    // News sentiment boost (from pre-fetched cache)
    if (sentimentScore !== undefined) {
      if (sentimentScore > 30) { buy_score += 3; buy_confirmed.push("News·Bullish") }
      else if (sentimentScore < -30) { sell_score += 3; sell_confirmed.push("News·Bearish") }
    }

    const MAX_POINTS = 39 // 28 base + 11 new (ADX 2 + Weekly 3 + Divergence 4 + VolConfirm 2)
    const isBuy = buy_score >= sell_score
    const winning_points = isBuy ? buy_score : sell_score
    const confirmed_by = isBuy ? buy_confirmed : sell_confirmed
    let confluence_score = Math.min(100, (winning_points / MAX_POINTS) * 100)

    process.stdout.write(`[signals] ${asset.symbol} score=${confluence_score.toFixed(1)}% isBuy=${isBuy} pts=${winning_points}/${MAX_POINTS} confirmed=[${confirmed_by.slice(0,3).join(",")}]\n`)

    if (confluence_score < 35) return null

    // Volume validation: penalise low-liquidity signals
    let low_volume_warning = false
    if (volume_ratio < 0.5) {
      confluence_score *= 0.8
      low_volume_warning = true
    }

    // Trend alignment: penalise signals that go against the daily EMA9/EMA21 trend
    let trend_warning: string | undefined
    const dailyTrend: "bullish" | "bearish" = ema9 > ema21 ? "bullish" : "bearish"
    if ((isBuy && dailyTrend === "bearish") || (!isBuy && dailyTrend === "bullish")) {
      confluence_score *= 0.85
      trend_warning = "Signal contre la tendance daily"
    }

    // Re-check threshold after adjustments
    if (confluence_score < 35) return null

    // Market hours flag (non-crypto only)
    const is_market_closed = asset.type !== "crypto" && !isNYSEOpen()

    let signal: SignalResult["signal"]
    let strength: SignalResult["strength"]

    if (isBuy) {
      signal = confluence_score >= 68 ? "ACHAT_FORT" : "ACHAT"
    } else {
      signal = confluence_score >= 68 ? "VENTE_FORT" : "VENTE"
    }

    if (confluence_score >= 68) strength = "strong"
    else if (confluence_score >= 50) strength = "moderate"
    else strength = "weak"

    // TP/SL — use nearest pivot level as primary, ATR as fallback / secondary
    const { pivotSupport, pivotResistance } = calcPivotLevels(highs, lows, price)

    let tp1: number, tp2: number, tp3: number, sl: number
    if (isBuy) {
      // TP1 = nearest resistance pivot (or ATR if too close)
      tp1 = pivotResistance > price + atr * 0.5 ? pivotResistance : price + 1.5 * atr
      tp2 = price + 3 * atr
      tp3 = price + 5 * atr
      // SL = just below nearest support pivot (or ATR if too close)
      sl  = pivotSupport < price - atr * 0.3 ? pivotSupport - atr * 0.2 : price - atr
    } else {
      // TP1 = nearest support pivot (or ATR if too close)
      tp1 = pivotSupport < price - atr * 0.5 ? pivotSupport : price - 1.5 * atr
      tp2 = price - 3 * atr
      tp3 = price - 5 * atr
      // SL = just above nearest resistance pivot (or ATR if too close)
      sl  = pivotResistance > price + atr * 0.3 ? pivotResistance + atr * 0.2 : price + atr
    }

    const slDist = Math.abs(sl - price)
    const risk_reward_tp1 = slDist === 0 ? 0 : Math.abs(tp1 - price) / slDist
    const risk_reward_tp2 = slDist === 0 ? 0 : Math.abs(tp2 - price) / slDist

    const now = new Date()
    const expires = new Date(now.getTime() + 4 * 60 * 60 * 1000)

    return {
      symbol: asset.symbol,
      name: asset.name,
      type: asset.type,
      price,
      change_24h,
      signal,
      strength,
      confluence_score,
      confluence_count: confirmed_by.length,
      total_indicators: 21,
      confirmed_by,
      entry_price: price,
      tp1,
      tp2,
      tp3,
      sl,
      risk_reward_tp1,
      risk_reward_tp2,
      atr,
      rsi: rsi14,
      macd_hist,
      volume_ratio,
      bb_position,
      ai_comment: "",
      timestamp: now.toISOString(),
      expires_at: expires.toISOString(),
      candle_pattern,
      ichimoku_signal,
      above_ma200,
      volume_spike,
      is_market_closed,
      low_volume_warning,
      trend_warning,
    }
  } catch {
    return null
  }
}

// ─── Route handler ─────────────────────────────────────────────────────────────
// Primary path: read from signals_cache populated by the Supabase Edge Function.
// Fallback: compute directly with the 20-asset list if cache is empty/stale.

export async function GET(req: NextRequest) {
  const ip = getClientIP(req as any)
  const rl = rateLimit(`signals:${ip}`, 20, 60_000)
  if (!rl.success) {
    return NextResponse.json({ error: "Trop de requêtes. Réessaie dans une minute." }, {
      status: 429,
      headers: { "Retry-After": "60", "X-RateLimit-Remaining": "0" },
    })
  }

  // ── 1. Try cache (populated every 5 min by compute-signals Edge Function) ──
  try {
    const { data: cached } = await supabase
      .from("signals_cache")
      .select("signals, stats, created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .single()

    if (cached?.signals && Array.isArray(cached.signals) && (cached.signals as any[]).length > 0) {
      // Cache hit — return immediately (≤ 50ms response time)
      const age = Date.now() - new Date(cached.created_at).getTime()
      return NextResponse.json(
        { signals: cached.signals, stats: cached.stats },
        { headers: { "Cache-Control": "public, s-maxage=300", "X-Cache": "HIT", "X-Cache-Age": String(Math.round(age / 1000)) + "s" } }
      )
    }
  } catch {
    // Cache not ready yet — fall through to direct computation
  }

  // ── 2. Fallback: compute directly (20-asset list, within Vercel 10s limit) ──
  process.stdout.write(`[signals] cache miss — fallback direct compute (${ASSETS.length} assets)\n`)
  const results: SignalResult[] = []

  const allResults = await Promise.allSettled(
    ASSETS.map(a => processAsset(a, undefined))
  )
  for (const r of allResults) {
    if (r.status === "fulfilled" && r.value !== null) results.push(r.value as SignalResult)
  }

  process.stdout.write(`[signals] fallback DONE — ${results.length} signals\n`)

  // Stats
  const fort = results.filter((s) => s.strength === "strong").length
  const achats = results.filter((s) => s.signal === "ACHAT" || s.signal === "ACHAT_FORT").length
  const ventes = results.filter((s) => s.signal === "VENTE" || s.signal === "VENTE_FORT").length
  const avg_confluence =
    results.length > 0
      ? results.reduce((a, b) => a + b.confluence_score, 0) / results.length
      : 0

  // Store strong + moderate signals in Supabase (skip if already stored < 4h ago)
  const toStore = results.filter(s => s.strength === "strong" || s.strength === "moderate")
  if (toStore.length > 0) {
    try {
      const cutoff = new Date(Date.now() - 4 * 3600 * 1000).toISOString()
      const { data: recent } = await supabase
        .from("signaux")
        .select("ticker")
        .in("ticker", toStore.map(s => s.symbol))
        .gt("created_at", cutoff)
      const recentTickers = new Set((recent ?? []).map((r: any) => r.ticker))
      const fresh = toStore.filter(s => !recentTickers.has(s.symbol))
      if (fresh.length > 0) {
        await supabase.from("signaux").insert(
          fresh.map(s => ({
            ticker: s.symbol,
            direction: s.signal.startsWith("ACHAT") ? "LONG" : "SHORT",
            prix_entree: parseFloat(s.entry_price.toFixed(4)),
            take_profit_1: parseFloat(s.tp1.toFixed(4)),
            take_profit_2: parseFloat(s.tp2.toFixed(4)),
            take_profit_3: parseFloat(s.tp3.toFixed(4)),
            stop_loss: parseFloat(s.sl.toFixed(4)),
            timeframe: s.type,
            score_confiance: Math.round(s.confluence_score),
            raisonnement: s.ai_comment || "",
            indicateurs: {
              signal: s.signal,
              strength: s.strength,
              name: s.name,
              confluence_score: s.confluence_score,
              confluence_count: s.confluence_count,
              total_indicators: s.total_indicators,
              confirmed_by: s.confirmed_by,
              rsi: s.rsi,
              macd_hist: s.macd_hist,
              volume_ratio: s.volume_ratio,
              bb_position: s.bb_position,
              change_24h: s.change_24h,
              risk_reward_tp1: s.risk_reward_tp1,
              risk_reward_tp2: s.risk_reward_tp2,
              expires_at: s.expires_at,
            },
          }))
        )
      }
    } catch (e) {
      process.stderr.write(`[signals] Supabase store error: ${e}\n`)
    }
  }

  const statsData = {
    total: results.length,
    fort,
    achats,
    ventes,
    avg_confluence: Math.round(avg_confluence),
  }

  const responseData = {
    signals: results,
    stats: statsData,
  }

  // Store fallback result in cache for next request
  void supabase.from("signals_cache").insert({ signals: results, stats: statsData })

  const response = NextResponse.json(responseData)
  response.headers.set("Cache-Control", "public, s-maxage=300, stale-while-revalidate=60")
  return response
}
