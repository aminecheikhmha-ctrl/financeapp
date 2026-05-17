export type Indicateurs = {
  rsi: number
  macd: { value: number; signal: number; histogram: number }
  bb: { upper: number; middle: number; lower: number; position: number }
  ma7: number
  ma21: number
  ma50: number
  ma200: number
  ema9: number
  ema21: number
  ema_cross: "bullish" | "bearish" | "none"
  stoch_k: number
  williams_r: number
  obv_trend: "rising" | "falling" | "flat"
  volume_ratio: number
  trend: "bullish" | "bearish" | "neutral"
  signals: string[]
  score: number
  confluence_count: number
  confluence_total: number
  confirmed_by: string[]
}

function calcRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50
  let gains = 0, losses = 0
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1]
    if (diff > 0) gains += diff
    else losses += Math.abs(diff)
  }
  const avgGain = gains / period
  const avgLoss = losses / period
  if (avgLoss === 0) return 100
  return 100 - (100 / (1 + avgGain / avgLoss))
}

function calcEMA(closes: number[], period: number): number {
  if (closes.length < period) return closes[closes.length - 1]
  const k = 2 / (period + 1)
  let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period
  for (let i = period; i < closes.length; i++) ema = closes[i] * k + ema * (1 - k)
  return ema
}

function calcSMA(closes: number[], period: number): number {
  const slice = closes.slice(-period)
  return slice.reduce((a, b) => a + b, 0) / slice.length
}

function calcMACD(closes: number[]) {
  const ema12 = calcEMA(closes, 12)
  const ema26 = calcEMA(closes, 26)
  const value = ema12 - ema26
  const signal = calcEMA([...closes.slice(0, -1).map((_, i) => {
    const e12 = calcEMA(closes.slice(0, i + 1), 12)
    const e26 = calcEMA(closes.slice(0, i + 1), 26)
    return e12 - e26
  }), value], 9)
  return { value, signal, histogram: value - signal }
}

function calcBB(closes: number[], period = 20) {
  const slice = closes.slice(-period)
  const middle = slice.reduce((a, b) => a + b, 0) / period
  const variance = slice.reduce((a, b) => a + Math.pow(b - middle, 2), 0) / period
  const std = Math.sqrt(variance)
  const upper = middle + 2 * std
  const lower = middle - 2 * std
  const current = closes[closes.length - 1]
  const position = ((current - lower) / (upper - lower)) * 100
  return { upper, middle, lower, position }
}

function calcStochK(closes: number[], highs: number[], lows: number[], period = 14): number {
  if (closes.length < period || highs.length < period || lows.length < period) return 50
  const sliceH = highs.slice(-period)
  const sliceL = lows.slice(-period)
  const highestHigh = Math.max(...sliceH)
  const lowestLow   = Math.min(...sliceL)
  const close = closes[closes.length - 1]
  if (highestHigh === lowestLow) return 50
  return ((close - lowestLow) / (highestHigh - lowestLow)) * 100
}

function calcWilliamsR(closes: number[], highs: number[], lows: number[], period = 14): number {
  if (closes.length < period || highs.length < period || lows.length < period) return -50
  const sliceH = highs.slice(-period)
  const sliceL = lows.slice(-period)
  const highestHigh = Math.max(...sliceH)
  const lowestLow   = Math.min(...sliceL)
  const close = closes[closes.length - 1]
  if (highestHigh === lowestLow) return -50
  return ((highestHigh - close) / (highestHigh - lowestLow)) * -100
}

function calcOBVTrend(closes: number[], volumes: number[]): "rising" | "falling" | "flat" {
  if (closes.length < 21) return "flat"
  let obv = 0
  const obvHistory: number[] = []
  for (let i = 1; i < closes.length; i++) {
    if (closes[i] > closes[i - 1]) obv += volumes[i]
    else if (closes[i] < closes[i - 1]) obv -= volumes[i]
    obvHistory.push(obv)
  }
  const recentOBV = obvHistory.slice(-5).reduce((a, b) => a + b, 0) / 5
  const pastOBV   = obvHistory.slice(-20, -10).reduce((a, b) => a + b, 0) / 10
  if (recentOBV > pastOBV * 1.02) return "rising"
  if (recentOBV < pastOBV * 0.98) return "falling"
  return "flat"
}

export function analyserIndicateurs(
  closes: number[],
  volumes: number[],
  prix: number,
  highs?: number[],
  lows?: number[]
): Indicateurs {
  const h = highs ?? closes
  const l = lows  ?? closes

  const rsi   = calcRSI(closes)
  const macd  = calcMACD(closes)
  const bb    = calcBB(closes)
  const ma7   = calcSMA(closes, 7)
  const ma21  = calcSMA(closes, 21)
  const ma50  = calcSMA(closes, 50)
  const ma200 = calcSMA(closes, 200)
  const ema9  = calcEMA(closes, 9)
  const ema21v = calcEMA(closes, 21)

  // EMA cross: compare last two values
  const ema9Prev  = closes.length > 2 ? calcEMA(closes.slice(0, -1), 9)  : ema9
  const ema21Prev = closes.length > 2 ? calcEMA(closes.slice(0, -1), 21) : ema21v
  const ema_cross: "bullish" | "bearish" | "none" =
    ema9 > ema21v && ema9Prev <= ema21Prev ? "bullish" :
    ema9 < ema21v && ema9Prev >= ema21Prev ? "bearish" : "none"

  const stoch_k   = calcStochK(closes, h, l)
  const williams_r = calcWilliamsR(closes, h, l)
  const obv_trend  = calcOBVTrend(closes, volumes)

  const avgVolume  = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20
  const lastVolume = volumes[volumes.length - 1]
  const volume_ratio = avgVolume > 0 ? lastVolume / avgVolume : 1

  // 17 confluence checks
  const checks: { name: string; bullish: boolean; bearish: boolean }[] = [
    { name: "RSI·14",      bullish: rsi < 50,             bearish: rsi > 50             },
    { name: "RSI·Survendu",bullish: rsi < 30,             bearish: rsi > 70             },
    { name: "Stoch·K",     bullish: stoch_k < 50,         bearish: stoch_k > 50         },
    { name: "Stoch·Ext",   bullish: stoch_k < 20,         bearish: stoch_k > 80         },
    { name: "Williams·%R", bullish: williams_r < -50,     bearish: williams_r > -50     },
    { name: "Williams·Ext",bullish: williams_r < -80,     bearish: williams_r > -20     },
    { name: "MACD·Hist",   bullish: macd.histogram > 0,   bearish: macd.histogram < 0   },
    { name: "MACD·Zero",   bullish: macd.value > 0,       bearish: macd.value < 0       },
    { name: "BB·Zone",     bullish: bb.position < 50,     bearish: bb.position > 50     },
    { name: "BB·Lower",    bullish: bb.position < 15,     bearish: bb.position > 85     },
    { name: "MA7·21",      bullish: ma7 > ma21,           bearish: ma7 < ma21           },
    { name: "MA21·50",     bullish: ma21 > ma50,          bearish: ma21 < ma50          },
    { name: "Prix·MA50",   bullish: prix > ma50,          bearish: prix < ma50          },
    { name: "Prix·MA200",  bullish: prix > ma200,         bearish: prix < ma200         },
    { name: "EMA·Cross",   bullish: ema9 > ema21v,        bearish: ema9 < ema21v        },
    { name: "OBV",         bullish: obv_trend === "rising",bearish: obv_trend === "falling" },
    { name: "Volume·élevé",bullish: volume_ratio > 1.2,   bearish: volume_ratio < 0.8  },
  ]

  const signals: string[] = []
  let bullishCount = 0
  let bearishCount = 0

  if (rsi < 30)  { signals.push("RSI survendu (<30) → signal haussier"); bullishCount++ }
  else if (rsi > 70) { signals.push("RSI suracheté (>70) → signal baissier"); bearishCount++ }
  else if (rsi < 45) { signals.push("RSI zone basse → légèrement haussier"); bullishCount += 0.5 }
  else if (rsi > 55) { signals.push("RSI zone haute → légèrement baissier"); bearishCount += 0.5 }

  if (macd.histogram > 0 && macd.value > macd.signal) {
    signals.push("MACD bullish crossover → momentum haussier"); bullishCount++
  } else if (macd.histogram < 0 && macd.value < macd.signal) {
    signals.push("MACD bearish crossover → momentum baissier"); bearishCount++
  }

  if (bb.position < 10)  { signals.push("Prix sous la bande basse de Bollinger → rebond probable"); bullishCount++ }
  else if (bb.position > 90) { signals.push("Prix sur la bande haute de Bollinger → correction possible"); bearishCount++ }

  if (ma7 > ma21 && ma21 > ma50) { signals.push("Golden alignment MM7>MM21>MM50 → tendance haussière forte"); bullishCount++ }
  else if (ma7 < ma21 && ma21 < ma50) { signals.push("Death alignment MM7<MM21<MM50 → tendance baissière forte"); bearishCount++ }

  if (prix > ma200) { signals.push("Prix au-dessus MA200 → tendance long terme haussière"); bullishCount += 0.5 }
  else { signals.push("Prix sous MA200 → tendance long terme baissière"); bearishCount += 0.5 }

  if (stoch_k < 20) { signals.push(`Stochastique survendu (${stoch_k.toFixed(0)}) → rebond probable`); bullishCount++ }
  else if (stoch_k > 80) { signals.push(`Stochastique suracheté (${stoch_k.toFixed(0)}) → correction probable`); bearishCount++ }

  if (williams_r < -80) { signals.push(`Williams %R survendu (${williams_r.toFixed(0)}) → signal haussier`); bullishCount++ }
  else if (williams_r > -20) { signals.push(`Williams %R suracheté (${williams_r.toFixed(0)}) → signal baissier`); bearishCount++ }

  if (ema_cross === "bullish") { signals.push("EMA9 croise EMA21 à la hausse → momentum haussier"); bullishCount++ }
  else if (ema_cross === "bearish") { signals.push("EMA9 croise EMA21 à la baisse → momentum baissier"); bearishCount++ }

  if (obv_trend === "rising") { signals.push("OBV en hausse → accumulation institutionnelle"); bullishCount += 0.5 }
  else if (obv_trend === "falling") { signals.push("OBV en baisse → distribution institutionnelle"); bearishCount += 0.5 }

  if (volume_ratio > 1.5) { signals.push(`Volume élevé (${volume_ratio.toFixed(1)}x la moyenne) → confirmation du mouvement`) }

  const trend: "bullish" | "bearish" | "neutral" =
    bullishCount > bearishCount ? "bullish" :
    bearishCount > bullishCount ? "bearish" : "neutral"

  const total = bullishCount + bearishCount
  const dominant = Math.max(bullishCount, bearishCount)
  const baseScore = total > 0 ? (dominant / total) * 100 : 50
  const volumeBonus = volume_ratio > 1.5 ? 10 : 0
  const score = Math.min(Math.round(baseScore + volumeBonus), 99)

  const isBullish = trend === "bullish"
  const confluence_total = checks.length
  const matchingChecks = checks.filter(c => isBullish ? c.bullish : c.bearish)
  const confluence_count = matchingChecks.length
  const confirmed_by = matchingChecks.map(c => c.name)

  return {
    rsi, macd, bb,
    ma7, ma21, ma50, ma200,
    ema9, ema21: ema21v, ema_cross,
    stoch_k, williams_r, obv_trend,
    volume_ratio, trend, signals, score,
    confluence_count, confluence_total, confirmed_by,
  }
}
