import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"
export const maxDuration = 30

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const today = new Date().toISOString().slice(0, 10)

  // Fetch SPY price change for today (use our existing price API pattern)
  let spyReturnPct = 0
  try {
    const spyRes = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/SPY?interval=1d&range=2d`,
      { headers: { "User-Agent": "Mozilla/5.0" } }
    )
    const spyData = await spyRes.json()
    const closes: number[] = spyData?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? []
    if (closes.length >= 2) {
      spyReturnPct = +((( closes[closes.length - 1] - closes[closes.length - 2]) / closes[closes.length - 2]) * 100).toFixed(4)
    }
  } catch {}

  // Get all users with trading accounts
  const { data: accounts } = await supabase
    .from("trading_accounts")
    .select("user_id, cash")

  if (!accounts) return NextResponse.json({ snapped: 0 })

  let snapped = 0
  for (const acc of accounts) {
    try {
      // Get positions for this user
      const { data: positions } = await supabase
        .from("positions")
        .select("qty, avg_price, current_price")
        .eq("user_id", acc.user_id)

      const posValue = (positions ?? []).reduce((s: number, p: { qty: number; current_price: number | null; avg_price: number }) => s + p.qty * (p.current_price ?? p.avg_price), 0)
      const portfolioValue = acc.cash + posValue
      const dailyPnl = portfolioValue - 100000

      // Get today's trades
      const { data: todayOrders } = await supabase
        .from("orders")
        .select("side, price, qty, created_at")
        .eq("user_id", acc.user_id)
        .eq("status", "filled")
        .gte("created_at", today + "T00:00:00Z")
        .lte("created_at", today + "T23:59:59Z")

      const trades = todayOrders ?? []
      const sells = trades.filter((o: { side: string }) => o.side === "sell")

      await supabase.from("performance_snapshots").upsert({
        user_id: acc.user_id,
        date: today,
        portfolio_value: +portfolioValue.toFixed(2),
        daily_pnl: +dailyPnl.toFixed(2),
        daily_pnl_pct: +((dailyPnl / 100000) * 100).toFixed(4),
        trades_count: trades.length,
        winning_trades: sells.length,
        spy_return_pct: spyReturnPct,
      }, { onConflict: "user_id,date" })

      snapped++
    } catch {}
  }

  return NextResponse.json({ snapped, date: today })
}
