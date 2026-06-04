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

  // No symbol → return all positions for the user
  if (!symbol) {
    const { data: positions } = await supabase
      .from("positions")
      .select("*")
      .eq("user_id", user.id)
    return NextResponse.json({ positions: positions ?? [] })
  }

  const { data: position } = await supabase
    .from("positions")
    .select("*")
    .eq("user_id", user.id)
    .eq("symbol", symbol)
    .single()

  return NextResponse.json({ position: position ?? null })
}

export async function PATCH(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "")
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { symbol, take_profit, stop_loss } = await req.json()

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.SUPABASE_SERVICE_KEY || 'placeholder'
  )

  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  await supabase
    .from("positions")
    .update({ take_profit, stop_loss })
    .eq("user_id", user.id)
    .eq("symbol", symbol)

  return NextResponse.json({ success: true })
}