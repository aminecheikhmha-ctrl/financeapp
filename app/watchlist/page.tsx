"use client"
import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Plus, Search, GitCompare, Trash2, TrendingUp, TrendingDown, X } from "lucide-react"
import { formatPrice } from "@/lib/format"
import { useLanguage } from "@/lib/i18n/context"

// ── Types ────────────────────────────────────────────────────────────────────

type WatchlistItem = {
  symbol:    string
  name:      string
  group:     "Actions" | "Crypto" | "ETF"
  price:     number
  change_1d: number
  change_1w: number
  change_1m: number
  volume:    number
  rsi:       number | null
  signal:    string | null
  sparkline: number[]   // 30 dernières closes
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getGroup(sym: string): WatchlistItem["group"] {
  if (sym.includes("-USD") || sym.includes("BTC") || sym.includes("ETH")) return "Crypto"
  if (["SPY","QQQ","IWM","DIA","GLD","TLT","XLF","XLK"].includes(sym)) return "ETF"
  return "Actions"
}

const DEFAULT_SYMBOLS = ["AAPL","NVDA","TSLA","MSFT","META","BTC-USD","ETH-USD","SPY","QQQ"]

// ── Mini sparkline SVG (inline, no Recharts overhead) ─────────────────────────

function Spark({ data, up }: { data: number[]; up: boolean }) {
  if (data.length < 2) return <div className="w-20 h-8 rounded bg-white/4" />
  const mn = Math.min(...data), mx = Math.max(...data), rng = mx - mn || 1
  const pts = data.map((v, i) => [
    (i / (data.length - 1)) * 80,
    30 - ((v - mn) / rng) * 26 - 1,
  ])
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ")
  const fill = `${path} L80,30 L0,30 Z`
  const c = up ? "#22c55e" : "#ef4444"
  return (
    <svg width="80" height="30" viewBox="0 0 80 30" className="overflow-visible">
      <path d={fill} fill={`${c}18`} />
      <path d={path} fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ── Signal badge ──────────────────────────────────────────────────────────────

function SignalBadge({ signal }: { signal: string | null }) {
  if (!signal || signal === "NEUTRE") return <span className="text-[9px] text-white/20">—</span>
  const map: Record<string, { label: string; color: string }> = {
    ACHAT_FORT: { label: "⚡ Fort",  color: "#22c55e" },
    ACHAT:      { label: "↗ Achat", color: "#4ade80" },
    VENTE_FORT: { label: "⚡ Vente", color: "#ef4444" },
    VENTE:      { label: "↘ Vente", color: "#f87171" },
  }
  const s = map[signal] ?? { label: signal, color: "#9ca3af" }
  return (
    <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full whitespace-nowrap"
      style={{ background: `${s.color}15`, color: s.color, border: `1px solid ${s.color}25` }}>
      {s.label}
    </span>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function WatchlistPage() {
  const router = useRouter()
  const { t } = useLanguage()
  const [items,    setItems]    = useState<WatchlistItem[]>([])
  const [loading,  setLoading]  = useState(true)
  const [symbols,  setSymbols]  = useState<string[]>(() => {
    if (typeof window === "undefined") return DEFAULT_SYMBOLS
    try { return JSON.parse(localStorage.getItem("watchlist_symbols") ?? "null") ?? DEFAULT_SYMBOLS } catch { return DEFAULT_SYMBOLS }
  })
  const [filter,   setFilter]   = useState("Tous")
  const [sortBy,   setSortBy]   = useState<"change_1d" | "change_1w" | "change_1m" | "rsi">("change_1d")
  const [selected, setSelected] = useState<string[]>([])
  const [search,   setSearch]   = useState("")
  const [results,  setResults]  = useState<any[]>([])

  // Persist symbols
  useEffect(() => { localStorage.setItem("watchlist_symbols", JSON.stringify(symbols)) }, [symbols])

  const loadData = useCallback(async () => {
    if (symbols.length === 0) { setItems([]); setLoading(false); return }
    setLoading(true)
    try {
      const all = await Promise.all(symbols.map(async (sym) => {
        try {
          const [quoteRes, chartRes] = await Promise.all([
            fetch(`/api/quote?symbol=${sym}`),
            fetch(`/api/alpaca/chart?symbol=${sym.replace("-USD","")}&interval=1d&range=30d`),
          ])
          const quote = await quoteRes.json()
          const bars: any[] = await chartRes.json().then(d => Array.isArray(d) ? d : []).catch(() => [])
          const n = bars.length
          const closes = bars.map(b => b.close ?? 0).filter(Boolean)

          const getChange = (days: number) => {
            if (n < days) return 0
            const old = bars[Math.max(0, n - days)]?.close ?? 1
            const cur = bars[n - 1]?.close ?? 1
            return ((cur - old) / old) * 100
          }

          // RSI (14) from bars
          let rsi: number | null = null
          if (closes.length >= 15) {
            const last14 = closes.slice(-15)
            let gains = 0, losses = 0
            for (let i = 1; i < last14.length; i++) {
              const d = last14[i] - last14[i - 1]
              if (d > 0) gains += d; else losses -= d
            }
            const rs = losses === 0 ? 100 : gains / losses
            rsi = parseFloat((100 - 100 / (1 + rs)).toFixed(1))
          }

          // Signal IA simple basé sur RSI + tendance
          let signal: string | null = null
          if (rsi !== null) {
            const trend1m = getChange(21)
            if (rsi < 30 && trend1m > 0)       signal = "ACHAT_FORT"
            else if (rsi < 40)                  signal = "ACHAT"
            else if (rsi > 70 && trend1m < 0)   signal = "VENTE_FORT"
            else if (rsi > 60)                  signal = "VENTE"
            else                                signal = "NEUTRE"
          }

          return {
            symbol:    sym,
            name:      quote.name ?? sym,
            group:     getGroup(sym),
            price:     quote.price ?? 0,
            change_1d: quote.change ?? getChange(1),
            change_1w: getChange(5),
            change_1m: getChange(21),
            volume:    quote.volume ?? 0,
            rsi,
            signal,
            sparkline: closes.slice(-30),
          } as WatchlistItem
        } catch { return null }
      }))
      setItems(all.filter(Boolean) as WatchlistItem[])
    } catch {}
    setLoading(false)
  }, [symbols])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push("/login"); return }
    })
    loadData()
    const id = setInterval(loadData, 60_000)
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

  function addFromSearch(sym: string) {
    if (!symbols.includes(sym)) setSymbols(prev => [...prev, sym])
    setSearch(""); setResults([])
  }

  function removeItem(sym: string) {
    setSymbols(prev => prev.filter(s => s !== sym))
    setItems(prev => prev.filter(i => i.symbol !== sym))
    setSelected(prev => prev.filter(s => s !== sym))
  }

  function toggleSelect(sym: string) {
    setSelected(prev => prev.includes(sym) ? prev.filter(s => s !== sym) : [...prev, sym])
  }

  const filtered = items
    .filter(i => {
      if (filter !== "Tous" && i.group !== filter) return false
      return true
    })
    .sort((a, b) => {
      if (sortBy === "rsi") return (a.rsi ?? 50) - (b.rsi ?? 50)
      return (b[sortBy] ?? 0) - (a[sortBy] ?? 0)
    })

  const up    = items.filter(i => i.change_1d > 0).length
  const down  = items.filter(i => i.change_1d < 0).length
  const avgCh = items.length > 0 ? items.reduce((s, i) => s + i.change_1d, 0) / items.length : 0
  const best  = items.length > 0 ? items.reduce((b, i) => i.change_1d > b.change_1d ? i : b, items[0]) : null

  return (
    <div className="min-h-screen page-enter" style={{ background: "transparent" }}>

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div className="px-6 py-5 border-b border-white/5">
        <div className="flex items-center justify-between flex-wrap gap-4 mb-4">
          <div>
            <h1 className="text-2xl font-black text-white">{t.watchlist.title}</h1>
            <p className="text-white/30 text-sm mt-0.5">
              {items.length} actifs · <span className="text-green-400">▲ {up}</span> · <span className="text-red-400">▼ {down}</span>
            </p>
          </div>

          {/* Comparer bouton */}
          <div className="flex gap-2">
            {selected.length >= 2 ? (
              <button
                onClick={() => router.push(`/compare?symbols=${selected.join(",")}`)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black text-black transition-all hover:scale-[1.02]"
                style={{ background: "#22c55e" }}>
                <GitCompare size={14} />
                {t.watchlist.compareBtn.replace("{n}", String(selected.length))}
              </button>
            ) : items.length >= 2 ? (
              <button
                onClick={() => router.push(`/compare?symbols=${items.slice(0, 4).map(i => i.symbol).join(",")}`)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border transition-all hover:bg-white/4"
                style={{ borderColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.4)" }}>
                <GitCompare size={14} />
                {t.watchlist.compareBtn.replace("{n}", String(items.slice(0, 4).length))}
              </button>
            ) : null}
          </div>
        </div>

        {/* KPIs */}
        {items.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {[
              { label: "Perf. moy. 1J", value: `${avgCh >= 0 ? "+" : ""}${avgCh.toFixed(2)}%`, color: avgCh >= 0 ? "#4ade80" : "#f87171" },
              { label: "En hausse",     value: `${up} / ${items.length}`,                       color: "#4ade80" },
              { label: "Meilleur",      value: best ? `${best.symbol.replace("-USD","")} +${best.change_1d.toFixed(1)}%` : "—", color: "#fbbf24" },
              { label: "Actifs suivis", value: `${items.length}`,                               color: "rgba(255,255,255,0.6)" },
            ].map(k => (
              <div key={k.label} className="rounded-xl p-3" style={{ background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.06)" }}>
                <p className="text-[10px] text-white/25 mb-1">{k.label}</p>
                <p className="text-sm font-black tabular-nums truncate" style={{ color: k.color }}>{k.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Search + add — un seul champ */}
        <div className="flex gap-2 mb-3">
          <div className="relative flex-1 max-w-sm">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25 pointer-events-none" />
            <input value={search} onChange={e => handleSearch(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && search.trim()) { addFromSearch(search.toUpperCase().trim()) } }}
              placeholder={t.watchlist.searchPlaceholder}
              className="w-full h-9 pl-8 pr-3 rounded-xl text-xs text-white placeholder-white/20 outline-none"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }} />
            {results.length > 0 && (
              <div className="absolute top-full mt-1 left-0 w-64 rounded-xl overflow-hidden z-30 shadow-2xl"
                style={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)" }}>
                {results.map(r => (
                  <button key={r.symbol} onClick={() => addFromSearch(r.symbol)}
                    className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-white/5 transition">
                    <div className="text-left">
                      <p className="text-sm font-bold text-white">{r.symbol}</p>
                      <p className="text-[10px] text-white/30 truncate max-w-[160px]">{r.name ?? r.shortname}</p>
                    </div>
                    <Plus size={13} className="text-green-400 flex-shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={() => { if (search.trim()) addFromSearch(search.toUpperCase().trim()) }}
            disabled={!search.trim()}
            className="flex items-center gap-1.5 h-9 px-4 rounded-xl text-xs font-black text-black disabled:opacity-40 transition-all hover:scale-[1.02]"
            style={{ background: "#22c55e" }}>
            <Plus size={13} /> Ajouter
          </button>
        </div>

        {/* Filtres + tri */}
        <div className="flex items-center gap-2 flex-wrap">
          {["Tous","Actions","Crypto","ETF"].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                filter === f ? "bg-white/10 text-white border border-white/15" : "text-white/30 hover:text-white/60"
              }`}>
              {f}
            </button>
          ))}
          <div className="h-4 w-px bg-white/10 mx-1" />
          <span className="text-[10px] text-white/25">Trier :</span>
          {([
            { key: "change_1d", label: "1J" },
            { key: "change_1w", label: "1S" },
            { key: "change_1m", label: "1M" },
            { key: "rsi",       label: "RSI" },
          ] as const).map(s => (
            <button key={s.key} onClick={() => setSortBy(s.key)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                sortBy === s.key ? "bg-white/10 text-white" : "text-white/25 hover:text-white/60"
              }`}>
              {s.label} {sortBy === s.key ? "↓" : ""}
            </button>
          ))}
          {selected.length > 0 && (
            <span className="ml-auto text-[10px] text-green-400 font-bold">
              {selected.length} sélectionné{selected.length > 1 ? "s" : ""} — clique sur Comparer
            </span>
          )}
        </div>
      </div>

      {/* ── TABLE ──────────────────────────────────────────────────────────── */}
      <div className="px-6 py-4">
        {loading ? (
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => <div key={i} className="h-16 skeleton rounded-2xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">⭐</p>
            <p className="font-black text-white mb-2">{items.length === 0 ? t.watchlist.empty : t.common.noResults}</p>
            <p className="text-white/40 text-sm">
              {items.length === 0 ? t.watchlist.emptyDesc : t.watchlist.emptyDesc}
            </p>
          </div>
        ) : (
          <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>

            {/* Table header */}
            <div className="hidden md:grid px-5 py-3 border-b border-white/5 items-center"
              style={{
                gridTemplateColumns: "20px 1fr 110px 72px 72px 72px 52px 90px 88px 60px",
                gap: "12px",
                background: "rgba(255,255,255,0.025)",
              }}>
              <div />
              {[t.watchlist.columns.asset, t.watchlist.columns.price, t.watchlist.columns.day, t.watchlist.columns.week, t.watchlist.columns.month, t.watchlist.columns.rsi, "30d", t.watchlist.columns.signal, ""].map(h => (
                <p key={h} className="text-[9px] text-white/25 uppercase tracking-widest font-bold text-right first:text-left">{h}</p>
              ))}
            </div>

            {/* Rows */}
            {filtered.map(item => {
              const up1d  = item.change_1d >= 0
              const isSel = selected.includes(item.symbol)
              return (
                <div key={item.symbol}
                  className="group border-b border-white/[0.04] last:border-0 transition-colors hover:bg-white/[0.02]"
                  style={{ background: isSel ? "rgba(34,197,94,0.03)" : undefined }}>

                  {/* ── Desktop row ── */}
                  <div className="hidden md:grid px-5 py-3.5 items-center"
                    style={{
                      gridTemplateColumns: "20px 1fr 110px 72px 72px 72px 52px 90px 88px 60px",
                      gap: "12px",
                    }}>

                    {/* Checkbox */}
                    <button onClick={() => toggleSelect(item.symbol)}
                      className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-all"
                      style={{
                        background: isSel ? "#22c55e" : "rgba(255,255,255,0.07)",
                        border: `1px solid ${isSel ? "#22c55e" : "rgba(255,255,255,0.12)"}`,
                      }}>
                      {isSel && <span className="text-[8px] text-black font-black">✓</span>}
                    </button>

                    {/* Actif */}
                    <button onClick={() => router.push(`/dashboard?symbol=${item.symbol}`)}
                      className="flex items-center gap-3 text-left">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-[11px] font-black text-black flex-shrink-0"
                        style={{ background: up1d ? "#22c55e" : "#ef4444" }}>
                        {item.symbol.replace("-USD","")[0]}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-black text-white group-hover:text-green-400 transition-colors leading-tight">
                          {item.symbol.replace("-USD","")}
                        </p>
                        <p className="text-[10px] text-white/30 truncate max-w-[120px]">{item.name?.slice(0,22)}</p>
                      </div>
                    </button>

                    {/* Prix */}
                    <p className="text-sm font-black text-white tabular-nums text-right">{formatPrice(item.price)}</p>

                    {/* 1J */}
                    <p className={`text-xs font-bold tabular-nums text-right ${item.change_1d >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {item.change_1d >= 0 ? "+" : ""}{item.change_1d.toFixed(2)}%
                    </p>

                    {/* 1S */}
                    <p className={`text-xs font-bold tabular-nums text-right ${item.change_1w >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {item.change_1w >= 0 ? "+" : ""}{item.change_1w.toFixed(2)}%
                    </p>

                    {/* 1M */}
                    <p className={`text-xs font-bold tabular-nums text-right ${item.change_1m >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {item.change_1m >= 0 ? "+" : ""}{item.change_1m.toFixed(2)}%
                    </p>

                    {/* RSI */}
                    <p className={`text-xs font-black tabular-nums text-right ${
                      (item.rsi ?? 50) < 30 ? "text-green-400" :
                      (item.rsi ?? 50) > 70 ? "text-red-400" : "text-white/50"
                    }`}>
                      {item.rsi?.toFixed(0) ?? "—"}
                    </p>

                    {/* Sparkline */}
                    <div className="flex items-center justify-center">
                      <Spark data={item.sparkline} up={item.change_1m >= 0} />
                    </div>

                    {/* Signal */}
                    <div className="flex items-center justify-end">
                      <SignalBadge signal={item.signal} />
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => router.push(`/dashboard?symbol=${item.symbol}`)}
                        title="Trader"
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-white/30 hover:text-white hover:bg-white/8 transition">
                        <TrendingUp size={12} />
                      </button>
                      <button onClick={() => removeItem(item.symbol)}
                        title="Supprimer"
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-white/20 hover:text-red-400 hover:bg-red-500/10 transition">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>

                  {/* ── Mobile row ── */}
                  <div className="flex md:hidden items-center gap-3 px-4 py-3.5">
                    <button onClick={() => toggleSelect(item.symbol)}
                      className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
                      style={{
                        background: isSel ? "#22c55e" : "rgba(255,255,255,0.07)",
                        border: `1px solid ${isSel ? "#22c55e" : "rgba(255,255,255,0.12)"}`,
                      }}>
                      {isSel && <span className="text-[8px] text-black font-black">✓</span>}
                    </button>
                    <button onClick={() => router.push(`/dashboard?symbol=${item.symbol}`)}
                      className="flex items-center gap-2 flex-1 text-left">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-black text-black flex-shrink-0"
                        style={{ background: up1d ? "#22c55e" : "#ef4444" }}>
                        {item.symbol.replace("-USD","")[0]}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-black text-white">{item.symbol.replace("-USD","")}</p>
                        <p className="text-[10px] text-white/30">{item.name?.slice(0,18)}</p>
                      </div>
                    </button>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-black text-white tabular-nums">{formatPrice(item.price)}</p>
                      <p className={`text-xs font-bold tabular-nums ${up1d ? "text-green-400" : "text-red-400"}`}>
                        {up1d ? "+" : ""}{item.change_1d.toFixed(2)}%
                      </p>
                    </div>
                    <Spark data={item.sparkline} up={item.change_1m >= 0} />
                    <button onClick={() => removeItem(item.symbol)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-white/20 hover:text-red-400 transition flex-shrink-0">
                      <X size={12} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {filtered.length > 0 && (
          <p className="text-[10px] text-white/20 text-center mt-4">
            Coche des actifs pour les comparer · Clique sur un actif pour trader
          </p>
        )}
      </div>
    </div>
  )
}
