import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "")
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )

  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { symbol, name, qty, side } = await req.json()
  const quantity = parseFloat(qty)

  // Prix Yahoo Finance
  const priceRes = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`,
    { headers: { "User-Agent": "Mozilla/5.0" } }
  )
  const priceData = await priceRes.json()
  const price = priceData?.chart?.result?.[0]?.meta?.regularMarketPrice
  if (!price) return NextResponse.json({ error: "Prix indisponible" }, { status: 400 })

  const total = price * quantity

  // Récupère le compte
  const { data: account } = await supabase
    .from("trading_accounts")
    .select("*")
    .eq("user_id", user.id)
    .single()

  if (!account) return NextResponse.json({ error: "Compte introuvable" }, { status: 404 })

  if (side === "buy") {
    if (account.cash < total)
      return NextResponse.json({ error: "Cash insuffisant" }, { status: 400 })

    await supabase
      .from("trading_accounts")
      .update({ cash: account.cash - total })
      .eq("user_id", user.id)

    const { data: existing } = await supabase
      .from("positions")
      .select("*")
      .eq("user_id", user.id)
      .eq("symbol", symbol)
      .single()

    if (existing) {
      const newQty = existing.qty + quantity
      const newAvg = (existing.avg_price * existing.qty + price * quantity) / newQty
      await supabase
        .from("positions")
        .update({ qty: newQty, avg_price: newAvg, updated_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .eq("symbol", symbol)
    } else {
      await supabase
        .from("positions")
        .insert({ user_id: user.id, symbol, name: name ?? symbol, qty: quantity, avg_price: price })
    }
  }

  if (side === "sell") {
    const { data: position } = await supabase
      .from("positions")
      .select("*")
      .eq("user_id", user.id)
      .eq("symbol", symbol)
      .single()

    if (!position || position.qty < quantity)
      return NextResponse.json({ error: "Position insuffisante" }, { status: 400 })

    await supabase
      .from("trading_accounts")
      .update({ cash: account.cash + total })
      .eq("user_id", user.id)

    const newQty = position.qty - quantity
    if (newQty === 0) {
      await supabase.from("positions").delete()
        .eq("user_id", user.id).eq("symbol", symbol)
    } else {
      await supabase.from("positions")
        .update({ qty: newQty, updated_at: new Date().toISOString() })
        .eq("user_id", user.id).eq("symbol", symbol)
    }
  }

  await supabase.from("orders").insert({
    user_id: user.id,
    symbol,
    name: name ?? symbol,
    qty: quantity,
    price,
    side,
    total,
    status: "filled",
  })

  return NextResponse.json({ success: true, price, total })
}