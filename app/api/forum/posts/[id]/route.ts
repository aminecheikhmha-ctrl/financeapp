import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import Groq from "groq-sdk"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  // Increment views (best-effort, ignore errors)
  const { data: pv } = await supabase.from("forum_posts").select("views").eq("id", id).single()
  if (pv) await supabase.from("forum_posts").update({ views: (pv.views ?? 0) + 1 }).eq("id", id)

  const [{ data: post }, { data: replies }] = await Promise.all([
    supabase
      .from("forum_posts")
      .select("*")
      .eq("id", id)
      .single(),
    supabase
      .from("forum_replies")
      .select("id, user_id, username, avatar_color, content, likes, is_best, created_at")
      .eq("post_id", id)
      .order("is_best", { ascending: false })
      .order("likes", { ascending: false })
      .order("created_at", { ascending: true }),
  ])

  if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 })
  return NextResponse.json({ post, replies: replies ?? [] })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const token = req.headers.get("authorization")?.replace("Bearer ", "")
  const body = await req.json()

  // AI analysis — no auth required
  if (body.action === "ai_analysis") {
    const { data: post } = await supabase.from("forum_posts").select("title, content, symbol").eq("id", id).single()
    if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 })

    try {
      const completion = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        max_tokens: 600,
        temperature: 0.3,
        messages: [{
          role: "user",
          content: `Tu es un analyste financier expert. Analyse ce post de forum de trading et donne une réponse professionnelle concise (200-300 mots max).

Titre: ${post.title}
Contenu: ${post.content}
${post.symbol ? `Actif mentionné: ${post.symbol}` : ""}

Réponds en français avec:
- Une analyse factuelle de la situation/question posée
- Des données de marché pertinentes si applicable
- Ta perspective professionnelle
- 1-2 points d'attention importants

Sois direct et professionnel, pas de blabla.`,
        }],
      })
      const analysis = completion.choices[0]?.message?.content ?? ""
      return NextResponse.json({ analysis })
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  // Like post — requires auth
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Toggle like
  const { data: existing } = await supabase
    .from("forum_likes")
    .select("id")
    .eq("user_id", user.id)
    .eq("post_id", id)
    .is("reply_id", null)
    .single()

  if (existing) {
    await supabase.from("forum_likes").delete().eq("id", existing.id)
    await supabase.from("forum_posts").update({ likes: supabase.rpc("decrement", { x: 1 }) as any }).eq("id", id)
    // Simple decrement via raw update
    const { data: p } = await supabase.from("forum_posts").select("likes").eq("id", id).single()
    await supabase.from("forum_posts").update({ likes: Math.max(0, (p?.likes ?? 1) - 1) }).eq("id", id)
    return NextResponse.json({ liked: false })
  } else {
    await supabase.from("forum_likes").insert({ user_id: user.id, post_id: id })
    const { data: p } = await supabase.from("forum_posts").select("likes").eq("id", id).single()
    await supabase.from("forum_posts").update({ likes: (p?.likes ?? 0) + 1 }).eq("id", id)
    return NextResponse.json({ liked: true })
  }
}
