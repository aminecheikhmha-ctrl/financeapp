import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

function makeSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

async function getUser(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "")
  if (!token) return null
  const supabase = makeSupabase()
  const { data: { user } } = await supabase.auth.getUser(token)
  return user ?? null
}

export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const supabase = makeSupabase()
  const { data } = await supabase
    .from("price_alerts")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { symbol, condition, price } = await req.json()
  if (!symbol || !condition || price == null)
    return NextResponse.json({ error: "Paramètres manquants" }, { status: 400 })

  const supabase = makeSupabase()
  const { data, error } = await supabase
    .from("price_alerts")
    .insert({ user_id: user.id, symbol, condition, price: parseFloat(price) })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: "ID manquant" }, { status: 400 })

  const supabase = makeSupabase()
  await supabase.from("price_alerts").delete().eq("id", id).eq("user_id", user.id)
  return NextResponse.json({ success: true })
}
