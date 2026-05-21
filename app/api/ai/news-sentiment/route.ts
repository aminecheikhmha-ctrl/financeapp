import { NextRequest, NextResponse } from "next/server"
import Groq from "groq-sdk"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"
export const maxDuration = 30

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

const FALLBACK_RESULT = {
  sentiment_score: 50,
  sentiment_label: "neutre",
  key_events: [],
  impact_assessment: "Analyse de sentiment indisponible pour le moment.",
  trend_direction: "stable",
  confidence: 0,
  sources_count: 0,
}

async function fetchYahooNews(symbol: string): Promise<{ title: string; publisher: string; providerPublishTime: number }[]> {
  const fetchData = async (host: string) => {
    const res = await fetch(
      `https://${host}/v1/finance/search?q=${symbol}&newsCount=8&quotesCount=0`,
      { headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: 0 } }
    )
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json()
  }

  try {
    let data
    try {
      data = await fetchData("query1.finance.yahoo.com")
    } catch {
      data = await fetchData("query2.finance.yahoo.com")
    }

    return (data?.news ?? []).map((item: { title?: string; publisher?: string; providerPublishTime?: number }) => ({
      title: item.title ?? "",
      publisher: item.publisher ?? "",
      providerPublishTime: item.providerPublishTime ?? 0,
    }))
  } catch {
    return []
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const symbol = searchParams.get("symbol")?.toUpperCase()

  if (!symbol) {
    return NextResponse.json({ error: "Missing symbol parameter" }, { status: 400 })
  }

  // Check cache: if analysis < 2h exists, return it
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
  const { data: cached } = await supabase
    .from("ai_analyses")
    .select("content, created_at")
    .eq("type", "news_sentiment")
    .is("user_id", null)
    .gte("created_at", twoHoursAgo)
    .contains("content", { symbol })
    .order("created_at", { ascending: false })
    .limit(1)
    .single()

  if (cached?.content) {
    return NextResponse.json({ ...cached.content, cached: true })
  }

  const news = await fetchYahooNews(symbol)

  let result = { ...FALLBACK_RESULT, sources_count: news.length }

  if (news.length > 0) {
    try {
      const completion = await Promise.race([
        groq.chat.completions.create({
          model: "llama-3.3-70b-versatile",
          messages: [
            {
              role: "system",
              content: `Analyse le sentiment de ces actualités financières pour ${symbol}.
Retourne JSON strict:
{
  "sentiment_score": 0-100,
  "sentiment_label": "très positif" | "positif" | "neutre" | "négatif" | "très négatif",
  "key_events": [{"event": "string", "impact": "positif"|"négatif"|"neutre", "importance": "haute"|"moyenne"|"faible"}],
  "impact_assessment": "string",
  "trend_direction": "hausse" | "baisse" | "stable",
  "confidence": 0-100,
  "sources_count": number
}`,
            },
            {
              role: "user",
              content: `Actualités pour ${symbol}: ${JSON.stringify(news)}`,
            },
          ],
          temperature: 0.3,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), 10000)
        ),
      ])

      try {
        result = JSON.parse(
          completion.choices[0]?.message?.content?.trim() ?? "{}"
        )
      } catch {
        result = { ...FALLBACK_RESULT, sources_count: news.length }
      }
    } catch {
      result = { ...FALLBACK_RESULT, sources_count: news.length }
    }
  }

  await supabase.from("ai_analyses").insert({
    type: "news_sentiment",
    content: { ...result, symbol },
    user_id: null,
  })

  return NextResponse.json(result)
}
