"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"

type BreakoutAsset = {
  symbol: string
  name: string
  price: number
  change: number
  signal: string
  confluence: number
  category: string
  sector?: string
}

const SIGNAL_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  STRONG_BUY:  { bg: "rgba(34,197,94,0.15)",  color: "#4ade80", label: "⚡ Achat fort" },
  BUY:         { bg: "rgba(34,197,94,0.08)",   color: "#86efac", label: "↗ Achat" },
  STRONG_SELL: { bg: "rgba(239,68,68,0.15)",   color: "#f87171", label: "⚡ Vente forte" },
  SELL:        { bg: "rgba(239,68,68,0.08)",   color: "#fca5a5", label: "↘ Vente" },
  NEUTRAL:     { bg: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.35)", label: "→ Neutre" },
}

const FILTERS = [
  { key: "all",         label: "Tous" },
  { key: "STRONG_BUY",  label: "⚡ Achat fort" },
  { key: "BUY",         label: "↗ Achat" },
  { key: "STRONG_SELL", label: "⚡ Vente forte" },
  { key: "SELL",        label: "↘ Vente" },
]

const CATEGORIES = [
  { key: "all",    label: "Tous actifs" },
  { key: "stock",  label: "Actions" },
  { key: "crypto", label: "Crypto" },
  { key: "etf",    label: "ETF" },
]

export default function ScannerPage() {
  const router = useRouter()
  const [assets,    setAssets]    = useState<BreakoutAsset[]>([])
  const [loading,   setLoading]   = useState(true)
  const [lastScan,  setLastScan]  = useState<Date | null>(null)
  const [filter,    setFilter]    = useState("all")
  const [catFilter, setCatFilter] = useState("all")
  const [minScore,  setMinScore]  = useState(60)
  const [sortBy,    setSortBy]    = useState<"confluence" | "change">("confluence")

  const scan = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch("/api/screener?limit=80")
      const data = await res.json()
      if (data.assets) {
        setAssets(data.assets)
        setLastScan(new Date())
      }
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { scan() }, [scan])

  // Auto-refresh every 2 minutes
  useEffect(() => {
    const id = setInterval(scan, 120_000)
    return () => clearInterval(id)
  }, [scan])

  const displayed = assets
    .filter(a => filter    === "all" || a.signal === filter)
    .filter(a => catFilter === "all" || a.category === catFilter)
    .filter(a => (a.confluence ?? 0) >= minScore)
    .sort((a, b) => sortBy === "confluence"
      ? (b.confluence ?? 0) - (a.confluence ?? 0)
      : Math.abs(b.change) - Math.abs(a.change)
    )

  const strongBuys  = assets.filter(a => a.signal === "STRONG_BUY").length
  const buys        = assets.filter(a => a.signal === "BUY").length
  const sells       = assets.filter(a => a.signal === "SELL" || a.signal === "STRONG_SELL").length

  return (
    <div className="min-h-screen page-enter">
      <div className="max-w-5xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
          <div>
            <p className="text-xs font-black text-green-400 uppercase tracking-widest mb-1">🔍 Breakout Scanner</p>
            <h1 className="text-2xl font-black text-white">Scanner de signaux IA</h1>
            <p className="text-white/35 text-sm mt-1">
              {loading ? "Scan en cours…" : `${assets.length} actifs analysés${lastScan ? ` · MàJ ${lastScan.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}` : ""}`}
            </p>
          </div>
          <button onClick={scan} disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-[1.02] disabled:opacity-50"
            style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.25)", color: "#4ade80" }}>
            {loading ? <span className="w-4 h-4 border-2 border-green-400/30 border-t-green-400 rounded-full animate-spin" /> : "↻"}
            {loading ? "Scan…" : "Rescanner"}
          </button>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: "Achats forts", value: strongBuys, color: "#4ade80", bg: "rgba(34,197,94,0.08)", border: "rgba(34,197,94,0.2)" },
            { label: "Achats",       value: buys,       color: "#86efac", bg: "rgba(34,197,94,0.05)", border: "rgba(34,197,94,0.12)" },
            { label: "Ventes",       value: sells,      color: "#f87171", bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.2)" },
          ].map(s => (
            <div key={s.label} className="rounded-2xl p-4 text-center"
              style={{ background: s.bg, border: `1px solid ${s.border}` }}>
              <p className="text-2xl font-black tabular-nums" style={{ color: s.color }}>{loading ? "—" : s.value}</p>
              <p className="text-xs text-white/35 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-4 items-center">
          {/* Signal filter */}
          <div className="flex gap-1.5 flex-wrap">
            {FILTERS.map(f => (
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

          <div className="h-4 w-px bg-white/10 hidden sm:block" />

          {/* Category */}
          {CATEGORIES.map(c => (
            <button key={c.key} onClick={() => setCatFilter(c.key)}
              className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
              style={catFilter === c.key ? {
                background: "rgba(96,165,250,0.15)", color: "#60a5fa", border: "1px solid rgba(96,165,250,0.3)"
              } : {
                background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.08)"
              }}>
              {c.label}
            </button>
          ))}

          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-white/30">Score min</span>
            <input type="range" min={0} max={100} step={5} value={minScore}
              onChange={e => setMinScore(Number(e.target.value))}
              className="w-20 accent-green-500" />
            <span className="text-xs font-black text-green-400 w-8">{minScore}%</span>
          </div>

          <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}
            className="px-3 py-1.5 rounded-xl text-xs font-bold outline-none"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)" }}>
            <option value="confluence">Trier par score</option>
            <option value="change">Trier par variation</option>
          </select>
        </div>

        {/* Results */}
        {loading && assets.length === 0 ? (
          <div className="space-y-2">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-16 rounded-2xl animate-pulse" style={{ background: "rgba(255,255,255,0.04)" }} />
            ))}
          </div>
        ) : displayed.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-4xl mb-3">🔍</p>
            <p className="text-white font-black text-base mb-1">Aucun signal trouvé</p>
            <p className="text-white/30 text-sm">Essaie de baisser le score minimum</p>
          </div>
        ) : (
          <div className="space-y-2">
            {displayed.map((asset, i) => {
              const sig = SIGNAL_COLORS[asset.signal] ?? SIGNAL_COLORS.NEUTRAL
              const isPos = asset.change >= 0
              return (
                <div key={asset.symbol}
                  onClick={() => router.push(`/dashboard?symbol=${asset.symbol}`)}
                  className="flex items-center gap-4 px-4 py-3.5 rounded-2xl cursor-pointer transition-all hover:scale-[1.005] hover:brightness-110 group"
                  style={{ background: sig.bg, border: `1px solid ${sig.color}20` }}>

                  {/* Rank */}
                  <span className="text-xs font-black text-white/20 w-5 flex-shrink-0 tabular-nums">#{i + 1}</span>

                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black text-black flex-shrink-0"
                    style={{ background: sig.color }}>
                    {asset.symbol.replace("-USD","")[0]}
                  </div>

                  {/* Name */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-black text-white">{asset.symbol.replace("-USD","")}</p>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-md font-bold uppercase"
                        style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.35)" }}>
                        {asset.category}
                      </span>
                      {asset.sector && (
                        <span className="hidden sm:block text-[9px] text-white/20">{asset.sector}</span>
                      )}
                    </div>
                    <p className="text-[11px] text-white/30 truncate">{asset.name}</p>
                  </div>

                  {/* Signal badge */}
                  <span className="hidden sm:flex px-2.5 py-1 rounded-lg text-[11px] font-black flex-shrink-0"
                    style={{ background: sig.bg, color: sig.color, border: `1px solid ${sig.color}30` }}>
                    {sig.label}
                  </span>

                  {/* Score */}
                  <div className="text-center flex-shrink-0 w-14">
                    <p className="text-base font-black tabular-nums" style={{ color: sig.color }}>{asset.confluence ?? "—"}%</p>
                    <div className="h-1 rounded-full mt-1 overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                      <div className="h-full rounded-full" style={{ width: `${asset.confluence ?? 0}%`, background: sig.color }} />
                    </div>
                  </div>

                  {/* Price + change */}
                  <div className="text-right flex-shrink-0 w-20">
                    <p className="text-sm font-black text-white tabular-nums">
                      ${asset.price < 1 ? asset.price.toFixed(4) : asset.price.toFixed(2)}
                    </p>
                    <p className={`text-xs font-bold tabular-nums ${isPos ? "text-green-400" : "text-red-400"}`}>
                      {isPos ? "+" : ""}{asset.change.toFixed(2)}%
                    </p>
                  </div>

                  <span className="text-white/20 group-hover:text-white/50 transition text-sm flex-shrink-0">→</span>
                </div>
              )
            })}
          </div>
        )}

        {!loading && displayed.length > 0 && (
          <p className="text-center text-xs text-white/20 mt-6">
            {displayed.length} signaux · Auto-refresh toutes les 2 min
          </p>
        )}
      </div>
    </div>
  )
}
