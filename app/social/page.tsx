"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

// ─── Types ────────────────────────────────────────────────────────────────────

interface FeedItem {
  type: "trade" | "achievement"
  user: string
  symbol?: string
  side?: "buy" | "sell"
  pnl_pct?: number
  achievement?: string
  timestamp: string
}

interface Trader {
  user_id: string
  username: string
  avatar_color?: string
  total_trades: number
  win_rate?: number
  avg_pnl_pct?: number
}

interface PublicTrade {
  id: string
  username: string
  symbol: string
  side: "buy" | "sell"
  pnl_pct?: number
  shared_at: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 2) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

// ─── Podium ───────────────────────────────────────────────────────────────────

function Podium({ traders }: { traders: Trader[] }) {
  if (traders.length < 3) return null

  const POSITIONS = [1, 0, 2]
  const HEIGHTS   = ["h-24", "h-32", "h-20"]
  const MEDALS    = ["🥈", "🥇", "🥉"]
  const RING_COLORS = ["rgba(156,163,175,0.4)", "rgba(250,204,21,0.5)", "rgba(205,124,43,0.4)"]

  return (
    <div className="bg-[#111] border border-white/5 rounded-2xl p-6 mb-6">
      <p className="text-xs text-gray-600 font-semibold uppercase tracking-widest text-center mb-6">
        Top Traders
      </p>
      <div className="flex items-end justify-center gap-6">
        {POSITIONS.map(idx => {
          const t = traders[idx]
          const isGold = idx === 0
          return (
            <div key={t.user_id} className="flex flex-col items-center gap-2">
              <div
                className="rounded-full flex items-center justify-center font-black text-black"
                style={{
                  width: isGold ? 56 : 44,
                  height: isGold ? 56 : 44,
                  backgroundColor: t.avatar_color ?? "#4ade80",
                  boxShadow: `0 0 20px ${RING_COLORS[idx]}`,
                }}
              >
                <span style={{ fontSize: isGold ? 22 : 17 }}>{(t.username ?? "?")[0]?.toUpperCase()}</span>
              </div>
              <p className={`font-bold text-white truncate max-w-[70px] text-center ${isGold ? "text-sm" : "text-xs"}`}>
                {t.username ?? "Anonymous"}
              </p>
              <p className={`font-black text-xs ${(t.avg_pnl_pct ?? 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
                {(t.avg_pnl_pct ?? 0) >= 0 ? "+" : ""}{(t.avg_pnl_pct ?? 0).toFixed(1)}%
              </p>
              <div className={`${HEIGHTS[idx]} w-20 rounded-t-2xl flex items-center justify-center text-2xl ${
                isGold
                  ? "bg-yellow-500/15 border border-yellow-500/25"
                  : idx === 1
                  ? "bg-gray-400/8 border border-gray-400/15"
                  : "bg-orange-600/8 border border-orange-600/15"
              }`}>
                {MEDALS[idx]}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Trader Card ──────────────────────────────────────────────────────────────

function TraderCard({
  trader, rank, isFollowing, isCopying, onFollow, onCopy,
}: {
  trader: Trader
  rank: number
  isFollowing: boolean
  isCopying: boolean
  onFollow: () => void
  onCopy: () => void
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/5 bg-[#111] hover:border-white/10 transition">
      <span className="text-sm font-black text-gray-600 w-6 text-center flex-shrink-0">
        {rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`}
      </span>
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center font-black text-xs text-black flex-shrink-0"
        style={{ backgroundColor: trader.avatar_color ?? "#4ade80" }}
      >
        {(trader.username ?? "?")[0]?.toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white font-bold text-sm truncate">@{trader.username ?? "Anonymous"}</p>
        <p className="text-gray-600 text-xs">{trader.total_trades} trades · {Math.round(trader.win_rate ?? 0)}% WR</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <p className={`text-sm font-black w-14 text-right ${(trader.avg_pnl_pct ?? 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
          {(trader.avg_pnl_pct ?? 0) >= 0 ? "+" : ""}{(trader.avg_pnl_pct ?? 0).toFixed(1)}%
        </p>
        <button
          onClick={onFollow}
          className={`text-xs px-2.5 py-1.5 rounded-lg font-bold transition flex-shrink-0 ${
            isFollowing
              ? "bg-white/8 text-gray-400"
              : "bg-green-500/15 text-green-400 border border-green-500/25 hover:bg-green-500/25"
          }`}
        >
          {isFollowing ? "✓" : "+"}
        </button>
        <button
          onClick={onCopy}
          title={isCopying ? "Stop copying" : "Copy trades"}
          className={`text-xs px-2 py-1.5 rounded-lg font-bold transition flex-shrink-0 ${
            isCopying
              ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
              : "bg-white/5 text-gray-600 border border-white/8 hover:text-blue-400"
          }`}
        >
          📋
        </button>
      </div>
    </div>
  )
}

// ─── Feed Item ────────────────────────────────────────────────────────────────

function FeedCard({ item }: { item: FeedItem }) {
  const isTrade = item.type === "trade"
  const isBuy   = item.side === "buy"
  const hasPnl  = item.pnl_pct != null

  return (
    <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-white/5 bg-[#111]">
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center font-black text-sm flex-shrink-0 mt-0.5"
        style={{ background: isTrade ? (isBuy ? "rgba(74,222,128,0.15)" : "rgba(248,113,113,0.15)") : "rgba(167,139,250,0.15)" }}
      >
        {isTrade ? (isBuy ? "↗" : "↘") : "🏅"}
      </div>
      <div className="flex-1 min-w-0">
        {isTrade ? (
          <p className="text-sm text-white leading-snug">
            <span className="font-bold text-green-400">@{item.user}</span>
            {isBuy ? " bought " : " sold "}
            <span className="font-bold">{item.symbol}</span>
            {hasPnl && (
              <span className={`ml-1 font-black ${(item.pnl_pct ?? 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
                {(item.pnl_pct ?? 0) >= 0 ? "+" : ""}{(item.pnl_pct ?? 0).toFixed(1)}%
              </span>
            )}
          </p>
        ) : (
          <p className="text-sm text-white leading-snug">
            <span className="font-bold text-purple-400">@{item.user}</span>
            {" unlocked "}
            <span className="font-bold">{item.achievement}</span>
          </p>
        )}
        <p className="text-gray-600 text-xs mt-0.5">{timeAgo(item.timestamp)}</p>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type Tab = "leaderboard" | "feed" | "trades"

export default function SocialPage() {
  const router = useRouter()
  const [feed, setFeed]               = useState<FeedItem[]>([])
  const [topTraders, setTopTraders]   = useState<Trader[]>([])
  const [publicTrades, setPublicTrades] = useState<PublicTrade[]>([])
  const [activeTab, setActiveTab]     = useState<Tab>("leaderboard")
  const [loading, setLoading]         = useState(true)
  const [followStatus, setFollowStatus] = useState<Record<string, boolean>>({})
  const [copying, setCopying]         = useState<Set<string>>(new Set())
  const [userId, setUserId]           = useState<string | null>(null)

  useEffect(() => {
    async function init() {
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData.session) { router.replace("/login"); return }

      const token = sessionData.session.access_token
      setUserId(sessionData.session.user.id)

      try {
        const [feedRes, topRes, tradesRes] = await Promise.all([
          fetch("/api/social/feed", { headers: { Authorization: `Bearer ${token}` } }),
          fetch("/api/social/top-traders"),
          fetch("/api/social/public-trades"),
        ])

        if (feedRes.ok) {
          const d = await feedRes.json()
          setFeed(d?.items ?? d ?? [])
        }
        if (topRes.ok) {
          const d = await topRes.json()
          setTopTraders(d?.traders ?? d ?? [])
        }
        if (tradesRes.ok) {
          const d = await tradesRes.json()
          setPublicTrades(d?.trades ?? d ?? [])
        }

        const { data: follows } = await supabase
          .from("follows").select("following_id").eq("follower_id", sessionData.session.user.id)
        if (follows) {
          const map: Record<string, boolean> = {}
          follows.forEach((f: any) => { map[f.following_id] = true })
          setFollowStatus(map)
        }
      } catch {}

      setLoading(false)
    }
    init()
  }, [router])

  async function handleFollow(traderId: string) {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) return
    const isFollowing = followStatus[traderId]
    await fetch("/api/social/follow", {
      method: isFollowing ? "DELETE" : "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: isFollowing ? undefined : JSON.stringify({ following_id: traderId }),
    })
    setFollowStatus(prev => ({ ...prev, [traderId]: !prev[traderId] }))
  }

  async function toggleCopy(traderId: string) {
    const { data } = await supabase.auth.getSession()
    if (!data.session) return
    const isCopying = copying.has(traderId)
    if (isCopying) {
      await supabase.from("social_follows")
        .update({ copy_trades: false })
        .eq("follower_id", data.session.user.id)
        .eq("following_id", traderId)
    } else {
      await supabase.from("social_follows").upsert({
        follower_id: data.session.user.id,
        following_id: traderId,
        copy_trades: true,
        copy_amount_pct: 10,
      }, { onConflict: "follower_id,following_id" })
    }
    setCopying(prev => {
      const next = new Set(prev)
      if (isCopying) next.delete(traderId); else next.add(traderId)
      return next
    })
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "leaderboard", label: "🏆 Leaderboard" },
    { key: "feed",        label: "📰 Feed"         },
    { key: "trades",      label: "📊 Trades"       },
  ]

  return (
    <div className="min-h-screen text-white overflow-x-hidden" style={{ background: "transparent" }}>
      <div className="max-w-2xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-black text-white">Social Trading</h1>
          <p className="text-gray-500 text-sm mt-1">Follow top traders and copy their strategies</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-[#111] border border-white/5 rounded-xl p-1 mb-6">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex-1 whitespace-nowrap py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === t.key ? "bg-green-500/15 text-green-400" : "text-gray-500 hover:text-white"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(n => (
              <div key={n} className="h-16 rounded-xl animate-pulse" style={{ background: "#111" }} />
            ))}
          </div>
        ) : (
          <>
            {/* Leaderboard */}
            {activeTab === "leaderboard" && (
              <div className="space-y-3">
                <Podium traders={topTraders} />
                {topTraders.length === 0 ? (
                  <div className="text-center py-16 text-gray-600">
                    <p className="text-4xl mb-3">🏆</p>
                    <p className="font-bold">No traders ranked yet</p>
                  </div>
                ) : (
                  topTraders.slice(3).map((t, i) => (
                    <TraderCard
                      key={t.user_id}
                      trader={t}
                      rank={i + 4}
                      isFollowing={!!followStatus[t.user_id]}
                      isCopying={copying.has(t.user_id)}
                      onFollow={() => handleFollow(t.user_id)}
                      onCopy={() => toggleCopy(t.user_id)}
                    />
                  ))
                )}
                {/* Top 3 listed below podium too */}
                {topTraders.length > 0 && (
                  <div className="space-y-3">
                    {topTraders.slice(0, 3).map((t, i) => (
                      <TraderCard
                        key={t.user_id + "_list"}
                        trader={t}
                        rank={i + 1}
                        isFollowing={!!followStatus[t.user_id]}
                        isCopying={copying.has(t.user_id)}
                        onFollow={() => handleFollow(t.user_id)}
                        onCopy={() => toggleCopy(t.user_id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Feed */}
            {activeTab === "feed" && (
              <div className="space-y-3">
                {feed.length === 0 ? (
                  <div className="text-center py-16 text-gray-600">
                    <p className="text-4xl mb-3">👥</p>
                    <p className="font-bold text-white">Follow traders to see their activity</p>
                    <p className="text-sm mt-1">Go to the leaderboard and click +</p>
                    <button
                      onClick={() => setActiveTab("leaderboard")}
                      className="mt-4 px-4 py-2 rounded-xl bg-green-500/15 text-green-400 border border-green-500/25 text-sm font-semibold hover:bg-green-500/25 transition"
                    >
                      View leaderboard →
                    </button>
                  </div>
                ) : (
                  feed.map((item, i) => <FeedCard key={i} item={item} />)
                )}
              </div>
            )}

            {/* Public Trades */}
            {activeTab === "trades" && (
              <div className="space-y-3">
                {publicTrades.length === 0 ? (
                  <div className="text-center py-16 text-gray-600">
                    <p className="text-4xl mb-3">📊</p>
                    <p className="font-bold">No public trades shared</p>
                  </div>
                ) : (
                  publicTrades.map(trade => (
                    <div
                      key={trade.id}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/5 bg-[#111]"
                    >
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center font-black flex-shrink-0 ${
                          trade.side === "buy" ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"
                        }`}
                      >
                        {trade.side === "buy" ? "↗" : "↘"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-bold text-sm">{trade.symbol}</p>
                        <p className="text-gray-600 text-xs">@{trade.username} · {timeAgo(trade.shared_at)}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        {trade.pnl_pct != null && (
                          <p className={`font-black text-sm ${trade.pnl_pct >= 0 ? "text-green-400" : "text-red-400"}`}>
                            {trade.pnl_pct >= 0 ? "+" : ""}{trade.pnl_pct.toFixed(1)}%
                          </p>
                        )}
                        <a
                          href={`/traders/${trade.username}`}
                          className="text-[10px] text-blue-400 hover:text-blue-300 font-semibold"
                        >
                          Profile →
                        </a>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
