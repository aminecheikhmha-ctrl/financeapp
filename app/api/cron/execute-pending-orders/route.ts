import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getMarketStatus } from "@/lib/market-hours"

export const runtime    = "nodejs"
export const maxDuration = 30

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.SUPABASE_SERVICE_KEY || 'placeholder'
  )

  // Ordres en attente dont l'heure prévue est passée
  const { data: pendingOrders } = await supabase
    .from("orders")
    .select("*")
    .eq("status", "pending")
    .lte("scheduled_for", new Date().toISOString())
    .limit(50)

  if (!pendingOrders?.length) {
    return NextResponse.json({ executed: 0, message: "Aucun ordre en attente" })
  }

  let executed = 0

  for (const order of pendingOrders) {
    try {
      // Vérifie que le marché est ouvert
      const mktStatus = getMarketStatus(order.symbol)
      if (!mktStatus.isOpen) continue

      // Fetch le prix actuel
      const priceRes = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${order.symbol}?interval=1d&range=1d`,
        { headers: { "User-Agent": "Mozilla/5.0" } }
      )
      const priceData    = await priceRes.json()
      const currentPrice = priceData?.chart?.result?.[0]?.meta?.regularMarketPrice
      if (!currentPrice) continue

      const totalValue = order.qty * currentPrice

      // Récupère le compte
      const { data: account } = await supabase
        .from("trading_accounts")
        .select("cash")
        .eq("user_id", order.user_id)
        .single()

      if (!account) continue

      // Exécute la position
      if (order.side === "buy") {
        // Met à jour ou crée la position
        const { data: existing } = await supabase
          .from("positions")
          .select("*")
          .eq("user_id", order.user_id)
          .eq("symbol", order.symbol)
          .single()

        if (existing) {
          const newQty = existing.qty + order.qty
          const newAvg = (existing.avg_price * existing.qty + currentPrice * order.qty) / newQty
          await supabase.from("positions")
            .update({ qty: newQty, avg_price: newAvg, updated_at: new Date().toISOString() })
            .eq("user_id", order.user_id).eq("symbol", order.symbol)
        } else {
          await supabase.from("positions")
            .insert({ user_id: order.user_id, symbol: order.symbol, name: order.name, qty: order.qty, avg_price: currentPrice })
        }
        // Cash déjà réservé à la création → ajuste si prix différent
        const priceDiff = currentPrice - order.price
        if (Math.abs(priceDiff) > 0.01) {
          await supabase.from("trading_accounts")
            .update({ cash: account.cash - priceDiff * order.qty })
            .eq("user_id", order.user_id)
        }
      } else {
        // Vente
        const { data: position } = await supabase
          .from("positions").select("*")
          .eq("user_id", order.user_id).eq("symbol", order.symbol).single()

        if (position) {
          const newQty = position.qty - order.qty
          if (newQty <= 0) {
            await supabase.from("positions").delete()
              .eq("user_id", order.user_id).eq("symbol", order.symbol)
          } else {
            await supabase.from("positions")
              .update({ qty: newQty, updated_at: new Date().toISOString() })
              .eq("user_id", order.user_id).eq("symbol", order.symbol)
          }
          await supabase.from("trading_accounts")
            .update({ cash: account.cash + totalValue })
            .eq("user_id", order.user_id)
        }
      }

      // Met à jour l'ordre
      await supabase.from("orders")
        .update({
          status:          "filled",
          execution_price: currentPrice,
        })
        .eq("id", order.id)

      // Notification in-app
      const priceDiffPct = ((currentPrice - order.price) / order.price * 100).toFixed(2)
      await supabase.from("user_notifications").insert({
        user_id: order.user_id,
        type:    "order_executed",
        title:   `✅ Ordre exécuté — ${order.symbol}`,
        body:    `${order.side === "buy" ? "Achat" : "Vente"} de ${order.qty} ${order.symbol} à $${currentPrice.toFixed(2)} (écart : ${priceDiffPct}%)`,
        data:    { order_id: order.id, symbol: order.symbol },
      }).then(() => {}, () => {})

      executed++
    } catch (e) {
      console.error(`[execute-pending] failed order ${order.id}:`, e)
    }
  }

  return NextResponse.json({ executed, total: pendingOrders.length })
}
