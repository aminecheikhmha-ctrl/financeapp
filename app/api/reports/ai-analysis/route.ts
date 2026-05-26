import { NextRequest, NextResponse } from "next/server"
import Groq from "groq-sdk"
import { createClient } from "@supabase/supabase-js"

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "")
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )

  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { winRate, profitFactor, avgWin, avgLoss, totalTrades, topSymbols } = await req.json()

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: "Tu es un coach de trading professionnel. Analyse les performances d'un trader et donne des conseils personnalisés, bienveillants et actionnables. Réponds en français, en 3-4 phrases maximum. Sois précis avec les chiffres fournis.",
        },
        {
          role: "user",
          content: `Analyse ces performances de paper trading :
- Win rate : ${winRate.toFixed(1)}%
- Profit factor : ${isFinite(profitFactor) ? profitFactor.toFixed(2) : "infini (aucune perte)"}
- Gain moyen par position gagnante : +$${avgWin.toFixed(2)}
- Perte moyenne par position perdante : -$${Math.abs(avgLoss).toFixed(2)}
- Total d'ordres : ${totalTrades}
- Actifs les plus tradés : ${topSymbols.length > 0 ? topSymbols.join(", ") : "aucun encore"}
Donne une analyse constructive et 1 conseil prioritaire actionnable.`,
        },
      ],
      max_tokens: 280,
      temperature: 0.7,
    })

    return NextResponse.json({
      analysis: completion.choices[0]?.message?.content ?? "",
    })
  } catch (err) {
    console.error("AI analysis error:", err)
    return NextResponse.json({ error: "Génération échouée" }, { status: 500 })
  }
}
