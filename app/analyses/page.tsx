"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import UpgradeModal from "@/app/components/UpgradeModal"
import ScannerIA from "@/app/components/ScannerIA"
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts"

// ── Design tokens ──────────────────────────────────────────────────────────────
const UP     = "#4ade80"
const DOWN   = "#f87171"
const WARN   = "#facc15"
const PURPLE = "#a78bfa"
const BLUE   = "#60a5fa"

// ── Types ──────────────────────────────────────────────────────────────────────
type AssetResult = {
  symbol: string
  name: string
  category: "stock" | "crypto" | "etf"
  sector?: string
  type?: string
  price: number
  change: number
  change_1d: number
  change_1w: number
  change_1m: number
  rsi: number
  ma20: number | null
  ma50: number | null
  volume: number
  volume_ratio: number
  volRatio: number
  macd_signal: "bullish" | "bearish" | "neutral"
  bb_position: "upper" | "middle" | "lower" | "above" | "below"
  confluence: number
  news_sentiment: number
  score: number
  signal: string
  signal_legacy: "ACHETER" | "ATTENDRE" | "ÉVITER"
  category_legacy?: string
  above_ma200: boolean
}

type ScreenerData = {
  assets: AssetResult[]
  top_buys: AssetResult[]
  top_sells: AssetResult[]
  neutral: AssetResult[]
  updated_at: string
}

type MarketSummary = {
  summary: string
  sentiment: "bullish" | "bearish" | "neutral"
  date: string
  top_movers: { symbol: string; name: string; price: number; change: number }[]
  market_data: { symbol: string; name: string; price: number; change: number }[]
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function signalColor(signal: string) {
  if (signal === "ACHAT_FORT") return UP
  if (signal === "ACHAT")      return "#86efac"
  if (signal === "VENTE_FORT") return DOWN
  if (signal === "VENTE")      return "#fca5a5"
  return WARN
}

function signalLabel(signal: string) {
  if (signal === "ACHAT_FORT") return "ACHAT FORT ⚡"
  if (signal === "ACHAT")      return "ACHAT ↗"
  if (signal === "VENTE_FORT") return "VENTE FORTE ⚡"
  if (signal === "VENTE")      return "VENTE ↘"
  return "NEUTRE"
}

function signalBg(signal: string) {
  if (signal === "ACHAT_FORT" || signal === "ACHAT") return "rgba(74,222,128,0.1)"
  if (signal === "VENTE_FORT" || signal === "VENTE") return "rgba(248,113,113,0.1)"
  return "rgba(250,204,21,0.08)"
}

function signalBorder(signal: string) {
  if (signal === "ACHAT_FORT" || signal === "ACHAT") return "rgba(74,222,128,0.25)"
  if (signal === "VENTE_FORT" || signal === "VENTE") return "rgba(248,113,113,0.25)"
  return "rgba(250,204,21,0.2)"
}

function fmtPrice(p: number) {
  return p >= 1000
    ? `$${p.toLocaleString("en-US", { maximumFractionDigits: 0 })}`
    : `$${p.toFixed(2)}`
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
}

function fmtChange(v: number) {
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`
}

function sentimentConfig(s: string) {
  if (s === "bullish") return { label: "🟢 Haussier", color: UP,   bg: "rgba(74,222,128,0.1)",  border: "rgba(74,222,128,0.25)"  }
  if (s === "bearish") return { label: "🔴 Baissier", color: DOWN, bg: "rgba(248,113,113,0.1)", border: "rgba(248,113,113,0.25)" }
  return                      { label: "🟡 Neutre",   color: WARN, bg: "rgba(250,204,21,0.08)", border: "rgba(250,204,21,0.2)"   }
}

function macdColor(s: string) {
  if (s === "bullish") return UP
  if (s === "bearish") return DOWN
  return "#555"
}

function macdLabel(s: string) {
  if (s === "bullish") return "↑ Haussier"
  if (s === "bearish") return "↓ Baissier"
  return "→ Neutre"
}

function bbLabel(s: string) {
  if (s === "above") return "↑ Au-dessus"
  if (s === "below") return "↓ En-dessous"
  if (s === "upper") return "Haute"
  if (s === "lower") return "Basse"
  return "Milieu"
}

function exportCSV(assets: AssetResult[]) {
  const headers = ["Symbole", "Nom", "Catégorie", "Secteur", "Prix", "Var 1j%", "Var 1S%", "Var 1M%", "RSI", "MACD", "BB", "MA20", "MA50", "Confluence", "Vol Ratio", "Score", "Signal"]
  const rows = assets.map(a => [
    a.symbol, a.name, a.category, a.sector ?? "",
    a.price, a.change_1d, a.change_1w, a.change_1m,
    a.rsi, a.macd_signal, a.bb_position,
    a.ma20 ?? "", a.ma50 ?? "",
    a.confluence, a.volume_ratio, a.score, a.signal
  ].join(","))
  const csv = [headers.join(","), ...rows].join("\n")
  const blob = new Blob([csv], { type: "text/csv" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `screener_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ── Skeleton ───────────────────────────────────────────────────────────────────
function Skeleton({ h = "h-5", w = "w-full" }: { h?: string; w?: string }) {
  return <div className={`${h} ${w} rounded-lg animate-pulse`} style={{ background: "#151515" }} />
}

// ── Asset Card (Cards view) ────────────────────────────────────────────────────
function AssetCard({ asset, onClick }: { asset: AssetResult; onClick: () => void }) {
  const sc = signalColor(asset.signal)
  const up = asset.change_1d >= 0

  return (
    <div
      onClick={onClick}
      className="rounded-xl p-3.5 cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99]"
      style={{ background: "#0d0d0d", border: "1px solid #1a1a1a", borderLeft: `3px solid ${sc}` }}
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-white font-black text-sm">{asset.symbol.replace("-USD", "")}</span>
            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold"
              style={{ background: "rgba(255,255,255,0.06)", color: "#555" }}>
              {asset.category === "stock" ? "Action" : asset.category === "crypto" ? "Crypto" : "ETF"}
            </span>
          </div>
          <p className="text-[10px] text-gray-600 mt-0.5 truncate max-w-[130px]">{asset.name}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-white font-bold text-sm tabular-nums">{fmtPrice(asset.price)}</p>
          <p className="text-[11px] font-semibold tabular-nums" style={{ color: up ? UP : DOWN }}>
            {fmtChange(asset.change_1d)}
          </p>
        </div>
      </div>

      <div className="mb-2">
        <div className="flex justify-between items-center mb-1">
          <span className="text-[9px] text-gray-600 uppercase tracking-widest">Score IA</span>
          <span className="text-[11px] font-black tabular-nums" style={{ color: sc }}>{asset.score}</span>
        </div>
        <div className="h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
          <div className="h-full rounded-full transition-all"
            style={{ width: `${asset.score}%`, background: `linear-gradient(90deg, ${sc}99, ${sc})` }} />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[10px] font-mono">
          <span style={{ color: asset.rsi > 70 ? DOWN : asset.rsi < 30 ? UP : "#555" }}>
            RSI {asset.rsi}
          </span>
          <span style={{ color: macdColor(asset.macd_signal) }}>MACD {asset.macd_signal === "bullish" ? "▲" : asset.macd_signal === "bearish" ? "▼" : "→"}</span>
        </div>
        <span className="text-[9px] font-black px-2 py-0.5 rounded-md"
          style={{ background: signalBg(asset.signal), color: signalColor(asset.signal), border: `1px solid ${signalBorder(asset.signal)}` }}>
          {signalLabel(asset.signal)}
        </span>
      </div>
    </div>
  )
}

// ── Heatmap Cell ───────────────────────────────────────────────────────────────
function HeatmapCell({ asset, onClick }: { asset: AssetResult; onClick: () => void }) {
  const pct = asset.change_1d
  const abs = Math.abs(pct)
  const intensity = Math.min(abs / 5, 1)
  const bg = pct > 0
    ? `rgba(74, 222, 128, ${0.1 + intensity * 0.4})`
    : pct < 0
    ? `rgba(248, 113, 113, ${0.1 + intensity * 0.4})`
    : "rgba(255,255,255,0.04)"

  return (
    <div
      onClick={onClick}
      className="relative rounded-lg p-2.5 cursor-pointer transition-all hover:scale-[1.02] flex flex-col justify-between"
      style={{ background: bg, border: "1px solid rgba(255,255,255,0.05)", minHeight: 64 }}
    >
      <p className="text-white font-black text-xs truncate">{asset.symbol.replace("-USD", "")}</p>
      <div>
        <p className="text-[10px] font-bold tabular-nums" style={{ color: pct >= 0 ? UP : DOWN }}>
          {fmtChange(pct)}
        </p>
        <p className="text-[9px]" style={{ color: "rgba(255,255,255,0.3)" }}>{fmtPrice(asset.price)}</p>
      </div>
    </div>
  )
}

// ── Screener Table Row ─────────────────────────────────────────────────────────
type SortField = "score" | "price" | "change_1d" | "change_1w" | "change_1m" | "rsi" | "confluence" | "volume_ratio"

function TableRow({ asset, onClick }: { asset: AssetResult; onClick: () => void }) {
  const sc = signalColor(asset.signal)
  const up1d = asset.change_1d >= 0

  return (
    <div
      onClick={onClick}
      className="grid items-center gap-2 px-4 py-2.5 cursor-pointer transition-colors text-xs"
      style={{
        gridTemplateColumns: "1.6fr 70px 80px 70px 70px 70px 50px 80px 80px 80px 110px",
        borderBottom: "1px solid #111",
      }}
      onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
    >
      {/* Asset */}
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: sc }} />
        <div className="min-w-0">
          <p className="text-white font-bold truncate">{asset.symbol.replace("-USD", "")}</p>
          <p className="text-[9px] truncate" style={{ color: "#444" }}>{asset.name}</p>
        </div>
      </div>

      {/* Price */}
      <p className="text-white font-mono tabular-nums text-right">{fmtPrice(asset.price)}</p>

      {/* 1d */}
      <p className="font-bold tabular-nums text-right" style={{ color: up1d ? UP : DOWN }}>{fmtChange(asset.change_1d)}</p>

      {/* 1w */}
      <p className="font-mono tabular-nums text-right" style={{ color: asset.change_1w >= 0 ? UP : DOWN }}>{fmtChange(asset.change_1w)}</p>

      {/* 1m */}
      <p className="font-mono tabular-nums text-right" style={{ color: asset.change_1m >= 0 ? UP : DOWN }}>{fmtChange(asset.change_1m)}</p>

      {/* RSI */}
      <p className="font-mono tabular-nums text-right" style={{ color: asset.rsi > 70 ? DOWN : asset.rsi < 30 ? UP : "#888" }}>
        {asset.rsi.toFixed(0)}
      </p>

      {/* MACD */}
      <p className="text-right text-[10px] font-semibold" style={{ color: macdColor(asset.macd_signal) }}>
        {asset.macd_signal === "bullish" ? "▲" : asset.macd_signal === "bearish" ? "▼" : "→"}
      </p>

      {/* Confluence */}
      <div className="flex items-center gap-1.5">
        <div className="flex-1 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
          <div className="h-full rounded-full" style={{ width: `${asset.confluence}%`, background: asset.confluence >= 60 ? UP : asset.confluence >= 40 ? WARN : DOWN }} />
        </div>
        <span className="font-bold tabular-nums w-6 text-right" style={{ color: "#888" }}>{asset.confluence}</span>
      </div>

      {/* Vol Ratio */}
      <p className="font-mono tabular-nums text-right" style={{ color: asset.volume_ratio > 1.5 ? PURPLE : "#555" }}>
        {asset.volume_ratio.toFixed(1)}x
      </p>

      {/* Score */}
      <div className="flex items-center gap-1.5">
        <div className="flex-1 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
          <div className="h-full rounded-full" style={{ width: `${asset.score}%`, background: sc }} />
        </div>
        <span className="font-black tabular-nums w-6 text-right" style={{ color: sc }}>{asset.score}</span>
      </div>

      {/* Signal */}
      <span className="text-[9px] font-black px-2 py-0.5 rounded-md text-center"
        style={{ background: signalBg(asset.signal), color: signalColor(asset.signal), border: `1px solid ${signalBorder(asset.signal)}` }}>
        {signalLabel(asset.signal)}
      </span>
    </div>
  )
}

// ── KPI stat pill ──────────────────────────────────────────────────────────────
function KPIStat({ label, value, sub, color = "#fff" }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="rounded-xl px-4 py-3" style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>
      <p className="text-[9px] uppercase tracking-widest font-bold mb-1" style={{ color: "#444" }}>{label}</p>
      <p className="text-lg font-black tabular-nums" style={{ color }}>{value}</p>
      {sub && <p className="text-[10px] mt-0.5" style={{ color: "#555" }}>{sub}</p>}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// BACKTEST TAB (preserved from original)
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

function EquityTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
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
      const items = (data?.quotes ?? []).filter((r: { symbol?: string; shortname?: string }) => r.symbol && r.shortname).slice(0, 6)
        .map((r: { symbol: string; shortname: string }) => ({ symbol: r.symbol, name: r.shortname }))
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
      <div className="rounded-2xl p-5 space-y-5" style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>
        <h2 className="text-base font-black">Paramètres</h2>

        <div ref={searchRef}>
          <p className="text-[9px] uppercase tracking-widest font-bold mb-2" style={{ color: "#444" }}>Symbole</p>
          <div className="relative">
            <input type="text" value={symbol}
              onChange={e => handleSearch(e.target.value)}
              onFocus={() => searchResults.length > 0 && setShowSearch(true)}
              placeholder="AAPL, NVDA, BTC-USD…"
              className="w-full px-4 py-2.5 rounded-xl font-mono text-sm text-white outline-none transition"
              style={{ background: "#111", border: "1px solid #222" }} />
            {showSearch && (
              <div className="absolute top-full left-0 right-0 mt-1 rounded-xl overflow-hidden z-20 shadow-2xl"
                style={{ background: "#0d0d0d", border: "1px solid #222" }}>
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

        <div>
          <p className="text-[9px] uppercase tracking-widest font-bold mb-2" style={{ color: "#444" }}>Stratégie</p>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 mb-2">
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

      {result && (
        <div className="space-y-4">
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

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
            <BtKPI label="Win Rate" value={`${fmtN(result.win_rate, 1)}%`} sub={`${result.winning_trades}W / ${result.losing_trades}L`} positive={result.win_rate >= 50} />
            <BtKPI label="Rendement" value={`${result.total_return >= 0 ? "+" : ""}${fmtN(result.total_return)}%`} positive={result.total_return >= 0} />
            <BtKPI label="Max Drawdown" value={`-${fmtN(result.max_drawdown)}%`} positive={result.max_drawdown < 10} />
            <BtKPI label="Sharpe" value={fmtN(result.sharpe_ratio)} positive={result.sharpe_ratio >= 1} />
            <BtKPI label="Profit Factor" value={fmtN(result.profit_factor)} positive={result.profit_factor >= 1} />
            <BtKPI label="Trades" value={String(result.total_trades)} sub={`Moy. ${fmtN(result.avg_trade_return)}%`} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: "rgba(74,222,128,0.07)", border: "1px solid rgba(74,222,128,0.15)" }}>
              <span className="text-lg">🏆</span>
              <div>
                <p className="text-[9px] uppercase tracking-widest font-bold" style={{ color: "#444" }}>Meilleur trade</p>
                <p className="text-lg font-black" style={{ color: UP }}>+{fmtN(result.best_trade)}%</p>
              </div>
            </div>
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: "rgba(248,113,113,0.07)", border: "1px solid rgba(248,113,113,0.15)" }}>
              <span className="text-lg">📉</span>
              <div>
                <p className="text-[9px] uppercase tracking-widest font-bold" style={{ color: "#444" }}>Pire trade</p>
                <p className="text-lg font-black" style={{ color: DOWN }}>{fmtN(result.worst_trade)}%</p>
              </div>
            </div>
          </div>

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
                        <th key={h} className={`px-4 py-2.5 font-semibold uppercase tracking-widest text-[9px] border-b ${["Prix ent.", "Prix sort.", "P&L", "%"].includes(h) ? "text-right" : "text-left"}`} style={{ borderColor: "#1a1a1a" }}>{h}</th>
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

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════════
export default function AnalysesPage() {
  const router = useRouter()

  const [screener,     setScreener]     = useState<ScreenerData | null>(null)
  const [summary,      setSummary]      = useState<MarketSummary | null>(null)
  const [loadScreener, setLoadScreener] = useState(true)
  const [loadSummary,  setLoadSummary]  = useState(true)
  const [tab,          setTab]          = useState<"screener" | "heatmap" | "scanner" | "backtest" | "market">("screener")
  const [filter,       setFilter]       = useState<"all" | "stock" | "crypto" | "etf">("all")
  const [viewMode,     setViewMode]     = useState<"table" | "cards">("table")
  const [sortField,    setSortField]    = useState<SortField>("score")
  const [sortAsc,      setSortAsc]      = useState(false)
  const [search,       setSearch]       = useState("")
  const [plan,         setPlan]         = useState("free")
  const [showUpgrade,  setShowUpgrade]  = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push("/login"); return }
      const { data: profile } = await supabase.from("profiles").select("plan").eq("email", data.user.email).single()
      if (profile?.plan) setPlan(profile.plan)
    })
  }, [router])

  const fetchScreener = useCallback(async (force = false) => {
    setLoadScreener(true)
    try {
      const res = await fetch(`/api/screener${force ? `?t=${Date.now()}` : ""}`)
      const data = await res.json()
      setScreener(data)
    } catch {}
    setLoadScreener(false)
  }, [])

  const fetchSummary = useCallback(async (force = false) => {
    setLoadSummary(true)
    try {
      const res = await fetch(`/api/market-summary${force ? `?t=${Date.now()}` : ""}`)
      const data = await res.json()
      setSummary(data)
    } catch {}
    setLoadSummary(false)
  }, [])

  useEffect(() => {
    Promise.all([fetchScreener(), fetchSummary()])
  }, [fetchScreener, fetchSummary])

  const sent = summary ? sentimentConfig(summary.sentiment) : null

  const allAssets: AssetResult[] = screener?.assets ?? []

  const baseFiltered = allAssets
    .filter(a => filter === "all" || a.category === filter)
    .filter(a => !search || a.symbol.toLowerCase().includes(search.toLowerCase()) || a.name.toLowerCase().includes(search.toLowerCase()))

  const sorted = [...baseFiltered].sort((a, b) => {
    const va = a[sortField] as number
    const vb = b[sortField] as number
    return sortAsc ? va - vb : vb - va
  })

  function toggleSort(field: SortField) {
    if (sortField === field) setSortAsc(v => !v)
    else { setSortField(field); setSortAsc(false) }
  }

  function SortBtn({ field, label }: { field: SortField; label: string }) {
    const active = sortField === field
    return (
      <button onClick={() => toggleSort(field)}
        className="flex items-center gap-0.5 text-[9px] uppercase tracking-widest font-bold transition"
        style={{ color: active ? BLUE : "#444" }}>
        {label}
        {active && <span>{sortAsc ? " ↑" : " ↓"}</span>}
      </button>
    )
  }

  const buyCnt  = baseFiltered.filter(a => a.signal === "ACHAT_FORT" || a.signal === "ACHAT").length
  const sellCnt = baseFiltered.filter(a => a.signal === "VENTE_FORT" || a.signal === "VENTE").length
  const neutCnt = baseFiltered.filter(a => a.signal === "NEUTRE").length
  const avgScore = baseFiltered.length > 0 ? Math.round(baseFiltered.reduce((s, a) => s + a.score, 0) / baseFiltered.length) : 0
  const avgConf  = baseFiltered.length > 0 ? Math.round(baseFiltered.reduce((s, a) => s + a.confluence, 0) / baseFiltered.length) : 0

  return (
    <>
    <div className="min-h-screen text-white overflow-x-hidden page-enter" style={{ background: "var(--bg-canvas)" }}>
      <div className="max-w-7xl mx-auto px-4 md:px-5 py-6">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-xl md:text-2xl font-black tracking-tight">Terminal Analyses</h1>
              {!loadScreener && screener && (
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black"
                  style={{ background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.2)", color: UP }}>
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: UP }} />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ background: UP }} />
                  </span>
                  LIVE
                </span>
              )}
            </div>
            <p className="text-gray-600 text-sm">Screener · Heatmap · Scanner IA · Backtest · Briefing marché</p>
          </div>
          <div className="flex items-center gap-2">
            {sent && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl font-bold text-sm"
                style={{ background: sent.bg, color: sent.color, border: `1px solid ${sent.border}` }}>
                {sent.label}
              </div>
            )}
            {!loadScreener && screener && (
              <p className="text-[10px]" style={{ color: "#444" }}>
                MAJ {fmtTime(screener.updated_at)}
              </p>
            )}
          </div>
        </div>

        {/* ── KPI stats (screener data) ────────────────────────────────────── */}
        {!loadScreener && screener && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-5">
            <KPIStat label="Actifs scannés" value={allAssets.length} />
            <KPIStat label="Signaux achat" value={buyCnt} color={UP} />
            <KPIStat label="Signaux vente" value={sellCnt} color={DOWN} />
            <KPIStat label="Neutres" value={neutCnt} color={WARN} />
            <KPIStat label="Score moyen" value={`${avgScore}/100`} color={avgScore >= 60 ? UP : avgScore >= 40 ? WARN : DOWN} />
            <KPIStat label="Confluence moy." value={`${avgConf}%`} color={BLUE} />
          </div>
        )}

        {/* ── Tabs ────────────────────────────────────────────────────────── */}
        <div className="flex gap-1 mb-5 p-1 rounded-xl overflow-x-auto scrollbar-hide" style={{ background: "#111" }}>
          {[
            { key: "screener", label: "🔍 Screener" },
            { key: "heatmap",  label: "🔥 Heatmap" },
            { key: "scanner",  label: "🧠 Scanner IA" },
            { key: "backtest", label: "📊 Backtest" },
            { key: "market",   label: "📰 Marché" },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key as typeof tab)}
              className="flex-1 flex-shrink-0 whitespace-nowrap py-2 rounded-lg text-xs md:text-sm font-bold transition-all"
              style={{
                background: tab === t.key ? "#1a1a1a" : "transparent",
                color: tab === t.key ? "#fff" : "#555",
                border: tab === t.key ? "1px solid #2a2a2a" : "1px solid transparent",
              }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* SCREENER TAB                                                         */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {tab === "screener" && plan === "free" && (
          <div className="relative rounded-2xl overflow-hidden" style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>
            <div className="p-6 blur-sm pointer-events-none select-none opacity-40">
              <div className="space-y-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-10 rounded-lg animate-pulse" style={{ background: "#151515" }} />
                ))}
              </div>
            </div>
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl" style={{ background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.2)" }}>🔒</div>
              <div>
                <p className="text-white font-black text-lg">Terminal Pro réservé aux abonnés</p>
                <p className="text-gray-500 text-sm mt-1">Screener temps réel, heatmap, scanner IA, backtest avancé</p>
              </div>
              <button onClick={() => setShowUpgrade(true)}
                className="px-6 py-3 rounded-xl font-black text-sm text-black transition hover:opacity-90"
                style={{ background: "linear-gradient(135deg, #4ade80, #22c55e)" }}>
                Passer à Pro →
              </button>
            </div>
          </div>
        )}

        {tab === "screener" && plan !== "free" && (
          <div className="space-y-4">
            {/* Controls */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 flex-wrap">
                {/* Category filter */}
                <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid #1a1a1a" }}>
                  {([["all", "Tout"], ["stock", "Actions"], ["crypto", "Crypto"], ["etf", "ETF"]] as const).map(([key, label]) => (
                    <button key={key} onClick={() => setFilter(key)}
                      className="px-3 py-1.5 text-[11px] font-bold transition-all"
                      style={{
                        background: filter === key ? "#1f2937" : "#0d0d0d",
                        color: filter === key ? BLUE : "#555",
                      }}>
                      {label}
                    </button>
                  ))}
                </div>

                {/* View mode */}
                <div className="flex gap-1 rounded-lg overflow-hidden" style={{ border: "1px solid #1a1a1a" }}>
                  {([["table", "☰ Table"], ["cards", "⊞ Cartes"]] as const).map(([key, label]) => (
                    <button key={key} onClick={() => setViewMode(key)}
                      className="px-3 py-1.5 text-[11px] font-bold transition-all"
                      style={{
                        background: viewMode === key ? "#1f2937" : "#0d0d0d",
                        color: viewMode === key ? "#fff" : "#555",
                      }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Search */}
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Rechercher…"
                  className="px-3 py-1.5 rounded-lg text-xs text-white outline-none w-36"
                  style={{ background: "#111", border: "1px solid #1a1a1a" }} />

                {/* Export CSV */}
                <button onClick={() => exportCSV(sorted)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition"
                  style={{ background: "#111", border: "1px solid #1a1a1a", color: "#555" }}>
                  ↓ CSV
                </button>

                {/* Refresh */}
                <button onClick={() => fetchScreener(true)} disabled={loadScreener}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition disabled:opacity-40"
                  style={{ background: "#111", border: "1px solid #222", color: "#888" }}>
                  {loadScreener
                    ? <><span className="w-3 h-3 border border-gray-500 border-t-transparent rounded-full animate-spin" /> Scan...</>
                    : "↻"}
                </button>
              </div>
            </div>

            {/* Count line */}
            {!loadScreener && (
              <p className="text-[10px]" style={{ color: "#444" }}>
                {sorted.length} actif{sorted.length > 1 ? "s" : ""} · triés par <span style={{ color: BLUE }}>{sortField}</span> {sortAsc ? "↑" : "↓"}
              </p>
            )}

            {/* Loading */}
            {loadScreener && (
              <div className="space-y-2">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="h-10 rounded-lg animate-pulse" style={{ background: "#111" }} />
                ))}
              </div>
            )}

            {/* Table view */}
            {!loadScreener && viewMode === "table" && (
              <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #1a1a1a" }}>
                {/* Table header */}
                <div className="grid items-center gap-2 px-4 py-2.5"
                  style={{
                    gridTemplateColumns: "1.6fr 70px 80px 70px 70px 70px 50px 80px 80px 80px 110px",
                    background: "rgba(255,255,255,0.02)",
                    borderBottom: "1px solid #1a1a1a",
                  }}>
                  <span className="text-[9px] uppercase tracking-widest font-bold" style={{ color: "#444" }}>Actif</span>
                  <SortBtn field="price" label="Prix" />
                  <SortBtn field="change_1d" label="1j %" />
                  <SortBtn field="change_1w" label="1S %" />
                  <SortBtn field="change_1m" label="1M %" />
                  <SortBtn field="rsi" label="RSI" />
                  <span className="text-[9px] uppercase tracking-widest font-bold" style={{ color: "#444" }}>MACD</span>
                  <SortBtn field="confluence" label="Conf." />
                  <SortBtn field="volume_ratio" label="Vol ×" />
                  <SortBtn field="score" label="Score" />
                  <span className="text-[9px] uppercase tracking-widest font-bold" style={{ color: "#444" }}>Signal</span>
                </div>

                {/* Rows */}
                <div className="overflow-y-auto" style={{ maxHeight: "70vh" }}>
                  {sorted.map(a => (
                    <TableRow key={a.symbol} asset={a} onClick={() => router.push(`/dashboard?symbol=${a.symbol}`)} />
                  ))}
                  {sorted.length === 0 && (
                    <div className="text-center py-10" style={{ color: "#555" }}>
                      Aucun actif ne correspond aux filtres
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Cards view */}
            {!loadScreener && viewMode === "cards" && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {sorted.map(a => (
                  <AssetCard key={a.symbol} asset={a} onClick={() => router.push(`/dashboard?symbol=${a.symbol}`)} />
                ))}
                {sorted.length === 0 && (
                  <div className="col-span-full text-center py-10" style={{ color: "#555" }}>
                    Aucun actif ne correspond aux filtres
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* HEATMAP TAB                                                          */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {tab === "heatmap" && (
          <div className="space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-lg font-black">Heatmap des variations</h2>
                <p className="text-[10px] mt-0.5" style={{ color: "#555" }}>Variation journalière — vert intensif = forte hausse, rouge intensif = forte baisse</p>
              </div>
              <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid #1a1a1a" }}>
                {([["all", "Tout"], ["stock", "Actions"], ["crypto", "Crypto"], ["etf", "ETF"]] as const).map(([key, label]) => (
                  <button key={key} onClick={() => setFilter(key)}
                    className="px-3 py-1.5 text-[11px] font-bold transition-all"
                    style={{
                      background: filter === key ? "#1f2937" : "#0d0d0d",
                      color: filter === key ? BLUE : "#555",
                    }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {loadScreener ? (
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-1.5">
                {Array.from({ length: 40 }).map((_, i) => (
                  <div key={i} className="h-16 rounded-lg animate-pulse" style={{ background: "#111" }} />
                ))}
              </div>
            ) : (
              <>
                {/* Sector groups */}
                {filter === "all" || filter === "stock" ? (
                  <div className="space-y-4">
                    {["Technology", "Finance", "Healthcare", "Consumer", "Energy"].map(sector => {
                      const sectorAssets = baseFiltered.filter(a => a.sector === sector)
                      if (sectorAssets.length === 0) return null
                      return (
                        <div key={sector}>
                          <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "#444" }}>{sector}</p>
                          <div className="grid gap-1.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))" }}>
                            {sectorAssets.map(a => (
                              <HeatmapCell key={a.symbol} asset={a} onClick={() => router.push(`/dashboard?symbol=${a.symbol}`)} />
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="grid gap-1.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))" }}>
                    {baseFiltered.map(a => (
                      <HeatmapCell key={a.symbol} asset={a} onClick={() => router.push(`/dashboard?symbol=${a.symbol}`)} />
                    ))}
                  </div>
                )}

                {/* Legend */}
                <div className="flex items-center gap-3 justify-end flex-wrap">
                  <span className="text-[10px]" style={{ color: "#444" }}>Légende variation 1j :</span>
                  {[
                    { label: "+5%+", bg: "rgba(74,222,128,0.5)" },
                    { label: "+2%", bg: "rgba(74,222,128,0.25)" },
                    { label: "0%", bg: "rgba(255,255,255,0.04)" },
                    { label: "-2%", bg: "rgba(248,113,113,0.25)" },
                    { label: "-5%-", bg: "rgba(248,113,113,0.5)" },
                  ].map(({ label, bg }) => (
                    <div key={label} className="flex items-center gap-1">
                      <div className="w-4 h-4 rounded" style={{ background: bg, border: "1px solid rgba(255,255,255,0.05)" }} />
                      <span className="text-[9px]" style={{ color: "#555" }}>{label}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* SCANNER IA TAB                                                       */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {tab === "scanner" && plan === "free" && (
          <div className="text-center py-16 rounded-2xl" style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-4" style={{ background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.2)" }}>🔒</div>
            <p className="text-white font-black text-lg mb-1">Scanner IA réservé Pro</p>
            <p className="text-gray-500 text-sm mb-4">Détection de 12 patterns techniques + analyse IA Groq</p>
            <button onClick={() => setShowUpgrade(true)}
              className="px-6 py-3 rounded-xl font-black text-sm text-black transition hover:opacity-90"
              style={{ background: "linear-gradient(135deg, #a78bfa, #7c3aed)" }}>
              Passer à Pro →
            </button>
          </div>
        )}

        {tab === "scanner" && plan !== "free" && (
          loadScreener ? (
            <div className="text-center py-12" style={{ color: "#555" }}>
              <span className="w-6 h-6 border border-gray-600 border-t-white rounded-full animate-spin inline-block mb-3" />
              <p>Chargement des données du scanner…</p>
            </div>
          ) : (
            <ScannerIA assets={allAssets} />
          )
        )}

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* BACKTEST TAB                                                         */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {tab === "backtest" && <BacktestTab />}

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* MARKET SUMMARY TAB                                                   */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {tab === "market" && (
          <div className="space-y-5">
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

            <div className="rounded-2xl p-5" style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>
              {loadSummary ? (
                <div className="space-y-3">
                  {[100, 90, 95, 75, 88, 70].map((w, i) => <Skeleton key={i} w={`w-[${w}%]`} />)}
                </div>
              ) : summary ? (
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    {sent && (
                      <span className="text-xs font-black px-3 py-1 rounded-full"
                        style={{ background: sent.bg, color: sent.color, border: `1px solid ${sent.border}` }}>
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

            {summary?.market_data && (
              <div>
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Indices et actifs majeurs</h3>
                <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                  {summary.market_data.map(d => {
                    const up = d.change >= 0
                    return (
                      <div key={d.symbol} className="rounded-xl p-3 flex-shrink-0 min-w-[90px]" style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>
                        <p className="text-[9px] text-gray-600 uppercase tracking-widest mb-1">{d.symbol.replace("-USD", "")}</p>
                        <p className="text-white font-black text-sm tabular-nums">{fmtPrice(d.price)}</p>
                        <p className="text-[11px] font-bold tabular-nums mt-0.5" style={{ color: up ? UP : DOWN }}>
                          {up ? "+" : ""}{d.change.toFixed(2)}%
                        </p>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {summary?.top_movers && (
              <div>
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Plus grandes variations</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
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

      </div>
    </div>
    <UpgradeModal open={showUpgrade} onClose={() => setShowUpgrade(false)} context="screener" />
    </>
  )
}
