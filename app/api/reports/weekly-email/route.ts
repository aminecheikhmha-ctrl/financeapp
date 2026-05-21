import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { Resend } from "resend"

export const runtime = "nodejs"
export const maxDuration = 30

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

function getResend() {
  return new Resend(process.env.RESEND_API_KEY ?? "placeholder")
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://financeapp-kappa-six.vercel.app"
const FROM = "FinanceApp <hello@financeapp.io>"

function weeklyTemplate(content: string) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#080808;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px">
    <div style="margin-bottom:32px">
      <div style="display:inline-flex;align-items:center;gap:10px">
        <div style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#4ade80,#059669);display:flex;align-items:center;justify-content:center">
          <span style="color:#000;font-weight:900;font-size:18px">F</span>
        </div>
        <span style="color:#fff;font-weight:900;font-size:20px">FinanceApp</span>
      </div>
    </div>
    <div style="background:#0f0f0f;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:32px">${content}</div>
    <div style="margin-top:24px;text-align:center">
      <p style="color:rgba(255,255,255,0.3);font-size:12px;margin:0">FinanceApp · Rapport hebdomadaire<br>
      <a href="${APP_URL}" style="color:#4ade80;text-decoration:none">${APP_URL}</a></p>
    </div>
  </div>
</body></html>`
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Get all users with email
  const { data: { users } } = await supabase.auth.admin.listUsers()
  if (!users) return NextResponse.json({ sent: 0 })

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  let sent = 0

  for (const u of users.slice(0, 50)) { // rate limit safety
    if (!u.email) continue
    try {
      // Get last week snapshots
      const { data: snaps } = await supabase
        .from("performance_snapshots")
        .select("date, portfolio_value, daily_pnl_pct, trades_count")
        .eq("user_id", u.id)
        .gte("date", weekAgo.slice(0, 10))
        .order("date", { ascending: false })

      const { data: profile } = await supabase
        .from("user_profiles")
        .select("username, xp, level_name")
        .eq("id", u.id)
        .single()

      const safeSnaps = snaps ?? []
      const weeklyTrades = safeSnaps.reduce((s: number, sn: { trades_count: number | null }) => s + (sn.trades_count ?? 0), 0)
      const weeklyPnlPct = safeSnaps.reduce((s: number, sn: { daily_pnl_pct: number | null }) => s + (sn.daily_pnl_pct ?? 0), 0)
      const latestValue = safeSnaps[0]?.portfolio_value ?? 100000
      const weeklyPnlAbs = latestValue - 100000

      const pnlColor = weeklyPnlPct >= 0 ? "#4ade80" : "#f87171"
      const pnlSign = weeklyPnlPct >= 0 ? "+" : ""
      const name = profile?.username ?? u.email?.split("@")[0] ?? "Trader"

      const html = weeklyTemplate(`
        <h1 style="color:#fff;font-size:22px;font-weight:900;margin:0 0 4px 0">Ton rapport de la semaine 📊</h1>
        <p style="color:rgba(255,255,255,0.5);font-size:14px;margin:0 0 24px 0">Semaine du ${new Date(weekAgo).toLocaleDateString("fr-FR")} au ${new Date().toLocaleDateString("fr-FR")}</p>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:24px">
          <div style="background:rgba(255,255,255,0.04);border-radius:12px;padding:16px;text-align:center">
            <div style="color:${pnlColor};font-size:24px;font-weight:900">${pnlSign}${weeklyPnlPct.toFixed(2)}%</div>
            <div style="color:rgba(255,255,255,0.5);font-size:12px;margin-top:4px">Performance</div>
          </div>
          <div style="background:rgba(255,255,255,0.04);border-radius:12px;padding:16px;text-align:center">
            <div style="color:#fff;font-size:24px;font-weight:900">${weeklyTrades}</div>
            <div style="color:rgba(255,255,255,0.5);font-size:12px;margin-top:4px">Trades</div>
          </div>
        </div>

        <div style="background:rgba(74,222,128,0.06);border:1px solid rgba(74,222,128,0.15);border-radius:12px;padding:16px;margin-bottom:24px;text-align:center">
          <div style="color:rgba(255,255,255,0.6);font-size:13px;margin-bottom:4px">Valeur du portfolio</div>
          <div style="color:#fff;font-size:28px;font-weight:900">$${latestValue.toLocaleString("en-US", { maximumFractionDigits: 0 })}</div>
          <div style="color:${pnlColor};font-size:14px;font-weight:700;margin-top:4px">${pnlSign}$${Math.abs(weeklyPnlAbs).toLocaleString("en-US", { maximumFractionDigits: 0 })} cette semaine</div>
        </div>

        ${profile?.xp ? `<div style="background:rgba(255,255,255,0.04);border-radius:12px;padding:16px;margin-bottom:24px">
          <div style="color:rgba(255,255,255,0.6);font-size:12px;margin-bottom:8px">NIVEAU</div>
          <div style="color:#fff;font-size:16px;font-weight:700">${profile.level_name ?? "Novice"} · <span style="color:#facc15">${profile.xp} XP</span></div>
        </div>` : ""}

        <a href="${APP_URL}/reports" style="display:block;width:100%;text-align:center;background:#4ade80;color:#000;font-weight:900;font-size:15px;text-decoration:none;padding:14px 24px;border-radius:12px;box-sizing:border-box">
          Voir mon rapport complet →
        </a>
      `)

      await getResend().emails.send({
        from: FROM,
        to: u.email,
        subject: `📊 Ton rapport hebdo : ${pnlSign}${weeklyPnlPct.toFixed(1)}% cette semaine`,
        html,
      })
      sent++
    } catch {}
  }

  return NextResponse.json({ sent })
}
