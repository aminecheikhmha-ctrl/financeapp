"use client"
import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Search, X, TrendingUp, Clock } from "lucide-react"

const POPULAR = [
  { symbol: "AAPL",    name: "Apple Inc.",      type: "stock"  },
  { symbol: "NVDA",    name: "NVIDIA Corp.",     type: "stock"  },
  { symbol: "TSLA",    name: "Tesla Inc.",       type: "stock"  },
  { symbol: "MSFT",    name: "Microsoft Corp.",  type: "stock"  },
  { symbol: "BTC-USD", name: "Bitcoin",          type: "crypto" },
  { symbol: "ETH-USD", name: "Ethereum",         type: "crypto" },
  { symbol: "SPY",     name: "S&P 500 ETF",      type: "etf"    },
  { symbol: "QQQ",     name: "Nasdaq 100 ETF",   type: "etf"    },
]

const TYPE_BADGES: Record<string, { label: string; color: string }> = {
  stock:    { label: "Action", color: "#60a5fa" },
  crypto:   { label: "Crypto", color: "#f59e0b" },
  etf:      { label: "ETF",    color: "#a78bfa" },
  equity:   { label: "Action", color: "#60a5fa" },
  index:    { label: "Indice", color: "#22c55e" },
}

export default function GlobalSearch({ onSelect }: { onSelect?: (sym: string) => void }) {
  const router       = useRouter()
  const [query,      setQuery]      = useState("")
  const [results,    setResults]    = useState<any[]>([])
  const [open,       setOpen]       = useState(false)
  const [loading,    setLoading]    = useState(false)
  const [recent,     setRecent]     = useState<string[]>([])
  const inputRef     = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const stored = localStorage.getItem("tradex_recent_searches")
    if (stored) { try { setRecent(JSON.parse(stored).slice(0, 5)) } catch {} }
  }, [])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  useEffect(() => {
    if (!query) { setResults([]); return }
    const t = setTimeout(async () => {
      setLoading(true)
      try {
        const res  = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
        const data = await res.json()
        setResults((Array.isArray(data) ? data : data?.quotes ?? []).slice(0, 8))
      } catch {}
      setLoading(false)
    }, 250)
    return () => clearTimeout(t)
  }, [query])

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        inputRef.current?.focus()
        setOpen(true)
      }
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [])

  function selectSymbol(sym: string) {
    const newRecent = [sym, ...recent.filter(r => r !== sym)].slice(0, 5)
    setRecent(newRecent)
    localStorage.setItem("tradex_recent_searches", JSON.stringify(newRecent))
    setQuery(""); setOpen(false)
    if (onSelect) onSelect(sym)
    else router.push(`/dashboard?symbol=${sym}`)
  }

  return (
    <div ref={containerRef} className="relative flex-1 max-w-xl">
      <div className="relative">
        {loading ? (
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
        ) : (
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/25 pointer-events-none" />
        )}
        <input
          ref={inputRef}
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder="Rechercher un actif... (⌘K)"
          className="w-full h-10 pl-10 pr-9 rounded-xl text-sm text-white placeholder-white/20 outline-none transition-all"
          style={{
            background: open ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.04)",
            border: `1px solid ${open ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.08)"}`,
          }}
        />
        {query && (
          <button onClick={() => { setQuery(""); setResults([]) }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/25 hover:text-white transition">
            <X size={13} />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute top-full mt-2 left-0 right-0 rounded-2xl overflow-hidden z-50 shadow-2xl"
          style={{ background: "#0d0d0d", border: "1px solid rgba(255,255,255,0.10)", maxHeight: 420, overflowY: "auto" }}>

          {query === "" ? (
            <>
              {recent.length > 0 && (
                <div className="px-3 pt-3 pb-1">
                  <p className="text-[9px] text-white/20 uppercase tracking-widest font-bold px-2 mb-1 flex items-center gap-1.5">
                    <Clock size={9} /> Récents
                  </p>
                  {recent.map(sym => (
                    <button key={sym} onClick={() => selectSymbol(sym)}
                      className="w-full flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-white/5 transition text-left">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black text-black bg-green-400 flex-shrink-0">
                        {sym.replace("-USD", "")[0]}
                      </div>
                      <span className="text-sm text-white/70 font-semibold">{sym.replace("-USD", "")}</span>
                    </button>
                  ))}
                </div>
              )}
              <div className="px-3 pb-3 pt-1">
                <p className="text-[9px] text-white/20 uppercase tracking-widest font-bold px-2 mb-1 flex items-center gap-1.5">
                  <TrendingUp size={9} /> Populaires
                </p>
                {POPULAR.map(item => {
                  const badge = TYPE_BADGES[item.type] ?? TYPE_BADGES.stock
                  return (
                    <button key={item.symbol} onClick={() => selectSymbol(item.symbol)}
                      className="w-full flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-white/5 transition text-left">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black text-black flex-shrink-0"
                        style={{ background: badge.color }}>
                        {item.symbol.replace("-USD", "")[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white font-bold">{item.symbol.replace("-USD", "")}</p>
                        <p className="text-[10px] text-white/30 truncate">{item.name}</p>
                      </div>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md flex-shrink-0"
                        style={{ background: `${badge.color}18`, color: badge.color }}>
                        {badge.label}
                      </span>
                    </button>
                  )
                })}
              </div>
            </>
          ) : results.length > 0 ? (
            <div className="py-2">
              {results.map(r => {
                const sym   = r.symbol ?? r.ticker ?? ""
                const name  = r.shortname ?? r.longname ?? r.name ?? sym
                const type  = (r.quoteType ?? r.type ?? "stock").toLowerCase()
                const badge = TYPE_BADGES[type] ?? TYPE_BADGES.stock
                return (
                  <button key={sym} onClick={() => selectSymbol(sym)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition text-left">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-black text-black flex-shrink-0"
                      style={{ background: badge.color }}>
                      {sym.replace("-USD", "")[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white">{sym.replace("-USD", "")}</p>
                      <p className="text-[10px] text-white/30 truncate">{name}</p>
                    </div>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-lg flex-shrink-0"
                      style={{ background: `${badge.color}12`, color: badge.color, border: `1px solid ${badge.color}20` }}>
                      {badge.label}
                    </span>
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="py-8 text-center">
              <p className="text-white/25 text-sm">Aucun résultat pour &quot;{query}&quot;</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
