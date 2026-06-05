"use client"

import { useEffect, useState } from "react"

type Event = {
  id: string
  date: string
  title: string
  impact: "high" | "medium" | "low"
  country: string
  category: string
  expected: string
  previous: string
  ai_comment?: string | null
}

const IMPACT_COLORS = {
  high:   { color: "#f87171", bg: "rgba(239,68,68,0.12)",  border: "rgba(239,68,68,0.25)",  label: "Impact fort" },
  medium: { color: "#fbbf24", bg: "rgba(251,191,36,0.10)", border: "rgba(251,191,36,0.22)", label: "Impact moyen" },
  low:    { color: "#60a5fa", bg: "rgba(96,165,250,0.08)", border: "rgba(96,165,250,0.18)", label: "Impact faible" },
}

const CATEGORY_ICONS: Record<string, string> = {
  central_bank: "🏦",
  employment:   "👷",
  inflation:    "📈",
  gdp:          "💹",
  pmi:          "🏭",
  earnings:     "🏢",
  consumption:  "🛒",
}

function timeUntil(dateStr: string) {
  const diff = new Date(dateStr).getTime() - Date.now()
  if (diff < 0) return "Passé"
  const h = Math.floor(diff / 3600000)
  const d = Math.floor(h / 24)
  if (d > 0) return `Dans ${d}j`
  if (h > 0) return `Dans ${h}h`
  return "Imminent"
}

export default function CalendrierPage() {
  const [events,  setEvents]  = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [filter,  setFilter]  = useState<"all" | "high" | "medium" | "low">("all")

  useEffect(() => {
    fetch("/api/calendrier")
      .then(r => r.json())
      .then(d => { setEvents(d.events ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const displayed = filter === "all" ? events : events.filter(e => e.impact === filter)

  // Group by day
  const grouped: Record<string, Event[]> = {}
  for (const e of displayed) {
    const day = new Date(e.date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })
    if (!grouped[day]) grouped[day] = []
    grouped[day].push(e)
  }

  return (
    <div className="min-h-screen page-enter">
      <div className="max-w-2xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="mb-6">
          <p className="text-xs font-black text-green-400 uppercase tracking-widest mb-1">📅 Calendrier économique</p>
          <h1 className="text-2xl font-black text-white mb-1">Événements macro + IA</h1>
          <p className="text-white/35 text-sm">Les catalyseurs qui vont bouger les marchés — avec analyse IA.</p>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {([
            { key: "all",    label: "Tous" },
            { key: "high",   label: "🔴 Fort" },
            { key: "medium", label: "🟡 Moyen" },
            { key: "low",    label: "🔵 Faible" },
          ] as const).map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
              style={filter === f.key ? {
                background: "rgba(34,197,94,0.15)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.3)"
              } : {
                background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.08)"
              }}>
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-20 rounded-2xl animate-pulse" style={{ background: "rgba(255,255,255,0.04)" }} />
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([day, dayEvents]) => (
              <div key={day}>
                <p className="text-xs font-black text-white/25 uppercase tracking-widest mb-3 capitalize">{day}</p>
                <div className="space-y-2">
                  {dayEvents.map(event => {
                    const ic = IMPACT_COLORS[event.impact]
                    const catIcon = CATEGORY_ICONS[event.category] ?? "📊"
                    return (
                      <div key={event.id} className="rounded-2xl p-4"
                        style={{ background: "var(--bg-surface)", border: `1px solid var(--border-dim)` }}>

                        <div className="flex items-start gap-3">
                          {/* Impact dot */}
                          <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: ic.color }} />

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="text-sm">{event.country}</span>
                              <span className="text-sm font-black text-white">{event.title}</span>
                              <span className="text-base">{catIcon}</span>
                            </div>

                            <div className="flex items-center gap-3 text-xs text-white/30 mb-2 flex-wrap">
                              <span className="font-bold" style={{ color: ic.color }}>
                                {ic.label}
                              </span>
                              <span>·</span>
                              <span>{new Date(event.date).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} ET</span>
                              <span>·</span>
                              <span className="font-bold text-white/50">{timeUntil(event.date)}</span>
                            </div>

                            <div className="flex gap-3 text-xs mb-2">
                              <div className="px-2.5 py-1 rounded-lg" style={{ background: "rgba(255,255,255,0.04)" }}>
                                <span className="text-white/30">Attendu</span>
                                <span className="text-white font-bold ml-1.5">{event.expected}</span>
                              </div>
                              <div className="px-2.5 py-1 rounded-lg" style={{ background: "rgba(255,255,255,0.04)" }}>
                                <span className="text-white/30">Précédent</span>
                                <span className="text-white font-bold ml-1.5">{event.previous}</span>
                              </div>
                            </div>

                            {event.ai_comment && (
                              <div className="flex items-start gap-2 px-3 py-2 rounded-xl"
                                style={{ background: "rgba(167,139,250,0.07)", border: "1px solid rgba(167,139,250,0.15)" }}>
                                <span className="text-[10px] flex-shrink-0">🤖</span>
                                <p className="text-xs text-white/55 leading-relaxed">{event.ai_comment}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
