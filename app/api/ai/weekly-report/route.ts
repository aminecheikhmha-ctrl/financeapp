import { NextRequest, NextResponse } from "next/server"
import Groq from "groq-sdk"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"
export const maxDuration = 30

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

const FALLBACK_REPORT = {
  titre: "Rapport hebdomadaire",
  performance_semaine: "Données insuffisantes",
  meilleur_trade: "N/A",
  pire_trade: "N/A",
  signaux_efficaces: [],
  opportunites_manquees: [],
  objectifs_semaine: ["Continuez à trader", "Gérez votre risque", "Restez discipliné"],
  message_coach: "Bonne semaine de trading ! Continuez vos efforts.",
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization")?.replace("Bearer ", "")
  if (!authHeader || authHeader !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Get all users
  const { data: usersData } = await supabase.auth.admin.listUsers()
  const users = usersData?.users ?? []

  // Week range
  const now = new Date()
  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

  let reportsGenerated = 0
  const reports: { user_id: string; report: unknown }[] = []

  for (const user of users) {
    // Get orders from the past week
    const { data: orders } = await supabase
      .from("orders")
      .select("symbol, side, price, qty, total, status, created_at")
      .eq("user_id", user.id)
      .gte("created_at", weekStart)
      .order("created_at", { ascending: false })

    if (!orders || orders.length === 0) continue

    let report = FALLBACK_REPORT

    try {
      const completion = await Promise.race([
        groq.chat.completions.create({
          model: "llama-3.3-70b-versatile",
          messages: [
            {
              role: "system",
              content: `Génère un rapport hebdomadaire de trading personnalisé.
Retourne JSON:
{
  "titre": "string",
  "performance_semaine": "string",
  "meilleur_trade": "string",
  "pire_trade": "string",
  "signaux_efficaces": ["string"],
  "opportunites_manquees": ["string"],
  "objectifs_semaine": ["string", "string", "string"],
  "message_coach": "string"
}`,
            },
            {
              role: "user",
              content: `Trades de la semaine: ${JSON.stringify(orders)}`,
            },
          ],
          temperature: 0.4,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), 10000)
        ),
      ])

      try {
        report = JSON.parse(
          completion.choices[0]?.message?.content?.trim() ?? "{}"
        )
      } catch {
        report = FALLBACK_REPORT
      }
    } catch {
      report = FALLBACK_REPORT
    }

    await supabase.from("ai_analyses").insert({
      type: "weekly_report",
      content: report,
      user_id: user.id,
    })

    reports.push({ user_id: user.id, report })
    reportsGenerated++
  }

  return NextResponse.json({ reports_generated: reportsGenerated })
}
