import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "")
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const symbol = req.nextUrl.searchParams.get("symbol")

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.SUPABASE_SERVICE_KEY || 'placeholder'
  )

  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Sans symbol → retourne tous les ordres (pour le profil / coach)
  if (!symbol) {
    const { data: allOrders } = await supabase
      .from("orders")
      .select("symbol, side, price, qty, total, status, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
    return NextResponse.json(
      (allOrders ?? []).map((o) => ({
        symbol: o.symbol,
        type: o.side as "buy" | "sell",
        price: o.price,
        qty: o.qty,
        total: o.total,
        status: o.status,
        date: o.created_at.slice(0, 10),
      }))
    )
  }

  // Avec symbol → ordres pour le graphe du dashboard
  const { data: orders } = await supabase
    .from("orders")
    .select("side, price, qty, created_at")
    .eq("user_id", user.id)
    .eq("symbol", symbol)
    .eq("status", "filled")
    .order("created_at", { ascending: true })

  return NextResponse.json(
    (orders ?? []).map((o) => ({
      type: o.side as "buy" | "sell",
      price: o.price,
      qty: o.qty,
      date: o.created_at.slice(0, 10),
    }))
  )
}
