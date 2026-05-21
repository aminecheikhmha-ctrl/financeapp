import { Resend } from "resend"

// Lazy-init to avoid build-time error when RESEND_API_KEY is absent
function getResend() {
  return new Resend(process.env.RESEND_API_KEY ?? "placeholder")
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://financeapp-kappa-six.vercel.app"
const FROM = "FinanceApp <hello@financeapp.io>"

// ─── Email Templates ──────────────────────────────────────────────────────────

function baseTemplate(content: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#080808;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px">
    <!-- Logo -->
    <div style="margin-bottom:32px">
      <div style="display:inline-flex;align-items:center;gap:10px">
        <div style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#4ade80,#059669);display:flex;align-items:center;justify-content:center">
          <span style="color:#000;font-weight:900;font-size:18px">F</span>
        </div>
        <span style="color:#fff;font-weight:900;font-size:20px">FinanceApp</span>
      </div>
    </div>

    <!-- Content -->
    <div style="background:#0f0f0f;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:32px">
      ${content}
    </div>

    <!-- Footer -->
    <div style="margin-top:24px;text-align:center">
      <p style="color:rgba(255,255,255,0.3);font-size:12px;margin:0">
        FinanceApp · Trading intelligent avec l'IA<br>
        <a href="${APP_URL}" style="color:#4ade80;text-decoration:none">${APP_URL}</a>
      </p>
    </div>
  </div>
</body>
</html>`
}

function ctaButton(text: string, url: string): string {
  return `<a href="${url}" style="display:block;width:100%;text-align:center;background:#4ade80;color:#000;font-weight:900;font-size:15px;text-decoration:none;padding:14px 24px;border-radius:12px;margin-top:24px;box-sizing:border-box">${text}</a>`
}

function heading(text: string): string {
  return `<h1 style="color:#fff;font-size:22px;font-weight:900;margin:0 0 8px 0;line-height:1.3">${text}</h1>`
}

function para(text: string): string {
  return `<p style="color:rgba(255,255,255,0.6);font-size:15px;line-height:1.6;margin:0 0 8px 0">${text}</p>`
}

function featureList(items: string[]): string {
  const rows = items.map(i =>
    `<tr><td style="padding:6px 0;color:rgba(255,255,255,0.7);font-size:14px">
      <span style="color:#4ade80;font-weight:700;margin-right:8px">✓</span>${i}
    </td></tr>`
  ).join("")
  return `<table style="width:100%;border-collapse:collapse;margin:16px 0">${rows}</table>`
}

// ─── Email functions ──────────────────────────────────────────────────────────

export async function sendWelcomeEmail(email: string, username?: string) {
  const name = username || email.split("@")[0]
  return getResend().emails.send({
    from: FROM,
    to: email,
    subject: "Bienvenue sur FinanceApp 🚀",
    html: baseTemplate(`
      ${heading(`Bienvenue ${name} 👋`)}
      ${para("Ton compte est prêt. Voici comment démarrer :")}
      ${featureList([
        "Explore le dashboard et ajoute des actifs à ta watchlist",
        "Consulte les signaux de trading IA",
        "Lance ton premier ordre paper trading (capital 10 000$)",
        "Commence par le cours <strong>Introduction aux marchés</strong>",
      ])}
      ${ctaButton("Accéder au dashboard →", `${APP_URL}/dashboard`)}
    `),
  })
}

export async function sendActivationEmail(email: string) {
  return getResend().emails.send({
    from: FROM,
    to: email,
    subject: "Tu n'as pas encore passé ton premier ordre 📊",
    html: baseTemplate(`
      ${heading("Ton premier ordre t'attend 🎯")}
      ${para("Tu t'es inscrit il y a 24h mais n'as pas encore passé d'ordre. Voici pourquoi commencer maintenant :")}
      ${featureList([
        "Paper trading sans risque — tu ne perds pas d'argent réel",
        "Capital de départ : <strong>10 000$</strong> virtuel",
        "Copie nos signaux IA pour ton premier trade",
        "Suis tes performances en temps réel",
      ])}
      ${ctaButton("Passer mon premier ordre →", `${APP_URL}/dashboard`)}
    `),
  })
}

export async function sendEngagementEmail(email: string, signalCount = 3) {
  return getResend().emails.send({
    from: FROM,
    to: email,
    subject: `${signalCount} signaux forts détectés aujourd'hui 📡`,
    html: baseTemplate(`
      ${heading(`${signalCount} signaux forts aujourd'hui 🔥`)}
      ${para("Nos algorithmes ont détecté des opportunités de trading sur les marchés. Voici ce que tu rates :")}
      ${featureList([
        "Signaux ACHAT FORT sur BTC-USD, NVDA et AAPL",
        "Score de confluence supérieur à 85%",
        "Niveaux TP et SL calculés automatiquement",
        "Expire dans les prochaines heures",
      ])}
      ${para("<em>⚠️ En plan gratuit, tu ne vois que 3 signaux/jour.</em>")}
      ${ctaButton("Voir tous les signaux →", `${APP_URL}/signaux`)}
    `),
  })
}

export async function sendConversionEmail(email: string, daysActive = 7) {
  return getResend().emails.send({
    from: FROM,
    to: email,
    subject: `${daysActive} jours sur FinanceApp — passe à Pro maintenant 💎`,
    html: baseTemplate(`
      ${heading(`${daysActive} jours avec FinanceApp 🎉`)}
      ${para("Tu utilises FinanceApp depuis une semaine. Il est temps de passer à la vitesse supérieure :")}
      ${featureList([
        "Signaux illimités en temps réel",
        "Analyses IA sans restriction",
        "Alertes de prix automatiques",
        "Capital paper trading 100 000$",
        "Accès à toute l'académie (15+ cours)",
        "Screener avancé 100+ actifs",
      ])}
      <div style="text-align:center;margin:20px 0">
        <span style="color:rgba(255,255,255,0.4);font-size:14px">À partir de </span>
        <span style="color:#fff;font-size:28px;font-weight:900">14,99€</span>
        <span style="color:rgba(255,255,255,0.4);font-size:14px">/mois</span>
      </div>
      ${ctaButton("Passer à Pro maintenant →", `${APP_URL}/pricing`)}
    `),
  })
}

export async function sendAlertTriggeredEmail(email: string, symbol: string, price: number, direction: "above" | "below") {
  const dir = direction === "above" ? "dépassé" : "atteint"
  return getResend().emails.send({
    from: FROM,
    to: email,
    subject: `🔔 Alerte ${symbol} — Prix ${dir} ${price}$`,
    html: baseTemplate(`
      ${heading(`Alerte déclenchée sur ${symbol} 🔔`)}
      ${para(`Le prix de <strong style="color:#fff">${symbol}</strong> a ${dir} ton niveau d'alerte à <strong style="color:#4ade80">$${price}</strong>.`)}
      <div style="background:rgba(74,222,128,0.08);border:1px solid rgba(74,222,128,0.2);border-radius:12px;padding:16px;text-align:center;margin:16px 0">
        <div style="color:rgba(255,255,255,0.5);font-size:13px;margin-bottom:4px">Prix d'alerte</div>
        <div style="color:#4ade80;font-size:28px;font-weight:900">$${price}</div>
      </div>
      ${ctaButton(`Voir ${symbol} →`, `${APP_URL}/dashboard?symbol=${symbol}`)}
    `),
  })
}
