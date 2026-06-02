"use client"

import { use, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserProfile {
  id: string
  username: string
  avatar_color?: string
  xp?: number
  level_name?: string
}

interface PublicTrade {
  id: string
  symbol: string
  side: "buy" | "sell"
  pnl_pct?: number
  shared_at: string
}

interface UserAchievement {
  achievement_id: string
  unlocked_at: string
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

function computeStats(trades: PublicTrade[]) {
  if (!trades.length) return { total: 0, winRate: 0, avgReturn: 0 }
  const wins = trades.filter((t) => (t.pnl_pct ?? 0) > 0).length
  const avg =
    trades.reduce((sum, t) => sum + (t.pnl_pct ?? 0), 0) / trades.length
  return {
    total: trades.length,
    winRate: Math.round((wins / trades.length) * 100),
    avgReturn: avg,
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TraderProfile({
  params,
}: {
  params: Promise<{ username: string }>
}) {
  const { username } = use(params)
  const router = useRouter()

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [trades, setTrades] = useState<PublicTrade[]>([])
  const [achievements, setAchievements] = useState<UserAchievement[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [followStatus, setFollowStatus] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data: sessionData } = await supabase.auth.getSession()
      setCurrentUserId(sessionData.session?.user.id ?? null)

      const { data: profileData } = await supabase
        .from("user_profiles")
        .select("id, username, avatar_color, xp, level_name")
        .eq("username", username)
        .single()

      if (!profileData) {
        setNotFound(true)
        setLoading(false)
        return
      }

      setProfile(profileData)

      const [tradesRes, achievementsRes] = await Promise.all([
        supabase
          .from("public_trades")
          .select("*")
          .eq("username", username)
          .order("shared_at", { ascending: false })
          .limit(20),
        supabase
          .from("user_achievements")
          .select("achievement_id, unlocked_at")
          .eq("user_id", profileData.id)
          .order("unlocked_at", { ascending: false })
          .limit(12),
      ])

      setTrades(tradesRes.data ?? [])
      setAchievements(achievementsRes.data ?? [])

      // Check follow status
      if (sessionData.session?.user.id) {
        const { data: followData } = await supabase
          .from("follows")
          .select("id")
          .eq("follower_id", sessionData.session.user.id)
          .eq("following_id", profileData.id)
          .maybeSingle()
        setFollowStatus(!!followData)
      }

      setLoading(false)
    }

    load()
  }, [username])

  async function handleFollow() {
    if (!profile) return
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) {
      router.push("/login")
      return
    }

    await fetch("/api/social/follow", {
      method: followStatus ? "DELETE" : "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: followStatus ? undefined : JSON.stringify({ following_id: profile.id }),
    })

    setFollowStatus((prev) => !prev)
  }

  const stats = computeStats(trades)

  // Skeleton
  if (loading) {
    return (
      <div className="min-h-screen text-white" style={{ background: "var(--bg-canvas)" }}>
        <div className="max-w-3xl mx-auto px-4 md:px-6 py-10 space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full animate-pulse" style={{ background: "#1a1a1a" }} />
            <div className="space-y-2 flex-1">
              <div className="h-6 w-40 rounded animate-pulse" style={{ background: "#1a1a1a" }} />
              <div className="h-4 w-24 rounded animate-pulse" style={{ background: "#1a1a1a" }} />
            </div>
          </div>
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="h-16 rounded-xl animate-pulse"
              style={{ background: "#0d0d0d" }}
            />
          ))}
        </div>
      </div>
    )
  }

  if (notFound || !profile) {
    return (
      <div className="min-h-screen text-white flex items-center justify-center" style={{ background: "var(--bg-canvas)" }}>
        <div className="text-center">
          <p className="text-5xl mb-4">🔍</p>
          <p className="text-xl font-black text-white">Trader introuvable</p>
          <p className="text-gray-500 mt-2">Le profil @{username} n&apos;existe pas</p>
          <button
            onClick={() => router.back()}
            className="mt-6 px-5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-sm font-bold transition"
          >
            ← Retour
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen text-white overflow-x-hidden" style={{ background: "var(--bg-canvas)" }}>
      <div className="max-w-3xl mx-auto px-4 md:px-6 py-8 space-y-8">

        {/* ── Header ── */}
        <div className="flex items-start gap-5">
          {/* Avatar */}
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center font-black text-3xl flex-shrink-0"
            style={{ background: profile.avatar_color ?? "#4ade8033" }}
          >
            {profile.username?.[0]?.toUpperCase() ?? "?"}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 pt-1">
            <h1 className="text-2xl font-black text-white">@{profile.username}</h1>
            {profile.level_name && (
              <p className="text-green-400 text-sm font-bold mt-0.5">{profile.level_name}</p>
            )}
            {profile.xp != null && (
              <p className="text-gray-500 text-xs mt-0.5">{profile.xp.toLocaleString()} XP</p>
            )}
          </div>

          {/* Follow button */}
          {currentUserId && currentUserId !== profile.id && (
            <button
              onClick={handleFollow}
              className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-bold transition ${
                followStatus
                  ? "bg-white/10 text-gray-400 hover:bg-white/15"
                  : "bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30"
              }`}
            >
              {followStatus ? "Suivi ✓" : "Suivre"}
            </button>
          )}
        </div>

        {/* ── Stats row ── */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Trades", value: stats.total.toString() },
            { label: "Win Rate", value: `${stats.winRate}%` },
            {
              label: "Avg Return",
              value: `${stats.avgReturn >= 0 ? "+" : ""}${stats.avgReturn.toFixed(1)}%`,
              color: stats.avgReturn >= 0 ? "text-green-400" : "text-red-400",
            },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-xl p-4 text-center"
              style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}
            >
              <p className={`text-xl font-black ${s.color ?? "text-white"}`}>{s.value}</p>
              <p className="text-gray-600 text-xs mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* ── Achievements ── */}
        {achievements.length > 0 && (
          <div>
            <h2 className="text-lg font-black mb-3">🏅 Achievements</h2>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
              {achievements.map((a) => (
                <div
                  key={a.achievement_id}
                  className="rounded-xl p-3 flex flex-col items-center gap-1 text-center"
                  style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}
                  title={timeAgo(a.unlocked_at)}
                >
                  <span className="text-xl">{a.achievement_id}</span>
                  <p className="text-[10px] text-gray-500 leading-tight truncate w-full">
                    {a.achievement_id}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Trade History ── */}
        <div>
          <h2 className="text-lg font-black mb-3">📊 Trades partagés</h2>
          {trades.length === 0 ? (
            <div
              className="rounded-xl p-8 text-center"
              style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}
            >
              <p className="text-gray-600 text-sm">Aucun trade partagé</p>
            </div>
          ) : (
            <div className="space-y-2">
              {trades.map((trade) => (
                <div
                  key={trade.id}
                  className="rounded-xl px-4 py-3 flex items-center gap-3"
                  style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}
                >
                  {/* Side icon */}
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black flex-shrink-0 ${
                      trade.side === "buy"
                        ? "bg-green-500/20 text-green-400"
                        : "bg-red-500/20 text-red-400"
                    }`}
                  >
                    {trade.side === "buy" ? "↗" : "↘"}
                  </div>

                  {/* Symbol */}
                  <p className="text-white font-black text-sm flex-1">{trade.symbol}</p>

                  {/* PnL */}
                  {trade.pnl_pct != null && (
                    <p
                      className={`font-black text-sm flex-shrink-0 ${
                        trade.pnl_pct >= 0 ? "text-green-400" : "text-red-400"
                      }`}
                    >
                      {trade.pnl_pct >= 0 ? "+" : ""}
                      {trade.pnl_pct.toFixed(1)}%
                    </p>
                  )}

                  {/* Date */}
                  <p className="text-gray-600 text-xs flex-shrink-0 ml-2">
                    {timeAgo(trade.shared_at)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
