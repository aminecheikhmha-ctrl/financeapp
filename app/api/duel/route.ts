import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const dynamic = "force-dynamic"

function makeSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
    process.env.SUPABASE_SERVICE_KEY || "placeholder"
  )
}

export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "")
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const supabase = makeSupabase()
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Fetch duels where user is challenger or opponent
  const { data: duels } = await supabase
    .from("trading_duels")
    .select("*")
    .or(`challenger_id.eq.${user.id},opponent_id.eq.${user.id}`)
    .order("created_at", { ascending: false })
    .limit(20)

  return NextResponse.json({ duels: duels ?? [] })
}

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "")
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const supabase = makeSupabase()
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { duration_days = 7 } = await req.json()

  // Get username
  const { data: profile } = await supabase.from("user_profiles").select("username").eq("id", user.id).single()
  const username = profile?.username ?? user.email?.split("@")[0] ?? "Trader"

  // Get current P&L snapshot
  const { data: account } = await supabase.from("trading_accounts").select("cash").eq("user_id", user.id).single()
  const currentPnlPct = account ? parseFloat((((account.cash - 100000) / 100000) * 100).toFixed(2)) : 0

  const startDate = new Date()
  const endDate   = new Date(startDate.getTime() + duration_days * 24 * 3600 * 1000)

  const { data: duel, error } = await supabase.from("trading_duels").insert({
    challenger_id:       user.id,
    challenger_username: username,
    challenger_pnl_pct:  currentPnlPct,
    duration_days,
    start_date:  startDate.toISOString(),
    end_date:    endDate.toISOString(),
    status:      "pending",
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ duel })
}
