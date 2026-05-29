"use client"
import { useState, useEffect, useMemo, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts"
import { Search } from "lucide-react"

// ── Phases de cycle ────────────────────────────────────────────────────────────
type CyclePhase =
  | "accumulation"
  | "tendance_forte"
  | "surchauffe"
  | "capitulation"
  | "distribution"
  | "recovery"

type AssetFlow = {
  symbol: string
  name: string
  type: "stock" | "crypto" | "etf" | "forex" | "commodity" | "index"
  region: "us" | "eu" | "asia" | "em" | "global" | "crypto"
  sector: string
  price: number
  change_1d: number
  change_1w: number
  change_1m: number
  change_ytd: number
  change_1y: number
  volume: number
  volume_ratio: number
  market_cap?: number
  phase: CyclePhase
  phase_score: number
  flow_strength: number
  sentiment_score: number
  sparkline: number[]
  breadth: number
}

const REGIONS = [
  { key: "all",    label: "🌍 Monde entier" },
  { key: "us",     label: "🇺🇸 États-Unis" },
  { key: "eu",     label: "🇪🇺 Europe" },
  { key: "asia",   label: "🌏 Asie" },
  { key: "em",     label: "🌐 Émergents" },
  { key: "crypto", label: "₿ Crypto" },
]

const SECTORS = [
  "Tous", "Technology", "Finance", "Healthcare", "Energy",
  "Consumer", "Industrials", "Real Estate", "Commodities",
  "AI & Robotics", "Luxury", "Automotive", "Defense",
]

const PHASE_CONFIG: Record<CyclePhase, { label: string; color: string; bg: string; desc: string }> = {
  accumulation:   { label: "Accumulation",   color: "#60a5fa", bg: "rgba(96,165,250,0.12)",  desc: "Smart money achète discrètement. Opportunité de fond." },
  tendance_forte: { label: "Tendance Forte", color: "#22c55e", bg: "rgba(34,197,94,0.12)",   desc: "Momentum haussier confirmé. Tendance en place." },
  surchauffe:     { label: "Surchauffé",     color: "#ef4444", bg: "rgba(239,68,68,0.12)",   desc: "Valorisation extrême. Danger de retournement." },
  capitulation:   { label: "Capitulation",   color: "#f97316", bg: "rgba(249,115,22,0.12)",  desc: "Vente panique. Potentiel point de fond." },
  distribution:   { label: "Distribution",   color: "#f59e0b", bg: "rgba(245,158,11,0.12)",  desc: "Smart money vend. Retournement proche." },
  recovery:       { label: "Recovery",       color: "#a78bfa", bg: "rgba(167,139,250,0.12)", desc: "Rebond après capitulation. Momentum qui revient." },
}

function computePhase(asset: Partial<AssetFlow>): CyclePhase {
  const change1m    = asset.change_1m    ?? 0
  const change1y    = asset.change_1y    ?? 0
  const volumeRatio = asset.volume_ratio ?? 1
  if (change1m < -15 && volumeRatio > 1.5 && change1y < -20) return "capitulation"
  if (change1m > 15  && change1y > 50    && volumeRatio > 1.3) return "surchauffe"
  if (change1m < -5  && change1y > 20    && volumeRatio > 1.2) return "distribution"
  if (Math.abs(change1m) < 5 && change1y < -10 && volumeRatio < 0.9) return "accumulation"
  if (change1m > 5  && change1y > 10) return "tendance_forte"
  if (change1m > 3  && change1y < 0)  return "recovery"
  return "tendance_forte"
}

function computeFlowStrength(change1d: number, change1w: number, volumeRatio: number): number {
  const momentum    = change1d * 0.4 + change1w * 0.6
  const volumeBoost = volumeRatio > 1.5 ? 1.3 : volumeRatio > 1.2 ? 1.1 : 1
  return Math.max(-100, Math.min(100, momentum * volumeBoost * 5))
}

// ── BacktestTab (preserved from original) ─────────────────────────────────────

type BacktestTrade = {
  date: string; exit_date: string; type: "buy" | "sell"
  price: number; exit_price: number
  exit_reason: "tp" | "sl" | "signal"
  return_pct: number; pnl: number
}
type BacktestResult = {
  symbol: string; strategy: string
  period: { start: string; end: string; candles: number }
  total_trades: number; winning_trades: number; losing_trades: number
  win_rate: number; total_return: number; max_drawdown: number
  sharpe_ratio: number; profit_factor: number; avg_trade_return: number
  best_trade: number; worst_trade: number
  trades: BacktestTrade[]
  equity_curve: { date: string; value: number }[]
}

const BT_STRATEGIES = [
  { id: "rsi_reversal", label: "RSI Reversal", icon: "📉", desc: "Achat RSI<30, vente RSI>70." },
  { id: "ma_crossover", label: "MA Crossover", icon: "✂️", desc: "Achat quand EMA9 croise EMA21." },
  { id: "bb_bounce",    label: "BB Bounce",    icon: "🎯", desc: "Achat bande basse Bollinger." },
  { id: "macd_cross",   label: "MACD Cross",   icon: "⚡", desc: "Achat quand MACD croise signal." },
  { id: "confluence_3", label: "Confluence 3+",icon: "🔗", desc: "3+ indicateurs alignés." },
]

const UP = "#4ade80", DOWN = "#f87171"

function fmtCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n)
}
function fmtN(n: number, dec = 2) { return n?.toFixed(dec) ?? "—" }

function BtKPI({ label, value, sub, positive }: { label: string; value: string; sub?: string; positive?: boolean }) {
  const color = positive === undefined ? "#fff" : positive ? UP : DOWN
  return (
    <div className="rounded-xl p-4" style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>
      <p className="text-[9px] uppercase tracking-widest font-bold mb-1" style={{ color: "#444" }}>{label}</p>
      <p className="text-xl font-black tabular-nums" style={{ color }}>{value}</p>
      {sub && <p className="text-[10px] mt-0.5" style={{ color: "#555" }}>{sub}</p>}
    </div>
  )
}

function BacktestTab() {
  const [symbol, setSymbol]       = useState("AAPL")
  const [strategy, setStrategy]   = useState("rsi_reversal")
  const [startDate, setStartDate] = useState(() => { const d = new Date(); d.setFullYear(d.getFullYear() - 1); return d.toISOString().slice(0, 10) })
  const [endDate, setEndDate]     = useState(() => new Date().toISOString().slice(0, 10))
  const [capital, setCapital]     = useState(10000)
  const [tpPct, setTpPct]         = useState(5)
  const [slPct, setSlPct]         = useState(3)
  const [loading, setLoading]     = useState(false)
  const [result, setResult]       = useState<BacktestResult | null>(null)
  const [error, setError]         = useState("")
  const [searchResults, setSearchResults] = useState<{ symbol: string; name: string }[]>([])
  const [showSearch, setShowSearch]       = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  async function handleSearch(q: string) {
    setSymbol(q.toUpperCase())
    if (q.length < 1) { setSearchResults([]); setShowSearch(false); return }
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      const items = (data?.quotes ?? []).filter((r: { symbol?: string; shortname?: string }) => r.symbol && r.shortname).slice(0, 6)
        .map((r: { symbol: string; shortname: string }) => ({ symbol: r.symbol, name: r.shortname }))
      setSearchResults(items); setShowSearch(items.length > 0)
    } catch {}
  }

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowSearch(false)
    }
    document.addEventListener("mousedown", handle)
    return () => document.removeEventListener("mousedown", handle)
  }, [])

  async function runBacktest() {
    setLoading(true); setError(""); setResult(null)
    try {
      const res = await fetch("/api/backtest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol, strategy, start_date: startDate, end_date: endDate, initial_capital: capital, tp_pct: tpPct, sl_pct: slPct }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? "Erreur inconnue"); return }
      setResult(data)
    } catch { setError("Erreur réseau") }
    setLoading(false)
  }

  const strat = BT_STRATEGIES.find(s => s.id === strategy)
  const pos = result ? result.total_return >= 0 : null

  return (
    <div className="space-y-5">
      <div className="rounded-2xl p-5 space-y-5" style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>
        <h2 className="text-base font-black text-white">Paramètres Backtest</h2>
        <div ref={searchRef}>
          <p className="text-[9px] uppercase tracking-widest font-bold mb-2 text-white/30">Symbole</p>
          <div className="relative">
            <input type="text" value={symbol} onChange={e => handleSearch(e.target.value)}
              onFocus={() => searchResults.length > 0 && setShowSearch(true)}
              placeholder="AAPL, NVDA, BTC-USD…"
              className="w-full px-4 py-2.5 rounded-xl font-mono text-sm text-white outline-none"
              style={{ background: "#111", border: "1px solid #222" }} />
            {showSearch && (
              <div className="absolute top-full left-0 right-0 mt-1 rounded-xl overflow-hidden z-20 shadow-2xl"
                style={{ background: "#0d0d0d", border: "1px solid #222" }}>
                {searchResults.map(r => (
                  <button key={r.symbol} onClick={() => { setSymbol(r.symbol); setSearchResults([]); setShowSearch(false) }}
                    className="w-full flex items-center justify-between px-4 py-2.5 hover:brightness-125"
                    style={{ background: "#0d0d0d" }}>
                    <span className="text-white font-mono font-bold text-sm">{r.symbol}</span>
                    <span className="text-[11px] truncate ml-3 text-white/40">{r.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div>
          <p className="text-[9px] uppercase tracking-widest font-bold mb-2 text-white/30">Stratégie</p>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 mb-2">
            {BT_STRATEGIES.map(s => (
              <button key={s.id} onClick={() => setStrategy(s.id)}
                className="flex flex-col items-center gap-1 px-2 py-2 rounded-xl text-[10px] font-bold transition"
                style={{ background: strategy === s.id ? "rgba(34,197,94,0.1)" : "#111", border: `1px solid ${strategy === s.id ? "rgba(34,197,94,0.3)" : "#1a1a1a"}`, color: strategy === s.id ? UP : "#555" }}>
                <span className="text-base">{s.icon}</span>
                <span className="text-center leading-tight">{s.label}</span>
              </button>
            ))}
          </div>
          {strat && <p className="text-[11px] px-3 py-2 rounded-lg text-white/50" style={{ background: "#111" }}>{strat.desc}</p>}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[["Date début", "date", startDate, setStartDate], ["Date fin", "date", endDate, setEndDate]].map(([label, type, val, setter]) => (
            <div key={label as string}>
              <p className="text-[9px] uppercase tracking-widest font-bold mb-2 text-white/30">{label as string}</p>
              <input type={type as string} value={val as string} onChange={e => (setter as (v: string) => void)(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none" style={{ background: "#111", border: "1px solid #222" }} />
            </div>
          ))}
          <div>
            <p className="text-[9px] uppercase tracking-widest font-bold mb-2 text-white/30">Capital</p>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-white/30">$</span>
              <input type="number" value={capital} onChange={e => setCapital(Number(e.target.value))}
                className="w-full pl-7 pr-3 py-2.5 rounded-xl text-sm text-white outline-none" style={{ background: "#111", border: "1px solid #222" }} />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[["TP", tpPct, setTpPct, 1, 50, 0.5, UP], ["SL", slPct, setSlPct, 0.5, 30, 0.5, DOWN]].map(([label, val, setter, min, max, step, color]) => (
            <div key={label as string}>
              <div className="flex justify-between mb-2">
                <p className="text-[9px] uppercase tracking-widest font-bold text-white/30">{label as string}</p>
                <span className="text-xs font-black" style={{ color: color as string }}>{val as number}%</span>
              </div>
              <input type="range" min={min as number} max={max as number} step={step as number} value={val as number}
                onChange={e => (setter as (v: number) => void)(Number(e.target.value))}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer outline-none"
                style={{ background: `linear-gradient(to right, ${color} 0%, ${color} ${(((val as number) - (min as number)) / ((max as number) - (min as number))) * 100}%, #2d2d2d ${(((val as number) - (min as number)) / ((max as number) - (min as number))) * 100}%, #2d2d2d 100%)` }} />
            </div>
          ))}
        </div>
        <button onClick={runBacktest} disabled={loading || !symbol}
          className="w-full py-3 rounded-xl text-sm font-black uppercase tracking-wider transition disabled:opacity-40"
          style={{ background: "#4ade80", color: "#000" }}>
          {loading ? "⟳ Simulation en cours…" : "Lancer le backtest"}
        </button>
        {error && <p className="text-center text-xs text-red-400">{error}</p>}
      </div>
      {result && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
            style={{ background: pos ? "rgba(74,222,128,0.08)" : "rgba(248,113,113,0.08)", border: `1px solid ${pos ? "rgba(74,222,128,0.2)" : "rgba(248,113,113,0.2)"}` }}>
            <span className="text-xl">{pos ? "✅" : "❌"}</span>
            <div className="flex-1">
              <p className="text-white font-bold text-sm">{result.symbol} — {BT_STRATEGIES.find(s => s.id === result.strategy)?.label}</p>
              <p className="text-[10px] text-white/30">{result.period.candles} séances</p>
            </div>
            <div className="text-right">
              <p className="text-xl font-black tabular-nums" style={{ color: pos ? UP : DOWN }}>{result.total_return >= 0 ? "+" : ""}{fmtN(result.total_return)}%</p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
            <BtKPI label="Win Rate" value={`${fmtN(result.win_rate, 1)}%`} sub={`${result.winning_trades}W / ${result.losing_trades}L`} positive={result.win_rate >= 50} />
            <BtKPI label="Rendement" value={`${result.total_return >= 0 ? "+" : ""}${fmtN(result.total_return)}%`} positive={result.total_return >= 0} />
            <BtKPI label="Max DD" value={`-${fmtN(result.max_drawdown)}%`} positive={result.max_drawdown < 10} />
            <BtKPI label="Sharpe" value={fmtN(result.sharpe_ratio)} positive={result.sharpe_ratio >= 1} />
            <BtKPI label="Profit F." value={fmtN(result.profit_factor)} positive={result.profit_factor >= 1} />
            <BtKPI label="Trades" value={String(result.total_trades)} sub={`Moy. ${fmtN(result.avg_trade_return)}%`} />
          </div>
          <div className="rounded-2xl p-5" style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>
            <p className="text-sm font-black mb-4 text-white">Courbe d&apos;équité</p>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={result.equity_curve} margin={{ top: 5, right: 5, left: 10, bottom: 5 }}>
                <defs>
                  <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={pos ? "#22c55e" : "#ef4444"} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={pos ? "#22c55e" : "#ef4444"} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#151515" />
                <XAxis dataKey="date" tick={{ fill: "#444", fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={d => d.slice(5)} interval="preserveStartEnd" />
                <YAxis tick={{ fill: "#444", fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} width={42} />
                <Tooltip contentStyle={{ background: "#111", border: "1px solid #222", color: "#fff", fontSize: 11 }} />
                <Area type="monotone" dataKey="value" stroke={pos ? "#22c55e" : "#ef4444"} strokeWidth={1.5} fill="url(#eqGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════════
export default function AnalysesPage() {
  const router = useRouter()
  const [assets, setAssets]           = useState<AssetFlow[]>([])
  const [loading, setLoading]         = useState(true)
  const [region, setRegion]           = useState("all")
  const [sector, setSector]           = useState("Tous")
  const [search, setSearch]           = useState("")
  const [view, setView]               = useState<"heatmap" | "table" | "flow" | "backtest">("heatmap")
  const [lastUpdate, setLastUpdate]   = useState<Date | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch("/api/screener")
      const data = await res.json()
      const raw  = data.assets ?? data ?? []
      const enriched: AssetFlow[] = raw.map((a: AssetFlow & { volRatio?: number; category?: string }) => ({
        symbol:         a.symbol,
        name:           a.name,
        type:           (a.category ?? a.type ?? "stock") as AssetFlow["type"],
        region:         a.symbol.includes("USD") ? "crypto" : "us" as AssetFlow["region"],
        sector:         a.sector ?? "Other",
        price:          a.price ?? 0,
        change_1d:      a.change_1d ?? 0,
        change_1w:      a.change_1w ?? 0,
        change_1m:      a.change_1m ?? 0,
        change_ytd:     a.change_ytd ?? 0,
        change_1y:      a.change_1y ?? 0,
        volume:         a.volume ?? 0,
        volume_ratio:   a.volume_ratio ?? a.volRatio ?? 1,
        market_cap:     a.market_cap,
        breadth:        50,
        phase:          computePhase(a),
        phase_score:    Math.max(0, Math.min(100, 50 + (a.change_1m ?? 0) * 2)),
        flow_strength:  computeFlowStrength(a.change_1d ?? 0, a.change_1w ?? 0, a.volume_ratio ?? a.volRatio ?? 1),
        sentiment_score: Math.max(-100, Math.min(100, (a.change_1d ?? 0) * 5 + (a.change_1w ?? 0) * 2)),
        sparkline:      (a as AssetFlow).sparkline ?? Array.from({ length: 30 }, (_, i) => 100 + Math.sin(i * 0.3) * (a.change_1m ?? 0) * 0.5),
      }))
      setAssets(enriched)
      setLastUpdate(new Date())
    } catch (e) { console.error(e) }
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // Macro stats
  const macroStats = useMemo(() => {
    if (!assets.length) return null
    const up = assets.filter(a => a.change_1d > 0).length
    const avgFlow = assets.reduce((s, a) => s + a.flow_strength, 0) / assets.length
    const phaseCounts = assets.reduce((acc, a) => { acc[a.phase] = (acc[a.phase] ?? 0) + 1; return acc }, {} as Record<string, number>)
    const dominantPhase = Object.entries(phaseCounts).sort((a, b) => b[1] - a[1])[0]?.[0] as CyclePhase
    const avgSentiment  = assets.reduce((s, a) => s + a.sentiment_score, 0) / assets.length
    return { up, down: assets.length - up, avgFlow, dominantPhase, avgSentiment, total: assets.length }
  }, [assets])

  // Filtered + sorted
  const filtered = useMemo(() => {
    return assets.filter(a => {
      if (region !== "all" && a.region !== region) return false
      if (sector !== "Tous" && a.sector !== sector) return false
      if (search && !a.symbol.toLowerCase().includes(search.toLowerCase()) &&
          !a.name.toLowerCase().includes(search.toLowerCase()) &&
          !(a.sector ?? "").toLowerCase().includes(search.toLowerCase())) return false
      return true
    }).sort((a, b) => Math.abs(b.flow_strength) - Math.abs(a.flow_strength))
  }, [assets, region, sector, search])

  return (
    <div className="min-h-screen page-enter" style={{ background: "var(--bg-canvas)" }}>

      {/* ── HEADER ── */}
      <div className="px-6 py-5 border-b border-white/5">
        <div className="flex items-center justify-between flex-wrap gap-4 mb-5">
          <div>
            <h1 className="text-2xl font-black text-white">Analyses Macro</h1>
            <p className="text-white/30 text-sm mt-0.5">
              Où va l&apos;argent · {assets.length} actifs mondiaux
              {lastUpdate && ` · ${lastUpdate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`}
            </p>
          </div>
          <button onClick={loadData} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white/40 hover:text-white border border-white/8 hover:border-white/16 transition disabled:opacity-40">
            ↻ {loading ? "Chargement..." : "Actualiser"}
          </button>
        </div>

        {/* MACRO KPIs */}
        {macroStats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
            {[
              {
                label: "Flux global",
                value: macroStats.avgFlow > 10 ? "Entrant 🟢" : macroStats.avgFlow < -10 ? "Sortant 🔴" : "Neutre ⚪",
                sub: `Score ${macroStats.avgFlow.toFixed(0)}/100`,
                color: macroStats.avgFlow > 10 ? "#4ade80" : macroStats.avgFlow < -10 ? "#f87171" : "#9ca3af",
              },
              {
                label: "Phase dominante",
                value: PHASE_CONFIG[macroStats.dominantPhase]?.label ?? "—",
                sub: "Sur l'ensemble du marché",
                color: PHASE_CONFIG[macroStats.dominantPhase]?.color ?? "#fff",
              },
              {
                label: "Sentiment",
                value: macroStats.avgSentiment > 20 ? "Optimiste" : macroStats.avgSentiment < -20 ? "Pessimiste" : "Mixte",
                sub: `Score ${macroStats.avgSentiment.toFixed(0)}`,
                color: macroStats.avgSentiment > 20 ? "#4ade80" : macroStats.avgSentiment < -20 ? "#f87171" : "#fbbf24",
              },
              {
                label: "Breadth",
                value: `${macroStats.up}/${macroStats.total}`,
                sub: `${((macroStats.up / macroStats.total) * 100).toFixed(0)}% en hausse`,
                color: macroStats.up > macroStats.total / 2 ? "#4ade80" : "#f87171",
              },
              {
                label: "Régime",
                value: macroStats.avgFlow > 20 ? "Risk-On 🚀" : macroStats.avgFlow < -20 ? "Risk-Off 🛡️" : "Transition ↔️",
                sub: "Appétit pour le risque",
                color: macroStats.avgFlow > 20 ? "#4ade80" : macroStats.avgFlow < -20 ? "#60a5fa" : "#fbbf24",
              },
            ].map(kpi => (
              <div key={kpi.label} className="rounded-2xl p-4"
                style={{ background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.06)" }}>
                <p className="text-[9px] text-white/25 uppercase tracking-widest mb-2">{kpi.label}</p>
                <p className="text-sm font-black" style={{ color: kpi.color }}>{kpi.value}</p>
                <p className="text-[10px] text-white/25 mt-0.5">{kpi.sub}</p>
              </div>
            ))}
          </div>
        )}

        {/* FORCE GAUGE */}
        {macroStats && (
          <div className="mb-5">
            <div className="flex items-center justify-between text-[10px] text-white/30 mb-2">
              <span>🔴 Capitulation</span>
              <span className="font-bold text-white text-xs">
                Force du marché —{" "}
                {macroStats.avgFlow < -30 ? "Capitulation" :
                 macroStats.avgFlow < -10 ? "Faible" :
                 macroStats.avgFlow <  10 ? "Neutre" :
                 macroStats.avgFlow <  30 ? "Fort" : "Tendance Forte"}
              </span>
              <span>🟢 Tendance Forte</span>
            </div>
            <div className="relative h-3 rounded-full overflow-hidden"
              style={{ background: "linear-gradient(90deg, #ef4444, #f97316, #fbbf24, #84cc16, #22c55e)" }}>
              <div className="absolute top-0 bottom-0 w-1 bg-white rounded-full shadow-lg transition-all duration-500"
                style={{ left: `${Math.max(2, Math.min(97, ((macroStats.avgFlow + 100) / 200) * 100))}%`, transform: "translateX(-50%)" }} />
            </div>
          </div>
        )}

        {/* FILTERS */}
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Tech, Luxe, IA..."
              className="h-8 pl-8 pr-3 rounded-lg text-xs text-white placeholder-white/20 outline-none"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", width: 180 }} />
          </div>

          <div className="flex gap-1 flex-wrap">
            {REGIONS.map(r => (
              <button key={r.key} onClick={() => setRegion(r.key)}
                className={`h-8 px-3 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                  region === r.key ? "bg-white/10 text-white border border-white/15" : "text-white/30 hover:text-white/60 border border-transparent"
                }`}>
                {r.label}
              </button>
            ))}
          </div>

          <div className="overflow-x-auto scrollbar-hide">
            <div className="flex gap-1">
              {SECTORS.map(s => (
                <button key={s} onClick={() => setSector(s)}
                  className={`flex-shrink-0 h-8 px-3 rounded-lg text-[11px] font-bold transition-all ${
                    sector === s ? "bg-white/10 text-white border border-white/15" : "text-white/25 hover:text-white/50"
                  }`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="ml-auto flex rounded-lg overflow-hidden border border-white/8">
            {[
              { key: "heatmap",  icon: "⬛", label: "Heatmap" },
              { key: "table",    icon: "☰",  label: "Tableau" },
              { key: "flow",     icon: "↔",  label: "Flux" },
              { key: "backtest", icon: "📊", label: "Backtest" },
            ].map(v => (
              <button key={v.key} onClick={() => setView(v.key as typeof view)}
                className={`px-3 h-8 text-xs font-bold transition-all ${
                  view === v.key ? "bg-white/10 text-white" : "text-white/25 hover:text-white/50"
                }`}>
                {v.icon} <span className="hidden sm:inline">{v.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── BACKTEST ── */}
      {view === "backtest" && (
        <div className="px-6 py-4 max-w-4xl">
          <BacktestTab />
        </div>
      )}

      {/* ── HEATMAP ── */}
      {view === "heatmap" && !loading && (
        <div className="px-6 py-4">
          <p className="text-[10px] text-white/25 uppercase tracking-widest font-bold mb-4">
            Heatmap de flux · Couleur = Phase de cycle · Taille = Capitalisation
          </p>
          {Object.entries(
            filtered.reduce((acc, a) => {
              const sec = a.sector ?? "Autre"
              if (!acc[sec]) acc[sec] = []
              acc[sec].push(a)
              return acc
            }, {} as Record<string, AssetFlow[]>)
          ).map(([sectorName, sectorAssets]) => (
            <div key={sectorName} className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">{sectorName}</p>
                <div className="flex-1 h-px bg-white/5" />
                {(() => {
                  const avgFlow = sectorAssets.reduce((s, a) => s + a.flow_strength, 0) / sectorAssets.length
                  return (
                    <span className="text-[10px] font-bold"
                      style={{ color: avgFlow > 10 ? "#4ade80" : avgFlow < -10 ? "#f87171" : "#9ca3af" }}>
                      {avgFlow > 10 ? "▲ Inflow" : avgFlow < -10 ? "▼ Outflow" : "→ Neutre"} {Math.abs(avgFlow).toFixed(0)}
                    </span>
                  )
                })()}
              </div>
              <div className="flex flex-wrap gap-2">
                {sectorAssets.map(asset => {
                  const phaseConfig = PHASE_CONFIG[asset.phase]
                  const size = Math.max(70, Math.min(150, (asset.market_cap ?? asset.volume / 1e6) / 1e9 * 8 + 70))
                  return (
                    <button key={asset.symbol}
                      onClick={() => router.push(`/dashboard?symbol=${asset.symbol}`)}
                      className="rounded-2xl p-3 transition-all hover:scale-105 text-left relative overflow-hidden"
                      style={{ background: phaseConfig.bg, border: `1px solid ${phaseConfig.color}30`, width: size, minHeight: size * 0.75 }}>
                      <p className="text-xs font-black text-white truncate">{asset.symbol.replace("-USD", "")}</p>
                      <p className={`text-[11px] font-bold ${asset.change_1d >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {asset.change_1d >= 0 ? "+" : ""}{asset.change_1d.toFixed(1)}%
                      </p>
                      <p className="text-[8px] font-bold mt-1 truncate" style={{ color: phaseConfig.color }}>{phaseConfig.label}</p>
                      <div className="absolute top-2 right-2 text-[10px] text-white/50">
                        {asset.flow_strength > 15 ? "↑" : asset.flow_strength < -15 ? "↓" : "→"}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
          {loading && (
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
              {[...Array(24)].map((_, i) => (
                <div key={i} className="h-16 rounded-2xl animate-pulse" style={{ background: "#0a0a0a" }} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TABLE ── */}
      {view === "table" && (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                {["Actif", "Phase", "Flux", "1J", "1S", "1M", "YTD", "1 An", "Tendance 30J", ""].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[9px] text-white/25 uppercase tracking-widest font-bold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(10)].map((_, i) => (
                  <tr key={i}>{[...Array(9)].map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-4 animate-pulse rounded" style={{ background: "#111", width: 60 + j * 5 }} /></td>
                  ))}</tr>
                ))
              ) : filtered.map(asset => {
                const phaseConfig = PHASE_CONFIG[asset.phase]
                const flowUp = asset.flow_strength > 0
                return (
                  <tr key={asset.symbol}
                    className="border-b border-white/[0.04] hover:bg-white/[0.02] transition cursor-pointer"
                    onClick={() => router.push(`/dashboard?symbol=${asset.symbol}`)}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black text-black flex-shrink-0"
                          style={{ background: phaseConfig.color }}>
                          {asset.symbol.replace("-USD", "")[0]}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white">{asset.symbol.replace("-USD", "")}</p>
                          <p className="text-[9px] text-white/25 truncate max-w-[100px]">{asset.name?.slice(0, 18)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="group relative">
                        <span className="text-[9px] font-black px-2 py-1 rounded-full cursor-help"
                          style={{ background: phaseConfig.bg, color: phaseConfig.color, border: `1px solid ${phaseConfig.color}25` }}>
                          {phaseConfig.label}
                        </span>
                        <div className="absolute left-0 top-full mt-1 z-20 w-44 p-2 rounded-xl text-[10px] text-white/70 hidden group-hover:block"
                          style={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)" }}>
                          {phaseConfig.desc}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <div className="w-16 h-1.5 rounded-full bg-white/5 overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${Math.abs(asset.flow_strength)}%`, background: flowUp ? "#22c55e" : "#ef4444", marginLeft: flowUp ? "50%" : `${50 - Math.abs(asset.flow_strength) / 2}%` }} />
                        </div>
                        <span className={`text-[10px] font-bold ${flowUp ? "text-green-400" : "text-red-400"}`}>
                          {flowUp ? "↑" : "↓"}{Math.abs(asset.flow_strength).toFixed(0)}
                        </span>
                      </div>
                    </td>
                    {[asset.change_1d, asset.change_1w, asset.change_1m, asset.change_ytd, asset.change_1y].map((chg, i) => (
                      <td key={i} className="px-4 py-3">
                        <span className={`text-xs font-bold tabular-nums ${(chg ?? 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
                          {(chg ?? 0) >= 0 ? "+" : ""}{(chg ?? 0).toFixed(1)}%
                        </span>
                      </td>
                    ))}
                    <td className="px-4 py-3">
                      <div className="w-20 h-8">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={asset.sparkline.map((v, i) => ({ i, v }))} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
                            <defs>
                              <linearGradient id={`sg-${asset.symbol}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={asset.change_1m >= 0 ? "#22c55e" : "#ef4444"} stopOpacity={0.3} />
                                <stop offset="100%" stopColor={asset.change_1m >= 0 ? "#22c55e" : "#ef4444"} stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <Area type="monotone" dataKey="v" stroke={asset.change_1m >= 0 ? "#22c55e" : "#ef4444"} strokeWidth={1.5} fill={`url(#sg-${asset.symbol})`} dot={false} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <button className="text-[10px] font-bold px-2.5 py-1 rounded-lg text-white/30 hover:text-white hover:bg-white/8 transition">
                        Voir →
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {!loading && filtered.length === 0 && (
            <div className="text-center py-12 text-white/30">Aucun actif ne correspond aux filtres</div>
          )}
        </div>
      )}

      {/* ── FLOW VIEW ── */}
      {view === "flow" && (
        <div className="px-6 py-4">
          <p className="text-[10px] text-white/25 uppercase tracking-widest font-bold mb-4">
            Flux de capitaux — Inflow vs Outflow par zone
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl p-5" style={{ background: "#0a0a0a", border: "1px solid rgba(34,197,94,0.15)" }}>
              <p className="text-[10px] text-green-400/60 uppercase tracking-widest font-bold mb-4">▲ Top Inflow — L&apos;argent entre</p>
              {filtered.filter(a => a.flow_strength > 0).slice(0, 10).map(asset => (
                <button key={asset.symbol} onClick={() => router.push(`/dashboard?symbol=${asset.symbol}`)}
                  className="flex items-center gap-3 w-full py-2.5 border-b border-white/[0.04] last:border-0 hover:bg-white/3 transition">
                  <span className="text-sm font-bold text-white w-16 text-left">{asset.symbol.replace("-USD", "")}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                    <div className="h-full rounded-full bg-green-400" style={{ width: `${asset.flow_strength}%` }} />
                  </div>
                  <span className="text-xs font-black text-green-400 tabular-nums w-10 text-right">+{asset.flow_strength.toFixed(0)}</span>
                  <span className={`text-xs font-bold ${asset.change_1d >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {asset.change_1d >= 0 ? "+" : ""}{asset.change_1d.toFixed(1)}%
                  </span>
                </button>
              ))}
              {filtered.filter(a => a.flow_strength > 0).length === 0 && (
                <p className="text-white/20 text-xs py-4 text-center">Aucun inflow détecté</p>
              )}
            </div>
            <div className="rounded-2xl p-5" style={{ background: "#0a0a0a", border: "1px solid rgba(239,68,68,0.15)" }}>
              <p className="text-[10px] text-red-400/60 uppercase tracking-widest font-bold mb-4">▼ Top Outflow — L&apos;argent sort</p>
              {filtered.filter(a => a.flow_strength < 0).sort((a, b) => a.flow_strength - b.flow_strength).slice(0, 10).map(asset => (
                <button key={asset.symbol} onClick={() => router.push(`/dashboard?symbol=${asset.symbol}`)}
                  className="flex items-center gap-3 w-full py-2.5 border-b border-white/[0.04] last:border-0 hover:bg-white/3 transition">
                  <span className="text-sm font-bold text-white w-16 text-left">{asset.symbol.replace("-USD", "")}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                    <div className="h-full rounded-full bg-red-400" style={{ width: `${Math.abs(asset.flow_strength)}%` }} />
                  </div>
                  <span className="text-xs font-black text-red-400 tabular-nums w-10 text-right">{asset.flow_strength.toFixed(0)}</span>
                  <span className={`text-xs font-bold ${asset.change_1d >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {asset.change_1d >= 0 ? "+" : ""}{asset.change_1d.toFixed(1)}%
                  </span>
                </button>
              ))}
              {filtered.filter(a => a.flow_strength < 0).length === 0 && (
                <p className="text-white/20 text-xs py-4 text-center">Aucun outflow détecté</p>
              )}
            </div>
          </div>

          {/* Phase légende */}
          <div className="mt-8">
            <p className="text-[10px] text-white/25 uppercase tracking-widest font-bold mb-4">Légende — Phases de cycle de marché</p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {(Object.entries(PHASE_CONFIG) as [CyclePhase, typeof PHASE_CONFIG[CyclePhase]][]).map(([phase, cfg]) => (
                <div key={phase} className="rounded-2xl p-3" style={{ background: cfg.bg, border: `1px solid ${cfg.color}25` }}>
                  <p className="text-xs font-black mb-1" style={{ color: cfg.color }}>{cfg.label}</p>
                  <p className="text-[10px] text-white/50 leading-relaxed">{cfg.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
