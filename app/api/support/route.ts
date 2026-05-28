import { Resend } from "resend"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const { topic, message, email } = await req.json()

    if (!message || !email) {
      return NextResponse.json({ error: "Champs requis" }, { status: 400 })
    }

    // Email to support team
    await resend.emails.send({
      from: "Support Tradex <noreply@tradex.io>",
      to: "support@tradex.io",
      replyTo: email,
      subject: `[Support] ${topic || "Question générale"} — ${email}`,
      html: `
        <div style="font-family:Inter,sans-serif;padding:20px">
          <h2>Nouveau message de support</h2>
          <p><strong>Email :</strong> ${email}</p>
          <p><strong>Sujet :</strong> ${topic || "Non spécifié"}</p>
          <p><strong>Message :</strong></p>
          <p style="background:#f5f5f5;padding:12px;border-radius:8px">${message.replace(/\n/g, "<br/>")}</p>
        </div>
      `,
    })

    // Confirmation email to user
    await resend.emails.send({
      from: "Tradex Support <noreply@tradex.io>",
      to: email,
      subject: "✅ Ton message a bien été reçu — Tradex Support",
      html: `
        <div style="background:#050505;color:white;font-family:Inter,sans-serif;padding:40px 20px;max-width:600px;margin:0 auto">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:24px">
            <div style="width:32px;height:32px;border-radius:8px;background:linear-gradient(135deg,#22c55e,#16a34a);display:flex;align-items:center;justify-content:center;color:white;font-weight:900;font-size:14px">T</div>
            <span style="color:white;font-weight:900;font-size:16px">Tradex</span>
          </div>
          <h2 style="color:white;margin-bottom:8px">Nous avons reçu ton message 👍</h2>
          <p style="color:rgba(255,255,255,0.5)">Notre équipe te répondra sous 24h.</p>
          <p style="color:rgba(255,255,255,0.5)">
            En attendant, le
            <a href="${process.env.NEXT_PUBLIC_APP_URL ?? "https://tradex.io"}/coach" style="color:#4ade80">Coach IA</a>
            peut répondre à tes questions de trading immédiatement.
          </p>
          <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:16px;margin-top:20px">
            <p style="color:rgba(255,255,255,0.3);font-size:12px;margin:0">
              <strong style="color:rgba(255,255,255,0.5)">Ton message :</strong><br/>
              ${message.slice(0, 300)}${message.length > 300 ? "..." : ""}
            </p>
          </div>
          <p style="color:rgba(255,255,255,0.2);font-size:11px;margin-top:32px">
            Tradex — Plateforme éducative de paper trading · support@tradex.io
          </p>
        </div>
      `,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Support email error:", error)
    return NextResponse.json({ error: "Erreur lors de l'envoi" }, { status: 500 })
  }
}
