"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"
import dynamic from "next/dynamic"
const TradingChart = dynamic(() => import("@/app/components/TradingChart"), { ssr: false })
import AlertsPanel from "@/app/components/AlertsPanel"

type TickerData = {
  symbol: string
  name: string
  price: number
  change: number
  marketCap: number | null
  volume: number | null
  high: number | null
  low: number | null
  previousClose: number | null
  history: { date: string; value: number }[]
}

type Position = {
  symbol: string
  name: string
  qty: number
  avg_price: number
  take_profit: number | null
  stop_loss: number | null
}

const DEFAULT_WATCHLIST = ["AAPL", "TSLA", "MSFT", "NVDA", "BTC-USD", "ETH-USD"]

function fmt(n: number | null, prefix = "$") {
  if (n === null) return "—"
  if (n > 1_000_000_000) return `${prefix}${(n / 1_000_000_000).toFixed(1)}B`
  if (n > 1_000_000) return `${prefix}${(n / 1_000_000).toFixed(1)}M`
  return `${prefix}${n.toLocaleString()}`
}

export default function Dashboard() {
  const searchParams = useSearchParams()

  const [ticker, setTicker] = useState(searchParams.get("symbol") ?? "AAPL")
  const [search, setSearch] = useState("")
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [showSearch, setShowSearch] = useState(false)
  const [plan, setPlan] = useState("free")
  const [watchlist, setWatchlist] = useState<string[]>(DEFAULT_WATCHLIST)
  const [tickersData, setTickersData] = useState<Record<string, TickerData>>({})
  const [activeData, setActiveData] = useState<TickerData | null>(null)
  const [loadingActive, setLoadingActive] = useState(false)
  const [aiAnalysis, setAiAnalysis] = useState("")
  const [loadingAi, setLoadingAi] = useState(false)
  const [activeTab, setActiveTab] = useState<"chart" | "technique" | "ia">("chart")
  const [chartData, setChartData] = useState<any>(null)
  const [prediction, setPrediction] = useState<any>(null)
  const [loadingPrediction, setLoadingPrediction] = useState(false)
  const [loadingChart, setLoadingChart] = useState(false)

  // Position & ordre
  const [position, setPosition] = useState<Position | null>(null)
  const [orderHistory, setOrderHistory] = useState<{ type: "buy" | "sell"; price: number; qty: number; date: string }[]>([])
  const [orderModal, setOrderModal] = useState<"buy" | "sell" | null>(null)
  const [orderQty, setOrderQty] = useState("1")
  const [orderLoading, setOrderLoading] = useState(false)
  const [orderMsg, setOrderMsg] = useState("")
  const [orderTp, setOrderTp] = useState("")
  const [orderSl, setOrderSl] = useState("")
  const [tpSlModal, setTpSlModal] = useState(false)
  const [tpValue, setTpValue] = useState("")
  const [slValue, setSlValue] = useState("")
  const [account, setAccount] = useState<{ cash: number } | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [userProfile, setUserProfile] = useState<any>(null)
  const [bannerDismissed, setBannerDismissed] = useState(false)

  const searchTimeout = useRef<any>(null)

  async function getToken() {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token
  }

  // Auth
  useEffect(() => {
    supabase.auth.getSession().then(({ data: session }) => {
      if (session.session?.access_token) setToken(session.session.access_token)
    })
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      const { data: profile } = await supabase
        .from("profiles").select("plan").eq("email", data.user.email).single()
      if (profile) setPlan(profile.plan)
      // Fetch user profile for personalization
      const { data: sessionData } = await supabase.auth.getSession()
      const tok = sessionData.session?.access_token
      if (tok) {
        fetch("/api/user-profile", { headers: { Authorization: `Bearer ${tok}` } })
          .then(r => r.json())
          .then(j => { if (j.profile) setUserProfile(j.profile) })
          .catch(() => {})
      }
    })
  }, [])

  // Watchlist cards
  useEffect(() => {
    const list = userProfile?.preferred_assets?.includes("crypto")
      ? Array.from(new Set([...watchlist, "BTC-USD", "ETH-USD"]))
      : watchlist
    list.forEach((t) => { if (!tickersData[t]) fetchCardData(t) })
  }, [watchlist, userProfile])

  // Live price — poll every second for the active ticker
  useEffect(() => {
    let active = true
    async function tick() {
      try {
        const res = await fetch(`/api/price?symbol=${ticker}`)
        if (!res.ok) return
        const { price, change } = await res.json()
        if (active && price != null) {
          setActiveData(prev => prev ? { ...prev, price, change } : prev)
        }
      } catch {}
    }
    tick() // immediate first fetch
    const id = setInterval(tick, 1000)
    return () => { active = false; clearInterval(id) }
  }, [ticker])

  // Actif sélectionné
  useEffect(() => {
    setLoadingActive(true)
    setAiAnalysis("")
    setPrediction(null)
    setChartData(null)
    setOrderHistory([])
    fetch(`/api/quote?symbol=${ticker}`)
      .then(r => r.json())
      .then(d => { setActiveData(d); setLoadingActive(false) })
      .catch(() => setLoadingActive(false))
    loadPosition()
    loadOrders()
    loadAccount()
    // Auto-charge le graphe
    loadChart()
  }, [ticker])

  async function loadChart() {
    setLoadingChart(true)
    try {
      // Use the trading/chart route which returns { bars, signals, support, resistance }
      // TradingChart fetches its own data internally via /api/alpaca/chart
      const chartRes = await fetch(`/api/trading/chart?symbol=${ticker.replace("-USD", "")}`)
      const chart = await chartRes.json()
      if (!chart.error) setChartData(chart)
    } catch {}
    setLoadingChart(false)
  }

  async function loadPosition() {
    const token = await getToken()
    if (!token) return
    try {
      const res = await fetch(`/api/trading/positions?symbol=${ticker}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      setPosition(data.position)
      if (data.position?.take_profit) setTpValue(data.position.take_profit.toString())
      else setTpValue("")
      if (data.position?.stop_loss) setSlValue(data.position.stop_loss.toString())
      else setSlValue("")
    } catch {}
  }

  async function loadOrders() {
    const token = await getToken()
    if (!token) return
    try {
      const res = await fetch(`/api/trading/orders?symbol=${ticker}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (Array.isArray(data)) setOrderHistory(data)
    } catch {}
  }

  async function loadAccount() {
    const token = await getToken()
    if (!token) return
    try {
      const res = await fetch("/api/trading/account", {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      setAccount(data.account)
    } catch {}
  }

  async function fetchCardData(symbol: string) {
    try {
      const res = await fetch(`/api/quote?symbol=${symbol}`)
      const json = await res.json()
      if (!json.error) setTickersData(prev => ({ ...prev, [symbol]: json }))
    } catch {}
  }

  async function placeOrder(side: "buy" | "sell") {
    setOrderLoading(true)
    setOrderMsg("")
    const token = await getToken()
    if (!token) return
    try {
      const res = await fetch("/api/trading/order", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ symbol: ticker, name: activeData?.name ?? ticker, qty: orderQty, side })
      })
      const data = await res.json()
      if (data.success) {
        setOrderMsg(`✅ ${side === "buy" ? "Acheté" : "Vendu"} à $${data.price.toFixed(2)}`)
        // Save TP/SL immediately on buy
        if (side === "buy" && (orderTp || orderSl)) {
          await fetch("/api/trading/positions", {
            method: "PATCH",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              symbol: ticker,
              take_profit: orderTp ? parseFloat(orderTp) : null,
              stop_loss: orderSl ? parseFloat(orderSl) : null,
            })
          })
        }
        setTimeout(() => { setOrderModal(null); setOrderMsg(""); loadPosition(); loadOrders(); loadAccount() }, 1500)
      } else {
        setOrderMsg(`❌ ${data.error ?? "Erreur"}`)
      }
    } catch {
      setOrderMsg("❌ Erreur réseau")
    }
    setOrderLoading(false)
  }

  async function saveTpSl() {
    const token = await getToken()
    if (!token || !position) return
    await fetch("/api/trading/positions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        symbol: ticker,
        take_profit: tpValue ? parseFloat(tpValue) : null,
        stop_loss: slValue ? parseFloat(slValue) : null,
      })
    })
    setTpSlModal(false)
    loadPosition()
  }

  async function fetchAiAnalysis() {
    if (!activeData) return
    setLoadingAi(true)
    setAiAnalysis("")
    try {
      const res = await fetch("/api/ai-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: activeData.symbol,
          name: activeData.name,
          price: activeData.price.toFixed(2),
          change: activeData.change.toFixed(2),
          high: activeData.high?.toFixed(2),
          low: activeData.low?.toFixed(2),
          marketCap: activeData.marketCap,
          volume: activeData.volume,
        })
      })
      const data = await res.json()
      setAiAnalysis(data.analysis ?? "Analyse indisponible.")
    } catch {
      setAiAnalysis("Erreur lors de la génération. Réessaie.")
    }
    setLoadingAi(false)
  }

  async function fetchPrediction() {
    setLoadingPrediction(true)
    setPrediction(null)
    try {
      let chart = chartData
      if (!chart) {
        const chartRes = await fetch(`/api/trading/chart?symbol=${ticker.replace("-USD", "")}`)
        chart = await chartRes.json()
        if (!chart.error) setChartData(chart)
      }
      const predRes = await fetch("/api/alpaca/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: ticker,
          bars: chart.bars?.slice(-10),
          support: chart.support,
          resistance: chart.resistance,
          signals: chart.signals,
        })
      })
      const pred = await predRes.json()
      setPrediction(pred)
    } catch {}
    setLoadingPrediction(false)
  }

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setSearch(val)
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    if (val.length > 0) {
      setShowSearch(true)
      setSearchResults([])
      searchTimeout.current = setTimeout(async () => {
        try {
          const res = await fetch(`/api/search?q=${val}`)
          setSearchResults(await res.json())
        } catch { setSearchResults([]) }
      }, 300)
    } else {
      setShowSearch(false)
      setSearchResults([])
    }
  }

  function addToWatchlist(sym: string) {
    if (!watchlist.includes(sym)) setWatchlist(prev => [...prev, sym])
    setTicker(sym)
    setSearch("")
    setShowSearch(false)
  }

  function removeFromWatchlist(sym: string, e: React.MouseEvent) {
    e.stopPropagation()
    setWatchlist(prev => prev.filter(w => w !== sym))
    if (ticker === sym) setTicker(watchlist[0] || "AAPL")
  }

  const up = (activeData?.change ?? 0) >= 0
  const positionPnl = position && activeData ? (activeData.price - position.avg_price) * position.qty : null
  const positionPnlPct = position && activeData ? ((activeData.price - position.avg_price) / position.avg_price) * 100 : null
  const tpReached = !!(position?.take_profit && activeData && activeData.price >= position.take_profit)
  const slReached = !!(position?.stop_loss && activeData && activeData.price <= position.stop_loss)

  const openBuy = () => {
    const p = activeData?.price ?? 0
    setOrderModal("buy"); setOrderQty("1")
    setOrderTp(p ? (p * 1.05).toFixed(2) : "")
    setOrderSl(p ? (p * 0.97).toFixed(2) : "")
    setOrderMsg("")
  }

  // Personalized watchlist: add crypto if preferred
  const effectiveWatchlist = userProfile?.preferred_assets?.includes("crypto")
    ? Array.from(new Set([...watchlist, "BTC-USD", "ETH-USD"]))
    : watchlist

  const showBanner = userProfile && !bannerDismissed && (
    userProfile.level === "débutant" ||
    userProfile.preferred_assets?.includes("crypto") ||
    userProfile.risk_tolerance === "élevé"
  )

  return (
    <div className="min-h-screen text-white" style={{ background: "#080808" }}>

      {/* ── Personalization banner ──────────────────────────────────────── */}
      {showBanner && (
        <div className="border-b border-green-500/20 bg-green-500/5 px-5 py-2.5 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-3 flex-1 flex-wrap">
            {userProfile.level === "débutant" && (
              <a href="/apprendre/bases-trading" className="text-sm text-green-400 hover:text-green-300 transition font-semibold">
                📚 Recommandé pour toi : <span className="underline underline-offset-2">Les bases du trading</span>
              </a>
            )}
            {userProfile.preferred_assets?.includes("crypto") && (
              <span className="text-xs px-2 py-1 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 font-bold">
                ₿ Crypto ajoutée à ta watchlist
              </span>
            )}
            {userProfile.risk_tolerance === "élevé" && (
              <span className="text-xs px-2 py-1 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 font-bold">
                🔥 Signaux forts activés
              </span>
            )}
          </div>
          <button
            onClick={() => setBannerDismissed(true)}
            className="text-gray-600 hover:text-white transition text-xs flex-shrink-0"
            title="Fermer"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Top nav ─────────────────────────────────────────────────────── */}
      <div className="border-b border-white/[0.06] px-5 py-3 flex items-center gap-4">
        <span className="text-white font-black text-base tracking-tight mr-2">FinanceApp</span>

        {/* Watchlist pills */}
        <div className="flex gap-1 overflow-x-auto flex-1 scrollbar-hide">
          {effectiveWatchlist.map((sym) => {
            const item = tickersData[sym]
            const pos = (item?.change ?? 0) >= 0
            return (
              <div key={sym} onClick={() => setTicker(sym)}
                className={`group relative flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                  ticker === sym
                    ? "bg-white/10 text-white"
                    : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
                }`}>
                <button onClick={(e) => removeFromWatchlist(sym, e)}
                  className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-gray-700 hover:bg-red-500 rounded-full text-[9px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition z-10">×</button>
                <span className="font-bold">{sym.replace("-USD", "")}</span>
                {item ? (
                  <>
                    <span className="text-gray-400 font-mono">${item.price.toFixed(2)}</span>
                    <span className={`font-semibold ${pos ? "text-green-400" : "text-red-400"}`}>
                      {pos ? "+" : ""}{item.change.toFixed(2)}%
                    </span>
                    {item.history?.length > 0 && (
                      <div className="w-12 h-5 opacity-70">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={item.history} margin={{ top: 1, right: 0, left: 0, bottom: 1 }}>
                            <defs>
                              <linearGradient id={`g-${sym}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={pos ? "#4ade80" : "#f87171"} stopOpacity={0.4} />
                                <stop offset="100%" stopColor={pos ? "#4ade80" : "#f87171"} stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <Area type="monotone" dataKey="value" stroke={pos ? "#4ade80" : "#f87171"} strokeWidth={1} fill={`url(#g-${sym})`} dot={false} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </>
                ) : <span className="text-gray-700 text-[10px]">...</span>}
              </div>
            )
          })}
          <button onClick={() => document.querySelector<HTMLInputElement>("#search-input")?.focus()}
            className="flex-shrink-0 px-3 py-1.5 rounded-lg text-gray-600 hover:text-gray-400 text-xs transition">+ Ajouter</button>
        </div>

        {/* Search */}
        <div className="relative flex-shrink-0">
          <input id="search-input" type="text" value={search} onChange={handleSearchChange}
            onFocus={() => search && setShowSearch(true)}
            onBlur={() => setTimeout(() => setShowSearch(false), 200)}
            placeholder="Rechercher..."
            className="bg-white/5 border border-white/10 text-white placeholder-gray-600 px-3 py-1.5 rounded-lg w-44 focus:outline-none focus:border-white/20 text-xs" />
          {showSearch && (
            <div className="absolute top-full mt-1 right-0 w-64 bg-[#111] border border-white/10 rounded-xl overflow-hidden z-50 shadow-2xl">
              {searchResults.length === 0 ? (
                <div className="px-4 py-3 text-xs text-gray-500 flex items-center gap-2">
                  <div className="w-3 h-3 border border-gray-500 border-t-transparent rounded-full animate-spin" />Recherche...
                </div>
              ) : searchResults.map((r) => (
                <button key={r.symbol} onClick={() => addToWatchlist(r.symbol)}
                  className="w-full text-left px-4 py-2.5 hover:bg-white/[0.06] transition flex items-center justify-between border-b border-white/5 last:border-0">
                  <div>
                    <p className="text-white font-bold text-xs">{r.symbol}</p>
                    <p className="text-gray-500 text-[10px] truncate max-w-[160px]">{r.name}</p>
                  </div>
                  <span className="text-green-400 text-[10px] font-semibold">+ Add</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <span className={`flex-shrink-0 text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wide ${
          plan === "premium" ? "bg-yellow-500/15 text-yellow-400" :
          plan === "pro" ? "bg-green-500/15 text-green-400" : "bg-white/5 text-gray-500"
        }`}>{plan === "free" ? "Free" : plan === "pro" ? "Pro" : "Premium"}</span>
      </div>

      {/* ── Main layout: left chart | right sidebar ──────────────────────── */}
      <div className="flex items-start">

        {/* LEFT — chart + tabs */}
        <div className="flex-1 flex flex-col min-w-0">

          {/* Asset header */}
          <div className="px-5 pt-4 pb-3 border-b border-white/[0.05] flex items-end gap-5 flex-wrap">
            {activeData ? (
              <>
                <div>
                  <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-0.5">{activeData.name}</p>
                  <div className="flex items-baseline gap-3">
                    <span className="text-3xl font-black text-white tabular-nums">${activeData.price.toFixed(2)}</span>
                    <span className={`text-base font-bold ${up ? "text-green-400" : "text-red-400"}`}>
                      {up ? "+" : ""}{activeData.change.toFixed(2)}%
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded font-semibold ${up ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"}`}>
                      {up ? "▲" : "▼"} Aujourd'hui
                    </span>
                  </div>
                </div>
                <div className="flex gap-5 pb-0.5">
                  {[
                    { l: "Haut", v: activeData.high ? `$${activeData.high.toFixed(2)}` : "—" },
                    { l: "Bas", v: activeData.low ? `$${activeData.low.toFixed(2)}` : "—" },
                    { l: "Préc.", v: activeData.previousClose ? `$${activeData.previousClose.toFixed(2)}` : "—" },
                    { l: "Volume", v: fmt(activeData.volume, "") },
                    { l: "Mkt Cap", v: fmt(activeData.marketCap) },
                  ].map(k => (
                    <div key={k.l}>
                      <p className="text-[9px] text-gray-600 uppercase tracking-widest">{k.l}</p>
                      <p className="text-xs font-semibold text-gray-300 mt-0.5">{k.v}</p>
                    </div>
                  ))}
                </div>
                {(tpReached || slReached) && (
                  <div className={`ml-auto flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold ${
                    tpReached ? "bg-green-500/15 text-green-400 border border-green-500/30" : "bg-red-500/15 text-red-400 border border-red-500/30"
                  }`}>
                    {tpReached ? "🎯 Take Profit atteint !" : "⚠️ Stop Loss atteint !"}
                  </div>
                )}
              </>
            ) : (
              <div className="h-10 w-48 bg-white/5 rounded-lg animate-pulse" />
            )}
          </div>

          {/* Chart */}
          <div className="border border-white/[0.05]">
            <TradingChart
              symbol={ticker}
              position={position}
              signals={orderHistory}
            />
          </div>

          {/* Analysis tabs */}
          <div className="border-t border-white/[0.05]">
            <div className="flex border-b border-white/[0.05]">
              {[
                { key: "chart", label: "Signaux" },
                { key: "technique", label: "Indicateurs" },
                { key: "ia", label: "IA & Prédiction" },
              ].map(tab => (
                <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
                  className={`px-5 py-2.5 text-xs font-semibold transition border-b-2 ${
                    activeTab === tab.key ? "text-white border-white" : "text-gray-600 border-transparent hover:text-gray-400"
                  }`}>{tab.label}</button>
              ))}
            </div>
            <div>

              {/* Signaux */}
              {activeTab === "chart" && (
                <div className="p-4 space-y-3">
                  {chartData ? (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-green-500/5 border border-green-500/10 rounded-lg p-3">
                          <p className="text-[9px] text-green-500/60 uppercase tracking-widest mb-1">Support</p>
                          <p className="text-lg font-black text-green-400">${chartData.support}</p>
                          {activeData && <p className="text-[10px] text-gray-600 mt-0.5">+{((activeData.price - chartData.support) / chartData.support * 100).toFixed(1)}% au-dessus</p>}
                        </div>
                        <div className="bg-red-500/5 border border-red-500/10 rounded-lg p-3">
                          <p className="text-[9px] text-red-500/60 uppercase tracking-widest mb-1">Résistance</p>
                          <p className="text-lg font-black text-red-400">${chartData.resistance}</p>
                          {activeData && <p className="text-[10px] text-gray-600 mt-0.5">-{((chartData.resistance - activeData.price) / activeData.price * 100).toFixed(1)}% en dessous</p>}
                        </div>
                      </div>
                      {chartData.signals?.length > 0 ? (
                        <div className="space-y-1.5">
                          {chartData.signals.map((s: any, i: number) => (
                            <div key={i} className={`flex items-center gap-3 px-3 py-2 rounded-lg ${
                              s.type === "buy" ? "bg-green-500/5 border border-green-500/10" : "bg-red-500/5 border border-red-500/10"
                            }`}>
                              <span className={`text-xs font-black ${s.type === "buy" ? "text-green-400" : "text-red-400"}`}>{s.type === "buy" ? "▲" : "▼"}</span>
                              <p className="flex-1 text-xs text-gray-400">{s.reason}</p>
                              <span className="text-xs font-bold text-white">${s.price?.toFixed(2)}</span>
                              <span className="text-[10px] text-gray-600">{s.date}</span>
                              {s.type === "buy" && (
                                <button onClick={openBuy} className="text-[10px] px-2 py-0.5 rounded bg-green-500/20 text-green-400 hover:bg-green-500/30 transition">Acheter</button>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : <p className="text-gray-600 text-xs text-center py-4">Aucun signal détecté</p>}
                    </>
                  ) : (
                    <div className="text-center py-6">
                      <p className="text-gray-600 text-xs mb-2">Données indisponibles</p>
                      <button onClick={loadChart} className="text-[10px] px-3 py-1.5 rounded-lg bg-white/5 text-gray-500 hover:text-white transition">↻ Recharger</button>
                    </div>
                  )}
                </div>
              )}

              {/* Indicateurs TradingView */}
              {activeTab === "technique" && (
                <iframe key={ticker}
                  src={`https://s.tradingview.com/embed-widget/technical-analysis/?locale=fr#%7B%22interval%22%3A%221D%22%2C%22width%22%3A%22100%25%22%2C%22isTransparent%22%3Atrue%2C%22height%22%3A%22220%22%2C%22symbol%22%3A%22${ticker.replace("-", "")}%22%2C%22showIntervalTabs%22%3Atrue%2C%22colorTheme%22%3A%22dark%22%7D`}
                  width="100%" height={220} frameBorder="0" />
              )}

              {/* IA */}
              {activeTab === "ia" && (
                <div className="flex flex-col">
                  {/* Actions */}
                  <div className="flex gap-2 p-3 border-b border-white/[0.05]">
                    <button onClick={fetchAiAnalysis} disabled={loadingAi}
                      className="flex-1 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-gray-400 hover:text-white transition disabled:opacity-40">
                      {loadingAi ? "⏳..." : "📊 Analyse"}
                    </button>
                    <button onClick={fetchPrediction} disabled={loadingPrediction}
                      className="flex-1 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20 text-xs text-green-400 hover:bg-green-500/20 transition disabled:opacity-40">
                      {loadingPrediction ? "⏳ Calcul..." : "🎯 Prédire le prix"}
                    </button>
                  </div>

                  <div className="p-3 space-y-3">
                    {(loadingPrediction || loadingAi) && (
                      <div className="space-y-2">{[...Array(3)].map((_, i) => (
                        <div key={i} className="h-5 bg-white/5 rounded animate-pulse" style={{ width: `${85 - i * 12}%` }} />
                      ))}</div>
                    )}

                    {prediction && !loadingPrediction && (() => {
                      // Build prediction curve: last 20 historical bars + 3 future points
                      const hist = (chartData?.bars ?? []).slice(-20)
                      const now = activeData?.price ?? hist[hist.length - 1]?.close ?? 0
                      const curveData = [
                        ...hist.map((b: any) => ({ label: b.date, historique: b.close, prediction: null as number | null })),
                        { label: "Auj.", historique: now, prediction: now },
                        { label: "+7j", historique: null as number | null, prediction: Number(prediction.target_7d) },
                        { label: "+30j", historique: null as number | null, prediction: Number(prediction.target_30d) },
                      ]
                      const isUp = Number(prediction.target_30d) >= now
                      return (
                        <div className="space-y-3">
                          {/* Badges */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                              prediction.trend === "bullish" ? "bg-green-500/15 text-green-400" :
                              prediction.trend === "bearish" ? "bg-red-500/15 text-red-400" : "bg-yellow-500/15 text-yellow-400"
                            }`}>{prediction.trend === "bullish" ? "↑ Haussier" : prediction.trend === "bearish" ? "↓ Baissier" : "→ Neutre"}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                              prediction.recommendation === "ACHETER" ? "bg-green-500/10 text-green-400" :
                              prediction.recommendation === "VENDRE" ? "bg-red-500/10 text-red-400" : "bg-yellow-500/10 text-yellow-400"
                            }`}>{prediction.recommendation}</span>
                            <span className="text-[10px] text-gray-500 ml-1">Confiance <span className="text-white font-semibold">{prediction.confidence}%</span></span>
                          </div>

                          {/* Prediction curve chart */}
                          <div>
                            <p className="text-[9px] text-gray-600 uppercase tracking-widest mb-1.5">Courbe de prédiction</p>
                            <ResponsiveContainer width="100%" height={250}>
                              <AreaChart data={curveData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                                <defs>
                                  <linearGradient id="gradHist" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#6b7280" stopOpacity={0.2} />
                                    <stop offset="95%" stopColor="#6b7280" stopOpacity={0} />
                                  </linearGradient>
                                  <linearGradient id="gradPred" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={isUp ? "#4ade80" : "#f87171"} stopOpacity={0.25} />
                                    <stop offset="95%" stopColor={isUp ? "#4ade80" : "#f87171"} stopOpacity={0} />
                                  </linearGradient>
                                </defs>
                                <XAxis dataKey="label" tick={{ fill: "#4b5563", fontSize: 9 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                                <YAxis tick={{ fill: "#4b5563", fontSize: 9 }} tickLine={false} axisLine={false} domain={["auto", "auto"]} tickFormatter={(v) => `$${v}`} />
                                <Tooltip
                                  contentStyle={{ background: "#111", border: "1px solid #222", borderRadius: 8, fontSize: 10 }}
                                  labelStyle={{ color: "#666" }}
                                  formatter={(v: any, name: any) => [`$${Number(v).toFixed(2)}`, name === "historique" ? "Historique" : "Prédiction"]}
                                />
                                <Area type="monotone" dataKey="historique" stroke="#6b7280" strokeWidth={1.5} fill="url(#gradHist)" dot={false} connectNulls={false} />
                                <Area type="monotone" dataKey="prediction" stroke={isUp ? "#4ade80" : "#f87171"} strokeWidth={2} strokeDasharray="5 3" fill="url(#gradPred)" dot={{ fill: isUp ? "#4ade80" : "#f87171", r: 3, strokeWidth: 0 }} connectNulls />
                              </AreaChart>
                            </ResponsiveContainer>
                          </div>

                          {/* Targets */}
                          <div className="grid grid-cols-3 gap-1.5">
                            {[
                              { label: "Cible 7j", value: `$${prediction.target_7d}`, color: "text-green-400" },
                              { label: "Cible 30j", value: `$${prediction.target_30d}`, color: "text-blue-400" },
                              { label: "Stop Loss", value: `$${prediction.stop_loss}`, color: "text-red-400" },
                            ].map(t => (
                              <div key={t.label} className="bg-white/[0.03] border border-white/5 rounded-lg p-2">
                                <p className="text-[9px] text-gray-600 uppercase">{t.label}</p>
                                <p className={`text-xs font-black ${t.color}`}>{t.value}</p>
                              </div>
                            ))}
                          </div>

                          <p className="text-[11px] text-gray-400 leading-relaxed">{prediction.summary}</p>

                          {prediction.recommendation === "ACHETER" && (
                            <button onClick={openBuy} className="w-full py-2 rounded-lg bg-green-500 hover:bg-green-400 text-white text-xs font-bold transition">
                              Acheter {ticker.replace("-USD", "")}
                            </button>
                          )}
                          {prediction.recommendation === "VENDRE" && position && (
                            <button onClick={() => { setOrderModal("sell"); setOrderQty(String(position.qty)) }}
                              className="w-full py-2 rounded-lg bg-red-500 hover:bg-red-400 text-white text-xs font-bold transition">
                              Vendre {ticker.replace("-USD", "")}
                            </button>
                          )}
                        </div>
                      )
                    })()}

                    {aiAnalysis && !loadingAi && (
                      <div className="space-y-1 border-t border-white/5 pt-3">
                        {aiAnalysis.split("\n").map((line, i) => {
                          if (!line.trim()) return <div key={i} className="h-1.5" />
                          if (line.match(/^\*\*.*\*\*$/)) return <p key={i} className="text-white font-bold text-xs mt-2">{line.replace(/\*\*/g, "")}</p>
                          const parts = line.split(/\*\*(.*?)\*\*/)
                          return <p key={i} className="text-gray-500 text-[11px] leading-relaxed">{parts.map((p, j) => j % 2 === 1 ? <strong key={j} className="text-gray-300">{p}</strong> : p)}</p>
                        })}
                      </div>
                    )}

                    {!prediction && !aiAnalysis && !loadingAi && !loadingPrediction && (
                      <p className="text-gray-700 text-xs text-center py-6">Clique sur "Prédire le prix" pour voir la projection IA</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT — sidebar */}
        <div className="w-72 flex-shrink-0 border-l border-white/[0.05] flex flex-col overflow-y-auto sticky top-0 h-screen" style={{ background: "#0c0c0c" }}>

          {/* Cash */}
          <div className="px-4 pt-4 pb-3 border-b border-white/[0.05]">
            <p className="text-[9px] text-gray-600 uppercase tracking-widest mb-1">Cash disponible</p>
            <p className="text-xl font-black text-white tabular-nums">
              {account ? `$${account.cash.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
            </p>
          </div>

          {/* Position */}
          {position ? (
            <div className="px-4 py-3 border-b border-white/[0.05]">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[9px] text-gray-600 uppercase tracking-widest">Ma Position · {ticker.replace("-USD", "")}</p>
                <button onClick={() => setTpSlModal(true)} className="text-[9px] text-gray-600 hover:text-gray-300 transition px-2 py-0.5 rounded border border-white/10">⚙️ TP/SL</button>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <div>
                  <p className="text-[9px] text-gray-600 uppercase tracking-widest">Quantité</p>
                  <p className="text-sm font-bold text-white mt-0.5">{position.qty}</p>
                </div>
                <div>
                  <p className="text-[9px] text-gray-600 uppercase tracking-widest">Moy. achat</p>
                  <p className="text-sm font-bold text-white mt-0.5">${position.avg_price.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-[9px] text-gray-600 uppercase tracking-widest">Valeur</p>
                  <p className="text-sm font-bold text-white mt-0.5">{activeData ? `$${(activeData.price * position.qty).toFixed(2)}` : "—"}</p>
                </div>
                <div>
                  <p className="text-[9px] text-gray-600 uppercase tracking-widest">P&L</p>
                  <p className={`text-sm font-bold mt-0.5 ${(positionPnl ?? 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {(positionPnl ?? 0) >= 0 ? "+" : ""}${positionPnl?.toFixed(2)}
                    <span className="text-[10px] ml-1 opacity-70">({positionPnlPct?.toFixed(1)}%)</span>
                  </p>
                </div>
              </div>
              {(position.take_profit != null || position.stop_loss != null) && (
                <div className="flex gap-2 mt-1">
                  {position.take_profit != null && (
                    <div className="flex-1 bg-green-500/5 border border-green-500/15 rounded-lg px-2 py-1.5">
                      <p className="text-[9px] text-green-500/60 uppercase tracking-widest">TP</p>
                      <p className="text-xs font-bold text-green-400">${position.take_profit.toFixed(2)}</p>
                    </div>
                  )}
                  {position.stop_loss != null && (
                    <div className="flex-1 bg-red-500/5 border border-red-500/15 rounded-lg px-2 py-1.5">
                      <p className="text-[9px] text-red-500/60 uppercase tracking-widest">SL</p>
                      <p className="text-xs font-bold text-red-400">${position.stop_loss.toFixed(2)}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="px-4 py-3 border-b border-white/[0.05]">
              <p className="text-[9px] text-gray-700 uppercase tracking-widest">Aucune position ouverte sur {ticker.replace("-USD", "")}</p>
            </div>
          )}

          {/* Buy / Sell buttons */}
          <div className="px-4 py-3 border-b border-white/[0.05] space-y-2">
            <button onClick={openBuy}
              className="w-full py-3 rounded-xl bg-green-500 hover:bg-green-400 text-white text-sm font-black tracking-wide transition shadow-lg shadow-green-500/20">
              Acheter {ticker.replace("-USD", "")}
            </button>
            {position && (
              <button onClick={() => { setOrderModal("sell"); setOrderQty(String(position.qty)) }}
                className="w-full py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-sm font-bold transition">
                Vendre {position.qty} parts
              </button>
            )}
          </div>

          {/* Price alerts */}
          <AlertsPanel
            symbol={ticker}
            currentPrice={activeData?.price}
            token={token}
          />

          {/* Market stats */}
          {activeData && (
            <div className="px-4 py-3 border-b border-white/[0.05]">
              <p className="text-[9px] text-gray-600 uppercase tracking-widest mb-2">Marché</p>
              <div className="space-y-1.5">
                {[
                  { l: "Prix actuel", v: `$${activeData.price.toFixed(2)}`, c: up ? "text-green-400" : "text-red-400" },
                  { l: "Variation 24h", v: `${up ? "+" : ""}${activeData.change.toFixed(2)}%`, c: up ? "text-green-400" : "text-red-400" },
                  { l: "Haut du jour", v: activeData.high ? `$${activeData.high.toFixed(2)}` : "—" },
                  { l: "Bas du jour", v: activeData.low ? `$${activeData.low.toFixed(2)}` : "—" },
                  { l: "Clôture préc.", v: activeData.previousClose ? `$${activeData.previousClose.toFixed(2)}` : "—" },
                  { l: "Market Cap", v: fmt(activeData.marketCap) },
                  { l: "Volume", v: fmt(activeData.volume, "") },
                ].map(k => (
                  <div key={k.l} className="flex justify-between items-center">
                    <span className="text-[10px] text-gray-600">{k.l}</span>
                    <span className={`text-[10px] font-semibold tabular-nums ${k.c ?? "text-gray-300"}`}>{k.v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Order history */}
          {orderHistory.length > 0 && (
            <div className="px-4 py-3 flex-1">
              <p className="text-[9px] text-gray-600 uppercase tracking-widest mb-2">Mes ordres · {ticker.replace("-USD", "")}</p>
              <div className="space-y-1.5">
                {[...orderHistory].reverse().slice(0, 8).map((o, i) => (
                  <div key={i} className={`flex items-center justify-between px-2.5 py-2 rounded-lg border ${
                    o.type === "buy" ? "bg-green-500/5 border-green-500/10" : "bg-red-500/5 border-red-500/10"
                  }`}>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-black ${o.type === "buy" ? "text-green-400" : "text-red-400"}`}>
                        {o.type === "buy" ? "▲" : "▼"}
                      </span>
                      <div>
                        <p className={`text-[10px] font-bold ${o.type === "buy" ? "text-green-400" : "text-red-400"}`}>
                          {o.type === "buy" ? "Achat" : "Vente"} ×{o.qty}
                        </p>
                        <p className="text-[9px] text-gray-600">{o.date}</p>
                      </div>
                    </div>
                    <p className="text-[10px] font-bold text-white tabular-nums">${o.price.toFixed(2)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="px-4 py-3 mt-auto border-t border-white/[0.05]">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
              <span className="text-[9px] text-gray-700">Yahoo Finance · Groq AI · Live</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Modal Ordre ───────────────────────────────────────────────────── */}
      {orderModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-[#111] border border-white/10 rounded-2xl p-5 w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${orderModal === "buy" ? "bg-green-500/20" : "bg-red-500/20"}`}>
                  <span className={`text-sm font-black ${orderModal === "buy" ? "text-green-400" : "text-red-400"}`}>{orderModal === "buy" ? "B" : "S"}</span>
                </div>
                <div>
                  <p className="text-base font-black">{orderModal === "buy" ? "Acheter" : "Vendre"} {ticker.replace("-USD", "")}</p>
                  <p className="text-[10px] text-gray-500">{activeData?.name} · Marché au prix actuel</p>
                </div>
              </div>
              <button onClick={() => { setOrderModal(null); setOrderMsg("") }} className="text-gray-600 hover:text-white transition text-lg leading-none">×</button>
            </div>

            {/* Prix + cash */}
            <div className="bg-white/[0.03] border border-white/5 rounded-xl p-3 mb-4 flex justify-between items-center">
              <div>
                <p className="text-[9px] text-gray-600 uppercase tracking-widest">Prix actuel</p>
                <p className="text-lg font-black text-white">${activeData?.price.toFixed(2)}</p>
              </div>
              <div className="text-right">
                <p className="text-[9px] text-gray-600 uppercase tracking-widest">Cash</p>
                <p className={`text-sm font-bold ${(account?.cash ?? 0) < (activeData?.price ?? 0) * parseFloat(orderQty || "0") ? "text-red-400" : "text-green-400"}`}>
                  ${(account?.cash ?? 0).toFixed(2)}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {/* Quantité */}
              <div>
                <label className="text-[10px] text-gray-500 uppercase tracking-widest mb-1.5 block">Quantité</label>
                <div className="flex gap-1.5">
                  <input type="number" value={orderQty} onChange={(e) => setOrderQty(e.target.value)}
                    min="0.001" step="0.001"
                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/20" />
                  {["0.5", "1", "5", "10"].map(q => (
                    <button key={q} onClick={() => setOrderQty(q)}
                      className={`px-2.5 py-2 rounded-lg text-xs font-bold border transition ${
                        orderQty === q ? "bg-white/10 text-white border-white/20" : "bg-white/[0.03] text-gray-500 border-white/8 hover:text-white"
                      }`}>{q}</button>
                  ))}
                </div>
                <div className="flex justify-between mt-1.5 px-0.5">
                  <span className="text-[10px] text-gray-600">Total estimé</span>
                  <span className="text-[10px] font-bold text-white">${((activeData?.price ?? 0) * parseFloat(orderQty || "0")).toFixed(2)}</span>
                </div>
              </div>

              {/* TP/SL pour les achats */}
              {orderModal === "buy" && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-green-400/80 uppercase tracking-widest mb-1.5 block">Take Profit</label>
                    <input type="number" value={orderTp} onChange={(e) => setOrderTp(e.target.value)}
                      placeholder="Optionnel"
                      className="w-full bg-green-500/5 border border-green-500/15 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-green-500/40" />
                    <div className="flex gap-1 mt-1">
                      {[3, 5, 10].map(pct => (
                        <button key={pct} onClick={() => setOrderTp(((activeData?.price ?? 0) * (1 + pct/100)).toFixed(2))}
                          className="flex-1 py-0.5 rounded bg-green-500/10 text-green-400 text-[9px] hover:bg-green-500/20 transition">+{pct}%</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-red-400/80 uppercase tracking-widest mb-1.5 block">Stop Loss</label>
                    <input type="number" value={orderSl} onChange={(e) => setOrderSl(e.target.value)}
                      placeholder="Optionnel"
                      className="w-full bg-red-500/5 border border-red-500/15 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-red-500/40" />
                    <div className="flex gap-1 mt-1">
                      {[3, 5, 10].map(pct => (
                        <button key={pct} onClick={() => setOrderSl(((activeData?.price ?? 0) * (1 - pct/100)).toFixed(2))}
                          className="flex-1 py-0.5 rounded bg-red-500/10 text-red-400 text-[9px] hover:bg-red-500/20 transition">-{pct}%</button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {orderMsg && (
                <p className={`text-xs text-center font-semibold py-1 ${orderMsg.startsWith("✅") ? "text-green-400" : "text-red-400"}`}>{orderMsg}</p>
              )}

              <div className="flex gap-2 pt-1">
                <button onClick={() => { setOrderModal(null); setOrderMsg("") }}
                  className="px-4 py-2.5 rounded-xl border border-white/10 text-gray-500 hover:text-white transition text-sm">Annuler</button>
                <button onClick={() => placeOrder(orderModal)} disabled={orderLoading}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-black transition disabled:opacity-50 ${
                    orderModal === "buy" ? "bg-green-500 hover:bg-green-400 text-white" : "bg-red-500 hover:bg-red-400 text-white"
                  }`}>
                  {orderLoading ? "En cours..." : orderModal === "buy" ? "Confirmer l'achat" : "Confirmer la vente"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal TP/SL ───────────────────────────────────────────────────── */}
      {tpSlModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-[#111] border border-white/10 rounded-2xl p-5 w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-base font-black">Modifier TP / SL</p>
                <p className="text-[10px] text-gray-500">{ticker.replace("-USD", "")} · Prix actuel ${activeData?.price.toFixed(2)}</p>
              </div>
              <button onClick={() => setTpSlModal(false)} className="text-gray-600 hover:text-white text-lg">×</button>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="text-[10px] text-green-400/80 uppercase tracking-widest mb-1.5 block">Take Profit ($)</label>
                <input type="number" value={tpValue} onChange={(e) => setTpValue(e.target.value)}
                  placeholder={`Sug. ${((activeData?.price ?? 0) * 1.1).toFixed(2)}`}
                  className="w-full bg-green-500/5 border border-green-500/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500/40" />
                <div className="flex gap-1 mt-1.5">
                  {[5, 10, 15, 20].map(pct => (
                    <button key={pct} onClick={() => setTpValue(((activeData?.price ?? 0) * (1 + pct/100)).toFixed(2))}
                      className="flex-1 py-1 rounded bg-green-500/10 text-green-400 text-[9px] hover:bg-green-500/20 transition">+{pct}%</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[10px] text-red-400/80 uppercase tracking-widest mb-1.5 block">Stop Loss ($)</label>
                <input type="number" value={slValue} onChange={(e) => setSlValue(e.target.value)}
                  placeholder={`Sug. ${((activeData?.price ?? 0) * 0.9).toFixed(2)}`}
                  className="w-full bg-red-500/5 border border-red-500/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-red-500/40" />
                <div className="flex gap-1 mt-1.5">
                  {[5, 10, 15, 20].map(pct => (
                    <button key={pct} onClick={() => setSlValue(((activeData?.price ?? 0) * (1 - pct/100)).toFixed(2))}
                      className="flex-1 py-1 rounded bg-red-500/10 text-red-400 text-[9px] hover:bg-red-500/20 transition">-{pct}%</button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setTpSlModal(false)}
                className="px-4 py-2.5 rounded-xl border border-white/10 text-gray-500 hover:text-white transition text-sm">Annuler</button>
              <button onClick={saveTpSl} className="flex-1 py-2.5 rounded-xl bg-white text-black text-sm font-black hover:bg-gray-100 transition">Sauvegarder</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}