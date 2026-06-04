import { NextRequest, NextResponse } from "next/server"
import webpush from "web-push"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"

function setupVapid() {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:contact@tradex.io",
    process.env.VAPID_PUBLIC_KEY ?? "",
    process.env.VAPID_PRIVATE_KEY ?? ""
  )
}

export async function POST(req: NextRequest) {
  try {
    setupVapid()
    const { subscription, userId } = await req.json()
    if (!subscription) return NextResponse.json({ error: "subscription required" }, { status: 400 })

    if (userId) {
      const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co', process.env.SUPABASE_SERVICE_KEY || 'placeholder')
      await supabase.from("push_subscriptions").upsert({
        user_id: userId,
        subscription: JSON.stringify(subscription),
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
