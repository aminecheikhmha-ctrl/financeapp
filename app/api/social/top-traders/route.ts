import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

type PublicTrade = {
  user_id: string
  pnl_pct: number | null
}

type UserProfile = {
  user_id: string
  username: string
  avatar_color: string
  xp: number
}

export async function GET() {
  try {
    const [{ data: trades }, { data: profiles }] = await Promise.all([
      supabase
        .from("public_trades")
        .select("user_id, pnl_pct"),
      supabase
        .from("user_profiles")
        .select("user_id, username, avatar_color, xp"),
    ])

    if (!trades || trades.length === 0) {
      return NextResponse.json({ traders: [] })
    }

    const profileMap = new Map<string, UserProfile>(
      (profiles ?? []).map((p: UserProfile) => [p.user_id, p])
    )

    const byUser = new Map<
      string,
      { total_pnl: number; count: number; wins: number }
    >()

    for (const trade of trades as PublicTrade[]) {
      const uid = trade.user_id
      const pnl = trade.pnl_pct ?? 0
      const existing = byUser.get(uid) ?? { total_pnl: 0, count: 0, wins: 0 }
      existing.total_pnl += pnl
      existing.count += 1
      if (pnl > 0) existing.wins += 1
      byUser.set(uid, existing)
    }

    const traders = Array.from(byUser.entries())
      .map(([user_id, stats]) => {
        const profile = profileMap.get(user_id)
        return {
          user_id,
          username: profile?.username ?? user_id,
          avatar_color: profile?.avatar_color ?? "#4ade80",
          xp: profile?.xp ?? 0,
          total_trades: stats.count,
          avg_pnl_pct: stats.count > 0 ? stats.total_pnl / stats.count : 0,
          win_rate: stats.count > 0 ? Math.round((stats.wins / stats.count) * 100) : 0,
        }
      })
      .sort((a, b) => b.avg_pnl_pct - a.avg_pnl_pct)
      .slice(0, 10)

    return NextResponse.json({ traders })
  } catch {
    return NextResponse.json({ traders: [] })
  }
}
