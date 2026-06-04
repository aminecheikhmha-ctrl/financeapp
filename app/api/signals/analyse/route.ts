export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_KEY || "placeholder"
)

export async function POST(req: NextRequest) {
  const { ticker, signal_id } = await req.json()
  if (!ticker) return NextResponse.json({ error: "ticker required" }, { status: 400 })

  // Fetch market data
  const res = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1y`,
    { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" }
  )
  if (!res.ok) return NextResponse.json({ error: "fetch failed" }, { status: 500 })
  const json = await res.json()
  const result = json?.chart?.result?.[0]
  if (!result) return NextResponse.json({ error: "no data" }, { status: 500 })

  const meta = result.meta
  const q = result.indicators?.quote?.[0] ?? {}
  const closes: number[] = (q.close ?? []).filter(Boolean)
  const highs: number[]  = (q.high  ?? []).filter(Boolean)
  const lows: number[]   = (q.low   ?? []).filter(Boolean)
  if (closes.length < 20) return NextResponse.json({ error: "not enough data" }, { status: 500 })

  const price = meta.regularMarketPrice as number
  const high52 = meta.fiftyTwoWeekHigh as number
  const low52  = meta.fiftyTwoWeekLow  as number

  // Get existing signal data from DB for context
  const { data: row } = signal_id
    ? await supabase.from("signaux").select("*").eq("id", signal_id).single()
    : await supabase.from("signaux").select("*").eq("ticker", ticker).order("created_at", { ascending: false }).limit(1).single()

  const ind = row?.indicateurs ?? {}
  const direction = row?.direction ?? "LONG"
  const tp1 = row?.take_profit_1 ?? price
  const tp2 = row?.take_profit_2 ?? price
  const tp3 = row?.take_profit_3 ?? price
  const sl  = row?.stop_loss     ?? price
  const score = row?.score_confiance ?? 50
  const confirmedBy: string[] = ind?.confirmed_by ?? []

  const prompt = `Tu es un analyste financier quantitatif senior. Génère une analyse approfondie et professionnelle pour ce signal de trading.

Actif : ${ticker} (${ind?.name ?? ticker})
Signal : ${direction === "LONG" ? "ACHAT" : "VENTE"} ${ind?.signal ?? ""}
Prix actuel : $${price.toLocaleString()}
Plus haut 52s : $${high52} | Plus bas 52s : $${low52}
Score de confluence : ${score}% (${ind?.confluence_count ?? "?"} / ${ind?.total_indicators ?? 17} indicateurs)

Indicateurs qui confirment : ${confirmedBy.join(", ") || "N/A"}

Niveaux de trading :
- Entrée : $${row?.prix_entree ?? price}
- TP1 : $${tp1} | TP2 : $${tp2} | TP3 : $${tp3}
- Stop Loss : $${sl}
- R/R TP1 : ${ind?.risk_reward_tp1?.toFixed(1) ?? "?"} | R/R TP2 : ${ind?.risk_reward_tp2?.toFixed(1) ?? "?"}

Données techniques :
- RSI(14) : ${ind?.rsi?.toFixed(1) ?? "N/A"}
- MACD histogramme : ${ind?.macd_hist?.toFixed(4) ?? "N/A"}
- Volume ratio : ${ind?.volume_ratio?.toFixed(2) ?? "N/A"}x
- Bollinger position : ${ind?.bb_position?.toFixed(1) ?? "N/A"}%
- Variation 24h : ${ind?.change_24h?.toFixed(2) ?? "N/A"}%

Write a structured analysis in English with these sections (use ### for headings):

### 1. Market Context
Explain the current situation of the asset, its trend, and the macro context.

### 2. Why This Signal Now
Detail the indicators triggering the signal and their significance.

### 3. Risk Management
Explain the TP/SL strategy, the risk/reward ratio, and recommended sizing.

### 4. Alternative Scenarios
Describe what would invalidate this signal and the levels to watch.

### 5. Catalysts to Watch
List events (earnings, macro, sector news) that could accelerate or invalidate the move.

Be precise, cite numbers, stay factual. Maximum 400 words.`

  try {
    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        max_tokens: 1200,
        temperature: 0.3,
        messages: [{ role: "user", content: prompt }],
      }),
    })
    const groqJson = await groqRes.json()
    const raisonnement = groqJson.choices?.[0]?.message?.content ?? ""

    // Update in DB
    if (row?.id) {
      await supabase.from("signaux").update({ raisonnement }).eq("id", row.id)
    }

    return NextResponse.json({ raisonnement, id: row?.id })
  } catch (e) {
    return NextResponse.json({ error: "Groq failed" }, { status: 500 })
  }
}
