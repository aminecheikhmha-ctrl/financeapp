import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { Resend } from "resend"
import Groq from "groq-sdk"

export const runtime = "nodejs"
export const maxDuration = 60

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://tradex-kappa-six.vercel.app"

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
  const resend  = new Resend(process.env.RESEND_API_KEY ?? "placeholder")
  const groq    = new Groq({ apiKey: process.env.GROQ_API_KEY })

  // Récupère tous les users
  const { data: { users } } = await supabase.auth.admin.listUsers()
  if (!users) return NextResponse.json({ sent: 0 })

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  // Fetch signaux top de la semaine
  const { data: signaux } = await supabase
    .from("signaux")
    .select("*")
    .gte("created_at", weekAgo)
    .order("score_confiance", { ascending: false })
    .limit(5)

  // Génère le résumé marché via Groq
  let marketText = "Les marchés ont connu une semaine animée avec des mouvements significatifs sur les actions technologiques et les cryptomonnaies. Les investisseurs restent attentifs aux données macroéconomiques et aux décisions de la Fed."
  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{
        role: "user",
        content: "En 3 phrases maximum, donne un résumé du contexte de marché actuel pour la semaine (marchés US, crypto, macro). Sois factuel et concis. Réponds en français.",
      }],
      max_tokens: 200,
    })
    marketText = completion.choices[0]?.message?.content ?? marketText
  } catch {}

  let sent = 0

  for (const u of users.slice(0, 100)) {
    if (!u.email) continue
    try {
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("username, xp, streak_days")
        .eq("id", u.id)
        .single()

      const { data: snaps } = await supabase
        .from("performance_snapshots")
        .select("date, portfolio_value, daily_pnl_pct, trades_count")
        .eq("user_id", u.id)
        .gte("date", weekAgo.slice(0, 10))
        .order("date", { ascending: false })

      const { data: progress } = await supabase
        .from("user_progress")
        .select("course_id, chapter_id")
        .eq("user_id", u.id)
        .gte("created_at", weekAgo)

      const safeSnaps    = snaps ?? []
      const weeklyTrades = safeSnaps.reduce((s, sn: { trades_count: number | null }) => s + (sn.trades_count ?? 0), 0)
      const weeklyPnlPct = safeSnaps.reduce((s, sn: { daily_pnl_pct: number | null }) => s + (sn.daily_pnl_pct ?? 0), 0)
      const latestValue  = safeSnaps[0]?.portfolio_value ?? 100000
      const weeklyXP     = (progress?.length ?? 0) * 75
      const streak       = profile?.streak_days ?? 0
      const username     = profile?.username ?? u.email.split("@")[0]

      const html = generateWeeklyReportHTML({
        username,
        marketText,
        signaux: signaux ?? [],
        ordersCount: weeklyTrades,
        weeklyXP,
        streak,
        portfolioValue: latestValue,
        weeklyPnlPct,
      })

      const pnlSign = weeklyPnlPct >= 0 ? "+" : ""
      await resend.emails.send({
        from: "Tradex <hello@tradex.io>",
        to: u.email,
        subject: `📊 Ton rapport hebdo : ${pnlSign}${weeklyPnlPct.toFixed(1)}% cette semaine`,
        html,
      })
      sent++

      await new Promise(r => setTimeout(r, 200))
    } catch {}
  }

  return NextResponse.json({ sent, total: users.length })
}

function generateWeeklyReportHTML(data: {
  username: string
  marketText: string
  signaux: any[]
  ordersCount: number
  weeklyXP: number
  streak: number
  portfolioValue: number
  weeklyPnlPct: number
}) {
  const { username, marketText, signaux, ordersCount, weeklyXP, streak, portfolioValue, weeklyPnlPct } = data
  const pnlColor = weeklyPnlPct >= 0 ? "#22c55e" : "#ef4444"
  const pnlSign  = weeklyPnlPct >= 0 ? "+" : ""

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Rapport hebdo Tradex</title>
</head>
<body style="margin:0;padding:0;background:#050505;font-family:Inter,system-ui,sans-serif;color:white;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">

    <!-- Header -->
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:32px;">
      <div style="width:48px;height:48px;background:linear-gradient(135deg,#22c55e,#16a34a);border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:900;color:black;">T</div>
      <div>
        <p style="margin:0;font-weight:900;font-size:18px;color:white;">Tradex</p>
        <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.3);">Rapport hebdomadaire · ${new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</p>
      </div>
    </div>

    <!-- Salutation -->
    <div style="margin-bottom:24px;">
      <h1 style="margin:0 0 8px;font-size:24px;font-weight:900;color:white;">Bonjour ${username} 👋</h1>
      <p style="margin:0;color:rgba(255,255,255,0.4);font-size:14px;line-height:1.6;">Voici ton résumé de la semaine — marchés, performances et progrès.</p>
    </div>

    <!-- Performance hero -->
    <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:20px;text-align:center;margin-bottom:20px;">
      <p style="margin:0 0 4px;font-size:11px;color:rgba(255,255,255,0.3);text-transform:uppercase;letter-spacing:2px;">Portfolio</p>
      <p style="margin:0 0 6px;font-size:36px;font-weight:900;color:white;">$${portfolioValue.toLocaleString("en-US", { maximumFractionDigits: 0 })}</p>
      <p style="margin:0;font-size:18px;font-weight:900;color:${pnlColor};">${pnlSign}${weeklyPnlPct.toFixed(2)}% cette semaine</p>
    </div>

    <!-- Stats perso -->
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:24px;">
      ${[
        { label: "Trades", value: String(ordersCount), icon: "💼", color: "#60a5fa" },
        { label: "XP gagnés", value: `+${weeklyXP}`, icon: "⚡", color: "#fbbf24" },
        { label: "Streak", value: `🔥 ${streak}j`, icon: "", color: "#f97316" },
      ].map(s => `
        <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:16px;text-align:center;">
          <p style="margin:0 0 4px;font-size:20px;">${s.icon}</p>
          <p style="margin:0;font-size:20px;font-weight:900;color:${s.color};">${s.value}</p>
          <p style="margin:4px 0 0;font-size:10px;color:rgba(255,255,255,0.25);text-transform:uppercase;letter-spacing:1px;">${s.label}</p>
        </div>
      `).join("")}
    </div>

    <!-- Résumé marché -->
    <div style="background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.15);border-radius:16px;padding:20px;margin-bottom:24px;">
      <p style="margin:0 0 8px;font-size:11px;color:rgba(34,197,94,0.6);text-transform:uppercase;letter-spacing:2px;font-weight:700;">🌍 Contexte de marché</p>
      <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.6);line-height:1.7;">${marketText}</p>
    </div>

    ${signaux.length > 0 ? `
    <!-- Top signaux -->
    <div style="margin-bottom:24px;">
      <p style="margin:0 0 12px;font-size:11px;color:rgba(255,255,255,0.25);text-transform:uppercase;letter-spacing:2px;font-weight:700;">📡 Top signaux de la semaine</p>
      ${signaux.slice(0, 3).map((s: any) => {
        const isLong = s.direction === "LONG"
        const color  = isLong ? "#22c55e" : "#ef4444"
        return `
        <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-left:3px solid ${color};border-radius:12px;padding:16px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;">
          <div>
            <p style="margin:0 0 2px;font-weight:900;color:white;font-size:15px;">${s.ticker}</p>
            <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.3);">${isLong ? "↗ Achat" : "↘ Vente"} · Confluence ${s.score_confiance}%</p>
          </div>
          <p style="margin:0;font-weight:900;color:${color};font-size:14px;">$${s.prix_entree?.toFixed(2) ?? "—"}</p>
        </div>
        `
      }).join("")}
    </div>
    ` : ""}

    <!-- CTA -->
    <div style="text-align:center;margin-bottom:32px;">
      <a href="${APP_URL}/signaux"
        style="display:inline-block;background:linear-gradient(135deg,#22c55e,#16a34a);color:black;font-weight:900;font-size:15px;padding:16px 36px;border-radius:14px;text-decoration:none;">
        Voir tous les signaux →
      </a>
    </div>

    <!-- Footer -->
    <div style="border-top:1px solid rgba(255,255,255,0.06);padding-top:20px;text-align:center;">
      <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.15);">
        Tradex · Trading intelligent avec l'IA<br/>
        <a href="${APP_URL}/profil" style="color:rgba(255,255,255,0.15);">Mon profil</a>
      </p>
    </div>

  </div>
</body>
</html>`
}
