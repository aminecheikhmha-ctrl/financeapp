import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "")
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { post_id, content, username, avatar_color } = await req.json()
  if (!post_id || !content?.trim()) {
    return NextResponse.json({ error: "post_id and content required" }, { status: 400 })
  }

  const { data, error } = await supabase.from("forum_replies").insert({
    post_id,
    user_id: user.id,
    username: username ?? user.email?.split("@")[0],
    avatar_color: avatar_color ?? "#4ade80",
    content: content.trim(),
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Increment replies_count
  const { data: p } = await supabase.from("forum_posts").select("replies_count").eq("id", post_id).single()
  await supabase.from("forum_posts").update({ replies_count: (p?.replies_count ?? 0) + 1 }).eq("id", post_id)

  return NextResponse.json({ reply: data })
}
