import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

function makeSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

// Triggered every 15 minutes by Vercel cron
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = makeSupabase()

  try {
    // Fetch latest signals for tracked symbols
    const symbols = ["AAPL", "TSLA", "BTC-USD", "ETH-USD", "NVDA", "SPY", "QQQ", "EUR=X"]

    const results: { symbol: string; price: number | null; signal: string }[] = []

    for (const symbol of symbols) {
      try {
        const res = await fetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`,
          {
            headers: { "User-Agent": "Mozilla/5.0" },
            signal: AbortSignal.timeout(5000),
          }
        )
        const json = await res.json()
        const closes: number[] = json?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? []
        const price: number | null = json?.chart?.result?.[0]?.meta?.regularMarketPrice ?? null

        if (closes.length >= 2 && price) {
          const prev = closes[closes.length - 2]
          const change = ((price - prev) / prev) * 100

          let signal = "HOLD"
          if (change > 2) signal = "BUY"
          else if (change < -2) signal = "SELL"

          results.push({ symbol, price, signal })

          // Upsert into signals table
          await supabase.from("signals").upsert(
            {
              symbol,
              type: signal,
              price,
              note: `Variation ${change >= 0 ? "+" : ""}${change.toFixed(2)}% sur 1 séance`,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "symbol" }
          )
        }
      } catch {
        // Skip symbol on error
      }
    }

    return NextResponse.json({ ok: true, updated: results.length, results })
  } catch (err) {
    console.error("[cron/signals]", err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
