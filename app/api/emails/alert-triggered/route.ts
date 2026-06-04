import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { sendAlertTriggeredEmail } from "@/lib/resend"

function makeSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co', process.env.SUPABASE_SERVICE_KEY || 'placeholder')
}

export async function POST(req: NextRequest) {
  // Vérifie que c'est appelé depuis un cron ou interne
  const secret = req.headers.get("x-internal-secret")
  if (secret !== process.env.CRON_SECRET) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { email, symbol, price, direction } = await req.json()
  try {
    await sendAlertTriggeredEmail(email, symbol, price, direction)
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
