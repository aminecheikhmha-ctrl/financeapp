import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

function makeSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

async function fetchPrice(symbol: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`,
      { headers: { "User-Agent": "Mozilla/5.0" } }
    )
    const json = await res.json()
    return json?.chart?.result?.[0]?.meta?.regularMarketPrice ?? null
  } catch {
    return null
  }
}

async function executeSell(
  supabase: ReturnType<typeof makeSupabase>,
  pos: { user_id: string; symbol: string; name: string; qty: number; take_profit: number | null; stop_loss: number | null },
  price: number,
  reason: "tp_executed" | "sl_executed"
) {
  const total = price * pos.qty

  const { data: account } = await supabase
    .from("trading_accounts")
    .select("cash")
    .eq("user_id", pos.user_id)
    .single()

  if (!account) return

  await Promise.all([
    supabase.from("trading_accounts")
      .update({ cash: account.cash + total })
      .eq("user_id", pos.user_id),
    supabase.from("positions")
      .delete()
      .eq("user_id", pos.user_id)
      .eq("symbol", pos.symbol),
    supabase.from("orders").insert({
      user_id: pos.user_id,
      symbol: pos.symbol,
      name: pos.name,
      qty: pos.qty,
      price,
      side: "sell",
      total,
      status: "filled",
    }),
    // Insert a triggered alert so the client can notify the user
    supabase.from("price_alerts").insert({
      user_id: pos.user_id,
      symbol: pos.symbol,
      condition: reason,
      price,
      triggered: true,
    }),
  ])
}

export async function GET(req: NextRequest) {
  // Auth: accept secret via Authorization header or x-cron-secret header or ?secret= query
  const authHeader = req.headers.get("authorization")?.replace("Bearer ", "")
  const cronHeader = req.headers.get("x-cron-secret")
  const querySecret = req.nextUrl.searchParams.get("secret")
  const provided = authHeader ?? cronHeader ?? querySecret

  if (provided !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const supabase = makeSupabase()

  // ── 1. Fetch all pending price alerts ────────────────────────────────────
  const { data: alerts } = await supabase
    .from("price_alerts")
    .select("*")
    .eq("triggered", false)

  // ── 2. Fetch all positions with TP or SL set ──────────────────────────
  const { data: positions } = await supabase
    .from("positions")
    .select("*")

  const symbolsFromAlerts = (alerts ?? []).map((a: any) => a.symbol as string)
  const symbolsFromPositions = (positions ?? [])
    .filter((p: any) => p.take_profit != null || p.stop_loss != null)
    .map((p: any) => p.symbol as string)

  const allSymbols = [...new Set([...symbolsFromAlerts, ...symbolsFromPositions])]

  if (allSymbols.length === 0) {
    return NextResponse.json({ processed: 0, triggered: 0, auto_sold: [] })
  }

  // ── 3. Fetch current prices for all relevant symbols ──────────────────
  const prices: Record<string, number> = {}
  await Promise.all(
    allSymbols.map(async (sym) => {
      const p = await fetchPrice(sym)
      if (p != null) prices[sym] = p
    })
  )

  // ── 4. Check price alerts ─────────────────────────────────────────────
  const triggeredIds: string[] = []
  for (const alert of (alerts ?? [])) {
    const price = prices[alert.symbol]
    if (price == null) continue
    const hit =
      (alert.condition === "above" && price >= alert.price) ||
      (alert.condition === "below" && price <= alert.price)
    if (hit) triggeredIds.push(alert.id)
  }

  if (triggeredIds.length > 0) {
    await supabase
      .from("price_alerts")
      .update({ triggered: true })
      .in("id", triggeredIds)
  }

  // ── 5. Check TP / SL on open positions and auto-sell ─────────────────
  const autoSold: string[] = []
  for (const pos of (positions ?? [])) {
    const price = prices[pos.symbol]
    if (price == null) continue

    if (pos.take_profit != null && price >= pos.take_profit) {
      await executeSell(supabase, pos, price, "tp_executed")
      autoSold.push(`${pos.symbol} TP @$${price.toFixed(2)}`)
    } else if (pos.stop_loss != null && price <= pos.stop_loss) {
      await executeSell(supabase, pos, price, "sl_executed")
      autoSold.push(`${pos.symbol} SL @$${price.toFixed(2)}`)
    }
  }

  return NextResponse.json({
    processed: (alerts ?? []).length,
    triggered: triggeredIds.length,
    auto_sold: autoSold,
    prices,
  })
}
