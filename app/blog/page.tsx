import type { Metadata } from "next"
import { createClient } from "@supabase/supabase-js"
import BlogPageClient from "./BlogPageClient"

export const metadata: Metadata = {
  title: "Blog FinanceApp — Apprendre à trader",
  description: "Articles, guides et analyses pour apprendre le trading, l'analyse technique, la crypto et les stratégies d'investissement.",
  keywords: ["trading", "blog", "analyse technique", "RSI", "MACD", "crypto", "bourse", "investissement", "stratégie"],
  openGraph: {
    title: "Blog FinanceApp — Apprendre à trader",
    description: "Articles, guides et analyses pour apprendre le trading.",
    url: "https://financeapp-kappa-six.vercel.app/blog",
    images: [{ url: "/api/og?title=Blog+FinanceApp+%E2%80%94+Apprendre+%C3%A0+trader&category=trading", width: 1200, height: 630 }],
  },
}

export const revalidate = 3600

async function getPosts() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    )
    const { data } = await supabase
      .from("blog_posts")
      .select("id,slug,title,excerpt,category,tags,reading_time,featured,created_at")
      .eq("published", true)
      .order("created_at", { ascending: false })
      .limit(40)
    return data ?? []
  } catch {
    return []
  }
}

export default async function BlogPage() {
  const posts = await getPosts()
  return <BlogPageClient initialPosts={posts} />
}
