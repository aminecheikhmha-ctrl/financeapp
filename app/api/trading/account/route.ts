import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "")
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.SUPABASE_SERVICE_KEY || 'placeholder'
  )

  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let { data: account } = await supabase
    .from("trading_accounts")
    .select("*")
    .eq("user_id", user.id)
    .single()

  if (!account) {
    const { data } = await supabase
      .from("trading_accounts")
      .insert({ user_id: user.id, cash: 100000 })
      .select()
      .single()
    account = data
  }

  const { data: positions } = await supabase
    .from("positions")
    .select("*")
    .eq("user_id", user.id)

  const { data: orders } = await supabase
    .from("orders")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  return NextResponse.json({
    account: account ?? { cash: 100000 },
    positions: positions ?? [],
    orders: orders ?? [],
  })
}