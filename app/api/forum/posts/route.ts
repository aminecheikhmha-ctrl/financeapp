import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export async function GET(req: NextRequest) {
  const category = req.nextUrl.searchParams.get("category")
  const sort = req.nextUrl.searchParams.get("sort") ?? "recent"
  const search = req.nextUrl.searchParams.get("search") ?? ""

  let query = supabase
    .from("forum_posts")
    .select("id, user_id, username, avatar_color, title, content, category, symbol, likes, views, replies_count, pinned, created_at")

  if (category && category !== "all") query = query.eq("category", category)
  if (search) query = query.ilike("title", `%${search}%`)

  if (sort === "popular") query = query.order("likes", { ascending: false })
  else if (sort === "replies") query = query.order("replies_count", { ascending: false })
  else query = query.order("pinned", { ascending: false }).order("created_at", { ascending: false })

  const { data, error } = await query.limit(50)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ posts: data ?? [] })
}

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "")
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { title, content, category, symbol, username, avatar_color } = await req.json()
  if (!title?.trim() || !content?.trim() || !category) {
    return NextResponse.json({ error: "title, content, category required" }, { status: 400 })
  }

  const { data, error } = await supabase.from("forum_posts").insert({
    user_id: user.id,
    username: username ?? user.email?.split("@")[0],
    avatar_color: avatar_color ?? "#4ade80",
    title: title.trim(),
    content: content.trim(),
    category,
    symbol: symbol?.toUpperCase() ?? null,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ post: data })
}
