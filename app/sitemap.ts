import { MetadataRoute } from "next"
import { createClient } from "@supabase/supabase-js"
import { COURSES } from "@/lib/courses"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://tradex-kappa-six.vercel.app"

  const staticPages: MetadataRoute.Sitemap = [
    { url: base,                    lastModified: new Date(), priority: 1.0, changeFrequency: "daily"   },
    { url: `${base}/pricing`,       lastModified: new Date(), priority: 0.9, changeFrequency: "weekly"  },
    { url: `${base}/blog`,          lastModified: new Date(), priority: 0.85, changeFrequency: "daily"  },
    { url: `${base}/apprendre`,     lastModified: new Date(), priority: 0.8, changeFrequency: "weekly"  },
    { url: `${base}/signaux`,       lastModified: new Date(), priority: 0.75, changeFrequency: "hourly" },
    { url: `${base}/analyses`,      lastModified: new Date(), priority: 0.7, changeFrequency: "daily"   },
    { url: `${base}/signup`,        lastModified: new Date(), priority: 0.65, changeFrequency: "monthly"},
    { url: `${base}/login`,         lastModified: new Date(), priority: 0.5, changeFrequency: "monthly" },
  ]

  const coursePages: MetadataRoute.Sitemap = COURSES.map(course => ({
    url: `${base}/apprendre/${course.id}`,
    priority: 0.7,
    changeFrequency: "monthly" as const,
  }))

  let blogPages: MetadataRoute.Sitemap = []
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    )
    const { data: posts } = await supabase
      .from("blog_posts")
      .select("slug, updated_at")
      .eq("published", true)

    blogPages = (posts ?? []).map(post => ({
      url: `${base}/blog/${post.slug}`,
      lastModified: new Date(post.updated_at ?? new Date()),
      priority: 0.7,
      changeFrequency: "monthly" as const,
    }))
  } catch {}

  return [...staticPages, ...coursePages, ...blogPages]
}
