export type Indicateurs = {
  rsi: number
  macd: { value: number; signal: number; histogram: number }
  bb: { upper: number; middle: number; lower: number; position: number }
  ma7: number
  ma21: number
  ma50: number
  ma200: number
  volume_ratio: number
  trend: "bullish" | "bearish" | "neutral"
  signals: string[]
  score: number
}

// RSI
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
  const rs = avgGain / avgLoss
  return 100 - (100 / (1 + rs))
}

// EMA
function calcEMA(closes: number[], period: number): number {
  if (closes.length < period) return closes[closes.length - 1]
  const k = 2 / (period + 1)
  let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period
  for (let i = period; i < closes.length; i++) {
    ema = closes[i] * k + ema * (1 - k)
  }
  return ema
}

// SMA
function calcSMA(closes: number[], period: number): number {
  const slice = closes.slice(-period)
  return slice.reduce((a, b) => a + b, 0) / slice.length
}

// MACD
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

// Bandes de Bollinger
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

// Analyse complète
export function analyserIndicateurs(
  closes: number[],
  volumes: number[],
  prix: number
): Indicateurs {
  const rsi = calcRSI(closes)
  const macd = calcMACD(closes)
  const bb = calcBB(closes)
  const ma7 = calcSMA(closes, 7)
  const ma21 = calcSMA(closes, 21)
  const ma50 = calcSMA(closes, 50)
  const ma200 = calcSMA(closes, 200)

  const avgVolume = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20
  const lastVolume = volumes[volumes.length - 1]
  const volume_ratio = avgVolume > 0 ? lastVolume / avgVolume : 1

  const signals: string[] = []
  let bullishCount = 0
  let bearishCount = 0

  // RSI
  if (rsi < 30) { signals.push("RSI survendu (<30) → signal haussier"); bullishCount++ }
  else if (rsi > 70) { signals.push("RSI suracheté (>70) → signal baissier"); bearishCount++ }
  else if (rsi < 45) { signals.push("RSI zone basse → légèrement haussier"); bullishCount += 0.5 }
  else if (rsi > 55) { signals.push("RSI zone haute → légèrement baissier"); bearishCount += 0.5 }

  // MACD
  if (macd.histogram > 0 && macd.value > macd.signal) {
    signals.push("MACD bullish crossover → momentum haussier"); bullishCount++
  } else if (macd.histogram < 0 && macd.value < macd.signal) {
    signals.push("MACD bearish crossover → momentum baissier"); bearishCount++
  }

  // Bollinger
  if (bb.position < 10) { signals.push("Prix sous la bande basse de Bollinger → rebond probable"); bullishCount++ }
  else if (bb.position > 90) { signals.push("Prix sur la bande haute de Bollinger → correction possible"); bearishCount++ }

  // Moyennes mobiles
  if (ma7 > ma21 && ma21 > ma50) { signals.push("Golden alignment MM7>MM21>MM50 → tendance haussière forte"); bullishCount++ }
  else if (ma7 < ma21 && ma21 < ma50) { signals.push("Death alignment MM7<MM21<MM50 → tendance baissière forte"); bearishCount++ }

  if (prix > ma200) { signals.push("Prix au-dessus MA200 → tendance long terme haussière"); bullishCount += 0.5 }
  else { signals.push("Prix sous MA200 → tendance long terme baissière"); bearishCount += 0.5 }

  // Volume
  if (volume_ratio > 1.5) { signals.push(`Volume élevé (${volume_ratio.toFixed(1)}x la moyenne) → confirmation du mouvement`) }

  // Trend
  const trend: "bullish" | "bearish" | "neutral" =
    bullishCount > bearishCount + 1 ? "bullish" :
    bearishCount > bullishCount + 1 ? "bearish" : "neutral"

  // Score de confiance
  const total = bullishCount + bearishCount
  const dominant = Math.max(bullishCount, bearishCount)
  const baseScore = total > 0 ? (dominant / total) * 100 : 50
  const volumeBonus = volume_ratio > 1.5 ? 10 : 0
  const score = Math.min(Math.round(baseScore + volumeBonus), 99)

  return { rsi, macd, bb, ma7, ma21, ma50, ma200, volume_ratio, trend, signals, score }
}