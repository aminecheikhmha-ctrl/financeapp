import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { sendActivationEmail, sendConversionEmail, sendEngagementEmail } from "@/lib/resend"

function makeSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization")
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = makeSupabase()
  const now = new Date()
  let sent = 0

  try {
    // Get all users from auth
    const { data: users } = await supabase.auth.admin.listUsers({ perPage: 1000 })
    if (!users?.users) return NextResponse.json({ ok: true, sent: 0 })

    for (const user of users.users) {
      if (!user.email) continue
      const created = new Date(user.created_at)
      const daysSince = Math.floor((now.getTime() - created.getTime()) / 86400000)

      // J+1: activation email
      if (daysSince === 1) {
        await sendActivationEmail(user.email).catch(() => {})
        sent++
      }
      // J+3: engagement email
      if (daysSince === 3) {
        await sendEngagementEmail(user.email).catch(() => {})
        sent++
      }
      // J+7: conversion email
      if (daysSince === 7) {
        await sendConversionEmail(user.email, 7).catch(() => {})
        sent++
      }
    }
  } catch (err) {
    process.stderr.write(`[cron/emails] error: ${err}\n`)
  }

  return NextResponse.json({ ok: true, sent })
}
