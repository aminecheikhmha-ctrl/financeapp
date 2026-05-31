"use client"

import { useEffect, useRef, useState, useCallback, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { useToast } from "@/app/components/Toast"
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"
import dynamic from "next/dynamic"
const TradingChart = dynamic(() => import("@/app/components/TradingChart"), { ssr: false })
import AlertsPanel from "@/app/components/AlertsPanel"
import PositionCalculator from "@/app/components/PositionCalculator"
import MarketStatusBar from "@/app/components/MarketStatusBar"
import { getMarketStatus } from "@/lib/market-hours"
import OnboardingChecklist from "@/app/components/OnboardingChecklist"
import Tour, { DASHBOARD_TOUR_STEPS } from "@/app/components/Tour"
import TooltipHint from "@/app/components/Tooltip"
import { cn } from "@/lib/utils"
import { Search, Plus, TrendingUp, TrendingDown, ChevronRight, Settings, ArrowUpRight, Star } from "lucide-react"
import GlobalSearch from "@/app/components/GlobalSearch"

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

function formatVolume(v?: number | null): string {
  if (!v) return "—"
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`
  return String(v)
}

function DashboardContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const toast = useToast()

  const [ticker, setTicker] = useState(searchParams.get("symbol") ?? "AAPL")
  const lessonParam = searchParams.get("lesson")
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
  const [activeTab, setActiveTab] = useState<"chart" | "technique" | "ia" | "news">("chart")
  const [newsData, setNewsData] = useState<{ articles: any[]; sentiment: any; reddit: any } | null>(null)
  const [loadingNews, setLoadingNews] = useState(false)
  const [chartData, setChartData] = useState<any>(null)
  const [prediction, setPrediction] = useState<any>(null)
  const [loadingPrediction, setLoadingPrediction] = useState(false)
  const [loadingChart, setLoadingChart] = useState(false)

  // Position & ordre
  const [position, setPosition] = useState<Position | null>(null)
  const [orderHistory, setOrderHistory] = useState<{ type: "buy" | "sell"; price: number; qty: number; date: string }[]>([])
  const [orderModal, setOrderModal] = useState<"buy" | "sell" | "short" | null>(null)
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
  const [showChecklist, setShowChecklist] = useState(true)
  const [marketRegime, setMarketRegime] = useState<any>(null)
  const [challenges, setChallenges] = useState<any[]>([])
  const [showTour, setShowTour] = useState(false)
  const [analyticsOpen, setAnalyticsOpen] = useState(false)
  const [rightTab, setRightTab] = useState<"trade" | "calc" | "ordres">("trade")
  const [perfSnapshots, setPerfSnapshots] = useState<{ date: string; daily_pnl: number; daily_pnl_pct: number; portfolio_value: number }[]>([])
  const [perfAlerts, setPerfAlerts] = useState<string[]>([])
  const [isDemo, setIsDemo] = useState(false)
  const [demoLoaded, setDemoLoaded] = useState(false)
  const [showSignupModal, setShowSignupModal] = useState(false)
  const [orderSide, setOrderSide] = useState<"buy" | "sell">("buy")
  const [orderMode, setOrderMode] = useState<"qty" | "capital">("qty")
  const [orderCapital, setOrderCapital] = useState("")
  const [rightPanel, setRightPanel] = useState<"watchlist" | "order">("order")
  const [showMobileOrder, setShowMobileOrder] = useState(false)
  const [priceFlash, setPriceFlash] = useState<"up" | "down" | null>(null)
  const prevPriceRef = useRef<number>(0)

  const searchTimeout = useRef<any>(null)

  async function getToken() {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token
  }

  async function loadDemoData() {
    try {
      const [quoteRes, signalsRes] = await Promise.all([
        fetch("/api/quote?symbol=AAPL"),
        fetch("/api/signals"),
      ])
      if (quoteRes.ok) {
        const quoteData = await quoteRes.json()
        if (!quoteData.error) setActiveData(quoteData)
      }
    } catch {}
    setDemoLoaded(true)
  }

  // Auth
  useEffect(() => {
    supabase.auth.getSession().then(({ data: session }) => {
      if (session.session?.access_token) {
        setToken(session.session.access_token)
      } else {
        setIsDemo(true)
        loadDemoData()
      }
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
        fetch("/api/streak", { method: "POST", headers: { Authorization: `Bearer ${tok}` } }).catch(() => {})
        fetch("/api/user-profile", { headers: { Authorization: `Bearer ${tok}` } })
          .then(r => r.json())
          .then(j => {
            if (j.profile) setUserProfile(j.profile)
            if (j.profile?.level === "débutant") setActiveTab("ia")
            if (j.profile?.level === "avancé") setActiveTab("technique")
            // Auto-switch tab based on lesson context
            if (lessonParam) {
              if (["rsi_calculation","spot_rsi","macd_explained","bollinger_bands","identify_support","support_resistance"].includes(lessonParam)) setActiveTab("technique")
              else if (lessonParam === "news" || lessonParam === "news_calculation") setActiveTab("news")
            }
            // Show tour for beginners who haven't completed it
            if (j.profile?.level === "débutant" && localStorage.getItem("tour_dashboard_v2") !== "1") {
              setShowTour(true)
            }
          })
          .catch(() => {})
        fetch("/api/challenges", { headers: { Authorization: `Bearer ${tok}` } })
          .then(r => r.json())
          .then(d => setChallenges(Array.isArray(d) ? d : []))
          .catch(() => {})
        // Performance snapshots for analytics widget
        supabase.auth.getUser().then(async ({ data: uData }) => {
          if (!uData.user) return
          const { data: snaps } = await supabase
            .from("performance_snapshots")
            .select("date, daily_pnl, daily_pnl_pct, portfolio_value")
            .eq("user_id", uData.user.id)
            .order("date", { ascending: false })
            .limit(30)
          const sorted = [...(snaps ?? [])].reverse()
          setPerfSnapshots(sorted as { date: string; daily_pnl: number; daily_pnl_pct: number; portfolio_value: number }[])
          // Performance alerts
          const alerts: string[] = []
          if (sorted.length > 0) {
            const latest = sorted[sorted.length - 1]
            const drawdown = ((100000 - (latest.portfolio_value ?? 100000)) / 100000) * 100
            if (drawdown > 10) alerts.push(`⚠️ Ton portfolio a baissé de ${drawdown.toFixed(1)}% — revois ta stratégie`)
          }
          setPerfAlerts(alerts)
        }).catch(() => {})
      }
    })
    fetch("/api/ai/market-regime").then(r => r.json()).then(setMarketRegime).catch(() => {})
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
      if (!active) return
      try {
        const res = await fetch(`/api/price?symbol=${ticker}`)
        if (!res.ok || !active) return
        const { price, change } = await res.json()
        if (active && price != null) {
          setActiveData(prev => prev
            ? { ...prev, price, change }
            : { symbol: ticker, name: ticker, price, change, marketCap: null, volume: null, high: null, low: null, previousClose: null, history: [] }
          )
        }
      } catch {}
      if (active) setTimeout(tick, 1000)
    }
    tick()
    return () => { active = false }
  }, [ticker])

  // Price flash effect
  useEffect(() => {
    if (!activeData?.price) return
    if (prevPriceRef.current === 0) { prevPriceRef.current = activeData.price; return }
    if (activeData.price > prevPriceRef.current) {
      setPriceFlash("up")
      setTimeout(() => setPriceFlash(null), 800)
    } else if (activeData.price < prevPriceRef.current) {
      setPriceFlash("down")
      setTimeout(() => setPriceFlash(null), 800)
    }
    prevPriceRef.current = activeData.price
  }, [activeData?.price])

  // Actif sélectionné
  useEffect(() => {
    setLoadingActive(true)
    setAiAnalysis("")
    setPrediction(null)
    setChartData(null)
    setOrderHistory([])
    setNewsData(null)
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

  async function placeOrder(side: "buy" | "sell" | "short") {
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
        const { haptic } = await import("@/lib/capacitor")
        await haptic("success")
        const isPending = data.status === "pending"
        const sideLabel = side === "buy" ? "Acheté" : side === "short" ? "Shorté" : "Vendu"
        setOrderMsg(isPending
          ? `⏳ Ordre planifié — exécution à l'ouverture`
          : `✅ ${sideLabel} à $${data.price.toFixed(2)}`)
        toast.success(isPending
          ? "Ordre planifié ✓ — exécution à l'ouverture du marché"
          : `Ordre exécuté ✓ — ${sideLabel} à $${data.price.toFixed(2)}`)
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
        fetch("/api/achievements/check", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ context: "trade" }),
        }).catch(() => {})
        setTimeout(() => { setOrderModal(null); setOrderMsg(""); loadPosition(); loadOrders(); loadAccount() }, 1500)
      } else {
        const { haptic } = await import("@/lib/capacitor")
        await haptic("error")
        const errMsg = data.error ?? "Erreur"
        setOrderMsg(`❌ ${errMsg}`)
        toast.error(`Erreur : ${errMsg}`)
      }
    } catch {
      const { haptic } = await import("@/lib/capacitor")
      await haptic("error")
      setOrderMsg("❌ Erreur réseau")
      toast.error("Erreur réseau")
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
    toast.success("Alerte créée ✓")
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

  async function fetchNewsData() {
    setLoadingNews(true)
    try {
      const [articlesRes, redditRes] = await Promise.all([
        fetch(`/api/news?symbol=${ticker}&limit=10`),
        fetch(`/api/news/reddit-buzz?symbol=${ticker}`),
      ])
      const articlesJson = articlesRes.ok ? await articlesRes.json() : null
      const redditJson = redditRes.ok ? await redditRes.json() : null
      if (articlesJson?.articles?.length) {
        const sentRes = await fetch("/api/news/sentiment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ articles: articlesJson.articles, symbol: ticker }),
        })
        const sentiment = sentRes.ok ? await sentRes.json() : null
        setNewsData({ articles: articlesJson.articles, sentiment, reddit: redditJson })
      } else {
        setNewsData({ articles: [], sentiment: null, reddit: redditJson })
      }
    } catch {}
    setLoadingNews(false)
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
    const tpParam = searchParams.get("tp")
    const slParam = searchParams.get("sl")
    setOrderModal("buy"); setOrderQty("1")
    setOrderTp(tpParam || (p ? (p * 1.05).toFixed(2) : ""))
    setOrderSl(slParam || (p ? (p * 0.97).toFixed(2) : ""))
    setOrderMsg("")
    setOrderMode("qty")
    setOrderCapital("")
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
    <div className="min-h-screen page-enter" style={{ background: "var(--bg-canvas)" }}>

      {/* ── Demo banner ──────────────────────────────────────────────────── */}
      {isDemo && (
        <div style={{ background: "linear-gradient(135deg, #0a1628, #0d1f0d)", borderBottom: "1px solid rgba(34,197,94,0.15)" }} className="relative">
          {/* Animated particles */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="absolute w-1 h-1 rounded-full bg-green-400/20 animate-pulse"
                style={{ left: `${15 + i * 15}%`, top: `${20 + (i % 3) * 30}%`, animationDelay: `${i * 0.5}s` }} />
            ))}
          </div>
          <div className="relative flex items-center justify-between px-5 py-3 flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)" }}>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400" />
                </span>
                <span className="text-[10px] text-green-400 font-black tracking-wider">MODE DÉMO</span>
              </div>
              <div>
                <p className="text-sm font-bold text-white">Tu explores Tradex avec de vraies données de marché</p>
                <p className="text-[11px] text-white/40">Graphes live · Signaux IA · $100,000 fictifs · Crée un compte pour trader</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <a href="/" className="px-3 py-2 rounded-xl text-sm font-semibold text-white/40 hover:text-white/70 transition flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                Accueil
              </a>
              <a href="/login" className="px-4 py-2 rounded-xl text-sm font-semibold text-white/60 hover:text-white transition border border-white/10">Se connecter</a>
              <a href="/signup" className="px-4 py-2 rounded-xl text-sm font-black text-black" style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)" }}>Créer un compte gratuit →</a>
            </div>
          </div>
        </div>
      )}

      {/* ── Signup modal (demo mode) ─────────────────────────────────────── */}
      {showSignupModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-sm rounded-3xl p-7 text-center" style={{ background: "#0d0d0d", border: "1px solid rgba(34,197,94,0.2)" }}>
            <div className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center text-3xl" style={{ background: "rgba(34,197,94,0.1)" }}>🚀</div>
            <h2 className="text-xl font-black text-white mb-2">Prêt à trader pour de vrai ?</h2>
            <p className="text-sm text-white/40 leading-relaxed mb-6">Crée ton compte gratuit en 30 secondes et commence avec <strong className="text-green-400">$100,000 fictifs</strong>.</p>
            <div className="space-y-2 mb-6 text-left">
              {["✅ Paper trading sans risque","✅ 3 signaux IA gratuits par jour","✅ Académie complète niveau débutant","✅ Tuteur IA personnel"].map(f => (
                <p key={f} className="text-xs text-white/60">{f}</p>
              ))}
            </div>
            <a href="/signup" className="block w-full py-3.5 rounded-2xl font-black text-sm text-black mb-3" style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)" }}>Créer mon compte gratuit →</a>
            <button onClick={() => setShowSignupModal(false)} className="text-xs text-white/25 hover:text-white/50 transition">Continuer en mode démo</button>
          </div>
        </div>
      )}

      {/* ── Personalized greeting ────────────────────────────────── */}
      {userProfile && (
        <div className="px-5 pt-4 pb-0">
          <p className="text-[12px] text-white/30 font-medium">
            {userProfile.level === "débutant" && "Tableau de bord simplifié · mode débutant"}
            {userProfile.level === "intermédiaire" && "Tableau de bord · niveau intermédiaire"}
            {userProfile.level === "avancé" && "Tableau de bord avancé"}
          </p>
        </div>
      )}

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

      {/* ── Watchlist bar ───────────────────────────────────────────────── */}
      <div className="border-b border-white/[0.06] px-3 md:px-4 py-2 flex items-center gap-2">

        {/* Watchlist pills */}
        <div data-tour="watchlist" className="flex gap-1 overflow-x-auto flex-1 scrollbar-hide items-center">
          {effectiveWatchlist.map((sym) => {
            const item = tickersData[sym]
            const pos = (item?.change ?? 0) >= 0
            return (
              <div key={sym} onClick={() => setTicker(sym)}
                className={cn(
                  "group relative flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer",
                  ticker === sym
                    ? "bg-white/8 text-white border border-white/10"
                    : "text-white/40 hover:text-white/70 hover:bg-white/4 border border-transparent"
                )}>
                <button onClick={(e) => removeFromWatchlist(sym, e)}
                  className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-[#333] hover:bg-red-500 rounded-full text-[9px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition z-10">×</button>
                <span className="font-semibold tracking-tight">{sym.replace("-USD", "")}</span>
                {item ? (
                  <>
                    <span className="text-white/50 font-mono tabular-nums">${item.price < 1 ? item.price.toFixed(4) : item.price.toFixed(2)}</span>
                    <span className={cn("font-semibold tabular-nums", pos ? "text-green-400" : "text-red-400")}>
                      {pos ? "+" : ""}{item.change.toFixed(2)}%
                    </span>
                    {item.history?.length > 0 && (
                      <div className="w-10 h-4 opacity-60">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={item.history} margin={{ top: 1, right: 0, left: 0, bottom: 1 }}>
                            <defs>
                              <linearGradient id={`g-${sym}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={pos ? "#4ade80" : "#f87171"} stopOpacity={0.3} />
                                <stop offset="100%" stopColor={pos ? "#4ade80" : "#f87171"} stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <Area type="monotone" dataKey="value" stroke={pos ? "#4ade80" : "#f87171"} strokeWidth={1} fill={`url(#g-${sym})`} dot={false} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </>
                ) : <span className="text-white/20 text-[10px]">···</span>}
              </div>
            )
          })}
          {/* Add to watchlist inline search */}
          <div className="relative flex-shrink-0">
            <input id="search-input" type="text" value={search} onChange={handleSearchChange}
              onFocus={() => search && setShowSearch(true)}
              onBlur={() => setTimeout(() => setShowSearch(false), 200)}
              placeholder="+ Ajouter"
              className="w-24 px-3 py-1.5 rounded-lg bg-transparent border border-transparent hover:border-white/10 focus:border-white/20 focus:bg-white/4 text-white/40 focus:text-white placeholder-white/25 text-xs outline-none transition" />
            {showSearch && (
              <div className="absolute top-full mt-1 left-0 w-64 rounded-xl overflow-hidden z-50 shadow-2xl" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}>
                {searchResults.length === 0 ? (
                  <div className="px-4 py-3 text-xs text-white/30 flex items-center gap-2">
                    <div className="w-3 h-3 border border-white/20 border-t-white/60 rounded-full animate-spin" />Recherche...
                  </div>
                ) : searchResults.map((r) => (
                  <button key={r.symbol} onClick={() => addToWatchlist(r.symbol)}
                    className="w-full text-left px-4 py-2.5 hover:bg-white/[0.05] transition flex items-center justify-between border-b border-white/[0.04] last:border-0">
                    <div>
                      <p className="text-white font-semibold text-xs">{r.symbol}</p>
                      <p className="text-white/30 text-[10px] truncate max-w-[160px]">{r.name}</p>
                    </div>
                    <span className="text-green-400 text-[10px] font-semibold">+ Ajouter</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <span className={cn(
          "hidden sm:inline flex-shrink-0 text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide",
          plan === "premium" ? "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20" :
          plan === "pro" ? "bg-green-500/10 text-green-400 border border-green-500/20" :
          "bg-white/4 text-white/25 border border-white/8"
        )}>{plan === "free" ? "Free" : plan === "pro" ? "Pro" : "Premium"}</span>
      </div>

      {/* ── Main layout: left chart | right sidebar ──────────────────────── */}
      <div className="flex flex-col md:flex-row">

        {/* LEFT — chart + tabs */}
        <div className="flex-1 flex flex-col min-w-0">

          {/* Onboarding checklist */}
          {showChecklist && (
            <div className="px-5 pt-4">
              <OnboardingChecklist
                positions={position ? [position] : []}
                watchlist={watchlist}
                onDismiss={() => setShowChecklist(false)}
              />
            </div>
          )}

          {/* ── AI Market Intelligence bandeau ─────────────────────── */}
          {marketRegime && (
            <div
              className="mx-4 mt-4 rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap text-sm cursor-pointer hover:opacity-80 transition"
              style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}
              onClick={() => router.push("/coach")}
            >
              {userProfile?.level === "débutant" ? (
                <>
                  <span className="text-base">🧠</span>
                  <span className={`text-sm font-semibold ${
                    marketRegime.regime === "risk_on" ? "text-green-400" :
                    marketRegime.regime === "risk_off" ? "text-red-400" : "text-yellow-400"
                  }`}>
                    {marketRegime.regime === "risk_on"
                      ? "Les marchés sont en bonne forme aujourd'hui 📈"
                      : marketRegime.regime === "risk_off"
                      ? "Les marchés sont en baisse aujourd'hui 📉"
                      : "Les marchés sont indécis aujourd'hui ↔️"}
                  </span>
                  <span className="text-green-400 text-xs ml-auto">Voir l'analyse →</span>
                </>
              ) : (
                <>
                  <span className="text-base">🧠</span>
                  <span className="text-gray-500 text-xs font-semibold uppercase tracking-wide">Intelligence du marché</span>
                  <span className={`px-2 py-0.5 rounded-lg text-xs font-black ${
                    marketRegime.regime === "risk_on" ? "bg-green-500/15 text-green-400 border border-green-500/25" :
                    marketRegime.regime === "risk_off" ? "bg-red-500/15 text-red-400 border border-red-500/25" :
                    "bg-yellow-500/15 text-yellow-400 border border-yellow-500/25"
                  }`}>
                    {marketRegime.regime === "risk_on" ? "🟢 Risk On" : marketRegime.regime === "risk_off" ? "🔴 Risk Off" : "🟡 Transition"}
                  </span>
                  <span className="text-gray-500 text-xs">VIX: <span className="text-white font-bold">{marketRegime.vix_level}</span></span>
                  <span className="text-gray-600 text-xs hidden sm:block truncate flex-1">{marketRegime.commentary}</span>
                  <span className="text-green-400 text-xs ml-auto hidden sm:block">Voir Coach →</span>
                </>
              )}
            </div>
          )}

          {/* Lesson context banner — shown when arriving from academy */}
          {lessonParam && (
            <div className="mx-4 mt-4 px-4 py-3 rounded-xl flex items-center gap-3 flex-wrap"
              style={{ background: "rgba(96,165,250,0.05)", border: "1px solid rgba(96,165,250,0.15)" }}>
              <span>🎓</span>
              <div className="flex-1">
                <p className="text-xs font-bold text-blue-400">Mode apprentissage actif</p>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  {lessonParam === "rsi_calculation" || lessonParam === "spot_rsi"
                    ? `Le RSI de ${ticker.replace("-USD","")} est visible dans l'onglet Indicateurs ci-dessous.`
                    : lessonParam === "macd_explained"
                    ? `Observe le MACD de ${ticker.replace("-USD","")} dans l'onglet Indicateurs.`
                    : lessonParam === "identify_support" || lessonParam === "support_resistance"
                    ? `Le support/résistance de ${ticker.replace("-USD","")} est visible dans l'onglet Signaux.`
                    : `Applique ce que tu viens d'apprendre sur ${ticker.replace("-USD","")}.`}
                </p>
              </div>
              <a href="/apprendre" className="text-[10px] font-bold px-3 py-1.5 rounded-lg flex-shrink-0 transition"
                style={{ background: "rgba(96,165,250,0.1)", color: "#60a5fa", border: "1px solid rgba(96,165,250,0.2)" }}>
                ← Retour au cours
              </a>
            </div>
          )}

          {/* Asset header — premium */}
          <div className="flex items-center justify-between flex-wrap gap-3 px-5 py-4 border-b border-white/5">
            {activeData ? (
              <>
                <div className="flex items-center gap-4">
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-black text-black flex-shrink-0"
                    style={{ background: up ? "#22c55e" : "#ef4444" }}>
                    {ticker.replace("-USD", "")[0]}
                  </div>
                  {/* Name + symbol */}
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-base font-black text-white">{ticker.replace("-USD", "")}</h2>
                      <span className="text-xs text-white/30 truncate max-w-[180px]">{activeData.name}</span>
                      <MarketStatusBar symbol={ticker} />
                    </div>
                    <p className="text-[10px] text-white/20 mt-0.5">
                      {ticker.includes("USD") ? "Crypto · 24h/7j" :
                       ticker === "SPY" || ticker === "QQQ" ? "ETF · NYSE" :
                       "NYSE/NASDAQ · 9h30-16h ET"}
                    </p>
                  </div>
                </div>

                {/* Prix + variation + stats */}
                <div className="flex items-end gap-4 flex-wrap">
                  <div className="text-right">
                    <div className={`text-3xl font-black tabular-nums leading-none transition-colors ${
                      priceFlash === "up" ? "text-green-400" :
                      priceFlash === "down" ? "text-red-400" : "text-white"
                    }`}>
                      ${activeData.price < 1 ? activeData.price.toFixed(4) : activeData.price.toFixed(2)}
                    </div>
                    <div className={`flex items-center gap-1.5 justify-end mt-1 ${up ? "text-green-400" : "text-red-400"}`}>
                      <span className="text-sm font-black tabular-nums">
                        {up ? "▲" : "▼"}{Math.abs(activeData.change).toFixed(2)}%
                      </span>
                      <span className="text-xs opacity-60 tabular-nums">
                        ({up ? "+" : ""}{((activeData.price) * (activeData.change) / 100).toFixed(2)})
                      </span>
                    </div>
                  </div>

                  {/* Stats rapides */}
                  <div className="hidden lg:flex items-center gap-4 px-4 py-2 rounded-xl"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    {[
                      { label: "Ouv.",  value: activeData.previousClose?.toFixed(2) ?? "—" },
                      { label: "Haut",  value: activeData.high?.toFixed(2) ?? "—", color: "#4ade80" },
                      { label: "Bas",   value: activeData.low?.toFixed(2)  ?? "—", color: "#f87171" },
                      { label: "Vol.",  value: formatVolume(activeData.volume) },
                    ].map(stat => (
                      <div key={stat.label} className="text-center">
                        <p className="text-[9px] text-white/20 uppercase tracking-widest mb-0.5">{stat.label}</p>
                        <p className="text-xs font-bold tabular-nums" style={{ color: stat.color ?? "rgba(255,255,255,0.6)" }}>
                          {stat.label === "Vol." ? stat.value : `$${stat.value}`}
                        </p>
                      </div>
                    ))}
                  </div>

                  {(tpReached || slReached) && (
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold ${
                      tpReached ? "bg-green-500/15 text-green-400 border border-green-500/30" : "bg-red-500/15 text-red-400 border border-red-500/30"
                    }`}>
                      {tpReached ? "🎯 Take Profit atteint !" : "⚠️ Stop Loss atteint !"}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-white/5 animate-pulse" />
                <div className="space-y-2">
                  <div className="h-4 w-32 bg-white/5 rounded animate-pulse" />
                  <div className="h-8 w-48 bg-white/5 rounded animate-pulse" />
                </div>
              </div>
            )}
          </div>

          {/* Chart */}
          <div data-tour="chart" className="border border-white/[0.05]">
            {userProfile?.level === "débutant" && (
              <div className="mx-4 mt-3 px-3 py-2 rounded-lg bg-blue-500/5 border border-blue-500/10 text-xs text-blue-400 flex items-center gap-2">
                <span>💡</span>
                <span>Les barres <strong>vertes</strong> signifient que le prix a monté, les <strong>rouges</strong> qu'il a baissé.</span>
              </div>
            )}
            <TradingChart
              symbol={ticker}
              position={position}
              signals={orderHistory}
              livePrice={activeData?.price}
            />
          </div>

          {/* Analysis tabs */}
          <div className="border-t border-white/[0.05]">
            <div className="flex border-b border-white/[0.05] overflow-x-auto scrollbar-hide">
              {((userProfile?.xp ?? 0) < 1500
                ? [
                    { key: "ia", label: "Que dit l'IA ? 🤖" },
                    { key: "chart", label: "Signaux" },
                    { key: "news", label: "📰 News" },
                  ]
                : [
                    { key: "chart", label: "Signaux" },
                    { key: "technique", label: "Indicateurs" },
                    { key: "ia", label: "Que dit l'IA ? 🤖" },
                    { key: "news", label: "📰 News & Sentiment" },
                  ]
              ).map(tab => {
                const isBlocked = isDemo && tab.key !== "chart"
                return (
                  <button key={tab.key}
                    onClick={() => isBlocked ? setShowSignupModal(true) : setActiveTab(tab.key as any)}
                    data-tour={tab.key === "ia" ? "ia-tab" : undefined}
                    className={`flex-shrink-0 whitespace-nowrap px-4 py-2.5 text-xs font-semibold transition border-b-2 ${
                      activeTab === tab.key ? "text-white border-white" : "text-gray-600 border-transparent hover:text-gray-400"
                    }`}>
                    {isBlocked ? "🔒 " : ""}{tab.label}
                  </button>
                )
              })}
              {(userProfile?.xp ?? 0) < 1500 && (
                <div className="flex items-center gap-1 px-3 py-2.5 text-[10px] text-gray-700 border-b-2 border-transparent">
                  🔒 Indicateurs <span className="text-[9px] ml-1 px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-500/60 border border-yellow-500/15">Niveau Trader requis</span>
                </div>
              )}
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
                                <button onClick={isDemo ? () => setShowSignupModal(true) : openBuy} className="text-[10px] px-2 py-0.5 rounded bg-green-500/20 text-green-400 hover:bg-green-500/30 transition">Acheter</button>
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

              {/* Indicateurs */}
              {activeTab === "technique" && (() => {
                if (!chartData || loadingChart) {
                  return (
                    <div className="p-6 text-center">
                      {loadingChart ? (
                        <div className="flex items-center justify-center gap-2 text-gray-600 text-xs">
                          <div className="w-3.5 h-3.5 border-2 border-gray-600 border-t-white rounded-full animate-spin" />
                          Calcul des indicateurs...
                        </div>
                      ) : (
                        <>
                          <p className="text-gray-600 text-xs mb-3">Aucune donnée disponible pour calculer les indicateurs.</p>
                          <button onClick={loadChart} className="text-[10px] px-3 py-1.5 rounded-lg bg-white/5 text-gray-500 hover:text-white transition">↻ Charger les données</button>
                        </>
                      )}
                    </div>
                  )
                }
                const bars = chartData?.bars ?? []
                const closes = bars.map((b: any) => b.close).filter(Boolean)
                const highs  = bars.map((b: any) => b.high).filter(Boolean)
                const lows   = bars.map((b: any) => b.low).filter(Boolean)
                const n = closes.length

                // RSI (déjà calculé dans bars)
                const rsiVal = bars[n - 1]?.rsi ?? null

                // EMA helper
                const ema = (data: number[], period: number) => {
                  const k = 2 / (period + 1)
                  let val = data.slice(0, period).reduce((a: number, b: number) => a + b, 0) / period
                  for (let i = period; i < data.length; i++) val = data[i] * k + val * (1 - k)
                  return parseFloat(val.toFixed(2))
                }
                const ema9Val  = n >= 9  ? ema(closes, 9)  : null
                const ema21Val = n >= 21 ? ema(closes, 21) : null
                const ema50Val = n >= 50 ? ema(closes, 50) : null

                // MACD (EMA12 - EMA26)
                const ema12 = n >= 12 ? ema(closes, 12) : null
                const ema26 = n >= 26 ? ema(closes, 26) : null
                const macdVal = ema12 !== null && ema26 !== null ? parseFloat((ema12 - ema26).toFixed(2)) : null

                // Bollinger Bands (20, ±2σ)
                let bbUpper: number | null = null, bbLower: number | null = null, bbMid: number | null = null
                if (n >= 20) {
                  const slice = closes.slice(-20)
                  const avg = slice.reduce((a: number, b: number) => a + b, 0) / 20
                  const std = Math.sqrt(slice.reduce((a: number, b: number) => a + (b - avg) ** 2, 0) / 20)
                  bbMid = parseFloat(avg.toFixed(2))
                  bbUpper = parseFloat((avg + 2 * std).toFixed(2))
                  bbLower = parseFloat((avg - 2 * std).toFixed(2))
                }

                // Stochastic %K (14)
                let stochK: number | null = null
                if (n >= 14) {
                  const recentH = highs.slice(-14)
                  const recentL = lows.slice(-14)
                  const hh = Math.max(...recentH)
                  const ll = Math.min(...recentL)
                  stochK = hh !== ll ? parseFloat(((closes[n - 1] - ll) / (hh - ll) * 100).toFixed(1)) : 50
                }

                // ATR (14)
                let atrVal: number | null = null
                if (n >= 14) {
                  const trs = []
                  for (let i = Math.max(1, n - 14); i < n; i++) {
                    const tr = Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1]))
                    trs.push(tr)
                  }
                  atrVal = parseFloat((trs.reduce((a, b) => a + b, 0) / trs.length).toFixed(2))
                }

                const price = closes[n - 1] ?? 0

                const indicators = [
                  {
                    label: "RSI (14)",
                    value: rsiVal !== null ? rsiVal.toFixed(1) : "—",
                    signal: rsiVal !== null ? (rsiVal > 70 ? "Suracheté" : rsiVal < 30 ? "Survendu" : "Neutre") : "—",
                    color: rsiVal !== null ? (rsiVal > 70 ? "#f87171" : rsiVal < 30 ? "#4ade80" : "#9ca3af") : "#9ca3af",
                    bar: rsiVal !== null ? rsiVal : null, barMax: 100,
                    desc: `Oscillateur de momentum`,
                  },
                  {
                    label: "MACD",
                    value: macdVal !== null ? (macdVal >= 0 ? `+${macdVal}` : `${macdVal}`) : "—",
                    signal: macdVal !== null ? (macdVal > 0 ? "Haussier" : "Baissier") : "—",
                    color: macdVal !== null ? (macdVal > 0 ? "#4ade80" : "#f87171") : "#9ca3af",
                    bar: null, barMax: 100,
                    desc: `EMA12 − EMA26`,
                  },
                  {
                    label: "Stochastic %K",
                    value: stochK !== null ? stochK.toFixed(1) : "—",
                    signal: stochK !== null ? (stochK > 80 ? "Suracheté" : stochK < 20 ? "Survendu" : "Neutre") : "—",
                    color: stochK !== null ? (stochK > 80 ? "#f87171" : stochK < 20 ? "#4ade80" : "#9ca3af") : "#9ca3af",
                    bar: stochK, barMax: 100,
                    desc: `Oscillateur (14)`,
                  },
                  {
                    label: "Bollinger",
                    value: bbUpper !== null ? `±${((bbUpper - bbLower!) / 2).toFixed(2)}` : "—",
                    signal: bbUpper !== null ? (price >= bbUpper ? "En zone haute" : price <= bbLower! ? "En zone basse" : "Dans les bandes") : "—",
                    color: bbUpper !== null ? (price >= bbUpper ? "#f87171" : price <= bbLower! ? "#4ade80" : "#9ca3af") : "#9ca3af",
                    bar: null, barMax: 100,
                    desc: bbUpper !== null ? `${bbLower?.toFixed(0)} – ${bbUpper?.toFixed(0)}` : "MM20 ±2σ",
                  },
                  {
                    label: "EMA 9 / 21",
                    value: ema9Val !== null && ema21Val !== null ? `${ema9Val > ema21Val ? "↑" : "↓"}` : "—",
                    signal: ema9Val !== null && ema21Val !== null ? (ema9Val > ema21Val ? "Haussier" : "Baissier") : "—",
                    color: ema9Val !== null && ema21Val !== null ? (ema9Val > ema21Val ? "#4ade80" : "#f87171") : "#9ca3af",
                    bar: null, barMax: 100,
                    desc: ema9Val !== null ? `EMA9: ${ema9Val} · EMA21: ${ema21Val}` : "Croisement EMA",
                  },
                  {
                    label: "ATR (14)",
                    value: atrVal !== null ? `$${atrVal}` : "—",
                    signal: atrVal !== null && price > 0 ? `${((atrVal / price) * 100).toFixed(1)}% volatilité` : "—",
                    color: "#a78bfa",
                    bar: null, barMax: 100,
                    desc: "Average True Range",
                  },
                ]

                return (
                  <div className="p-3 grid grid-cols-2 gap-2">
                    {indicators.map(ind => (
                      <div key={ind.label} className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">{ind.label}</span>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md" style={{ background: `${ind.color}18`, color: ind.color }}>{ind.signal}</span>
                        </div>
                        <p className="text-xl font-black text-white">{ind.value}</p>
                        {ind.bar !== null && (
                          <div className="mt-1.5 h-1 rounded-full overflow-hidden bg-white/10">
                            <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, ind.bar)}%`, background: ind.color }} />
                          </div>
                        )}
                        <p className="text-[9px] text-gray-700 mt-1">{ind.desc}</p>
                      </div>
                    ))}
                    {/* MM50 price line */}
                    {ema50Val !== null && (
                      <div className="col-span-2 rounded-xl p-3 flex items-center justify-between" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                        <div>
                          <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">EMA 50</p>
                          <p className="text-lg font-black text-white">${ema50Val}</p>
                        </div>
                        <div className="text-right">
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md" style={{
                            background: price > ema50Val ? "rgba(74,222,128,0.1)" : "rgba(248,113,113,0.1)",
                            color: price > ema50Val ? "#4ade80" : "#f87171"
                          }}>
                            Prix {price > ema50Val ? "au-dessus" : "en-dessous"} — {price > ema50Val ? "Tendance haussière" : "Tendance baissière"}
                          </span>
                          <p className="text-[9px] text-gray-700 mt-1">Moyenne mobile 50 périodes</p>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* News & Sentiment */}
              {activeTab === "news" && (
                <div className="flex flex-col">
                  <div className="flex gap-2 p-3 border-b border-white/[0.05]">
                    <button onClick={fetchNewsData} disabled={loadingNews}
                      className="flex-1 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-400 hover:bg-blue-500/20 transition disabled:opacity-40">
                      {loadingNews ? "⏳ Chargement..." : "🔄 Actualiser les news"}
                    </button>
                  </div>
                  {!newsData && !loadingNews && (
                    <div className="p-6 text-center">
                      <p className="text-gray-600 text-xs mb-3">Analyse les dernières actualités et le sentiment du marché pour {ticker.replace("-USD", "")}</p>
                      <button onClick={fetchNewsData} className="px-4 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-sm text-blue-400 hover:bg-blue-500/20 transition">
                        📰 Charger les actualités
                      </button>
                    </div>
                  )}
                  {loadingNews && (
                    <div className="p-4 space-y-2">
                      {[...Array(4)].map((_, i) => (
                        <div key={i} className="h-12 bg-white/5 rounded-lg animate-pulse" style={{ width: `${95 - i * 5}%` }} />
                      ))}
                    </div>
                  )}
                  {newsData && !loadingNews && (
                    <div className="p-3 space-y-3">
                      {/* Sentiment Banner */}
                      {newsData.sentiment && (() => {
                        const score = newsData.sentiment.sentiment_score ?? 0
                        const pct = ((score + 100) / 200 * 100).toFixed(0)
                        const color = score > 20 ? "#4ade80" : score < -20 ? "#f87171" : "#facc15"
                        const label = newsData.sentiment.overall_sentiment ?? "neutre"
                        return (
                          <div className="rounded-xl p-3 space-y-2" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">Sentiment général</span>
                              <span className="text-[10px] font-black px-2 py-0.5 rounded-full" style={{ background: `${color}18`, color }}>{label}</span>
                            </div>
                            <div className="relative h-2 rounded-full overflow-hidden bg-white/5">
                              <div className="absolute inset-y-0 left-0 rounded-full transition-all" style={{ width: `${pct}%`, background: `linear-gradient(to right, #f87171, #facc15, #4ade80)` }} />
                              <div className="absolute top-0 h-full w-0.5 bg-white/30" style={{ left: "50%" }} />
                            </div>
                            <div className="flex justify-between text-[9px] text-gray-600">
                              <span>Très négatif</span>
                              <span className="font-bold text-white">{score > 0 ? "+" : ""}{score}</span>
                              <span>Très positif</span>
                            </div>
                            {newsData.sentiment.summary && (
                              <p className="text-[11px] text-gray-400 leading-relaxed border-t border-white/5 pt-2">{newsData.sentiment.summary}</p>
                            )}
                            <div className="grid grid-cols-2 gap-2 pt-1">
                              <div>
                                <p className="text-[9px] text-gray-600 uppercase tracking-widest mb-1">Impact probable</p>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  newsData.sentiment.impact_on_price === "haussier" ? "bg-green-500/10 text-green-400" :
                                  newsData.sentiment.impact_on_price === "baissier" ? "bg-red-500/10 text-red-400" :
                                  "bg-yellow-500/10 text-yellow-400"
                                }`}>{newsData.sentiment.impact_on_price}</span>
                              </div>
                              <div>
                                <p className="text-[9px] text-gray-600 uppercase tracking-widest mb-1">Confiance</p>
                                <span className="text-[10px] font-bold text-white">{newsData.sentiment.confidence}%</span>
                              </div>
                            </div>
                            {newsData.sentiment.key_themes?.length > 0 && (
                              <div>
                                <p className="text-[9px] text-gray-600 uppercase tracking-widest mb-1.5">Thèmes clés</p>
                                <div className="flex flex-wrap gap-1">
                                  {newsData.sentiment.key_themes.map((t: string, i: number) => (
                                    <span key={i} className="text-[9px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/15">{t}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })()}

                      {/* Reddit Buzz Meter */}
                      {newsData.reddit && (() => {
                        const buzz = newsData.reddit
                        const sentColor = buzz.dominant_sentiment === "bullish" ? "#4ade80" : buzz.dominant_sentiment === "bearish" ? "#f87171" : "#9ca3af"
                        return (
                          <div className="rounded-xl p-3 space-y-2" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">Reddit Buzz</span>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${sentColor}18`, color: sentColor }}>
                                {buzz.dominant_sentiment === "bullish" ? "🐂 Bullish" : buzz.dominant_sentiment === "bearish" ? "🐻 Bearish" : "😐 Neutre"}
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="flex-1">
                                <div className="h-2 rounded-full overflow-hidden bg-white/5">
                                  <div className="h-full rounded-full" style={{ width: `${buzz.buzz_score}%`, background: sentColor }} />
                                </div>
                              </div>
                              <span className="text-lg font-black" style={{ color: sentColor }}>{buzz.buzz_score}</span>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-center">
                              <div>
                                <p className="text-sm font-black text-white">{buzz.mentions_24h}</p>
                                <p className="text-[9px] text-gray-600">Mentions 24h</p>
                              </div>
                              <div>
                                <p className="text-sm font-black text-white">{buzz.avg_score}</p>
                                <p className="text-[9px] text-gray-600">Score moyen</p>
                              </div>
                              <div>
                                <p className="text-sm font-black text-orange-400">{buzz.viral_posts?.length ?? 0}</p>
                                <p className="text-[9px] text-gray-600">Posts viraux</p>
                              </div>
                            </div>
                            {buzz.subreddits?.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {buzz.subreddits.map((sub: string, i: number) => (
                                  <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/15">{sub}</span>
                                ))}
                              </div>
                            )}
                            {buzz.viral_posts?.slice(0, 2).map((post: any, i: number) => (
                              <a key={i} href={post.url} target="_blank" rel="noopener noreferrer"
                                className="flex items-start gap-2 p-2 rounded-lg bg-white/[0.02] hover:bg-white/[0.05] transition border border-white/[0.04]">
                                <span className="text-orange-400 text-[10px] font-black mt-0.5">🔥</span>
                                <p className="text-[10px] text-gray-400 leading-tight flex-1 line-clamp-2">{post.title}</p>
                                <span className="text-[9px] text-orange-400 font-bold flex-shrink-0">↑{post.score}</span>
                              </a>
                            ))}
                          </div>
                        )
                      })()}

                      {/* News list */}
                      {newsData.articles.length > 0 && (
                        <div className="space-y-1.5">
                          <p className="text-[9px] text-gray-600 uppercase tracking-widest">Dernières actualités ({newsData.articles.length})</p>
                          {newsData.articles.map((article: any, i: number) => {
                            const ago = Math.round((Date.now() - new Date(article.published_at).getTime()) / 60000)
                            return (
                              <a key={i} href={article.url} target="_blank" rel="noopener noreferrer"
                                className="flex items-start gap-2.5 p-2.5 rounded-lg bg-white/[0.025] hover:bg-white/[0.05] transition border border-white/[0.05] group">
                                <div className="flex-1 min-w-0">
                                  <p className="text-[11px] text-gray-300 leading-tight group-hover:text-white transition line-clamp-2">{article.title}</p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className="text-[9px] text-gray-600">{article.source}</span>
                                    <span className="text-[9px] text-gray-700">·</span>
                                    <span className="text-[9px] text-gray-600">{ago < 60 ? `${ago}m` : ago < 1440 ? `${Math.round(ago/60)}h` : `${Math.round(ago/1440)}j`}</span>
                                    {article.reddit_score != null && (
                                      <>
                                        <span className="text-[9px] text-gray-700">·</span>
                                        <span className="text-[9px] text-orange-400">↑{article.reddit_score}</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                                <span className="text-gray-600 group-hover:text-white text-[10px] flex-shrink-0 mt-0.5">↗</span>
                              </a>
                            )
                          })}
                        </div>
                      )}
                      {newsData.articles.length === 0 && (
                        <p className="text-gray-700 text-xs text-center py-4">Aucune actualité récente trouvée pour {ticker.replace("-USD", "")}</p>
                      )}
                    </div>
                  )}
                </div>
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
                            <button onClick={isDemo ? () => setShowSignupModal(true) : openBuy} className="w-full py-2 rounded-lg bg-green-500 hover:bg-green-400 text-white text-xs font-bold transition">
                              Acheter {ticker.replace("-USD", "")}
                            </button>
                          )}
                          {prediction.recommendation === "VENDRE" && (
                            <button onClick={isDemo ? () => setShowSignupModal(true) : () => {
                              if (position && position.qty > 0) { setOrderModal("sell"); setOrderQty(String(position.qty)) }
                              else { setOrderModal("short"); setOrderQty("1") }
                            }}
                              className="w-full py-2 rounded-lg bg-red-500 hover:bg-red-400 text-white text-xs font-bold transition">
                              {position && position.qty > 0 ? `Vendre ${ticker.replace("-USD", "")}` : `Shorter ${ticker.replace("-USD", "")}`}
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

        {/* RIGHT — sticky sidebar with tabs */}
        <div className="w-full md:w-72 md:flex-shrink-0 border-t md:border-t-0 md:border-l border-white/[0.05] flex flex-col md:sticky md:top-14 md:self-start md:max-h-[calc(100vh-56px)]" style={{ background: "#0c0c0c" }}>

          {/* ── Header: cash + tab bar ── */}
          <div className="flex-shrink-0">
            {/* Cash */}
            <div className="px-4 pt-3 pb-2 border-b border-white/[0.05]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[9px] text-gray-600 uppercase tracking-widest">
                    {userProfile?.level === "débutant" ? "Capital virtuel" : "Cash"}
                  </p>
                  <p className="text-lg font-black text-white tabular-nums">
                    {account ? `$${account.cash.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
                  </p>
                </div>
                {activeData && (
                  <div className="text-right">
                    <p className={`text-xs font-black tabular-nums ${up ? "text-green-400" : "text-red-400"}`}>
                      ${activeData.price.toFixed(2)}
                    </p>
                    <p className={`text-[10px] font-semibold ${up ? "text-green-400" : "text-red-400"}`}>
                      {up ? "+" : ""}{activeData.change.toFixed(2)}%
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Tab bar */}
            <div className="flex border-b border-white/[0.05]">
              {([
                { key: "trade",  label: "Trade",  icon: "⚡" },
                { key: "calc",   label: "Calc",   icon: "🧮" },
                { key: "ordres", label: "Ordres", icon: "📋" },
              ] as const).map(t => (
                <button key={t.key} onClick={() => setRightTab(t.key)}
                  className={`flex-1 py-2 text-[11px] font-bold transition border-b-2 ${
                    rightTab === t.key
                      ? "text-white border-white"
                      : "text-gray-600 border-transparent hover:text-gray-400"
                  }`}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Scrollable tab content ── */}
          <div className="overflow-y-auto" style={{ maxHeight: "calc(100vh - 56px - 88px)" }}>

            {/* ── TAB: TRADE ── */}
            {rightTab === "trade" && (
              <div className="flex flex-col gap-0">
                {/* Position */}
                {position ? (
                  <div className="px-4 py-3 border-b border-white/[0.05]">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[9px] text-gray-600 uppercase tracking-widest">Position · {ticker.replace("-USD", "")}</p>
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
                    <p className="text-[9px] text-gray-700 uppercase tracking-widest">Aucune position sur {ticker.replace("-USD", "")}</p>
                  </div>
                )}

                {/* Buy / Sell */}
                <div data-tour="buy-btn" className="px-4 py-3 border-b border-white/[0.05] space-y-2">
                  <button onClick={isDemo ? () => setShowSignupModal(true) : openBuy}
                    className="w-full py-3 rounded-xl btn-primary text-sm tracking-wide">
                    Acheter {ticker.replace("-USD", "")}
                  </button>
                  <button
                    onClick={isDemo ? () => setShowSignupModal(true) : () => {
                      if (position && position.qty > 0) {
                        setOrderModal("sell"); setOrderQty(String(position.qty))
                      } else if (position && position.qty < 0) {
                        setOrderModal("buy"); setOrderQty(String(Math.abs(position.qty)))
                      } else {
                        setOrderModal("short"); setOrderQty("1")
                      }
                    }}
                    className="w-full py-2.5 rounded-xl text-sm font-bold transition bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 cursor-pointer">
                    {position && position.qty > 0
                      ? `Vendre ${position.qty} parts`
                      : position && position.qty < 0
                        ? `🔄 Racheter (Short ${Math.abs(position.qty)})`
                        : `📉 Shorter ${ticker.replace("-USD", "")}`}
                  </button>
                </div>

                {/* Price alerts */}
                <div data-tour="alerts">
                  <AlertsPanel symbol={ticker} currentPrice={activeData?.price} token={token} />
                </div>
              </div>
            )}

            {/* ── TAB: CALC ── */}
            {rightTab === "calc" && (
              <div className="flex flex-col gap-0">
                {/* Market stats */}
                {activeData && (
                  <div className="px-4 py-3 border-b border-white/[0.05]">
                    <p className="text-[9px] text-gray-600 uppercase tracking-widest mb-2">Marché · {ticker.replace("-USD", "")}</p>
                    <div className="space-y-1.5">
                      {[
                        { l: "Variation 24h", v: `${up ? "+" : ""}${activeData.change.toFixed(2)}%`, c: up ? "text-green-400" : "text-red-400" },
                        { l: "Haut du jour",  v: activeData.high ? `$${activeData.high.toFixed(2)}` : "—" },
                        { l: "Bas du jour",   v: activeData.low  ? `$${activeData.low.toFixed(2)}`  : "—" },
                        { l: "Clôture préc.", v: activeData.previousClose ? `$${activeData.previousClose.toFixed(2)}` : "—" },
                        { l: "Market Cap",    v: fmt(activeData.marketCap) },
                        { l: "Volume",        v: fmt(activeData.volume, "") },
                      ].map(k => (
                        <div key={k.l} className="flex justify-between items-center">
                          <span className="text-[10px] text-gray-600">{k.l}</span>
                          <span className={`text-[10px] font-semibold tabular-nums ${k.c ?? "text-gray-300"}`}>{k.v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {/* Position Calculator */}
                <div className="px-4 py-3">
                  <PositionCalculator
                    currentPrice={activeData?.price ?? 0}
                    symbol={ticker}
                    accountSize={account?.cash}
                    onApply={(qty, tp, sl) => {
                      setOrderQty(String(qty))
                      setOrderTp(String(tp))
                      setOrderSl(String(sl))
                      setRightTab("trade")
                      openBuy()
                    }}
                  />
                </div>
              </div>
            )}

            {/* ── TAB: ORDRES ── */}
            {rightTab === "ordres" && (
              <div className="flex flex-col gap-0">
                {/* Order history */}
                <div className="px-4 py-3 border-b border-white/[0.05]">
                  <p className="text-[9px] text-gray-600 uppercase tracking-widest mb-2">Mes ordres · {ticker.replace("-USD", "")}</p>
                  {orderHistory.length === 0 ? (
                    <p className="text-[10px] text-gray-700 py-2">Aucun ordre sur cet actif</p>
                  ) : (
                    <div className="space-y-1.5">
                      {[...orderHistory].reverse().slice(0, 10).map((o, i) => (
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
                  )}
                </div>

                {/* Performance alerts */}
                {perfAlerts.length > 0 && (
                  <div className="px-4 pt-3 pb-1 space-y-2 border-b border-white/[0.05]">
                    {perfAlerts.map((alert, i) => (
                      <div key={i} className={`px-3 py-2.5 rounded-xl border text-xs font-semibold ${
                        alert.startsWith("⚠️") ? "bg-orange-500/8 border-orange-500/20 text-orange-300" :
                        alert.startsWith("🔥") ? "bg-green-500/8 border-green-500/20 text-green-300" :
                        "bg-blue-500/8 border-blue-500/20 text-blue-300"
                      }`}>{alert}</div>
                    ))}
                  </div>
                )}

                {/* Analytics widget */}
                <div className="px-4 pt-3 pb-3">
                  <button onClick={() => setAnalyticsOpen(!analyticsOpen)}
                    className="w-full flex items-center justify-between px-3 py-2.5 bg-[#111] border border-white/5 rounded-xl hover:bg-white/3 transition">
                    <span className="text-white font-bold text-xs">📊 Analytics 30 jours</span>
                    <span className="text-gray-600 text-[10px]">{analyticsOpen ? "▲" : "▼"}</span>
                  </button>
                  {analyticsOpen && perfSnapshots.length === 0 && (
                    <div className="mt-1.5 bg-[#111] border border-white/5 rounded-xl p-4 text-center space-y-1">
                      <p className="text-2xl">📈</p>
                      <p className="text-white text-xs font-semibold">Pas encore de données</p>
                      <p className="text-gray-600 text-[10px]">Les stats apparaîtront après tes premiers trades.</p>
                    </div>
                  )}
                  {analyticsOpen && perfSnapshots.length > 0 && (() => {
                    const thisWeek = perfSnapshots.slice(-7)
                    const lastWeek = perfSnapshots.slice(-14, -7)
                    const weekPnl = thisWeek.reduce((s, d) => s + (d.daily_pnl ?? 0), 0)
                    const lastWeekPnl = lastWeek.reduce((s, d) => s + (d.daily_pnl ?? 0), 0)
                    let streak = 0
                    for (let i = perfSnapshots.length - 1; i >= 0; i--) {
                      if ((perfSnapshots[i].daily_pnl ?? 0) > 0) streak++
                      else break
                    }
                    return (
                      <div className="mt-1.5 bg-[#111] border border-white/5 rounded-xl p-3 space-y-3">
                        <div className="grid grid-cols-3 gap-2">
                          <div className="text-center">
                            <p className={`text-base font-black ${weekPnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                              {weekPnl >= 0 ? "+" : ""}${Math.abs(weekPnl).toFixed(0)}
                            </p>
                            <p className="text-gray-600 text-[9px]">Cette sem.</p>
                          </div>
                          <div className="text-center">
                            <p className={`text-base font-black ${weekPnl >= lastWeekPnl ? "text-green-400" : "text-red-400"}`}>
                              {weekPnl >= lastWeekPnl ? "▲" : "▼"}
                            </p>
                            <p className="text-gray-600 text-[9px]">vs S-1</p>
                          </div>
                          <div className="text-center">
                            <p className="text-base font-black text-orange-400">🔥 {streak}</p>
                            <p className="text-gray-600 text-[9px]">Jours prof.</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-0.5">
                          {perfSnapshots.map((s, i) => (
                            <div key={i} title={`${s.date}: ${(s.daily_pnl ?? 0) >= 0 ? "+" : ""}$${(s.daily_pnl ?? 0).toFixed(0)}`}
                              className={`w-4 h-4 rounded-sm ${(s.daily_pnl ?? 0) > 0 ? "bg-green-500/60" : (s.daily_pnl ?? 0) < 0 ? "bg-red-500/50" : "bg-white/5"}`} />
                          ))}
                        </div>
                        <a href="/reports" className="block text-center text-[10px] text-green-400 font-bold hover:text-green-300 transition">
                          Rapport complet →
                        </a>
                      </div>
                    )
                  })()}
                </div>

                {/* Weekly Challenges */}
                {challenges.length > 0 && (
                  <div className="px-4 pb-3 border-t border-white/[0.05] pt-3">
                    <h3 className="text-white font-bold text-xs mb-2">🎯 Défis de la semaine</h3>
                    <div className="space-y-2">
                      {challenges.map((c: any) => (
                        <div key={c.id} className={`rounded-xl p-2.5 border flex items-center gap-2 ${c.completed ? "bg-green-500/5 border-green-500/20" : "bg-[#111] border-white/5"}`}>
                          <span className="text-base flex-shrink-0">{c.completed ? "✅" : "🎯"}</span>
                          <div className="flex-1 min-w-0">
                            <p className={`text-[10px] font-bold ${c.completed ? "text-green-400" : "text-white"}`}>{c.title}</p>
                            <p className="text-gray-600 text-[9px] truncate">{c.description}</p>
                          </div>
                          <p className="text-[10px] font-black text-yellow-400 flex-shrink-0">+{c.reward_xp} XP</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>

          {/* Footer */}
          <div className="flex-shrink-0 px-4 py-2 border-t border-white/[0.05]">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
              <span className="text-[9px] text-gray-700">Yahoo Finance · Groq AI · Live</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Modal Ordre ───────────────────────────────────────────────────── */}
      {orderModal && (() => {
        const mktStatus = getMarketStatus(ticker)
        const isPending = !mktStatus.isOpen
        return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 px-0 sm:px-4">
          <div className="bg-[#111] border border-white/10 rounded-t-2xl sm:rounded-2xl p-5 w-full max-w-[95vw] sm:max-w-sm shadow-2xl mx-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isPending ? "bg-yellow-500/20" : orderModal === "buy" ? "bg-green-500/20" : "bg-red-500/20"}`}>
                  <span className={`text-sm font-black ${isPending ? "text-yellow-400" : orderModal === "buy" ? "text-green-400" : "text-red-400"}`}>
                    {isPending ? "⏳" : orderModal === "buy" ? "B" : orderModal === "short" ? "↓" : "S"}
                  </span>
                </div>
                <div>
                  <p className="text-base font-black">
                    {orderModal === "buy" ? "Acheter" : orderModal === "short" ? "Shorter" : "Vendre"} {ticker.replace("-USD", "")}
                  </p>
                  {orderModal === "short" && (
                    <p className="text-[10px] text-orange-400/70 mt-0.5">📉 Vente à découvert — position négative</p>
                  )}
                  <p className="text-[10px] text-gray-500">
                    {activeData?.name} · {isPending ? "Ordre différé" : "Marché au prix actuel"}
                  </p>
                </div>
              </div>
              <button onClick={() => { setOrderModal(null); setOrderMsg("") }} className="text-gray-600 hover:text-white transition text-lg leading-none">×</button>
            </div>

            {/* Banner marché fermé */}
            {isPending && (
              <div className="mb-4 p-3 rounded-xl flex items-start gap-3"
                style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}>
                <span className="text-lg flex-shrink-0">🕐</span>
                <div>
                  <p className="text-xs font-bold text-yellow-400 mb-0.5">Marché fermé — Ordre différé</p>
                  <p className="text-[11px] text-white/40 leading-relaxed">
                    {mktStatus.message}. Ton ordre sera placé automatiquement à la prochaine ouverture au prix du marché.
                  </p>
                  {mktStatus.nextOpen && (
                    <p className="text-[10px] text-yellow-400/60 mt-1">
                      Exécution prévue : {mktStatus.nextOpen.toLocaleDateString("fr-FR", { weekday: "long", hour: "2-digit", minute: "2-digit" })} ET
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Prix + cash */}
            <div className="bg-white/[0.03] border border-white/5 rounded-xl p-3 mb-4 flex justify-between items-center">
              <div>
                <p className="text-[9px] text-gray-600 uppercase tracking-widest">
                  {isPending ? "Dernier prix connu" : "Prix actuel"}
                </p>
                <p className="text-lg font-black text-white">${activeData?.price.toFixed(2)}</p>
                {isPending && (
                  <p className="text-[10px] text-yellow-400/60 mt-0.5">⚠️ Prix d'exécution peut différer</p>
                )}
              </div>
              <div className="text-right">
                <p className="text-[9px] text-gray-600 uppercase tracking-widest">Type</p>
                <span className="text-xs font-bold px-2 py-1 rounded-lg"
                  style={{
                    background: isPending ? "rgba(245,158,11,0.12)" : "rgba(34,197,94,0.12)",
                    color: isPending ? "#fbbf24" : "#4ade80",
                    border: `1px solid ${isPending ? "rgba(245,158,11,0.2)" : "rgba(34,197,94,0.2)"}`,
                  }}>
                  {isPending ? "⏳ Différé" : "⚡ Marché"}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              {/* Mode toggle: Quantité vs Capital */}
              <div className="flex rounded-lg overflow-hidden border border-white/10">
                <button onClick={() => setOrderMode("qty")}
                  className={`flex-1 py-1.5 text-xs font-bold transition ${orderMode === "qty" ? "bg-white/10 text-white" : "text-gray-600 hover:text-gray-400"}`}>
                  Quantité
                </button>
                <button onClick={() => setOrderMode("capital")}
                  className={`flex-1 py-1.5 text-xs font-bold transition ${orderMode === "capital" ? "bg-white/10 text-white" : "text-gray-600 hover:text-gray-400"}`}>
                  Capital ($)
                </button>
              </div>

              {/* Quantité / Capital */}
              <div>
                {orderMode === "qty" ? (
                  <>
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
                  </>
                ) : (
                  <>
                    <label className="text-[10px] text-gray-500 uppercase tracking-widest mb-1.5 block">Montant ($)</label>
                    <div className="flex gap-1.5">
                      <input type="number" value={orderCapital} onChange={(e) => {
                        setOrderCapital(e.target.value)
                        const price = activeData?.price ?? 0
                        if (price > 0 && e.target.value) {
                          setOrderQty((parseFloat(e.target.value) / price).toFixed(4))
                        }
                      }}
                        min="1" step="1" placeholder="ex: 500"
                        className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/20" />
                      {["100", "250", "500", "1000"].map(c => (
                        <button key={c} onClick={() => {
                          setOrderCapital(c)
                          const price = activeData?.price ?? 0
                          if (price > 0) setOrderQty((parseFloat(c) / price).toFixed(4))
                        }}
                          className={`px-2 py-2 rounded-lg text-xs font-bold border transition ${
                            orderCapital === c ? "bg-white/10 text-white border-white/20" : "bg-white/[0.03] text-gray-500 border-white/8 hover:text-white"
                          }`}>${c}</button>
                      ))}
                    </div>
                  </>
                )}
                <div className="flex justify-between mt-1.5 px-0.5">
                  <span className="text-[10px] text-gray-600">
                    {orderMode === "capital" ? `≈ ${parseFloat(orderQty || "0").toFixed(4)} unités` : "Total estimé"}
                  </span>
                  <span className="text-[10px] font-bold text-white">${((activeData?.price ?? 0) * parseFloat(orderQty || "0")).toFixed(2)}</span>
                </div>
              </div>

              {/* TP/SL pour les achats et les shorts */}
              {(orderModal === "buy" || orderModal === "short") && (
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
                  className="flex-1 py-2.5 rounded-xl text-sm font-black transition disabled:opacity-50 flex items-center justify-center gap-2 text-white"
                  style={{
                    background: orderLoading ? undefined : isPending
                      ? "linear-gradient(135deg, #d97706, #b45309)"
                      : orderModal === "buy"
                        ? "linear-gradient(135deg, #22c55e, #16a34a)"
                        : orderModal === "short"
                          ? "linear-gradient(135deg, #f97316, #ea580c)"
                          : "linear-gradient(135deg, #ef4444, #dc2626)",
                  }}>
                  {orderLoading && (
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  )}
                  {orderLoading ? "En cours..." : isPending
                    ? `⏳ Planifier ${orderModal === "buy" ? "l'achat" : orderModal === "short" ? "le short" : "la vente"}`
                    : orderModal === "buy" ? "🟢 Confirmer l'achat" : orderModal === "short" ? "📉 Confirmer le short" : "🔴 Confirmer la vente"
                  }
                </button>
              </div>
              {isPending && !orderLoading && (
                <p className="text-[10px] text-white/20 text-center mt-2">
                  Tu peux annuler depuis ton portfolio avant l&apos;ouverture
                </p>
              )}
            </div>
          </div>
        </div>
        )
      })()}

      {/* ── Modal TP/SL ───────────────────────────────────────────────────── */}
      {tpSlModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 px-0 sm:px-4">
          <div className="bg-[#111] border border-white/10 rounded-t-2xl sm:rounded-2xl p-5 w-full max-w-[95vw] sm:max-w-sm shadow-2xl mx-auto">
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
              <button onClick={saveTpSl} className="flex-1 py-2.5 rounded-xl bg-white text-black text-sm font-black hover:bg-gray-100 transition flex items-center justify-center gap-2">Sauvegarder</button>
            </div>
          </div>
        </div>
      )}

      {showTour && (
        <Tour
          steps={DASHBOARD_TOUR_STEPS}
          storageKey="tour_dashboard_v2"
          onComplete={() => setShowTour(false)}
        />
      )}

      {/* ── Mobile buy/sell floating buttons ─────────────────────────────── */}
      <div className="md:hidden fixed bottom-20 inset-x-0 px-4 flex gap-2 z-30">
        <button
          onClick={() => { setOrderSide("buy"); setShowMobileOrder(true); import("@/lib/capacitor").then(m => m.haptic("light")) }}
          className="flex-1 py-3.5 rounded-2xl text-sm font-black text-black"
          style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)", boxShadow: "0 4px 20px rgba(34,197,94,0.3)" }}>
          🟢 Acheter
        </button>
        <button
          onClick={() => { setOrderSide("sell"); setShowMobileOrder(true); import("@/lib/capacitor").then(m => m.haptic("light")) }}
          className="flex-1 py-3.5 rounded-2xl text-sm font-black text-white"
          style={{ background: "linear-gradient(135deg, #ef4444, #dc2626)", boxShadow: "0 4px 20px rgba(239,68,68,0.3)" }}>
          🔴 Vendre
        </button>
      </div>

      {/* ── Mobile bottom sheet ───────────────────────────────────────────── */}
      {showMobileOrder && (
        <div className="md:hidden fixed inset-0 bg-black/60 z-40" onClick={() => setShowMobileOrder(false)} />
      )}
      <div className={`md:hidden fixed inset-x-0 bottom-0 z-50 transition-transform duration-300 ${
        showMobileOrder ? "translate-y-0 pointer-events-auto" : "translate-y-full pointer-events-none"
      }`}
        style={{
          background: "#0d0d0d",
          borderTop: "1px solid rgba(255,255,255,0.10)",
          borderRadius: "20px 20px 0 0",
          maxHeight: "85vh",
          overflow: "auto",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}>
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-white/15" />
        </div>
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-base font-black text-white">{orderSide === "buy" ? "🟢 Acheter" : "🔴 Vendre"} {ticker.replace("-USD", "")}</p>
            <button onClick={() => setShowMobileOrder(false)} className="text-white/30 hover:text-white transition text-xl">×</button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setOrderSide("buy")}
              className={`py-2.5 rounded-xl text-sm font-black transition-all ${orderSide === "buy" ? "bg-green-500 text-black" : "bg-white/5 text-white/40"}`}>
              🟢 Acheter
            </button>
            <button onClick={() => setOrderSide("sell")}
              className={`py-2.5 rounded-xl text-sm font-black transition-all ${orderSide === "sell" ? "bg-red-500 text-white" : "bg-white/5 text-white/40"}`}>
              🔴 Vendre
            </button>
          </div>
          <MarketStatusBar symbol={ticker} showDetail />
          <div>
            <label className="text-[10px] text-white/30 uppercase tracking-widest mb-2 block">Quantité</label>
            <div className="flex gap-1.5">
              <input type="number" value={orderQty} onChange={e => setOrderQty(e.target.value)} min="0.001" step="0.001"
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm font-bold focus:outline-none focus:border-white/20" />
              {["0.5", "1", "5", "10"].map(q => (
                <button key={q} onClick={() => setOrderQty(q)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold border transition ${
                    orderQty === q ? "bg-white/10 text-white border-white/20" : "bg-white/[0.03] text-white/40 border-white/8"
                  }`}>{q}</button>
              ))}
            </div>
            <div className="flex justify-between mt-1.5 px-0.5">
              <span className="text-[10px] text-white/30">Total estimé</span>
              <span className="text-[10px] font-bold text-white">${((activeData?.price ?? 0) * parseFloat(orderQty || "0")).toFixed(2)}</span>
            </div>
          </div>
          <button
            onClick={() => { setShowMobileOrder(false); setTimeout(() => setOrderModal(orderSide), 100) }}
            className="w-full py-3.5 rounded-2xl text-sm font-black"
            style={{
              background: orderSide === "buy" ? "linear-gradient(135deg, #22c55e, #16a34a)" : "linear-gradient(135deg, #ef4444, #dc2626)",
              color: orderSide === "buy" ? "black" : "white",
            }}>
            Confirmer
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  return (
    <Suspense fallback={null}>
      <DashboardContent />
    </Suspense>
  )
}