import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"
export const revalidate = 3600

function makeSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.SUPABASE_SERVICE_KEY || 'placeholder'
  )
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const category = searchParams.get("category")
  const slug     = searchParams.get("slug")
  const featured = searchParams.get("featured")
  const limit    = parseInt(searchParams.get("limit") ?? "20")

  const supabase = makeSupabase()
  let query = supabase
    .from("blog_posts")
    .select("id,slug,title,excerpt,category,tags,reading_time,featured,created_at,updated_at")
    .eq("published", true)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (slug)     query = supabase.from("blog_posts").select("*").eq("slug", slug).eq("published", true).limit(1)
  if (category) query = (query as any).eq("category", category)
  if (featured) query = (query as any).eq("featured", true)

  const { data, error } = await query
  if (error) {
    console.error("[blog/posts GET] error:", error)
    return NextResponse.json({ posts: [] })
  }
  if (slug) return NextResponse.json({ post: data?.[0] ?? null })
  return NextResponse.json({ posts: data ?? [] })
}
