import type { MetadataRoute } from "next"
import { createClient } from "@supabase/supabase-js"

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://financeapp-kappa-six.vercel.app"

async function getAllBlogPosts() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    )
    const { data } = await supabase
      .from("blog_posts")
      .select("slug,updated_at,created_at")
      .eq("published", true)
      .order("created_at", { ascending: false })
    return data ?? []
  } catch {
    return []
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await getAllBlogPosts()

  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE_URL,                    lastModified: new Date(), changeFrequency: "daily",   priority: 1   },
    { url: `${BASE_URL}/pricing`,       lastModified: new Date(), changeFrequency: "weekly",  priority: 0.9 },
    { url: `${BASE_URL}/blog`,          lastModified: new Date(), changeFrequency: "daily",   priority: 0.9 },
    { url: `${BASE_URL}/signup`,        lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE_URL}/login`,         lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/preuves`,       lastModified: new Date(), changeFrequency: "weekly",  priority: 0.6 },
  ]

  const blogPages: MetadataRoute.Sitemap = posts.map(p => ({
    url: `${BASE_URL}/blog/${p.slug}`,
    lastModified: new Date(p.updated_at ?? p.created_at),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }))

  return [...staticPages, ...blogPages]
}
