"use client"

import { useState, useEffect, useCallback } from "react"
import { AnimatePresence, motion } from "framer-motion"
import FearGreedGauge, { type FearGreedResult } from "@/app/components/news/FearGreedGauge"
import EconomicCalendar from "@/app/components/news/EconomicCalendar"
import MarketPulse from "@/app/components/news/MarketPulse"
import TrendingTopics from "@/app/components/news/TrendingTopics"
import EarningsCalendar from "@/app/components/news/EarningsCalendar"
import SocialPulse from "@/app/components/news/SocialPulse"

// ─── Types ────────────────────────────────────────────────────────────────────
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

type SentimentItem = {
  symbol: string
  buzz_score: number
  reddit_mentions: number
  dominant_sentiment: string
}

type TickerPrice = {
  symbol: string
  price: number
  change: number
}

type BriefingResult = {
  date: string
  bullets: string[]
  asia_summary: string
  watch_today: string[]
  trade_idea: string
  generated_at: string
}

type FeedTab = "all" | "breaking" | "watchlist" | "bullish" | "bearish" | "reddit" | "crypto" | "macro" | "earnings"

// ─── Constants ────────────────────────────────────────────────────────────────
const SYMBOLS = ["SPY", "QQQ", "AAPL", "NVDA", "TSLA", "MSFT", "META", "AMZN", "BTC-USD", "ETH-USD", "SOL-USD", "JPM", "GOOGL"]

const TAPE_SYMBOLS = ["SPY", "QQQ", "NVDA", "TSLA", "AAPL", "MSFT", "META", "BTC-USD"]

const FEED_TABS: Array<{ key: FeedTab; label: string }> = [
  { key: "all", label: "📰 Tout" },
  { key: "breaking", label: "🔴 Breaking" },
  { key: "watchlist", label: "⭐ Watchlist" },
  { key: "bullish", label: "🟢 Haussier" },
  { key: "bearish", label: "🔴 Baissier" },
  { key: "reddit", label: "🔥 Reddit" },
  { key: "crypto", label: "₿ Crypto" },
  { key: "macro", label: "🌍 Macro" },
  { key: "earnings", label: "📊 Earnings" },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
function timeAgo(iso: string): string {
  const ago = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (ago < 60) return `${ago}m`
  if (ago < 1440) return `${Math.round(ago / 60)}h`
  return `${Math.round(ago / 1440)}j`
}

// ─── NewsCard (inline) ────────────────────────────────────────────────────────
function NewsCard({ article }: { article: Article }) {
  const isReddit = article.source.includes("Reddit")
  const score = article.sentiment_score ?? 0

  return (
    <div
      className="group rounded-2xl p-3.5 transition-all border"
      style={{ background: "#0d0d0d", borderColor: "rgba(255,255,255,0.06)" }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)")}
      onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)")}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <span
          className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${isReddit ? "bg-orange-500/10 text-orange-400" : "bg-blue-500/10 text-blue-400"}`}
        >
          {article.source}
        </span>
        <span className="text-[9px] text-white/30">{timeAgo(article.published_at)}</span>
        {article.breaking && (
          <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-red-500/15 text-red-400 animate-pulse">
            🔴 BREAKING
          </span>
        )}
      </div>

      {/* Title */}
      <a href={article.url} target="_blank" rel="noopener noreferrer">
        <p className="text-sm text-gray-300 group-hover:text-green-400 transition leading-snug line-clamp-2 mb-2">
          {article.title}
        </p>
      </a>

      {/* AI summary */}
      {article.ai_summary && (
        <p className="text-[10px] text-white/40 italic mb-2">{article.ai_summary}</p>
      )}

      {/* Sentiment bar */}
      {score !== 0 && (
        <div className="h-0.5 rounded-full bg-white/5 mb-2 overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.abs(score)}%`,
              background: score > 0 ? "#4ade80" : "#ef4444",
              marginLeft: score < 0 ? `${100 - Math.abs(score)}%` : undefined,
            }}
          />
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex flex-wrap gap-1">
          {article.tickers?.slice(0, 4).map(t => (
            <a
              key={t}
              href={`/dashboard?symbol=${t}`}
              className="text-[8px] px-1.5 py-0.5 rounded font-bold transition"
              style={{ background: "rgba(74,222,128,0.08)", color: "#4ade80" }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(74,222,128,0.18)")}
              onMouseLeave={e => (e.currentTarget.style.background = "rgba(74,222,128,0.08)")}
            >
              {t}
            </a>
          ))}
          {article.reddit_score != null && article.reddit_score > 0 && (
            <span className="text-[8px] text-orange-400 font-semibold">↑ {article.reddit_score}</span>
          )}
          {article.reddit_comments != null && article.reddit_comments > 0 && (
            <span className="text-[8px] text-white/30">💬 {article.reddit_comments}</span>
          )}
        </div>
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] text-white/30 hover:text-white transition font-semibold"
        >
          ↗ Ouvrir
        </a>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function NewsPage() {
  const [articles, setArticles] = useState<Article[]>([])
  const [sentiments, setSentiments] = useState<SentimentItem[]>([])
  const [activeSymbol, setActiveSymbol] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<FeedTab>("all")
  const [activeTopic, setActiveTopic] = useState<string | null>(null)
  const [briefing, setBriefing] = useState<BriefingResult | null>(null)
  const [briefingOpen, setBriefingOpen] = useState(false)
  const [watchlist, setWatchlist] = useState<string[]>([])
  const [loadingArticles, setLoadingArticles] = useState(false)
  const [fearGreed, setFearGreed] = useState<FearGreedResult | null>(null)
  const [tickerPrices, setTickerPrices] = useState<TickerPrice[]>([])

  // Load watchlist from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem("news_watchlist")
      if (stored) setWatchlist(JSON.parse(stored))
    } catch {}
  }, [])

  // Load buzz scores
  useEffect(() => {
    Promise.allSettled(
      SYMBOLS.map(sym =>
        fetch(`/api/news/reddit-buzz?symbol=${sym}`)
          .then(r => r.ok ? r.json() : null)
          .then(data => ({ symbol: sym, buzz_score: data?.buzz_score ?? 0, reddit_mentions: data?.mentions_24h ?? 0, dominant_sentiment: data?.dominant_sentiment ?? "neutral" }))
      )
    ).then(results => {
      const items: SentimentItem[] = results
        .filter(r => r.status === "fulfilled")
        .map(r => (r as PromiseFulfilledResult<SentimentItem>).value)
      setSentiments(items)
    })
  }, [])

  // Load fear-greed
  useEffect(() => {
    fetch("/api/news/fear-greed")
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setFearGreed(data) })
      .catch(() => {})
  }, [])

  // Load briefing
  useEffect(() => {
    fetch("/api/news/briefing")
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setBriefing(data) })
      .catch(() => {})
  }, [])

  // Ticker tape prices
  const fetchTickerPrices = useCallback(async () => {
    const results = await Promise.allSettled(
      TAPE_SYMBOLS.map(sym =>
        fetch(`/api/price?symbol=${sym === "BTC-USD" ? "BTC-USD" : sym}`)
          .then(r => r.ok ? r.json() : null)
          .then(data => ({ symbol: sym, price: data?.price ?? 0, change: data?.change ?? 0 }))
      )
    )
    const prices: TickerPrice[] = results
      .filter(r => r.status === "fulfilled" && (r as PromiseFulfilledResult<TickerPrice | null>).value !== null)
      .map(r => (r as PromiseFulfilledResult<TickerPrice>).value)
    setTickerPrices(prices)
  }, [])

  useEffect(() => {
    fetchTickerPrices()
    const id = setInterval(fetchTickerPrices, 30000)
    return () => clearInterval(id)
  }, [fetchTickerPrices])

  // Load articles when symbol changes
  const loadArticles = useCallback(async (symbol: string) => {
    setLoadingArticles(true)
    setArticles([])
    try {
      const res = await fetch(`/api/news?symbol=${symbol}&limit=30`)
      const data = res.ok ? await res.json() : null
      if (data?.articles) setArticles(data.articles)
    } catch {}
    setLoadingArticles(false)
  }, [])

  function selectSymbol(sym: string) {
    setActiveSymbol(sym)
    loadArticles(sym)
  }

  function toggleWatchlist(sym: string) {
    setWatchlist(prev => {
      const next = prev.includes(sym) ? prev.filter(s => s !== sym) : [...prev, sym]
      try { localStorage.setItem("news_watchlist", JSON.stringify(next)) } catch {}
      return next
    })
  }

  function handleTopicClick(topic: string) {
    setActiveTopic(prev => prev === topic ? null : topic)
  }

  // Filter articles
  const filteredArticles = articles.filter(article => {
    if (activeTopic && !article.title.toLowerCase().includes(activeTopic.toLowerCase())) return false
    switch (activeTab) {
      case "breaking": return article.breaking === true
      case "watchlist": return article.tickers?.some(t => watchlist.includes(t)) ?? false
      case "bullish": return (article.sentiment_score ?? 0) > 30
      case "bearish": return (article.sentiment_score ?? 0) < -30
      case "reddit": return article.source.includes("Reddit")
      case "crypto": return article.category === "crypto"
      case "macro": return article.category === "macro"
      case "earnings": return article.category === "earnings"
      default: return true
    }
  })

  const buzzMap = Object.fromEntries(sentiments.map(s => [s.symbol, s.buzz_score]))

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ background: "#060606" }}>

      {/* ── Ticker Tape ───────────────────────────────────────────────────── */}
      <div style={{ background: "#090909", borderBottom: "1px solid #1a1a1a", overflow: "hidden" }}>
        <div className="relative h-8 flex items-center">
          <motion.div
            className="flex items-center gap-6 whitespace-nowrap absolute"
            animate={{ x: [0, -1200] }}
            transition={{ repeat: Infinity, duration: 30, ease: "linear" }}
          >
            {[...tickerPrices, ...tickerPrices].map((t, i) => (
              <span key={i} className="flex items-center gap-2 text-[11px]">
                <span className="font-black text-white">{t.symbol.replace("-USD", "")}</span>
                <span className="text-white/60">${t.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                <span style={{ color: t.change > 0 ? "#4ade80" : t.change < 0 ? "#ef4444" : "#6b7280" }}>
                  {t.change > 0 ? "+" : ""}{t.change.toFixed(2)}%
                </span>
                <span className="text-white/10">·</span>
              </span>
            ))}
          </motion.div>
        </div>
      </div>

      {/* ── Body: 3-column grid ───────────────────────────────────────────── */}
      <div className="flex flex-col lg:grid lg:grid-cols-[280px_1fr_300px] min-h-[calc(100vh-32px)]">

        {/* ── LEFT SIDEBAR ──────────────────────────────────────────────── */}
        <div
          className="lg:sticky lg:top-0 lg:h-screen overflow-y-auto space-y-3 p-4"
          style={{ background: "#080808", borderRight: "1px solid #1a1a1a" }}
        >
          {/* Symbol selector */}
          <div
            className="rounded-3xl p-4"
            style={{ background: "#0d0d0d", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <p className="text-xs font-bold text-white/40 uppercase tracking-widest mb-3">📡 Flux par actif</p>
            <div className="grid grid-cols-3 gap-1.5">
              {SYMBOLS.map(sym => {
                const buzz = buzzMap[sym] ?? 0
                const isActive = activeSymbol === sym
                const inWl = watchlist.includes(sym)
                return (
                  <div key={sym} className="relative">
                    <button
                      onClick={() => selectSymbol(sym)}
                      className="w-full rounded-xl p-2 text-left transition border"
                      style={{
                        background: isActive ? "rgba(74,222,128,0.08)" : "rgba(255,255,255,0.02)",
                        borderColor: isActive ? "#4ade80" : "rgba(255,255,255,0.06)",
                      }}
                    >
                      <p className="text-[10px] font-black text-white truncate">{sym.replace("-USD", "")}</p>
                      {buzz > 50 && (
                        <span className="text-[8px] font-bold text-orange-400">🔥 {buzz}</span>
                      )}
                    </button>
                    <button
                      onClick={() => toggleWatchlist(sym)}
                      className="absolute -top-1 -right-1 text-[10px] rounded-full w-4 h-4 flex items-center justify-center transition"
                      style={{ background: inWl ? "#4ade80" : "rgba(255,255,255,0.1)", color: inWl ? "#000" : "#666" }}
                    >
                      ⭐
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Trending Topics */}
          <TrendingTopics
            onTopicClick={handleTopicClick}
            activeTopics={activeTopic ? [activeTopic] : []}
          />

          {/* Economic Calendar */}
          <EconomicCalendar />
        </div>

        {/* ── CENTRAL FEED ──────────────────────────────────────────────── */}
        <div className="flex-1 p-5 min-w-0">

          {/* Briefing card */}
          {briefing && (
            <div
              className="rounded-2xl mb-4 overflow-hidden"
              style={{ background: "#0d0d0d", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <button
                className="w-full flex items-center justify-between p-4 text-left"
                onClick={() => setBriefingOpen(o => !o)}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">📋</span>
                  <span className="text-xs font-bold text-white">Briefing du {briefing.date}</span>
                  {briefing.trade_idea && (
                    <span className="text-[9px] text-white/40 hidden sm:inline truncate max-w-[200px]">
                      {briefing.bullets[0]}
                    </span>
                  )}
                </div>
                <span className="text-white/40 text-sm">{briefingOpen ? "▲" : "▼"}</span>
              </button>

              <AnimatePresence>
                {briefingOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 space-y-3">
                      <div className="space-y-1.5">
                        {briefing.bullets.map((b, i) => (
                          <p key={i} className="text-[11px] text-white/60 flex gap-2">
                            <span className="text-green-400 flex-shrink-0">•</span>
                            {b}
                          </p>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-[9px] font-bold text-white/30 uppercase mb-1">Asie</p>
                          <p className="text-[10px] text-white/50">{briefing.asia_summary}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-bold text-white/30 uppercase mb-1">À surveiller</p>
                          {briefing.watch_today.map((w, i) => (
                            <p key={i} className="text-[10px] text-white/50">· {w}</p>
                          ))}
                        </div>
                      </div>
                      <div
                        className="rounded-xl p-3"
                        style={{ background: "rgba(74,222,128,0.06)", border: "1px solid rgba(74,222,128,0.15)" }}
                      >
                        <p className="text-[9px] font-bold text-green-400 mb-1">💡 IDÉE DE TRADE</p>
                        <p className="text-[11px] text-white/70">{briefing.trade_idea}</p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Feed tabs */}
          <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
            {FEED_TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className="flex-shrink-0 px-3 py-1.5 text-[11px] font-semibold transition whitespace-nowrap"
                style={{
                  color: activeTab === tab.key ? "#4ade80" : "rgba(255,255,255,0.4)",
                  borderBottom: activeTab === tab.key ? "2px solid #4ade80" : "2px solid transparent",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Active topic badge */}
          {activeTopic && (
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[10px] text-white/40">Filtré par:</span>
              <button
                onClick={() => setActiveTopic(null)}
                className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold"
                style={{ background: "rgba(74,222,128,0.1)", color: "#4ade80" }}
              >
                {activeTopic} ✕
              </button>
            </div>
          )}

          {/* Articles */}
          {!activeSymbol && (
            <div
              className="text-center py-16 rounded-2xl"
              style={{ background: "#0d0d0d", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <p className="text-2xl mb-3">←</p>
              <p className="text-sm text-white/40 mb-1">Sélectionne un actif</p>
              <p className="text-xs text-white/20">Clique sur un symbole dans la sidebar</p>
            </div>
          )}

          {activeSymbol && loadingArticles && (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-24 rounded-2xl animate-pulse" style={{ background: "#0d0d0d" }} />
              ))}
            </div>
          )}

          {activeSymbol && !loadingArticles && (
            <div>
              <p className="text-[10px] text-white/30 mb-3 uppercase tracking-wider">
                {filteredArticles.length} article{filteredArticles.length !== 1 ? "s" : ""} · {activeSymbol.replace("-USD", "")}
              </p>
              {filteredArticles.length === 0 ? (
                <p className="text-center text-white/20 text-sm py-12">Aucune actualité pour ce filtre</p>
              ) : (
                <div className="space-y-2">
                  {filteredArticles.map((article, i) => (
                    <NewsCard key={i} article={article} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── RIGHT PANEL ───────────────────────────────────────────────── */}
        <div
          className="lg:sticky lg:top-0 lg:h-screen overflow-y-auto space-y-3 p-4"
          style={{ background: "#080808", borderLeft: "1px solid #1a1a1a" }}
        >
          <FearGreedGauge data={fearGreed} />
          <MarketPulse />
          <SocialPulse sentiments={sentiments} onSelect={selectSymbol} />
          <EarningsCalendar />
        </div>
      </div>
    </div>
  )
}
