"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import {
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Line, LineChart,
} from "recharts"
import { TrendingUp, TrendingDown, ArrowUpRight, Share2, Download, RefreshCw } from "lucide-react"
import ShareTradeCard from "@/app/components/ShareTradeCard"
import { useLanguage } from "@/lib/i18n/context"

const POSITION_COLORS = ["#22c55e","#60a5fa","#f97316","#a78bfa","#f59e0b","#ec4899","#06b6d4"]

type Position = {
  symbol: string
  name: string
  qty: number
  avg_price: number
  current_price: number
  pnl: number
  pnl_pct: number
  value: number
}

type Order = {
  id: string
  symbol: string
  name: string
  qty: number
  price: number
  side: string
  total: number
  status: string
  created_at: string
  tp?: number
  sl?: number
}

type ClosedTrade = {
  symbol: string
  buy_price: number
  sell_price: number
  qty: number
  pnl: number
  pnl_pct: number
  opened_at: string
  closed_at: string
}

type Stats = {
  totalValue: number
  totalCash: number
  totalInvested: number
  totalPnl: number
  totalPnlPct: number
  dayPnl: number
  winRate: number
  avgWin: number
  avgLoss: number
  profitFactor: number
  totalTrades: number
  bestTrade: { symbol: string; pnl: number; pnl_pct: number } | null
  worstTrade: { symbol: string; pnl: number; pnl_pct: number } | null
}

// ── FIFO portfolio computation ─────────────────────────────────────────────────
function computePortfolio(orders: Order[]) {
  // Sort oldest first for correct FIFO matching
  const sorted = [...orders].sort((a, b) =>
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )

  const queue: Record<string, Array<{ price: number; qty: number; date: string }>> = {}
  const closedTrades: ClosedTrade[] = []

  for (const order of sorted) {
    const sym = order.symbol
    if (order.side === "buy") {
      if (!queue[sym]) queue[sym] = []
      queue[sym].push({ price: order.price, qty: order.qty, date: order.created_at })
    } else if (order.side === "sell") {
      let remaining = order.qty
      while (remaining > 0 && queue[sym]?.length > 0) {
        const buy = queue[sym][0]
        const matched = Math.min(remaining, buy.qty)
        const pnl     = (order.price - buy.price) * matched
        const pnl_pct = ((order.price - buy.price) / buy.price) * 100
        closedTrades.push({
          symbol:    sym,
          buy_price: buy.price,
          sell_price: order.price,
          qty:       matched,
          pnl:       parseFloat(pnl.toFixed(2)),
          pnl_pct:   parseFloat(pnl_pct.toFixed(2)),
          opened_at: buy.date,
          closed_at: order.created_at,
        })
        buy.qty   -= matched
        remaining -= matched
        if (buy.qty <= 0) queue[sym].shift()
      }
    }
  }

  // What remains in queue = open positions
  const openPositions: Array<{
    symbol: string; qty: number; avg_price: number; total_cost: number; opened_at: string
  }> = []
  for (const [sym, buys] of Object.entries(queue)) {
    const totalQty  = buys.reduce((s, b) => s + b.qty, 0)
    if (totalQty <= 0) continue
    const totalCost = buys.reduce((s, b) => s + b.price * b.qty, 0)
    openPositions.push({
      symbol:     sym,
      qty:        parseFloat(totalQty.toFixed(8)),
      avg_price:  parseFloat((totalCost / totalQty).toFixed(2)),
      total_cost: parseFloat(totalCost.toFixed(2)),
      opened_at:  buys[0].date,
    })
  }

  return { openPositions, closedTrades }
}

// ── Journal Tab ───────────────────────────────────────────────────────────────

type JournalEntry = {
  trade_id: string
  note: string
  emotion: "great" | "good" | "neutral" | "bad" | "terrible" | null
  tag: "signal_ia" | "manuel" | "swing" | "scalp" | "erreur" | "bon_setup" | null
}

// NOTE: emotion/tag labels are now read from t.portfolio.journal at render time
const EMOTIONS = [
  { key: "great",    emoji: "🤩" },
  { key: "good",     emoji: "😊" },
  { key: "neutral",  emoji: "😐" },
  { key: "bad",      emoji: "😟" },
  { key: "terrible", emoji: "😡" },
] as const

const TAGS = [
  { key: "signal_ia" },
  { key: "manuel"    },
  { key: "swing"     },
  { key: "scalp"     },
  { key: "erreur"    },
  { key: "bon_setup" },
] as const

function JournalTab({ closedTrades, token }: { closedTrades: ClosedTrade[]; token: string }) {
  const [entries, setEntries] = useState<Record<string, JournalEntry>>({})
  const [saving, setSaving]   = useState<string | null>(null)
  const { t } = useLanguage()

  // Load existing journal entries on mount
  useEffect(() => {
    if (!token) return
    fetch("/api/journal", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        if (!Array.isArray(data.entries)) return
        const map: Record<string, JournalEntry> = {}
        for (const e of data.entries) { map[e.trade_id] = e }
        setEntries(map)
      })
      .catch(() => {})
  }, [token])

  const tradeId = (t: ClosedTrade) =>
    `${t.symbol}_${t.opened_at.slice(0, 10)}_${t.closed_at.slice(0, 10)}`

  const getEntry = (t: ClosedTrade): JournalEntry =>
    entries[tradeId(t)] ?? { trade_id: tradeId(t), note: "", emotion: null, tag: null }

  const save = useCallback(async (updated: JournalEntry) => {
    setSaving(updated.trade_id)
    try {
      await fetch("/api/journal", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(updated),
      })
      setEntries(prev => ({ ...prev, [updated.trade_id]: updated }))
    } catch {}
    setSaving(null)
  }, [token])

  const sorted = [...closedTrades].sort((a, b) =>
    new Date(b.closed_at).getTime() - new Date(a.closed_at).getTime()
  )

  if (sorted.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-4xl mb-3">📓</p>
        <p className="text-white/40 text-base font-bold mb-1">No closed trades</p>
        <p className="text-white/25 text-sm">The journal fills up after each sale</p>
      </div>
    )
  }

  return (
    <div className="space-y-3 mb-6">
      <p className="text-[10px] text-white/25 uppercase tracking-widest font-bold mb-2">
        {sorted.length} trade{sorted.length !== 1 ? "s" : ""} to review
      </p>
      {sorted.map(trade => {
        const id    = tradeId(trade)
        const entry = getEntry(trade)
        const won   = trade.pnl > 0
        const isSav = saving === id

        return (
          <div key={id} className="rounded-2xl overflow-hidden"
            style={{ background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.06)" }}>

            {/* Trade header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black text-black flex-shrink-0"
                style={{ background: won ? "#22c55e" : "#ef4444" }}>
                {trade.symbol.replace("-USD","")[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white">{trade.symbol.replace("-USD","")}</p>
                <p className="text-[10px] text-white/30">
                  {new Date(trade.closed_at).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}
                  {" · "}{trade.qty} shares
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className={`text-sm font-black tabular-nums ${won ? "text-green-400" : "text-red-400"}`}>
                  {won ? "+" : ""}${trade.pnl.toFixed(2)}
                </p>
                <p className={`text-[10px] ${won ? "text-green-400/60" : "text-red-400/60"}`}>
                  {won ? "+" : ""}{trade.pnl_pct.toFixed(2)}%
                </p>
              </div>
            </div>

            {/* Journal body */}
            <div className="px-4 py-3 space-y-3">

              {/* Emotion picker */}
              <div>
                <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold mb-2">{t.portfolio.journal.emotion}</p>
                <div className="flex gap-2 flex-wrap">
                  {EMOTIONS.map(e => (
                    <button
                      key={e.key}
                      onClick={() => save({ ...entry, emotion: e.key })}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition-all ${
                        entry.emotion === e.key
                          ? "bg-white/12 text-white scale-105"
                          : "bg-white/4 text-white/40 hover:bg-white/8 hover:text-white/70"
                      }`}
                    >
                      <span>{e.emoji}</span>
                      <span>{t.portfolio.journal.emotions[e.key]}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Tag picker */}
              <div>
                <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold mb-2">{t.portfolio.journal.tag}</p>
                <div className="flex gap-2 flex-wrap">
                  {TAGS.map(tag => (
                    <button
                      key={tag.key}
                      onClick={() => save({ ...entry, tag: tag.key })}
                      className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition-all ${
                        entry.tag === tag.key
                          ? "bg-green-500/20 text-green-400 border border-green-500/30"
                          : "bg-white/4 text-white/40 hover:bg-white/8 hover:text-white/70"
                      }`}
                    >
                      {t.portfolio.journal.tags[tag.key]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Note textarea */}
              <div>
                <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold mb-2">{t.portfolio.journal.note}</p>
                <textarea
                  defaultValue={entry.note}
                  placeholder={t.portfolio.journal.notePlaceholder}
                  rows={2}
                  className="w-full bg-white/4 border border-white/8 rounded-xl px-3 py-2 text-xs text-white placeholder-white/20 resize-none outline-none focus:border-white/20 transition"
                  onBlur={e => save({ ...entry, note: e.target.value })}
                />
              </div>

              {/* Save indicator */}
              {isSav && (
                <p className="text-[10px] text-green-400/60 text-right">Saving...</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function PortfolioPage() {
  const router = useRouter()
  const { t } = useLanguage()
  const [account, setAccount] = useState<any>(null)
  const [positions, setPositions] = useState<Position[]>([])
  const [closedTrades, setClosedTrades] = useState<ClosedTrade[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [pendingOrders, setPendingOrders] = useState<Order[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [perfHistory, setPerfHistory] = useState<{ date: string; value: number }[]>([])
  const [activeTab, setActiveTab] = useState<"positions" | "orders" | "history" | "stats" | "journal">("positions")
  const [token, setToken] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [shareTrade, setShareTrade] = useState<Order | null>(null)
  const [timeframe, setTimeframe] = useState<"1W" | "1M" | "3M" | "ALL">("1M")
  const [sortOrders, setSortOrders] = useState<"date" | "pnl" | "symbol">("date")

  useEffect(() => { loadAll() }, [])

  async function getToken() {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token
  }

  async function loadAll() {
    setLoading(true)
    const token = await getToken()
    if (!token) { router.push("/login"); return }
    setToken(token)

    try {
      const res = await fetch("/api/trading/account", {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()

      const accountData = data.account
      const allOrders: Order[] = data.orders ?? []

      setPendingOrders(allOrders.filter(o => o.status === "pending"))
      const filled = allOrders.filter(o => o.status === "filled")
      setOrders(filled)
      setAccount(accountData)

      // ── FIFO: derive positions and closed trades from order history ──
      const { openPositions, closedTrades: closed } = computePortfolio(filled)
      setClosedTrades(closed)

      // Enrich open positions with live prices
      const enrichedPositions: Position[] = await Promise.all(
        openPositions.map(async (p) => {
          let cur = p.avg_price
          try {
            const r = await fetch(`/api/quote?symbol=${encodeURIComponent(p.symbol)}`)
            const q = await r.json()
            if (q.price) cur = q.price
          } catch {}
          const pnl     = (cur - p.avg_price) * p.qty
          const pnl_pct = ((cur - p.avg_price) / p.avg_price) * 100
          const name    = filled.find(o => o.symbol === p.symbol)?.name ?? p.symbol
          return {
            symbol: p.symbol,
            name,
            qty:           p.qty,
            avg_price:     p.avg_price,
            current_price: cur,
            pnl:           parseFloat(pnl.toFixed(2)),
            pnl_pct:       parseFloat(pnl_pct.toFixed(2)),
            value:         parseFloat((cur * p.qty).toFixed(2)),
          }
        })
      )
      setPositions(enrichedPositions)

      // ── Stats ──
      const cash      = accountData?.cash ?? 100000
      // Total capital deployed = sum of ALL buy orders (historical volume)
      const invested  = filled.filter(o => o.side === "buy").reduce((s, o) => s + o.total, 0)
      const posValue  = enrichedPositions.reduce((s, p) => s + p.value, 0)
      const totalValue = cash + posValue
      const totalPnl  = totalValue - 100000
      const dayPnl    = enrichedPositions.reduce((s, p) => s + p.pnl, 0)

      const winners = closed.filter(t => t.pnl > 0)
      const losers  = closed.filter(t => t.pnl < 0)
      const winRate = closed.length > 0 ? (winners.length / closed.length) * 100 : 0
      const avgWin  = winners.length > 0 ? winners.reduce((s, t) => s + t.pnl, 0) / winners.length : 0
      const avgLoss = losers.length  > 0 ? Math.abs(losers.reduce((s, t) => s + t.pnl, 0) / losers.length) : 0
      const totalGains  = winners.reduce((s, t) => s + t.pnl, 0)
      const totalLosses = Math.abs(losers.reduce((s, t) => s + t.pnl, 0))
      const profitFactor = totalLosses > 0 ? totalGains / totalLosses : totalGains > 0 ? Infinity : 0
      const sortedClosed = [...closed].sort((a, b) => b.pnl - a.pnl)

      setStats({
        totalValue,
        totalCash:    cash,
        totalInvested: parseFloat(invested.toFixed(2)),
        totalPnl:     parseFloat(totalPnl.toFixed(2)),
        totalPnlPct:  parseFloat(((totalPnl / 100000) * 100).toFixed(2)),
        dayPnl:       parseFloat(dayPnl.toFixed(2)),
        winRate:      parseFloat(winRate.toFixed(1)),
        avgWin:       parseFloat(avgWin.toFixed(2)),
        avgLoss:      parseFloat(avgLoss.toFixed(2)),
        profitFactor,
        totalTrades:  closed.length,   // closed trades only
        bestTrade:  sortedClosed[0] ? { symbol: sortedClosed[0].symbol, pnl: sortedClosed[0].pnl, pnl_pct: sortedClosed[0].pnl_pct } : null,
        worstTrade: sortedClosed[sortedClosed.length - 1]?.pnl < 0
          ? { symbol: sortedClosed[sortedClosed.length - 1].symbol, pnl: sortedClosed[sortedClosed.length - 1].pnl, pnl_pct: sortedClosed[sortedClosed.length - 1].pnl_pct }
          : null,
      })

      // Build history from realized P&L, then pin last point to actual portfolio value
      const history = buildPerfHistory(filled)
      const todayStr = new Date().toISOString().slice(0, 10)
      const histNoToday = history.filter(d => d.date !== todayStr)
      histNoToday.push({ date: todayStr, value: parseFloat((cash + posValue).toFixed(2)) })
      setPerfHistory(histNoToday)
    } catch {}
    setLoading(false)
  }

  function buildPerfHistory(orders: Order[]) {
    if (orders.length === 0) return []
    // Track realized P&L via FIFO matching
    const buyMap: Record<string, { price: number; qty: number }[]> = {}
    const byDay: Record<string, number> = {}
    let realizedPnl = 0
    const sorted = [...orders].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    for (const o of sorted) {
      const day = o.created_at.slice(0, 10)
      if (o.side === "buy") {
        if (!buyMap[o.symbol]) buyMap[o.symbol] = []
        buyMap[o.symbol].push({ price: o.price, qty: o.qty })
      } else if (o.side === "sell" && buyMap[o.symbol]?.length) {
        const buy = buyMap[o.symbol].shift()!
        const matchedQty = Math.min(o.qty, buy.qty)
        realizedPnl += (o.price - buy.price) * matchedQty
        if (buy.qty > o.qty) buyMap[o.symbol].unshift({ price: buy.price, qty: buy.qty - o.qty })
      }
      byDay[day] = 100000 + realizedPnl
    }
    return Object.entries(byDay).map(([date, value]) => ({ date, value }))
  }

  function filterHistory(data: { date: string; value: number }[]) {
    if (data.length === 0 || timeframe === "ALL") return data
    // Compare calendar dates as strings (YYYY-MM-DD) to avoid float rounding issues
    const cutoff = new Date()
    const dayMap: Record<string, number> = { "1W": 7, "1M": 30, "3M": 90 }
    cutoff.setDate(cutoff.getDate() - dayMap[timeframe])
    const cutoffStr = cutoff.toISOString().slice(0, 10)
    return data.filter(d => d.date >= cutoffStr)
  }

  const donutData = useMemo(() => {
    const items = positions.map((p, i) => ({
      name: p.symbol.replace("-USD", ""),
      value: parseFloat(p.value.toFixed(2)),
      color: POSITION_COLORS[i % POSITION_COLORS.length],
    }))
    if ((account?.cash ?? 0) > 0) {
      items.push({ name: "Cash", value: account.cash, color: "#374151" })
    }
    return items
  }, [positions, account])

  const TABS = [
    { key: "positions", label: `📊 ${t.portfolio.tabs.positions} (${positions.length})` },
    { key: "orders",    label: `📋 ${t.portfolio.tabs.orders} (${orders.length})` },
    { key: "history",   label: `📈 ${t.portfolio.tabs.performance} (${closedTrades.length})` },
    { key: "stats",     label: `🎯 ${t.portfolio.winRate}` },
    { key: "journal",   label: t.portfolio.tabs.journal },
  ] as const

  const filteredHistory = filterHistory(perfHistory)

  async function closePosition(symbol: string, qty: number) {
    const token = await getToken()
    if (!token) return
    await fetch("/api/trading/order", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ symbol, side: "sell", qty, name: symbol }),
    })
    loadAll()
  }

  if (loading) return <PortfolioSkeleton />

  return (
    <div className="min-h-screen page-enter" style={{ background: "var(--bg-canvas)" }}>

      {/* ── KPI HEADER ─────────────────────────────────────────────────────── */}
      <div className="px-6 py-5 border-b border-white/5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            <p className="text-[10px] text-white/25 uppercase tracking-widest font-bold mb-1">Portfolio total</p>
            <div className="flex items-baseline gap-3 flex-wrap">
              <h1 className="text-4xl font-black text-white tabular-nums">
                ${(stats?.totalValue ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h1>
              {stats && (
                <div className={`flex items-center gap-1 ${stats.totalPnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {stats.totalPnl >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                  <span className="text-sm font-black">
                    {stats.totalPnl >= 0 ? "+" : ""}${stats.totalPnl.toFixed(2)}
                  </span>
                  <span className="text-xs opacity-70">({stats.totalPnlPct.toFixed(2)}%)</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={loadAll}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white/30 hover:text-white hover:bg-white/8 transition"
              style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
              <RefreshCw size={14} />
            </button>
            <button onClick={() => router.push("/reports")}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white/50 hover:text-white transition"
              style={{ border: "1px solid rgba(255,255,255,0.10)" }}>
              <Download size={13} />
              Report
            </button>
          </div>
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            {
              label: t.portfolio.totalPl,
              value: `${(stats?.dayPnl ?? 0) >= 0 ? "+" : ""}$${(stats?.dayPnl ?? 0).toFixed(2)}`,
              sub: `${positions.length} open position${positions.length !== 1 ? "s" : ""}`,
              color: (stats?.dayPnl ?? 0) >= 0 ? "#4ade80" : "#f87171",
              icon: (stats?.dayPnl ?? 0) >= 0 ? "📈" : "📉",
            },
            {
              label: t.portfolio.cashAvailable,
              value: `$${(account?.cash ?? 0).toFixed(2)}`,
              sub: stats ? `${(((account?.cash ?? 0) / stats.totalValue) * 100).toFixed(1)}% of portfolio` : "—",
              color: "#60a5fa",
              icon: "💵",
            },
            {
              label: t.portfolio.invested,
              value: `$${(stats?.totalInvested ?? 0).toFixed(2)}`,
              sub: `${orders.filter(o => o.side === "buy").length} buy order${orders.filter(o => o.side === "buy").length !== 1 ? "s" : ""} total`,
              color: "#a78bfa",
              icon: "💼",
            },
            {
              label: t.portfolio.winRate,
              value: `${(stats?.winRate ?? 0).toFixed(1)}%`,
              sub: `Profit factor ${isFinite(stats?.profitFactor ?? 0) ? (stats?.profitFactor ?? 0).toFixed(2) : "∞"}`,
              color: (stats?.winRate ?? 0) >= 50 ? "#4ade80" : "#f87171",
              icon: "🎯",
            },
          ].map(kpi => (
            <div key={kpi.label} className="rounded-2xl p-4"
              style={{ background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] text-white/25 uppercase tracking-widest">{kpi.label}</p>
                <span className="text-base">{kpi.icon}</span>
              </div>
              <p className="text-xl font-black tabular-nums" style={{ color: kpi.color }}>{kpi.value}</p>
              <p className="text-[10px] text-white/30 mt-0.5">{kpi.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── GRAPHE + DONUT ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4 px-6 py-4">

        {/* Performance chart */}
        <div className="rounded-2xl p-5"
          style={{ background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-bold text-white">{t.portfolio.tabs.performance}</p>
            <div className="flex gap-1">
              {(["1W","1M","3M","ALL"] as const).map(tf => (
                <button key={tf} onClick={() => setTimeframe(tf)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                    timeframe === tf ? "bg-white/10 text-white" : "text-white/25 hover:text-white/50"
                  }`}>
                  {t.portfolio.performancePeriods[tf]}
                </button>
              ))}
            </div>
          </div>
          {filteredHistory.length > 1 ? (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={filteredHistory} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="perfGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22c55e" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fill: "#444", fontSize: 10 }} tickLine={false} axisLine={false}
                  tickFormatter={d => d?.slice(5)} interval="preserveStartEnd" />
                <YAxis tick={{ fill: "#444", fontSize: 10 }} tickLine={false} axisLine={false}
                  tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} domain={["auto","auto"]} />
                <Tooltip
                  contentStyle={{ background: "#111", border: "1px solid #222", borderRadius: 10, fontSize: 11 }}
                  formatter={(v: any) => [`$${Number(v).toLocaleString()}`, "Value"]}
                  labelStyle={{ color: "#666" }}
                />
                <Area type="monotone" dataKey="value" stroke="#22c55e" strokeWidth={2}
                  fill="url(#perfGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-40 flex items-center justify-center">
              <div className="text-center">
                <p className="text-3xl mb-2">📊</p>
                <p className="text-white/30 text-sm">Place your first trade to see your history</p>
                <button onClick={() => router.push("/dashboard")}
                  className="mt-3 px-4 py-2 rounded-xl text-xs font-bold text-green-400 border border-green-500/20 hover:bg-green-500/10 transition">
                  Go to Dashboard →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Donut allocation */}
        <div className="rounded-2xl p-5"
          style={{ background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.06)" }}>
          <p className="text-sm font-bold text-white mb-3">Allocation</p>
          {donutData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={130}>
                <PieChart>
                  <Pie data={donutData} cx="50%" cy="50%" innerRadius={40} outerRadius={60}
                    paddingAngle={2} dataKey="value">
                    {donutData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "#111", border: "1px solid #222", borderRadius: 8, fontSize: 11 }}
                    formatter={(v: any) => [`$${Number(v).toFixed(0)}`, ""]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-1">
                {donutData.map((item, i) => {
                  const total = donutData.reduce((s, d) => s + d.value, 0)
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: item.color }} />
                      <span className="text-xs text-white/50 flex-1 truncate">{item.name}</span>
                      <span className="text-xs font-bold text-white tabular-nums">${item.value.toFixed(0)}</span>
                      <span className="text-[10px] text-white/25 tabular-nums">
                        {((item.value / total) * 100).toFixed(1)}%
                      </span>
                    </div>
                  )
                })}
              </div>
            </>
          ) : (
            <div className="h-32 flex items-center justify-center">
              <p className="text-white/25 text-sm text-center">No open positions</p>
            </div>
          )}
        </div>
      </div>

      {/* ── ORDRES EN ATTENTE ──────────────────────────────────────────────── */}
      {pendingOrders.length > 0 && (
        <div className="px-6 mb-4">
          <div className="rounded-2xl overflow-hidden"
            style={{ background: "rgba(245,158,11,0.04)", border: "1px solid rgba(245,158,11,0.15)" }}>
            <div className="px-5 py-3 border-b border-yellow-500/10">
              <p className="text-[10px] text-yellow-400/60 uppercase tracking-widest font-bold">
                ⏳ {pendingOrders.length} order{pendingOrders.length > 1 ? "s" : ""} pending execution
              </p>
            </div>
            {pendingOrders.map(order => (
              <div key={order.id}
                className="flex items-center gap-4 px-5 py-3 border-b border-yellow-500/[0.07] last:border-0">
                <span className="text-base">⏳</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white">
                    {order.side === "buy" ? "Buy" : "Sell"} {order.qty} {order.symbol.replace("-USD","")}
                  </p>
                  <p className="text-[10px] text-white/30">
                    Ref. ${order.price.toFixed(2)} · Scheduled {new Date(order.created_at).toLocaleDateString("en-US")}
                  </p>
                </div>
                <span className="text-xs font-bold text-yellow-400">${(order.qty * order.price).toFixed(0)}</span>
                <button
                  onClick={async () => {
                    const { data: { user } } = await supabase.auth.getUser()
                    if (!user) return
                    await supabase.from("orders").update({ status: "cancelled" }).eq("id", order.id).eq("user_id", user.id)
                    setPendingOrders(prev => prev.filter(o => o.id !== order.id))
                  }}
                  className="text-[10px] font-bold px-2.5 py-1 rounded-lg text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition">
                  Annuler
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── ONGLETS ────────────────────────────────────────────────────────── */}
      <div className="px-6">
        <div className="flex border-b border-white/5 mb-4 overflow-x-auto">
          {TABS.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-xs font-bold transition-all relative whitespace-nowrap flex-shrink-0 ${
                activeTab === tab.key ? "text-white" : "text-white/30 hover:text-white/60"
              }`}>
              {tab.label}
              {activeTab === tab.key && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-green-400 rounded-full" />
              )}
            </button>
          ))}
        </div>

        {/* ── TAB POSITIONS ────────────────────────────────────────────────── */}
        {activeTab === "positions" && (
          positions.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-4xl mb-3">📊</p>
              <p className="text-white/40 text-base font-bold mb-1">{t.portfolio.noPositions}</p>
              <p className="text-white/25 text-sm mb-4">Buy your first asset to get started</p>
              <button onClick={() => router.push("/dashboard")}
                className="px-6 py-2.5 rounded-xl text-sm font-black text-black"
                style={{ background: "#22c55e" }}>
                Go to Dashboard →
              </button>
            </div>
          ) : (
            <div className="rounded-2xl overflow-hidden mb-6"
              style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
              {/* Table header */}
              <div className="hidden md:grid grid-cols-[1fr_80px_100px_100px_100px_100px] gap-4 px-5 py-3 border-b border-white/5"
                style={{ background: "rgba(255,255,255,0.02)" }}>
                {["Asset","Qty","Avg. Price","Current","P&L",""].map(h => (
                  <p key={h} className="text-[9px] text-white/20 uppercase tracking-widest font-bold">{h}</p>
                ))}
              </div>

              {positions.map(pos => {
                const up = pos.pnl >= 0
                return (
                  <div key={pos.symbol}
                    className="flex md:grid md:grid-cols-[1fr_80px_100px_100px_100px_100px] gap-4 px-5 py-4 items-center border-b border-white/[0.04] last:border-0 hover:bg-white/[0.01] transition">

                    {/* Actif */}
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black text-black flex-shrink-0"
                        style={{ background: up ? "#22c55e" : "#ef4444" }}>
                        {pos.symbol.replace("-USD","")[0]}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-white">{pos.symbol.replace("-USD","")}</p>
                        <p className="text-[10px] text-white/30 truncate">{pos.name}</p>
                      </div>
                    </div>

                    {/* Mobile: everything in one line after asset */}
                    <div className="flex-1 md:hidden text-right">
                      <p className={`text-sm font-black ${up ? "text-green-400" : "text-red-400"}`}>
                        {up ? "+" : ""}{pos.pnl_pct.toFixed(2)}%
                      </p>
                      <p className="text-[10px] text-white/40">${pos.value.toFixed(2)}</p>
                    </div>

                    {/* Desktop columns */}
                    <p className="hidden md:block text-sm text-white/60 tabular-nums">{pos.qty}</p>
                    <p className="hidden md:block text-sm text-white/50 tabular-nums">${pos.avg_price.toFixed(2)}</p>
                    <p className="hidden md:block text-sm text-white tabular-nums">${pos.current_price.toFixed(2)}</p>
                    <div className="hidden md:block">
                      <p className={`text-sm font-black tabular-nums ${up ? "text-green-400" : "text-red-400"}`}>
                        {up ? "+" : ""}{pos.pnl_pct.toFixed(2)}%
                      </p>
                      <p className={`text-[10px] tabular-nums ${up ? "text-green-400/60" : "text-red-400/60"}`}>
                        {up ? "+" : ""}${pos.pnl.toFixed(2)}
                      </p>
                    </div>
                    <div className="hidden md:flex items-center gap-1.5">
                      <button onClick={() => router.push(`/dashboard?symbol=${pos.symbol}`)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-white/25 hover:text-white hover:bg-white/8 transition">
                        <ArrowUpRight size={13} />
                      </button>
                      <button onClick={() => closePosition(pos.symbol, pos.qty)}
                        className="px-2.5 py-1 rounded-lg text-[10px] font-bold text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition">
                        Close
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        )}

        {/* ── TAB ORDRES ───────────────────────────────────────────────────── */}
        {activeTab === "orders" && (
          <div className="mb-6">
            {/* Sort */}
            <div className="flex gap-2 mb-4">
              {[
                { key: "date",   label: "Date" },
                { key: "pnl",    label: "Value" },
                { key: "symbol", label: "Asset" },
              ].map(s => (
                <button key={s.key} onClick={() => setSortOrders(s.key as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    sortOrders === s.key ? "bg-white/10 text-white" : "text-white/30 hover:text-white/60"
                  }`}>
                  {s.label}
                </button>
              ))}
              <span className="ml-auto text-xs text-white/25 self-center">{orders.length} orders</span>
            </div>

            <div className="rounded-2xl overflow-hidden"
              style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
              {orders.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-white/25 text-sm">{t.portfolio.noOrders}</p>
                </div>
              ) : (
                <div className="divide-y divide-white/[0.04]">
                  {[...orders]
                    .sort((a, b) => {
                      if (sortOrders === "pnl") return b.total - a.total
                      if (sortOrders === "symbol") return a.symbol.localeCompare(b.symbol)
                      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                    })
                    .map(order => {
                      const isBuy = order.side === "buy"
                      return (
                        <div key={order.id}
                          className="flex items-center gap-4 px-5 py-3.5 hover:bg-white/[0.01] transition">
                          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                            style={{ background: isBuy ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)" }}>
                            <span className="text-sm">{isBuy ? "🟢" : "🔴"}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-bold text-white">{order.symbol.replace("-USD","")}</p>
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md"
                                style={{
                                  background: isBuy ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                                  color: isBuy ? "#4ade80" : "#f87171",
                                }}>
                                {isBuy ? "BUY" : "SELL"}
                              </span>
                            </div>
                            <p className="text-[10px] text-white/30">
                              {order.qty} shares · ${order.price.toFixed(2)}
                              {order.tp ? ` · TP $${order.tp.toFixed(2)}` : ""}
                              {order.sl ? ` · SL $${order.sl.toFixed(2)}` : ""}
                            </p>
                          </div>
                          <p className="text-[10px] text-white/25 hidden md:block">
                            {new Date(order.created_at).toLocaleDateString("en-US", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                          </p>
                          <div className="text-right flex-shrink-0">
                            <p className="text-sm font-bold text-white tabular-nums">${order.total.toFixed(2)}</p>
                          </div>
                          <button onClick={() => setShareTrade(order)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-white/20 hover:text-green-400 hover:bg-green-500/10 transition flex-shrink-0">
                            <Share2 size={13} />
                          </button>
                        </div>
                      )
                    })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB HISTORIQUE ───────────────────────────────────────────────── */}
        {activeTab === "history" && (
          <div className="space-y-4 mb-6">
            {/* Courbe de performance */}
            <div className="rounded-2xl p-5"
              style={{ background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-bold text-white">{t.portfolio.tabs.performance}</p>
                <div className="flex gap-1">
                  {(["1W","1M","3M","ALL"] as const).map(tf => (
                    <button key={tf} onClick={() => setTimeframe(tf)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                        timeframe === tf ? "bg-white/10 text-white" : "text-white/25 hover:text-white/50"
                      }`}>
                      {t.portfolio.performancePeriods[tf]}
                    </button>
                  ))}
                </div>
              </div>
              {filteredHistory.length > 1 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={filteredHistory} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
                    <defs>
                      <linearGradient id="histGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22c55e" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" tick={{ fill: "#444", fontSize: 10 }} tickLine={false} axisLine={false}
                      tickFormatter={d => d?.slice(5)} />
                    <YAxis tick={{ fill: "#444", fontSize: 10 }} tickLine={false} axisLine={false}
                      tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} domain={["auto","auto"]} />
                    <Tooltip
                      contentStyle={{ background: "#111", border: "1px solid #222", borderRadius: 10, fontSize: 11 }}
                      formatter={(v: any) => [`$${Number(v).toLocaleString()}`, "Portfolio"]}
                    />
                    <Area type="monotone" dataKey="value" stroke="#22c55e" strokeWidth={2} fill="url(#histGrad)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-40 flex items-center justify-center">
                  <p className="text-white/25 text-sm">
                    {perfHistory.length <= 1 ? "Place trades to see your history" : "No trades in this period"}
                  </p>
                </div>
              )}
            </div>

            {/* Closed trades */}
            <div className="rounded-2xl overflow-hidden"
              style={{ background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between">
                <p className="text-sm font-bold text-white">Closed trades</p>
                <span className="text-[10px] text-white/25 font-bold">
                  {closedTrades.length} trade{closedTrades.length !== 1 ? "s" : ""} · Realized P&L{" "}
                  <span className={closedTrades.reduce((s, t) => s + t.pnl, 0) >= 0 ? "text-green-400" : "text-red-400"}>
                    {closedTrades.reduce((s, t) => s + t.pnl, 0) >= 0 ? "+" : ""}
                    ${closedTrades.reduce((s, t) => s + t.pnl, 0).toFixed(2)}
                  </span>
                </span>
              </div>
              {closedTrades.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-white/25 text-sm">No closed trades</p>
                </div>
              ) : (
                <div className="divide-y divide-white/[0.04]">
                  {/* Table header */}
                  <div className="hidden md:grid grid-cols-[1fr_80px_100px_100px_100px_130px] gap-3 px-5 py-2.5"
                    style={{ background: "rgba(255,255,255,0.02)" }}>
                    {["Asset","Qty","Buy","Sell","P&L","Close date"].map(h => (
                      <p key={h} className="text-[9px] text-white/20 uppercase tracking-widest font-bold">{h}</p>
                    ))}
                  </div>
                  {[...closedTrades].sort((a, b) =>
                    new Date(b.closed_at).getTime() - new Date(a.closed_at).getTime()
                  ).map((trade, i) => {
                    const won = trade.pnl > 0
                    return (
                      <div key={i}
                        className="flex md:grid md:grid-cols-[1fr_80px_100px_100px_100px_130px] gap-3 px-5 py-3.5 items-center hover:bg-white/[0.01] transition">
                        {/* Actif */}
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black text-black flex-shrink-0"
                            style={{ background: won ? "#22c55e" : "#ef4444" }}>
                            {trade.symbol.replace("-USD","")[0]}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-white">{trade.symbol.replace("-USD","")}</p>
                            <p className="text-[9px] text-white/25">Closed {won ? "✅ gain" : "❌ loss"}</p>
                          </div>
                        </div>
                        {/* Mobile: P&L inline */}
                        <div className="flex-1 md:hidden text-right">
                          <p className={`text-sm font-black ${won ? "text-green-400" : "text-red-400"}`}>
                            {won ? "+" : ""}{trade.pnl_pct.toFixed(2)}%
                          </p>
                          <p className={`text-[10px] ${won ? "text-green-400/60" : "text-red-400/60"}`}>
                            {won ? "+" : ""}${trade.pnl.toFixed(2)}
                          </p>
                        </div>
                        {/* Desktop columns */}
                        <p className="hidden md:block text-xs text-white/50 tabular-nums">{trade.qty}</p>
                        <p className="hidden md:block text-xs text-white/50 tabular-nums">${trade.buy_price.toFixed(2)}</p>
                        <p className="hidden md:block text-xs text-white/60 tabular-nums">${trade.sell_price.toFixed(2)}</p>
                        <div className="hidden md:block">
                          <p className={`text-sm font-black tabular-nums ${won ? "text-green-400" : "text-red-400"}`}>
                            {won ? "+" : ""}${trade.pnl.toFixed(2)}
                          </p>
                          <p className={`text-[10px] tabular-nums ${won ? "text-green-400/60" : "text-red-400/60"}`}>
                            {won ? "+" : ""}{trade.pnl_pct.toFixed(2)}%
                          </p>
                        </div>
                        <p className="hidden md:block text-[10px] text-white/25">
                          {new Date(trade.closed_at).toLocaleDateString("en-US", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB JOURNAL ──────────────────────────────────────────────────── */}
        {activeTab === "journal" && (
          <JournalTab closedTrades={closedTrades} token={token} />
        )}

        {/* ── TAB STATS ────────────────────────────────────────────────────── */}
        {activeTab === "stats" && stats && (
          <div className="space-y-4 mb-6">
            {/* Stats grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                { label: "Win Rate", value: `${stats.winRate.toFixed(1)}%`, color: stats.winRate >= 50 ? "#4ade80" : "#f87171", desc: "% of winning positions" },
                { label: "Profit Factor", value: isFinite(stats.profitFactor) ? stats.profitFactor.toFixed(2) : "∞", color: stats.profitFactor >= 1.5 ? "#4ade80" : "#f87171", desc: "Gains / Losses" },
                { label: "Avg. gain", value: `+$${stats.avgWin.toFixed(2)}`, color: "#4ade80", desc: "Per winning position" },
                { label: "Avg. loss", value: `-$${Math.abs(stats.avgLoss).toFixed(2)}`, color: "#f87171", desc: "Per losing position" },
                { label: "Closed trades", value: String(stats.totalTrades), color: "#60a5fa", desc: "Buy/sell pairs" },
                { label: "Total P&L", value: `${stats.totalPnl >= 0 ? "+" : ""}$${stats.totalPnl.toFixed(2)}`, color: stats.totalPnl >= 0 ? "#4ade80" : "#f87171", desc: "Since the beginning" },
              ].map(stat => (
                <div key={stat.label} className="rounded-2xl p-4"
                  style={{ background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <p className="text-[10px] text-white/25 uppercase tracking-widest mb-2">{stat.label}</p>
                  <p className="text-2xl font-black tabular-nums" style={{ color: stat.color }}>{stat.value}</p>
                  <p className="text-[10px] text-white/25 mt-1">{stat.desc}</p>
                </div>
              ))}
            </div>

            {/* Best / Worst */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {stats.bestTrade && (
                <div className="rounded-2xl p-4"
                  style={{ background: "rgba(34,197,94,0.05)", border: "1px solid rgba(34,197,94,0.15)" }}>
                  <p className="text-[10px] text-green-400/60 uppercase tracking-widest mb-2">🏆 Best position</p>
                  <p className="text-lg font-black text-white">{stats.bestTrade.symbol.replace("-USD","")}</p>
                  <p className="text-2xl font-black text-green-400">+${stats.bestTrade.pnl.toFixed(2)}</p>
                  <p className="text-sm text-green-400/60">+{stats.bestTrade.pnl_pct.toFixed(2)}%</p>
                </div>
              )}
              {stats.worstTrade && (
                <div className="rounded-2xl p-4"
                  style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.15)" }}>
                  <p className="text-[10px] text-red-400/60 uppercase tracking-widest mb-2">📉 Position to watch</p>
                  <p className="text-lg font-black text-white">{stats.worstTrade.symbol.replace("-USD","")}</p>
                  <p className="text-2xl font-black text-red-400">${stats.worstTrade.pnl.toFixed(2)}</p>
                  <p className="text-sm text-red-400/60">{stats.worstTrade.pnl_pct.toFixed(2)}%</p>
                </div>
              )}
            </div>

            {/* AI coaching */}
            <div className="rounded-2xl p-5"
              style={{ background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.06)" }}>
              <p className="text-sm font-bold text-white mb-3">🧠 Performance analysis</p>
              <div className="space-y-2 text-sm text-white/50 leading-relaxed">
                {stats.winRate >= 50
                  ? <p>✅ Your win rate of {stats.winRate.toFixed(1)}% is good — more than half of your positions are winners.</p>
                  : <p>⚠️ Your win rate of {stats.winRate.toFixed(1)}% has room to improve. Focus on high-confluence setups.</p>
                }
                {stats.profitFactor >= 1.5
                  ? <p>✅ Your profit factor of {isFinite(stats.profitFactor) ? stats.profitFactor.toFixed(2) : "∞"} is excellent — your gains outweigh your losses.</p>
                  : <p>💡 Aim for a profit factor {">"}1.5 by letting your winners run longer.</p>
                }
                {positions.length === 0
                  ? <p>📊 Open positions to see your statistics fill up.</p>
                  : <p>📊 {positions.length} open position{positions.length !== 1 ? "s" : ""} right now. Watch your stops!</p>
                }
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Share trade modal ─────────────────────────────────────────────── */}
      {shareTrade && (
        <ShareTradeCard order={shareTrade} onClose={() => setShareTrade(null)} />
      )}
    </div>
  )
}

function PortfolioSkeleton() {
  return (
    <div className="min-h-screen p-6" style={{ background: "var(--bg-canvas)" }}>
      <div className="h-36 skeleton rounded-2xl mb-4" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-24 skeleton rounded-2xl" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4 mb-4">
        <div className="h-56 skeleton rounded-2xl" />
        <div className="h-56 skeleton rounded-2xl" />
      </div>
    </div>
  )
}
