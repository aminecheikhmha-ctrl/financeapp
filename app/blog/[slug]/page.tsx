import type { Metadata } from "next"
import { createClient } from "@supabase/supabase-js"
import { notFound } from "next/navigation"
import ArticleClient from "./ArticleClient"

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://tradex-kappa-six.vercel.app"

function makeSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

// All known slugs for SSG
const KNOWN_SLUGS = [
  "comment-lire-un-graphe-bourse","rsi-indicateur-trading","macd-guide-complet",
  "gestion-risque-trading","bitcoin-ethereum-difference","paper-trading-guide",
  "bandes-bollinger-strategie","psychologie-trader-emotions","sp500-investir-guide",
  "nvdia-analyse-technique","ia-trading-revolution","defi-yield-farming-guide",
  "signaux-trading-automatiques","diversification-portefeuille","analyse-fondamentale-actions",
  "support-resistance-trading","ethereum-merge-impact","fed-taux-marches-financiers",
  "options-trading-debutant","backtest-strategie-trading",
]

export async function generateStaticParams() {
  return KNOWN_SLUGS.map(slug => ({ slug }))
}

export const revalidate = 3600

async function getPost(slug: string) {
  try {
    const supabase = makeSupabase()
    const { data } = await supabase
      .from("blog_posts")
      .select("*")
      .eq("slug", slug)
      .eq("published", true)
      .single()
    if (data) return data

    // Auto-generate if not in DB yet
    const res = await fetch(`${BASE_URL}/api/blog/generate?slug=${slug}`, {
      next: { revalidate: 0 }
    })
    if (res.ok) {
      const json = await res.json()
      return json.post ?? null
    }
    return null
  } catch {
    return null
  }
}

async function getSimilarPosts(category: string, excludeSlug: string) {
  try {
    const supabase = makeSupabase()
    const { data } = await supabase
      .from("blog_posts")
      .select("id,slug,title,category,reading_time,created_at")
      .eq("published", true)
      .eq("category", category)
      .neq("slug", excludeSlug)
      .limit(3)
    return data ?? []
  } catch {
    return []
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const post = await getPost(slug)
  if (!post) return { title: "Article introuvable | TradEx" }

  const ogUrl = `${BASE_URL}/api/og?title=${encodeURIComponent(post.title)}&category=${encodeURIComponent(post.category)}`

  return {
    title: `${post.title} | TradEx Blog`,
    description: post.excerpt,
    keywords: [...(post.tags ?? []), "trading", "bourse", "finance", post.category],
    openGraph: {
      title: post.title,
      description: post.excerpt,
      url: `${BASE_URL}/blog/${post.slug}`,
      type: "article",
      publishedTime: post.created_at,
      modifiedTime: post.updated_at,
      images: [{ url: ogUrl, width: 1200, height: 630, alt: post.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.excerpt,
      images: [ogUrl],
    },
  }
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = await getPost(slug)
  if (!post) notFound()

  const similar = await getSimilarPosts(post.category, post.slug)

  // Schema.org Article JSON-LD
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt,
    datePublished: post.created_at,
    dateModified: post.updated_at ?? post.created_at,
    publisher: {
      "@type": "Organization",
      name: "TradEx",
      url: BASE_URL,
      logo: { "@type": "ImageObject", url: `${BASE_URL}/icon-192.png` },
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": `${BASE_URL}/blog/${post.slug}` },
    image: `${BASE_URL}/api/og?title=${encodeURIComponent(post.title)}&category=${encodeURIComponent(post.category)}`,
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ArticleClient post={post} similar={similar} baseUrl={BASE_URL} />
    </>
  )
}
