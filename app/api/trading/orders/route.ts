import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "")
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const symbol = req.nextUrl.searchParams.get("symbol")
  if (!symbol) return NextResponse.json({ error: "No symbol" }, { status: 400 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )

  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

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
      date: o.created_at.slice(0, 10), // YYYY-MM-DD for chart marker matching
    }))
  )
}
