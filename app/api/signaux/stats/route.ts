export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export async function GET() {
  const { data } = await supabase
    .from("signaux")
    .select("result, pnl_pct, direction, ticker, created_at")
    .not("result", "is", null)
    .order("created_at", { ascending: false })
    .limit(200)

  const signaux = data ?? []
  const total   = signaux.length
  const hits    = signaux.filter(s => s.result === "tp_hit").length
  const misses  = signaux.filter(s => s.result === "sl_hit").length
  const winRate = total > 0 ? Math.round((hits / total) * 100) : 0
  const avgPnl  = total > 0
    ? signaux.reduce((s, x) => s + (x.pnl_pct ?? 0), 0) / total
    : 0

  const byTicker: Record<string, { hits: number; total: number }> = {}
  signaux.forEach(s => {
    if (!byTicker[s.ticker]) byTicker[s.ticker] = { hits: 0, total: 0 }
    byTicker[s.ticker].total++
    if (s.result === "tp_hit") byTicker[s.ticker].hits++
  })
  const topTickers = Object.entries(byTicker)
    .map(([ticker, { hits, total }]) => ({
      ticker,
      winRate: Math.round((hits / total) * 100),
      total,
    }))
    .filter(t => t.total >= 3)
    .sort((a, b) => b.winRate - a.winRate)
    .slice(0, 5)

  return NextResponse.json({ total, hits, misses, winRate, avgPnl: parseFloat(avgPnl.toFixed(2)), topTickers })
}
