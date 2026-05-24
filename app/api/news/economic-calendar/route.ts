import { NextResponse } from "next/server"

export const runtime = "nodejs"

export type EconEvent = {
  name: string
  date: string
  time: string
  impact: "low" | "medium" | "high" | "critical"
  country: string
  flag: string
  previous: string | null
  forecast: string | null
  description: string
  assets_affected: string[]
}

const cache = new Map<string, { data: EconEvent[]; ts: number }>()
const CACHE_TTL = 6 * 60 * 60 * 1000

function nextFirstFriday(from: Date): Date {
  const d = new Date(from)
  d.setDate(1)
  // Find first friday
  while (d.getDay() !== 5) d.setDate(d.getDate() + 1)
  if (d <= from) {
    d.setMonth(d.getMonth() + 1)
    d.setDate(1)
    while (d.getDay() !== 5) d.setDate(d.getDate() + 1)
  }
  return d
}

function nextDayOfMonth(day: number, from: Date): Date {
  const d = new Date(from)
  d.setDate(day)
  if (d <= from) {
    d.setMonth(d.getMonth() + 1)
    d.setDate(day)
  }
  return d
}

function nextLastThursdayOfQuarter(from: Date): Date {
  const quarterMonths = [0, 3, 6, 9] // Jan, Apr, Jul, Oct
  const now = new Date(from)
  let best: Date | null = null

  for (let offset = 0; offset < 4; offset++) {
    for (const month of quarterMonths) {
      const year = now.getFullYear() + (month < now.getMonth() && offset === 0 ? 1 : 0)
      // Last Thursday of that month
      const lastDay = new Date(year, month + 1, 0)
      while (lastDay.getDay() !== 4) lastDay.setDate(lastDay.getDate() - 1)
      if (lastDay > now) {
        if (!best || lastDay < best) best = lastDay
      }
    }
    if (best) break
  }

  if (!best) {
    best = new Date(now)
    best.setDate(best.getDate() + 7)
  }
  return best
}

function nextThursday(from: Date): Date {
  const d = new Date(from)
  d.setDate(d.getDate() + 1)
  while (d.getDay() !== 4) d.setDate(d.getDate() + 1)
  return d
}

function nextScheduledDate(dates: string[], from: Date): Date {
  const upcoming = dates
    .map(s => new Date(s))
    .filter(d => d > from)
    .sort((a, b) => a.getTime() - b.getTime())
  if (upcoming.length > 0) return upcoming[0]
  const last = new Date(from)
  last.setDate(last.getDate() + 30)
  return last
}

function dateStr(d: Date): string {
  return d.toISOString().split("T")[0]
}

function generateEvents(from: Date): EconEvent[] {
  const events: EconEvent[] = []

  // Non-Farm Payrolls: first Friday each month
  const nfp = nextFirstFriday(from)
  events.push({
    name: "Non-Farm Payrolls",
    date: dateStr(nfp),
    time: "08:30",
    impact: "high",
    country: "US",
    flag: "🇺🇸",
    previous: null,
    forecast: null,
    description: "Données d'emploi mensuel aux États-Unis — indicateur clé de la santé économique.",
    assets_affected: ["SPY", "DXY", "GLD", "TLT"],
  })

  // CPI: ~12th of month
  const cpi = nextDayOfMonth(12, from)
  events.push({
    name: "CPI Inflation",
    date: dateStr(cpi),
    time: "08:30",
    impact: "high",
    country: "US",
    flag: "🇺🇸",
    previous: null,
    forecast: null,
    description: "Indice des prix à la consommation — mesure principale de l'inflation américaine.",
    assets_affected: ["SPY", "TLT", "GLD"],
  })

  // Fed Rate Decision
  const fedDates = [
    "2026-01-28", "2026-03-18", "2026-05-06", "2026-06-17",
    "2026-07-28", "2026-09-16", "2026-10-27", "2026-12-15",
  ]
  const fedDate = nextScheduledDate(fedDates, from)
  events.push({
    name: "Décision Fed (FOMC)",
    date: dateStr(fedDate),
    time: "14:00",
    impact: "critical",
    country: "US",
    flag: "🇺🇸",
    previous: null,
    forecast: null,
    description: "Annonce du taux directeur de la Réserve Fédérale américaine.",
    assets_affected: ["SPY", "TLT", "DXY", "GLD"],
  })

  // GDP: last Thursday of Jan/Apr/Jul/Oct
  const gdpDate = nextLastThursdayOfQuarter(from)
  events.push({
    name: "GDP Release",
    date: dateStr(gdpDate),
    time: "08:30",
    impact: "high",
    country: "US",
    flag: "🇺🇸",
    previous: null,
    forecast: null,
    description: "Publication du PIB trimestriel américain (estimation préliminaire).",
    assets_affected: ["SPY", "DXY"],
  })

  // ECB Rate Decision
  const ecbDates = [
    "2026-01-22", "2026-03-05", "2026-04-16", "2026-06-04",
    "2026-07-23", "2026-09-10", "2026-10-22", "2026-12-10",
  ]
  const ecbDate = nextScheduledDate(ecbDates, from)
  events.push({
    name: "Décision BCE (ECB)",
    date: dateStr(ecbDate),
    time: "13:15",
    impact: "critical",
    country: "EU",
    flag: "🇪🇺",
    previous: null,
    forecast: null,
    description: "Annonce du taux directeur de la Banque Centrale Européenne.",
    assets_affected: ["EUR/USD", "SPY"],
  })

  // PPI: ~14th of month
  const ppi = nextDayOfMonth(14, from)
  events.push({
    name: "PPI (Prix Producteurs)",
    date: dateStr(ppi),
    time: "08:30",
    impact: "medium",
    country: "US",
    flag: "🇺🇸",
    previous: null,
    forecast: null,
    description: "Indice des prix à la production — indicateur avancé de l'inflation.",
    assets_affected: ["GLD", "TLT"],
  })

  // Retail Sales: ~16th of month
  const retail = nextDayOfMonth(16, from)
  events.push({
    name: "Ventes au Détail",
    date: dateStr(retail),
    time: "08:30",
    impact: "medium",
    country: "US",
    flag: "🇺🇸",
    previous: null,
    forecast: null,
    description: "Données mensuelles des ventes au détail — indicateur de la consommation.",
    assets_affected: ["SPY", "USD"],
  })

  // Jobless Claims: next Thursday
  const claims = nextThursday(from)
  events.push({
    name: "Demandes d'allocations chômage",
    date: dateStr(claims),
    time: "08:30",
    impact: "medium",
    country: "US",
    flag: "🇺🇸",
    previous: null,
    forecast: null,
    description: "Nouvelles demandes d'allocations chômage — indicateur hebdomadaire du marché du travail.",
    assets_affected: ["SPY", "DXY"],
  })

  // Sort by date, take next 10
  return events
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 10)
}

export async function GET() {
  const cached = cache.get("econ")
  if (cached && Date.now() - cached.ts < CACHE_TTL) return NextResponse.json(cached.data)

  const events = generateEvents(new Date())
  cache.set("econ", { data: events, ts: Date.now() })
  return NextResponse.json(events)
}
