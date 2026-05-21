import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"

export type NewsArticle = {
  title: string
  source: string
  url: string
  published_at: string
  reddit_score?: number
  reddit_comments?: number
}

// ── In-memory cache (10 min) ──────────────────────────────────────────────────
const cache = new Map<string, { data: { articles: NewsArticle[]; last_updated: string }; ts: number }>()
const CACHE_TTL = 10 * 60 * 1000

// ── Yahoo Finance RSS ─────────────────────────────────────────────────────────
async function fetchYahooRSS(symbol: string): Promise<NewsArticle[]> {
  const clean = symbol.replace("-USD", "").replace("-", "")
  const url = `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${clean}&region=US&lang=en-US`
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(6000),
    })
    if (!res.ok) return []
    const xml = await res.text()
    const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? []
    return items.slice(0, 10).map(item => {
      const title = (item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) ?? item.match(/<title>(.*?)<\/title>/))?.[1] ?? ""
      const link  = (item.match(/<link>(.*?)<\/link>/))?.[1] ?? ""
      const pubDate = (item.match(/<pubDate>(.*?)<\/pubDate>/))?.[1] ?? ""
      return {
        title: title.trim(),
        source: "Yahoo Finance",
        url: link.trim(),
        published_at: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
      }
    }).filter(a => a.title.length > 5)
  } catch {
    return []
  }
}

// ── Finnhub (optional — requires FINNHUB_API_KEY) ─────────────────────────────
async function fetchFinnhub(symbol: string): Promise<NewsArticle[]> {
  const key = process.env.FINNHUB_API_KEY
  if (!key) return []
  const clean = symbol.replace("-USD", "")
  const from  = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  const to    = new Date().toISOString().split("T")[0]
  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/company-news?symbol=${clean}&from=${from}&to=${to}&token=${key}`,
      { signal: AbortSignal.timeout(5000) }
    )
    if (!res.ok) return []
    const data = await res.json()
    return (Array.isArray(data) ? data : []).slice(0, 8).map((item: any) => ({
      title: item.headline ?? "",
      source: "Finnhub",
      url: item.url ?? "",
      published_at: item.datetime ? new Date(item.datetime * 1000).toISOString() : new Date().toISOString(),
    })).filter((a: NewsArticle) => a.title.length > 5)
  } catch {
    return []
  }
}

// ── Reddit ────────────────────────────────────────────────────────────────────
const REDDIT_SUBS = ["wallstreetbets", "investing", "stocks", "CryptoCurrency"]

async function fetchReddit(symbol: string): Promise<NewsArticle[]> {
  const clean  = symbol.replace("-USD", "").toUpperCase()
  const search = clean.toLowerCase()
  const results: NewsArticle[] = []

  for (const sub of REDDIT_SUBS.slice(0, 2)) {
    try {
      const res = await fetch(
        `https://www.reddit.com/r/${sub}/search.json?q=${encodeURIComponent(clean)}&sort=hot&limit=10&t=week&restrict_sr=1`,
        {
          headers: { "User-Agent": "FinanceApp/1.0" },
          signal: AbortSignal.timeout(5000),
        }
      )
      if (!res.ok) continue
      const data = await res.json()
      const posts = data?.data?.children ?? []
      for (const post of posts) {
        const p = post.data
        const titleLower = (p.title ?? "").toLowerCase()
        if (!titleLower.includes(search) && !titleLower.includes(clean.toLowerCase())) continue
        results.push({
          title: p.title ?? "",
          source: `Reddit r/${sub}`,
          url: `https://reddit.com${p.permalink}`,
          published_at: new Date((p.created_utc ?? Date.now() / 1000) * 1000).toISOString(),
          reddit_score: p.score ?? 0,
          reddit_comments: p.num_comments ?? 0,
        })
      }
    } catch {
      continue
    }
  }
  return results.slice(0, 8)
}

// ── Deduplicate by similar title ──────────────────────────────────────────────
function deduplicate(articles: NewsArticle[]): NewsArticle[] {
  const seen = new Set<string>()
  return articles.filter(a => {
    if (!a.title) return false
    const key = a.title.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 40)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// ── Route ─────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const symbol = new URL(req.url).searchParams.get("symbol") ?? "AAPL"
  const limit  = parseInt(new URL(req.url).searchParams.get("limit") ?? "20")

  const cached = cache.get(symbol)
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json(cached.data)
  }

  const [yahoo, finnhub, reddit] = await Promise.all([
    fetchYahooRSS(symbol),
    fetchFinnhub(symbol),
    fetchReddit(symbol),
  ])

  const all = deduplicate([...yahoo, ...finnhub, ...reddit])
    .sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime())
    .slice(0, limit)

  const result = { articles: all, last_updated: new Date().toISOString() }
  cache.set(symbol, { data: result, ts: Date.now() })
  return NextResponse.json(result)
}
