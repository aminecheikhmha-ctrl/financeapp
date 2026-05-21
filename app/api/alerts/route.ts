import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"

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
  const { data, error } = await supabase
    .from("price_alerts")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("[alerts GET] Supabase error:", error)
    return NextResponse.json([], { status: 200 })
  }
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) {
    console.error("[alerts POST] Unauthorized — no valid token")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: any
  try { body = await req.json() } catch {
    return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 })
  }

  const { symbol, condition, price } = body
  if (!symbol || !condition || price == null) {
    return NextResponse.json({ error: "Paramètres manquants (symbol, condition, price)" }, { status: 400 })
  }

  const priceNum = parseFloat(price)
  if (isNaN(priceNum) || priceNum <= 0) {
    return NextResponse.json({ error: "Prix invalide" }, { status: 400 })
  }

  const supabase = makeSupabase()
  const { data, error } = await supabase
    .from("price_alerts")
    .insert({ user_id: user.id, symbol, condition, price: priceNum, triggered: false })
    .select()
    .single()

  if (error) {
    console.error("[alerts POST] Supabase insert error:", error.code, error.message, error.details)
    // Table might not exist yet — give clear message
    if (error.code === "42P01") {
      return NextResponse.json({ error: "Table price_alerts manquante — exécute la migration SQL" }, { status: 500 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: "ID manquant" }, { status: 400 })

  const supabase = makeSupabase()
  const { error } = await supabase.from("price_alerts").delete().eq("id", id).eq("user_id", user.id)
  if (error) console.error("[alerts DELETE] Supabase error:", error)
  return NextResponse.json({ success: true })
}
