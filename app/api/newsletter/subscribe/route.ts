import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { Resend } from "resend"

export const runtime = "nodejs"

function makeSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

export async function POST(req: NextRequest) {
  const { email, source } = await req.json().catch(() => ({}))
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Email invalide" }, { status: 400 })
  }

  const supabase = makeSupabase()

  // Upsert subscriber (ignore duplicate)
  const { error } = await supabase
    .from("newsletter_subscribers")
    .upsert({ email: email.toLowerCase().trim(), source: source ?? "blog" }, { onConflict: "email", ignoreDuplicates: true })

  if (error) {
    console.error("[newsletter/subscribe] Supabase error:", error)
    return NextResponse.json({ error: "Erreur lors de l'inscription" }, { status: 500 })
  }

  // Welcome email (best effort)
  try {
    const resend = new Resend(process.env.RESEND_API_KEY ?? "placeholder")
    const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://financeapp-kappa-six.vercel.app"
    await resend.emails.send({
      from: "FinanceApp <hello@financeapp.io>",
      to: email,
      subject: "✅ Bienvenue dans la newsletter FinanceApp !",
      html: `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#080808;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
<div style="max-width:560px;margin:0 auto;padding:40px 24px">
  <div style="margin-bottom:24px">
    <div style="width:32px;height:32px;border-radius:8px;background:linear-gradient(135deg,#4ade80,#059669);display:inline-flex;align-items:center;justify-content:center">
      <span style="color:#fff;font-weight:900;font-size:14px">F</span>
    </div>
    <span style="color:#fff;font-weight:900;font-size:16px;vertical-align:middle;margin-left:8px">FinanceApp</span>
  </div>
  <h1 style="color:#fff;font-size:24px;font-weight:900;margin:0 0 8px">Bienvenue ! 🎉</h1>
  <p style="color:#9ca3af;font-size:14px;line-height:1.6">
    Tu es maintenant abonné(e) à la newsletter FinanceApp. Tu recevras chaque semaine :
  </p>
  <ul style="color:#9ca3af;font-size:14px;line-height:2">
    <li>📡 Les meilleurs signaux de trading de la semaine</li>
    <li>📰 Les derniers articles du blog</li>
    <li>🧠 Des conseils d'experts pour progresser</li>
  </ul>
  <a href="${APP_URL}/blog" style="display:inline-block;margin-top:24px;padding:12px 24px;background:#22c55e;border-radius:12px;color:#000;font-weight:900;font-size:14px;text-decoration:none">
    Lire le blog →
  </a>
  <p style="color:#4b5563;font-size:12px;margin-top:32px">
    Pour te désinscrire, réponds à cet email avec "Désinscription".
  </p>
</div>
</body></html>`,
    })
  } catch (e) {
    console.error("[newsletter/subscribe] email error:", e)
    // Don't fail the request if email fails
  }

  return NextResponse.json({ success: true })
}
