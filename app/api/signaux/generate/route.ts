export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import Groq from "groq-sdk"
import { analyserIndicateurs } from "@/lib/indicateurs"

export const maxDuration = 60

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_KEY || "placeholder"
)

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

const WATCHLIST = [
  "AAPL", "TSLA", "NVDA", "MSFT", "AMZN",
  "META", "GOOGL", "BTC-USD", "ETH-USD", "SPY"
]

async function fetchDonnees(ticker: string) {
  const res = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1y`,
    { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" }
  )
  if (!res.ok) return null
  const json = await res.json()
  const result = json?.chart?.result?.[0]
  if (!result) return null

  const meta = result.meta
  const q = result.indicators?.quote?.[0] ?? {}
  const closes: number[]  = (q.close  ?? []).filter(Boolean)
  const volumes: number[] = (q.volume ?? []).filter(Boolean)
  const highs: number[]   = (q.high   ?? []).filter(Boolean)
  const lows: number[]    = (q.low    ?? []).filter(Boolean)

  return {
    prix: meta.regularMarketPrice as number,
    high52: meta.fiftyTwoWeekHigh as number,
    low52:  meta.fiftyTwoWeekLow  as number,
    closes, volumes, highs, lows,
  }
}

async function traiterTicker(ticker: string) {
  try {
    const data = await fetchDonnees(ticker)
    if (!data || data.closes.length < 50) return null

    const ind = analyserIndicateurs(data.closes, data.volumes, data.prix, data.highs, data.lows)

    if (ind.score < 50) return null

    // Si neutre, on tranche selon la tendance dominante (bullish par défaut)
    const direction = ind.trend === "bearish" ? "SHORT" : "LONG"
    const atr = data.highs.slice(-14).map((h, i) => h - data.lows.slice(-14)[i])
      .reduce((a, b) => a + b, 0) / 14

    const prix_entree = data.prix
    let tp1, tp2, tp3, stop_loss

    if (direction === "LONG") {
      tp1 = parseFloat((prix_entree + atr * 1.5).toFixed(2))
      tp2 = parseFloat((prix_entree + atr * 3).toFixed(2))
      tp3 = parseFloat((prix_entree + atr * 5).toFixed(2))
      stop_loss = parseFloat((prix_entree - atr * 1.5).toFixed(2))
    } else {
      tp1 = parseFloat((prix_entree - atr * 1.5).toFixed(2))
      tp2 = parseFloat((prix_entree - atr * 3).toFixed(2))
      tp3 = parseFloat((prix_entree - atr * 5).toFixed(2))
      stop_loss = parseFloat((prix_entree + atr * 1.5).toFixed(2))
    }

    const timeframe = atr / prix_entree > 0.03 ? "swing" : atr / prix_entree > 0.01 ? "scalp" : "position"

    // Génère raisonnement IA — fallback vide si Groq indisponible
    let quote = ""
    let raisonnement = ""
    try {
      const prompt = `Tu es un trader algorithmique expert. Génère un raisonnement détaillé pour ce signal.

Signal : ${direction} sur ${ticker}
Prix : $${prix_entree} | TP1: $${tp1} | TP2: $${tp2} | TP3: $${tp3} | SL: $${stop_loss}
Score : ${ind.score}% | Confluence : ${ind.confluence_count}/${ind.confluence_total}
RSI: ${ind.rsi.toFixed(1)} | Stoch K: ${ind.stoch_k.toFixed(1)} | Williams %R: ${ind.williams_r.toFixed(1)}
MACD hist: ${ind.macd.histogram.toFixed(3)} | BB pos: ${ind.bb.position.toFixed(1)}%
OBV: ${ind.obv_trend} | Volume ratio: ${ind.volume_ratio.toFixed(2)}x

IMPORTANT: Commence par : QUOTE: [phrase percutante 12-18 mots]
Ensuite rédige en français : contexte marché, pourquoi ce signal, gestion du risque, scénarios alternatifs.`

      const completion = await groq.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: "llama-3.3-70b-versatile",
        max_tokens: 1000,
      })

      const raw = completion.choices[0]?.message?.content ?? ""
      const m = raw.match(/QUOTE:\s*(.+)/)
      quote = m?.[1]?.trim() ?? ""
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
      score_confiance: ind.score,
      raisonnement,
      indicateurs: {
        rsi: ind.rsi,
        stoch_k: ind.stoch_k,
        williams_r: ind.williams_r,
        macd: ind.macd,
        bb: ind.bb,
        ma7: ind.ma7,
        ma21: ind.ma21,
        ma50: ind.ma50,
        ma200: ind.ma200,
        ema9: ind.ema9,
        ema21: ind.ema21,
        ema_cross: ind.ema_cross,
        obv_trend: ind.obv_trend,
        volume_ratio: ind.volume_ratio,
        signals: ind.signals,
        confluence_count: ind.confluence_count,
        confluence_total: ind.confluence_total,
        confirmed_by: ind.confirmed_by,
      },
    }).select().single()

    if (insertError) process.stderr.write(`[signaux/generate] Supabase insert error for ${ticker}: ${insertError.message}\n`)
    return signal ?? null
  } catch (e) {
    process.stderr.write(`[signaux/generate] Erreur pour ${ticker}: ${e}\n`)
    return null
  }
}

export async function POST(_req: NextRequest) {
  const results = await Promise.allSettled(WATCHLIST.map(traiterTicker))

  const signaux_generes = results
    .filter((r): r is PromiseFulfilledResult<NonNullable<Awaited<ReturnType<typeof traiterTicker>>>> =>
      r.status === "fulfilled" && r.value !== null
    )
    .map(r => r.value)

  return NextResponse.json({
    message: `${signaux_generes.length} signal(s) généré(s)`,
    signaux: signaux_generes,
  })
}

export async function GET(req: NextRequest) {
  return POST(req)
}
