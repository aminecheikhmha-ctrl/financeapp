export const dynamic    = "force-dynamic"
export const runtime    = "nodejs"
export const maxDuration = 60

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export async function GET(_req: NextRequest) {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: signaux } = await supabase
    .from("signaux")
    .select("id, ticker, direction, prix_entree, take_profit_1, stop_loss, created_at, result")
    .gte("created_at", cutoff)
    .is("result", null)
    .limit(50)

  if (!signaux || signaux.length === 0) {
    return NextResponse.json({ checked: 0, updated: 0 })
  }

  const tickers = [...new Set(signaux.map(s => s.ticker))]
  const priceMap: Record<string, { high: number; low: number; current: number }> = {}

  await Promise.allSettled(tickers.map(async ticker => {
    try {
      const res = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=7d`,
        { headers: { "User-Agent": "Mozilla/5.0" } }
      )
      const data = await res.json()
      const result = data?.chart?.result?.[0]
      if (!result) return
      const q      = result.indicators.quote[0]
      const highs  : number[] = (q.high  ?? []).filter(Boolean)
      const lows   : number[] = (q.low   ?? []).filter(Boolean)
      const closes : number[] = (q.close ?? []).filter(Boolean)
      priceMap[ticker] = {
        high:    Math.max(...highs),
        low:     Math.min(...lows),
        current: closes[closes.length - 1] ?? 0,
      }
    } catch {}
  }))

  let updated = 0
  for (const signal of signaux) {
    const prices = priceMap[signal.ticker]
    if (!prices) continue

    const tp = signal.take_profit_1
    const sl = signal.stop_loss
    let result: "tp_hit" | "sl_hit" | "open" = "open"

    if (signal.direction === "LONG") {
      if (prices.high >= tp)  result = "tp_hit"
      else if (prices.low <= sl) result = "sl_hit"
    } else {
      if (prices.low  <= tp)  result = "tp_hit"
      else if (prices.high >= sl) result = "sl_hit"
    }

    if (result !== "open") {
      const pnl_pct = result === "tp_hit"
        ? ((tp - signal.prix_entree) / signal.prix_entree * 100 * (signal.direction === "LONG" ? 1 : -1))
        : ((sl - signal.prix_entree) / signal.prix_entree * 100 * (signal.direction === "LONG" ? 1 : -1))

      await supabase
        .from("signaux")
        .update({
          result,
          result_price: result === "tp_hit" ? tp : sl,
          result_at:    new Date().toISOString(),
          pnl_pct:      parseFloat(pnl_pct.toFixed(2)),
        })
        .eq("id", signal.id)
      updated++
    }
  }

  return NextResponse.json({ checked: signaux.length, updated })
}
