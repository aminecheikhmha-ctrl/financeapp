import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const ADMIN_EMAIL = "amine_cm@icloud.com"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "")
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user || user.email !== ADMIN_EMAIL)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  // Toutes les entrées des 30 derniers jours
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const { data: logs, error } = await supabase
    .from("ai_usage_logs")
    .select("user_id, feature, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Tous les profils pour avoir email + plan
  const { data: profiles } = await supabase
    .from("user_profiles")
    .select("id, email, plan, username")

  const profileMap: Record<string, { email: string; plan: string; username: string }> = {}
  for (const p of profiles ?? []) {
    profileMap[p.id] = { email: p.email ?? "?", plan: p.plan ?? "free", username: p.username ?? "" }
  }

  // Agrégation par user_id
  const byUser: Record<string, {
    user_id: string
    email: string
    plan: string
    username: string
    total: number
    coach: number
    chat: number
    trade_coach: number
    portfolio_analysis: number
    moderation: number
    last_used: string
  }> = {}

  for (const log of logs ?? []) {
    if (!byUser[log.user_id]) {
      const p = profileMap[log.user_id]
      byUser[log.user_id] = {
        user_id: log.user_id,
        email: p?.email ?? log.user_id.slice(0, 8) + "…",
        plan: p?.plan ?? "free",
        username: p?.username ?? "",
        total: 0,
        coach: 0,
        chat: 0,
        trade_coach: 0,
        portfolio_analysis: 0,
        moderation: 0,
        last_used: log.created_at,
      }
    }
    byUser[log.user_id].total++
    const f = log.feature as keyof typeof byUser[string]
    if (f in byUser[log.user_id]) {
      ;(byUser[log.user_id][f] as number)++
    }
    // last_used est déjà le plus récent (logs triés DESC)
    if (!byUser[log.user_id].last_used || log.created_at > byUser[log.user_id].last_used) {
      byUser[log.user_id].last_used = log.created_at
    }
  }

  const users = Object.values(byUser).sort((a, b) => b.total - a.total)

  // Totaux globaux
  const totals = {
    total: logs?.length ?? 0,
    coach: logs?.filter(l => l.feature === "coach").length ?? 0,
    chat: logs?.filter(l => l.feature === "chat").length ?? 0,
    trade_coach: logs?.filter(l => l.feature === "trade_coach").length ?? 0,
    portfolio_analysis: logs?.filter(l => l.feature === "portfolio_analysis").length ?? 0,
    moderation: logs?.filter(l => l.feature === "moderation").length ?? 0,
    today: logs?.filter(l => l.created_at >= new Date(Date.now() - 86400000).toISOString()).length ?? 0,
    this_week: logs?.filter(l => l.created_at >= new Date(Date.now() - 7 * 86400000).toISOString()).length ?? 0,
  }

  return NextResponse.json({ users, totals })
}
