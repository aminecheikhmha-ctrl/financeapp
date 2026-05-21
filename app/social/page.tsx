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
  if (mins < 2) return "à l'instant"
  if (mins < 60) return `il y a ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `il y a ${hours}h`
  return `il y a ${Math.floor(hours / 24)}j`
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SocialPage() {
  const router = useRouter()
  const [feed, setFeed] = useState<FeedItem[]>([])
  const [topTraders, setTopTraders] = useState<Trader[]>([])
  const [publicTrades, setPublicTrades] = useState<PublicTrade[]>([])
  const [activeTab, setActiveTab] = useState<"feed" | "top" | "trades">("feed")
  const [loading, setLoading] = useState(true)
  const [followStatus, setFollowStatus] = useState<Record<string, boolean>>({})

  useEffect(() => {
    async function init() {
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData.session) {
        router.replace("/login")
        return
      }
      const token = sessionData.session.access_token

      try {
        const [feedRes, topRes, tradesRes] = await Promise.all([
          fetch("/api/social/feed", { headers: { Authorization: `Bearer ${token}` } }),
          fetch("/api/social/top-traders"),
          fetch("/api/social/public-trades"),
        ])

        if (feedRes.ok) {
          const feedData = await feedRes.json()
          setFeed(feedData?.items ?? feedData ?? [])
        }
        if (topRes.ok) {
          const topData = await topRes.json()
          setTopTraders(topData?.traders ?? topData ?? [])
        }
        if (tradesRes.ok) {
          const tradesData = await tradesRes.json()
          setPublicTrades(tradesData?.trades ?? tradesData ?? [])
        }

        // Load follow statuses
        const { data: follows } = await supabase
          .from("follows")
          .select("following_id")
          .eq("follower_id", sessionData.session.user.id)

        if (follows) {
          const map: Record<string, boolean> = {}
          follows.forEach((f) => { map[f.following_id] = true })
          setFollowStatus(map)
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [router])

  async function handleFollow(userId: string) {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) return

    const isFollowing = followStatus[userId]

    await fetch("/api/social/follow", {
      method: isFollowing ? "DELETE" : "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: isFollowing ? undefined : JSON.stringify({ following_id: userId }),
    })

    setFollowStatus((prev) => ({ ...prev, [userId]: !prev[userId] }))
  }

  const tabs: { key: "feed" | "top" | "trades"; label: string }[] = [
    { key: "feed", label: "📰 Feed" },
    { key: "top", label: "🏆 Top Traders" },
    { key: "trades", label: "📊 Trades Publics" },
  ]

  return (
    <div className="min-h-screen text-white overflow-x-hidden" style={{ background: "#080808" }}>
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl md:text-3xl font-black">👥 Social Trading</h1>
          <p className="text-gray-500 text-sm mt-1">
            Suis les meilleurs traders et copie leurs stratégies
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                activeTab === tab.key
                  ? "bg-green-500/20 text-green-400 border border-green-500/30"
                  : "text-gray-500 hover:text-gray-300 border border-transparent hover:border-white/10"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((n) => (
              <div
                key={n}
                className="h-16 rounded-xl animate-pulse"
                style={{ background: "#0d0d0d" }}
              />
            ))}
          </div>
        ) : (
          <>
            {/* ── Feed Tab ── */}
            {activeTab === "feed" && (
              <div className="space-y-3">
                {feed.length === 0 ? (
                  <div className="text-center py-16 text-gray-600">
                    <p className="text-4xl mb-3">👥</p>
                    <p className="font-bold">Suis des traders pour voir leur activité ici</p>
                    <p className="text-sm mt-1">
                      Explore les Top Traders et commence à les suivre
                    </p>
                  </div>
                ) : (
                  feed.map((item, i) => (
                    <div
                      key={i}
                      className="rounded-xl p-4 flex items-start gap-3"
                      style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}
                    >
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center font-black text-sm flex-shrink-0"
                        style={{ background: "#4ade8033" }}
                      >
                        {item.user?.[0]?.toUpperCase() ?? "?"}
                      </div>
                      <div className="flex-1 min-w-0">
                        {item.type === "trade" ? (
                          <p className="text-white text-sm">
                            <span className="font-black text-green-400">@{item.user}</span>
                            {item.side === "buy" ? " a acheté " : " a vendu "}
                            <span className="font-black">{item.symbol}</span>
                            {item.pnl_pct != null && (
                              <span
                                className={`ml-1 font-black ${
                                  item.pnl_pct >= 0 ? "text-green-400" : "text-red-400"
                                }`}
                              >
                                {item.pnl_pct >= 0 ? "+" : ""}
                                {item.pnl_pct?.toFixed(1)}%
                              </span>
                            )}
                          </p>
                        ) : (
                          <p className="text-white text-sm">
                            <span className="font-black text-purple-400">@{item.user}</span>
                            {" a débloqué "}
                            <span className="font-black">{item.achievement}</span>
                          </p>
                        )}
                        <p className="text-gray-600 text-xs mt-0.5">{timeAgo(item.timestamp)}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* ── Top Traders Tab ── */}
            {activeTab === "top" && (
              <div className="space-y-3">
                {topTraders.length === 0 ? (
                  <div className="text-center py-16 text-gray-600">
                    <p className="text-4xl mb-3">🏆</p>
                    <p className="font-bold">Aucun trader classé pour le moment</p>
                  </div>
                ) : (
                  topTraders.map((trader, i) => (
                    <div
                      key={trader.user_id}
                      className="rounded-xl p-4 flex items-center gap-3"
                      style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}
                    >
                      {/* Rank */}
                      <span
                        className="text-lg font-black w-6 text-center flex-shrink-0"
                        style={{
                          color:
                            i === 0
                              ? "#facc15"
                              : i === 1
                              ? "#9ca3af"
                              : i === 2
                              ? "#cd7c2b"
                              : "#444",
                        }}
                      >
                        {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                      </span>

                      {/* Avatar */}
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center font-black text-sm flex-shrink-0"
                        style={{ background: trader.avatar_color ?? "#4ade8033" }}
                      >
                        {trader.username?.[0]?.toUpperCase() ?? "?"}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-black text-sm truncate">
                          @{trader.username ?? "anonymous"}
                        </p>
                        <p className="text-gray-500 text-xs">
                          {trader.total_trades} trades ·{" "}
                          {trader.win_rate?.toFixed(0) ?? "0"}% win rate
                        </p>
                      </div>

                      {/* Return + Follow */}
                      <div className="text-right flex-shrink-0">
                        <p
                          className={`font-black text-lg ${
                            (trader.avg_pnl_pct ?? 0) >= 0 ? "text-green-400" : "text-red-400"
                          }`}
                        >
                          {(trader.avg_pnl_pct ?? 0) >= 0 ? "+" : ""}
                          {(trader.avg_pnl_pct ?? 0).toFixed(1)}%
                        </p>
                        <button
                          onClick={() => handleFollow(trader.user_id)}
                          className={`text-xs px-3 py-1 rounded-lg font-bold transition mt-1 ${
                            followStatus[trader.user_id]
                              ? "bg-white/10 text-gray-400"
                              : "bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30"
                          }`}
                        >
                          {followStatus[trader.user_id] ? "Suivi ✓" : "Suivre"}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* ── Public Trades Tab ── */}
            {activeTab === "trades" && (
              <div className="space-y-3">
                {publicTrades.length === 0 ? (
                  <div className="text-center py-16 text-gray-600">
                    <p className="text-4xl mb-3">📊</p>
                    <p className="font-bold">Aucun trade public partagé pour le moment</p>
                  </div>
                ) : (
                  publicTrades.map((trade) => (
                    <div
                      key={trade.id}
                      className="rounded-xl p-4 flex items-center gap-3"
                      style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}
                    >
                      {/* Side badge */}
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-black flex-shrink-0 ${
                          trade.side === "buy"
                            ? "bg-green-500/20 text-green-400"
                            : "bg-red-500/20 text-red-400"
                        }`}
                      >
                        {trade.side === "buy" ? "↗" : "↘"}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-black text-sm">{trade.symbol}</p>
                        <p className="text-gray-500 text-xs">
                          @{trade.username} · {timeAgo(trade.shared_at)}
                        </p>
                      </div>

                      {/* PnL + link */}
                      <div className="text-right flex-shrink-0 space-y-1">
                        {trade.pnl_pct != null && (
                          <p
                            className={`font-black text-sm ${
                              trade.pnl_pct >= 0 ? "text-green-400" : "text-red-400"
                            }`}
                          >
                            {trade.pnl_pct >= 0 ? "+" : ""}
                            {trade.pnl_pct.toFixed(1)}%
                          </p>
                        )}
                        <a
                          href={`/traders/${trade.username}`}
                          className="text-[10px] text-blue-400 hover:text-blue-300 font-bold block"
                        >
                          Voir le profil →
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
