"use client"

import { useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import {
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Line, LineChart,
} from "recharts"
import { TrendingUp, TrendingDown, ArrowUpRight, Share2, Download, RefreshCw } from "lucide-react"
import ShareTradeCard from "@/app/components/ShareTradeCard"

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

export default function PortfolioPage() {
  const router = useRouter()
  const [account, setAccount] = useState<any>(null)
  const [positions, setPositions] = useState<Position[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [pendingOrders, setPendingOrders] = useState<Order[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [perfHistory, setPerfHistory] = useState<{ date: string; value: number }[]>([])
  const [activeTab, setActiveTab] = useState<"positions" | "orders" | "history" | "stats">("positions")
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

    try {
      const res = await fetch("/api/trading/account", {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()

      const accountData = data.account
      const rawPositions: any[] = data.positions ?? []
      const allOrders: Order[] = data.orders ?? []

      setPendingOrders(allOrders.filter(o => o.status === "pending"))
      const filled = allOrders.filter(o => o.status === "filled")
      setOrders(filled)
      setAccount(accountData)

      // Enrich positions with live prices
      let enrichedPositions: Position[] = []
      if (rawPositions.length > 0) {
        enrichedPositions = await Promise.all(
          rawPositions.map(async (p) => {
            try {
              const r = await fetch(`/api/quote?symbol=${p.symbol}`)
              const q = await r.json()
              const cur = q.price ?? p.avg_price
              const pnl = (cur - p.avg_price) * p.qty
              const pnl_pct = ((cur - p.avg_price) / p.avg_price) * 100
              return { ...p, current_price: cur, pnl, pnl_pct, value: cur * p.qty }
            } catch {
              return { ...p, current_price: p.avg_price, pnl: 0, pnl_pct: 0, value: p.avg_price * p.qty }
            }
          })
        )
      }
      setPositions(enrichedPositions)

      // Compute stats
      const cash = accountData?.cash ?? 100000
      const invested = enrichedPositions.reduce((s, p) => s + p.avg_price * p.qty, 0)
      const posValue = enrichedPositions.reduce((s, p) => s + p.value, 0)
      const totalPnl = enrichedPositions.reduce((s, p) => s + p.pnl, 0)
      const dayPnl = totalPnl // approximation

      // Win/loss from positions
      const winners = enrichedPositions.filter(p => p.pnl > 0)
      const losers  = enrichedPositions.filter(p => p.pnl < 0)
      const avgWin  = winners.length > 0 ? winners.reduce((s, p) => s + p.pnl, 0) / winners.length : 0
      const avgLoss = losers.length  > 0 ? losers.reduce((s, p) => s + p.pnl, 0) / losers.length : 0
      const winRate = enrichedPositions.length > 0 ? (winners.length / enrichedPositions.length) * 100 : 0

      const totalGains  = winners.reduce((s, p) => s + p.pnl, 0)
      const totalLosses = Math.abs(losers.reduce((s, p) => s + p.pnl, 0))
      const profitFactor = totalLosses > 0 ? totalGains / totalLosses : totalGains > 0 ? Infinity : 0

      const sorted = [...enrichedPositions].sort((a, b) => b.pnl - a.pnl)
      const computedStats: Stats = {
        totalValue: cash + posValue,
        totalCash: cash,
        totalInvested: invested,
        totalPnl,
        totalPnlPct: invested > 0 ? (totalPnl / invested) * 100 : 0,
        dayPnl,
        winRate,
        avgWin,
        avgLoss,
        profitFactor,
        totalTrades: filled.length,
        bestTrade: sorted[0] ? { symbol: sorted[0].symbol, pnl: sorted[0].pnl, pnl_pct: sorted[0].pnl_pct } : null,
        worstTrade: sorted[sorted.length - 1] && sorted[sorted.length - 1].pnl < 0
          ? { symbol: sorted[sorted.length - 1].symbol, pnl: sorted[sorted.length - 1].pnl, pnl_pct: sorted[sorted.length - 1].pnl_pct }
          : null,
      }
      setStats(computedStats)

      // Build perf history from orders
      const history = buildPerfHistory(filled)
      setPerfHistory(history)
    } catch {}
    setLoading(false)
  }

  function buildPerfHistory(orders: Order[]) {
    if (orders.length === 0) return []
    const byDay: Record<string, number> = {}
    let running = 100000
    const sorted = [...orders].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    for (const o of sorted) {
      const day = o.created_at.slice(0, 10)
      if (o.side === "sell") running += o.total
      byDay[day] = running
    }
    return Object.entries(byDay).map(([date, value]) => ({ date, value }))
  }

  function filterHistory(data: { date: string; value: number }[]) {
    if (data.length === 0) return data
    const now = Date.now()
    const cutoffs: Record<string, number> = {
      "1W": 7, "1M": 30, "3M": 90, "ALL": Infinity,
    }
    const days = cutoffs[timeframe]
    return data.filter(d => (now - new Date(d.date).getTime()) / 86400000 <= days)
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
    { key: "positions", label: `📊 Positions (${positions.length})` },
    { key: "orders",    label: `📋 Ordres (${orders.length})` },
    { key: "history",   label: "📈 Historique" },
    { key: "stats",     label: "🎯 Stats" },
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
              Rapport
            </button>
          </div>
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            {
              label: "Aujourd'hui",
              value: `${(stats?.dayPnl ?? 0) >= 0 ? "+" : ""}$${(stats?.dayPnl ?? 0).toFixed(2)}`,
              sub: `${positions.length} position${positions.length !== 1 ? "s" : ""} ouvert${positions.length !== 1 ? "es" : "e"}`,
              color: (stats?.dayPnl ?? 0) >= 0 ? "#4ade80" : "#f87171",
              icon: (stats?.dayPnl ?? 0) >= 0 ? "📈" : "📉",
            },
            {
              label: "Cash disponible",
              value: `$${(account?.cash ?? 0).toFixed(2)}`,
              sub: stats ? `${(((account?.cash ?? 0) / stats.totalValue) * 100).toFixed(1)}% du portfolio` : "—",
              color: "#60a5fa",
              icon: "💵",
            },
            {
              label: "Investi",
              value: `$${(stats?.totalInvested ?? 0).toFixed(2)}`,
              sub: `${stats?.totalTrades ?? 0} ordre${(stats?.totalTrades ?? 0) !== 1 ? "s" : ""} total`,
              color: "#a78bfa",
              icon: "💼",
            },
            {
              label: "Win Rate",
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
            <p className="text-sm font-bold text-white">Performance du portfolio</p>
            <div className="flex gap-1">
              {(["1W","1M","3M","ALL"] as const).map(tf => (
                <button key={tf} onClick={() => setTimeframe(tf)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                    timeframe === tf ? "bg-white/10 text-white" : "text-white/25 hover:text-white/50"
                  }`}>
                  {tf}
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
                  formatter={(v: any) => [`$${Number(v).toLocaleString()}`, "Valeur"]}
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
                <p className="text-white/30 text-sm">Place ton premier trade pour voir ton historique</p>
                <button onClick={() => router.push("/dashboard")}
                  className="mt-3 px-4 py-2 rounded-xl text-xs font-bold text-green-400 border border-green-500/20 hover:bg-green-500/10 transition">
                  Aller au Dashboard →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Donut répartition */}
        <div className="rounded-2xl p-5"
          style={{ background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.06)" }}>
          <p className="text-sm font-bold text-white mb-3">Répartition</p>
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
              <p className="text-white/25 text-sm text-center">Aucune position ouverte</p>
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
                ⏳ {pendingOrders.length} ordre{pendingOrders.length > 1 ? "s" : ""} en attente d'exécution
              </p>
            </div>
            {pendingOrders.map(order => (
              <div key={order.id}
                className="flex items-center gap-4 px-5 py-3 border-b border-yellow-500/[0.07] last:border-0">
                <span className="text-base">⏳</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white">
                    {order.side === "buy" ? "Achat" : "Vente"} {order.qty} {order.symbol.replace("-USD","")}
                  </p>
                  <p className="text-[10px] text-white/30">
                    Réf. ${order.price.toFixed(2)} · Planifié {new Date(order.created_at).toLocaleDateString("fr-FR")}
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
              <p className="text-white/40 text-base font-bold mb-1">Aucune position ouverte</p>
              <p className="text-white/25 text-sm mb-4">Achète ton premier actif pour commencer</p>
              <button onClick={() => router.push("/dashboard")}
                className="px-6 py-2.5 rounded-xl text-sm font-black text-black"
                style={{ background: "#22c55e" }}>
                Aller au Dashboard →
              </button>
            </div>
          ) : (
            <div className="rounded-2xl overflow-hidden mb-6"
              style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
              {/* Table header */}
              <div className="hidden md:grid grid-cols-[1fr_80px_100px_100px_100px_100px] gap-4 px-5 py-3 border-b border-white/5"
                style={{ background: "rgba(255,255,255,0.02)" }}>
                {["Actif","Qty","Prix moy.","Actuel","P&L",""].map(h => (
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
                        Fermer
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
                { key: "pnl",    label: "Valeur" },
                { key: "symbol", label: "Actif" },
              ].map(s => (
                <button key={s.key} onClick={() => setSortOrders(s.key as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    sortOrders === s.key ? "bg-white/10 text-white" : "text-white/30 hover:text-white/60"
                  }`}>
                  {s.label}
                </button>
              ))}
              <span className="ml-auto text-xs text-white/25 self-center">{orders.length} ordres</span>
            </div>

            <div className="rounded-2xl overflow-hidden"
              style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
              {orders.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-white/25 text-sm">Aucun ordre exécuté</p>
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
                                {isBuy ? "ACHAT" : "VENTE"}
                              </span>
                            </div>
                            <p className="text-[10px] text-white/30">
                              {order.qty} parts · ${order.price.toFixed(2)}
                              {order.tp ? ` · TP $${order.tp.toFixed(2)}` : ""}
                              {order.sl ? ` · SL $${order.sl.toFixed(2)}` : ""}
                            </p>
                          </div>
                          <p className="text-[10px] text-white/25 hidden md:block">
                            {new Date(order.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
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
          <div className="rounded-2xl p-5 mb-6"
            style={{ background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.06)" }}>
            <p className="text-sm font-bold text-white mb-4">Courbe de performance</p>
            {perfHistory.length > 1 ? (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={perfHistory} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
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
              <div className="h-48 flex items-center justify-center">
                <p className="text-white/25 text-sm">Place des trades pour voir ton historique</p>
              </div>
            )}
          </div>
        )}

        {/* ── TAB STATS ────────────────────────────────────────────────────── */}
        {activeTab === "stats" && stats && (
          <div className="space-y-4 mb-6">
            {/* Stats grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                { label: "Win Rate", value: `${stats.winRate.toFixed(1)}%`, color: stats.winRate >= 50 ? "#4ade80" : "#f87171", desc: "% de positions gagnantes" },
                { label: "Profit Factor", value: isFinite(stats.profitFactor) ? stats.profitFactor.toFixed(2) : "∞", color: stats.profitFactor >= 1.5 ? "#4ade80" : "#f87171", desc: "Gains / Pertes" },
                { label: "Gain moyen", value: `+$${stats.avgWin.toFixed(2)}`, color: "#4ade80", desc: "Par position gagnante" },
                { label: "Perte moyenne", value: `-$${Math.abs(stats.avgLoss).toFixed(2)}`, color: "#f87171", desc: "Par position perdante" },
                { label: "Total trades", value: String(stats.totalTrades), color: "#60a5fa", desc: "Ordres exécutés" },
                { label: "P&L total", value: `${stats.totalPnl >= 0 ? "+" : ""}$${stats.totalPnl.toFixed(2)}`, color: stats.totalPnl >= 0 ? "#4ade80" : "#f87171", desc: "Depuis le début" },
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
                  <p className="text-[10px] text-green-400/60 uppercase tracking-widest mb-2">🏆 Meilleure position</p>
                  <p className="text-lg font-black text-white">{stats.bestTrade.symbol.replace("-USD","")}</p>
                  <p className="text-2xl font-black text-green-400">+${stats.bestTrade.pnl.toFixed(2)}</p>
                  <p className="text-sm text-green-400/60">+{stats.bestTrade.pnl_pct.toFixed(2)}%</p>
                </div>
              )}
              {stats.worstTrade && (
                <div className="rounded-2xl p-4"
                  style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.15)" }}>
                  <p className="text-[10px] text-red-400/60 uppercase tracking-widest mb-2">📉 Position à surveiller</p>
                  <p className="text-lg font-black text-white">{stats.worstTrade.symbol.replace("-USD","")}</p>
                  <p className="text-2xl font-black text-red-400">${stats.worstTrade.pnl.toFixed(2)}</p>
                  <p className="text-sm text-red-400/60">{stats.worstTrade.pnl_pct.toFixed(2)}%</p>
                </div>
              )}
            </div>

            {/* AI coaching */}
            <div className="rounded-2xl p-5"
              style={{ background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.06)" }}>
              <p className="text-sm font-bold text-white mb-3">🧠 Analyse de ta performance</p>
              <div className="space-y-2 text-sm text-white/50 leading-relaxed">
                {stats.winRate >= 50
                  ? <p>✅ Ton win rate de {stats.winRate.toFixed(1)}% est bon — plus de la moitié de tes positions sont gagnantes.</p>
                  : <p>⚠️ Ton win rate de {stats.winRate.toFixed(1)}% est perfectible. Concentre-toi sur des setups à haute confluence.</p>
                }
                {stats.profitFactor >= 1.5
                  ? <p>✅ Ton profit factor de {isFinite(stats.profitFactor) ? stats.profitFactor.toFixed(2) : "∞"} est excellent — tes gains surpassent tes pertes.</p>
                  : <p>💡 Vise un profit factor {">"}1.5 en laissant courir tes gagnants plus longtemps.</p>
                }
                {positions.length === 0
                  ? <p>📊 Ouvre des positions pour voir tes statistiques se remplir.</p>
                  : <p>📊 {positions.length} position{positions.length !== 1 ? "s" : ""} ouverte{positions.length !== 1 ? "s" : ""} en ce moment. Surveille tes stops !</p>
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
