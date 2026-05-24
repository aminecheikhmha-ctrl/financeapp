"use client"

import { useState, useEffect } from "react"

type EconEvent = {
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

function impactBadge(impact: EconEvent["impact"]) {
  switch (impact) {
    case "critical": return <span className="text-[9px] font-bold text-red-400">🔴 Critical</span>
    case "high": return <span className="text-[9px] font-bold text-orange-400">🟠 High</span>
    case "medium": return <span className="text-[9px] font-bold text-yellow-400">🟡 Medium</span>
    default: return <span className="text-[9px] text-white/30">⚪ Low</span>
  }
}

function countdown(dateStr: string, timeStr: string): string {
  const [h, m] = timeStr.split(":").map(Number)
  const target = new Date(dateStr)
  target.setHours(h, m, 0, 0)
  const diff = target.getTime() - Date.now()
  if (diff <= 0) return "LIVE"
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  if (days > 0) return `dans ${days}j ${hours}h`
  if (hours > 0) return `dans ${hours}h ${mins}m`
  return `dans ${mins}m`
}

function Skeleton() {
  return (
    <div className="space-y-2 animate-pulse">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="h-14 rounded-xl bg-white/[0.03]" />
      ))}
    </div>
  )
}

export default function EconomicCalendar() {
  const [events, setEvents] = useState<EconEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  const [, setTick] = useState(0)

  useEffect(() => {
    fetch("/api/news/economic-calendar")
      .then(r => r.ok ? r.json() : [])
      .then(data => { setEvents(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60000)
    return () => clearInterval(id)
  }, [])

  return (
    <div
      className="rounded-3xl p-4"
      style={{ background: "#0d0d0d", border: "1px solid rgba(255,255,255,0.08)" }}
    >
      <p className="text-xs font-bold text-white/40 uppercase tracking-widest mb-3">
        📅 Calendrier Économique
      </p>

      {loading ? (
        <Skeleton />
      ) : (
        <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
          {events.map((ev, i) => (
            <div
              key={i}
              className="relative rounded-xl p-2.5 transition cursor-pointer"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-sm">{ev.flag}</span>
                    <span className="text-[11px] font-bold text-white truncate">{ev.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {impactBadge(ev.impact)}
                    <span className="text-[9px] text-white/30">{ev.date} {ev.time}</span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className="text-[9px] font-bold text-green-400">{countdown(ev.date, ev.time)}</span>
                </div>
              </div>

              {/* Tooltip on hover */}
              {hoveredIdx === i && (
                <div
                  className="absolute left-0 right-0 top-full z-50 mt-1 rounded-xl p-3 shadow-xl"
                  style={{ background: "#181818", border: "1px solid rgba(255,255,255,0.12)" }}
                >
                  <p className="text-[10px] text-white/60 mb-1">{ev.description}</p>
                  {ev.assets_affected.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {ev.assets_affected.map(a => (
                        <span
                          key={a}
                          className="text-[9px] px-1.5 py-0.5 rounded font-bold"
                          style={{ background: "rgba(74,222,128,0.1)", color: "#4ade80" }}
                        >
                          {a}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
