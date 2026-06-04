export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { ACHIEVEMENTS, getLevelFromXP, type AchievementId } from "@/lib/achievements"

export const runtime = "nodejs"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_KEY || "placeholder"
)

type Order = {
  symbol: string
  side: string
  price: number
  qty: number
  total: number
  created_at: string
}

type UserProfile = {
  xp: number
  streak_days: number
}

function checkProfitStreak(orders: Order[], n: number): boolean {
  const sells = orders.filter((o) => o.side === "sell").slice(-n)
  if (sells.length < n) return false
  return sells.every((s) => (s.total ?? 0) > 0)
}

function calcPortfolioValue(orders: Order[]): number {
  return (
    100000 +
    orders
      .filter((o) => o.side === "sell")
      .reduce((acc, o) => acc + (o.total ?? 0) - o.qty * o.price * 0.95, 0)
  )
}

function isCrypto(symbol: string): boolean {
  return (
    symbol.endsWith("-USD") ||
    ["BTC", "ETH", "SOL", "BNB", "XRP", "DOGE", "ADA", "MATIC"].some((c) =>
      symbol.startsWith(c)
    )
  )
}

function checkDayTrader(orders: Order[]): boolean {
  const byDay: Record<string, number> = {}
  orders.forEach((o) => {
    const day = o.created_at?.slice(0, 10) ?? ""
    byDay[day] = (byDay[day] ?? 0) + 1
  })
  return Object.values(byDay).some((count) => count >= 5)
}

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "")
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const context = body?.context as string | undefined

  if (!context) {
    return NextResponse.json({ error: "context required" }, { status: 400 })
  }

  const [
    { data: userAchievements },
    { data: orders },
    { data: progression },
    { count: postCount },
    { count: replyCount },
    { data: profileData },
  ] = await Promise.all([
    supabase
      .from("user_achievements")
      .select("achievement_id")
      .eq("user_id", user.id),
    supabase
      .from("orders")
      .select("symbol, side, price, qty, total, created_at")
      .eq("user_id", user.id)
      .eq("status", "filled"),
    supabase
      .from("progression")
      .select("course_id, completed")
      .eq("user_id", user.id),
    supabase
      .from("forum_posts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
    supabase
      .from("forum_replies")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
    supabase
      .from("user_profiles")
      .select("xp, streak_days")
      .eq("id", user.id)
      .single(),
  ])

  const unlockedIds = new Set(
    (userAchievements ?? []).map((a: { achievement_id: string }) => a.achievement_id)
  )
  const typedOrders: Order[] = orders ?? []
  const completedCourses = (progression ?? []).filter(
    (p: { completed: boolean }) => p.completed
  ).length
  const profile: UserProfile | null = profileData ?? null

  const checks: Partial<Record<AchievementId, () => boolean>> = {
    first_trade: () => typedOrders.length >= 1,
    profit_streak_3: () => checkProfitStreak(typedOrders, 3),
    profit_streak_5: () => checkProfitStreak(typedOrders, 5),
    first_10k: () => calcPortfolioValue(typedOrders) >= 110000,
    diversified: () => new Set(typedOrders.map((o) => o.symbol)).size >= 5,
    crypto_trader: () => typedOrders.some((o) => isCrypto(o.symbol)),
    day_trader: () => checkDayTrader(typedOrders),
    first_course: () => completedCourses >= 1,
    first_post: () => (postCount ?? 0) >= 1,
    helpful: () => (replyCount ?? 0) >= 5,
    streak_7: () => (profile?.streak_days ?? 0) >= 7,
    streak_30: () => (profile?.streak_days ?? 0) >= 30,
  }

  const newlyUnlocked: typeof ACHIEVEMENTS[number][] = []

  for (const achievement of ACHIEVEMENTS) {
    if (unlockedIds.has(achievement.id)) continue
    const check = checks[achievement.id]
    if (!check) continue
    let passes = false
    try { passes = check() } catch { passes = false }
    if (passes) newlyUnlocked.push(achievement)
  }

  if (newlyUnlocked.length === 0) {
    return NextResponse.json({ unlocked: [], total_xp_gained: 0 })
  }

  const totalXP = newlyUnlocked.reduce((sum, a) => sum + a.xp, 0)
  const now = new Date().toISOString()

  await supabase.from("user_achievements").insert(
    newlyUnlocked.map((a) => ({
      user_id: user.id,
      achievement_id: a.id,
      unlocked_at: now,
    }))
  )

  const currentXP = profile?.xp ?? 0
  const newXP = currentXP + totalXP
  const newLevel = getLevelFromXP(newXP)

  await supabase
    .from("user_profiles")
    .upsert({
      id: user.id,
      xp: newXP,
      level_name: newLevel.name,
    }, { onConflict: "id" })

  return NextResponse.json({ unlocked: newlyUnlocked, total_xp_gained: totalXP })
}
