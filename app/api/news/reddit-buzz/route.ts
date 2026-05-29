import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"

export type BuzzResult = {
  buzz_score: number
  mentions_24h: number
  dominant_sentiment: "bullish" | "bearish" | "neutral"
  top_headlines: string[]
  source: string
  disclaimer: string
}

const cache = new Map<string, { data: BuzzResult; ts: number }>()
const CACHE_TTL = 10 * 60 * 1000 // 10 min

const POSITIVE_WORDS = [
  "surge", "rally", "gain", "beat", "record", "high", "growth", "buy", "up",
  "rise", "bull", "profit", "strong", "soar", "jump", "boost", "outperform",
  "upgrade", "breakout", "momentum", "recover",
]
const NEGATIVE_WORDS = [
  "fall", "drop", "miss", "low", "risk", "sell", "crash", "down", "bear",
  "loss", "weak", "decline", "cut", "plunge", "slump", "downgrade", "warning",
  "investigation", "layoffs", "bankrupt", "collapse", "concern",
]

function parseTitlesFromRSS(xml: string): string[] {
  const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? []
  return items
    .map(item => {
      const t = (item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) ?? item.match(/<title>(.*?)<\/title>/))?.[1] ?? ""
      return t.trim()
    })
    .filter(t => t.length > 10 && !t.toLowerCase().includes("yahoo") && !t.toLowerCase().includes("rss"))
    .slice(0, 10)
}

export async function GET(req: NextRequest) {
  const symbol = (new URL(req.url).searchParams.get("symbol") ?? "AAPL")
    .replace("-USD", "")
    .toUpperCase()

  const cached = cache.get(symbol)
  if (cached && Date.now() - cached.ts < CACHE_TTL) return NextResponse.json(cached.data)

  let titles: string[] = []

  try {
    // Yahoo Finance RSS for the symbol
    const url = `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${symbol}&region=US&lang=en-US`
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; TradexBot/1.0)" },
      signal: AbortSignal.timeout(4000),
    })
    if (res.ok) {
      const text = await res.text()
      titles = parseTitlesFromRSS(text)
    }
  } catch {
    // silently fail
  }

  // Sentiment scoring
  let score = 50
  for (const title of titles) {
    const t = title.toLowerCase()
    POSITIVE_WORDS.forEach(w => { if (t.includes(w)) score += 4 })
    NEGATIVE_WORDS.forEach(w => { if (t.includes(w)) score -= 4 })
  }
  score = Math.max(0, Math.min(100, score))

  const sentiment: "bullish" | "bearish" | "neutral" =
    score > 60 ? "bullish" : score < 40 ? "bearish" : "neutral"

  const result: BuzzResult = {
    buzz_score:          score,
    mentions_24h:        titles.length * 8,
    dominant_sentiment:  sentiment,
    top_headlines:       titles.slice(0, 3),
    source:              "news_analysis",
    disclaimer:          "Basé sur l'analyse des actualités Yahoo Finance",
  }

  cache.set(symbol, { data: result, ts: Date.now() })
  return NextResponse.json(result)
}
