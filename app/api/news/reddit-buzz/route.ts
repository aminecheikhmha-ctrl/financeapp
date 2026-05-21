import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"

export type RedditBuzzResult = {
  buzz_score: number        // 0-100
  mentions_24h: number
  avg_score: number
  dominant_sentiment: "bullish" | "bearish" | "neutral"
  viral_posts: { title: string; url: string; score: number }[]
  subreddits: string[]
}

const cache = new Map<string, { data: RedditBuzzResult; ts: number }>()
const CACHE_TTL = 5 * 60 * 1000

const SUBS = ["wallstreetbets", "investing", "stocks", "CryptoCurrency"]

const BULL_WORDS = ["buy", "moon", "bullish", "calls", "long", "pump", "bull", "up", "breakout", "rally", "ath", "achat", "hausse"]
const BEAR_WORDS = ["sell", "short", "puts", "bearish", "crash", "dump", "bear", "down", "drop", "fall", "vente", "baisse"]

function detectSentiment(titles: string[]): "bullish" | "bearish" | "neutral" {
  let bull = 0, bear = 0
  for (const t of titles) {
    const lc = t.toLowerCase()
    if (BULL_WORDS.some(w => lc.includes(w))) bull++
    if (BEAR_WORDS.some(w => lc.includes(w))) bear++
  }
  if (bull > bear + 1) return "bullish"
  if (bear > bull + 1) return "bearish"
  return "neutral"
}

export async function GET(req: NextRequest) {
  const symbol = (new URL(req.url).searchParams.get("symbol") ?? "AAPL").replace("-USD", "").toUpperCase()
  const cached = cache.get(symbol)
  if (cached && Date.now() - cached.ts < CACHE_TTL) return NextResponse.json(cached.data)

  const cutoff24h = Date.now() - 24 * 60 * 60 * 1000
  let totalScore = 0, count = 0, count24h = 0
  const viral: { title: string; url: string; score: number }[] = []
  const allTitles: string[] = []
  const hitSubs: string[] = []

  for (const sub of SUBS) {
    try {
      const url = `https://www.reddit.com/r/${sub}/search.json?q=${encodeURIComponent(symbol)}&sort=hot&limit=25&t=week&restrict_sr=1`
      const res = await fetch(url, {
        headers: { "User-Agent": "FinanceApp/1.0" },
        signal: AbortSignal.timeout(4000),
      })
      if (!res.ok) continue
      const data = await res.json()
      const posts = data?.data?.children ?? []
      let subHits = 0
      for (const post of posts) {
        const p = post.data
        const title = (p.title ?? "").toLowerCase()
        if (!title.includes(symbol.toLowerCase())) continue
        subHits++
        totalScore += p.score ?? 0
        count++
        allTitles.push(p.title ?? "")
        if (new Date((p.created_utc ?? 0) * 1000).getTime() > cutoff24h) count24h++
        if ((p.score ?? 0) >= 500) {
          viral.push({ title: p.title, url: `https://reddit.com${p.permalink}`, score: p.score })
        }
      }
      if (subHits > 0) hitSubs.push(`r/${sub}`)
    } catch {
      continue
    }
  }

  const avgScore = count > 0 ? Math.round(totalScore / count) : 0
  // Buzz score: weighted combination of mentions, avg score, virality
  const mentionFactor = Math.min(40, count24h * 4)
  const scoreFactor   = Math.min(30, Math.log10(Math.max(1, avgScore)) * 10)
  const viralFactor   = Math.min(30, viral.length * 10)
  const buzzScore     = Math.round(Math.min(100, mentionFactor + scoreFactor + viralFactor))

  const result: RedditBuzzResult = {
    buzz_score: buzzScore,
    mentions_24h: count24h,
    avg_score: avgScore,
    dominant_sentiment: detectSentiment(allTitles),
    viral_posts: viral.sort((a, b) => b.score - a.score).slice(0, 3),
    subreddits: hitSubs,
  }

  cache.set(symbol, { data: result, ts: Date.now() })
  return NextResponse.json(result)
}
