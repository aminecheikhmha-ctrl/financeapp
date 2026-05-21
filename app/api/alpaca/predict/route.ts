import { NextRequest, NextResponse } from "next/server"

// ── Inline indicator helpers (identical to chart route) ───────────────────────

function emaSeries(v: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(v.length).fill(null)
  if (v.length < period) return out
  out[period - 1] = v.slice(0, period).reduce((a, b) => a + b, 0) / period
  const k = 2 / (period + 1)
  for (let i = period; i < v.length; i++) out[i] = v[i] * k + out[i - 1]! * (1 - k)
  return out
}

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

function macdVal(closes: number[]) {
  const ema12 = emaSeries(closes, 12)
  const ema26 = emaSeries(closes, 26)
  const n = closes.length - 1
  const line  = (ema12[n] ?? 0) - (ema26[n] ?? 0)
  const macdSlice = closes.map((_, i) =>
    ema12[i] != null && ema26[i] != null ? ema12[i]! - ema26[i]! : null
  )
  const firstMacd = macdSlice.findIndex(v => v != null)
  let sig = 0
  if (firstMacd >= 0) {
    const sigArr = emaSeries(macdSlice.slice(firstMacd) as number[], 9)
    sig = sigArr[sigArr.length - 1] ?? 0
  }
  return { line, signal: sig, hist: line - sig }
}

function stochVal(highs: number[], lows: number[], closes: number[], period = 14) {
  const n = closes.length - 1
  if (n < period) return { k: 50, d: 50 }
  const hh = Math.max(...highs.slice(n - period + 1, n + 1))
  const ll = Math.min(...lows.slice(n - period + 1, n + 1))
  const k = hh === ll ? 50 : ((closes[n] - ll) / (hh - ll)) * 100
  // D = avg of last 3 K values
  const kVals = []
  for (let i = Math.max(period - 1, n - 2); i <= n; i++) {
    const hhi = Math.max(...highs.slice(i - period + 1, i + 1))
    const lli = Math.min(...lows.slice(i - period + 1, i + 1))
    kVals.push(hhi === lli ? 50 : ((closes[i] - lli) / (hhi - lli)) * 100)
  }
  return { k, d: kVals.reduce((a, b) => a + b, 0) / kVals.length }
}

function atrVal(highs: number[], lows: number[], closes: number[], period = 14): number {
  const n = closes.length
  if (n < period + 1) return 0
  const trs = []
  for (let i = 1; i < n; i++) {
    trs.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1])))
  }
  let atr = trs.slice(0, period).reduce((a, b) => a + b, 0) / period
  for (let i = period; i < trs.length; i++) atr = (atr * (period - 1) + trs[i]) / period
  return atr
}

function williamsR(highs: number[], lows: number[], closes: number[], period = 14): number {
  const n = closes.length - 1
  if (n < period) return -50
  const hh = Math.max(...highs.slice(n - period + 1, n + 1))
  const ll = Math.min(...lows.slice(n - period + 1, n + 1))
  return hh === ll ? -50 : ((hh - closes[n]) / (hh - ll)) * -100
}

function obvVal(closes: number[], volumes: number[]): { current: number; trend: string } {
  let obv = 0
  const history: number[] = [0]
  for (let i = 1; i < closes.length; i++) {
    obv += closes[i] > closes[i - 1] ? volumes[i] : closes[i] < closes[i - 1] ? -volumes[i] : 0
    history.push(obv)
  }
  const trend = obv > history[Math.max(0, history.length - 10)] ? "haussier" : "baissier"
  return { current: obv, trend }
}

// ── Yahoo Finance fetch with indicator computation ────────────────────────────

async function fetchRichBars(symbol: string) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=3mo`
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } })
  if (!res.ok) return null
  const json = await res.json()
  const result = json?.chart?.result?.[0]
  if (!result) return null

  const timestamps: number[] = result.timestamp ?? []
  const q = result.indicators?.quote?.[0] ?? {}
  const closes:  number[] = (q.close  ?? []).filter(Boolean)
  const opens:   number[] = q.open    ?? []
  const highs:   number[] = (q.high   ?? []).filter((v: number | null) => v != null)
  const lows:    number[] = (q.low    ?? []).filter((v: number | null) => v != null)
  const volumes: number[] = q.volume  ?? []

  if (closes.length < 20) return null

  const rsi    = rsiVal(closes)
  const macd   = macdVal(closes)
  const stoch  = stochVal(highs, lows, closes)
  const atr    = atrVal(highs, lows, closes)
  const wr     = williamsR(highs, lows, closes)
  const obv    = obvVal(closes, volumes)

  const ema9Arr  = emaSeries(closes, 9)
  const ema21Arr = emaSeries(closes, 21)
  const ema9     = ema9Arr[closes.length - 1] ?? closes[closes.length - 1]
  const ema21    = ema21Arr[closes.length - 1] ?? closes[closes.length - 1]

  const price   = closes[closes.length - 1]
  const high52  = Math.max(...(q.high ?? []).filter(Boolean))
  const low52   = Math.min(...(q.low ?? []).filter(Boolean))
  const ma20    = closes.slice(-20).reduce((a, b) => a + b, 0) / 20
  const ma50    = closes.length >= 50 ? closes.slice(-50).reduce((a, b) => a + b, 0) / 50 : null

  // BB
  const variance = closes.slice(-20).reduce((a, c) => a + (c - ma20) ** 2, 0) / 20
  const std = Math.sqrt(variance)
  const bbUpper = ma20 + 2 * std, bbLower = ma20 - 2 * std

  // Detect divergences
  const recentCloses = closes.slice(-5)
  const priceTrend   = recentCloses[recentCloses.length - 1] > recentCloses[0] ? "monte" : "baisse"
  const rsiFull = closes.map((_, idx) => {
    if (idx < 14) return 50
    let g = 0, l = 0
    for (let j = idx - 13; j <= idx; j++) { const d = closes[j] - closes[j - 1]; d > 0 ? g += d : l -= d }
    return l === 0 ? 100 : 100 - 100 / (1 + g / 14 / (l / 14))
  })
  const rsiRecent  = rsiFull.slice(-5)
  const rsiTrend   = rsiRecent[rsiRecent.length - 1] > rsiRecent[0] ? "monte" : "baisse"
  const divergence = priceTrend !== rsiTrend
    ? priceTrend === "monte" ? "Divergence baissière (prix monte, RSI baisse)" : "Divergence haussière (prix baisse, RSI monte)"
    : "Aucune divergence détectée"

  // Last 20 bars formatted for prompt
  const last20 = timestamps.slice(-20).map((t, i) => {
    const idx = closes.length - 20 + i
    return {
      date:   new Date(t * 1000).toISOString().slice(0, 10),
      open:   (opens[idx]  ?? 0).toFixed(2),
      high:   (highs[idx]  ?? 0).toFixed(2),
      low:    (lows[idx]   ?? 0).toFixed(2),
      close:  (closes[idx] ?? 0).toFixed(2),
      volume: volumes[idx] ?? 0,
    }
  })

  return {
    price, high52, low52, atr, rsi, macd, stoch, wr,
    ema9, ema21, ma20, ma50, bbUpper, bbLower, obv,
    divergence, last20,
    priceVsEma9:  ((price - ema9)  / ema9  * 100).toFixed(2),
    priceVsEma21: ((price - ema21) / ema21 * 100).toFixed(2),
    bbPosition:   ((price - bbLower) / (bbUpper - bbLower) * 100).toFixed(1),
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { symbol } = body

  if (!symbol) return NextResponse.json({ error: "Symbol requis" }, { status: 400 })

  try {
    const data = await fetchRichBars(symbol)

    const ctx = data
      ? `
═══ INDICATEURS TECHNIQUES ACTUELS ═══
Prix actuel : $${data.price.toFixed(2)}
ATR(14)     : ${data.atr.toFixed(3)}  (volatilité = ${(data.atr / data.price * 100).toFixed(2)}%)
Plus haut 52s / Plus bas : $${data.high52.toFixed(2)} / $${data.low52.toFixed(2)}

── Court terme (momentum) ──
RSI(14)        : ${data.rsi.toFixed(1)}  ${data.rsi > 70 ? "⚠️ SURACHETÉ" : data.rsi < 30 ? "⚠️ SURVENDU" : "zone neutre"}
Stoch %K / %D  : ${data.stoch.k.toFixed(1)} / ${data.stoch.d.toFixed(1)}  ${data.stoch.k > 80 ? "suracheté" : data.stoch.k < 20 ? "survendu" : ""}
Williams %R    : ${data.wr.toFixed(1)}  ${data.wr > -20 ? "suracheté" : data.wr < -80 ? "survendu" : ""}

── Moyen terme (tendance) ──
MACD ligne     : ${data.macd.line.toFixed(4)}
MACD signal    : ${data.macd.signal.toFixed(4)}
MACD histogramme: ${data.macd.hist.toFixed(4)}  ${data.macd.hist > 0 ? "haussier" : "baissier"}
EMA9           : $${data.ema9.toFixed(2)}  (prix ${data.priceVsEma9}% ${Number(data.priceVsEma9) >= 0 ? "au-dessus" : "en-dessous"})
EMA21          : $${data.ema21.toFixed(2)}  (prix ${data.priceVsEma21}% ${Number(data.priceVsEma21) >= 0 ? "au-dessus" : "en-dessous"})

── Long terme ──
MA20 : $${data.ma20.toFixed(2)} | MA50 : $${data.ma50 != null ? data.ma50.toFixed(2) : "N/A"}
Bollinger Bands : Upper $${data.bbUpper.toFixed(2)} | Lower $${data.bbLower.toFixed(2)}
Position BB     : ${data.bbPosition}%  (0%=lower, 100%=upper)
OBV tendance    : ${data.obv.trend}

── Divergences ──
${data.divergence}

── 20 dernières bougies (daily) ──
${data.last20.map(b => `${b.date}: O${b.open} H${b.high} L${b.low} C${b.close} V${b.volume}`).join("\n")}
`
      : `Symbole: ${symbol} — données techniques indisponibles, utilise tes connaissances générales.`

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        max_tokens: 1200,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              "Tu es un quant trader expert. Analyse multi-timeframe rigoureuse. " +
              "Confluence des signaux obligatoire — un signal est fort seulement si 3+ indicateurs confirment. " +
              "Retourne UNIQUEMENT du JSON valide, sans markdown, sans texte autour.",
          },
          {
            role: "user",
            content: `Analyse ${symbol} et retourne ce JSON exact (aucun texte autour) :

${ctx}

{
  "trend": "bullish | bearish | neutral",
  "confidence": 0-100,
  "signal_strength": "weak | moderate | strong",
  "confluence_count": 0-7,
  "target_7d": prix_dollar,
  "target_30d": prix_dollar,
  "stop_loss": prix_dollar,
  "atr_value": valeur_atr,
  "risk_reward_ratio": ratio_décimal,
  "key_levels": [niveau1, niveau2, niveau3],
  "summary": "analyse technique en 2-3 phrases précises avec valeurs des indicateurs",
  "recommendation": "ACHETER | VENDRE | ATTENDRE",
  "risk": "faible | modéré | élevé",
  "divergence_detected": true|false,
  "short_term_bias": "bullish | bearish | neutral",
  "medium_term_bias": "bullish | bearish | neutral"
}

Règles :
- target_7d = prix + (2 × ATR) si bullish, prix − (2 × ATR) si bearish
- stop_loss  = prix − (1 × ATR) si bullish, prix + (1 × ATR) si bearish
- risk_reward_ratio = |target_7d − prix| / |stop_loss − prix|
- signal_strength "strong" = 4+ indicateurs alignés, "moderate" = 2-3, "weak" = 1
- confidence pondéré : RSI(20%) + MACD(20%) + Stoch(15%) + EMA(20%) + BB(15%) + OBV(10%)`,
          },
        ],
      }),
    })

    const data2 = await res.json()
    const text  = data2.choices?.[0]?.message?.content ?? "{}"
    const clean = text.replace(/```json|```/g, "").trim()
    const prediction = JSON.parse(clean)
    return NextResponse.json(prediction)
  } catch (e) {
    // error silenced
    return NextResponse.json({ error: "Prediction failed" }, { status: 500 })
  }
}
