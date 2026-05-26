import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { Resend } from "resend"

export const runtime = "nodejs"

const ADMIN_EMAIL = "amine_cm@icloud.com"
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://tradex-kappa-six.vercel.app"

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

// POST — send broadcast email to a segment
export async function POST(req: NextRequest) {
  if (!await checkAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { segment, subject, message } = await req.json()
  if (!segment || !subject || !message) {
    return NextResponse.json({ error: "segment, subject et message requis" }, { status: 400 })
  }

  const supabase = makeSupabase()
  const { data: allUsers } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  const users = allUsers?.users ?? []

  // Filter by segment
  let emails: string[] = []
  if (segment === "all") {
    emails = users.map(u => u.email).filter(Boolean) as string[]
  } else {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("email, plan")
      .eq("plan", segment)
    emails = (profiles ?? []).map((p: any) => p.email).filter(Boolean) as string[]
  }

  if (emails.length === 0) return NextResponse.json({ ok: true, sent: 0 })

  const resend = new Resend(process.env.RESEND_API_KEY)
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#080808;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px">
    <div style="margin-bottom:24px">
      <div style="display:inline-flex;align-items:center;gap:10px">
        <div style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#4ade80,#059669);display:flex;align-items:center;justify-content:center">
          <span style="color:#000;font-weight:900;font-size:18px">T</span>
        </div>
        <span style="color:#fff;font-weight:900;font-size:20px">Tradex</span>
      </div>
    </div>
    <div style="background:#0f0f0f;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:32px">
      <p style="color:rgba(255,255,255,0.7);font-size:15px;line-height:1.7;white-space:pre-line">${message}</p>
      <a href="${APP_URL}/dashboard" style="display:block;width:100%;text-align:center;background:#4ade80;color:#000;font-weight:900;font-size:15px;text-decoration:none;padding:14px 24px;border-radius:12px;margin-top:24px;box-sizing:border-box">Accéder à Tradex →</a>
    </div>
    <p style="color:rgba(255,255,255,0.3);font-size:12px;text-align:center;margin-top:24px">
      Tradex · <a href="${APP_URL}" style="color:#4ade80;text-decoration:none">${APP_URL}</a>
    </p>
  </div>
</body></html>`

  let sent = 0
  const errors: string[] = []

  // Resend supports max 50 recipients at a time
  const BATCH = 50
  for (let i = 0; i < emails.length; i += BATCH) {
    const batch = emails.slice(i, i + BATCH)
    try {
      await resend.emails.send({
        from: "Tradex <hello@tradex.io>",
        to: batch,
        subject,
        html,
      })
      sent += batch.length
    } catch (e: any) {
      errors.push(e.message)
    }
  }

  return NextResponse.json({ ok: true, sent, total: emails.length, errors })
}
