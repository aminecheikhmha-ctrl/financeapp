"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Search, RefreshCw } from "lucide-react"
import { useLanguage } from "@/lib/i18n/context"

// ─── Types ─────────────────────────────────────────────────────────────────────

type Article = {
  title: string
  source: string
  url: string
  published_at: string
  tickers?: string[]
  ai_summary?: string
  is_breaking?: boolean
  breaking?: boolean
  sentiment_score?: number
  theme?: string
  description?: string
}

type TrendingBuzzItem = {
  symbol: string
  buzz_score: number
  mentions_24h: number
  sentiment: "bullish" | "bearish" | "neutral"
  change_velocity?: "rising" | "stable"
  top_post?: string
}

type MarketItem  = { symbol: string; label: string; price: number; change: number }
type FearGreed   = { score: number; label: string; color: string; change: number }
type EconEvent   = { name: string; date: string; time: string; impact: string; flag: string }
type TapeItem    = { symbol: string; price: number; change: number }

// ─── Theme definitions ─────────────────────────────────────────────────────────

const THEMES = [
  { key: "all",          label: "All news",               icon: "🌐" },
  { key: "breaking",     label: "Breaking News",          icon: "🔴" },
  { key: "macro",        label: "Macro & Fed",            icon: "🏦" },
  { key: "stocks",       label: "Markets & Stocks",       icon: "📈" },
  { key: "crypto",       label: "Crypto & Web3",          icon: "₿"  },
  { key: "tech",         label: "Technology & AI",        icon: "🤖" },
  { key: "energy",       label: "Energy & Oil",           icon: "⚡" },
  { key: "commodities",  label: "Commodities",            icon: "🥇" },
  { key: "earnings",     label: "Earnings",               icon: "📊" },
  { key: "geopolitique", label: "Geopolitics",            icon: "🌍" },
  { key: "ipo",          label: "IPO & M&A",              icon: "🚀" },
  { key: "forex",        label: "Forex & Currencies",     icon: "💱" },
  { key: "regulation",   label: "Regulation & SEC",       icon: "⚖️" },
  { key: "dividends",    label: "Dividends",              icon: "💰" },
  { key: "reddit",       label: "Reddit & Social",        icon: "📱" },
] as const

type ThemeKey = typeof THEMES[number]["key"]

const THEME_KEYWORDS: Record<string, string[]> = {
  macro:       ["fed","federal reserve","inflation","cpi","rate","ecb","recession","gdp","fomc","treasury","yields","powell"],
  stocks:      ["s&p","nasdaq","dow","equity","wall street","shares","stock market","rally","correction","ipo"],
  crypto:      ["bitcoin","ethereum","crypto","blockchain","defi","nft","btc","eth","solana","binance","coinbase","web3"],
  tech:        ["ai","artificial intelligence","nvidia","openai","chatgpt","apple","microsoft","google","semiconductor","chip"],
  energy:      ["oil","crude","opec","natural gas","energy","petroleum","lng","solar","wind","exxon","bp"],
  commodities: ["gold","silver","copper","wheat","corn","commodity","futures","lithium"],
  earnings:    ["earnings","revenue","profit","eps","guidance","quarter","results","beat","miss"],
  geopolitique:["war","conflict","sanctions","tariff","trade","china","russia","ukraine","middle east","geopolitical"],
  ipo:         ["ipo","merger","acquisition","deal","takeover","listing","spac","m&a","buyout"],
  forex:       ["dollar","euro","yen","sterling","currency","exchange rate","dxy","forex","pound"],
  regulation:  ["sec","regulation","compliance","fine","lawsuit","investigation","cftc","antitrust"],
  dividends:   ["dividend","yield","payout","shareholder","buyback"],
  reddit:      ["reddit","wallstreetbets","wsb","short squeeze","meme stock","retail"],
}

const QUICK_ASSETS = [
  "AAPL","NVDA","TSLA","BTC","ETH","SPY","MSFT","META","GOOGL","AMZN","COIN","GLD","QQQ","AMD","PLTR",
]

const TAPE_SYMS    = ["AAPL","NVDA","TSLA","MSFT","META","GOOGL","AMZN","BTC-USD","ETH-USD","SPY","QQQ","GLD","NFLX","AMD","COIN"]
const PULSE_SYMS   = [
  { symbol: "SPY",    label: "S&P 500"   },
  { symbol: "QQQ",    label: "Nasdaq 100" },
  { symbol: "%5EVIX", label: "VIX"       },
  { symbol: "GLD",    label: "Gold"      },
  { symbol: "BTC-USD",label: "Bitcoin"   },
]

// ─── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const ago = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (ago < 1)    return "just now"
  if (ago < 60)   return `${ago}m`
  if (ago < 1440) return `${Math.round(ago / 60)}h`
  return `${Math.round(ago / 1440)}d`
}

function sourceStyle(source: string): { bg: string; color: string } {
  const s = source.toLowerCase()
  if (s.includes("cnbc"))         return { bg: "rgba(0,98,204,0.18)",   color: "#4da6ff" }
  if (s.includes("reuters"))      return { bg: "rgba(255,140,0,0.16)",  color: "#ffaa44" }
  if (s.includes("marketwatch"))  return { bg: "rgba(124,58,237,0.15)", color: "#a78bfa" }
  if (s.includes("bloomberg"))    return { bg: "rgba(20,184,166,0.15)", color: "#2dd4bf" }
  if (s.includes("wsj") || s.includes("wall street journal"))
                                  return { bg: "rgba(234,179,8,0.15)",  color: "#facc15" }
  if (s.includes("ft") || s.includes("financial times"))
                                  return { bg: "rgba(244,63,94,0.15)",  color: "#fb7185" }
  if (s.includes("reddit"))       return { bg: "rgba(249,115,22,0.12)", color: "#fb923c" }
  if (s.includes("cointelegraph") || s.includes("coindesk") || s.includes("decrypt"))
                                  return { bg: "rgba(249,115,22,0.10)", color: "#fb923c" }
  if (s.includes("economist"))    return { bg: "rgba(239,68,68,0.12)",  color: "#f87171" }
  if (s.includes("techcrunch"))   return { bg: "rgba(16,185,129,0.12)", color: "#34d399" }
  if (s.includes("the verge"))    return { bg: "rgba(139,92,246,0.12)", color: "#a78bfa" }
  return { bg: "rgba(59,130,246,0.1)", color: "#60a5fa" }
}

function matchTheme(article: Article, key: string): boolean {
  if (key === "all") return true
  if (key === "breaking") return !!(article.is_breaking || article.breaking)
  if (article.theme === key) return true
  const kws  = THEME_KEYWORDS[key] ?? []
  const text = article.title.toLowerCase()
  return kws.some(kw => text.includes(kw))
}

// ─── Fear & Greed gauge ────────────────────────────────────────────────────────

function FearGreedGaugeMini({ data }: { data: FearGreed | null }) {
  if (!data) return (
    <div className="h-28 rounded-2xl animate-pulse" style={{ background: "#0d0d0d" }} />
  )
  const { score, label, color, change } = data
  const deg = (score / 100) * 180 - 90
  const nx  = +(100 + 60 * Math.cos((deg - 90) * Math.PI / 180)).toFixed(1)
  const ny  = +(100 + 60 * Math.sin((deg - 90) * Math.PI / 180)).toFixed(1)
  const segs = [
    { from: 180, to: 144, c: "#ef4444" },
    { from: 144, to: 108, c: "#f97316" },
    { from: 108, to:  72, c: "#facc15" },
    { from:  72, to:  36, c: "#84cc16" },
    { from:  36, to:   0, c: "#22c55e" },
  ]
  function pt(d: number) {
    return { x: +(100 + 80 * Math.cos(d * Math.PI / 180)).toFixed(1), y: +(100 - 80 * Math.sin(d * Math.PI / 180)).toFixed(1) }
  }

  return (
    <div>
      <svg viewBox="0 0 200 115" className="w-full" style={{ maxHeight: 100 }}>
        <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="16" strokeLinecap="round" />
        {segs.map(({ from, to, c }, i) => {
          const s = pt(from); const e = pt(to)
          return <path key={i} d={`M ${s.x} ${s.y} A 80 80 0 0 0 ${e.x} ${e.y}`} fill="none" stroke={c} strokeWidth="14" strokeLinecap="butt" opacity="0.75" />
        })}
        <line x1="100" y1="100" x2={nx} y2={ny} stroke="white" strokeWidth="2.5" strokeLinecap="round" style={{ transition: "all 0.8s cubic-bezier(0.34,1.56,0.64,1)" }} />
        <circle cx="100" cy="100" r="5" fill="white" />
        <text x="100" y="91" textAnchor="middle" fill="white" fontSize="20" fontWeight="900" fontFamily="system-ui">{score}</text>
      </svg>
      <div className="flex justify-between items-center mt-1 px-1">
        <span className="text-[9px] text-white/20">Peur</span>
        <span className="text-xs font-black" style={{ color }}>{label}</span>
        <span className="text-[9px] text-white/20">Cupidité</span>
      </div>
      <p className="mt-1.5 text-center">
        <span className={`text-[10px] font-bold ${change >= 0 ? "text-green-400" : "text-red-400"}`}>
          {change >= 0 ? "▲" : "▼"} {Math.abs(change).toFixed(0)} pts vs hier
        </span>
      </p>
    </div>
  )
}

// ─── NewsCard ──────────────────────────────────────────────────────────────────

function NewsCard({ article, featured = false }: { article: Article; featured?: boolean }) {
  const score     = article.sentiment_score ?? 0
  const sentColor = score > 20 ? "#22c55e" : score < -20 ? "#ef4444" : "#f59e0b"
  const sentLabel = score > 20 ? "🟢 Positive" : score < -20 ? "🔴 Negative" : "🟡 Neutral"
  const { bg: srcBg, color: srcColor } = sourceStyle(article.source)
  const isBreaking = article.is_breaking || article.breaking

  return (
    <a href={article.url} target="_blank" rel="noopener noreferrer"
      className="group block rounded-2xl overflow-hidden transition-all duration-150"
      style={{ background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.06)" }}
      onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "rgba(255,255,255,0.13)"; el.style.background = "#0f0f0f" }}
      onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "rgba(255,255,255,0.06)"; el.style.background = "#0a0a0a" }}>

      {isBreaking && (
        <div className="h-[2px]" style={{ background: "linear-gradient(90deg, #ef4444, transparent)" }} />
      )}

      <div className={featured ? "p-5" : "p-4"}>
        {/* Header */}
        <div className="flex items-center gap-2 mb-2.5 flex-wrap">
          {isBreaking && (
            <span className="text-[8px] font-black px-2 py-0.5 rounded-full animate-pulse flex-shrink-0"
              style={{ background: "rgba(239,68,68,0.2)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)" }}>
              🔴 BREAKING
            </span>
          )}
          <span className="text-[9px] font-bold px-2 py-0.5 rounded-md truncate max-w-[130px]"
            style={{ background: srcBg, color: srcColor }}>
            {article.source.slice(0, 22)}
          </span>
          <span className="text-[9px] text-white/20 flex-shrink-0">{timeAgo(article.published_at)}</span>
          {score !== 0 && (
            <span className="ml-auto text-[9px] font-semibold flex-shrink-0" style={{ color: sentColor }}>
              {sentLabel}
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className={`font-bold text-white/80 group-hover:text-white transition-colors leading-snug mb-2.5 ${featured ? "text-[15px]" : "text-sm"}`}>
          {article.title}
        </h3>

        {/* Description (featured) */}
        {featured && article.description && (
          <p className="text-xs text-white/35 leading-relaxed mb-3 line-clamp-2">{article.description}</p>
        )}

        {/* AI summary */}
        {article.ai_summary && (
          <p className="text-[10px] italic mb-2.5 leading-relaxed" style={{ color: "rgba(255,255,255,0.28)" }}>
            🤖 {article.ai_summary}
          </p>
        )}

        {/* Tickers */}
        {(article.tickers?.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-1 mb-2.5">
            {article.tickers!.slice(0, 5).map(t => (
              <span key={t} className="text-[9px] font-bold px-1.5 py-0.5 rounded-md"
                style={{ background: "rgba(34,197,94,0.08)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.12)" }}>
                ${t.replace("-USD", "")}
              </span>
            ))}
          </div>
        )}

        {/* Sentiment bar */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-0.5 rounded-full overflow-hidden bg-white/5">
            <div className="h-full rounded-full" style={{ width: `${((score + 100) / 200) * 100}%`, background: sentColor }} />
          </div>
          <span className="text-[9px] text-white/20 group-hover:text-white/40 transition flex-shrink-0">Read ↗</span>
        </div>
      </div>
    </a>
  )
}

// ─── Hero card ─────────────────────────────────────────────────────────────────

function HeroCard({ article }: { article: Article }) {
  const score     = article.sentiment_score ?? 0
  const sentColor = score > 20 ? "#22c55e" : score < -20 ? "#ef4444" : "#f59e0b"
  const { bg: srcBg, color: srcColor } = sourceStyle(article.source)

  return (
    <a href={article.url} target="_blank" rel="noopener noreferrer"
      className="group block rounded-3xl overflow-hidden mb-4 transition-all duration-150"
      style={{ background: "#0d0d0d", border: "1px solid rgba(255,255,255,0.08)" }}
      onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "rgba(255,255,255,0.17)"; el.style.background = "#111" }}
      onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "rgba(255,255,255,0.08)"; el.style.background = "#0d0d0d" }}>
      <div className="h-[3px]" style={{ background: "linear-gradient(90deg, #22c55e 0%, #3b82f6 55%, transparent 100%)" }} />
      <div className="p-5">
        <div className="flex items-center gap-2.5 mb-3 flex-wrap">
          <span className="text-[9px] font-black px-2.5 py-0.5 rounded-full"
            style={{ background: "rgba(34,197,94,0.12)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.25)" }}>
            ⭐ Top story
          </span>
          <span className="text-[9px] font-bold px-2 py-0.5 rounded-md" style={{ background: srcBg, color: srcColor }}>
            {article.source.slice(0, 24)}
          </span>
          <span className="text-[9px] text-white/20">{timeAgo(article.published_at)}</span>
          {(article.is_breaking || article.breaking) && (
            <span className="ml-auto text-[9px] font-black px-2 py-0.5 rounded-full animate-pulse"
              style={{ background: "rgba(239,68,68,0.2)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)" }}>
              🔴 BREAKING
            </span>
          )}
        </div>
        <p className="text-[15px] md:text-base font-black text-white/90 group-hover:text-white transition-colors leading-snug mb-3">
          {article.title}
        </p>
        {article.ai_summary && (
          <p className="text-xs text-white/40 leading-relaxed mb-4">🤖 {article.ai_summary}</p>
        )}
        {article.description && (
          <p className="text-xs text-white/30 leading-relaxed mb-4 line-clamp-2">{article.description}</p>
        )}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex gap-1.5 flex-wrap">
            {(article.tickers ?? []).slice(0, 5).map(t => (
              <span key={t} className="text-[9px] font-bold px-2 py-0.5 rounded-lg"
                style={{ background: "rgba(34,197,94,0.08)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.15)" }}>
                ${t.replace("-USD", "")}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2 ml-auto">
            {score !== 0 && (
              <span className="text-[9px] font-semibold" style={{ color: sentColor }}>
                {score > 20 ? "🟢 Positive" : score < -20 ? "🔴 Negative" : "🟡 Neutral"}
              </span>
            )}
            <span className="text-[9px] text-white/25 group-hover:text-white/50 transition">Read article ↗</span>
          </div>
        </div>
      </div>
    </a>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function NewsPage() {
  const { t } = useLanguage()
  const [activeTheme, setActiveTheme] = useState<ThemeKey>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [articles, setArticles]       = useState<Article[]>([])
  const [loading, setLoading]         = useState(false)
  const [socialBuzz, setSocialBuzz]   = useState<TrendingBuzzItem[]>([])
  const [fearGreed, setFearGreed]     = useState<FearGreed | null>(null)
  const [marketPulse, setMarketPulse] = useState<MarketItem[]>([])
  const [econEvents, setEconEvents]   = useState<EconEvent[]>([])
  const [tapePrices, setTapePrices]   = useState<TapeItem[]>([])
  const [lastUpdate, setLastUpdate]   = useState(new Date())

  // ── Fetch articles ──────────────────────────────────────────────────────────
  const fetchNews = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch("/api/news?symbol=general&limit=100")
      const data = res.ok ? await res.json() : null
      if (data?.articles) { setArticles(data.articles); setLastUpdate(new Date()) }
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchNews()
    const id = setInterval(fetchNews, 5 * 60 * 1000)
    return () => clearInterval(id)
  }, [fetchNews])

  // ── Social buzz trending ────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/news/reddit-buzz?mode=trending")
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.trending) setSocialBuzz(d.trending) })
      .catch(() => {})
  }, [])

  // ── Fear & Greed ────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/news/fear-greed")
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setFearGreed({ score: d.score, label: d.label, color: d.color, change: d.change ?? 0 }) })
      .catch(() => {})
  }, [])

  // ── Market pulse ────────────────────────────────────────────────────────────
  const fetchPulse = useCallback(async () => {
    const results = await Promise.allSettled(
      PULSE_SYMS.map(({ symbol }) =>
        fetch(`/api/price?symbol=${symbol}`).then(r => r.ok ? r.json() : null)
      )
    )
    const items: MarketItem[] = []
    results.forEach((r, i) => {
      if (r.status === "fulfilled" && r.value) {
        items.push({ symbol: PULSE_SYMS[i].symbol, label: PULSE_SYMS[i].label, price: r.value.price, change: r.value.change })
      }
    })
    setMarketPulse(items)
  }, [])

  useEffect(() => { fetchPulse(); const id = setInterval(fetchPulse, 30_000); return () => clearInterval(id) }, [fetchPulse])

  // ── Economic calendar ───────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/news/economic-calendar")
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.events) setEconEvents(d.events) })
      .catch(() => {})
  }, [])

  // ── Ticker tape ─────────────────────────────────────────────────────────────
  const fetchTape = useCallback(async () => {
    const results = await Promise.allSettled(
      TAPE_SYMS.map(sym =>
        fetch(`/api/price?symbol=${sym}`).then(r => r.ok ? r.json() : null)
          .then(d => d ? { symbol: sym, price: d.price as number, change: d.change as number } : null)
      )
    )
    const items: TapeItem[] = []
    for (const r of results) { if (r.status === "fulfilled" && r.value) items.push(r.value) }
    setTapePrices(items)
  }, [])

  useEffect(() => { fetchTape(); const id = setInterval(fetchTape, 30_000); return () => clearInterval(id) }, [fetchTape])

  // ── Filter articles ─────────────────────────────────────────────────────────
  const filteredArticles = useMemo(() => {
    let list = [...articles]
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      list = list.filter(a =>
        a.title.toLowerCase().includes(q) ||
        a.source.toLowerCase().includes(q) ||
        a.tickers?.some(t => t.toLowerCase().includes(q))
      )
    }
    if (activeTheme !== "all") list = list.filter(a => matchTheme(a, activeTheme))
    return list
  }, [articles, searchQuery, activeTheme])

  const heroArticle   = filteredArticles[0]
  const restArticles  = filteredArticles.slice(1)
  const breakingCount = articles.filter(a => a.is_breaking || a.breaking).length

  const selectTheme = (key: ThemeKey) => { setActiveTheme(key); setSearchQuery("") }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#050505" }}>

      {/* ── LEFT SIDEBAR — fixed, never scrolls ────────────────────────────── */}
      <aside className="w-[220px] flex-shrink-0 flex flex-col overflow-hidden h-full hidden lg:flex"
        style={{ background: "#070707", borderRight: "1px solid rgba(255,255,255,0.05)" }}>

        {/* Header */}
        <div className="flex-shrink-0 px-4 pt-4 pb-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <h2 className="text-[9px] font-black text-white uppercase tracking-widest">{t.news.tabs.macro}</h2>
        </div>

        {/* Themes list */}
        <div className="flex-shrink-0 px-2 py-2 space-y-0.5">
          {THEMES.map(theme => (
            <button key={theme.key}
              onClick={() => selectTheme(theme.key)}
              className="w-full flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all text-left"
              style={{
                background: activeTheme === theme.key ? "rgba(255,255,255,0.07)" : "transparent",
                color:      activeTheme === theme.key ? "white" : "rgba(255,255,255,0.35)",
                border:     `1px solid ${activeTheme === theme.key ? "rgba(255,255,255,0.1)" : "transparent"}`,
              }}
              onMouseEnter={e => { if (activeTheme !== theme.key) (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.65)" }}
              onMouseLeave={e => { if (activeTheme !== theme.key) (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.35)" }}>
              <span className="text-sm flex-shrink-0 leading-none">{theme.icon}</span>
              <span className="truncate">{theme.label}</span>
              {theme.key === "breaking" && breakingCount > 0 && activeTheme !== "breaking" && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0 animate-pulse" />
              )}
            </button>
          ))}
        </div>

        {/* Divider */}
        <div className="flex-shrink-0 h-px mx-4 my-2" style={{ background: "rgba(255,255,255,0.05)" }} />

        {/* Social Buzz Live */}
        <div className="flex-1 px-4 pb-4 overflow-hidden">
          <div className="flex items-center gap-2 mb-3">
            <p className="text-[9px] text-white/20 uppercase tracking-widest font-black">📡 Social Buzz Live</p>
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse flex-shrink-0" />
          </div>
          {socialBuzz.length > 0 ? (
            <div className="space-y-2">
              {socialBuzz.slice(0, 8).map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-[9px] text-white/18 w-3 text-center flex-shrink-0">{i + 1}</span>
                  <button onClick={() => setSearchQuery(item.symbol.replace("-USD", ""))}
                    className="text-[11px] font-bold transition flex-shrink-0 w-10 text-left"
                    style={{ color: "rgba(255,255,255,0.5)" }}
                    onMouseEnter={e => (e.currentTarget.style.color = "white")}
                    onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.5)")}>
                    {item.symbol.replace("-USD", "")}
                  </button>
                  <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
                    <div className="h-full rounded-full" style={{
                      width: `${item.buzz_score}%`,
                      background: item.sentiment === "bullish" ? "#22c55e" : item.sentiment === "bearish" ? "#ef4444" : "#f59e0b",
                    }} />
                  </div>
                  <span className={`text-[9px] font-black w-6 text-right flex-shrink-0 ${
                    item.sentiment === "bullish" ? "text-green-400" : item.sentiment === "bearish" ? "text-red-400" : "text-yellow-400"
                  }`}>{item.buzz_score}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-4 rounded animate-pulse" style={{ background: "rgba(255,255,255,0.03)" }} />
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* ── CENTER ──────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* TOPBAR — fixed */}
        <div className="flex-shrink-0" style={{ background: "#080808", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>

          {/* Ticker tape */}
          {tapePrices.length > 0 && (
            <div className="overflow-hidden" style={{ height: 30, borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
              <div className="ticker-animate flex gap-8 h-full items-center whitespace-nowrap">
                {[...tapePrices, ...tapePrices].map((t, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5 text-[10px] flex-shrink-0">
                    <span className="text-white/30 font-mono">{t.symbol.replace("-USD", "")}</span>
                    <span className="text-white font-bold tabular-nums">
                      {t.price >= 1000
                        ? `$${t.price.toLocaleString("en-US", { maximumFractionDigits: 0 })}`
                        : `$${t.price.toFixed(2)}`}
                    </span>
                    <span className="font-bold tabular-nums" style={{ color: t.change > 0 ? "#22c55e" : t.change < 0 ? "#ef4444" : "#666" }}>
                      {t.change > 0 ? "▲" : t.change < 0 ? "▼" : ""}{Math.abs(t.change).toFixed(2)}%
                    </span>
                    <span style={{ color: "rgba(255,255,255,0.07)" }}>·</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Search + quick assets */}
          <div className="px-4 py-2.5 flex items-center gap-3">
            <div className="relative flex-shrink-0 w-56">
              <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "rgba(255,255,255,0.2)" }} />
              <input
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); if (e.target.value) setActiveTheme("all") }}
                placeholder="Asset, theme, source…"
                className="w-full h-8 pl-8 pr-7 rounded-xl text-xs text-white outline-none"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
                onFocus={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)")}
                onBlur={e =>  (e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)")}
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-white/25 hover:text-white text-base leading-none transition">×</button>
              )}
            </div>

            {/* Quick assets */}
            <div className="flex gap-1 overflow-x-auto flex-1" style={{ scrollbarWidth: "none" }}>
              {QUICK_ASSETS.map(sym => (
                <button key={sym}
                  onClick={() => setSearchQuery(searchQuery === sym ? "" : sym)}
                  className="flex-shrink-0 px-2 py-1 rounded-lg text-[9px] font-bold transition-all"
                  style={{
                    background: searchQuery === sym ? "rgba(34,197,94,0.14)" : "transparent",
                    color:      searchQuery === sym ? "#4ade80" : "rgba(255,255,255,0.25)",
                    border:     `1px solid ${searchQuery === sym ? "rgba(34,197,94,0.25)" : "rgba(255,255,255,0.07)"}`,
                  }}>
                  {sym}
                </button>
              ))}
            </div>

            {/* Actions */}
            <div className="flex-shrink-0 flex items-center gap-2">
              <button onClick={fetchNews} disabled={loading}
                className="h-7 w-7 flex items-center justify-center rounded-lg transition-all disabled:opacity-40"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.4)" }}
                onMouseEnter={e => (e.currentTarget.style.color = "white")}
                onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.4)")}>
                <RefreshCw size={10} className={loading ? "animate-spin" : ""} />
              </button>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                <span className="text-[10px] font-black text-green-400">LIVE</span>
                <span className="text-[10px] text-white/25">{filteredArticles.length}</span>
              </div>
              <span className="text-[9px] text-white/15">· {timeAgo(lastUpdate.toISOString())}</span>
            </div>
          </div>

          {/* Mobile: theme pills */}
          <div className="lg:hidden flex gap-1.5 overflow-x-auto px-4 pb-2.5" style={{ scrollbarWidth: "none" }}>
            {THEMES.slice(0, 9).map(theme => (
              <button key={theme.key} onClick={() => selectTheme(theme.key)}
                className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-bold transition-all"
                style={{
                  background: activeTheme === theme.key ? "rgba(255,255,255,0.08)" : "transparent",
                  color:      activeTheme === theme.key ? "white" : "rgba(255,255,255,0.3)",
                  border:     `1px solid ${activeTheme === theme.key ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.06)"}`,
                }}>
                {theme.icon} {theme.label}
              </button>
            ))}
          </div>
        </div>

        {/* FEED — ONLY THIS SCROLLS */}
        <main className="flex-1 overflow-y-auto p-4">

          {/* Theme header */}
          {activeTheme !== "all" && (
            <div className="flex items-center gap-2 mb-4">
              <span className="text-lg">{THEMES.find(t => t.key === activeTheme)?.icon}</span>
              <h1 className="text-sm font-black text-white">{THEMES.find(t => t.key === activeTheme)?.label}</h1>
              <span className="text-[10px] text-white/25 ml-1">{filteredArticles.length} articles</span>
              <button onClick={() => selectTheme("all")}
                className="ml-auto text-[9px] text-white/25 hover:text-white transition">
                ← Tous
              </button>
            </div>
          )}

          {/* Search header */}
          {searchQuery && (
            <div className="flex items-center gap-2 mb-4">
              <span className="text-sm font-black text-white">Results for &ldquo;{searchQuery}&rdquo;</span>
              <span className="text-[10px] text-white/25">{filteredArticles.length} articles</span>
              <button onClick={() => setSearchQuery("")}
                className="ml-auto text-[9px] text-white/25 hover:text-white transition">
                ← Clear
              </button>
            </div>
          )}

          {/* Skeleton */}
          {loading && articles.length === 0 && (
            <div>
              <div className="h-44 rounded-3xl animate-pulse mb-4" style={{ background: "#0d0d0d" }} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="h-32 rounded-2xl animate-pulse" style={{ background: "#0d0d0d" }} />
                ))}
              </div>
            </div>
          )}

          {/* Empty */}
          {!loading && filteredArticles.length === 0 && articles.length > 0 && (
            <div className="text-center py-24">
              <p className="text-4xl mb-3">📭</p>
              <p className="text-sm font-semibold text-white/30 mb-3">{t.news.noNews}</p>
              <button onClick={() => { selectTheme("all") }}
                className="text-xs text-white/30 underline hover:text-white transition">
                {t.common.seeAll}
              </button>
            </div>
          )}

          {/* Hero */}
          {heroArticle && <HeroCard article={heroArticle} />}

          {/* Grid */}
          {restArticles.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {restArticles.map((article, i) => (
                <NewsCard key={`${article.url}-${i}`} article={article} featured={i < 2} />
              ))}
            </div>
          )}

          {/* Bottom padding */}
          <div className="h-8" />
        </main>
      </div>

      {/* ── RIGHT PANEL — fixed ──────────────────────────────────────────────── */}
      <aside className="w-[260px] flex-shrink-0 flex flex-col overflow-hidden h-full hidden xl:flex"
        style={{ background: "#070707", borderLeft: "1px solid rgba(255,255,255,0.05)" }}>
        <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.06) transparent" }}>

          {/* Fear & Greed */}
          <div className="p-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
            <p className="text-[9px] text-white/20 uppercase tracking-widest font-black mb-3">{t.news.fearGreed}</p>
            <FearGreedGaugeMini data={fearGreed} />
            {fearGreed && (
              <p className="text-[10px] leading-relaxed mt-2" style={{ color: "rgba(255,255,255,0.22)" }}>
                {fearGreed.score <= 25 ? "Markets in fear — historic opportunity" :
                 fearGreed.score <= 45 ? "Cautious sentiment — watch supports" :
                 fearGreed.score <= 55 ? "Balanced markets — no strong signal" :
                 fearGreed.score <= 75 ? "Optimism present — stay vigilant" :
                 "Euphoria — high correction risk"}
              </p>
            )}
          </div>

          {/* Market Pulse */}
          <div className="p-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
            <div className="flex items-center gap-2 mb-3">
              <p className="text-[9px] text-white/20 uppercase tracking-widest font-black">📈 Marchés Live</p>
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse flex-shrink-0" />
            </div>
            <div className="space-y-2.5">
              {marketPulse.length > 0 ? marketPulse.map(item => (
                <div key={item.symbol} className="flex items-center justify-between">
                  <span className="text-xs text-white/40">{item.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-white tabular-nums">
                      {item.price >= 1000
                        ? `$${item.price.toLocaleString("en-US", { maximumFractionDigits: 0 })}`
                        : `$${item.price.toFixed(2)}`}
                    </span>
                    <span className="text-[10px] font-bold tabular-nums" style={{ color: item.change >= 0 ? "#22c55e" : "#ef4444" }}>
                      {item.change >= 0 ? "+" : ""}{item.change.toFixed(2)}%
                    </span>
                  </div>
                </div>
              )) : (
                [...Array(5)].map((_, i) => (
                  <div key={i} className="h-4 rounded animate-pulse" style={{ background: "#0d0d0d" }} />
                ))
              )}
            </div>
          </div>

          {/* Reddit / Social Trending — expanded */}
          <div className="p-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
            <p className="text-[9px] text-white/20 uppercase tracking-widest font-black mb-3">🔥 Trending Social</p>
            <div className="space-y-2">
              {socialBuzz.length > 0 ? socialBuzz.slice(0, 8).map((item, i) => (
                <div key={i}
                  className="p-2.5 rounded-xl cursor-pointer transition-all"
                  style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
                  onClick={() => setSearchQuery(item.symbol.replace("-USD", ""))}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[9px] text-white/18 font-bold w-3">#{i + 1}</span>
                    <span className="text-xs font-black text-white/80">{item.symbol.replace("-USD", "")}</span>
                    <span className="text-[8px] px-1.5 py-0.5 rounded-full font-bold"
                      style={{
                        background: item.change_velocity === "rising" ? "rgba(34,197,94,0.1)" : "rgba(255,255,255,0.04)",
                        color: item.change_velocity === "rising" ? "#4ade80" : "rgba(255,255,255,0.22)",
                      }}>
                      {item.change_velocity === "rising" ? "↑ Rising" : "→ Stable"}
                    </span>
                    <span className={`ml-auto text-[10px] font-black ${
                      item.sentiment === "bullish" ? "text-green-400" :
                      item.sentiment === "bearish" ? "text-red-400" : "text-yellow-400"
                    }`}>
                      {item.sentiment === "bullish" ? "🐂" : item.sentiment === "bearish" ? "🐻" : "➖"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
                      <div className="h-full rounded-full" style={{
                        width: `${item.buzz_score}%`,
                        background: item.sentiment === "bullish" ? "#22c55e" : item.sentiment === "bearish" ? "#ef4444" : "#f59e0b",
                      }} />
                    </div>
                    <span className="text-[8px] text-white/20 tabular-nums flex-shrink-0">{item.mentions_24h}</span>
                  </div>
                  {item.top_post && (
                    <p className="text-[8px] leading-tight line-clamp-2" style={{ color: "rgba(255,255,255,0.17)" }}>
                      &ldquo;{item.top_post.slice(0, 78)}&rdquo;
                    </p>
                  )}
                </div>
              )) : (
                [...Array(5)].map((_, i) => (
                  <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: "#0d0d0d" }} />
                ))
              )}
            </div>
            <p className="text-[8px] text-center mt-3" style={{ color: "rgba(255,255,255,0.12)" }}>
              Analyse multi-sources · Reddit + Yahoo Finance
            </p>
          </div>

          {/* Economic Calendar */}
          <div className="p-4">
            <p className="text-[9px] text-white/20 uppercase tracking-widest font-black mb-3">📅 {t.news.calendar}</p>
            {econEvents.length > 0 ? (
              <div className="space-y-2">
                {econEvents.slice(0, 6).map((ev, i) => (
                  <div key={i} className="flex items-start gap-2 p-2 rounded-xl"
                    style={{ background: "rgba(255,255,255,0.02)" }}>
                    <span className="text-sm flex-shrink-0 leading-none mt-0.5">{ev.flag}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-semibold text-white/65 truncate">{ev.name}</p>
                      <p className="text-[9px] text-white/20 mt-0.5">
                        {new Date(ev.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} · {ev.time}
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
                  <div key={i} className="h-12 rounded-xl animate-pulse" style={{ background: "#0d0d0d" }} />
                ))}
              </div>
            )}
          </div>

        </div>
      </aside>

    </div>
  )
}
