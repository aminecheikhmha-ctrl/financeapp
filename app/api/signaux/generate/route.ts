import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import Groq from "groq-sdk"
import { analyserIndicateurs } from "@/lib/indicateurs"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

const WATCHLIST = [
  "AAPL", "TSLA", "NVDA", "MSFT", "AMZN",
  "META", "GOOGL", "BTC-USD", "ETH-USD", "SPY"
]

async function fetchDonnees(ticker: string) {
  const res = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1y`,
    { headers: { "User-Agent": "Mozilla/5.0" } }
  )
  const json = await res.json()
  const result = json?.chart?.result?.[0]
  if (!result) return null

  const meta = result.meta
  const closes: number[] = result.indicators.quote[0].close.filter(Boolean)
  const volumes: number[] = result.indicators.quote[0].volume.filter(Boolean)
  const highs: number[] = result.indicators.quote[0].high.filter(Boolean)
  const lows: number[] = result.indicators.quote[0].low.filter(Boolean)

  return {
    prix: meta.regularMarketPrice,
    previousClose: meta.previousClose,
    high52: meta.fiftyTwoWeekHigh,
    low52: meta.fiftyTwoWeekLow,
    volume: meta.regularMarketVolume,
    closes,
    volumes,
    highs,
    lows,
  }
}

export async function POST(req: NextRequest) {
// Auth désactivé temporairement pour test

  const signaux_generes = []

  for (const ticker of WATCHLIST) {
    try {
      const data = await fetchDonnees(ticker)
      if (!data || data.closes.length < 50) continue

      const ind = analyserIndicateurs(data.closes, data.volumes, data.prix)

      // Génère un signal seulement si score >= 65 et tendance claire
      if (ind.score < 65 || ind.trend === "neutral") continue

      // Calcule les niveaux
      const direction = ind.trend === "bullish" ? "LONG" : "SHORT"
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

      // Génère le raisonnement avec Groq
      const prompt = `Tu es un trader algorithmique expert. Génère un raisonnement détaillé et professionnel pour ce signal de trading.

Signal : ${direction} sur ${ticker}
Prix d'entrée : $${prix_entree}
Take Profit 1 : $${tp1} | TP2 : $${tp2} | TP3 : $${tp3}
Stop Loss : $${stop_loss}
Timeframe : ${timeframe}
Score de confiance : ${ind.score}%

Indicateurs déclencheurs :
${ind.signals.map(s => `- ${s}`).join("\n")}

Données techniques :
- RSI(14) : ${ind.rsi.toFixed(1)}
- MACD : ${ind.macd.value.toFixed(3)} / Signal : ${ind.macd.signal.toFixed(3)} / Histogramme : ${ind.macd.histogram.toFixed(3)}
- Bollinger Position : ${ind.bb.position.toFixed(1)}%
- MA7 : $${ind.ma7.toFixed(2)} | MA21 : $${ind.ma21.toFixed(2)} | MA50 : $${ind.ma50.toFixed(2)} | MA200 : $${ind.ma200.toFixed(2)}
- Ratio Volume : ${ind.volume_ratio.toFixed(2)}x
- Plus haut 52s : $${data.high52} | Plus bas 52s : $${data.low52}

Rédige en français un raisonnement structuré avec :
1. Contexte de marché
2. Pourquoi ce signal maintenant
3. Gestion du risque et du capital
4. Scénarios alternatifs (si le signal échoue)
5. Catalyseurs potentiels à surveiller`

      const completion = await groq.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: "llama-3.3-70b-versatile",
        max_tokens: 1500,
      })

      const raisonnement = completion.choices[0]?.message?.content ?? ""

      const { data: signal } = await supabase.from("signaux").insert({
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
          macd: ind.macd,
          bb: ind.bb,
          ma7: ind.ma7,
          ma21: ind.ma21,
          ma50: ind.ma50,
          ma200: ind.ma200,
          volume_ratio: ind.volume_ratio,
          signals: ind.signals,
        },
      }).select().single()

      if (signal) signaux_generes.push(signal)

    } catch (e) {
      console.error(`Erreur pour ${ticker}:`, e)
    }
  }

  return NextResponse.json({
    message: `${signaux_generes.length} signal(s) généré(s)`,
    signaux: signaux_generes,
  })
}

// Pour le cron Vercel
export async function GET(req: NextRequest) {
  return POST(req)
}