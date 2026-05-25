"use client"
import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { TrendingUp, TrendingDown, Plus, X, ArrowUpRight } from "lucide-react"
import { AreaChart, Area, ResponsiveContainer } from "recharts"
import { motion } from "framer-motion"

type WatchlistItem = {
  symbol: string
  name:   string
  price:  number
  change: number
  volume: number
  history: { value: number }[]
  group:  string
}

const DEFAULT_SYMBOLS = ["AAPL","NVDA","TSLA","MSFT","META","BTC-USD","ETH-USD","SOL-USD","SPY","QQQ"]

function getGroup(sym: string) {
  if (sym.includes("USD")) return "Crypto"
  if (["SPY","QQQ","IWM","DIA"].includes(sym)) return "ETF"
  return "Actions"
}

const GROUPS = ["Tous", "Actions", "Crypto", "ETF"]
const SORTS  = [{ key: "change", label: "Variation" }, { key: "alpha", label: "A-Z" }] as const

export default function WatchlistPage() {
  const router = useRouter()

  const [items,   setItems]   = useState<WatchlistItem[]>([])
  const [loading, setLoading] = useState(true)
  const [symbols, setSymbols] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("watchlist_symbols")
      if (stored) try { return JSON.parse(stored) } catch {}
    }
    return DEFAULT_SYMBOLS
  })
  const [activeGroup, setActiveGroup] = useState("Tous")
  const [sortBy,      setSortBy]      = useState<"change" | "alpha">("change")
  const [search,      setSearch]      = useState("")
  const [results,     setResults]     = useState<any[]>([])

  // Persist symbols
  useEffect(() => { localStorage.setItem("watchlist_symbols", JSON.stringify(symbols)) }, [symbols])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const data = await Promise.all(symbols.map(async sym => {
        const res  = await fetch(`/api/quote?symbol=${sym}`)
        const d    = await res.json()
        return {
          symbol:  sym,
          name:    d.name ?? sym,
          price:   d.price ?? 0,
          change:  d.change ?? 0,
          volume:  d.volume ?? 0,
          history: (d.history ?? []).map((v: any) => ({ value: typeof v === "number" ? v : v?.value ?? 0 })),
          group:   getGroup(sym),
        } as WatchlistItem
      }))
      setItems(data)
    } catch {}
    setLoading(false)
  }, [symbols])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push("/login"); return }
    })
    loadData()
    const id = setInterval(loadData, 30000)
    return () => clearInterval(id)
  }, [loadData])

  async function handleSearch(q: string) {
    setSearch(q)
    if (!q) { setResults([]); return }
    try {
      const res  = await fetch(`/api/search?q=${q}`)
      const data = await res.json()
      setResults((data?.quotes ?? data ?? []).slice(0, 5))
    } catch {}
  }

  function addSymbol(sym: string) {
    if (symbols.includes(sym)) return
    setSymbols(prev => [...prev, sym])
    setSearch(""); setResults([])
  }

  function removeSymbol(sym: string) {
    setSymbols(prev => prev.filter(s => s !== sym))
    setItems(prev => prev.filter(i => i.symbol !== sym))
  }

  const filtered = items
    .filter(item => activeGroup === "Tous" || item.group === activeGroup)
    .sort((a, b) => {
      if (sortBy === "change") return b.change - a.change
      return a.symbol.localeCompare(b.symbol)
    })

  const gainers = items.filter(i => i.change > 0).length
  const losers  = items.filter(i => i.change < 0).length

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-canvas)" }}>
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-black text-white">Ma Watchlist</h1>
            <div className="flex items-center gap-3 mt-0.5 text-xs" style={{ color: "#555" }}>
              <span>{items.length} actifs</span>
              {!loading && <><span className="text-green-400">▲ {gainers}</span><span className="text-red-400">▼ {losers}</span></>}
            </div>
          </div>

          {/* Add asset */}
          <div className="relative">
            <div className="flex items-center gap-2 h-10 px-3 rounded-xl"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <Plus size={14} className="text-white/30" />
              <input value={search} onChange={e => handleSearch(e.target.value)}
                placeholder="Ajouter un actif…"
                className="text-sm text-white placeholder-white/20 outline-none bg-transparent w-36" />
            </div>
            {results.length > 0 && (
              <div className="absolute top-full mt-1 right-0 w-56 rounded-xl overflow-hidden z-20 shadow-2xl"
                style={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)" }}>
                {results.map(r => (
                  <button key={r.symbol} onClick={() => addSymbol(r.symbol)}
                    className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-white/5 transition">
                    <div className="text-left">
                      <p className="text-sm font-bold text-white">{r.symbol}</p>
                      <p className="text-[10px] truncate max-w-[140px]" style={{ color: "#555" }}>{r.name ?? r.shortname}</p>
                    </div>
                    <Plus size={14} className="text-green-400 flex-shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 flex-nowrap" style={{ scrollbarWidth: "none" }}>
          {GROUPS.map(group => (
            <button key={group} onClick={() => setActiveGroup(group)}
              className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
              style={activeGroup === group
                ? { background: "rgba(255,255,255,0.1)", color: "#fff", border: "1px solid rgba(255,255,255,0.15)" }
                : { color: "rgba(255,255,255,0.3)", border: "1px solid transparent" }}>
              {group}
            </button>
          ))}
          <div className="w-px h-5 flex-shrink-0 mx-1" style={{ background: "rgba(255,255,255,0.08)" }} />
          {SORTS.map(s => (
            <button key={s.key} onClick={() => setSortBy(s.key)}
              className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
              style={sortBy === s.key
                ? { background: "rgba(255,255,255,0.08)", color: "#fff" }
                : { color: "rgba(255,255,255,0.25)" }}>
              {s.label}
            </button>
          ))}
          <button onClick={() => router.push(`/compare?symbols=${symbols.slice(0, 4).join(",")}`)}
            className="ml-auto flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
            style={{ color: "#60a5fa", border: "1px solid rgba(96,165,250,0.2)", background: "rgba(96,165,250,0.06)" }}>
            ⚡ Comparer
          </button>
        </div>

        {/* Table */}
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
          {/* Head */}
          <div className="grid px-5 py-3 border-b border-white/5"
            style={{ gridTemplateColumns: "1fr auto auto auto auto", gap: "1rem", background: "rgba(255,255,255,0.02)" }}>
            {["Actif", "Prix", "Variation", "7 jours", ""].map(h => (
              <p key={h} className="text-[9px] uppercase tracking-widest font-bold" style={{ color: "rgba(255,255,255,0.2)" }}>{h}</p>
            ))}
          </div>

          {loading ? (
            <div className="p-6 space-y-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-12 rounded-xl animate-pulse" style={{ background: "#111" }} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-3xl mb-3">📋</p>
              <p className="text-sm" style={{ color: "#555" }}>Aucun actif dans ce groupe</p>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {filtered.map((item, idx) => {
                const up = item.change >= 0
                return (
                  <motion.div key={item.symbol}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    className="grid items-center px-5 py-3.5 hover:bg-white/[0.02] transition-colors cursor-pointer"
                    style={{ gridTemplateColumns: "1fr auto auto auto auto", gap: "1rem" }}
                    onClick={() => router.push(`/dashboard?symbol=${item.symbol}`)}>

                    {/* Asset */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black text-black flex-shrink-0"
                        style={{ background: up ? "#22c55e" : "#ef4444" }}>
                        {item.symbol.replace("-USD", "")[0]}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-white">{item.symbol.replace("-USD", "")}</p>
                        <p className="text-[10px] truncate max-w-[120px]" style={{ color: "#555" }}>{item.name}</p>
                      </div>
                    </div>

                    {/* Price */}
                    <p className="text-sm font-bold text-white tabular-nums text-right">
                      {item.price < 1 ? `$${item.price.toFixed(4)}` : `$${item.price.toFixed(2)}`}
                    </p>

                    {/* Change */}
                    <div className="flex items-center gap-1 justify-end">
                      {up ? <TrendingUp size={13} className="text-green-400" /> : <TrendingDown size={13} className="text-red-400" />}
                      <span className={`text-sm font-bold tabular-nums ${up ? "text-green-400" : "text-red-400"}`}>
                        {up ? "+" : ""}{item.change.toFixed(2)}%
                      </span>
                    </div>

                    {/* Sparkline */}
                    <div className="w-20 h-8">
                      {item.history.length > 1 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={item.history} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
                            <defs>
                              <linearGradient id={`g-${item.symbol}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={up ? "#22c55e" : "#ef4444"} stopOpacity={0.3} />
                                <stop offset="100%" stopColor={up ? "#22c55e" : "#ef4444"} stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <Area type="monotone" dataKey="value"
                              stroke={up ? "#22c55e" : "#ef4444"} strokeWidth={1.5}
                              fill={`url(#g-${item.symbol})`} dot={false} />
                          </AreaChart>
                        </ResponsiveContainer>
                      ) : <div className="w-full h-full rounded animate-pulse" style={{ background: "#111" }} />}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        onClick={e => { e.stopPropagation(); router.push(`/dashboard?symbol=${item.symbol}`) }}
                        className="w-7 h-7 rounded-lg flex items-center justify-center transition text-white/30 hover:text-white hover:bg-white/8">
                        <ArrowUpRight size={13} />
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); removeSymbol(item.symbol) }}
                        className="w-7 h-7 rounded-lg flex items-center justify-center transition text-white/20 hover:text-red-400 hover:bg-red-500/10">
                        <X size={12} />
                      </button>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
