"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

type Account = { cash: number }
type Position = {
  symbol: string
  name: string
  qty: number
  avg_price: number
  current_price?: number
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
}

export default function PortfolioPage() {
  const router = useRouter()
  const [account, setAccount] = useState<Account | null>(null)
  const [positions, setPositions] = useState<Position[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [prices, setPrices] = useState<Record<string, number>>({})
  const [orderModal, setOrderModal] = useState<{ symbol: string; name: string; side: "buy" | "sell" } | null>(null)
  const [orderQty, setOrderQty] = useState("1")
  const [orderLoading, setOrderLoading] = useState(false)
  const [orderMsg, setOrderMsg] = useState("")
  const [searchSym, setSearchSym] = useState("")
  const [tab, setTab] = useState<"positions" | "orders">("positions")

  useEffect(() => { loadData() }, [])

  async function getToken() {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token
  }

  async function loadData() {
    setLoading(true)
    const token = await getToken()
    if (!token) return
    try {
      const res = await fetch("/api/trading/account", {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      setAccount(data.account)
      setPositions(data.positions ?? [])
      setOrders(data.orders ?? [])

      // Fetch prix actuels
      if (data.positions?.length > 0) {
        const priceMap: Record<string, number> = {}
        await Promise.all(data.positions.map(async (p: Position) => {
          const r = await fetch(`/api/quote?symbol=${p.symbol}`)
          const d = await r.json()
          if (d.price) priceMap[p.symbol] = d.price
        }))
        setPrices(priceMap)
      }
    } catch {}
    setLoading(false)
  }

  async function placeOrder() {
    if (!orderModal) return
    setOrderLoading(true)
    setOrderMsg("")
    const token = await getToken()
    if (!token) return
    try {
      const res = await fetch("/api/trading/order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          symbol: orderModal.symbol,
          name: orderModal.name,
          qty: orderQty,
          side: orderModal.side,
        })
      })
      const data = await res.json()
      if (data.success) {
        setOrderMsg(`✅ Ordre exécuté à $${data.price.toFixed(2)}`)
        setTimeout(() => { setOrderModal(null); setOrderMsg(""); loadData() }, 1500)
      } else {
        setOrderMsg(`❌ ${data.error ?? "Erreur"}`)
      }
    } catch {
      setOrderMsg("❌ Erreur réseau")
    }
    setOrderLoading(false)
  }

  const positionsWithPnl = (positions ?? []).map(p => {
    const currentPrice = prices[p.symbol] ?? p.avg_price
    const value = currentPrice * p.qty
    const cost = p.avg_price * p.qty
    const pnl = value - cost
    const pct = (pnl / cost) * 100
    return { ...p, currentPrice, value, cost, pnl, pct }
  })

  const totalValue = positionsWithPnl.reduce((a, p) => a + p.value, 0)
  const totalCost = positionsWithPnl.reduce((a, p) => a + p.cost, 0)
  const totalPnL = totalValue - totalCost
  const portfolioTotal = (account?.cash ?? 0) + totalValue

  return (
    <div className="text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black">Portfolio</h1>
            <p className="text-gray-500 text-sm mt-0.5">Paper Trading · Simulation</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setOrderModal({ symbol: searchSym || "AAPL", name: searchSym || "Apple Inc.", side: "buy" })}
              className="text-xs px-3 py-1.5 rounded-lg bg-green-500/15 text-green-400 border border-green-500/25 hover:bg-green-500/25 transition font-semibold">
              + Nouvel ordre
            </button>
            <button onClick={loadData}
              className="text-xs px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-white transition">
              ↻
            </button>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-[#111] border border-[#1f1f1f] rounded-xl h-16 animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: "Valeur totale", value: `$${portfolioTotal.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}` },
                { label: "Cash disponible", value: `$${(account?.cash ?? 0).toLocaleString("fr-FR", { maximumFractionDigits: 2 })}` },
                {
                  label: "P&L non réalisé",
                  value: `${totalPnL >= 0 ? "+" : ""}$${Math.abs(totalPnL).toFixed(2)}`,
                  color: totalPnL >= 0 ? "text-green-400" : "text-red-400"
                },
                { label: "Positions", value: `${positions.length}` },
              ].map(kpi => (
                <div key={kpi.label} className="bg-[#111] border border-[#1f1f1f] rounded-xl px-4 py-3">
                  <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-1">{kpi.label}</p>
                  <p className={`text-xl font-bold ${kpi.color ?? "text-white"}`}>{kpi.value}</p>
                </div>
              ))}
            </div>

            {/* Allocation */}
            {positionsWithPnl.length > 0 && (
              <div className="bg-[#111] border border-[#1f1f1f] rounded-xl p-5">
                <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-3">Allocation</p>
                <div className="flex rounded-full overflow-hidden h-2.5 gap-0.5">
                  {/* Cash */}
                  <div
                    className="bg-gray-600 h-full"
                    style={{ width: `${(account?.cash ?? 0) / portfolioTotal * 100}%` }}
                    title={`Cash ${((account?.cash ?? 0) / portfolioTotal * 100).toFixed(1)}%`}
                  />
                  {positionsWithPnl.map((p, i) => {
                    const colors = ["bg-green-400", "bg-blue-400", "bg-yellow-400", "bg-purple-400", "bg-pink-400", "bg-orange-400"]
                    return (
                      <div key={p.symbol}
                        className={`${colors[i % colors.length]} h-full`}
                        style={{ width: `${p.value / portfolioTotal * 100}%` }}
                        title={`${p.symbol} ${(p.value / portfolioTotal * 100).toFixed(1)}%`}
                      />
                    )
                  })}
                </div>
                <div className="flex flex-wrap gap-4 mt-3">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-gray-600" />
                    <span className="text-xs text-gray-500">Cash {((account?.cash ?? 0) / portfolioTotal * 100).toFixed(1)}%</span>
                  </div>
                  {positionsWithPnl.map((p, i) => {
                    const colors = ["bg-green-400", "bg-blue-400", "bg-yellow-400", "bg-purple-400", "bg-pink-400", "bg-orange-400"]
                    return (
                      <div key={p.symbol} className="flex items-center gap-1.5">
                        <div className={`w-2.5 h-2.5 rounded-full ${colors[i % colors.length]}`} />
                        <span className="text-xs text-gray-500">{p.symbol} {(p.value / portfolioTotal * 100).toFixed(1)}%</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Tabs */}
            <div className="bg-[#111] border border-[#1f1f1f] rounded-xl overflow-hidden">
              <div className="flex border-b border-[#1f1f1f]">
                {[
                  { key: "positions", label: `Positions (${positions.length})` },
                  { key: "orders", label: `Historique (${orders.length})` },
                ].map(t => (
                  <button key={t.key}
                    onClick={() => setTab(t.key as any)}
                    className={`px-5 py-3 text-sm font-semibold transition border-b-2 ${
                      tab === t.key
                        ? "text-green-400 border-green-400"
                        : "text-gray-500 border-transparent hover:text-white"
                    }`}>
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Positions */}
              {tab === "positions" && (
                <div>
                  {positionsWithPnl.length === 0 ? (
                    <div className="px-5 py-12 text-center">
                      <p className="text-gray-500 text-sm mb-3">Aucune position — passe ton premier ordre !</p>
                      <button
                        onClick={() => setOrderModal({ symbol: "AAPL", name: "Apple Inc.", side: "buy" })}
                        className="text-xs px-4 py-2 rounded-xl bg-green-500/15 text-green-400 border border-green-500/25 hover:bg-green-500/25 transition font-semibold">
                        + Acheter AAPL
                      </button>
                    </div>
                  ) : (
                    <div className="divide-y divide-[#1a1a1a]">
                      {positionsWithPnl.map(p => (
                        <div key={p.symbol}
                          className="flex items-center justify-between px-5 py-4 hover:bg-white/[0.02] transition group">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-white/[0.06] rounded-xl flex items-center justify-center text-xs font-black">
                              {p.symbol.slice(0, 3)}
                            </div>
                            <div>
                              <button
                                onClick={() => router.push(`/dashboard?symbol=${p.symbol}`)}
                                className="text-sm font-bold text-white group-hover:text-green-400 transition">
                                {p.symbol}
                              </button>
                              <p className="text-xs text-gray-500">{p.qty} parts · moy. ${p.avg_price.toFixed(2)}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-5 text-right">
                            <div className="hidden md:block">
                              <p className="text-[10px] text-gray-600 uppercase tracking-wider">Prix</p>
                              <p className="text-sm font-bold text-white">${p.currentPrice.toFixed(2)}</p>
                            </div>
                            <div className="hidden md:block">
                              <p className="text-[10px] text-gray-600 uppercase tracking-wider">Valeur</p>
                              <p className="text-sm font-bold text-white">${p.value.toFixed(2)}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-gray-600 uppercase tracking-wider">P&L</p>
                              <p className={`text-sm font-bold ${p.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                                {p.pnl >= 0 ? "+" : ""}${p.pnl.toFixed(2)} ({p.pct >= 0 ? "+" : ""}{p.pct.toFixed(2)}%)
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => { setOrderModal({ symbol: p.symbol, name: p.name, side: "buy" }); setOrderQty("1") }}
                                className="text-xs px-2.5 py-1 rounded-lg bg-green-500/15 text-green-400 border border-green-500/20 hover:bg-green-500/25 transition">
                                +
                              </button>
                              <button
                                onClick={() => { setOrderModal({ symbol: p.symbol, name: p.name, side: "sell" }); setOrderQty(String(p.qty)) }}
                                className="text-xs px-2.5 py-1 rounded-lg bg-red-500/15 text-red-400 border border-red-500/20 hover:bg-red-500/25 transition">
                                −
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Historique */}
              {tab === "orders" && (
                <div className="divide-y divide-[#1a1a1a]">
                  {orders.length === 0 ? (
                    <div className="px-5 py-12 text-center text-gray-500 text-sm">Aucun ordre passé</div>
                  ) : orders.map(o => (
                    <div key={o.id} className="flex items-center justify-between px-5 py-3">
                      <div className="flex items-center gap-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                          o.side === "buy" ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"
                        }`}>
                          {o.side === "buy" ? "ACHAT" : "VENTE"}
                        </span>
                        <p className="text-sm font-bold">{o.symbol}</p>
                        <p className="text-xs text-gray-500">{o.qty} parts</p>
                      </div>
                      <div className="flex items-center gap-6 text-right">
                        <p className="text-xs text-gray-400">${o.price.toFixed(2)}/part</p>
                        <p className="text-sm font-bold text-white">${o.total.toFixed(2)}</p>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-400">
                          {o.status}
                        </span>
                        <p className="text-xs text-gray-600">
                          {new Date(o.created_at).toLocaleDateString("fr-FR")}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Modal ordre */}
      {orderModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-[#111] border border-white/10 rounded-2xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-black mb-1">
              {orderModal.side === "buy" ? "🟢 Acheter" : "🔴 Vendre"}
            </h3>
            <p className="text-gray-500 text-sm mb-5">Ordre au marché · Prix Yahoo Finance</p>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wider mb-2 block">Symbole</label>
                <input
                  value={orderModal.symbol}
                  onChange={(e) => setOrderModal({ ...orderModal, symbol: e.target.value.toUpperCase(), name: e.target.value.toUpperCase() })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-green-500/50"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wider mb-2 block">Quantité</label>
                <input
                  type="number"
                  value={orderQty}
                  onChange={(e) => setOrderQty(e.target.value)}
                  min="0.001"
                  step="0.001"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-green-500/50"
                />
              </div>
              <div className="bg-white/[0.03] rounded-xl px-4 py-3 text-xs text-gray-500">
                Cash disponible : <span className="text-white font-bold">${(account?.cash ?? 0).toLocaleString("fr-FR", { maximumFractionDigits: 2 })}</span>
              </div>

              {orderMsg && (
                <p className={`text-sm text-center font-semibold ${orderMsg.startsWith("✅") ? "text-green-400" : "text-red-400"}`}>
                  {orderMsg}
                </p>
              )}

              <div className="flex gap-3 pt-2">
                <button onClick={() => { setOrderModal(null); setOrderMsg("") }}
                  className="flex-1 py-2.5 rounded-xl border border-white/10 text-gray-400 hover:text-white transition text-sm">
                  Annuler
                </button>
                <button onClick={placeOrder} disabled={orderLoading}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition disabled:opacity-50 ${
                    orderModal.side === "buy"
                      ? "bg-green-500 hover:bg-green-400 text-white"
                      : "bg-red-500 hover:bg-red-400 text-white"
                  }`}>
                  {orderLoading ? "En cours..." : orderModal.side === "buy" ? "Acheter" : "Vendre"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}