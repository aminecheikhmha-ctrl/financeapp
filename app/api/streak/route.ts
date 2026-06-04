export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_KEY || "placeholder"
)

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "")
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("streak_days, last_login")
    .eq("id", user.id)
    .single()

  const today = new Date().toISOString().slice(0, 10)
  const lastLogin = profile?.last_login ?? null

  if (lastLogin === today) {
    return NextResponse.json({ streak_days: profile?.streak_days ?? 1 })
  }

  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().slice(0, 10)

  const currentStreak = profile?.streak_days ?? 0
  // If no last_login recorded yet, keep existing streak and just set today's date
  const newStreak = lastLogin === null
    ? (currentStreak > 0 ? currentStreak : 1)
    : lastLogin === yesterdayStr
    ? currentStreak + 1
    : 1

  await supabase
    .from("user_profiles")
    .upsert({ id: user.id, streak_days: newStreak, last_login: today }, { onConflict: "id" })

  return NextResponse.json({ streak_days: newStreak })
}
