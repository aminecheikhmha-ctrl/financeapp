import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"
export const maxDuration = 300

const TOP_SYMBOLS = [
  "AAPL", "MSFT", "NVDA", "TSLA", "META", "GOOGL", "AMZN", "BTC-USD", "ETH-USD", "SOL-USD",
  "SPY", "QQQ", "JPM", "NFLX", "AMD", "PLTR", "COIN", "CRM", "ADBE", "SNOW",
]

function makeSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const auth = req.headers.get("authorization")
  if (cronSecret && auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const base = process.env.NEXT_PUBLIC_APP_URL || "https://tradex-kappa-six.vercel.app"
  const supabase = makeSupabase()
  const results: { symbol: string; status: string; score?: number }[] = []

  for (const symbol of TOP_SYMBOLS) {
    try {
      // Fetch news
      const newsRes = await fetch(`${base}/api/news?symbol=${symbol}&limit=10`, {
        signal: AbortSignal.timeout(8000),
      })
      if (!newsRes.ok) { results.push({ symbol, status: "news_fetch_failed" }); continue }
      const news = await newsRes.json()
      if (!news.articles?.length) { results.push({ symbol, status: "no_articles" }); continue }

      // Analyze sentiment
      const sentRes = await fetch(`${base}/api/news/sentiment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articles: news.articles, symbol }),
        signal: AbortSignal.timeout(12000),
      })
      if (!sentRes.ok) { results.push({ symbol, status: "sentiment_failed" }); continue }
      const sentiment = await sentRes.json()

      // Reddit buzz
      const buzzRes = await fetch(`${base}/api/news/reddit-buzz?symbol=${symbol}`, {
        signal: AbortSignal.timeout(6000),
      })
      const buzz = buzzRes.ok ? await buzzRes.json() : { mentions_24h: 0, buzz_score: 0 }

      // Get existing cached value to detect drastic changes
      const { data: existing } = await supabase
        .from("news_sentiment_cache")
        .select("sentiment_score, sentiment_label")
        .eq("symbol", symbol)
        .single()

      // Upsert into Supabase
      await supabase.from("news_sentiment_cache").upsert({
        symbol,
        sentiment_score: sentiment.sentiment_score ?? 0,
        sentiment_label: sentiment.overall_sentiment ?? "neutre",
        key_themes: sentiment.key_themes ?? [],
        catalysts: sentiment.catalysts ?? [],
        risks: sentiment.risks ?? [],
        social_buzz: sentiment.social_buzz ?? "faible",
        reddit_mentions: buzz.mentions_24h ?? 0,
        summary: sentiment.summary ?? "",
        articles_count: news.articles.length,
        impact_on_price: sentiment.impact_on_price ?? "neutre",
        confidence: sentiment.confidence ?? 50,
        cached_at: new Date().toISOString(),
      }, { onConflict: "symbol" })

      // Detect drastic sentiment change (alert)
      if (existing) {
        const prevScore = existing.sentiment_score ?? 0
        const newScore  = sentiment.sentiment_score ?? 0
        const delta = Math.abs(newScore - prevScore)
        if (delta >= 40) {
          console.log(`[cron/news] DRASTIC CHANGE for ${symbol}: ${prevScore} → ${newScore} (Δ${delta})`)
          // Could trigger alerts here — e.g., update price_alerts with type "sentiment"
        }
      }

      results.push({ symbol, status: "ok", score: sentiment.sentiment_score })
    } catch (e: any) {
      results.push({ symbol, status: `error: ${e.message}` })
    }
  }

  return NextResponse.json({ updated: results.filter(r => r.status === "ok").length, results })
}
