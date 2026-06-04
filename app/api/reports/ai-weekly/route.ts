import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import Groq from "groq-sdk"

export const runtime = "nodejs"
export const maxDuration = 45
export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization")?.replace("Bearer ", "")
  if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
    process.env.SUPABASE_SERVICE_KEY || "placeholder"
  )
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

  const { data: { user } } = await supabase.auth.getUser(authHeader)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [ordersRes, posRes, snapshotsRes] = await Promise.all([
    supabase.from("orders").select("*").eq("user_id", user.id).gte("created_at", weekAgo).order("created_at", { ascending: false }),
    supabase.from("positions").select("*").eq("user_id", user.id),
    supabase.from("performance_snapshots").select("*").eq("user_id", user.id).gte("date", weekAgo.slice(0, 10)).order("date"),
  ])

  const orders    = ordersRes.data ?? []
  const positions = posRes.data ?? []
  const snapshots = snapshotsRes.data ?? []

  const weeklyPnl = snapshots.reduce((s: number, d: any) => s + (d.daily_pnl ?? 0), 0)
  const trades    = orders.length
  const wins      = orders.filter((o: any) => o.side === "sell" && (o.pnl ?? 0) > 0).length
  const winRate   = trades > 0 ? Math.round((wins / Math.max(trades, 1)) * 100) : 0

  const context = `Trader: ${user.email}
Semaine du ${weekAgo.slice(0, 10)} au aujourd'hui.
P&L hebdomadaire: $${weeklyPnl.toFixed(2)}
Trades exécutés: ${trades}
Taux de réussite: ${winRate}%
Positions ouvertes: ${positions.length}
Derniers trades: ${orders.slice(0, 5).map((o: any) => `${o.side?.toUpperCase()} ${o.symbol} x${o.qty} à $${o.price}`).join(", ") || "aucun"}`

  const chat = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    max_tokens: 600,
    messages: [
      {
        role: "system",
        content: "Tu es un coach de trading professionnel. Génère un rapport hebdomadaire personnalisé, structuré en 4 sections: 1) Résumé de la semaine 2) Points forts 3) Points d'amélioration 4) Objectifs pour la semaine prochaine. Sois précis, actionnable et encourageant. Utilise des emojis pour rendre le rapport lisible."
      },
      { role: "user", content: context }
    ]
  })

  const report = chat.choices[0]?.message?.content ?? "Rapport indisponible."

  return NextResponse.json({
    report,
    stats: { weeklyPnl, trades, winRate, positions: positions.length }
  })
}
