"use client"

import { useState, useEffect } from "react"
import Link from "next/link"

type EarningEvent = {
  symbol: string
  company: string
  date: string
  time: "before_market" | "after_market" | "unknown"
  eps_estimate: number | null
  revenue_estimate: string | null
  market_cap: string
  importance: "high" | "medium" | "low"
  icon: string
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)

  if (d.toDateString() === today.toDateString()) return "Aujourd'hui"
  if (d.toDateString() === tomorrow.toDateString()) return "Demain"
  return d.toLocaleDateString("fr-FR", { weekday: "short", month: "short", day: "numeric" })
}

function timeLabel(time: EarningEvent["time"]): string {
  if (time === "before_market") return "BMO"
  if (time === "after_market") return "AMC"
  return "?"
}

function Skeleton() {
  return (
    <div className="space-y-2 animate-pulse">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-12 rounded-xl bg-white/[0.03]" />
      ))}
    </div>
  )
}

export default function EarningsCalendar() {
  const [events, setEvents] = useState<EarningEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/news/earnings")
      .then(r => r.ok ? r.json() : [])
      .then(data => { setEvents(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  // Group by date
  const grouped = events.reduce<Record<string, EarningEvent[]>>((acc, ev) => {
    if (!acc[ev.date]) acc[ev.date] = []
    acc[ev.date].push(ev)
    return acc
  }, {})

  return (
    <div
      className="rounded-3xl p-4"
      style={{ background: "#0d0d0d", border: "1px solid rgba(255,255,255,0.08)" }}
    >
      <p className="text-xs font-bold text-white/40 uppercase tracking-widest mb-3">
        📊 Earnings à venir
      </p>

      {loading ? (
        <Skeleton />
      ) : (
        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
          {Object.entries(grouped).slice(0, 8).map(([date, evs]) => (
            <div key={date}>
              <p className="text-[9px] font-bold text-white/30 uppercase tracking-wider mb-1.5 px-1">
                {formatDate(date)}
              </p>
              <div className="space-y-1.5">
                {evs.map((ev, i) => (
                  <Link
                    key={i}
                    href={`/dashboard?symbol=${ev.symbol}`}
                    className="flex items-center gap-2 p-2 rounded-xl transition hover:bg-white/[0.04]"
                    style={{ border: "1px solid rgba(255,255,255,0.04)" }}
                  >
                    <span className="text-base">{ev.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-black text-white">{ev.symbol}</span>
                        {ev.importance === "high" && (
                          <span className="text-[8px] px-1 py-0.5 rounded font-bold bg-red-500/10 text-red-400">HIGH</span>
                        )}
                      </div>
                      <p className="text-[9px] text-white/30 truncate">{ev.company}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-[9px] font-bold text-white/50">{timeLabel(ev.time)}</p>
                      {ev.eps_estimate != null && (
                        <p className="text-[8px] text-white/30">EPS: ${ev.eps_estimate}</p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
