import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

function makeClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

// GET  — fetch all journal entries for the authenticated user
export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "")
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const supabase = makeClient()
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: entries, error } = await supabase
    .from("trade_journal")
    .select("trade_id, note, emotion, tag, updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ entries: entries ?? [] })
}

// POST — upsert a single journal entry
export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "")
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const supabase = makeClient()
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { trade_id, note, emotion, tag } = body

  if (!trade_id) return NextResponse.json({ error: "trade_id required" }, { status: 400 })

  const { error } = await supabase
    .from("trade_journal")
    .upsert(
      {
        trade_id,
        user_id: user.id,
        note:    note    ?? null,
        emotion: emotion ?? null,
        tag:     tag     ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "trade_id,user_id" }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
