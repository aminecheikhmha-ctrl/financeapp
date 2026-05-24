import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"

const ADMIN_EMAIL = "amine_cm@icloud.com"

function makeSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)
}

async function checkAdmin(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "")
  if (!token) return null
  const supabase = makeSupabase()
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user || user.email !== ADMIN_EMAIL) return null
  return user
}

// GET — list all forum posts for moderation
export async function GET(req: NextRequest) {
  if (!await checkAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const supabase = makeSupabase()
  const { data, error } = await supabase
    .from("forum_posts")
    .select("id, user_id, username, title, content, category, symbol, likes, views, replies_count, pinned, created_at")
    .order("created_at", { ascending: false })
    .limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ posts: data ?? [] })
}

// PATCH — update a post (pin/unpin, edit title/content)
export async function PATCH(req: NextRequest) {
  if (!await checkAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id, pinned, title, content } = await req.json()
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })

  const supabase = makeSupabase()
  const updates: Record<string, any> = {}
  if (pinned !== undefined) updates.pinned = pinned
  if (title !== undefined) updates.title = title
  if (content !== undefined) updates.content = content

  const { error } = await supabase.from("forum_posts").update(updates).eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// DELETE — remove a post
export async function DELETE(req: NextRequest) {
  if (!await checkAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })

  const supabase = makeSupabase()
  // Also delete replies
  await supabase.from("forum_replies").delete().eq("post_id", id)
  const { error } = await supabase.from("forum_posts").delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
