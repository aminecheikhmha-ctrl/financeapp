import { MetadataRoute } from "next"
import { createClient } from "@supabase/supabase-js"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://financeapp-kappa-six.vercel.app"

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )

  const { data: posts } = await supabase
    .from("blog_posts")
    .select("slug, updated_at")
    .eq("published", true)

  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl,                        lastModified: new Date(), priority: 1.0, changeFrequency: "daily"   },
    { url: `${baseUrl}/blog`,              lastModified: new Date(), priority: 0.9, changeFrequency: "daily"   },
    { url: `${baseUrl}/pricing`,           lastModified: new Date(), priority: 0.8, changeFrequency: "weekly"  },
    { url: `${baseUrl}/apprendre`,         lastModified: new Date(), priority: 0.8, changeFrequency: "weekly"  },
    { url: `${baseUrl}/signaux`,           lastModified: new Date(), priority: 0.7, changeFrequency: "hourly"  },
    { url: `${baseUrl}/analyses`,          lastModified: new Date(), priority: 0.7, changeFrequency: "daily"   },
    { url: `${baseUrl}/signup`,            lastModified: new Date(), priority: 0.6, changeFrequency: "monthly" },
    { url: `${baseUrl}/login`,             lastModified: new Date(), priority: 0.5, changeFrequency: "monthly" },
  ]

  const blogPages: MetadataRoute.Sitemap = (posts ?? []).map(post => ({
    url: `${baseUrl}/blog/${post.slug}`,
    lastModified: new Date(post.updated_at ?? new Date()),
    priority: 0.7,
    changeFrequency: "monthly" as const,
  }))

  return [...staticPages, ...blogPages]
}
