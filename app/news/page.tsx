"use client"

import { useState, useEffect, useCallback } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Search, RefreshCw, Star, X } from "lucide-react"

// ─── Design tokens ─────────────────────────────────────────────────────────────
const D = {
  bg:        "#050505",
  card:      "#0a0a0a",
  cardHover: "#0f0f0f",
  border:    "rgba(255,255,255,0.06)",
  borderHover:"rgba(255,255,255,0.12)",
  green:     "#22c55e",
  red:       "#ef4444",
  yellow:    "#f59e0b",
  blue:      "#3b82f6",
  purple:    "#8b5cf6",
} as const

// ─── Types ─────────────────────────────────────────────────────────────────────
type Article = {
  title: string
  source: string
  url: string
  published_at: string
  reddit_score?: number
  reddit_comments?: number
  tickers?: string[]
  ai_summary?: string
  breaking?: boolean
  sentiment_score?: number
  category?: "crypto" | "macro" | "earnings" | "reddit" | "general"
}

type PriceData  = { price: number; change: number }
type BuzzItem   = { symbol: string; buzz_score: number; dominant_sentiment: string; mentions_24h: number }
type EconEvent  = {
  name: string; date: string; time: string; impact: string
  country: string; flag: string; assets_affected: string[]
}
type TrendTopic = { topic: string; count: number; sentiment: string; emoji: string; tickers: string[] }
type FearGreed  = { score: number; label: string; color: string; change: number }

// ─── Constants ─────────────────────────────────────────────────────────────────
const WATCHLIST_SYMS = ["AAPL","NVDA","TSLA","MSFT","META","GOOGL","AMZN","BTC-USD","ETH-USD","SPY","QQQ","JPM"]
const TAPE_SYMS      = ["AAPL","NVDA","TSLA","MSFT","META","GOOGL","AMZN","BTC-USD","ETH-USD","SPY","QQQ","GLD","NFLX","AMD","COIN"]
const PULSE_SYMS     = ["SPY","QQQ","GLD","BTC-USD","%5EVIX"]

const CATEGORIES = [
  { key: "all",      label: "Tout",          icon: "🌐" },
  { key: "macro",    label: "Macro & Fed",   icon: "🏦" },
  { key: "crypto",   label: "Crypto",        icon: "₿"  },
  { key: "earnings", label: "Earnings",      icon: "📊" },
  { key: "tech",     label: "Technologie",   icon: "💻" },
  { key: "energy",   label: "Énergie",       icon: "⚡" },
]

const CAT_SECTIONS = [
  { key: "macro",    title: "🏦 Macro & Banques Centrales", kw: ["fed","federal reserve","rate","inflation","cpi","gdp","ecb","powell","treasury","yields","recession"] },
  { key: "crypto",   title: "₿ Crypto & Digital Assets",  kw: ["bitcoin","ethereum","crypto","blockchain","btc","eth","solana","binance","coinbase"] },
  { key: "tech",     title: "💻 Technologie & IA",         kw: ["ai","artificial intelligence","nvidia","openai","apple","microsoft","google","semiconductor","chip"] },
  { key: "earnings", title: "📊 Résultats & Earnings",     kw: ["earnings","eps","revenue","quarter","profit","revenue","results"] },
  { key: "energy",   title: "⚡ Énergie & Matières premières", kw: ["oil","energy","gold","commodities","opec","crude","natural gas","copper"] },
]

// ─── Helpers ───────────────────────────────────────────────────────────────────
function timeAgo(iso: string): string {
  const ago = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (ago < 1)    return "à l'instant"
  if (ago < 60)   return `${ago}m`
  if (ago < 1440) return `${Math.round(ago / 60)}h`
  return `${Math.round(ago / 1440)}j`
}

function matchCategory(article: Article, catKey: string): boolean {
  const lc = article.title.toLowerCase()
  const sect = CAT_SECTIONS.find(c => c.key === catKey)
  if (!sect) return true
  return sect.kw.some(kw => lc.includes(kw)) || article.category === catKey
}

// ─── Fear & Greed mini gauge SVG ───────────────────────────────────────────────
// Centre (100,100), rayon 80, arc de 180° à 0° passant par le haut
function arcSeg(i: number): string {
  const angles = [180, 144, 108, 72, 36, 0]
  function pt(deg: number) {
    return { x: +(100 + 80 * Math.cos(deg * Math.PI / 180)).toFixed(1),
             y: +(100 - 80 * Math.sin(deg * Math.PI / 180)).toFixed(1) }
  }
  const s = pt(angles[i]), e = pt(angles[i + 1])
  return `M ${s.x} ${s.y} A 80 80 0 0 0 ${e.x} ${e.y}`
}

function FearGreedGaugeMini({ data }: { data: FearGreed | null }) {
  if (!data) return (
    <div className="h-28 rounded-2xl animate-pulse" style={{ background: D.card }} />
  )
  const { score, label, color, change } = data
  // Needle: angle in degrees where 0°→left(score=0), 90°→up(score=50), 180°→right(score=100)
  const deg = (score / 100) * 180 - 90  // -90° to +90°
  const nx  = +(100 + 60 * Math.cos((deg - 90) * Math.PI / 180)).toFixed(1)
  const ny  = +(100 + 60 * Math.sin((deg - 90) * Math.PI / 180)).toFixed(1)

  return (
    <div>
      <svg viewBox="0 0 200 115" className="w-full" style={{ maxHeight: 110 }}>
        {/* Background arc */}
        <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="16" strokeLinecap="round" />
        {/* Colored segments */}
        {[D.red,"#f97316",D.yellow,"#84cc16",D.green].map((c, i) => (
          <path key={i} d={arcSeg(i)} fill="none" stroke={c} strokeWidth="14" strokeLinecap="butt" opacity="0.75" />
        ))}
        {/* Needle */}
        <line x1="100" y1="100" x2={nx} y2={ny} stroke="white" strokeWidth="2.5" strokeLinecap="round"
          style={{ transition: "all 0.8s cubic-bezier(0.34,1.56,0.64,1)" }} />
        <circle cx="100" cy="100" r="5" fill="white" />
        {/* Score */}
        <text x="100" y="92" textAnchor="middle" fill="white" fontSize="20" fontWeight="900"
          fontFamily="system-ui, sans-serif">{score}</text>
      </svg>
      <div className="flex justify-between items-center mt-1 px-2">
        <span className="text-[9px] text-white/20">Peur</span>
        <span className="text-xs font-black" style={{ color }}>{label}</span>
        <span className="text-[9px] text-white/20">Cupidité</span>
      </div>
      <div className="mt-1.5 text-center">
        <span className={`text-[10px] font-bold ${change >= 0 ? "text-green-400" : "text-red-400"}`}>
          {change >= 0 ? "▲" : "▼"} {Math.abs(change).toFixed(0)} pts vs hier
        </span>
      </div>
    </div>
  )
}

// ─── NewsCard ──────────────────────────────────────────────────────────────────
function NewsCard({ article, onTickerClick }: {
  article: Article
  onTickerClick: (sym: string) => void
}) {
  const score = article.sentiment_score ?? 0
  const sentColor = score > 20 ? D.green : score < -20 ? D.red : D.yellow
  const isReddit = article.source?.toLowerCase().includes("reddit")
  const sourceBg = isReddit ? "rgba(249,115,22,0.12)" : "rgba(59,130,246,0.1)"
  const sourceColor = isReddit ? "#fb923c" : "#60a5fa"

  return (
    <a href={article.url} target="_blank" rel="noopener noreferrer"
      className="group block rounded-2xl overflow-hidden transition-all duration-200"
      style={{ background: D.card, border: `1px solid ${D.border}` }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = D.borderHover; (e.currentTarget as HTMLElement).style.background = D.cardHover }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = D.border;      (e.currentTarget as HTMLElement).style.background = D.card }}>
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center gap-2 mb-2.5">
          <span className="text-[9px] font-bold px-2 py-0.5 rounded-md truncate max-w-[120px]"
            style={{ background: sourceBg, color: sourceColor }}>
            {article.source}
          </span>
          <span className="text-[9px] text-white/25 flex-shrink-0">{timeAgo(article.published_at)}</span>
          {article.breaking && (
            <span className="ml-auto text-[9px] font-black px-1.5 py-0.5 rounded-full animate-pulse flex-shrink-0"
              style={{ background: "rgba(239,68,68,0.2)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)" }}>
              🔴 BREAKING
            </span>
          )}
        </div>

        {/* Title */}
        <p className="text-sm font-semibold text-white/75 group-hover:text-white transition-colors leading-snug mb-3 line-clamp-2">
          {article.title}
        </p>

        {/* Tickers */}
        {(article.tickers?.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {article.tickers!.slice(0, 4).map(t => (
              <button key={t} onClick={e => { e.preventDefault(); onTickerClick(t) }}
                className="text-[9px] font-bold px-2 py-0.5 rounded-lg transition-all"
                style={{ background: "rgba(34,197,94,0.08)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.15)" }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(34,197,94,0.18)")}
                onMouseLeave={e => (e.currentTarget.style.background = "rgba(34,197,94,0.08)")}>
                ${t.replace("-USD","")}
              </button>
            ))}
          </div>
        )}

        {/* Sentiment bar */}
        {score !== 0 && (
          <div className="flex items-center gap-2 mb-2.5">
            <div className="flex-1 h-0.5 rounded-full bg-white/5 overflow-hidden">
              <div className="h-full rounded-full"
                style={{
                  width: `${((score + 100) / 200) * 100}%`,
                  background: sentColor,
                  transition: "width 0.5s ease"
                }} />
            </div>
            <span className="text-[9px] font-semibold flex-shrink-0" style={{ color: sentColor }}>
              {score > 20 ? "🟢 Positif" : score < -20 ? "🔴 Négatif" : "🟡 Neutre"}
            </span>
          </div>
        )}

        {/* AI summary */}
        {article.ai_summary && (
          <p className="text-[10px] leading-relaxed italic border-t pt-2.5"
            style={{ color: "rgba(255,255,255,0.28)", borderColor: "rgba(255,255,255,0.05)" }}>
            🤖 {article.ai_summary}
          </p>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 flex items-center justify-between"
        style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
        <div className="flex items-center gap-3">
          {article.reddit_score != null && article.reddit_score > 0 && (
            <span className="text-[9px] text-orange-400 font-semibold">↑ {article.reddit_score}</span>
          )}
          {article.reddit_comments != null && article.reddit_comments > 0 && (
            <span className="text-[9px] text-white/20">💬 {article.reddit_comments}</span>
          )}
        </div>
        <span className="text-[9px] text-white/20 group-hover:text-white/40 transition">Lire ↗</span>
      </div>
    </a>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function NewsPage() {
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [search, setSearch] = useState("")
  const [articles, setArticles] = useState<Article[]>([])
  const [generalArticles, setGeneralArticles] = useState<Article[]>([])
  const [prices, setPrices] = useState<Record<string, PriceData>>({})
  const [tapePrices, setTapePrices] = useState<{ symbol: string; price: number; change: number }[]>([])
  const [fearGreed, setFearGreed] = useState<FearGreed | null>(null)
  const [econEvents, setEconEvents] = useState<EconEvent[]>([])
  const [trending, setTrending] = useState<TrendTopic[]>([])
  const [socialBuzz, setSocialBuzz] = useState<BuzzItem[]>([])
  const [watchlist, setWatchlist] = useState<string[]>([])
  const [loadingArticles, setLoadingArticles] = useState(false)
  const [loadingGeneral, setLoadingGeneral] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [articleCountBySym, setArticleCountBySym] = useState<Record<string, number>>({})
  const [briefingOpen, setBriefingOpen] = useState(true)
  const [briefingText, setBriefingText] = useState("")

  // Load watchlist
  useEffect(() => {
    try {
      const s = localStorage.getItem("news_watchlist")
      if (s) setWatchlist(JSON.parse(s))
    } catch {}
  }, [])

  // Load fear-greed
  useEffect(() => {
    fetch("/api/news/fear-greed").then(r => r.ok ? r.json() : null).then(d => {
      if (d) setFearGreed({ score: d.score, label: d.label, color: d.color, change: d.change ?? 0 })
    }).catch(() => {})
  }, [])

  // Load economic calendar
  useEffect(() => {
    fetch("/api/news/economic-calendar").then(r => r.ok ? r.json() : null).then(d => {
      if (d?.events) setEconEvents(d.events)
    }).catch(() => {})
  }, [])

  // Load trending topics
  useEffect(() => {
    fetch("/api/news/trending").then(r => r.ok ? r.json() : null).then(d => {
      if (d?.topics) setTrending(d.topics)
    }).catch(() => {})
  }, [])

  // Load social buzz for top symbols
  useEffect(() => {
    Promise.allSettled(
      WATCHLIST_SYMS.map(sym =>
        fetch(`/api/news/reddit-buzz?symbol=${sym}`)
          .then(r => r.ok ? r.json() : null)
          .then(d => d ? { symbol: sym, buzz_score: d.buzz_score ?? 0, dominant_sentiment: d.dominant_sentiment ?? "neutral", mentions_24h: d.mentions_24h ?? 0 } : null)
      )
    ).then(results => {
      const items: BuzzItem[] = []
      for (const r of results) {
        if (r.status === "fulfilled" && r.value) items.push(r.value)
      }
      setSocialBuzz(items.sort((a, b) => b.buzz_score - a.buzz_score))
    })
  }, [])

  // Ticker tape prices
  const fetchTape = useCallback(async () => {
    const results = await Promise.allSettled(
      TAPE_SYMS.map(sym =>
        fetch(`/api/price?symbol=${sym}`)
          .then(r => r.ok ? r.json() : null)
          .then(d => d ? { symbol: sym, price: d.price as number, change: d.change as number } : null)
      )
    )
    const items: { symbol: string; price: number; change: number }[] = []
    for (const r of results) {
      if (r.status === "fulfilled" && r.value) items.push(r.value)
    }
    setTapePrices(items)
  }, [])

  useEffect(() => {
    fetchTape()
    const id = setInterval(fetchTape, 30_000)
    return () => clearInterval(id)
  }, [fetchTape])

  // Market pulse prices
  const fetchPulse = useCallback(async () => {
    const results = await Promise.allSettled(
      PULSE_SYMS.map(sym =>
        fetch(`/api/price?symbol=${sym}`)
          .then(r => r.ok ? r.json() : null)
          .then(d => d ? [sym, { price: d.price as number, change: d.change as number }] as const : null)
      )
    )
    const map: Record<string, PriceData> = {}
    for (const r of results) {
      if (r.status === "fulfilled" && r.value) {
        const [sym, data] = r.value
        map[sym] = data
      }
    }
    setPrices(map)
  }, [])

  useEffect(() => {
    fetchPulse()
    const id = setInterval(fetchPulse, 30_000)
    return () => clearInterval(id)
  }, [fetchPulse])

  // Load general news on mount
  const fetchGeneral = useCallback(async () => {
    setLoadingGeneral(true)
    try {
      const res = await fetch("/api/news?symbol=general&limit=50")
      const data = res.ok ? await res.json() : null
      if (data?.articles) {
        setGeneralArticles(data.articles)
        setLastUpdate(new Date())
      }
    } catch {}
    setLoadingGeneral(false)
  }, [])

  useEffect(() => {
    fetchGeneral()
    const id = setInterval(fetchGeneral, 300_000) // 5 min auto-refresh
    return () => clearInterval(id)
  }, [fetchGeneral])

  // Load articles when ticker selected
  const fetchArticles = useCallback(async (sym: string) => {
    setLoadingArticles(true)
    setArticles([])
    try {
      const res = await fetch(`/api/news?symbol=${sym}&limit=30`)
      const data = res.ok ? await res.json() : null
      if (data?.articles) {
        setArticles(data.articles)
        setLastUpdate(new Date())
      }
    } catch {}
    setLoadingArticles(false)
  }, [])

  useEffect(() => {
    if (selectedTicker) fetchArticles(selectedTicker)
  }, [selectedTicker, fetchArticles])

  // Count articles by ticker
  useEffect(() => {
    const counts: Record<string, number> = {}
    const all = [...generalArticles, ...articles]
    all.forEach(a => a.tickers?.forEach(t => { counts[t] = (counts[t] ?? 0) + 1 }))
    setArticleCountBySym(counts)
  }, [generalArticles, articles])

  // Load briefing
  useEffect(() => {
    fetch("/api/news/briefing").then(r => r.ok ? r.json() : null).then(d => {
      if (d?.trade_idea) {
        setBriefingText(`💡 ${d.trade_idea}`)
      } else if (d?.bullets?.[0]) {
        setBriefingText(d.bullets[0])
      }
    }).catch(() => {})
  }, [])

  function toggleWatchlist(sym: string) {
    setWatchlist(prev => {
      const next = prev.includes(sym) ? prev.filter(s => s !== sym) : [...prev, sym]
      try { localStorage.setItem("news_watchlist", JSON.stringify(next)) } catch {}
      return next
    })
  }

  function selectTicker(sym: string) {
    setSelectedTicker(prev => prev === sym ? null : sym)
    setSelectedCategory("all")
    setSearch("")
  }

  // Derive active articles
  const activeArticles = selectedTicker ? articles : generalArticles

  // Filter by search
  const searchFiltered = search
    ? activeArticles.filter(a => a.title.toLowerCase().includes(search.toLowerCase()))
    : activeArticles

  // Filter by category (only when no ticker selected)
  const catFiltered = selectedTicker || selectedCategory === "all"
    ? searchFiltered
    : searchFiltered.filter(a => matchCategory(a, selectedCategory))

  // For general news: group by category sections
  const sectionArticles = (catKey: string): Article[] => {
    if (catKey === "all") return generalArticles.slice(0, 10)
    return generalArticles.filter(a => matchCategory(a, catKey)).slice(0, 6)
  }

  const totalArticles = catFiltered.length
  const isGeneral = !selectedTicker && !search

  const pulseItems = [
    { label: "SPY",  key: "SPY",    sym: "SPY" },
    { label: "QQQ",  key: "QQQ",    sym: "QQQ" },
    { label: "VIX",  key: "%5EVIX", sym: "%5EVIX" },
    { label: "Or",   key: "GLD",    sym: "GLD" },
    { label: "BTC",  key: "BTC-USD",sym: "BTC-USD" },
  ]

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: D.bg }}>

      {/* ── TICKER TAPE ───────────────────────────────────────────────────── */}
      {tapePrices.length > 0 && (
        <div className="ticker-wrap overflow-hidden" style={{ background: "#080808", borderBottom: "1px solid #111", height: 36 }}>
          <div className="ticker-animate items-center gap-8 h-full whitespace-nowrap">
            {[...tapePrices, ...tapePrices].map((t, i) => (
              <span key={i} className="inline-flex items-center gap-2 text-[11px]">
                <span className="font-bold text-white/50 font-mono">{t.symbol.replace("-USD","")}</span>
                <span className="font-black text-white tabular-nums">
                  {t.price >= 1000
                    ? `$${t.price.toLocaleString("en-US",{minimumFractionDigits:0,maximumFractionDigits:0})}`
                    : `$${t.price.toFixed(2)}`
                  }
                </span>
                <span className="font-bold tabular-nums" style={{ color: t.change > 0 ? D.green : t.change < 0 ? D.red : "#666" }}>
                  {t.change > 0 ? "▲" : t.change < 0 ? "▼" : ""}
                  {Math.abs(t.change).toFixed(2)}%
                </span>
                <span style={{ color: "rgba(255,255,255,0.08)" }}>·</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── HEADER ──────────────────────────────────────────────────────────── */}
      <div className="px-5 py-3.5 flex items-center gap-4 flex-wrap" style={{ background: "#080808", borderBottom: "1px solid #111" }}>
        {/* Title */}
        <div className="flex-shrink-0">
          <h1 className="text-lg font-black text-white tracking-tight leading-none">Actualités</h1>
          <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.2)" }}>
            {totalArticles} articles · {timeAgo(lastUpdate.toISOString())}
          </p>
        </div>

        {/* Search bar */}
        <div className="flex-1 min-w-[200px] max-w-lg relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "rgba(255,255,255,0.2)" }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher une news, un actif, un thème…"
            className="w-full h-9 pl-9 pr-8 rounded-xl text-xs text-white outline-none transition-all"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "white" }}
            onFocus={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)")}
            onBlur={e =>  (e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)")}
          />
          {search && (
            <button onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 transition"
              style={{ color: "rgba(255,255,255,0.3)" }}
              onMouseEnter={e => (e.currentTarget.style.color = "white")}
              onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.3)")}>
              <X size={13} />
            </button>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={() => selectedTicker ? fetchArticles(selectedTicker) : fetchGeneral()}
            disabled={loadingArticles || loadingGeneral}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold transition-all disabled:opacity-40"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)" }}
            onMouseEnter={e => (e.currentTarget.style.color = "white")}
            onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.5)")}>
            <RefreshCw size={11} className={(loadingArticles || loadingGeneral) ? "animate-spin" : ""} />
            Actualiser
          </button>
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg"
            style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.15)" }}>
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
            <span className="text-[10px] font-black text-green-400">LIVE</span>
          </div>
        </div>
      </div>

      {/* ── BODY 3-COLUMN ────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── LEFT SIDEBAR ─────────────────────────────────────────────────── */}
        <aside className="w-[260px] flex-shrink-0 flex-col overflow-y-auto hidden lg:flex"
          style={{ background: "#070707", borderRight: "1px solid #111" }}>

          {/* Mes actifs */}
          <div className="p-4" style={{ borderBottom: "1px solid #111" }}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.2)" }}>Mes actifs</p>
              {selectedTicker && (
                <button onClick={() => setSelectedTicker(null)}
                  className="text-[9px] font-bold transition"
                  style={{ color: "rgba(255,255,255,0.3)" }}
                  onMouseEnter={e => (e.currentTarget.style.color = "white")}
                  onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.3)")}>
                  ✕ Tout afficher
                </button>
              )}
            </div>

            {/* "Tout" button */}
            <button
              onClick={() => setSelectedTicker(null)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all mb-1.5"
              style={{
                background: !selectedTicker ? "rgba(255,255,255,0.06)" : "transparent",
                border: `1px solid ${!selectedTicker ? "rgba(255,255,255,0.1)" : "transparent"}`,
                color: !selectedTicker ? "white" : "rgba(255,255,255,0.3)",
              }}>
              <span>📰</span>
              <span>Toutes les actualités</span>
              {generalArticles.length > 0 && (
                <span className="ml-auto text-[9px]" style={{ color: "rgba(255,255,255,0.2)" }}>{generalArticles.length}</span>
              )}
            </button>

            {/* Symbol buttons */}
            <div className="space-y-0.5">
              {WATCHLIST_SYMS.map(sym => {
                const isActive = selectedTicker === sym
                const inWl = watchlist.includes(sym)
                const count = articleCountBySym[sym] ?? 0
                const buzz = socialBuzz.find(b => b.symbol === sym)
                const sentiment = buzz?.dominant_sentiment
                const hasAlert = count >= 3

                return (
                  <div key={sym} className="flex items-center gap-1">
                    <button
                      onClick={() => selectTicker(sym)}
                      className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl text-xs transition-all"
                      style={{
                        background: isActive ? "rgba(34,197,94,0.08)" : "transparent",
                        border: `1px solid ${isActive ? "rgba(34,197,94,0.2)" : "transparent"}`,
                        color: isActive ? D.green : "rgba(255,255,255,0.4)",
                      }}
                      onMouseEnter={e => { if (!isActive) { e.currentTarget.style.color = "rgba(255,255,255,0.7)"; e.currentTarget.style.background = "rgba(255,255,255,0.03)" }}}
                      onMouseLeave={e => { if (!isActive) { e.currentTarget.style.color = "rgba(255,255,255,0.4)"; e.currentTarget.style.background = "transparent" }}}>
                      {hasAlert && !isActive && (
                        <span className="w-1 h-1 rounded-full flex-shrink-0 animate-pulse" style={{ background: D.red }} />
                      )}
                      <span className="font-bold tracking-tight">{sym.replace("-USD","")}</span>
                      {sentiment === "bullish" && <span className="text-[9px] text-green-400/60">●</span>}
                      {sentiment === "bearish" && <span className="text-[9px] text-red-400/60">●</span>}
                      {count > 0 && (
                        <span className="ml-auto text-[9px]" style={{ color: "rgba(255,255,255,0.2)" }}>{count}</span>
                      )}
                    </button>
                    <button
                      onClick={() => toggleWatchlist(sym)}
                      className="w-6 h-6 flex items-center justify-center rounded-lg transition-all flex-shrink-0"
                      style={{ color: inWl ? "#f59e0b" : "rgba(255,255,255,0.15)" }}
                      onMouseEnter={e => (e.currentTarget.style.color = inWl ? "#f59e0b" : "rgba(255,255,255,0.4)")}
                      onMouseLeave={e => (e.currentTarget.style.color = inWl ? "#f59e0b" : "rgba(255,255,255,0.15)")}>
                      <Star size={10} fill={inWl ? "currentColor" : "none"} />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Catégories */}
          <div className="p-4" style={{ borderBottom: "1px solid #111" }}>
            <p className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: "rgba(255,255,255,0.2)" }}>Catégories</p>
            <div className="space-y-0.5">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.key}
                  onClick={() => { setSelectedCategory(cat.key); setSelectedTicker(null) }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all"
                  style={{
                    background: selectedCategory === cat.key && !selectedTicker ? "rgba(255,255,255,0.05)" : "transparent",
                    border: `1px solid ${selectedCategory === cat.key && !selectedTicker ? "rgba(255,255,255,0.08)" : "transparent"}`,
                    color: selectedCategory === cat.key && !selectedTicker ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.3)",
                  }}
                  onMouseEnter={e => { if (selectedCategory !== cat.key || selectedTicker) e.currentTarget.style.color = "rgba(255,255,255,0.6)" }}
                  onMouseLeave={e => { if (selectedCategory !== cat.key || selectedTicker) e.currentTarget.style.color = "rgba(255,255,255,0.3)" }}>
                  <span>{cat.icon}</span>
                  <span>{cat.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Trending */}
          <div className="p-4 flex-1 overflow-y-auto">
            <div className="flex items-center gap-2 mb-3">
              <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.2)" }}>🔥 Trending</p>
              <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse flex-shrink-0" />
            </div>
            {trending.length > 0 ? (
              <div className="space-y-1.5">
                {trending.slice(0, 7).map((t, i) => (
                  <button key={i} onClick={() => setSearch(t.topic)}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left transition-all"
                    style={{ background: "transparent" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                    <span className="text-sm flex-shrink-0">{t.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-semibold truncate" style={{ color: "rgba(255,255,255,0.65)" }}>{t.topic}</p>
                      <p className="text-[9px]" style={{ color: "rgba(255,255,255,0.2)" }}>{t.count} articles</p>
                    </div>
                    <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                      t.sentiment?.includes("positif") ? "text-green-400 bg-green-400/10" :
                      t.sentiment?.includes("négatif") ? "text-red-400 bg-red-400/10" :
                      "text-yellow-400 bg-yellow-400/10"
                    }`}>
                      {t.sentiment}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-9 rounded-xl animate-pulse" style={{ background: "rgba(255,255,255,0.03)" }} />
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* ── CENTRAL FEED ─────────────────────────────────────────────────── */}
        <main className="flex-1 min-w-0 p-5 overflow-y-auto h-full">

          {/* Briefing strip */}
          {briefingText && (
            <AnimatePresence>
              {briefingOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden mb-4">
                  <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl"
                    style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.12)" }}>
                    <span className="text-sm flex-shrink-0">📋</span>
                    <p className="flex-1 text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>{briefingText}</p>
                    <button onClick={() => setBriefingOpen(false)}
                      className="flex-shrink-0 transition" style={{ color: "rgba(255,255,255,0.2)" }}
                      onMouseEnter={e => (e.currentTarget.style.color = "white")}
                      onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.2)")}>
                      <X size={12} />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          )}

          {/* State: selected ticker with articles */}
          {selectedTicker && (
            <div>
              {/* Ticker header */}
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-black"
                    style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)", color: D.green }}>
                    {selectedTicker.replace("-USD","").slice(0,3)}
                  </div>
                  <div>
                    <p className="text-sm font-black text-white">{selectedTicker.replace("-USD","")}</p>
                    <p className="text-[9px]" style={{ color: "rgba(255,255,255,0.25)" }}>
                      {loadingArticles ? "Chargement…" : `${catFiltered.length} actualités`}
                    </p>
                  </div>
                </div>
                <button onClick={() => setSelectedTicker(null)}
                  className="ml-auto flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-lg transition-all"
                  style={{ color: "rgba(255,255,255,0.3)", border: "1px solid rgba(255,255,255,0.08)" }}
                  onMouseEnter={e => (e.currentTarget.style.color = "white")}
                  onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.3)")}>
                  <X size={10} /> Revenir
                </button>
              </div>

              {loadingArticles ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-28 rounded-2xl animate-pulse" style={{ background: D.card }} />
                  ))}
                </div>
              ) : catFiltered.length === 0 ? (
                <div className="text-center py-16 rounded-2xl" style={{ background: D.card, border: `1px solid ${D.border}` }}>
                  <p className="text-3xl mb-3">📭</p>
                  <p className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.4)" }}>Aucune actualité trouvée</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {catFiltered.map((article, i) => (
                    <NewsCard key={i} article={article} onTickerClick={selectTicker} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* State: search results */}
          {!selectedTicker && search && (
            <div>
              <p className="text-xs font-bold mb-4" style={{ color: "rgba(255,255,255,0.3)" }}>
                {catFiltered.length} résultat{catFiltered.length !== 1 ? "s" : ""} pour &quot;{search}&quot;
              </p>
              {catFiltered.length === 0 ? (
                <div className="text-center py-16 rounded-2xl" style={{ background: D.card, border: `1px solid ${D.border}` }}>
                  <p className="text-3xl mb-3">🔍</p>
                  <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>Aucun résultat</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {catFiltered.map((article, i) => (
                    <NewsCard key={i} article={article} onTickerClick={selectTicker} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* State: general news by category sections */}
          {isGeneral && (
            <div>
              {loadingGeneral && generalArticles.length === 0 ? (
                <div className="space-y-6">
                  {[...Array(3)].map((_, g) => (
                    <div key={g}>
                      <div className="h-5 w-48 rounded-lg animate-pulse mb-4" style={{ background: D.card }} />
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {[...Array(4)].map((_, i) => (
                          <div key={i} className="h-32 rounded-2xl animate-pulse" style={{ background: D.card }} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : selectedCategory !== "all" ? (
                // Single category filter
                <div>
                  <p className="text-xs font-bold mb-4" style={{ color: "rgba(255,255,255,0.3)" }}>
                    {catFiltered.length} articles · {CATEGORIES.find(c => c.key === selectedCategory)?.label}
                  </p>
                  {catFiltered.length === 0 ? (
                    <div className="text-center py-16 rounded-2xl" style={{ background: D.card, border: `1px solid ${D.border}` }}>
                      <p className="text-3xl mb-3">📭</p>
                      <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>Aucune actualité dans cette catégorie</p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {catFiltered.map((article, i) => (
                        <NewsCard key={i} article={article} onTickerClick={selectTicker} />
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                // All categories — sections thématiques
                <div className="space-y-8">
                  {CAT_SECTIONS.map(sect => {
                    const sects = sectionArticles(sect.key)
                    if (sects.length === 0) return null
                    return (
                      <div key={sect.key}>
                        <div className="flex items-center justify-between mb-3">
                          <h2 className="text-sm font-black text-white">{sect.title}</h2>
                          <button
                            onClick={() => setSelectedCategory(sect.key)}
                            className="text-[10px] transition"
                            style={{ color: "rgba(255,255,255,0.25)" }}
                            onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.6)")}
                            onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.25)")}>
                            Voir plus →
                          </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                          {sects.slice(0, 4).map((article, i) => (
                            <NewsCard key={i} article={article} onTickerClick={selectTicker} />
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </main>

        {/* ── RIGHT PANEL ──────────────────────────────────────────────────── */}
        <aside className="w-[280px] flex-shrink-0 flex-col gap-px hidden xl:flex overflow-y-auto"
          style={{ background: "#070707", borderLeft: "1px solid #111" }}>

          {/* Fear & Greed */}
          <div className="p-4" style={{ borderBottom: "1px solid #111" }}>
            <p className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: "rgba(255,255,255,0.2)" }}>
              Fear &amp; Greed Index
            </p>
            <FearGreedGaugeMini data={fearGreed} />
            {fearGreed && (
              <p className="text-[10px] leading-relaxed mt-2" style={{ color: "rgba(255,255,255,0.25)" }}>
                {fearGreed.score <= 25
                  ? "Marchés en peur — historiquement une opportunité d'achat"
                  : fearGreed.score <= 45
                  ? "Sentiment prudent — surveiller les supports"
                  : fearGreed.score <= 55
                  ? "Marchés équilibrés — pas de signal fort"
                  : fearGreed.score <= 75
                  ? "Optimisme présent — rester vigilant"
                  : "Euphorie — risque de correction élevé"
                }
              </p>
            )}
          </div>

          {/* Market Pulse */}
          <div className="p-4" style={{ borderBottom: "1px solid #111" }}>
            <div className="flex items-center gap-2 mb-3">
              <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.2)" }}>Market Pulse</p>
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse flex-shrink-0" />
            </div>
            <div className="space-y-2.5">
              {pulseItems.map(({ label, key }) => {
                const d = prices[key]
                return (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.4)" }}>{label}</span>
                    {d ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-white tabular-nums">
                          {d.price >= 1000
                            ? `$${d.price.toLocaleString("en-US",{maximumFractionDigits:0})}`
                            : `$${d.price.toFixed(2)}`}
                        </span>
                        <span className="text-[10px] font-bold tabular-nums"
                          style={{ color: d.change >= 0 ? D.green : D.red }}>
                          {d.change >= 0 ? "+" : ""}{d.change.toFixed(2)}%
                        </span>
                      </div>
                    ) : (
                      <div className="h-3 w-24 rounded animate-pulse" style={{ background: D.card }} />
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Economic Calendar */}
          <div className="p-4" style={{ borderBottom: "1px solid #111" }}>
            <p className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: "rgba(255,255,255,0.2)" }}>📅 Calendrier</p>
            {econEvents.length > 0 ? (
              <div className="space-y-2">
                {econEvents.slice(0, 5).map((ev, i) => (
                  <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-xl transition-all"
                    style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
                    <span className="text-base flex-shrink-0 leading-none mt-0.5">{ev.flag}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-semibold truncate" style={{ color: "rgba(255,255,255,0.65)" }}>{ev.name}</p>
                      <p className="text-[9px] mt-0.5" style={{ color: "rgba(255,255,255,0.2)" }}>
                        {new Date(ev.date).toLocaleDateString("fr-FR",{day:"numeric",month:"short"})} · {ev.time}
                      </p>
                    </div>
                    <span className={`text-[8px] font-black px-1 py-0.5 rounded flex-shrink-0 mt-0.5 ${
                      ev.impact === "critical" ? "bg-red-500/20 text-red-400" :
                      ev.impact === "high"     ? "bg-orange-500/20 text-orange-400" :
                                                 "bg-yellow-500/15 text-yellow-400"
                    }`}>
                      {ev.impact === "critical" ? "🔴" : ev.impact === "high" ? "🟠" : "🟡"}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-14 rounded-xl animate-pulse" style={{ background: D.card }} />
                ))}
              </div>
            )}
          </div>

          {/* Social Buzz */}
          <div className="p-4">
            <p className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: "rgba(255,255,255,0.2)" }}>
              📡 Social Buzz
            </p>
            {socialBuzz.length > 0 ? (
              <div className="space-y-2">
                {socialBuzz.slice(0, 7).map((item, i) => {
                  const sentColor = item.dominant_sentiment === "bullish" ? D.green : item.dominant_sentiment === "bearish" ? D.red : D.yellow
                  return (
                    <div key={i} className="flex items-center gap-2.5">
                      <span className="text-[9px] w-4 text-center flex-shrink-0" style={{ color: "rgba(255,255,255,0.2)" }}>{i + 1}</span>
                      <button onClick={() => selectTicker(item.symbol)}
                        className="text-xs font-bold transition flex-shrink-0 w-12 text-left"
                        style={{ color: "rgba(255,255,255,0.5)" }}
                        onMouseEnter={e => (e.currentTarget.style.color = "white")}
                        onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.5)")}>
                        {item.symbol.replace("-USD","")}
                      </button>
                      <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
                        <div className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${item.buzz_score}%`, background: sentColor }} />
                      </div>
                      <span className="text-[9px] font-bold w-6 text-right flex-shrink-0" style={{ color: sentColor }}>
                        {item.buzz_score}
                      </span>
                    </div>
                  )
                })}
                <p className="text-[8px] mt-2" style={{ color: "rgba(255,255,255,0.12)" }}>
                  * Basé sur l&apos;analyse des actualités financières
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-4 rounded animate-pulse" style={{ background: D.card }} />
                ))}
              </div>
            )}
          </div>

        </aside>
      </div>
    </div>
  )
}
