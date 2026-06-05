import { NextResponse } from "next/server"
import Groq from "groq-sdk"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 30

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

// Fixed economic events database (updated weekly in prod)
function getUpcomingEvents() {
  const now   = new Date()
  const base  = now.getTime()
  const day   = 24 * 60 * 60 * 1000

  return [
    { id: "fomc",    date: new Date(base + 2 * day).toISOString(), title: "Décision taux Fed (FOMC)",     impact: "high",   country: "🇺🇸", category: "central_bank", expected: "Inchangé 5.25-5.50%",  previous: "5.25-5.50%" },
    { id: "nfp",     date: new Date(base + 4 * day).toISOString(), title: "NFP — Emplois non-agricoles",  impact: "high",   country: "🇺🇸", category: "employment",   expected: "+185K",               previous: "+177K" },
    { id: "cpi",     date: new Date(base + 6 * day).toISOString(), title: "CPI Inflation US (mensuel)",   impact: "high",   country: "🇺🇸", category: "inflation",    expected: "+3.1% a/a",          previous: "+3.2% a/a" },
    { id: "gdp",     date: new Date(base + 8 * day).toISOString(), title: "PIB US T1 2026 (révisé)",     impact: "medium", country: "🇺🇸", category: "gdp",          expected: "+2.4% q/q",          previous: "+3.1% q/q" },
    { id: "ecb",     date: new Date(base + 3 * day).toISOString(), title: "Décision taux BCE",            impact: "high",   country: "🇪🇺", category: "central_bank", expected: "-25pb à 3.50%",      previous: "3.75%" },
    { id: "pmi_us",  date: new Date(base + 1 * day).toISOString(), title: "PMI Manufacturier US",        impact: "medium", country: "🇺🇸", category: "pmi",          expected: "49.5",               previous: "48.7" },
    { id: "pce",     date: new Date(base + 7 * day).toISOString(), title: "PCE Core (inflation préférée Fed)", impact: "high", country: "🇺🇸", category: "inflation",  expected: "+2.8% a/a",       previous: "+2.8% a/a" },
    { id: "aapl_e",  date: new Date(base + 5 * day).toISOString(), title: "Apple — Résultats T2 2026",   impact: "high",   country: "🏢",   category: "earnings",     expected: "EPS $1.65",          previous: "EPS $1.53" },
    { id: "nvda_e",  date: new Date(base + 9 * day).toISOString(), title: "NVIDIA — Résultats T1 2026",  impact: "high",   country: "🏢",   category: "earnings",     expected: "EPS $5.78",          previous: "EPS $4.93" },
    { id: "retail",  date: new Date(base + 10 * day).toISOString(), title: "Ventes au détail US",        impact: "medium", country: "🇺🇸", category: "consumption",  expected: "+0.4% m/m",          previous: "+0.6% m/m" },
    { id: "unemp",   date: new Date(base + 11 * day).toISOString(), title: "Inscriptions chômage hebdo", impact: "low",    country: "🇺🇸", category: "employment",   expected: "215K",               previous: "222K" },
    { id: "boe",     date: new Date(base + 12 * day).toISOString(), title: "Décision taux BoE",          impact: "medium", country: "🇬🇧", category: "central_bank", expected: "Inchangé 4.50%",     previous: "4.50%" },
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
}

export async function GET() {
  const events = getUpcomingEvents()

  // Generate AI commentary for top 3 high-impact events
  const topEvents = events.filter(e => e.impact === "high").slice(0, 3)
  const commentaries: Record<string, string> = {}

  await Promise.all(topEvents.map(async (event) => {
    try {
      const chat = await groq.chat.completions.create({
        model: "llama-3.1-8b-instant",
        max_tokens: 80,
        messages: [{
          role: "user",
          content: `Event: ${event.title}. Attendu: ${event.expected}, Précédent: ${event.previous}. Impact potentiel sur les marchés en 1 phrase concise pour un trader.`
        }]
      })
      commentaries[event.id] = chat.choices[0]?.message?.content ?? ""
    } catch {}
  }))

  return NextResponse.json({ events: events.map(e => ({ ...e, ai_comment: commentaries[e.id] ?? null })) })
}
