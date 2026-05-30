"use client"
import { useState, useEffect, useMemo, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts"
import { X, Plus, TrendingUp } from "lucide-react"
import { formatPrice, formatChange } from "@/lib/format"

// ── Constants ─────────────────────────────────────────────────────────────────

const COLORS = ["#22c55e", "#60a5fa", "#f59e0b", "#a78bfa", "#f97316", "#f87171"]

// ── Types ─────────────────────────────────────────────────────────────────────

type AssetData = {
  symbol:    string
  name:      string
  price:     number
  change_1d: number
  change_1w: number
  change_1m: number
  change_3m: number
  change_1y: number
  rsi:       number
  volume:    number
  history:   { date: string; normalized: number }[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function computeCorrelation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length)
  if (n < 3) return 0
  const xs = x.slice(-n), ys = y.slice(-n)
  const mx = xs.reduce((a, b) => a + b, 0) / n
  const my = ys.reduce((a, b) => a + b, 0) / n
  const num = xs.reduce((s, xi, i) => s + (xi - mx) * (ys[i] - my), 0)
  const den = Math.sqrt(
    xs.reduce((s, xi) => s + (xi - mx) ** 2, 0) *
    ys.reduce((s, yi) => s + (yi - my) ** 2, 0)
  )
  return den === 0 ? 0 : parseFloat((num / den).toFixed(2))
}

// ── Main ──────────────────────────────────────────────────────────────────────

function CompareContent() {
  const searchParams = useSearchParams()
  const router       = useRouter()

  const [symbols,     setSymbols]     = useState<string[]>(
    searchParams.get("symbols")?.split(",").filter(Boolean).slice(0, 6) ?? ["AAPL", "MSFT"]
  )
  const [assets,      setAssets]      = useState<AssetData[]>([])
  const [loading,     setLoading]     = useState(false)
  const [period,      setPeriod]      = useState<"1M" | "3M" | "6M" | "1Y">("3M")
  const [search,      setSearch]      = useState("")
  const [results,     setResults]     = useState<any[]>([])
  const [aiVerdict,   setAiVerdict]   = useState("")
  const [loadingAI,   setLoadingAI]   = useState(false)
  const [correlation, setCorrelation] = useState<number | null>(null)

  const RANGE_MAP: Record<string, string> = { "1M": "60d", "3M": "90d", "6M": "180d", "1Y": "365d" }

  useEffect(() => {
    if (symbols.length > 0) loadAll()
  }, [symbols, period])

  async function loadAll() {
    setLoading(true)
    try {
      const results = await Promise.all(symbols.map(loadAsset))
      const valid   = results.filter(Boolean) as AssetData[]
      setAssets(valid)
      if (valid.length >= 2) {
        setCorrelation(computeCorrelation(
          valid[0].history.map(h => h.normalized),
          valid[1].history.map(h => h.normalized),
        ))
      } else {
        setCorrelation(null)
      }
    } catch {}
    setLoading(false)
    setAiVerdict("")
  }

  async function loadAsset(sym: string): Promise<AssetData | null> {
    try {
      const [qRes, cRes] = await Promise.all([
        fetch(`/api/quote?symbol=${sym}`),
        fetch(`/api/alpaca/chart?symbol=${sym.replace("-USD","")}&interval=1d&range=${RANGE_MAP[period]}`),
      ])
      const quote = await qRes.json()
      const bars: any[] = await cRes.json().then(d => Array.isArray(d) ? d : []).catch(() => [])
      const n     = bars.length
      const first = bars[0]?.close ?? 1

      const history = bars.map((b: any) => ({
        date:       b.date ?? "",
        normalized: parseFloat(((b.close / first) * 100).toFixed(2)),
      }))

      const getChange = (days: number) => {
        if (n === 0) return 0
        const idx = Math.max(0, n - days)
        const old = bars[idx]?.close ?? bars[0]?.close ?? 1
        const cur = bars[n - 1]?.close ?? 1
        return parseFloat(((cur - old) / old * 100).toFixed(2))
      }

      // RSI (14)
      const closes = bars.map((b: any) => b.close ?? 0)
      let rsi = 50
      if (closes.length >= 15) {
        const last = closes.slice(-15)
        let gains = 0, losses = 0
        for (let i = 1; i < last.length; i++) {
          const d = last[i] - last[i - 1]
          if (d > 0) gains += d; else losses -= d
        }
        const rs = losses === 0 ? 100 : gains / losses
        rsi = parseFloat((100 - 100 / (1 + rs)).toFixed(1))
      }

      return {
        symbol:    sym,
        name:      quote.name ?? sym,
        price:     quote.price ?? 0,
        change_1d: quote.change ?? getChange(1),
        change_1w: getChange(5),
        change_1m: getChange(21),
        change_3m: getChange(63),
        change_1y: getChange(252),
        rsi,
        volume:    quote.volume ?? 0,
        history,
      }
    } catch { return null }
  }

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
    if (!symbols.includes(sym) && symbols.length < 6) setSymbols(prev => [...prev, sym])
    setSearch(""); setResults([])
  }

  function removeSymbol(sym: string) {
    if (symbols.length <= 1) return
    setSymbols(prev => prev.filter(s => s !== sym))
    setAssets(prev => prev.filter(a => a.symbol !== sym))
  }

  async function generateVerdict() {
    if (assets.length < 2 || loadingAI) return
    setLoadingAI(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) { setAiVerdict("Connecte-toi pour utiliser l'analyse IA."); setLoadingAI(false); return }

      const summary = assets.map(a => ({
        symbol:    a.symbol,
        change_1m: a.change_1m.toFixed(1),
        change_3m: a.change_3m.toFixed(1),
        rsi:       a.rsi,
      }))
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          message: `Compare ces actifs en 3 phrases max : ${JSON.stringify(summary)}. Corrélation entre les 2 premiers : ${correlation?.toFixed(2) ?? "inconnue"}. Dis lequel performe mieux, pourquoi, et si la corrélation aide à la diversification.`,
          history: [],
        }),
      })
      const data = await res.json()
      setAiVerdict(data.reply ?? data.error ?? "Erreur lors de l'analyse.")
    } catch { setAiVerdict("Erreur réseau.") }
    setLoadingAI(false)
  }

  // Aligner toutes les dates
  const chartData = useMemo(() => {
    if (assets.length === 0) return []
    const dates = [...new Set(assets.flatMap(a => a.history.map(h => h.date)))].sort()
    return dates.map(date => {
      const pt: Record<string, any> = { date: date.slice(5) }
      assets.forEach(a => {
        const h = a.history.find(h => h.date === date)
        if (h) pt[a.symbol] = h.normalized
      })
      return pt
    })
  }, [assets])

  // Meilleur actif par métrique
  function best(fn: (a: AssetData) => number): string | null {
    if (assets.length < 2) return null
    return assets.reduce((b, a) => fn(a) > fn(b) ? a : b, assets[0]).symbol
  }

  const ROWS: { label: string; fn: (a: AssetData) => string; valFn?: (a: AssetData) => number; colorFn?: (a: AssetData) => string }[] = [
    { label: "Prix actuel",  fn: a => formatPrice(a.price) },
    { label: "Variation 1J", fn: a => formatChange(a.change_1d), valFn: a => a.change_1d, colorFn: a => a.change_1d >= 0 ? "#4ade80" : "#f87171" },
    { label: "Variation 1S", fn: a => formatChange(a.change_1w), valFn: a => a.change_1w, colorFn: a => a.change_1w >= 0 ? "#4ade80" : "#f87171" },
    { label: "Variation 1M", fn: a => formatChange(a.change_1m), valFn: a => a.change_1m, colorFn: a => a.change_1m >= 0 ? "#4ade80" : "#f87171" },
    { label: "Variation 3M", fn: a => formatChange(a.change_3m), valFn: a => a.change_3m, colorFn: a => a.change_3m >= 0 ? "#4ade80" : "#f87171" },
    { label: "Variation 1A", fn: a => formatChange(a.change_1y), valFn: a => a.change_1y, colorFn: a => a.change_1y >= 0 ? "#4ade80" : "#f87171" },
    { label: "RSI (14)",     fn: a => a.rsi.toFixed(1), colorFn: a => a.rsi < 30 ? "#4ade80" : a.rsi > 70 ? "#f87171" : "rgba(255,255,255,0.6)" },
  ]

  return (
    <div className="min-h-screen page-enter" style={{ background: "var(--bg-canvas)" }}>
      <div className="max-w-5xl mx-auto px-6 py-6">

        {/* HEADER */}
        <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-black text-white">Comparateur d'actifs</h1>
            <p className="text-white/30 text-sm mt-0.5">Performance base 100 · Jusqu'à 6 actifs</p>
          </div>
          <div className="flex rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
            {(["1M","3M","6M","1Y"] as const).map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-4 py-2 text-xs font-bold transition-all ${
                  period === p ? "bg-white/10 text-white" : "text-white/30 hover:text-white/60"
                }`}>
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* PILLS actifs + ajout */}
        <div className="flex flex-wrap gap-2 mb-6 items-center">
          {symbols.map((sym, i) => (
            <div key={sym} className="flex items-center gap-2 px-3 py-2 rounded-xl"
              style={{ background: `${COLORS[i]}15`, border: `1px solid ${COLORS[i]}30` }}>
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: COLORS[i] }} />
              <span className="text-sm font-black" style={{ color: COLORS[i] }}>{sym.replace("-USD","")}</span>
              {symbols.length > 1 && (
                <button onClick={() => removeSymbol(sym)} className="text-white/30 hover:text-white transition ml-1">
                  <X size={12} />
                </button>
              )}
            </div>
          ))}

          {symbols.length < 6 && (
            <div className="relative flex gap-2">
              <div className="relative">
                <input value={search} onChange={e => handleSearch(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && search.trim()) addFromSearch(search.toUpperCase().trim()) }}
                  placeholder="Ajouter — NVDA, SOL-USD…"
                  className="h-9 px-3 rounded-xl text-xs text-white placeholder-white/25 outline-none"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", minWidth: 170 }} />
                {results.length > 0 && (
                  <div className="absolute top-full mt-1 left-0 w-56 rounded-xl overflow-hidden z-30 shadow-2xl"
                    style={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)" }}>
                    {results.map(r => (
                      <button key={r.symbol} onClick={() => addFromSearch(r.symbol)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition text-left">
                        <p className="text-sm font-bold text-white">{r.symbol}</p>
                        <p className="text-[10px] text-white/30 truncate">{r.name ?? r.shortname}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button onClick={() => { if (search.trim()) addFromSearch(search.toUpperCase().trim()) }}
                disabled={!search.trim()}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-black disabled:opacity-40"
                style={{ background: "#22c55e" }}>
                <Plus size={14} />
              </button>
            </div>
          )}
        </div>

        {/* GRAPHE */}
        <div className="rounded-2xl p-5 mb-4"
          style={{ background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <p className="text-sm font-black text-white">Performance comparative (base 100)</p>
            <p className="text-[10px] text-white/25">Au-dessus de 100 = surperformance vs début de période</p>
          </div>
          {loading ? (
            <div className="h-72 skeleton rounded-xl" />
          ) : (
            <>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                  <XAxis dataKey="date" tick={{ fill: "#444", fontSize: 10 }}
                    tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fill: "#444", fontSize: 10 }}
                    tickLine={false} axisLine={false}
                    tickFormatter={v => `${v.toFixed(0)}`} domain={["auto","auto"]} />
                  <Tooltip
                    contentStyle={{ background: "#111", border: "1px solid #222", borderRadius: 8, fontSize: 11 }}
                    formatter={(v: any, name: any) => [`${Number(v).toFixed(1)}`, name]}
                    labelStyle={{ color: "#666" }} />
                  <ReferenceLine y={100} stroke="rgba(255,255,255,0.1)" strokeDasharray="4 4" />
                  {assets.map((a, i) => (
                    <Line key={a.symbol} type="monotone" dataKey={a.symbol}
                      stroke={COLORS[i]} strokeWidth={2} dot={false} connectNulls />
                  ))}
                </LineChart>
              </ResponsiveContainer>
              {/* Légende */}
              <div className="flex flex-wrap gap-4 mt-3">
                {assets.map((a, i) => (
                  <div key={a.symbol} className="flex items-center gap-2">
                    <div className="w-4 h-0.5 rounded" style={{ background: COLORS[i] }} />
                    <span className="text-[11px] font-black" style={{ color: COLORS[i] }}>{a.symbol.replace("-USD","")}</span>
                    <span className={`text-[10px] font-bold ${a.change_1m >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {a.change_1m >= 0 ? "+" : ""}{a.change_1m.toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* CORRÉLATION + VERDICT IA */}
        {assets.length >= 2 && !loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">

            {/* Corrélation */}
            <div className="rounded-2xl p-5"
              style={{ background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.06)" }}>
              <p className="text-sm font-black text-white mb-4">
                ⚡ Corrélation — {assets[0].symbol.replace("-USD","")} / {assets[1].symbol.replace("-USD","")}
              </p>
              {correlation !== null && (() => {
                const abs  = Math.abs(correlation)
                const col  = abs > 0.7 ? "#f59e0b" : abs > 0.4 ? "#60a5fa" : "#4ade80"
                const desc = abs > 0.8 ? "Très forte" : abs > 0.6 ? "Forte" : abs > 0.4 ? "Modérée" : "Faible"
                return (
                  <>
                    <div className="flex items-baseline gap-3 mb-3">
                      <p className="text-4xl font-black tabular-nums" style={{ color: col }}>
                        {correlation >= 0 ? "+" : ""}{correlation.toFixed(2)}
                      </p>
                      <div>
                        <p className="text-sm font-black" style={{ color: col }}>{desc}</p>
                        <p className="text-[10px] text-white/30">sur {period}</p>
                      </div>
                    </div>
                    {/* Barre */}
                    <div className="h-2 rounded-full bg-white/6 overflow-hidden mb-3">
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${abs * 100}%`, background: col, marginLeft: correlation < 0 ? `${(1-abs)*100}%` : 0 }} />
                    </div>
                    <p className="text-[11px] text-white/40 leading-relaxed">
                      {abs > 0.8
                        ? `${assets[0].symbol} et ${assets[1].symbol} évoluent quasi ensemble — diversification limitée.`
                        : abs > 0.5
                          ? "Corrélation modérée — diversification partielle."
                          : "Faible corrélation — bonne diversification entre ces actifs."}
                    </p>
                  </>
                )
              })()}
            </div>

            {/* Verdict IA */}
            <div className="rounded-2xl p-5"
              style={{ background: "rgba(139,92,246,0.05)", border: "1px solid rgba(139,92,246,0.18)" }}>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-black text-white">🤖 Verdict IA</p>
                {!aiVerdict && !loadingAI && (
                  <button onClick={generateVerdict}
                    className="text-[10px] font-black px-3 py-1.5 rounded-lg transition-all hover:scale-[1.02]"
                    style={{ background: "rgba(139,92,246,0.2)", color: "#a78bfa" }}>
                    Analyser →
                  </button>
                )}
                {aiVerdict && (
                  <button onClick={() => { setAiVerdict(""); generateVerdict() }}
                    className="text-[10px] text-white/25 hover:text-white/50 transition">
                    Relancer
                  </button>
                )}
              </div>
              {loadingAI ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-3 skeleton rounded" style={{ width: `${90 - i * 15}%` }} />
                  ))}
                </div>
              ) : aiVerdict ? (
                <p className="text-sm text-white/70 leading-relaxed">{aiVerdict}</p>
              ) : (
                <p className="text-sm text-white/25 italic">
                  Clique sur "Analyser" pour un verdict comparatif généré par IA.
                </p>
              )}
            </div>
          </div>
        )}

        {/* TABLE MÉTRIQUES */}
        {assets.length > 0 && !loading && (
          <div className="rounded-2xl overflow-hidden mb-6"
            style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="px-5 py-3 border-b border-white/5"
              style={{ background: "rgba(255,255,255,0.02)" }}>
              <p className="text-[10px] text-white/25 uppercase tracking-widest font-bold">Métriques détaillées</p>
            </div>
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <th className="px-5 py-3 text-left text-[9px] text-white/25 uppercase tracking-widest font-bold w-36">
                    Métrique
                  </th>
                  {assets.map((a, i) => (
                    <th key={a.symbol} className="px-4 py-3 text-right text-[9px] font-black uppercase tracking-widest"
                      style={{ color: COLORS[i] }}>
                      {a.symbol.replace("-USD","")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROWS.map(row => {
                  const bestSym = row.valFn ? best(row.valFn) : null
                  return (
                    <tr key={row.label}
                      className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.01] transition">
                      <td className="px-5 py-3 text-xs text-white/40 font-medium">{row.label}</td>
                      {assets.map((a, i) => {
                        const isBest = bestSym === a.symbol && assets.length > 1
                        const defColor = row.colorFn ? row.colorFn(a) : "rgba(255,255,255,0.65)"
                        return (
                          <td key={a.symbol} className="px-4 py-3 text-right">
                            <span className="text-sm font-black tabular-nums"
                              style={{ color: isBest ? COLORS[i] : defColor }}>
                              {isBest && <span className="mr-1 text-[10px]">★</span>}
                              {row.fn(a)}
                            </span>
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* BOUTONS TRADER */}
        {assets.length > 0 && !loading && (
          <div className="flex flex-wrap gap-3">
            {assets.map((a, i) => (
              <button key={a.symbol}
                onClick={() => router.push(`/dashboard?symbol=${a.symbol}`)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black transition-all hover:scale-[1.02]"
                style={{
                  background: `${COLORS[i]}15`,
                  color: COLORS[i],
                  border: `1px solid ${COLORS[i]}30`,
                }}>
                <TrendingUp size={14} />
                Trader {a.symbol.replace("-USD","")}
              </button>
            ))}
          </div>
        )}
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
