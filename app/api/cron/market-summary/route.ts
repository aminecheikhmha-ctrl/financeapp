import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

function makeSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.SUPABASE_SERVICE_KEY || 'placeholder'
  )
}

const INDICES = [
  { symbol: "^GSPC", label: "S&P 500" },
  { symbol: "^IXIC", label: "Nasdaq" },
  { symbol: "^DJI", label: "Dow Jones" },
  { symbol: "BTC-USD", label: "Bitcoin" },
]

// Triggered every weekday at 08:00 UTC by Vercel cron
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = makeSupabase()

  try {
    const summaries: { label: string; price: number; change: number }[] = []

    for (const index of INDICES) {
      try {
        const res = await fetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(index.symbol)}?interval=1d&range=2d`,
          {
            headers: { "User-Agent": "Mozilla/5.0" },
            signal: AbortSignal.timeout(5000),
          }
        )
        const json = await res.json()
        const meta = json?.chart?.result?.[0]?.meta
        const closes: number[] = json?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? []

        if (meta?.regularMarketPrice && closes.length >= 2) {
          const price: number = meta.regularMarketPrice
          const prev: number = closes[closes.length - 2]
          const change = ((price - prev) / prev) * 100
          summaries.push({ label: index.label, price, change })
        }
      } catch {
        // Skip on error
      }
    }

    // Store daily summary
    if (summaries.length > 0) {
      await supabase.from("market_summaries").insert({
        date: new Date().toISOString().split("T")[0],
        data: summaries,
        created_at: new Date().toISOString(),
      })
    }

    return NextResponse.json({ ok: true, date: new Date().toISOString(), summaries })
  } catch (err) {
    // cron error silenced
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
