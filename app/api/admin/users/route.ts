import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { sendUpgradeEmail, sendWelcomeEmail, sendPaymentFailedEmail } from "@/lib/resend"

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

// PATCH — change plan or ban/unban a user
export async function PATCH(req: NextRequest) {
  if (!await checkAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { userId, action, plan, banned } = await req.json()
  if (!userId || !action) return NextResponse.json({ error: "userId and action required" }, { status: 400 })

  const supabase = makeSupabase()

  if (action === "set_plan") {
    if (!plan) return NextResponse.json({ error: "plan required" }, { status: 400 })
    // Update by user_id in user_profiles, and by email in profiles
    const { data: authUser } = await supabase.auth.admin.getUserById(userId)
    const email = authUser?.user?.email
    if (email) {
      await supabase.from("profiles").update({ plan }).eq("email", email)
    }
    await supabase.from("user_profiles").update({ plan }).eq("id", userId)
    return NextResponse.json({ ok: true })
  }

  if (action === "ban") {
    await supabase.auth.admin.updateUserById(userId, { ban_duration: banned ? "none" : "876600h" })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 })
}

// POST — send email to a specific user
export async function POST(req: NextRequest) {
  if (!await checkAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { email, type, customMessage } = await req.json()
  if (!email || !type) return NextResponse.json({ error: "email and type required" }, { status: 400 })

  try {
    if (type === "welcome") await sendWelcomeEmail(email)
    else if (type === "upgrade_pro") await sendUpgradeEmail(email, "pro")
    else if (type === "upgrade_premium") await sendUpgradeEmail(email, "premium")
    else if (type === "payment_failed") await sendPaymentFailedEmail(email)
    else if (type === "custom") {
      const { Resend } = await import("resend")
      const resend = new Resend(process.env.RESEND_API_KEY)
      await resend.emails.send({
        from: "FinanceApp <hello@financeapp.io>",
        to: email,
        subject: "Message de l'équipe FinanceApp",
        html: `<div style="font-family:sans-serif;background:#080808;color:#fff;padding:32px;border-radius:12px;max-width:560px;margin:0 auto">
          <h2 style="color:#4ade80;margin:0 0 16px">Message de l'équipe FinanceApp</h2>
          <p style="color:rgba(255,255,255,0.7);line-height:1.6">${customMessage?.replace(/\n/g, "<br>") ?? ""}</p>
          <hr style="border:1px solid rgba(255,255,255,0.1);margin:24px 0">
          <p style="color:rgba(255,255,255,0.4);font-size:12px">L'équipe FinanceApp</p>
        </div>`,
      })
    }
    else return NextResponse.json({ error: "Unknown type" }, { status: 400 })
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
