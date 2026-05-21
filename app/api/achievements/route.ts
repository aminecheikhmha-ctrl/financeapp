import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { ACHIEVEMENTS, getLevelFromXP } from "@/lib/achievements"

export const runtime = "nodejs"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "")

  if (!token) {
    const achievements = ACHIEVEMENTS.map((a) => ({
      ...a,
      unlocked: false,
      unlocked_at: undefined,
    }))
    return NextResponse.json({
      achievements,
      xp: 0,
      level: getLevelFromXP(0),
    })
  }

  const { data: { user } } = await supabase.auth.getUser(token)

  if (!user) {
    const achievements = ACHIEVEMENTS.map((a) => ({
      ...a,
      unlocked: false,
      unlocked_at: undefined,
    }))
    return NextResponse.json({
      achievements,
      xp: 0,
      level: getLevelFromXP(0),
    })
  }

  const [{ data: userAchievements }, { data: profileData }] = await Promise.all([
    supabase
      .from("user_achievements")
      .select("achievement_id, unlocked_at")
      .eq("user_id", user.id),
    supabase
      .from("user_profiles")
      .select("xp")
      .eq("user_id", user.id)
      .single(),
  ])

  const unlockedMap = new Map<string, string>(
    (userAchievements ?? []).map(
      (a: { achievement_id: string; unlocked_at: string }) => [
        a.achievement_id,
        a.unlocked_at,
      ]
    )
  )

  const xp: number = profileData?.xp ?? 0

  const achievements = ACHIEVEMENTS.map((a) => ({
    ...a,
    unlocked: unlockedMap.has(a.id),
    unlocked_at: unlockedMap.get(a.id),
  }))

  return NextResponse.json({
    achievements,
    xp,
    level: getLevelFromXP(xp),
  })
}
