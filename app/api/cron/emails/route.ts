import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { sendActivationEmail, sendConversionEmail, sendEngagementEmail } from "@/lib/resend"

export const runtime = "nodejs"

function makeSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)
}

// Vercel Cron: GET /api/cron/emails (runs daily at 9:00 UTC via vercel.json)
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = makeSupabase()
  const now = new Date()
  const sent = { j1: 0, j3: 0, j7: 0, errors: 0 }

  try {
    const { data: users } = await supabase.auth.admin.listUsers({ perPage: 1000 })
    if (!users?.users) return NextResponse.json({ ok: true, sent })

    for (const user of users.users) {
      if (!user.email) continue
      const daysSince = Math.floor((now.getTime() - new Date(user.created_at).getTime()) / 86400000)

      // Only process users in the 1-14 day window
      if (daysSince < 1 || daysSince > 14) continue

      const { data: profile } = await supabase
        .from("profiles")
        .select("plan, email_seq")
        .eq("email", user.email)
        .maybeSingle()

      // Skip paid users
      if (profile?.plan && profile.plan !== "free") continue

      const seq: number[] = profile?.email_seq ?? []

      try {
        if (daysSince >= 7 && !seq.includes(7)) {
          await sendConversionEmail(user.email, daysSince)
          await supabase.from("profiles").update({ email_seq: [...seq, 7] }).eq("email", user.email)
          sent.j7++
        } else if (daysSince >= 3 && !seq.includes(3)) {
          await sendEngagementEmail(user.email)
          await supabase.from("profiles").update({ email_seq: [...seq, 3] }).eq("email", user.email)
          sent.j3++
        } else if (daysSince >= 1 && !seq.includes(1)) {
          await sendActivationEmail(user.email)
          await supabase.from("profiles").update({ email_seq: [...seq, 1] }).eq("email", user.email)
          sent.j1++
        }
      } catch {
        sent.errors++
      }
    }
  } catch (err) {
    process.stderr.write(`[cron/emails] error: ${err}\n`)
  }

  return NextResponse.json({ ok: true, sent })
}

// Keep POST for manual triggers
export async function POST(req: NextRequest) {
  return GET(req)
}
