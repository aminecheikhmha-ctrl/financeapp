export const dynamic    = "force-dynamic"
export const maxDuration = 60

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import Groq from "groq-sdk"
import { analyserIndicateurs, calcRSISeries } from "@/lib/indicateurs"
import { getOHLCV, getOHLCVYahooFallback, getUniversalQuote, getEarningsDate } from "@/lib/marketData"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_KEY    || "placeholder"
)

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

const WATCHLIST = [
  "AAPL", "TSLA", "NVDA", "MSFT", "AMZN",
  "META", "GOOGL", "BTC-USD", "ETH-USD", "SPY",
]

// ─── Seuils stricts ───────────────────────────────────────────────────────────
const MIN_SCORE    = 62   // score pondéré minimum
const MIN_FAMILLES = 3    // au moins 3 familles sur 6 doivent confirmer
const MIN_CLOSES   = 100  // besoin de données suffisantes

// ─── Fetch données marché (Polygon → Yahoo fallback) ─────────────────────────
async function fetchDonnees(ticker: string) {
  const to   = new Date().toISOString().slice(0, 10)
  const from = new Date(Date.now() - 730 * 86400_000).toISOString().slice(0, 10)

  const [ohlcvRes, quoteRes, earningsRes] = await Promise.allSettled([
    getOHLCV(ticker, from, to, "day"),
    getUniversalQuote(ticker),
    getEarningsDate(ticker),
  ])

  const bars = ohlcvRes.status === "fulfilled" && ohlcvRes.value.length >= MIN_CLOSES
    ? ohlcvRes.value
    : await getOHLCVYahooFallback(ticker, "day")

  if (bars.length < MIN_CLOSES) return null

  const closes:  number[] = bars.map(b => b.close).filter(Boolean)
  const volumes: number[] = bars.map(b => b.volume)
  const highs:   number[] = bars.map(b => b.high).filter(Boolean)
  const lows:    number[] = bars.map(b => b.low).filter(Boolean)

  const quote = quoteRes.status === "fulfilled" ? quoteRes.value : null
  const prix  = quote?.price ?? closes[closes.length - 1]
  const earningsDate = earningsRes.status === "fulfilled" ? earningsRes.value : null

  return { prix, closes, volumes, highs, lows, earningsDate }
}

// ─── Divergence RSI ───────────────────────────────────────────────────────────
function detectDivergence(closes: number[], rsiValues: number[]): "bullish" | "bearish" | "none" {
  if (closes.length < 30) return "none"

  const recentCloses = closes.slice(-30)
  const recentRSI    = rsiValues.slice(-30)

  // Divergence haussière : prix fait un nouveau bas mais RSI monte
  const priceMin1 = Math.min(...recentCloses.slice(0, 15))
  const priceMin2 = Math.min(...recentCloses.slice(15))
  const rsiAtMin1 = recentRSI[recentCloses.slice(0, 15).indexOf(priceMin1)]
  const rsiAtMin2 = recentRSI[15 + recentCloses.slice(15).indexOf(priceMin2)]
  if (priceMin2 < priceMin1 * 0.99 && rsiAtMin2 > rsiAtMin1 * 1.05) return "bullish"

  // Divergence baissière : prix fait un nouveau haut mais RSI descend
  const priceMax1 = Math.max(...recentCloses.slice(0, 15))
  const priceMax2 = Math.max(...recentCloses.slice(15))
  const rsiAtMax1 = recentRSI[recentCloses.slice(0, 15).indexOf(priceMax1)]
  const rsiAtMax2 = recentRSI[15 + recentCloses.slice(15).indexOf(priceMax2)]
  if (priceMax2 > priceMax1 * 1.01 && rsiAtMax2 < rsiAtMax1 * 0.95) return "bearish"

  return "none"
}

// ─── Contexte de marché (VIX + SPY via marketData) ───────────────────────────
async function fetchMarketContext() {
  try {
    const to   = new Date().toISOString().slice(0, 10)
    const from = new Date(Date.now() - 90 * 86400_000).toISOString().slice(0, 10)

    const [vixRes, spyRes] = await Promise.allSettled([
      getUniversalQuote("^VIX"),
      getOHLCV("SPY", from, to, "day").then(bars =>
        bars.length > 0 ? bars : getOHLCVYahooFallback("SPY")
      ),
    ])

    let vix       = 18
    let spy_trend: "bullish" | "bearish" | "neutral" = "neutral"

    if (vixRes.status === "fulfilled" && vixRes.value) {
      vix = vixRes.value.price
    }

    if (spyRes.status === "fulfilled") {
      const closes = spyRes.value.map(b => b.close).filter(Boolean)
      if (closes.length >= 50) {
        const len  = closes.length
        const ma50 = closes.slice(-50).reduce((a, b) => a + b, 0) / 50
        const ma200len = Math.min(200, len)
        const ma200 = closes.slice(-ma200len).reduce((a, b) => a + b, 0) / ma200len
        const cur   = closes[len - 1]
        spy_trend = cur > ma50 && ma50 > ma200 ? "bullish"
                  : cur < ma50 && ma50 < ma200 ? "bearish"
                  : "neutral"
      }
    }

    const favorable = vix < 25 && spy_trend !== "bearish"
    return { vix, spy_trend, favorable }
  } catch {
    return { vix: 18, spy_trend: "neutral" as const, favorable: true }
  }
}

// ─── Arrondi vers round number (si < 1.2% d'écart) ───────────────────────────
function snapToRound(price: number): number {
  const magnitude = Math.pow(10, Math.floor(Math.log10(price)) - 1)
  const rounded   = Math.round(price / magnitude) * magnitude
  return Math.abs(rounded - price) / price < 0.012 ? rounded : price
}

// ─── Traitement d'un ticker ───────────────────────────────────────────────────
async function traiterTicker(
  ticker: string,
  marketContext: Awaited<ReturnType<typeof fetchMarketContext>>
) {
  try {
    const data = await fetchDonnees(ticker)
    if (!data || data.closes.length < MIN_CLOSES) return null

    // Warning earnings proche (< 7 jours)
    const earningsWarning = data.earningsDate
      ? (new Date(data.earningsDate).getTime() - Date.now()) / 86400_000 < 7
        ? `⚠️ Earnings dans ${Math.ceil((new Date(data.earningsDate).getTime() - Date.now()) / 86400_000)} jours — risque élevé`
        : null
      : null

    const ind = analyserIndicateurs(data.closes, data.volumes, data.prix, data.highs, data.lows)

    // Filtres stricts
    if (ind.score < MIN_SCORE)         return null
    if (ind.confluence_count < MIN_FAMILLES) return null
    if (ind.trend === "neutral")       return null

    // Ajustement selon contexte macro
    let adjustedScore = ind.score
    if (ind.trend === "bullish" && !marketContext.favorable) {
      adjustedScore = Math.max(50, ind.score - 15)
      if (adjustedScore < MIN_SCORE)   return null
    }

    // Détection divergence RSI
    const rsiSeries  = calcRSISeries(data.closes)
    const divergence = detectDivergence(data.closes, rsiSeries)

    // Bonus divergence confirmante
    if (
      (divergence === "bullish" && ind.trend === "bullish") ||
      (divergence === "bearish" && ind.trend === "bearish")
    ) {
      adjustedScore = Math.min(98, adjustedScore + 8)
    }

    const direction = ind.trend === "bullish" ? "LONG" : "SHORT"

    // ATR sur 14 jours
    const atr = data.highs.slice(-14)
      .map((h, i) => h - data.lows.slice(-14)[i])
      .reduce((a, b) => a + b, 0) / 14

    const prix_entree = data.prix
    let tp1, tp2, tp3, stop_loss

    if (direction === "LONG") {
      tp1       = snapToRound(parseFloat((prix_entree + atr * 1.5).toFixed(2)))
      tp2       = snapToRound(parseFloat((prix_entree + atr * 3.0).toFixed(2)))
      tp3       = snapToRound(parseFloat((prix_entree + atr * 5.0).toFixed(2)))
      stop_loss = snapToRound(parseFloat((prix_entree - atr * 1.5).toFixed(2)))
    } else {
      tp1       = snapToRound(parseFloat((prix_entree - atr * 1.5).toFixed(2)))
      tp2       = snapToRound(parseFloat((prix_entree - atr * 3.0).toFixed(2)))
      tp3       = snapToRound(parseFloat((prix_entree - atr * 5.0).toFixed(2)))
      stop_loss = snapToRound(parseFloat((prix_entree + atr * 1.5).toFixed(2)))
    }

    const atrPct  = atr / prix_entree
    const timeframe = atrPct > 0.04 ? "swing" : atrPct > 0.015 ? "scalp" : "position"

    // ── Analyse Groq enrichie ──────────────────────────────────────────────
    let quote        = ""
    let raisonnement = ""
    try {
      const divergenceText = divergence !== "none"
        ? `\n⚠️ DIVERGENCE RSI ${divergence.toUpperCase()} DÉTECTÉE — signal de retournement fort`
        : ""
      const earningsText = earningsWarning ? `\n${earningsWarning}` : ""
      const contextText = !marketContext.favorable
        ? `\n⚠️ CONTEXTE MACRO DÉFAVORABLE — VIX ${marketContext.vix.toFixed(0)}, SPY ${marketContext.spy_trend}`
        : `\nContexte macro favorable — VIX ${marketContext.vix.toFixed(0)}, SPY ${marketContext.spy_trend}`

      const prompt = `Tu es un analyste technique senior sur un terminal de trading professionnel.
Génère une analyse claire et précise pour ce signal.

Signal : ${direction} sur ${ticker}
Prix d'entrée : $${prix_entree} | TP1: $${tp1} | TP2: $${tp2} | TP3: $${tp3} | SL: $${stop_loss}
Score de confiance : ${adjustedScore}% | ${ind.confluence_count}/${ind.confluence_total} familles confirmées

Indicateurs (RSI méthode Wilder, MACD série complète) :
RSI: ${ind.rsi.toFixed(1)} | Stoch: ${ind.stoch_k.toFixed(1)} | W%R: ${ind.williams_r.toFixed(1)}
MACD: ${ind.macd.value.toFixed(4)} / Signal: ${ind.macd.signal.toFixed(4)} / Hist: ${ind.macd.histogram.toFixed(4)}
BB position: ${ind.bb.position.toFixed(1)}% | Volume: ${ind.volume_ratio.toFixed(2)}x moyenne
MA7: $${ind.ma7.toFixed(2)} | MA50: $${ind.ma50.toFixed(2)} | MA200: $${ind.ma200.toFixed(2)}
EMA Cross: ${ind.ema_cross} | OBV: ${ind.obv_trend}
${divergenceText}
${contextText}

Familles confirmées : ${ind.confirmed_by.join(", ")}
${earningsText}

Format de réponse OBLIGATOIRE :
QUOTE: [phrase d'accroche percutante 12-18 mots]

Ensuite en français, analyse structurée :
1. Contexte de marché (2-3 phrases)
2. Pourquoi ce signal est valide (appui sur les indicateurs)
3. Niveaux clés et plan de trade
4. Risques et scénario alternatif
5. Avertissement : "Ce signal est basé sur l'analyse technique et ne constitue pas un conseil en investissement."`

      const completion = await groq.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model:    "llama-3.3-70b-versatile",
        max_tokens: 1200,
      })
      const raw = completion.choices[0]?.message?.content ?? ""
      const m   = raw.match(/QUOTE:\s*(.+)/)
      quote        = m?.[1]?.trim() ?? ""
      raisonnement = raw.replace(/QUOTE:\s*.+\n?/, "").trim()
    } catch (groqErr) {
      process.stderr.write(`[signaux/generate] Groq error for ${ticker}: ${groqErr}\n`)
    }

    const { data: signal, error: insertError } = await supabase.from("signaux").insert({
      ticker,
      direction,
      prix_entree,
      take_profit_1: tp1,
      take_profit_2: tp2,
      take_profit_3: tp3,
      stop_loss,
      timeframe,
      score_confiance: adjustedScore,
      quote,
      raisonnement,
      divergence_rsi:  divergence,
      earnings_warning: earningsWarning,
      market_context: {
        vix:        marketContext.vix,
        spy_trend:  marketContext.spy_trend,
        favorable:  marketContext.favorable,
      },
      indicateurs: {
        rsi:              ind.rsi,
        stoch_k:          ind.stoch_k,
        williams_r:       ind.williams_r,
        macd:             ind.macd,
        bb:               ind.bb,
        ma7:              ind.ma7,
        ma21:             ind.ma21,
        ma50:             ind.ma50,
        ma200:            ind.ma200,
        ema9:             ind.ema9,
        ema21:            ind.ema21,
        ema_cross:        ind.ema_cross,
        obv_trend:        ind.obv_trend,
        volume_ratio:     ind.volume_ratio,
        signals:          ind.signals,
        confluence_count: ind.confluence_count,
        confluence_total: ind.confluence_total,
        confirmed_by:     ind.confirmed_by,
      },
    }).select().single()

    if (insertError) process.stderr.write(`[signaux/generate] Insert error ${ticker}: ${insertError.message}\n`)
    return signal ?? null
  } catch (e) {
    process.stderr.write(`[signaux/generate] Erreur ${ticker}: ${e}\n`)
    return null
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────
export async function POST(_req: NextRequest) {
  // Contexte marché récupéré une seule fois pour tous les tickers
  const marketContext = await fetchMarketContext()

  const results = await Promise.allSettled(
    WATCHLIST.map(ticker => traiterTicker(ticker, marketContext))
  )

  const signaux_generes = results
    .filter((r): r is PromiseFulfilledResult<NonNullable<Awaited<ReturnType<typeof traiterTicker>>>> =>
      r.status === "fulfilled" && r.value !== null
    )
    .map(r => r.value)

  return NextResponse.json({
    message:        `${signaux_generes.length} signal(s) généré(s)`,
    market_context: marketContext,
    signaux:        signaux_generes,
  })
}

export async function GET(req: NextRequest) {
  return POST(req)
}
