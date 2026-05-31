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
  score_global: 50,
  score_timing: 50,
  score_risk: 50,
  score_discipline: 50,
  score_diversification: 50,
  patterns: [],
  meilleures_periodes: [],
  actifs_performants: [],
  actifs_sous_performants: [],
  objectifs: ["Améliorer la gestion du risque", "Diversifier les positions", "Tenir un journal de trading"],
  cours_recommandes: [],
  exercice_semaine: "Analysez vos 3 derniers trades et identifiez ce que vous auriez pu faire différemment.",
  synthese: "Analyse indisponible. Continuez à trader et revenez plus tard.",
}

export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "")
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Check cache: if analysis < 24h exists, return it
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data: cached } = await supabase
    .from("ai_analyses")
    .select("content, created_at")
    .eq("type", "trade_coach")
    .eq("user_id", user.id)
    .gte("created_at", twentyFourHoursAgo)
    .order("created_at", { ascending: false })
    .limit(1)
    .single()

  if (cached?.content) {
    return NextResponse.json({ ...cached.content, cached: true })
  }

  // Fetch user orders
  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select("symbol, side, price, qty, total, status, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  if (ordersError) {
    return NextResponse.json({ error: ordersError.message }, { status: 500 })
  }

  if (!orders || orders.length < 3) {
    return NextResponse.json({
      insufficient_data: true,
      message: "Passe au moins 3 trades pour activer ton coach IA",
    })
  }

  let result = FALLBACK_RESULT

  try {
    const completion = await Promise.race([
      groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: `Tu es un coach de trading personnel. Analyse ces trades et identifie les patterns comportementaux.
Retourne JSON strict:
{
  "score_global": 0-100,
  "score_timing": 0-100,
  "score_risk": 0-100,
  "score_discipline": 0-100,
  "score_diversification": 0-100,
  "patterns": [{"type": "positif"|"negatif", "description": "string", "frequence": "string"}],
  "meilleures_periodes": ["string"],
  "actifs_performants": ["string"],
  "actifs_sous_performants": ["string"],
  "objectifs": ["string", "string", "string"],
  "cours_recommandes": ["string", ...],
  "exercice_semaine": "string",
  "synthese": "string"
}`,
          },
          {
            role: "user",
            content: `Historique des trades: ${JSON.stringify(orders)}`,
          },
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

  const finalResult = { ...result, total_trades: orders.length }

  await supabase.from("ai_analyses").insert({
    type: "trade_coach",
    content: finalResult,
    user_id: user.id,
  })
  void logAIUsage(user.id, "trade_coach")

  return NextResponse.json(finalResult)
}
