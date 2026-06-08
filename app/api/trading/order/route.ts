import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getMarketStatus } from "@/lib/market-hours"

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "")
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.SUPABASE_SERVICE_KEY || 'placeholder'
  )

  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { symbol, name, qty, side, order_type = "market", limit_price } = await req.json()
  const quantity   = parseFloat(qty)
  const isLimit    = order_type === "limit" && limit_price != null && !isNaN(parseFloat(limit_price))

  // Fetch current price from Yahoo Finance
  const priceRes = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`,
    { headers: { "User-Agent": "Mozilla/5.0" } }
  )
  const priceData = await priceRes.json()
  const price     = priceData?.chart?.result?.[0]?.meta?.regularMarketPrice
  if (!price) return NextResponse.json({ error: "Prix indisponible" }, { status: 400 })

  const total = price * quantity

  // Récupère le compte
  const { data: account } = await supabase
    .from("trading_accounts")
    .select("*")
    .eq("user_id", user.id)
    .single()

  if (!account) return NextResponse.json({ error: "Compte introuvable" }, { status: 404 })

  // Détermine si le marché est ouvert
  const marketStatus = getMarketStatus(symbol)

  // Ordre limite → toujours pending, s'exécute quand le prix cible est atteint
  // Ordre market → pending si marché fermé, sinon filled
  const lp          = isLimit ? parseFloat(limit_price) : null
  const orderStatus = isLimit ? "pending" : marketStatus.isOpen ? "filled" : "pending"
  const scheduledFor = !isLimit && !marketStatus.isOpen && marketStatus.nextOpen
    ? marketStatus.nextOpen.toISOString()
    : null

  // Pour un ordre limite buy, vérifier le cash sur le prix limite (pas le prix marché)
  const reservePrice = isLimit ? lp! : price
  const reserveTotal = reservePrice * quantity

  // Vérification du cash
  if (side === "buy" && account.cash < reserveTotal) {
    return NextResponse.json({ error: "Cash insuffisant" }, { status: 400 })
  }

  if (side === "sell") {
    const { data: position } = await supabase
      .from("positions")
      .select("*")
      .eq("user_id", user.id)
      .eq("symbol", symbol)
      .single()

    if (!position || position.qty < quantity) {
      return NextResponse.json({ error: "Position insuffisante" }, { status: 400 })
    }
  }

  // Short : vente à découvert — pas besoin de position existante
  // On crédite le cash (produit de la vente empruntée) et on enregistre une position négative

  // Si ordre immédiat → exécute maintenant
  if (orderStatus === "filled") {
    if (side === "short") {
      // Créditer le cash (produit de la vente à découvert)
      await supabase
        .from("trading_accounts")
        .update({ cash: account.cash + total })
        .eq("user_id", user.id)

      // Upsert position avec qty négative
      const { data: existing } = await supabase
        .from("positions")
        .select("*")
        .eq("user_id", user.id)
        .eq("symbol", symbol)
        .single()

      if (existing) {
        // Ajouter au short existant (qty devient plus négative)
        const newQty = existing.qty - quantity
        const newAvg = (Math.abs(existing.avg_price) * Math.abs(existing.qty) + price * quantity) / (Math.abs(existing.qty) + quantity)
        await supabase
          .from("positions")
          .update({ qty: newQty, avg_price: newAvg, updated_at: new Date().toISOString() })
          .eq("user_id", user.id)
          .eq("symbol", symbol)
      } else {
        await supabase
          .from("positions")
          .insert({ user_id: user.id, symbol, name: name ?? symbol, qty: -quantity, avg_price: price })
      }
    }

    if (side === "buy") {
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
        if (newQty <= 0) {
          // Rachète le short en entier (ou reste encore short)
          if (newQty === 0) {
            await supabase.from("positions").delete()
              .eq("user_id", user.id).eq("symbol", symbol)
          } else {
            await supabase
              .from("positions")
              .update({ qty: newQty, updated_at: new Date().toISOString() })
              .eq("user_id", user.id).eq("symbol", symbol)
          }
        } else {
          // Achat normal sur position longue existante
          const newAvg = (existing.avg_price * existing.qty + price * quantity) / newQty
          await supabase
            .from("positions")
            .update({ qty: newQty, avg_price: newAvg, updated_at: new Date().toISOString() })
            .eq("user_id", user.id)
            .eq("symbol", symbol)
        }
      } else {
        await supabase
          .from("positions")
          .insert({ user_id: user.id, symbol, name: name ?? symbol, qty: quantity, avg_price: price })
      }
    }

    if (side === "sell") {
      await supabase
        .from("trading_accounts")
        .update({ cash: account.cash + total })
        .eq("user_id", user.id)

      const { data: position } = await supabase
        .from("positions")
        .select("*")
        .eq("user_id", user.id)
        .eq("symbol", symbol)
        .single()

      if (position) {
        const newQty = position.qty - quantity
        if (newQty <= 0) {
          await supabase.from("positions").delete()
            .eq("user_id", user.id).eq("symbol", symbol)
        } else {
          await supabase.from("positions")
            .update({ qty: newQty, updated_at: new Date().toISOString() })
            .eq("user_id", user.id).eq("symbol", symbol)
        }
      }
    }
  } else {
    // Ordre pending (deferred ou limite) → réserve le cash au prix limite (ou marché)
    if (side === "buy") {
      await supabase
        .from("trading_accounts")
        .update({ cash: account.cash - reserveTotal })
        .eq("user_id", user.id)
    }
    if (side === "short") {
      await supabase
        .from("trading_accounts")
        .update({ cash: account.cash + reserveTotal })
        .eq("user_id", user.id)
    }
  }

  // Enregistre l'ordre
  const { data: order } = await supabase.from("orders").insert({
    user_id:         user.id,
    symbol,
    name:            name ?? symbol,
    qty:             quantity,
    price,
    execution_price: orderStatus === "filled" ? price : null,
    side,
    total:           reserveTotal,
    status:          orderStatus,
    scheduled_for:   scheduledFor,
    market_session:  marketStatus.session,
    order_type,
    limit_price:     lp,
  }).select().single()

  const sideLabel = side === "buy" ? "Acheté" : side === "short" ? "Shorté" : "Vendu"
  const message = isLimit
    ? `🎯 Ordre limite créé — s'exécutera quand ${symbol} atteindra $${lp?.toFixed(2)}`
    : orderStatus === "filled"
      ? `✅ Ordre exécuté — ${sideLabel} ${quantity} ${symbol} à $${price.toFixed(2)}`
      : `⏳ Ordre planifié — s'exécutera à l'ouverture du marché`

  return NextResponse.json({
    success: true,
    price,
    total,
    status: orderStatus,
    message,
    scheduledFor,
    order,
  })
}
