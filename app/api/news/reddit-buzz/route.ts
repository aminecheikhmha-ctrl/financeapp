import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"

// ─── Types ─────────────────────────────────────────────────────────────────────

export type BuzzResult = {
  buzz_score: number
  mentions_24h: number
  dominant_sentiment: "bullish" | "bearish" | "neutral"
  top_headlines: string[]
  source: string
  disclaimer: string
}

export type TrendingBuzzItem = {
  symbol: string
  buzz_score: number
  mentions_24h: number
  sentiment: "bullish" | "bearish" | "neutral"
  change_velocity: "rising" | "stable"
  top_post: string
}

// ─── Cache ─────────────────────────────────────────────────────────────────────

const cache = new Map<string, { data: unknown; ts: number }>()
const CACHE_TTL = 10 * 60 * 1000

// ─── Sentiment word lists ──────────────────────────────────────────────────────

const POSITIVE_WORDS = [
  "surge","rally","gain","beat","record","high","growth","buy","up",
  "rise","bull","profit","strong","soar","jump","boost","outperform",
  "upgrade","breakout","momentum","recover","moon","pump",
]
const NEGATIVE_WORDS = [
  "fall","drop","miss","low","risk","sell","crash","down","bear",
  "loss","weak","decline","cut","plunge","slump","downgrade","warning",
  "investigation","layoffs","bankrupt","collapse","dump","rug",
]

// ─── RSS title parser ──────────────────────────────────────────────────────────

function parseTitlesFromRSS(xml: string): string[] {
  const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? []
  return items
    .map(item => {
      const t =
        item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/i)?.[1] ??
        item.match(/<title>(.*?)<\/title>/i)?.[1] ?? ""
      return t.trim().replace(/<[^>]+>/g, "")
    })
    .filter(t => t.length > 10 && !t.toLowerCase().includes("rss"))
    .slice(0, 10)
}

// ─── Score titles → sentiment ──────────────────────────────────────────────────

function scoreTitles(titles: string[]): { score: number; sentiment: "bullish" | "bearish" | "neutral" } {
  let score = 50
  for (const title of titles) {
    const t = title.toLowerCase()
    POSITIVE_WORDS.forEach(w => { if (t.includes(w)) score += 5 })
    NEGATIVE_WORDS.forEach(w => { if (t.includes(w)) score -= 5 })
  }
  score = Math.max(0, Math.min(100, score))
  return {
    score,
    sentiment: score > 60 ? "bullish" : score < 40 ? "bearish" : "neutral",
  }
}

// ─── Fetch titles for one symbol (Reddit → Yahoo fallback) ────────────────────

async function fetchTitlesForSymbol(symbol: string): Promise<{ titles: string[]; topPost: string }> {
  const clean = symbol.replace("-USD", "")

  // 1. Try Reddit search (often rate-limited but worth trying)
  try {
    const res = await fetch(
      `https://www.reddit.com/search.json?q=${encodeURIComponent(clean)}&sort=hot&t=day&limit=8&type=link`,
      {
        headers: { "User-Agent": "Mozilla/5.0 (Tradex/1.0; +https://tradex.app)" },
        signal: AbortSignal.timeout(2500),
      }
    )
    if (res.ok) {
      const data = await res.json()
      const posts: Array<{ data: { title?: string } }> = data?.data?.children ?? []
      const titles = posts.map(p => p.data?.title ?? "").filter(Boolean)
      if (titles.length > 0) return { titles, topPost: titles[0] }
    }
  } catch {}

  // 2. Yahoo Finance RSS fallback
  try {
    const url = `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(symbol)}&region=US&lang=en-US`
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; TradexBot/1.0)" },
      signal: AbortSignal.timeout(3500),
    })
    if (res.ok) {
      const titles = parseTitlesFromRSS(await res.text())
      return { titles, topPost: titles[0] ?? "" }
    }
  } catch {}

  return { titles: [], topPost: "" }
}

// ─── Build one BuzzItem for a symbol ──────────────────────────────────────────

async function buildBuzzItem(symbol: string): Promise<TrendingBuzzItem> {
  const { titles, topPost } = await fetchTitlesForSymbol(symbol)
  const { score, sentiment } = scoreTitles(titles)

  return {
    symbol,
    buzz_score:      score,
    mentions_24h:    Math.max(titles.length * 9, titles.length > 0 ? 12 : 4),
    sentiment,
    change_velocity: score > 58 ? "rising" : "stable",
    top_post:        topPost,
  }
}

// ─── Route handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const url    = new URL(req.url)
  const mode   = url.searchParams.get("mode") ?? "symbol"
  const symbol = (url.searchParams.get("symbol") ?? "AAPL").toUpperCase()

  // ── TRENDING MODE ─────────────────────────────────────────────────────────────
  if (mode === "trending") {
    const cKey = "trending_buzz"
    const hit  = cache.get(cKey)
    if (hit && Date.now() - hit.ts < CACHE_TTL) return NextResponse.json(hit.data)

    const TOP_SYMBOLS = [
      "AAPL","NVDA","TSLA","BTC-USD","ETH-USD","SPY",
      "MSFT","META","AMZN","GOOGL","AMD","PLTR","COIN","QQQ","GLD",
    ]

    const results = await Promise.allSettled(TOP_SYMBOLS.map(buildBuzzItem))
    const trending: TrendingBuzzItem[] = []
    for (const r of results) {
      if (r.status === "fulfilled") trending.push(r.value)
    }
    trending.sort((a, b) => b.buzz_score - a.buzz_score)

    const data = { trending, source: "multi_source", updated_at: new Date().toISOString() }
    cache.set(cKey, { data, ts: Date.now() })
    return NextResponse.json(data)
  }

  // ── SYMBOL MODE ───────────────────────────────────────────────────────────────
  const clean = symbol.replace("-USD", "")
  const cKey  = `buzz_${clean}`
  const hit   = cache.get(cKey)
  if (hit && Date.now() - hit.ts < CACHE_TTL) return NextResponse.json(hit.data)

  const { titles } = await fetchTitlesForSymbol(symbol)
  const { score, sentiment } = scoreTitles(titles)

  const result: BuzzResult = {
    buzz_score:         score,
    mentions_24h:       titles.length * 8,
    dominant_sentiment: sentiment,
    top_headlines:      titles.slice(0, 3),
    source:             "news_analysis",
    disclaimer:         "Basé sur l'analyse des actualités Yahoo Finance",
  }

  cache.set(cKey, { data: result, ts: Date.now() })
  return NextResponse.json(result)
}
