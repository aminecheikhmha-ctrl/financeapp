import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const token = req.headers.get("authorization")?.replace("Bearer ", "")
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Toggle like on reply
  const { data: existing } = await supabase
    .from("forum_likes")
    .select("id")
    .eq("user_id", user.id)
    .eq("reply_id", id)
    .single()

  if (existing) {
    await supabase.from("forum_likes").delete().eq("id", existing.id)
    const { data: r } = await supabase.from("forum_replies").select("likes").eq("id", id).single()
    await supabase.from("forum_replies").update({ likes: Math.max(0, (r?.likes ?? 1) - 1) }).eq("id", id)
    return NextResponse.json({ liked: false })
  } else {
    await supabase.from("forum_likes").insert({ user_id: user.id, reply_id: id })
    const { data: r } = await supabase.from("forum_replies").select("likes").eq("id", id).single()
    await supabase.from("forum_replies").update({ likes: (r?.likes ?? 0) + 1 }).eq("id", id)
    return NextResponse.json({ liked: true })
  }
}
