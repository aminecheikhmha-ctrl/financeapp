import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import Groq from "groq-sdk"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
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
    const prompt = `Tu es un analyste financier expert. Analyse cet actif de façon professionnelle et détaillée.

Données de marché pour ${ticker.toUpperCase()} :
- Prix actuel : $${prix.toFixed(2)}
- Variation du jour : ${change.toFixed(2)}%
- Plus haut 52 semaines : $${high52.toFixed(2)}
- Plus bas 52 semaines : $${low52.toFixed(2)}
- Position dans la range 52s : ${high52 > low52 ? ((prix - low52) / (high52 - low52) * 100).toFixed(0) : "N/A"}%
- Volume : ${volume.toLocaleString()}
- Moyenne mobile 7j : $${ma7.toFixed(2)}
- Moyenne mobile 30j : $${ma30.toFixed(2)}
- Signal MM : ${ma7 > ma30 ? "Bullish (MM7 > MM30)" : "Bearish (MM7 < MM30)"}

Fournis une analyse structurée avec :
1. Résumé de la situation actuelle
2. Analyse technique (supports, résistances, tendance)
3. Points forts et points faibles
4. Niveau de risque (faible/modéré/élevé)
5. Recommandation (acheter/attendre/vendre) avec justification
6. Niveaux clés à surveiller

Sois précis, professionnel et concis. Réponds en français.`

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
    console.error("Analyse error:", e)
    return NextResponse.json({ error: "Erreur lors de l'analyse : " + e.message }, { status: 500 })
  }
}