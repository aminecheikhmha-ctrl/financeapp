"use client"

import { useState, useEffect, useCallback } from "react"
import { RefreshCw, TrendingUp, TrendingDown, Minus, Flame, Search } from "lucide-react"
import { cn } from "@/lib/utils"

const TOP_SYMBOLS = [
  "AAPL", "MSFT", "NVDA", "TSLA", "META", "GOOGL", "AMZN",
  "BTC-USD", "ETH-USD", "SOL-USD", "SPY", "QQQ",
]

type Article = {
  title: string
  source: string
  url: string
  published_at: string
  reddit_score?: number
  reddit_comments?: number
}

type SymbolSentiment = {
  symbol: string
  score: number
  label: string
  impact: string
  articles: number
  reddit_mentions: number
  buzz_score: number
  loading: boolean
}

const SOURCES = ["Tous", "Yahoo Finance", "Reddit", "Finnhub"]

export default function NewsPage() {
  const [query, setQuery] = useState("")
  const [activeSymbol, setActiveSymbol] = useState<string | null>(null)
  const [articles, setArticles] = useState<Article[]>([])
  const [loadingArticles, setLoadingArticles] = useState(false)
  const [sentiments, setSentiments] = useState<SymbolSentiment[]>(
    TOP_SYMBOLS.map(s => ({ symbol: s, score: 0, label: "—", impact: "neutre", articles: 0, reddit_mentions: 0, buzz_score: 0, loading: true }))
  )
  const [activeSource, setActiveSource] = useState("Tous")
  const [loadingAll, setLoadingAll] = useState(false)

  // Load cached sentiment for all top symbols
  useEffect(() => {
    async function loadCached() {
      setLoadingAll(true)
      const results = await Promise.allSettled(
        TOP_SYMBOLS.map(sym =>
          Promise.all([
            fetch(`/api/news/reddit-buzz?symbol=${sym}`).then(r => r.ok ? r.json() : null),
          ]).then(([reddit]) => ({ sym, reddit }))
        )
      )
      setSentiments(prev =>
        prev.map((s, i) => {
          const r = results[i]
          if (r.status !== "fulfilled") return { ...s, loading: false }
          const { reddit } = r.value
          return {
            ...s,
            reddit_mentions: reddit?.mentions_24h ?? 0,
            buzz_score: reddit?.buzz_score ?? 0,
            loading: false,
          }
        })
      )
      setLoadingAll(false)
    }
    loadCached()
  }, [])

  const loadArticles = useCallback(async (symbol: string) => {
    setLoadingArticles(true)
    setArticles([])
    try {
      const res = await fetch(`/api/news?symbol=${symbol}&limit=20`)
      const data = res.ok ? await res.json() : null
      if (data?.articles) setArticles(data.articles)
    } catch {}
    setLoadingArticles(false)
  }, [])

  function selectSymbol(sym: string) {
    setActiveSymbol(sym)
    loadArticles(sym)
  }

  const filtered = articles.filter(a => {
    if (activeSource !== "Tous" && !a.source.toLowerCase().includes(activeSource.toLowerCase())) return false
    if (query && !a.title.toLowerCase().includes(query.toLowerCase())) return false
    return true
  })

  const sortedSentiments = [...sentiments].sort((a, b) => b.buzz_score - a.buzz_score)

  return (
    <div className="min-h-screen page-enter" style={{ background: "var(--bg-canvas)" }}>
      <div className="max-w-6xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-black text-white mb-1">📰 Veille IA en temps réel</h1>
          <p className="text-gray-500 text-sm">Actualités financières, sentiment IA et buzz Reddit sur les marchés</p>
        </div>

        {/* Market pulse — buzz scores grid */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Pulse du marché</h2>
            {loadingAll && <div className="w-3 h-3 border border-white/20 border-t-white/60 rounded-full animate-spin" />}
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {sortedSentiments.map(s => {
              const buzzColor = s.buzz_score >= 60 ? "#f97316" : s.buzz_score >= 30 ? "#facc15" : "#6b7280"
              const isActive = activeSymbol === s.symbol
              return (
                <button key={s.symbol} onClick={() => selectSymbol(s.symbol)}
                  className={cn(
                    "rounded-xl p-3 text-left transition border",
                    isActive
                      ? "border-white/20 bg-white/8"
                      : "border-white/[0.05] bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/10"
                  )}>
                  <p className="text-xs font-black text-white mb-1">{s.symbol.replace("-USD", "")}</p>
                  {s.loading ? (
                    <div className="h-3 bg-white/5 rounded animate-pulse" />
                  ) : (
                    <>
                      <div className="flex items-center gap-1 mb-1">
                        <Flame size={10} style={{ color: buzzColor }} />
                        <span className="text-[10px] font-bold" style={{ color: buzzColor }}>{s.buzz_score}</span>
                      </div>
                      {s.reddit_mentions > 0 && (
                        <p className="text-[9px] text-gray-600">{s.reddit_mentions} mentions</p>
                      )}
                    </>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left: symbol selector + article list */}
          <div className="lg:col-span-2 space-y-4">

            {/* Filters */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
                <input type="text" value={query} onChange={e => setQuery(e.target.value)}
                  placeholder="Filtrer les actualités..."
                  className="w-full pl-8 pr-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.07] text-white text-xs placeholder-gray-600 outline-none focus:border-white/20 transition" />
              </div>
              <div className="flex gap-1">
                {SOURCES.map(src => (
                  <button key={src} onClick={() => setActiveSource(src)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-semibold transition border",
                      activeSource === src
                        ? "bg-white/10 text-white border-white/15"
                        : "text-gray-600 border-transparent hover:text-gray-400"
                    )}>{src}</button>
                ))}
              </div>
            </div>

            {/* Article list */}
            {!activeSymbol && (
              <div className="text-center py-12 rounded-2xl" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
                <p className="text-gray-600 text-sm mb-2">Sélectionne un actif pour voir ses actualités</p>
                <p className="text-gray-700 text-xs">Clique sur l'un des actifs ci-dessus</p>
              </div>
            )}

            {activeSymbol && loadingArticles && (
              <div className="space-y-2">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-16 rounded-xl bg-white/[0.03] animate-pulse" />
                ))}
              </div>
            )}

            {activeSymbol && !loadingArticles && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                    {filtered.length} article{filtered.length !== 1 ? "s" : ""} · {activeSymbol.replace("-USD", "")}
                  </h3>
                  <button onClick={() => loadArticles(activeSymbol)}
                    className="flex items-center gap-1 text-[10px] text-gray-600 hover:text-white transition">
                    <RefreshCw size={10} />Actualiser
                  </button>
                </div>
                {filtered.length === 0 ? (
                  <p className="text-center text-gray-700 text-xs py-8">Aucune actualité trouvée</p>
                ) : (
                  <div className="space-y-2">
                    {filtered.map((article, i) => {
                      const ago = Math.round((Date.now() - new Date(article.published_at).getTime()) / 60000)
                      const isReddit = article.source.includes("Reddit")
                      return (
                        <a key={i} href={article.url} target="_blank" rel="noopener noreferrer"
                          className="group flex items-start gap-3 p-3 rounded-xl transition border"
                          style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}
                          onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)")}
                          onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border-subtle)")}>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-300 group-hover:text-white transition leading-snug line-clamp-2">{article.title}</p>
                            <div className="flex items-center gap-2 mt-1.5">
                              <span className={cn("text-[9px] px-1.5 py-0.5 rounded font-semibold",
                                isReddit ? "bg-orange-500/10 text-orange-400" : "bg-blue-500/10 text-blue-400"
                              )}>{article.source}</span>
                              <span className="text-[9px] text-gray-600">
                                {ago < 60 ? `${ago}m` : ago < 1440 ? `${Math.round(ago / 60)}h` : `${Math.round(ago / 1440)}j`}
                              </span>
                              {article.reddit_score != null && article.reddit_score > 0 && (
                                <span className="text-[9px] text-orange-400 font-semibold">↑ {article.reddit_score}</span>
                              )}
                              {article.reddit_comments != null && article.reddit_comments > 0 && (
                                <span className="text-[9px] text-gray-600">💬 {article.reddit_comments}</span>
                              )}
                            </div>
                          </div>
                          <span className="text-gray-700 group-hover:text-gray-300 transition text-sm flex-shrink-0">↗</span>
                        </a>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right: trending + most mentioned */}
          <div className="space-y-4">
            {/* Most active on Reddit */}
            <div className="rounded-2xl p-4" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">🔥 Buzz Reddit 24h</h3>
              <div className="space-y-2">
                {sortedSentiments.slice(0, 8).map((s, i) => {
                  const buzzColor = s.buzz_score >= 60 ? "#f97316" : s.buzz_score >= 30 ? "#facc15" : "#6b7280"
                  return (
                    <button key={s.symbol} onClick={() => selectSymbol(s.symbol)}
                      className="w-full flex items-center gap-3 hover:bg-white/[0.03] rounded-lg px-2 py-1.5 transition">
                      <span className="text-[10px] text-gray-600 w-4">{i + 1}</span>
                      <span className="text-xs font-bold text-white flex-1 text-left">{s.symbol.replace("-USD", "")}</span>
                      <div className="flex items-center gap-1.5">
                        {s.reddit_mentions > 0 && (
                          <span className="text-[9px] text-gray-500">{s.reddit_mentions}m</span>
                        )}
                        <div className="w-16 h-1.5 rounded-full bg-white/5 overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${s.buzz_score}%`, background: buzzColor }} />
                        </div>
                        <span className="text-[9px] font-bold" style={{ color: buzzColor }}>{s.buzz_score}</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Quick links */}
            <div className="rounded-2xl p-4" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Navigation rapide</h3>
              <div className="space-y-1">
                {[
                  { href: "/dashboard", label: "📊 Dashboard" },
                  { href: "/signaux", label: "📡 Signaux IA" },
                  { href: "/analyses", label: "🔬 Analyses" },
                  { href: "/blog", label: "📝 Blog" },
                ].map(link => (
                  <a key={link.href} href={link.href}
                    className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/[0.05] transition text-xs text-gray-400 hover:text-white">
                    {link.label}
                    <span className="text-gray-600">→</span>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
