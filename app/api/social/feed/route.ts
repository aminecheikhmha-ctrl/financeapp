import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

type FeedItem = {
  type: "trade" | "achievement"
  user: string
  symbol?: string
  side?: string
  pnl_pct?: number
  achievement?: string
  timestamp: string
}

export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "")
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const [{ data: trades }, { data: recentAchievements }] = await Promise.all([
    supabase
      .from("public_trades")
      .select("user_id, symbol, side, pnl_pct, created_at, user_profiles(username)")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("user_achievements")
      .select("user_id, achievement_id, unlocked_at, user_profiles(username)")
      .order("unlocked_at", { ascending: false })
      .limit(10),
  ])

  const tradeItems: FeedItem[] = (trades ?? []).map((t: any) => ({
    type: "trade",
    user: (Array.isArray(t.user_profiles) ? t.user_profiles[0]?.username : t.user_profiles?.username) ?? t.user_id,
    symbol: t.symbol,
    side: t.side,
    pnl_pct: t.pnl_pct ?? undefined,
    timestamp: t.created_at,
  }))

  const achievementItems: FeedItem[] = (recentAchievements ?? []).map((a: any) => ({
    type: "achievement",
    user: (Array.isArray(a.user_profiles) ? a.user_profiles[0]?.username : a.user_profiles?.username) ?? a.user_id,
    achievement: a.achievement_id,
    timestamp: a.unlocked_at,
  }))

  const items: FeedItem[] = [...tradeItems, ...achievementItems].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )

  return NextResponse.json({ items })
}
