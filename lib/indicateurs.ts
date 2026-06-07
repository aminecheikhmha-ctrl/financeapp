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

// ─── RSI — Méthode Wilder (identique TradingView) ────────────────────────────
function calcRSI(closes: number[], period = 14): number {
  if (closes.length < period * 2) return 50

  let avgGain = 0
  let avgLoss = 0
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1]
    if (diff > 0) avgGain += diff
    else avgLoss += Math.abs(diff)
  }
  avgGain /= period
  avgLoss /= period

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1]
    const gain = diff > 0 ? diff : 0
    const loss = diff < 0 ? Math.abs(diff) : 0
    avgGain = (avgGain * (period - 1) + gain) / period
    avgLoss = (avgLoss * (period - 1) + loss) / period
  }

  if (avgLoss === 0) return 100
  const rs = avgGain / avgLoss
  return parseFloat((100 - 100 / (1 + rs)).toFixed(2))
}

// Série RSI complète — pour la détection de divergences
export function calcRSISeries(closes: number[], period = 14): number[] {
  const result: number[] = new Array(closes.length).fill(50)
  if (closes.length < period * 2) return result

  let avgGain = 0, avgLoss = 0
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1]
    if (diff > 0) avgGain += diff
    else avgLoss += Math.abs(diff)
  }
  avgGain /= period
  avgLoss /= period
  result[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss)

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1]
    avgGain = (avgGain * (period - 1) + (diff > 0 ? diff : 0)) / period
    avgLoss = (avgLoss * (period - 1) + (diff < 0 ? Math.abs(diff) : 0)) / period
    result[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss)
  }
  return result
}

// ─── EMA simple (pour BB, SMA, etc.) ─────────────────────────────────────────
function calcEMA(closes: number[], period: number): number {
  if (closes.length < period) return closes[closes.length - 1]
  const k = 2 / (period + 1)
  let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period
  for (let i = period; i < closes.length; i++) ema = closes[i] * k + ema * (1 - k)
  return ema
}

// ─── EMA série complète — pour MACD correct ──────────────────────────────────
function calcEMASeries(values: number[], period: number): (number | null)[] {
  const result: (number | null)[] = new Array(values.length).fill(null)
  if (values.length < period) return result
  result[period - 1] = values.slice(0, period).reduce((a, b) => a + b, 0) / period
  const k = 2 / (period + 1)
  for (let i = period; i < values.length; i++) {
    result[i] = values[i] * k + result[i - 1]! * (1 - k)
  }
  return result
}

// ─── MACD — calcul correct sur séries complètes ───────────────────────────────
function calcMACD(closes: number[]): { value: number; signal: number; histogram: number } {
  if (closes.length < 35) return { value: 0, signal: 0, histogram: 0 }

  const ema12Series = calcEMASeries(closes, 12)
  const ema26Series = calcEMASeries(closes, 26)

  const macdLine = closes
    .map((_, i) =>
      ema12Series[i] != null && ema26Series[i] != null
        ? ema12Series[i]! - ema26Series[i]!
        : null
    )
    .filter((v): v is number => v !== null)

  if (macdLine.length < 9) return { value: 0, signal: 0, histogram: 0 }

  const signalSeries = calcEMASeries(macdLine, 9)

  const lastValue  = macdLine[macdLine.length - 1]
  const lastSignal = signalSeries[signalSeries.length - 1] ?? 0

  return {
    value:     parseFloat(lastValue.toFixed(6)),
    signal:    parseFloat(lastSignal.toFixed(6)),
    histogram: parseFloat((lastValue - lastSignal).toFixed(6)),
  }
}

function calcSMA(closes: number[], period: number): number {
  const slice = closes.slice(-period)
  return slice.reduce((a, b) => a + b, 0) / slice.length
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

// ─── Analyse principale ───────────────────────────────────────────────────────

export function analyserIndicateurs(
  closes: number[],
  volumes: number[],
  prix: number,
  highs?: number[],
  lows?: number[]
): Indicateurs {
  const h = highs ?? closes
  const l = lows  ?? closes

  const rsi    = calcRSI(closes)
  const macd   = calcMACD(closes)
  const bb     = calcBB(closes)
  const ma7    = calcSMA(closes, 7)
  const ma21   = calcSMA(closes, 21)
  const ma50   = calcSMA(closes, 50)
  const ma200  = calcSMA(closes, 200)
  const ema9   = calcEMA(closes, 9)
  const ema21v = calcEMA(closes, 21)

  const ema9Prev  = closes.length > 2 ? calcEMA(closes.slice(0, -1), 9)  : ema9
  const ema21Prev = closes.length > 2 ? calcEMA(closes.slice(0, -1), 21) : ema21v
  const ema_cross: "bullish" | "bearish" | "none" =
    ema9 > ema21v && ema9Prev <= ema21Prev ? "bullish" :
    ema9 < ema21v && ema9Prev >= ema21Prev ? "bearish" : "none"

  const stoch_k    = calcStochK(closes, h, l)
  const williams_r = calcWilliamsR(closes, h, l)
  const obv_trend  = calcOBVTrend(closes, volumes)

  const avgVolume    = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20
  const lastVolume   = volumes[volumes.length - 1]
  const volume_ratio = avgVolume > 0 ? lastVolume / avgVolume : 1

  // ── SYSTÈME DE SCORE PONDÉRÉ PAR FAMILLES ──────────────────────────────────

  type FamilleResult = {
    name: string
    weight: number
    bullish_score: number
    bearish_score: number
    signals: string[]
  }

  const familles: FamilleResult[] = []

  // FAMILLE 1 : MOMENTUM — RSI (poids 20%)
  {
    let bull = 0, bear = 0
    const sigs: string[] = []
    if      (rsi < 20) { bull = 1.0; sigs.push(`RSI extrêmement survendu (${rsi.toFixed(1)}) → rebond fort attendu`) }
    else if (rsi < 30) { bull = 0.8; sigs.push(`RSI survendu (${rsi.toFixed(1)}) → signal haussier`) }
    else if (rsi < 40) { bull = 0.4; sigs.push(`RSI zone basse (${rsi.toFixed(1)}) → légèrement haussier`) }
    else if (rsi > 80) { bear = 1.0; sigs.push(`RSI extrêmement suracheté (${rsi.toFixed(1)}) → correction imminente`) }
    else if (rsi > 70) { bear = 0.8; sigs.push(`RSI suracheté (${rsi.toFixed(1)}) → signal baissier`) }
    else if (rsi > 60) { bear = 0.4; sigs.push(`RSI zone haute (${rsi.toFixed(1)}) → légèrement baissier`) }
    familles.push({ name: "RSI", weight: 0.20, bullish_score: bull, bearish_score: bear, signals: sigs })
  }

  // FAMILLE 2 : OSCILLATEURS — Stoch + Williams (poids 15%)
  {
    const stochBull = stoch_k < 20 ? 1.0 : stoch_k < 30 ? 0.6 : stoch_k < 40 ? 0.3 : 0
    const stochBear = stoch_k > 80 ? 1.0 : stoch_k > 70 ? 0.6 : stoch_k > 60 ? 0.3 : 0
    const willBull  = williams_r < -80 ? 1.0 : williams_r < -70 ? 0.6 : williams_r < -60 ? 0.3 : 0
    const willBear  = williams_r > -20 ? 1.0 : williams_r > -30 ? 0.6 : williams_r > -40 ? 0.3 : 0
    const bull = (stochBull + willBull) / 2
    const bear = (stochBear + willBear) / 2
    const sigs: string[] = []
    if (bull > 0.5) sigs.push(`Oscillateurs survendus (Stoch ${stoch_k.toFixed(0)}, W%R ${williams_r.toFixed(0)}) → rebond probable`)
    if (bear > 0.5) sigs.push(`Oscillateurs surachetés (Stoch ${stoch_k.toFixed(0)}, W%R ${williams_r.toFixed(0)}) → correction probable`)
    familles.push({ name: "Oscillateurs", weight: 0.15, bullish_score: bull, bearish_score: bear, signals: sigs })
  }

  // FAMILLE 3 : MACD (poids 20%)
  {
    let bull = 0, bear = 0
    const sigs: string[] = []
    if      (macd.histogram > 0 && macd.value > macd.signal && macd.value > 0) {
      bull = 1.0; sigs.push("MACD haussier au-dessus de zéro → momentum fort")
    } else if (macd.histogram > 0 && macd.value > macd.signal) {
      bull = 0.6; sigs.push("MACD crossover haussier → momentum en construction")
    } else if (macd.histogram < 0 && macd.value < macd.signal && macd.value < 0) {
      bear = 1.0; sigs.push("MACD baissier sous zéro → momentum baissier fort")
    } else if (macd.histogram < 0 && macd.value < macd.signal) {
      bear = 0.6; sigs.push("MACD crossover baissier → momentum en affaiblissement")
    }
    familles.push({ name: "MACD", weight: 0.20, bullish_score: bull, bearish_score: bear, signals: sigs })
  }

  // FAMILLE 4 : BOLLINGER BANDS (poids 10%)
  {
    let bull = 0, bear = 0
    const sigs: string[] = []
    if      (bb.position < 5)  { bull = 1.0; sigs.push(`Prix sous la bande basse BB (${bb.position.toFixed(0)}%) → rebond fort probable`) }
    else if (bb.position < 20) { bull = 0.6; sigs.push(`Prix proche bande basse BB (${bb.position.toFixed(0)}%) → zone de support`) }
    else if (bb.position > 95) { bear = 1.0; sigs.push(`Prix au-dessus bande haute BB (${bb.position.toFixed(0)}%) → extension extrême`) }
    else if (bb.position > 80) { bear = 0.6; sigs.push(`Prix proche bande haute BB (${bb.position.toFixed(0)}%) → zone de résistance`) }
    familles.push({ name: "Bollinger", weight: 0.10, bullish_score: bull, bearish_score: bear, signals: sigs })
  }

  // FAMILLE 5 : TENDANCE — Moyennes mobiles (poids 25%)
  {
    let bull = 0, bear = 0
    const sigs: string[] = []

    if      (ma7 > ma21 && ma21 > ma50 && ma50 > ma200) { bull = 1.0; sigs.push("Alignement parfait MM7>21>50>200 → tendance haussière majeure") }
    else if (ma7 > ma21 && ma21 > ma50)                  { bull = 0.7; sigs.push("Golden alignment MM7>21>50 → tendance haussière") }
    else if (ma7 < ma21 && ma21 < ma50 && ma50 < ma200)  { bear = 1.0; sigs.push("Alignement parfait MM7<21<50<200 → tendance baissière majeure") }
    else if (ma7 < ma21 && ma21 < ma50)                  { bear = 0.7; sigs.push("Death alignment MM7<21<50 → tendance baissière") }

    if      (prix > ma200 * 1.05) bull = Math.min(1, bull + 0.2)
    else if (prix < ma200 * 0.95) bear = Math.min(1, bear + 0.2)

    if      (ema_cross === "bullish") { bull = Math.min(1, bull + 0.2); sigs.push("EMA9 croise EMA21 à la hausse → signal d'entrée") }
    else if (ema_cross === "bearish") { bear = Math.min(1, bear + 0.2); sigs.push("EMA9 croise EMA21 à la baisse → signal de sortie") }

    familles.push({ name: "Tendance", weight: 0.25, bullish_score: Math.min(1, bull), bearish_score: Math.min(1, bear), signals: sigs })
  }

  // FAMILLE 6 : VOLUME / OBV (poids 10%)
  {
    let bull = 0, bear = 0
    const sigs: string[] = []
    if      (obv_trend === "rising"  && volume_ratio > 1.5) { bull = 1.0; sigs.push(`Accumulation forte — OBV ↑ + volume ${volume_ratio.toFixed(1)}x`) }
    else if (obv_trend === "rising")                         { bull = 0.5; sigs.push("OBV en hausse → accumulation progressive") }
    else if (obv_trend === "falling" && volume_ratio > 1.5)  { bear = 1.0; sigs.push(`Distribution forte — OBV ↓ + volume ${volume_ratio.toFixed(1)}x`) }
    else if (obv_trend === "falling")                        { bear = 0.5; sigs.push("OBV en baisse → distribution progressive") }
    if (volume_ratio > 2.0) sigs.push(`Volume exceptionnel (${volume_ratio.toFixed(1)}x) → mouvement institutionnel probable`)
    familles.push({ name: "Volume", weight: 0.10, bullish_score: bull, bearish_score: bear, signals: sigs })
  }

  // ── CALCUL PONDÉRÉ FINAL ──────────────────────────────────────────────────

  let weightedBull = 0
  let weightedBear = 0
  const allSignals: string[] = []

  for (const f of familles) {
    weightedBull += f.bullish_score * f.weight
    weightedBear += f.bearish_score * f.weight
    allSignals.push(...f.signals)
  }

  const totalWeight  = weightedBull + weightedBear
  const dominantW    = Math.max(weightedBull, weightedBear)
  const rawScore     = totalWeight > 0 ? (dominantW / totalWeight) * 100 : 50
  const volumeBonus  = volume_ratio > 2.0 ? 5 : volume_ratio > 1.5 ? 2 : 0
  const score        = Math.min(Math.round(rawScore + volumeBonus), 98)

  const trend: "bullish" | "bearish" | "neutral" =
    weightedBull > weightedBear + 0.05 ? "bullish" :
    weightedBear > weightedBull + 0.05 ? "bearish" :
    "neutral"

  const isBullish = trend === "bullish" || (trend === "neutral" && weightedBull >= weightedBear)
  const confirmingFamilies = familles.filter(f =>
    isBullish ? f.bullish_score > 0.3 : f.bearish_score > 0.3
  )
  const confluence_count = confirmingFamilies.length
  const confluence_total = familles.length
  const confirmed_by     = confirmingFamilies.map(f =>
    `${f.name} (${Math.round((isBullish ? f.bullish_score : f.bearish_score) * 100)}%)`
  )

  return {
    rsi, macd, bb,
    ma7, ma21, ma50, ma200,
    ema9, ema21: ema21v, ema_cross,
    stoch_k, williams_r, obv_trend,
    volume_ratio, trend, signals: allSignals, score,
    confluence_count, confluence_total, confirmed_by,
  }
}
