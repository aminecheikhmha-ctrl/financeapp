import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

function makeSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)
}

const ADMIN_EMAIL = "olfagni@gmail.com"

export async function POST(req: NextRequest) {
  // Track an event (no auth required — anonymous OK)
  try {
    const { event, metadata } = await req.json()
    const token = req.headers.get("authorization")?.replace("Bearer ", "")

    let userId: string | undefined
    if (token) {
      const supabase = makeSupabase()
      const { data: { user } } = await supabase.auth.getUser(token)
      userId = user?.id
    }

    const supabase = makeSupabase()
    await supabase.from("analytics_events").insert({
      user_id: userId ?? null,
      event,
      metadata: metadata ?? {},
    })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: true }) // always succeed
  }
}

export async function GET(req: NextRequest) {
  // Admin only
  const token = req.headers.get("authorization")?.replace("Bearer ", "")
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const supabase = makeSupabase()
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // Fetch analytics data
  const [
    { data: allUsers },
    { data: events },
    { data: plansFree },
    { data: plansPro },
    { data: plansPremium },
  ] = await Promise.all([
    supabase.auth.admin.listUsers({ perPage: 1000 }),
    supabase.from("analytics_events").select("event, metadata, created_at, user_id").order("created_at", { ascending: false }).limit(500),
    supabase.from("profiles").select("id").eq("plan", "free"),
    supabase.from("profiles").select("id").eq("plan", "pro"),
    supabase.from("profiles").select("id").eq("plan", "premium"),
  ])

  const users = allUsers?.users ?? []
  const now = Date.now()
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
  const weekAgo = new Date(now - 7 * 86400000)

  const activeToday = users.filter(u => {
    const last = u.last_sign_in_at
    return last && new Date(last) >= todayStart
  }).length

  const newThisWeek = users.filter(u => new Date(u.created_at) >= weekAgo).length

  // Growth last 30 days
  const growth: Record<string, number> = {}
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now - i * 86400000)
    const key = d.toISOString().split("T")[0]
    growth[key] = 0
  }
  for (const u of users) {
    const key = new Date(u.created_at).toISOString().split("T")[0]
    if (growth[key] !== undefined) growth[key]++
  }

  const proCount = plansPro?.length ?? 0
  const premiumCount = plansPremium?.length ?? 0
  const mrr = proCount * 14.99 + premiumCount * 29.99

  return NextResponse.json({
    users: {
      total: users.length,
      activeToday,
      newThisWeek,
    },
    plans: {
      free: plansFree?.length ?? 0,
      pro: proCount,
      premium: premiumCount,
    },
    mrr: Math.round(mrr * 100) / 100,
    growth: Object.entries(growth).map(([date, count]) => ({ date, count })),
    recentEvents: events?.slice(0, 50) ?? [],
  })
}
