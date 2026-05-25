import { NextResponse } from "next/server"

export const runtime = "nodejs"

export type TrendingTopic = {
  topic: string
  count: number
  sentiment: string
  tickers: string[]
  emoji: string
}

const cache = new Map<string, { data: TrendingTopic[]; ts: number }>()
const CACHE_TTL = 30 * 60 * 1000

async function fetchRedditTitles(sub: string): Promise<string[]> {
  try {
    const res = await fetch(
      `https://www.reddit.com/r/${sub}/hot.json?limit=25`,
      { headers: { "User-Agent": "TradEx/1.0" }, signal: AbortSignal.timeout(5000) }
    )
    if (!res.ok) return []
    const data = await res.json()
    const posts = data?.data?.children ?? []
    return posts.map((p: { data: { title?: string } }) => p.data?.title ?? "").filter(Boolean)
  } catch {
    return []
  }
}

function fallbackTopics(titles: string[]): TrendingTopic[] {
  const wordCount = new Map<string, number>()
  const ignoreWords = new Set(["the", "a", "an", "is", "are", "was", "for", "to", "of", "in", "on", "at", "by", "it", "as", "be", "do", "if", "or", "and", "not", "but", "we", "i", "you", "my", "has", "have", "with", "from", "that", "this", "will", "can", "how", "why", "what", "just", "your", "im", "its", "been", "all"])
  for (const title of titles) {
    for (const word of title.toLowerCase().split(/\W+/)) {
      if (word.length < 3 || ignoreWords.has(word)) continue
      wordCount.set(word, (wordCount.get(word) ?? 0) + 1)
    }
  }
  const top = [...wordCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)

  return top.map(([word, count]) => ({
    topic: word.charAt(0).toUpperCase() + word.slice(1),
    count,
    sentiment: "neutre",
    tickers: [],
    emoji: "📈",
  }))
}

export async function GET() {
  const cached = cache.get("trending")
  if (cached && Date.now() - cached.ts < CACHE_TTL) return NextResponse.json(cached.data)

  const [wsb, investing, stocks] = await Promise.all([
    fetchRedditTitles("wallstreetbets"),
    fetchRedditTitles("investing"),
    fetchRedditTitles("stocks"),
  ])

  const allTitles = [...wsb, ...investing, ...stocks]

  const apiKey = process.env.GROQ_API_KEY
  let topics: TrendingTopic[] = []

  if (apiKey && allTitles.length > 0) {
    try {
      const { default: Groq } = await import("groq-sdk")
      const groq = new Groq({ apiKey })
      const titleList = allTitles.slice(0, 50).join(" | ")
      const chat = await groq.chat.completions.create({
        model: "llama-3.1-8b-instant",
        max_tokens: 500,
        temperature: 0.3,
        messages: [
          {
            role: "user",
            content: `Tu es un analyste financier. Identifie les 8 thèmes principaux dans ces titres de news financières.\nRetourne UNIQUEMENT du JSON valide (pas de markdown) :\n[{"topic":"string","count":number,"sentiment":"neutre","tickers":["AAPL"],"emoji":"📈"}]\nTitres : ${titleList}`,
          },
        ],
      })
      const text = chat.choices[0]?.message?.content?.trim() ?? ""
      const jsonStr = text.replace(/^```json?\s*/i, "").replace(/```\s*$/i, "").trim()
      topics = JSON.parse(jsonStr)
      if (!Array.isArray(topics)) topics = []
    } catch {
      topics = fallbackTopics(allTitles)
    }
  } else {
    topics = fallbackTopics(allTitles)
  }

  cache.set("trending", { data: topics, ts: Date.now() })
  return NextResponse.json(topics)
}
