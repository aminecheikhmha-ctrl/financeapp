"use client"
import { useState, useEffect, useMemo, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts"
import { X, Plus } from "lucide-react"

const COLORS = ["#22c55e", "#60a5fa", "#f97316", "#a78bfa"]

type Stats = {
  change_1d: number
  change_1w: number
  change_1m: number
  change_3m: number
  change_1y: number
  rsi: number
  volume: number
}

type AssetData = {
  symbol: string
  name: string
  price: number
  change: number
  history: { date: string; normalized: number }[]
  stats: Stats
}

function CompareContent() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const [symbols,       setSymbols]       = useState<string[]>(
    searchParams.get("symbols")?.split(",").filter(Boolean).slice(0, 4) ?? ["AAPL", "MSFT"]
  )
  const [assets,        setAssets]        = useState<AssetData[]>([])
  const [loading,       setLoading]       = useState(false)
  const [search,        setSearch]        = useState("")
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [timeframe,     setTimeframe]     = useState<"1M" | "3M" | "6M" | "1Y">("3M")

  const RANGE_MAP: Record<string, string> = { "1M": "60d", "3M": "90d", "6M": "180d", "1Y": "365d" }

  useEffect(() => { if (symbols.length > 0) loadAll() }, [symbols, timeframe])

  async function loadAll() {
    setLoading(true)
    try {
      const results = await Promise.all(symbols.map(loadAsset))
      setAssets(results.filter(Boolean) as AssetData[])
    } catch {}
    setLoading(false)
  }

  async function loadAsset(sym: string): Promise<AssetData | null> {
    try {
      const [qRes, cRes] = await Promise.all([
        fetch(`/api/quote?symbol=${sym}`),
        fetch(`/api/alpaca/chart?symbol=${sym.replace("-USD", "")}&interval=1d&range=${RANGE_MAP[timeframe]}`),
      ])
      const quote = await qRes.json()
      const chart = await cRes.json()
      const bars  = Array.isArray(chart) ? chart : []
      const n     = bars.length
      const first = bars[0]?.close ?? 1

      const history = bars.map((b: any) => ({
        date: b.date ?? "",
        normalized: parseFloat(((b.close / first) * 100).toFixed(2)),
      }))

      const getChange = (days: number) => {
        if (n === 0) return 0
        const idx = Math.max(0, n - days)
        const old = bars[idx]?.close ?? bars[0]?.close ?? 1
        const cur = bars[n - 1]?.close ?? 1
        return parseFloat(((cur - old) / old * 100).toFixed(2))
      }

      return {
        symbol: sym,
        name:   quote.name ?? sym,
        price:  quote.price ?? 0,
        change: quote.change ?? 0,
        history,
        stats: {
          change_1d: quote.change ?? 0,
          change_1w: getChange(5),
          change_1m: getChange(21),
          change_3m: getChange(63),
          change_1y: getChange(252),
          rsi:    bars[n - 1]?.rsi ?? 50,
          volume: bars[n - 1]?.volume ?? 0,
        },
      }
    } catch { return null }
  }

  const chartData = useMemo(() => {
    if (assets.length === 0) return []
    const maxLen = Math.max(...assets.map(a => a.history.length))
    return Array.from({ length: maxLen }, (_, i) => {
      const pt: Record<string, any> = { date: assets[0].history[i]?.date ?? "" }
      assets.forEach(a => { pt[a.symbol] = a.history[i]?.normalized ?? null })
      return pt
    })
  }, [assets])

  async function handleSearch(q: string) {
    setSearch(q)
    if (!q) { setSearchResults([]); return }
    try {
      const res  = await fetch(`/api/search?q=${q}`)
      const data = await res.json()
      setSearchResults((data?.quotes ?? data ?? []).slice(0, 5))
    } catch {}
  }

  function addSymbol(sym: string) {
    if (symbols.includes(sym) || symbols.length >= 4) return
    setSymbols(prev => [...prev, sym])
    setSearch(""); setSearchResults([])
  }

  function removeSymbol(sym: string) {
    if (symbols.length <= 1) return
    setSymbols(prev => prev.filter(s => s !== sym))
  }

  const ROWS = [
    { label: "Prix actuel", key: "price",     fmt: (v: number) => `$${v.toFixed(2)}`,                                 color: false },
    { label: "Variation 1J", key: "change_1d", fmt: (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`,           color: true  },
    { label: "Variation 1S", key: "change_1w", fmt: (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`,           color: true  },
    { label: "Variation 1M", key: "change_1m", fmt: (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`,           color: true  },
    { label: "Variation 3M", key: "change_3m", fmt: (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`,           color: true  },
    { label: "Variation 1A", key: "change_1y", fmt: (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`,           color: true  },
    { label: "RSI (14)",     key: "rsi",       fmt: (v: number) => v.toFixed(1),                                      color: false },
  ]

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-canvas)" }}>
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-black text-white">Comparateur d'actifs</h1>
            <p className="text-xs mt-0.5" style={{ color: "#555" }}>Comparez jusqu'à 4 actifs côte à côte</p>
          </div>
          <div className="flex rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
            {(["1M", "3M", "6M", "1Y"] as const).map(tf => (
              <button key={tf} onClick={() => setTimeframe(tf)}
                className="px-4 py-2 text-xs font-bold transition-all"
                style={{ background: timeframe === tf ? "rgba(255,255,255,0.1)" : "transparent", color: timeframe === tf ? "#fff" : "rgba(255,255,255,0.3)" }}>
                {tf}
              </button>
            ))}
          </div>
        </div>

        {/* Chips + add */}
        <div className="flex flex-wrap gap-2 items-center">
          {symbols.map((sym, i) => (
            <div key={sym} className="flex items-center gap-2 px-3 py-2 rounded-xl"
              style={{ background: `${COLORS[i]}12`, border: `1px solid ${COLORS[i]}30` }}>
              <div className="w-2 h-2 rounded-full" style={{ background: COLORS[i] }} />
              <span className="text-sm font-bold" style={{ color: COLORS[i] }}>{sym.replace("-USD", "")}</span>
              {symbols.length > 1 && (
                <button onClick={() => removeSymbol(sym)} className="opacity-40 hover:opacity-100 transition">
                  <X size={12} color={COLORS[i]} />
                </button>
              )}
            </div>
          ))}

          {symbols.length < 4 && (
            <div className="relative">
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
                style={{ border: "1px dashed rgba(255,255,255,0.12)" }}>
                <Plus size={14} className="text-white/25" />
                <input value={search} onChange={e => handleSearch(e.target.value)}
                  placeholder="Ajouter un actif"
                  className="text-sm placeholder-white/20 outline-none bg-transparent w-28 text-white" />
              </div>
              {searchResults.length > 0 && (
                <div className="absolute top-full mt-1 left-0 w-52 rounded-xl overflow-hidden z-20 shadow-2xl"
                  style={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)" }}>
                  {searchResults.map(r => (
                    <button key={r.symbol} onClick={() => addSymbol(r.symbol)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition text-left">
                      <div>
                        <p className="text-sm font-bold text-white">{r.symbol}</p>
                        <p className="text-[10px] truncate max-w-[130px]" style={{ color: "#555" }}>{r.name ?? r.shortname}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Chart */}
        <div className="rounded-2xl p-5" style={{ background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-bold text-white">Performance comparative (base 100)</p>
            <p className="text-[10px]" style={{ color: "#333" }}>Base 100 = début de période</p>
          </div>
          {loading ? (
            <div className="h-64 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <XAxis dataKey="date" tick={{ fill: "#444", fontSize: 10 }} tickLine={false} axisLine={false}
                  tickFormatter={d => d?.slice(5) ?? ""} interval="preserveStartEnd" />
                <YAxis tick={{ fill: "#444", fontSize: 10 }} tickLine={false} axisLine={false}
                  tickFormatter={v => `${v}`} domain={["auto", "auto"]} />
                <Tooltip
                  contentStyle={{ background: "#111", border: "1px solid #222", borderRadius: 10, fontSize: 11 }}
                  formatter={(v: any, name: any) => [`${Number(v).toFixed(1)}`, name]}
                  labelStyle={{ color: "#666" }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {assets.map((a, i) => (
                  <Line key={a.symbol} type="monotone" dataKey={a.symbol}
                    stroke={COLORS[i]} strokeWidth={2} dot={false} connectNulls />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Stats table */}
        {assets.length > 0 && (
          <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
            <table className="w-full">
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  <th className="px-5 py-3 text-left text-[10px] uppercase tracking-widest font-bold" style={{ color: "rgba(255,255,255,0.2)" }}>Métrique</th>
                  {assets.map((a, i) => (
                    <th key={a.symbol} className="px-5 py-3 text-right text-[11px] font-black" style={{ color: COLORS[i] }}>
                      {a.symbol.replace("-USD", "")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {ROWS.map(row => (
                  <tr key={row.label} className="hover:bg-white/[0.01] transition">
                    <td className="px-5 py-3 text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{row.label}</td>
                    {assets.map(a => {
                      const raw   = row.key === "price" ? a.price : row.key === "rsi" ? a.stats.rsi : a.stats[row.key as keyof Stats]
                      const val   = raw as number
                      const up    = val >= 0
                      return (
                        <td key={a.symbol} className="px-5 py-3 text-right text-xs font-bold tabular-nums"
                          style={{ color: row.color ? (up ? "#4ade80" : "#f87171") : "rgba(255,255,255,0.7)" }}>
                          {row.fmt(val)}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Quick links */}
        <div className="flex gap-3 flex-wrap">
          {assets.map((a, i) => (
            <a key={a.symbol} href={`/dashboard?symbol=${a.symbol}`}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-[1.02]"
              style={{ background: `${COLORS[i]}12`, color: COLORS[i], border: `1px solid ${COLORS[i]}25` }}>
              {a.symbol.replace("-USD", "")} →
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function ComparePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-canvas)" }}>
        <div className="w-8 h-8 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <CompareContent />
    </Suspense>
  )
}
