import { NextRequest, NextResponse } from "next/server"
import webpush from "web-push"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"

function setupVapid() {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:contact@financeapp.io",
    process.env.VAPID_PUBLIC_KEY ?? "",
    process.env.VAPID_PRIVATE_KEY ?? ""
  )
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret")
  const authHeader = req.headers.get("authorization")
  // Allow cron secret or admin token
  const isAuthorized = secret === process.env.CRON_SECRET || authHeader?.includes("Bearer ")
  if (!isAuthorized) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  setupVapid()

  const { user_id, all, title, body, url, icon } = await req.json()
  if (!title || !body) return NextResponse.json({ error: "title and body required" }, { status: 400 })

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)
  let query = supabase.from("push_subscriptions").select("*")
  if (user_id) query = query.eq("user_id", user_id)

  const { data: subs } = await query
  const payload = JSON.stringify({
    title,
    body,
    icon: icon ?? "/icon-192.png",
    badge: "/icon-192.png",
    url: url ?? "/dashboard",
    timestamp: Date.now(),
  })

  let sent = 0
  for (const sub of subs ?? []) {
    try {
      await webpush.sendNotification(JSON.parse(sub.subscription), payload)
      sent++
    } catch (e: any) {
      if (e.statusCode === 410) {
        await supabase.from("push_subscriptions").delete().eq("id", sub.id)
      }
    }
  }

  return NextResponse.json({ sent })
}
