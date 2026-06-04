export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import Groq from "groq-sdk"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_KEY || "placeholder"
)

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

const LIMITES: Record<string, number> = {
  free: 1,
  pro: 15,
  premium: Infinity,
}

export async function POST(req: NextRequest) {
  try {
    const { ticker, email } = await req.json()

    const { data: profile } = await supabase
      .from("profiles")
      .select("plan")
      .eq("email", email)
      .single()

    const plan = profile?.plan ?? "free"
    const limite = LIMITES[plan]

    const today = new Date().toISOString().split("T")[0]
    const { count } = await supabase
      .from("analyses")
      .select("*", { count: "exact", head: true })
      .eq("user_email", email)
      .gte("created_at", `${today}T00:00:00`)

    if (limite !== Infinity && (count ?? 0) >= limite) {
      return NextResponse.json(
        { error: `Limite atteinte. Tu as droit à ${limite} analyse(s) par jour avec le plan ${plan}.` },
        { status: 403 }
      )
    }

    // Récupère les données de marché
    const yahooRes = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=3mo`,
      { headers: { "User-Agent": "Mozilla/5.0" } }
    )
    const yahooJson = await yahooRes.json()
    const result = yahooJson?.chart?.result?.[0]
    const meta = result?.meta

    if (!meta) {
      return NextResponse.json({ error: "Ticker introuvable" }, { status: 404 })
    }

    const prix = meta.regularMarketPrice ?? 0
    const previousClose = meta.previousClose ?? prix
    const change = previousClose ? ((prix - previousClose) / previousClose * 100) : 0
    const high52 = meta.fiftyTwoWeekHigh ?? 0
    const low52 = meta.fiftyTwoWeekLow ?? 0
    const volume = meta.regularMarketVolume ?? 0

    // Récupère les derniers prix pour calculer les moyennes mobiles
    const closes = result?.indicators?.quote?.[0]?.close ?? []
    const recentCloses = closes.filter(Boolean).slice(-30)
    const ma7 = recentCloses.slice(-7).reduce((a: number, b: number) => a + b, 0) / 7
    const ma30 = recentCloses.reduce((a: number, b: number) => a + b, 0) / recentCloses.length

    // Prompt pour Groq
    const prompt = `You are an expert financial analyst. Analyze this asset professionally and in detail.

Market data for ${ticker.toUpperCase()} :
- Current price: $${prix.toFixed(2)}
- Daily change: ${change.toFixed(2)}%
- 52-week high: $${high52.toFixed(2)}
- 52-week low: $${low52.toFixed(2)}
- Position in 52w range: ${high52 > low52 ? ((prix - low52) / (high52 - low52) * 100).toFixed(0) : "N/A"}%
- Volume: ${volume.toLocaleString()}
- 7d moving average: $${ma7.toFixed(2)}
- 30d moving average: $${ma30.toFixed(2)}
- MA signal: ${ma7 > ma30 ? "Bullish (MA7 > MA30)" : "Bearish (MA7 < MA30)"}

Provide a structured analysis with:
1. Summary of the current situation
2. Technical analysis (support, resistance, trend)
3. Strengths and weaknesses
4. Risk level (low/moderate/high)
5. Recommendation (buy/wait/sell) with justification
6. Key levels to watch

Be precise, professional and concise.`

    const completion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama-3.3-70b-versatile",
      max_tokens: 1024,
    })

    const resultat = completion.choices[0]?.message?.content ?? "Analyse indisponible."

    await supabase.from("analyses").insert({
      user_email: email,
      ticker: ticker.toUpperCase(),
      resultat,
    })

    return NextResponse.json({
      resultat,
      plan,
      restant: limite === Infinity ? "∞" : limite - (count ?? 0) - 1,
    })

  } catch (e: any) {
    process.stderr.write(`[analyse] error: ${e}\n`)
    return NextResponse.json({ error: "Erreur lors de l'analyse : " + e.message }, { status: 500 })
  }
}