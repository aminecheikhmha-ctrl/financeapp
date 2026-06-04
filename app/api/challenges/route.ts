export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_KEY || "placeholder"
)

type Challenge = {
  id: string
  title: string
  description: string
  type: "trading" | "learning" | "social"
  xp_reward: number
  start_date: string
  end_date: string
}

type ChallengeCompletion = {
  challenge_id: string
  completed_at: string
}

function getWeekBounds(): { start: string; end: string } {
  const now = new Date()
  const day = now.getDay()
  const diffToMonday = (day === 0 ? -6 : 1 - day)
  const monday = new Date(now)
  monday.setDate(now.getDate() + diffToMonday)
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)
  return {
    start: monday.toISOString(),
    end: sunday.toISOString(),
  }
}

export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "")
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const now = new Date().toISOString()
  const { start: weekStart } = getWeekBounds()

  const [
    { data: challenges },
    { data: completions },
    { count: ordersThisWeek },
    { count: chaptersThisWeek },
    { count: postsThisWeek },
  ] = await Promise.all([
    supabase
      .from("weekly_challenges")
      .select("id, title, description, type, xp_reward, start_date, end_date")
      .lte("start_date", now)
      .gte("end_date", now),
    supabase
      .from("challenge_completions")
      .select("challenge_id, completed_at")
      .eq("user_id", user.id),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", weekStart),
    supabase
      .from("progression")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("completed", true)
      .gte("updated_at", weekStart),
    supabase
      .from("forum_posts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", weekStart),
  ])

  const completedSet = new Set<string>(
    (completions ?? []).map((c: ChallengeCompletion) => c.challenge_id)
  )

  const targets: Record<Challenge["type"], number> = {
    trading: 3,
    learning: 2,
    social: 1,
  }

  const progressMap: Record<Challenge["type"], number> = {
    trading: ordersThisWeek ?? 0,
    learning: chaptersThisWeek ?? 0,
    social: postsThisWeek ?? 0,
  }

  const result = (challenges ?? []).map((c: Challenge) => {
    const target = targets[c.type] ?? 1
    const rawProgress = progressMap[c.type] ?? 0
    const progress = Math.min(Math.round((rawProgress / target) * 100), 100)
    return {
      ...c,
      completed: completedSet.has(c.id),
      progress,
    }
  })

  return NextResponse.json({ challenges: result })
}

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "")
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { challenge_id } = body as { challenge_id?: string }

  if (!challenge_id) {
    return NextResponse.json({ error: "challenge_id required" }, { status: 400 })
  }

  const now = new Date().toISOString()

  const { data: challenge } = await supabase
    .from("weekly_challenges")
    .select("id, type, xp_reward, start_date, end_date")
    .eq("id", challenge_id)
    .lte("start_date", now)
    .gte("end_date", now)
    .single()

  if (!challenge) {
    return NextResponse.json({ error: "Challenge not found or expired" }, { status: 404 })
  }

  const { data: existing } = await supabase
    .from("challenge_completions")
    .select("id")
    .eq("user_id", user.id)
    .eq("challenge_id", challenge_id)
    .single()

  if (existing) {
    return NextResponse.json({ error: "Already completed" }, { status: 409 })
  }

  const { start: weekStart } = getWeekBounds()
  const targets: Record<string, number> = { trading: 3, learning: 2, social: 1 }

  let metCondition = false

  if (challenge.type === "trading") {
    const { count } = await supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", weekStart)
    metCondition = (count ?? 0) >= (targets.trading ?? 3)
  } else if (challenge.type === "learning") {
    const { count } = await supabase
      .from("progression")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("completed", true)
      .gte("updated_at", weekStart)
    metCondition = (count ?? 0) >= (targets.learning ?? 2)
  } else if (challenge.type === "social") {
    const { count } = await supabase
      .from("forum_posts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", weekStart)
    metCondition = (count ?? 0) >= (targets.social ?? 1)
  }

  if (!metCondition) {
    return NextResponse.json({ error: "Conditions not met" }, { status: 422 })
  }

  await supabase.from("challenge_completions").insert({
    user_id: user.id,
    challenge_id,
    completed_at: now,
  })

  const { data: profileData } = await supabase
    .from("user_profiles")
    .select("xp")
    .eq("user_id", user.id)
    .single()

  const currentXP: number = profileData?.xp ?? 0
  const newXP = currentXP + (challenge.xp_reward ?? 0)

  await supabase
    .from("user_profiles")
    .upsert({ user_id: user.id, xp: newXP })

  return NextResponse.json({ success: true, xp_gained: challenge.xp_reward ?? 0 })
}
