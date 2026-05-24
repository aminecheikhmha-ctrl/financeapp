import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"

const ADMIN_EMAIL = "amine_cm@icloud.com"

function makeSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)
}

async function checkAdmin(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "")
  if (!token) return null
  const supabase = makeSupabase()
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user || user.email !== ADMIN_EMAIL) return null
  return user
}

export async function GET(req: NextRequest) {
  if (!await checkAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const supabase = makeSupabase()
  const { data, error } = await supabase
    .from("price_alerts")
    .select("id, user_id, symbol, condition, price, triggered, created_at")
    .order("created_at", { ascending: false })
    .limit(200)

  if (error) return NextResponse.json({ alerts: [] })
  return NextResponse.json({ alerts: data ?? [] })
}

export async function DELETE(req: NextRequest) {
  if (!await checkAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })

  const supabase = makeSupabase()
  await supabase.from("price_alerts").delete().eq("id", id)
  return NextResponse.json({ ok: true })
}
