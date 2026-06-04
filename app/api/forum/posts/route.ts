export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { moderate } from "@/lib/moderation"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_KEY || "placeholder"
)

export async function GET(req: NextRequest) {
  const category = req.nextUrl.searchParams.get("category")
  const sort     = req.nextUrl.searchParams.get("sort") ?? "recent"
  const search   = req.nextUrl.searchParams.get("search") ?? ""

  let query = supabase
    .from("forum_posts")
    .select("id, user_id, username, avatar_color, title, content, category, symbol, likes, views, replies_count, pinned, created_at")

  if (category && category !== "all") query = query.eq("category", category)
  if (search) query = query.ilike("title", `%${search}%`)

  if (sort === "popular")      query = query.order("likes",         { ascending: false })
  else if (sort === "replies") query = query.order("replies_count", { ascending: false })
  else                         query = query.order("pinned", { ascending: false }).order("created_at", { ascending: false })

  const { data, error } = await query.limit(50)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ posts: data ?? [] })
}

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "")
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // ── Vérifie si l'utilisateur est banni ──
  const { data: profile } = await supabase
    .from("profiles")
    .select("banned")
    .eq("id", user.id)
    .single()

  if (profile?.banned) {
    return NextResponse.json({
      error: "Ton compte a été suspendu suite à des violations répétées des règles du forum.",
      banned: true,
    }, { status: 403 })
  }

  const { title, content, category, symbol, username, avatar_color } = await req.json()
  if (!title?.trim() || !content?.trim() || !category) {
    return NextResponse.json({ error: "title, content, category required" }, { status: 400 })
  }

  // ── Modération ──
  const modResult = await moderate(`${title} ${content}`, "post")

  if (!modResult.approved) {
    // Log la tentative
    try {
      await supabase.from("moderation_logs").insert({
        user_id:         user.id,
        content_type:    "post",
        content_preview: `${title} ${content}`.slice(0, 200),
        reason:          modResult.reason,
        severity:        modResult.severity,
        action:          "blocked",
      })
    } catch {}

    return NextResponse.json({
      error:     modResult.reason ?? "Ce contenu ne respecte pas les règles du forum.",
      moderated: true,
      severity:  modResult.severity,
    }, { status: 400 })
  }

  // ── Insertion ──
  const { data, error } = await supabase.from("forum_posts").insert({
    user_id:      user.id,
    username:     username ?? user.email?.split("@")[0],
    avatar_color: avatar_color ?? "#4ade80",
    title:        title.trim(),
    content:      content.trim(),
    category,
    symbol:       symbol?.toUpperCase() ?? null,
    moderated:    true,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ post: data })
}
