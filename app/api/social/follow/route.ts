import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "")
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const [{ data: following }, { data: followers }] = await Promise.all([
    supabase
      .from("user_follows")
      .select("following_id, copy_trades, copy_amount_pct, created_at, user_profiles!user_follows_following_id_fkey(username, avatar_color, xp)")
      .eq("follower_id", user.id),
    supabase
      .from("user_follows")
      .select("follower_id, created_at, user_profiles!user_follows_follower_id_fkey(username, avatar_color, xp)")
      .eq("following_id", user.id),
  ])

  return NextResponse.json({
    following: following ?? [],
    followers: followers ?? [],
  })
}

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "")
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { following_id, copy_trades, copy_amount_pct } = body as {
    following_id?: string
    copy_trades?: boolean
    copy_amount_pct?: number
  }

  if (!following_id) {
    return NextResponse.json({ error: "following_id required" }, { status: 400 })
  }

  if (following_id === user.id) {
    return NextResponse.json({ error: "Cannot follow yourself" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("user_follows")
    .upsert({
      follower_id: user.id,
      following_id,
      copy_trades: copy_trades ?? false,
      copy_amount_pct: copy_amount_pct ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ follow: data })
}

export async function DELETE(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "")
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const following_id = req.nextUrl.searchParams.get("following_id")
  if (!following_id) {
    return NextResponse.json({ error: "following_id required" }, { status: 400 })
  }

  const { error } = await supabase
    .from("user_follows")
    .delete()
    .eq("follower_id", user.id)
    .eq("following_id", following_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
