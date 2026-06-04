export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { moderate } from "@/lib/moderation"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_KEY || "placeholder"
)

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

  const { post_id, content, username, avatar_color } = await req.json()
  if (!post_id || !content?.trim()) {
    return NextResponse.json({ error: "post_id and content required" }, { status: 400 })
  }

  // ── Modération ──
  const modResult = await moderate(content, "comment")

  if (!modResult.approved) {
    try {
      await supabase.from("moderation_logs").insert({
        user_id:         user.id,
        content_type:    "comment",
        content_preview: content.slice(0, 200),
        reason:          modResult.reason,
        severity:        modResult.severity,
        action:          "blocked",
      })
    } catch {}

    return NextResponse.json({
      error:     modResult.reason ?? "Ce commentaire ne respecte pas les règles du forum.",
      moderated: true,
      severity:  modResult.severity,
    }, { status: 400 })
  }

  // ── Insertion ──
  const { data, error } = await supabase.from("forum_replies").insert({
    post_id,
    user_id:      user.id,
    username:     username ?? user.email?.split("@")[0],
    avatar_color: avatar_color ?? "#4ade80",
    content:      content.trim(),
    moderated:    true,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Incrément replies_count
  const { data: p } = await supabase.from("forum_posts").select("replies_count").eq("id", post_id).single()
  await supabase.from("forum_posts").update({ replies_count: (p?.replies_count ?? 0) + 1 }).eq("id", post_id)

  return NextResponse.json({ reply: data })
}
