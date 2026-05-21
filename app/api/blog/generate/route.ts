import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import Groq from "groq-sdk"

export const runtime = "nodejs"
export const maxDuration = 60

const BLOG_ARTICLES = [
  { slug: "comment-lire-un-graphe-bourse",     title: "Comment lire un graphe boursier en 5 minutes",                category: "débutant",         featured: true },
  { slug: "rsi-indicateur-trading",             title: "Le RSI : l'indicateur que tout trader doit connaître",        category: "analyse-technique", featured: false },
  { slug: "macd-guide-complet",                 title: "MACD : Guide complet pour débutants",                         category: "analyse-technique", featured: false },
  { slug: "gestion-risque-trading",             title: "Gestion du risque : la règle des 1% qui sauve les traders",   category: "stratégie",         featured: true  },
  { slug: "bitcoin-ethereum-difference",        title: "Bitcoin vs Ethereum : quelle différence ?",                   category: "crypto",            featured: false },
  { slug: "paper-trading-guide",                title: "Paper trading : s'entraîner sans risquer son argent",         category: "débutant",          featured: false },
  { slug: "bandes-bollinger-strategie",         title: "Bandes de Bollinger : la stratégie complète",                 category: "analyse-technique", featured: false },
  { slug: "psychologie-trader-emotions",        title: "Psychologie du trader : gérer ses émotions en bourse",        category: "psychologie",       featured: false },
  { slug: "sp500-investir-guide",               title: "S&P 500 : pourquoi et comment investir ?",                    category: "actions",           featured: false },
  { slug: "nvdia-analyse-technique",            title: "NVIDIA : analyse technique complète 2026",                    category: "analyses",          featured: false },
  { slug: "ia-trading-revolution",              title: "L'IA révolutionne le trading : ce que vous devez savoir",     category: "technologie",       featured: true  },
  { slug: "defi-yield-farming-guide",           title: "DeFi et Yield Farming : guide complet pour débutants",        category: "crypto",            featured: false },
  { slug: "signaux-trading-automatiques",       title: "Signaux de trading automatiques : comment ça marche ?",       category: "stratégie",         featured: false },
  { slug: "diversification-portefeuille",       title: "Diversification : comment construire un portefeuille solide", category: "stratégie",         featured: false },
  { slug: "analyse-fondamentale-actions",       title: "Analyse fondamentale : évaluer une action comme Warren Buffett", category: "actions",        featured: false },
  { slug: "support-resistance-trading",         title: "Support et résistance : la base de l'analyse technique",      category: "analyse-technique", featured: false },
  { slug: "ethereum-merge-impact",              title: "L'impact du Merge Ethereum sur le prix de l'ETH",             category: "crypto",            featured: false },
  { slug: "fed-taux-marches-financiers",        title: "Comment la Fed influence les marchés financiers",             category: "macro",             featured: false },
  { slug: "options-trading-debutant",           title: "Options de trading : guide pour débutants",                   category: "avancé",            featured: false },
  { slug: "backtest-strategie-trading",         title: "Backtesting : tester sa stratégie avant de la déployer",      category: "stratégie",         featured: false },
]

function estimateReadingTime(text: string): number {
  return Math.max(3, Math.round(text.split(/\s+/).length / 200))
}

function generateExcerpt(content: string): string {
  const firstPara = content.split("\n\n").find(p => p.length > 80 && !p.startsWith("#")) ?? ""
  return firstPara.replace(/[#*`]/g, "").trim().slice(0, 200) + "…"
}

async function generateArticle(title: string, category: string): Promise<string> {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! })
  const chat = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      {
        role: "system",
        content: `Tu es un expert en trading et finance qui rédige des articles de blog professionnels en français pour FinanceApp.
Tes articles sont clairs, structurés, pratiques et accessibles.
Utilise le markdown avec des titres (##, ###), des listes, et du **gras** pour les termes importants.
Rédige entre 800 et 1200 mots. Inclus toujours : une introduction, 3-5 sections, une conclusion avec un appel à l'action.`
      },
      {
        role: "user",
        content: `Rédige un article de blog complet sur : "${title}"
Catégorie : ${category}
Format : Markdown structuré, 800-1200 mots, en français.
Inclure : définitions claires, exemples concrets, conseils pratiques, avertissement sur les risques.`
      }
    ],
    temperature: 0.7,
    max_tokens: 2000,
  })
  return chat.choices[0]?.message?.content ?? `# ${title}\n\nContenu en cours de génération…`
}

function makeSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

// POST /api/blog/generate — generate all missing articles (protected by CRON_SECRET)
// POST /api/blog/generate { slug } — generate one specific article
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = makeSupabase()
  let body: any = {}
  try { body = await req.json() } catch {}

  const targetSlug: string | null = body.slug ?? null

  const articles = targetSlug
    ? BLOG_ARTICLES.filter(a => a.slug === targetSlug)
    : BLOG_ARTICLES

  if (articles.length === 0) {
    return NextResponse.json({ error: "Article introuvable" }, { status: 404 })
  }

  const results: { slug: string; status: string }[] = []

  for (const article of articles) {
    // Check if already exists
    const { data: existing } = await supabase
      .from("blog_posts")
      .select("slug")
      .eq("slug", article.slug)
      .single()

    if (existing) {
      results.push({ slug: article.slug, status: "already_exists" })
      continue
    }

    try {
      const content = await generateArticle(article.title, article.category)
      const excerpt = generateExcerpt(content)
      const readingTime = estimateReadingTime(content)

      const { error } = await supabase.from("blog_posts").insert({
        slug: article.slug,
        title: article.title,
        excerpt,
        content,
        category: article.category,
        tags: [article.category, "trading", "finance"],
        reading_time: readingTime,
        published: true,
        featured: article.featured,
      })

      if (error) {
        console.error(`[blog/generate] insert error for ${article.slug}:`, error)
        results.push({ slug: article.slug, status: `error: ${error.message}` })
      } else {
        results.push({ slug: article.slug, status: "generated" })
      }
    } catch (e: any) {
      console.error(`[blog/generate] generation error for ${article.slug}:`, e)
      results.push({ slug: article.slug, status: `error: ${e.message}` })
    }
  }

  return NextResponse.json({ results })
}

// GET /api/blog/generate?slug=xxx — auto-generate on first access if missing
export async function GET(req: NextRequest) {
  const slug = new URL(req.url).searchParams.get("slug")
  if (!slug) return NextResponse.json({ error: "slug requis" }, { status: 400 })

  const article = BLOG_ARTICLES.find(a => a.slug === slug)
  if (!article) return NextResponse.json({ error: "Article introuvable" }, { status: 404 })

  const supabase = makeSupabase()
  const { data: existing } = await supabase
    .from("blog_posts").select("*").eq("slug", slug).single()
  if (existing) return NextResponse.json({ post: existing })

  try {
    const content  = await generateArticle(article.title, article.category)
    const excerpt  = generateExcerpt(content)
    const readingTime = estimateReadingTime(content)

    const { data, error } = await supabase.from("blog_posts").insert({
      slug: article.slug,
      title: article.title,
      excerpt,
      content,
      category: article.category,
      tags: [article.category, "trading", "finance"],
      reading_time: readingTime,
      published: true,
      featured: article.featured,
    }).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ post: data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export const ARTICLES_SEED = BLOG_ARTICLES
