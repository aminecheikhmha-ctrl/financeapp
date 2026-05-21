import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

function makeSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)
}

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "")
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const supabase = makeSupabase()
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const subscription = await req.json()

  // Store subscription in user_profiles
  await supabase
    .from("user_profiles")
    .upsert(
      { id: user.id, push_subscription: JSON.stringify(subscription) },
      { onConflict: "id" }
    )

  return NextResponse.json({ ok: true })
}
