import { NextRequest, NextResponse } from "next/server"
import Groq from "groq-sdk"
import { createClient } from "@supabase/supabase-js"
import { logAIUsage } from "@/lib/ai-logger"

export const runtime = "nodejs"
export const maxDuration = 30

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

const FALLBACK_RESULT = {
  score_diversification: 50,
  score_performance: 50,
  score_risk: 50,
  score_global: 50,
  recommandations: ["Diversifiez votre portfolio", "Gérez votre risque", "Suivez vos positions"],
  points_forts: ["Portfolio actif", "Présence sur le marché"],
  points_faibles: ["Données insuffisantes pour analyse complète"],
  analyse_sectorielle: { tech: 33, crypto: 33, autres: 34 },
  commentaire: "Analyse indisponible pour le moment. Veuillez réessayer.",
}

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "")
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: { positions?: unknown[]; orders?: unknown[] } = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 })
  }

  const { positions = [], orders = [] } = body

  const prompt = `Voici le portfolio à analyser:
Positions: ${JSON.stringify(positions)}
Ordres récents: ${JSON.stringify(orders)}`

  let result = FALLBACK_RESULT

  try {
    const completion = await Promise.race([
      groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: `Tu es un analyste financier expert. Analyse ce portfolio de trading.
Évalue en JSON strict:
{
  "score_diversification": 0-100,
  "score_performance": 0-100,
  "score_risk": 0-100,
  "score_global": 0-100,
  "recommandations": ["string", ...], // 3-5 recommandations concrètes
  "points_forts": ["string", ...], // 2-3 points
  "points_faibles": ["string", ...], // 2-3 points
  "analyse_sectorielle": {"tech": 0-100, "crypto": 0-100, "autres": 0-100}, // % du portfolio
  "commentaire": "string" // 2-3 phrases de synthèse
}
Réponds UNIQUEMENT avec le JSON, pas de markdown.`,
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), 10000)
      ),
    ])

    try {
      result = JSON.parse(
        completion.choices[0]?.message?.content?.trim() ?? "{}"
      )
    } catch {
      result = FALLBACK_RESULT
    }
  } catch {
    result = FALLBACK_RESULT
  }

  await supabase.from("ai_analyses").insert({
    type: "portfolio",
    content: result,
    user_id: user.id,
  })
  void logAIUsage(user.id, "portfolio_analysis")

  return NextResponse.json(result)
}
