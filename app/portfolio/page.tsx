"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { useToast } from "@/app/components/Toast"

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
  const toast = useToast()
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
        toast.success(`${orderModal.side === "buy" ? "Achat" : "Vente"} exécuté à $${data.price.toFixed(2)}`)
        setTimeout(() => { setOrderModal(null); setOrderMsg(""); loadData() }, 1500)
      } else {
        const errMsg = data.error ?? "Erreur"
        setOrderMsg(`❌ ${errMsg}`)
        toast.error(`Erreur : ${errMsg}`)
      }
    } catch {
      setOrderMsg("❌ Erreur réseau")
      toast.error("Erreur réseau")
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
    <div className="min-h-screen page-enter" style={{ background: "var(--bg-canvas)" }}>
      <div className="max-w-[1400px] mx-auto px-6 py-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Portfolio</h1>
            <p className="text-[13px] text-white/35 mt-0.5">Paper trading — simulation sans risque réel</p>
          </div>
          <button
            onClick={() => setOrderModal({ symbol: searchSym || "AAPL", name: searchSym || "Apple", side: "buy" })}
            className="btn btn-primary h-10 gap-2"
          >
            <span className="text-lg leading-none">+</span> Nouvel ordre
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[...Array(4)].map((_, i) => <div key={i} className="h-24 skeleton rounded-2xl" />)}
          </div>
        ) : (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
              {[
                {
                  label: "Valeur totale",
                  value: account && prices
                    ? `$${(account.cash + positions.reduce((s, p) => s + (prices[p.symbol] ?? p.avg_price) * p.qty, 0)).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : "—",
                  sub: "Capital + positions",
                  accent: true,
                },
                {
                  label: "Cash disponible",
                  value: account ? `$${account.cash.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—",
                  sub: "Solde libre",
                },
                {
                  label: "Positions ouvertes",
                  value: String(positions.length),
                  sub: positions.length === 0 ? "Aucune" : `${positions.length} actif${positions.length > 1 ? "s" : ""}`,
                },
                {
                  label: "Ordres total",
                  value: String(orders.length),
                  sub: orders.length === 0 ? "Aucun ordre" : "Historique complet",
                },
              ].map(kpi => (
                <div key={kpi.label} className={`rounded-2xl p-4 ${kpi.accent ? "border border-green-500/20" : ""}`} style={{ background: kpi.accent ? "rgba(34,197,94,0.06)" : "var(--bg-surface)", border: kpi.accent ? "1px solid rgba(34,197,94,0.2)" : "1px solid var(--border-subtle)" }}>
                  <p className="text-[11px] font-medium text-white/30 uppercase tracking-wider mb-2">{kpi.label}</p>
                  <p className="text-2xl font-bold text-white tabular-nums">{kpi.value}</p>
                  <p className="text-[11px] text-white/25 mt-1">{kpi.sub}</p>
                </div>
              ))}
            </div>

            {/* Tabs */}
            <div className="flex gap-0 border-b border-white/[0.06] mb-5">
              {(["positions", "orders"] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-5 py-2.5 text-[13px] font-medium border-b-2 transition-all ${tab === t ? "text-white border-white" : "text-white/30 border-transparent hover:text-white/60"}`}
                >
                  {t === "positions" ? `Positions (${positions.length})` : `Historique (${orders.length})`}
                </button>
              ))}
            </div>

            {/* Positions */}
            {tab === "positions" && (
              <div>
                {positions.length === 0 ? (
                  <div className="text-center py-16 rounded-2xl" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
                    <p className="text-4xl mb-3">📊</p>
                    <p className="text-[15px] font-semibold text-white/60">Aucune position ouverte</p>
                    <p className="text-[13px] text-white/30 mt-1">Commence par acheter un actif sur le Dashboard</p>
                    <a href="/dashboard" className="inline-flex items-center gap-2 mt-4 btn btn-primary h-10 text-[13px]">Aller au Dashboard →</a>
                  </div>
                ) : (
                  <div className="rounded-2xl overflow-hidden" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-white/[0.05]">
                          {["Actif", "Quantité", "Prix moyen", "Prix actuel", "Valeur", "P&L", "Actions"].map(h => (
                            <th key={h} className="text-left px-4 py-3 text-[11px] font-medium text-white/25 uppercase tracking-wider">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {positions.map(p => {
                          const cur  = prices[p.symbol] ?? p.avg_price
                          const pnl  = (cur - p.avg_price) * p.qty
                          const pnlP = ((cur - p.avg_price) / p.avg_price) * 100
                          const up   = pnl >= 0
                          return (
                            <tr key={p.symbol} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors last:border-0">
                              <td className="px-4 py-3.5">
                                <div>
                                  <p className="text-[14px] font-semibold text-white">{p.symbol.replace("-USD", "")}</p>
                                  <p className="text-[11px] text-white/30 truncate max-w-[120px]">{p.name}</p>
                                </div>
                              </td>
                              <td className="px-4 py-3.5 text-[13px] font-medium text-white/70 tabular-nums">{p.qty}</td>
                              <td className="px-4 py-3.5 text-[13px] text-white/50 tabular-nums">${p.avg_price.toFixed(2)}</td>
                              <td className="px-4 py-3.5 text-[13px] font-medium text-white/70 tabular-nums">{prices[p.symbol] ? `$${prices[p.symbol].toFixed(2)}` : "—"}</td>
                              <td className="px-4 py-3.5 text-[13px] font-semibold text-white/80 tabular-nums">${(cur * p.qty).toFixed(2)}</td>
                              <td className="px-4 py-3.5">
                                <div>
                                  <span className={`text-[13px] font-semibold tabular-nums ${up ? "text-green-400" : "text-red-400"}`}>
                                    {up ? "+" : ""}${pnl.toFixed(2)}
                                  </span>
                                  <span className={`ml-1.5 text-[11px] ${up ? "text-green-400/60" : "text-red-400/60"}`}>({up ? "+" : ""}{pnlP.toFixed(1)}%)</span>
                                </div>
                              </td>
                              <td className="px-4 py-3.5">
                                <button
                                  onClick={() => { setOrderModal({ symbol: p.symbol, name: p.name, side: "sell" }); setOrderQty(String(p.qty)) }}
                                  className="h-7 px-3 rounded-lg text-[11px] font-semibold text-red-400 hover:bg-red-500/10 transition"
                                  style={{ border: "1px solid rgba(239,68,68,0.2)" }}
                                >
                                  Vendre
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Orders */}
            {tab === "orders" && (
              <div>
                {orders.length === 0 ? (
                  <div className="text-center py-16 rounded-2xl" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
                    <p className="text-4xl mb-3">📋</p>
                    <p className="text-[15px] font-semibold text-white/60">Aucun ordre passé</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {orders.slice().reverse().map(order => {
                      const isBuy = order.side === "buy"
                      const date  = new Date(order.created_at)
                      return (
                        <div key={order.id} className="flex items-center gap-4 px-4 py-3 rounded-xl hover:bg-white/[0.02] transition-colors" style={{ border: "1px solid transparent" }}>
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-[13px] font-bold ${isBuy ? "text-green-400 bg-green-500/12" : "text-red-400 bg-red-500/12"}`}>
                            {isBuy ? "▲" : "▼"}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[13px] font-semibold text-white">{order.symbol.replace("-USD", "")}</span>
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${isBuy ? "text-green-400 bg-green-500/12" : "text-red-400 bg-red-500/12"}`}>
                                {isBuy ? "ACHAT" : "VENTE"}
                              </span>
                            </div>
                            <p className="text-[11px] text-white/30 truncate">{order.name}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-[13px] font-medium text-white/70 tabular-nums">{order.qty} × ${order.price.toFixed(2)}</p>
                            <p className="text-[11px] text-white/30">{date.toLocaleDateString("fr-FR")} {date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</p>
                          </div>
                          <div className="text-right flex-shrink-0 w-20">
                            <p className="text-[14px] font-bold text-white tabular-nums">${order.total.toFixed(2)}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Order Modal */}
      {orderModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4" onClick={() => setOrderModal(null)}>
          <div className="w-full max-w-sm rounded-2xl p-5 animate-slide-up" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }} onClick={e => e.stopPropagation()}>
            <h3 className="text-[15px] font-bold text-white mb-4">
              {orderModal.side === "buy" ? `Acheter ${orderModal.symbol.replace("-USD", "")}` : `Vendre ${orderModal.symbol.replace("-USD", "")}`}
            </h3>
            <div className="space-y-3 mb-4">
              <div>
                <label className="text-[11px] text-white/30 uppercase tracking-wider mb-1.5 block">Quantité</label>
                <input type="number" min="1" value={orderQty} onChange={e => setOrderQty(e.target.value)} className="input" />
              </div>
              {orderModal.side === "buy" && (
                <div>
                  <label className="text-[11px] text-white/30 uppercase tracking-wider mb-1.5 block">Rechercher un actif</label>
                  <input type="text" value={searchSym} onChange={e => setSearchSym(e.target.value.toUpperCase())} placeholder="ex: AAPL, TSLA..." className="input" />
                </div>
              )}
            </div>
            {orderMsg && <p className={`text-[13px] mb-3 font-medium ${orderMsg.startsWith("✅") ? "text-green-400" : "text-red-400"}`}>{orderMsg}</p>}
            <div className="flex gap-2">
              <button onClick={() => setOrderModal(null)} className="flex-1 h-10 btn btn-secondary text-[13px]">Annuler</button>
              <button
                onClick={placeOrder}
                disabled={orderLoading}
                className={`flex-1 h-10 btn text-[13px] disabled:opacity-40 ${orderModal.side === "buy" ? "btn-primary" : "btn-danger"}`}
              >
                {orderLoading ? "Exécution…" : orderModal.side === "buy" ? "Acheter" : "Vendre"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}