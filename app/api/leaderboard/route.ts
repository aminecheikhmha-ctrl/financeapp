import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

// ─── GET — top 20 leaderboard ─────────────────────────────────────────────────

export async function GET() {
  // Fetch all trading accounts with username/avatar
  const { data: accounts } = await supabase
    .from("trading_accounts")
    .select("user_id, cash, username, avatar_color")

  if (!accounts || accounts.length === 0) {
    return NextResponse.json({ leaderboard: [] })
  }

  const userIds = accounts.map((a: any) => a.user_id)

  // Fetch all positions and orders in parallel
  const [{ data: allPositions }, { data: allOrders }] = await Promise.all([
    supabase.from("positions").select("user_id, symbol, qty, avg_price").in("user_id", userIds),
    supabase.from("orders").select("user_id, symbol, side, price, qty, total, created_at").in("user_id", userIds).eq("status", "filled"),
  ])

  const INITIAL_CAPITAL = 100000

  const rows = accounts.map((account: any) => {
    const positions = (allPositions ?? []).filter((p: any) => p.user_id === account.user_id)
    const orders = (allOrders ?? []).filter((o: any) => o.user_id === account.user_id)

    // Portfolio value = cash + positions at cost basis
    const positions_value = positions.reduce(
      (sum: number, p: any) => sum + p.qty * p.avg_price,
      0
    )
    const portfolio_value = account.cash + positions_value

    const total_return_pct = ((portfolio_value / INITIAL_CAPITAL) - 1) * 100

    // Win rate: analyze closed sell orders vs avg buy price per symbol
    const sells = orders.filter((o: any) => o.side === "sell")
    const buys = orders.filter((o: any) => o.side === "buy")

    let winning_sells = 0
    let best_trade = 0

    for (const sell of sells) {
      // Find all buys for this symbol before this sell
      const prior_buys = buys.filter(
        (b: any) => b.symbol === sell.symbol && b.created_at <= sell.created_at
      )
      if (prior_buys.length === 0) continue

      const total_qty = prior_buys.reduce((s: number, b: any) => s + b.qty, 0)
      const total_cost = prior_buys.reduce((s: number, b: any) => s + b.total, 0)
      const avg_buy = total_qty === 0 ? 0 : total_cost / total_qty

      if (avg_buy > 0) {
        const ret_pct = ((sell.price - avg_buy) / avg_buy) * 100
        if (ret_pct > 0) winning_sells++
        if (ret_pct > best_trade) best_trade = ret_pct
      }
    }

    const total_trades = orders.length
    const win_rate = sells.length === 0 ? 0 : (winning_sells / sells.length) * 100

    return {
      user_id: account.user_id,
      username: account.username ?? `Trader_${account.user_id.slice(0, 6)}`,
      avatar_color: account.avatar_color ?? "#4ade80",
      portfolio_value: Math.round(portfolio_value * 100) / 100,
      total_return_pct: Math.round(total_return_pct * 100) / 100,
      win_rate: Math.round(win_rate * 10) / 10,
      total_trades,
      best_trade: Math.round(best_trade * 100) / 100,
    }
  })

  // Sort by total_return_pct descending, take top 20
  const leaderboard = rows
    .sort((a: any, b: any) => b.total_return_pct - a.total_return_pct)
    .slice(0, 20)
    .map((row: any, index: number) => ({ ...row, rank: index + 1 }))

  return NextResponse.json({ leaderboard })
}

// ─── PATCH — update username ──────────────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "")
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { username, avatar_color } = await req.json()

  const update: Record<string, string> = {}
  if (username) update.username = username.slice(0, 32).replace(/[^a-zA-Z0-9_\- ]/g, "")
  if (avatar_color) update.avatar_color = avatar_color

  const { error } = await supabase
    .from("trading_accounts")
    .update(update)
    .eq("user_id", user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
