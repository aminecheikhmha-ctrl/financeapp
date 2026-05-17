"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts"

// ── Types ─────────────────────────────────────────────────────────────────────
type AssetResult = {
  symbol: string; name: string; category: "stock" | "crypto" | "etf"
  price: number; change: number; rsi: number
  ma20: number | null; ma50: number | null
  volume: number; volRatio: number
  score: number; signal: "ACHETER" | "ATTENDRE" | "ÉVITER"
}

type ScreenerData = {
  assets: AssetResult[]; top_buys: AssetResult[]; top_sells: AssetResult[]
  neutral: AssetResult[]; updated_at: string
}

type MarketIndex = { symbol: string; name: string; price: number; change: number }

type MarketSummary = {
  summary: string; sentiment: "bullish" | "bearish" | "neutral"
  date: string; top_movers: MarketIndex[]; market_data: MarketIndex[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const UP   = "#4ade80"
const DOWN = "#f87171"
const WARN = "#facc15"

function scoreColor(score: number) {
  if (score >= 70) return UP
  if (score >= 40) return WARN
  return DOWN
}

function signalStyle(signal: string) {
  if (signal === "ACHETER") return { bg: "rgba(74,222,128,0.12)", color: UP,   border: "rgba(74,222,128,0.25)" }
  if (signal === "ÉVITER")  return { bg: "rgba(248,113,113,0.12)", color: DOWN, border: "rgba(248,113,113,0.25)" }
  return { bg: "rgba(250,204,21,0.08)", color: WARN, border: "rgba(250,204,21,0.2)" }
}

function sentimentConfig(s: string) {
  if (s === "bullish")  return { label: "🟢 Haussier",  color: UP,   bg: "rgba(74,222,128,0.1)",   border: "rgba(74,222,128,0.25)"  }
  if (s === "bearish")  return { label: "🔴 Baissier",  color: DOWN, bg: "rgba(248,113,113,0.1)",  border: "rgba(248,113,113,0.25)" }
  return                       { label: "🟡 Neutre",    color: WARN, bg: "rgba(250,204,21,0.08)",  border: "rgba(250,204,21,0.2)"   }
}

function fmtPrice(p: number) {
  return p >= 1000 ? `$${p.toLocaleString("en-US", { maximumFractionDigits: 0 })}` : `$${p.toFixed(2)}`
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
}

function categoryLabel(c: string) {
  return c === "stock" ? "Actions" : c === "crypto" ? "Crypto" : "ETF"
}

// ── Asset card ────────────────────────────────────────────────────────────────
function AssetCard({ asset, onClick }: { asset: AssetResult; onClick: () => void }) {
  const { bg, color, border } = signalStyle(asset.signal)
  const sc = scoreColor(asset.score)
  const up = asset.change >= 0

  return (
    <div
      onClick={onClick}
      className="rounded-xl p-3.5 cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99]"
      style={{ background: "#0d0d0d", border: "1px solid #1a1a1a", borderLeft: `3px solid ${color}` }}
    >
      {/* Top row */}
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-white font-black text-sm">{asset.symbol.replace("-USD", "")}</span>
            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: "rgba(255,255,255,0.06)", color: "#555" }}>
              {categoryLabel(asset.category)}
            </span>
          </div>
          <p className="text-[10px] text-gray-600 mt-0.5 truncate max-w-[130px]">{asset.name}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-white font-bold text-sm tabular-nums">{fmtPrice(asset.price)}</p>
          <p className="text-[11px] font-semibold tabular-nums" style={{ color: up ? UP : DOWN }}>
            {up ? "+" : ""}{asset.change.toFixed(2)}%
          </p>
        </div>
      </div>

      {/* Score bar */}
      <div className="mb-2">
        <div className="flex justify-between items-center mb-1">
          <span className="text-[9px] text-gray-600 uppercase tracking-widest">Score IA</span>
          <span className="text-[11px] font-black tabular-nums" style={{ color: sc }}>{asset.score}</span>
        </div>
        <div className="h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${asset.score}%`, background: `linear-gradient(90deg, ${sc}99, ${sc})` }} />
        </div>
      </div>

      {/* Bottom row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[10px] font-mono">
          <span style={{ color: asset.rsi > 70 ? DOWN : asset.rsi < 30 ? UP : "#555" }}>
            RSI {asset.rsi}
          </span>
          {asset.ma20 != null && (
            <span style={{ color: asset.price > asset.ma20 ? UP : DOWN }}>
              MA20 {asset.price > asset.ma20 ? "▲" : "▼"}
            </span>
          )}
        </div>
        <span className="text-[9px] font-black px-2 py-0.5 rounded-md" style={{ background: bg, color, border: `1px solid ${border}` }}>
          {asset.signal}
        </span>
      </div>
    </div>
  )
}

// ── Market index card ─────────────────────────────────────────────────────────
function IndexCard({ d }: { d: MarketIndex }) {
  const up = d.change >= 0
  return (
    <div className="rounded-xl p-3 flex-1 min-w-[90px]" style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>
      <p className="text-[9px] text-gray-600 uppercase tracking-widest mb-1">{d.symbol.replace("-USD", "")}</p>
      <p className="text-white font-black text-sm tabular-nums">{fmtPrice(d.price)}</p>
      <p className="text-[11px] font-bold tabular-nums mt-0.5" style={{ color: up ? UP : DOWN }}>
        {up ? "+" : ""}{d.change.toFixed(2)}%
      </p>
    </div>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function Skeleton({ h = "h-5", w = "w-full" }: { h?: string; w?: string }) {
  return <div className={`${h} ${w} rounded-lg animate-pulse`} style={{ background: "#151515" }} />
}

// ══════════════════════════════════════════════════════════════════════════════
// BACKTEST TAB
// ══════════════════════════════════════════════════════════════════════════════

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
  { id: "rsi_reversal",  label: "RSI Reversal", icon: "📉", desc: "Achat RSI < 30, vente RSI > 70. Idéal pour les marchés en range." },
  { id: "ma_crossover",  label: "MA Crossover",  icon: "✂️", desc: "Achat quand EMA9 croise EMA21 à la hausse, vente inverse." },
  { id: "bb_bounce",     label: "BB Bounce",     icon: "🎯", desc: "Achat sur la bande basse de Bollinger, vente sur la bande haute." },
  { id: "macd_cross",    label: "MACD Cross",    icon: "⚡", desc: "Achat quand le MACD croise au-dessus du signal, vente inverse." },
  { id: "confluence_3",  label: "Confluence 3+", icon: "🔗", desc: "Achat si 3+ indicateurs alignés haussiers simultanément." },
]

function fmtCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n)
}
function fmtDateBt(d: string) {
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" }).format(new Date(d))
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

function EquityTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg px-3 py-2 text-sm" style={{ background: "#111", border: "1px solid #222" }}>
      <p className="text-[10px]" style={{ color: "#666" }}>{label}</p>
      <p className="text-white font-bold">{fmtCurrency(payload[0].value)}</p>
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
      const items = (data?.quotes ?? []).filter((r: any) => r.symbol && r.shortname).slice(0, 6)
        .map((r: any) => ({ symbol: r.symbol, name: r.shortname }))
      setSearchResults(items)
      setShowSearch(items.length > 0)
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
      {/* Form */}
      <div className="rounded-2xl p-5 space-y-5" style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>
        <h2 className="text-base font-black">Paramètres</h2>

        {/* Symbol */}
        <div ref={searchRef}>
          <p className="text-[9px] uppercase tracking-widest font-bold mb-2" style={{ color: "#444" }}>Symbole</p>
          <div className="relative">
            <input
              type="text" value={symbol}
              onChange={e => handleSearch(e.target.value)}
              onFocus={() => searchResults.length > 0 && setShowSearch(true)}
              placeholder="AAPL, NVDA, BTC-USD…"
              className="w-full px-4 py-2.5 rounded-xl font-mono text-sm text-white outline-none transition"
              style={{ background: "#111", border: "1px solid #222" }}
            />
            {showSearch && (
              <div className="absolute top-full left-0 right-0 mt-1 rounded-xl overflow-hidden z-20 shadow-2xl" style={{ background: "#0d0d0d", border: "1px solid #222" }}>
                {searchResults.map(r => (
                  <button key={r.symbol} onClick={() => { setSymbol(r.symbol); setSearchResults([]); setShowSearch(false) }}
                    className="w-full flex items-center justify-between px-4 py-2.5 text-left transition hover:brightness-125"
                    style={{ background: "#0d0d0d" }}>
                    <span className="text-white font-mono font-bold text-sm">{r.symbol}</span>
                    <span className="text-[11px] truncate ml-3" style={{ color: "#666" }}>{r.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Strategy */}
        <div>
          <p className="text-[9px] uppercase tracking-widest font-bold mb-2" style={{ color: "#444" }}>Stratégie</p>
          <div className="grid grid-cols-5 gap-1.5 mb-2">
            {BT_STRATEGIES.map(s => (
              <button key={s.id} onClick={() => setStrategy(s.id)}
                className="flex flex-col items-center gap-1 px-2 py-2 rounded-xl text-[10px] font-bold transition"
                style={{
                  background: strategy === s.id ? "rgba(74,222,128,0.1)" : "#111",
                  border: `1px solid ${strategy === s.id ? "rgba(74,222,128,0.3)" : "#1a1a1a"}`,
                  color: strategy === s.id ? UP : "#555",
                }}>
                <span className="text-base">{s.icon}</span>
                <span className="text-center leading-tight">{s.label}</span>
              </button>
            ))}
          </div>
          {strat && (
            <p className="text-[11px] px-3 py-2 rounded-lg" style={{ background: "#111", color: "#777" }}>
              <span className="font-bold" style={{ color: UP }}>{strat.icon} {strat.label}</span> — {strat.desc}
            </p>
          )}
        </div>

        {/* Dates + capital */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div>
            <p className="text-[9px] uppercase tracking-widest font-bold mb-2" style={{ color: "#444" }}>Date début</p>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none"
              style={{ background: "#111", border: "1px solid #222" }} />
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-widest font-bold mb-2" style={{ color: "#444" }}>Date fin</p>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none"
              style={{ background: "#111", border: "1px solid #222" }} />
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-widest font-bold mb-2" style={{ color: "#444" }}>Capital initial</p>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: "#555" }}>$</span>
              <input type="number" value={capital} onChange={e => setCapital(Number(e.target.value))} min={100}
                className="w-full pl-7 pr-3 py-2.5 rounded-xl text-sm text-white outline-none"
                style={{ background: "#111", border: "1px solid #222" }} />
            </div>
          </div>
        </div>

        {/* TP / SL */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="flex justify-between mb-2">
              <p className="text-[9px] uppercase tracking-widest font-bold" style={{ color: "#444" }}>Take Profit</p>
              <span className="text-xs font-black" style={{ color: UP }}>{tpPct}%</span>
            </div>
            <input type="range" min={1} max={50} step={0.5} value={tpPct}
              onChange={e => setTpPct(Number(e.target.value))}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer outline-none"
              style={{
                background: `linear-gradient(to right, #4ade80 0%, #4ade80 ${((tpPct - 1) / 49) * 100}%, #2d2d2d ${((tpPct - 1) / 49) * 100}%, #2d2d2d 100%)`,
                accentColor: "#4ade80",
              }} />
          </div>
          <div>
            <div className="flex justify-between mb-2">
              <p className="text-[9px] uppercase tracking-widest font-bold" style={{ color: "#444" }}>Stop Loss</p>
              <span className="text-xs font-black" style={{ color: DOWN }}>{slPct}%</span>
            </div>
            <input type="range" min={0.5} max={30} step={0.5} value={slPct}
              onChange={e => setSlPct(Number(e.target.value))}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer outline-none"
              style={{
                background: `linear-gradient(to right, #f87171 0%, #f87171 ${((slPct - 0.5) / 29.5) * 100}%, #2d2d2d ${((slPct - 0.5) / 29.5) * 100}%, #2d2d2d 100%)`,
                accentColor: "#f87171",
              }} />
          </div>
        </div>

        <button onClick={runBacktest} disabled={loading || !symbol}
          className="w-full py-3 rounded-xl text-sm font-black uppercase tracking-wider transition disabled:opacity-40"
          style={{ background: "#4ade80", color: "#000" }}>
          {loading ? "⟳ Simulation en cours…" : "Lancer le backtest"}
        </button>
        {error && <p className="text-center text-xs" style={{ color: DOWN }}>{error}</p>}
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Badge header */}
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{
            background: pos ? "rgba(74,222,128,0.08)" : "rgba(248,113,113,0.08)",
            border: `1px solid ${pos ? "rgba(74,222,128,0.2)" : "rgba(248,113,113,0.2)"}`,
          }}>
            <span className="text-xl">{pos ? "✅" : "❌"}</span>
            <div className="flex-1">
              <p className="text-white font-bold text-sm">{result.symbol} — {BT_STRATEGIES.find(s => s.id === result.strategy)?.label}</p>
              <p className="text-[10px]" style={{ color: "#555" }}>{fmtDateBt(result.period.start)} → {fmtDateBt(result.period.end)} · {result.period.candles} séances</p>
            </div>
            <div className="text-right">
              <p className="text-xl font-black tabular-nums" style={{ color: pos ? UP : DOWN }}>
                {result.total_return >= 0 ? "+" : ""}{fmtN(result.total_return)}%
              </p>
              <p className="text-[10px]" style={{ color: "#555" }}>Rendement total</p>
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            <BtKPI label="Win Rate"      value={`${fmtN(result.win_rate, 1)}%`}     sub={`${result.winning_trades}W / ${result.losing_trades}L`} positive={result.win_rate >= 50} />
            <BtKPI label="Rendement"     value={`${result.total_return >= 0 ? "+" : ""}${fmtN(result.total_return)}%`}  positive={result.total_return >= 0} />
            <BtKPI label="Max Drawdown"  value={`-${fmtN(result.max_drawdown)}%`}   positive={result.max_drawdown < 10} />
            <BtKPI label="Sharpe"        value={fmtN(result.sharpe_ratio)}           positive={result.sharpe_ratio >= 1} />
            <BtKPI label="Profit Factor" value={fmtN(result.profit_factor)}         positive={result.profit_factor >= 1} />
            <BtKPI label="Trades"        value={String(result.total_trades)}         sub={`Moy. ${fmtN(result.avg_trade_return)}%`} />
          </div>

          {/* Best / Worst */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: "rgba(74,222,128,0.07)", border: "1px solid rgba(74,222,128,0.15)" }}>
              <span className="text-lg">🏆</span>
              <div><p className="text-[9px] uppercase tracking-widest font-bold" style={{ color: "#444" }}>Meilleur trade</p>
              <p className="text-lg font-black" style={{ color: UP }}>+{fmtN(result.best_trade)}%</p></div>
            </div>
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: "rgba(248,113,113,0.07)", border: "1px solid rgba(248,113,113,0.15)" }}>
              <span className="text-lg">📉</span>
              <div><p className="text-[9px] uppercase tracking-widest font-bold" style={{ color: "#444" }}>Pire trade</p>
              <p className="text-lg font-black" style={{ color: DOWN }}>{fmtN(result.worst_trade)}%</p></div>
            </div>
          </div>

          {/* Equity curve */}
          <div className="rounded-2xl p-5" style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>
            <p className="text-sm font-black mb-4">Courbe d'équité</p>
            <ResponsiveContainer width="100%" height={220}>
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
                <Tooltip content={<EquityTooltip />} />
                <Area type="monotone" dataKey="value" stroke={pos ? "#22c55e" : "#ef4444"} strokeWidth={1.5} fill="url(#eqGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Trades table */}
          {result.trades.length > 0 && (
            <div className="rounded-2xl overflow-hidden" style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>
              <div className="px-5 py-3 border-b" style={{ borderColor: "#1a1a1a" }}>
                <p className="text-sm font-black">Trades ({result.trades.length})</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ color: "#444" }}>
                      {["Entrée", "Sortie", "Prix ent.", "Prix sort.", "Raison", "P&L", "%"].map(h => (
                        <th key={h} className={`px-4 py-2.5 font-semibold uppercase tracking-widest text-[9px] border-b ${h === "Prix ent." || h === "Prix sort." || h === "P&L" || h === "%" ? "text-right" : "text-left"}`} style={{ borderColor: "#1a1a1a" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.trades.map((t, i) => (
                      <tr key={i} className="transition-colors hover:brightness-125 border-b" style={{ borderColor: "#111" }}>
                        <td className="px-4 py-2.5 font-mono" style={{ color: "#777" }}>{t.date}</td>
                        <td className="px-4 py-2.5 font-mono" style={{ color: "#777" }}>{t.exit_date}</td>
                        <td className="px-4 py-2.5 text-right text-white font-mono">${t.price.toFixed(2)}</td>
                        <td className="px-4 py-2.5 text-right text-white font-mono">${t.exit_price.toFixed(2)}</td>
                        <td className="px-4 py-2.5 text-center">
                          <span className="text-[9px] px-2 py-0.5 rounded-full font-bold" style={{
                            background: t.exit_reason === "tp" ? "rgba(74,222,128,0.15)" : t.exit_reason === "sl" ? "rgba(248,113,113,0.15)" : "rgba(255,255,255,0.06)",
                            color: t.exit_reason === "tp" ? UP : t.exit_reason === "sl" ? DOWN : "#888",
                          }}>
                            {t.exit_reason === "tp" ? "TP" : t.exit_reason === "sl" ? "SL" : "Signal"}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right font-bold font-mono" style={{ color: t.pnl >= 0 ? UP : DOWN }}>
                          {t.pnl >= 0 ? "+" : ""}{fmtCurrency(t.pnl)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-bold font-mono" style={{ color: t.return_pct >= 0 ? UP : DOWN }}>
                          {t.return_pct >= 0 ? "+" : ""}{t.return_pct.toFixed(2)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {result.trades.length === 0 && (
            <div className="text-center py-10" style={{ color: "#555" }}>
              <p>Aucun trade généré. Essaie une période plus longue ou une autre stratégie.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function AnalysesPage() {
  const router = useRouter()

  const [screener,      setScreener]      = useState<ScreenerData | null>(null)
  const [summary,       setSummary]       = useState<MarketSummary | null>(null)
  const [loadScreener,  setLoadScreener]  = useState(true)
  const [loadSummary,   setLoadSummary]   = useState(true)
  const [filter,        setFilter]        = useState<"all" | "stock" | "crypto" | "etf">("all")
  const [showAllBuys,   setShowAllBuys]   = useState(false)
  const [tab,           setTab]           = useState<"screener" | "market" | "backtest">("market")

  // ── Auth guard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.push("/login")
    })
  }, [router])

  // ── Fetch screener ──────────────────────────────────────────────────────────
  const fetchScreener = useCallback(async (force = false) => {
    setLoadScreener(true)
    try {
      const res  = await fetch(`/api/screener${force ? `?t=${Date.now()}` : ""}`)
      const data = await res.json()
      setScreener(data)
    } catch {}
    setLoadScreener(false)
  }, [])

  // ── Fetch market summary ────────────────────────────────────────────────────
  const fetchSummary = useCallback(async (force = false) => {
    setLoadSummary(true)
    try {
      const res  = await fetch(`/api/market-summary${force ? `?t=${Date.now()}` : ""}`)
      const data = await res.json()
      setSummary(data)
    } catch {}
    setLoadSummary(false)
  }, [])

  // ── Load both in parallel on mount ─────────────────────────────────────────
  useEffect(() => {
    Promise.all([fetchScreener(), fetchSummary()])
  }, [fetchScreener, fetchSummary])

  // ── Filtered screener assets ────────────────────────────────────────────────
  const filtered = screener
    ? (filter === "all" ? screener.assets : screener.assets.filter(a => a.category === filter))
    : []

  const filteredBuys  = filtered.filter(a => a.signal === "ACHETER")
  const filteredSells = filtered.filter(a => a.signal === "ÉVITER")
  const displayBuys   = showAllBuys ? filteredBuys : filteredBuys.slice(0, 10)
  const displaySells  = filteredSells.slice(0, 5)

  const sent = summary ? sentimentConfig(summary.sentiment) : null

  return (
    <div className="min-h-screen text-white" style={{ background: "#080808" }}>
      <div className="max-w-6xl mx-auto px-5 py-6">

        {/* ── Page header ─────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black tracking-tight">Analyses IA</h1>
            <p className="text-gray-600 text-sm mt-0.5">Screener algorithmique · Briefing de marché Groq LLaMA</p>
          </div>
          {sent && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl font-bold text-sm"
              style={{ background: sent.bg, color: sent.color, border: `1px solid ${sent.border}` }}>
              {sent.label}
            </div>
          )}
        </div>

        {/* ── Tabs ────────────────────────────────────────────────────────── */}
        <div className="flex gap-1 mb-6 p-1 rounded-xl" style={{ background: "#111" }}>
          {[
            { key: "market",   label: "📰 Résumé de marché" },
            { key: "screener", label: "🔍 Screener IA"       },
            { key: "backtest", label: "📊 Backtest"           },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key as any)}
              className="flex-1 py-2 rounded-lg text-sm font-bold transition-all"
              style={{
                background: tab === t.key ? "#1a1a1a" : "transparent",
                color: tab === t.key ? "#fff" : "#555",
                border: tab === t.key ? "1px solid #2a2a2a" : "1px solid transparent",
              }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* MARKET SUMMARY TAB                                                */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {tab === "market" && (
          <div className="space-y-5">

            {/* Section header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black">Résumé de marché</h2>
                {summary && (
                  <p className="text-[10px] text-gray-600 mt-0.5">
                    Généré le {new Date(summary.date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })} à {fmtTime(summary.date)}
                  </p>
                )}
              </div>
              <button onClick={() => fetchSummary(true)} disabled={loadSummary}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition disabled:opacity-40"
                style={{ background: "#111", border: "1px solid #222", color: "#888" }}>
                {loadSummary ? <><span className="w-3 h-3 border border-gray-500 border-t-transparent rounded-full animate-spin" /> Chargement...</> : "↻ Régénérer"}
              </button>
            </div>

            {/* Briefing */}
            <div className="rounded-2xl p-5" style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>
              {loadSummary ? (
                <div className="space-y-3">
                  {[100, 90, 95, 75, 88, 70].map((w, i) => <Skeleton key={i} w={`w-[${w}%]`} />)}
                </div>
              ) : summary ? (
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    {sent && (
                      <span className="text-xs font-black px-3 py-1 rounded-full" style={{ background: sent.bg, color: sent.color, border: `1px solid ${sent.border}` }}>
                        {sent.label}
                      </span>
                    )}
                    <span className="text-[10px] text-gray-600">Groq LLaMA 3.3 · Yahoo Finance</span>
                  </div>
                  <div className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{summary.summary}</div>
                </div>
              ) : (
                <p className="text-gray-600 text-sm text-center py-4">Impossible de charger le briefing</p>
              )}
            </div>

            {/* Index cards */}
            <div>
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Indices et actifs majeurs</h3>
              {loadSummary ? (
                <div className="flex gap-2 flex-wrap">
                  {Array.from({ length: 7 }).map((_, i) => (
                    <div key={i} className="flex-1 min-w-[90px] h-16 rounded-xl animate-pulse" style={{ background: "#151515" }} />
                  ))}
                </div>
              ) : summary ? (
                <div className="flex gap-2 flex-wrap">
                  {summary.market_data.map(d => <IndexCard key={d.symbol} d={d} />)}
                </div>
              ) : null}
            </div>

            {/* Top movers */}
            {summary?.top_movers && (
              <div>
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Plus grandes variations</h3>
                <div className="grid grid-cols-3 gap-3">
                  {summary.top_movers.map(d => {
                    const up = d.change >= 0
                    return (
                      <div key={d.symbol} className="rounded-xl p-4" style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-black text-white">{d.symbol.replace("-USD", "")}</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                            style={{ background: up ? "rgba(74,222,128,0.1)" : "rgba(248,113,113,0.1)", color: up ? UP : DOWN }}>
                            {up ? "+" : ""}{d.change.toFixed(2)}%
                          </span>
                        </div>
                        <p className="text-gray-600 text-[10px]">{d.name}</p>
                        <p className="text-white font-bold text-base mt-1 tabular-nums">{fmtPrice(d.price)}</p>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* SCREENER TAB                                                      */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {tab === "screener" && (
          <div className="space-y-6">

            {/* Section header + controls */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-black">Screener IA</h2>
                {screener && !loadScreener && (
                  <p className="text-[10px] text-gray-600 mt-0.5">
                    {screener.assets.length} actifs scannés · Mis à jour à {fmtTime(screener.updated_at)}
                  </p>
                )}
              </div>

              {/* Controls row */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Category filters */}
                <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid #1a1a1a" }}>
                  {([["all", "Tout"], ["stock", "Actions"], ["crypto", "Crypto"], ["etf", "ETF"]] as const).map(([key, label]) => (
                    <button key={key} onClick={() => setFilter(key)}
                      className="px-3 py-1.5 text-[11px] font-bold transition-all"
                      style={{
                        background: filter === key ? "#1f2937" : "#0d0d0d",
                        color: filter === key ? "#60a5fa" : "#555",
                      }}>
                      {label}
                    </button>
                  ))}
                </div>

                {/* Refresh */}
                <button onClick={() => fetchScreener(true)} disabled={loadScreener}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition disabled:opacity-40"
                  style={{ background: "#111", border: "1px solid #222", color: "#888" }}>
                  {loadScreener
                    ? <><span className="w-3 h-3 border border-gray-500 border-t-transparent rounded-full animate-spin" /> Scan...</>
                    : "↻ Rafraîchir"}
                </button>
              </div>
            </div>

            {/* Stats pills */}
            {screener && !loadScreener && (
              <div className="flex gap-2 flex-wrap">
                {[
                  { label: "Opportunités d'achat", count: screener.top_buys.length,  color: UP   },
                  { label: "Signaux neutres",       count: screener.neutral.length,   color: WARN },
                  { label: "À éviter",              count: screener.top_sells.length, color: DOWN },
                ].map(s => (
                  <div key={s.label} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs"
                    style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>
                    <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                    <span className="text-gray-400">{s.label}</span>
                    <span className="font-black" style={{ color: s.color }}>{s.count}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Loading skeleton for screener */}
            {loadScreener && (
              <div className="space-y-4">
                <Skeleton h="h-5" w="w-40" />
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} className="h-28 rounded-xl animate-pulse" style={{ background: "#111" }} />
                  ))}
                </div>
              </div>
            )}

            {!loadScreener && (
              <>
                {/* ── Top Acheter ────────────────────────────────────────── */}
                {filteredBuys.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-2 h-2 rounded-full" style={{ background: UP }} />
                      <h3 className="text-sm font-black" style={{ color: UP }}>
                        Top Opportunités d'Achat
                      </h3>
                      <span className="text-[10px] text-gray-600">({filteredBuys.length} actifs · score ≥ 70)</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                      {displayBuys.map(a => (
                        <AssetCard key={a.symbol} asset={a} onClick={() => router.push(`/dashboard?symbol=${a.symbol}`)} />
                      ))}
                    </div>
                    {filteredBuys.length > 10 && (
                      <button onClick={() => setShowAllBuys(v => !v)}
                        className="mt-3 w-full py-2 rounded-xl text-xs font-semibold transition"
                        style={{ background: "#0d0d0d", border: "1px solid #1a1a1a", color: "#555" }}>
                        {showAllBuys ? "Afficher moins ▲" : `Voir tous les ${filteredBuys.length} ▼`}
                      </button>
                    )}
                  </div>
                )}

                {/* ── Top Éviter ─────────────────────────────────────────── */}
                {displaySells.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-2 h-2 rounded-full" style={{ background: DOWN }} />
                      <h3 className="text-sm font-black" style={{ color: DOWN }}>
                        Top À Éviter
                      </h3>
                      <span className="text-[10px] text-gray-600">({filteredSells.length} actifs · score &lt; 30)</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                      {displaySells.map(a => (
                        <AssetCard key={a.symbol} asset={a} onClick={() => router.push(`/dashboard?symbol=${a.symbol}`)} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Empty state */}
                {filteredBuys.length === 0 && filteredSells.length === 0 && (
                  <div className="text-center py-16">
                    <p className="text-gray-600 text-sm">Aucun signal fort sur cette catégorie</p>
                    <p className="text-gray-700 text-xs mt-1">Essaie "Tout" pour voir tous les actifs</p>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* BACKTEST TAB                                                       */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {tab === "backtest" && <BacktestTab />}

      </div>
    </div>
  )
}
