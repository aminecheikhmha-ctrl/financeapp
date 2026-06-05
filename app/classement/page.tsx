"use client"

import { useEffect, useState } from "react"

type Trader = {
  rank: number
  username: string
  avatar_color: string
  portfolio_value: number
  total_return_pct: number
  win_rate: number
  trades_count: number
}

const MEDALS = ["🥇", "🥈", "🥉"]
const PODIUM_ORDER = [1, 0, 2] // silver, gold, bronze
const PODIUM_HEIGHTS = ["h-24", "h-32", "h-20"]

function getUserGradient(username: string) {
  const GRADS = [
    "linear-gradient(135deg,#22c55e,#16a34a)",
    "linear-gradient(135deg,#60a5fa,#3b82f6)",
    "linear-gradient(135deg,#f59e0b,#d97706)",
    "linear-gradient(135deg,#a78bfa,#7c3aed)",
    "linear-gradient(135deg,#f87171,#dc2626)",
    "linear-gradient(135deg,#34d399,#059669)",
    "linear-gradient(135deg,#fb923c,#ea580c)",
  ]
  let h = 0
  for (let i = 0; i < username.length; i++) h = username.charCodeAt(i) + ((h << 5) - h)
  return GRADS[Math.abs(h) % GRADS.length]
}

export default function ClassementPage() {
  const [traders, setTraders] = useState<Trader[]>([])
  const [loading, setLoading] = useState(true)
  const [period,  setPeriod]  = useState<"all" | "week" | "month">("all")

  useEffect(() => {
    fetch("/api/leaderboard")
      .then(r => r.json())
      .then(d => { setTraders(d.leaderboard ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const top3 = traders.slice(0, 3)
  const rest  = traders.slice(3)

  return (
    <div className="min-h-screen page-enter">
      <div className="max-w-2xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="text-center mb-8">
          <p className="text-xs font-black text-yellow-400 uppercase tracking-widest mb-1">🏆 Classement</p>
          <h1 className="text-3xl font-black text-white mb-2">Les meilleurs traders</h1>
          <p className="text-white/40 text-sm">Paper trading · Mis à jour en temps réel</p>
        </div>

        {/* Period filter */}
        <div className="flex justify-center gap-2 mb-8">
          {([
            { key: "week",  label: "Cette semaine" },
            { key: "month", label: "Ce mois" },
            { key: "all",   label: "Depuis le début" },
          ] as const).map(p => (
            <button key={p.key} onClick={() => setPeriod(p.key)}
              className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
              style={period === p.key ? {
                background: "rgba(251,191,36,0.15)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.3)"
              } : {
                background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.08)"
              }}>
              {p.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => <div key={i} className="h-16 rounded-2xl animate-pulse" style={{ background: "rgba(255,255,255,0.04)" }} />)}
          </div>
        ) : traders.length < 3 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">🏆</p>
            <p className="text-white font-black text-lg mb-1">Classement bientôt disponible</p>
            <p className="text-white/30 text-sm">Plus de traders nécessaires pour débloquer le classement.</p>
          </div>
        ) : (
          <>
            {/* Podium */}
            <div className="flex items-end justify-center gap-4 mb-8 pt-4">
              {PODIUM_ORDER.map((idx) => {
                const t = top3[idx]
                if (!t) return null
                const isGold = idx === 0
                return (
                  <div key={t.username} className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-base font-black text-white"
                      style={{ background: getUserGradient(t.username) }}>
                      {t.username[0].toUpperCase()}
                    </div>
                    <p className="text-xs font-black text-white text-center max-w-[80px] truncate">{t.username}</p>
                    <p className={`text-xs font-black tabular-nums ${t.total_return_pct >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {t.total_return_pct >= 0 ? "+" : ""}{t.total_return_pct.toFixed(1)}%
                    </p>
                    <div className={`${PODIUM_HEIGHTS[idx]} w-20 rounded-t-2xl flex items-center justify-center text-2xl ${
                      isGold ? "bg-yellow-500/20 border border-yellow-500/30" :
                      idx === 1 ? "bg-gray-400/10 border border-gray-400/20" :
                      "bg-orange-600/10 border border-orange-600/20"
                    }`}>
                      {MEDALS[idx]}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Table */}
            <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border-dim)" }}>
              {/* Top 3 in list */}
              {traders.slice(0, 3).map((t, i) => (
                <div key={t.username}
                  className="flex items-center gap-3 px-4 py-3.5 border-b transition-all hover:bg-white/[0.02]"
                  style={{
                    borderColor: "rgba(255,255,255,0.05)",
                    background: i === 0 ? "rgba(251,191,36,0.04)" : "transparent",
                  }}>
                  <span className="text-base w-7 text-center">{MEDALS[i]}</span>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black text-white flex-shrink-0"
                    style={{ background: getUserGradient(t.username) }}>
                    {t.username[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-white truncate">{t.username}</p>
                    <p className="text-[10px] text-white/25">{t.trades_count} trades · {t.win_rate.toFixed(0)}% win rate</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-white tabular-nums">
                      ${t.portfolio_value.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                    </p>
                    <p className={`text-xs font-black tabular-nums ${t.total_return_pct >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {t.total_return_pct >= 0 ? "+" : ""}{t.total_return_pct.toFixed(2)}%
                    </p>
                  </div>
                </div>
              ))}

              {/* Rest */}
              {rest.map((t, i) => (
                <div key={t.username}
                  className="flex items-center gap-3 px-4 py-3 border-b transition-all hover:bg-white/[0.02]"
                  style={{ borderColor: "rgba(255,255,255,0.04)" }}>
                  <span className="text-sm font-black text-white/20 w-7 text-center">#{i + 4}</span>
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black text-white flex-shrink-0"
                    style={{ background: getUserGradient(t.username) }}>
                    {t.username[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white/80 truncate">{t.username}</p>
                    <p className="text-[10px] text-white/20">{t.win_rate.toFixed(0)}% win rate</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-white tabular-nums">
                      ${t.portfolio_value.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                    </p>
                    <p className={`text-xs font-bold tabular-nums ${t.total_return_pct >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {t.total_return_pct >= 0 ? "+" : ""}{t.total_return_pct.toFixed(2)}%
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <p className="text-center text-xs text-white/15 mt-4">
              Mis à jour toutes les 5 minutes · Paper trading uniquement
            </p>
          </>
        )}
      </div>
    </div>
  )
}
