"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { useLanguage } from "@/lib/i18n/context"
import {
  ACHIEVEMENTS, RARITY_COLORS, getLevelInfo, XP_LEVELS,
  type AchievementCategory, type Rarity,
} from "@/lib/achievements"
import AvatarUpload from "@/app/components/AvatarUpload"

// ── FIFO trading stats ─────────────────────────────────────────────────────────

type Order = {
  symbol: string; side: string; qty: number; price: number;
  total: number; created_at: string; status?: string
}

type ClosedTrade = {
  symbol: string; buy_price: number; sell_price: number;
  qty: number; pnl: number; pnl_pct: number;
  opened_at: string; closed_at: string;
}

function computeTradingStats(orders: Order[]) {
  const filled = orders.filter(o => !o.status || o.status === "filled")
  const sorted = [...filled].sort((a, b) =>
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )
  const queue: Record<string, Array<{ price: number; qty: number; date: string }>> = {}
  const closedTrades: ClosedTrade[] = []

  for (const order of sorted) {
    const sym = order.symbol
    if (order.side === "buy") {
      if (!queue[sym]) queue[sym] = []
      queue[sym].push({ price: order.price, qty: order.qty, date: order.created_at })
    } else if (order.side === "sell") {
      let remaining = order.qty
      while (remaining > 0 && queue[sym]?.length > 0) {
        const buy = queue[sym][0]
        const matched = Math.min(remaining, buy.qty)
        closedTrades.push({
          symbol: sym, buy_price: buy.price, sell_price: order.price,
          qty: matched,
          pnl: parseFloat(((order.price - buy.price) * matched).toFixed(2)),
          pnl_pct: parseFloat((((order.price - buy.price) / buy.price) * 100).toFixed(2)),
          opened_at: buy.date, closed_at: order.created_at,
        })
        buy.qty -= matched; remaining -= matched
        if (buy.qty <= 0) queue[sym].shift()
      }
    }
  }

  const wins   = closedTrades.filter(t => t.pnl > 0)
  const losses = closedTrades.filter(t => t.pnl < 0)
  const totalPnl   = closedTrades.reduce((s, t) => s + t.pnl, 0)
  const winRate    = closedTrades.length > 0 ? (wins.length / closedTrades.length) * 100 : 0
  const avgWin     = wins.length   > 0 ? wins.reduce((s, t)   => s + t.pnl, 0) / wins.length   : 0
  const avgLoss    = losses.length > 0 ? Math.abs(losses.reduce((s, t) => s + t.pnl, 0) / losses.length) : 0
  const rrRatio    = avgLoss > 0 ? avgWin / avgLoss : 0
  const totalVolume = filled.filter(o => o.side === "buy").reduce((s, o) => s + o.total, 0)
  const bestTrade  = closedTrades.length > 0
    ? closedTrades.reduce((b, t) => t.pnl > b.pnl ? t : b, closedTrades[0]) : null
  const worstTrade = closedTrades.length > 0
    ? closedTrades.reduce((b, t) => t.pnl < b.pnl ? t : b, closedTrades[0]) : null
  const profitFactor = losses.length > 0
    ? wins.reduce((s, t) => s + t.pnl, 0) / Math.abs(losses.reduce((s, t) => s + t.pnl, 0))
    : wins.length > 0 ? Infinity : 0

  return {
    closedTrades, wins, losses, totalPnl, winRate, avgWin, avgLoss,
    rrRatio, totalVolume, bestTrade, worstTrade, profitFactor,
    totalBuys: filled.filter(o => o.side === "buy").length,
  }
}

// ── Hero banner gradient per level ────────────────────────────────────────────

const BANNER_GRADIENTS: Record<number, string> = {
  1: "linear-gradient(135deg, #0f1117 0%, #16213e 60%, #0f3460 100%)",
  2: "linear-gradient(135deg, #071a0f 0%, #0d3320 60%, #0a2d16 100%)",
  3: "linear-gradient(135deg, #071828 0%, #0d2550 60%, #081940 100%)",
  4: "linear-gradient(135deg, #120a28 0%, #2a1a50 60%, #1a0f40 100%)",
  5: "linear-gradient(135deg, #1e1000 0%, #3d2000 60%, #2d1800 100%)",
  6: "linear-gradient(135deg, #1e1a00 0%, #3d3400 60%, #2d2800 100%)",
}

// ── Category tabs ──────────────────────────────────────────────────────────────

const CATEGORY_TABS: { key: AchievementCategory | "all"; label: string }[] = [
  { key: "all",       label: "Tous"      },
  { key: "trading",   label: "Trading"   },
  { key: "learning",  label: "Formation" },
  { key: "community", label: "Forum"     },
  { key: "social",    label: "Social"    },
  { key: "streak",    label: "Consistency" },
]

// ── Referral ──────────────────────────────────────────────────────────────────

function ReferralSection() {
  const [ref, setRef] = useState<{ code: string; url: string; stats: { total: number; converted: number } } | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const token = data.session?.access_token
      if (!token) return
      fetch("/api/referral", { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json()).then(setRef).catch(() => {})
    })
  }, [])

  if (!ref) return <p className="text-gray-600 text-xs">Chargement...</p>

  function copy() {
    navigator.clipboard.writeText(ref!.url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <div className="flex-1 bg-[#0a0a0a] border border-white/10 rounded-xl px-3 py-2.5 text-green-400 font-mono text-sm truncate">
          {ref.url}
        </div>
        <button onClick={copy} className="px-3 py-2.5 rounded-xl bg-green-500 hover:bg-green-400 text-black font-bold text-xs transition flex-shrink-0">
          {copied ? "✓ Copied" : "Copy"}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white/3 border border-white/5 rounded-xl p-3 text-center">
          <p className="text-2xl font-black text-white">{ref.stats.total}</p>
          <p className="text-gray-500 text-xs mt-0.5">Parrainés</p>
        </div>
        <div className="bg-white/3 border border-white/5 rounded-xl p-3 text-center">
          <p className="text-2xl font-black text-green-400">{ref.stats.converted}</p>
          <p className="text-gray-500 text-xs mt-0.5">Convertis</p>
        </div>
      </div>
    </div>
  )
}

// ── Achievements grid ──────────────────────────────────────────────────────────

function AchievementsGrid({ unlockedIds }: { unlockedIds: string[] }) {
  const [catFilter,    setCatFilter]    = useState<AchievementCategory | "all">("all")
  const [rarityFilter, setRarityFilter] = useState<Rarity | "all">("all")

  const filtered = ACHIEVEMENTS.filter(a => {
    if (catFilter    !== "all" && a.category !== catFilter)    return false
    if (rarityFilter !== "all" && a.rarity   !== rarityFilter) return false
    return true
  })

  const unlocked = filtered.filter(a =>  unlockedIds.includes(a.id))
  const locked   = filtered.filter(a => !unlockedIds.includes(a.id))

  return (
    <div>
      {/* Category tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-2 mb-3 no-scrollbar">
        {CATEGORY_TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setCatFilter(t.key)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition ${
              catFilter === t.key
                ? "bg-green-500/20 text-green-400 border border-green-500/30"
                : "bg-white/5 text-gray-500 hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Rarity filter */}
      <div className="flex gap-1.5 overflow-x-auto pb-3 mb-4 no-scrollbar">
        {(["all", "common", "rare", "epic", "legendary"] as const).map(r => {
          const c = r === "all" ? null : RARITY_COLORS[r]
          return (
            <button
              key={r}
              onClick={() => setRarityFilter(r)}
              className={`flex-shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold transition border ${
                rarityFilter === r ? "opacity-100" : "opacity-40 hover:opacity-70"
              }`}
              style={c
                ? { color: c.hex, borderColor: `${c.hex}40`, background: `${c.hex}10` }
                : { color: "#9ca3af", borderColor: "rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)" }
              }
            >
              {r === "all" ? "Tous" : RARITY_COLORS[r].label}
            </button>
          )
        })}
      </div>

      {/* Progress */}
      <div className="flex items-center gap-3 mb-4">
        <p className="text-xs text-gray-500">
          <span className="text-white font-bold">{unlockedIds.length}</span>
          <span className="text-gray-600"> / {ACHIEVEMENTS.length} débloqués</span>
        </p>
        <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 rounded-full transition-all"
            style={{ width: `${(unlockedIds.length / ACHIEVEMENTS.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {unlocked.map(a => {
          const c = RARITY_COLORS[a.rarity]
          return (
            <div
              key={a.id}
              className="relative rounded-xl p-3 border transition"
              style={{ background: `${c.hex}08`, borderColor: `${c.hex}30` }}
            >
              <div className="flex items-start justify-between mb-2">
                <span className="text-2xl">{a.icon}</span>
                <span
                  className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ background: `${c.hex}18`, color: c.hex, border: `1px solid ${c.hex}30` }}
                >
                  {c.label}
                </span>
              </div>
              <p className="text-white text-xs font-bold leading-tight">{a.title}</p>
              <p className="text-gray-500 text-[10px] mt-0.5 leading-tight">{a.description}</p>
              <p className="text-yellow-400 text-[10px] font-bold mt-1.5">+{a.xp} XP</p>
            </div>
          )
        })}

        {locked.map(a => (
          <div
            key={a.id}
            className="relative rounded-xl p-3 border border-white/5 bg-white/2 opacity-40"
          >
            <div className="flex items-start justify-between mb-2">
              <span className="text-2xl grayscale">{a.icon}</span>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-white/5 text-gray-600">🔒</span>
            </div>
            <p className="text-gray-500 text-xs font-bold leading-tight">{a.title}</p>
            <p className="text-gray-700 text-[10px] mt-0.5 leading-tight">{a.description}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Stat card ──────────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, color,
}: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="bg-white/3 border border-white/6 rounded-2xl p-4">
      <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-wide mb-1">{label}</p>
      <p className="font-black text-xl leading-tight" style={{ color: color ?? "#fff" }}>{value}</p>
      {sub && <p className="text-gray-600 text-[10px] mt-0.5">{sub}</p>}
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────

type Tab = "trading" | "achievements" | "classement"

export default function ProfilPage() {
  const router = useRouter()
  const { t } = useLanguage()
  const [user, setUser]               = useState<any>(null)
  const [profile, setProfile]         = useState<any>(null)
  const [account, setAccount]         = useState<{ cash: number } | null>(null)
  const [rawOrders, setRawOrders]     = useState<Order[]>([])
  const [completedCourses, setCompletedCourses] = useState<any[]>([])
  const [unlockedIds, setUnlockedIds] = useState<string[]>([])
  const [leaderboard, setLeaderboard] = useState<any[]>([])
  const [loading, setLoading]         = useState(true)
  const [avatarUrl, setAvatarUrl]     = useState<string | null>(null)
  const [tab, setTab]                 = useState<Tab>("trading")
  const [myRank, setMyRank]           = useState<number | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push("/login"); return }
      const u     = session.user
      const token = session.access_token
      setUser(u)

      const [profileRes, accRes] = await Promise.allSettled([
        fetch("/api/user-profile",    { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
        fetch("/api/trading/account", { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      ])

      if (profileRes.status === "fulfilled") {
        const p = profileRes.value?.profile ?? null
        setProfile(p)
        if (p?.avatar_url) setAvatarUrl(p.avatar_url)
      }
      if (accRes.status === "fulfilled") {
        setAccount(accRes.value?.account ?? null)
        setRawOrders(Array.isArray(accRes.value?.orders) ? accRes.value.orders : [])
      }
      setLoading(false)

      // Background
      fetch("/api/streak", { method: "POST", headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(s => { if (s?.streak_days != null) setProfile((prev: any) => prev ? { ...prev, streak_days: s.streak_days } : prev) })
        .catch(() => {})

      supabase.from("user_progress").select("*").eq("user_id", u.id).eq("completed", true)
        .then(({ data }) => setCompletedCourses(data ?? []))

      fetch("/api/achievements/check", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ context: "profile_load" }),
      }).catch(() => {}).finally(() => {
        fetch("/api/achievements", { headers: { Authorization: `Bearer ${token}` } })
          .then(r => r.json())
          .then(j => setUnlockedIds((j.achievements ?? []).filter((a: any) => a.unlocked).map((a: any) => a.id)))
          .catch(() => {})
      })

      fetch("/api/social/top-traders")
        .then(r => r.json())
        .then(traders => {
          if (Array.isArray(traders)) {
            setLeaderboard(traders)
            const idx = traders.findIndex((t: any) => t.user_id === u.id)
            setMyRank(idx >= 0 ? idx + 1 : null)
          }
        }).catch(() => {})
    }
    load()
  }, [])

  const xp         = profile?.xp ?? 0
  const levelInfo  = getLevelInfo(xp)
  const initial    = (profile?.username ?? user?.email ?? "?")[0]?.toUpperCase()
  const avatarBg   = profile?.avatar_color ?? "#4ade80"
  const username   = profile?.username ?? user?.email?.split("@")[0] ?? "Trader"

  const stats      = computeTradingStats(rawOrders)
  const portfolioValue = (account?.cash ?? 0) + 0  // positions not loaded here, but cash is known
  // We can at least show cash + rough value; the portfolio page has full value
  const totalPortfolio = account
    ? account.cash + stats.closedTrades.reduce((s, t) => s + t.pnl, 0) /* rough estimate from unrealized */
    : 0

  const tabs: { key: Tab; label: string }[] = [
    { key: "trading",      label: `📊 ${t.profile.tabs.stats}`         },
    { key: "achievements", label: `🏅 ${t.profile.tabs.achievements}`  },
    { key: "classement",   label: `🏆 ${t.profile.tabs.leaderboard}`   },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0a0a0a]">
        <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const bannerGradient = BANNER_GRADIENTS[levelInfo.level] ?? BANNER_GRADIENTS[1]

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white pb-20 overflow-x-hidden">

      {/* ── Hero Banner ── */}
      <div className="relative" style={{ background: bannerGradient }}>
        {/* Level color glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: `radial-gradient(ellipse 80% 60% at 50% 100%, ${levelInfo.color}22, transparent)` }}
        />

        {/* Settings gear top-right */}
        <div className="absolute top-4 right-4 z-10">
          <a
            href="/parametres"
            className="flex items-center justify-center w-8 h-8 rounded-full text-sm transition"
            style={{ background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            ⚙️
          </a>
        </div>

        <div className="max-w-2xl mx-auto px-4 pt-12 pb-6 flex flex-col items-center text-center">
          {/* Avatar with level badge */}
          <div className="relative mb-4">
            <div
              className="rounded-full p-0.5"
              style={{ background: `linear-gradient(135deg, ${levelInfo.color}, ${levelInfo.color}66)` }}
            >
              <AvatarUpload
                currentUrl={avatarUrl}
                avatarColor={avatarBg}
                initial={initial}
                levelColor={levelInfo.color}
                levelIcon={levelInfo.icon}
                size="lg"
                onUploaded={url => setAvatarUrl(url)}
                onRemoved={() => setAvatarUrl(null)}
              />
            </div>
            {/* Level badge */}
            <div
              className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center text-xs font-black border-2 border-[#0a0a0a]"
              style={{ background: levelInfo.color, color: "#000" }}
            >
              {levelInfo.icon}
            </div>
          </div>

          {/* Name + level badge */}
          <h1 className="text-2xl font-black text-white mb-1">{username}</h1>
          <span
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full font-bold mb-4"
            style={{
              background: `${levelInfo.color}18`,
              color: levelInfo.color,
              border: `1px solid ${levelInfo.color}35`,
            }}
          >
            <span>{levelInfo.icon}</span>
            {levelInfo.name}
          </span>
          <p className="text-white/30 text-xs mb-5">{user?.email}</p>

          {/* Quick stats strip */}
          <div className="flex items-center justify-center gap-6 mb-5">
            {[
              { value: `🔥 ${profile?.streak_days ?? 0}`, label: "streak" },
              { value: unlockedIds.length,                 label: "achievements" },
              { value: completedCourses.length,            label: "cours"  },
              { value: rawOrders.filter(o => o.side === "buy").length, label: "trades" },
            ].map(s => (
              <div key={s.label} className="text-center">
                <p className="text-white font-black text-lg leading-none">{s.value}</p>
                <p className="text-white/35 text-[10px] mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* XP Bar */}
          <div className="w-full max-w-xs">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold" style={{ color: levelInfo.color }}>{xp.toLocaleString()} XP</span>
              {levelInfo.nextLevel
                ? <span className="text-[11px] text-white/25">{levelInfo.nextLevel} → {levelInfo.nextLevelXP?.toLocaleString()} XP</span>
                : <span className="text-[11px] text-yellow-400 font-bold">Niveau max 👑</span>
              }
            </div>
            {/* Track */}
            <div className="h-2.5 bg-black/40 rounded-full overflow-hidden relative">
              <div
                className="h-full rounded-full transition-all duration-700 relative overflow-hidden"
                style={{
                  width: `${levelInfo.progress}%`,
                  background: `linear-gradient(90deg, ${levelInfo.color}aa, ${levelInfo.color})`,
                  boxShadow: `0 0 10px ${levelInfo.color}60`,
                }}
              >
                {/* Shimmer */}
                <div
                  className="absolute inset-0 translate-x-[-100%] animate-[shimmer_2s_infinite]"
                  style={{
                    background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent)",
                    animation: "shimmer 2.5s infinite",
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── XP Levels timeline ── */}
      <div className="max-w-2xl mx-auto px-4 pt-5 pb-2">
        <div className="flex items-center gap-0">
          {XP_LEVELS.map((lvl, i) => {
            const isActive  = levelInfo.level === i + 1
            const isPast    = levelInfo.level > i + 1
            return (
              <div key={lvl.name} className="flex items-center flex-1 last:flex-none">
                {/* Node */}
                <div className="flex flex-col items-center flex-shrink-0">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-sm transition-all"
                    style={{
                      background: isPast || isActive ? `${lvl.color}22` : "rgba(255,255,255,0.04)",
                      border: `1.5px solid ${isPast || isActive ? lvl.color : "rgba(255,255,255,0.1)"}`,
                      boxShadow: isActive ? `0 0 10px ${lvl.color}60` : undefined,
                    }}
                  >
                    {isPast ? (
                      <span style={{ color: lvl.color }} className="text-xs">✓</span>
                    ) : (
                      <span className={isActive ? "" : "grayscale opacity-40"}>{lvl.icon}</span>
                    )}
                  </div>
                  <p
                    className="text-[9px] mt-1 font-semibold"
                    style={{ color: isPast || isActive ? lvl.color : "rgba(255,255,255,0.2)" }}
                  >
                    {lvl.name}
                  </p>
                </div>
                {/* Connector line (not after last) */}
                {i < XP_LEVELS.length - 1 && (
                  <div
                    className="flex-1 h-px mx-0.5"
                    style={{
                      background: levelInfo.level > i + 1
                        ? `linear-gradient(90deg, ${lvl.color}, ${XP_LEVELS[i+1].color})`
                        : "rgba(255,255,255,0.08)",
                    }}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="max-w-2xl mx-auto px-4 mt-4">
        <div className="flex gap-1 bg-[#111] border border-white/5 rounded-xl p-1 mb-6 overflow-x-auto no-scrollbar">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 flex-shrink-0 whitespace-nowrap py-2 rounded-lg text-xs font-bold transition-all ${
                tab === t.key ? "bg-green-500/15 text-green-400" : "text-gray-500 hover:text-white"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Tab: Trading ── */}
        {tab === "trading" && (
          <div className="space-y-4 pb-4">

            {/* Primary stats */}
            <div className="grid grid-cols-2 gap-3">
              <StatCard
                label={t.profile.tradingStats.totalPl}
                value={(stats.totalPnl >= 0 ? "+" : "") + "$" + Math.abs(stats.totalPnl).toLocaleString("en-US", { maximumFractionDigits: 0 })}
                sub={`${stats.closedTrades.length} ${t.profile.tradingStats.closedTrades.toLowerCase()}`}
                color={stats.totalPnl >= 0 ? "#4ade80" : "#f87171"}
              />
              <StatCard
                label={t.profile.tradingStats.winRate}
                value={`${stats.winRate.toFixed(0)}%`}
                sub={`${stats.wins.length}W / ${stats.losses.length}L`}
                color={stats.winRate >= 50 ? "#4ade80" : "#f87171"}
              />
              <StatCard
                label={t.profile.tradingStats.avgRR}
                value={`+$${stats.avgWin.toFixed(0)}`}
                sub={t.profile.tradingStats.bestTrade.toLowerCase()}
                color="#4ade80"
              />
              <StatCard
                label={t.profile.tradingStats.worstTrade}
                value={`-$${stats.avgLoss.toFixed(0)}`}
                sub={t.profile.tradingStats.worstTrade.toLowerCase()}
                color="#f87171"
              />
              <StatCard
                label={t.profile.tradingStats.avgRR}
                value={stats.rrRatio > 0 ? stats.rrRatio.toFixed(2) : "–"}
                sub={t.profile.tradingStats.avgRR.toLowerCase()}
                color={stats.rrRatio >= 1 ? "#4ade80" : "#f59e0b"}
              />
              <StatCard
                label={t.profile.tradingStats.profitFactor}
                value={
                  stats.profitFactor === Infinity ? "∞"
                  : stats.profitFactor > 0 ? stats.profitFactor.toFixed(2)
                  : "–"
                }
                sub={t.profile.tradingStats.profitFactor.toLowerCase()}
                color={stats.profitFactor >= 1.5 ? "#4ade80" : stats.profitFactor >= 1 ? "#f59e0b" : "#f87171"}
              />
            </div>

            {/* Volume */}
            <div className="bg-[#111] border border-white/5 rounded-2xl p-4">
              <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-wide mb-3">{t.profile.tradingStats.volume}</p>
              <p className="text-white font-black text-3xl">
                ${stats.totalVolume.toLocaleString("en-US", { maximumFractionDigits: 0 })}
              </p>
              <p className="text-gray-600 text-xs mt-1">{stats.totalBuys} ordres d'achat passés</p>
            </div>

            {/* Best / Worst */}
            {(stats.bestTrade || stats.worstTrade) && (
              <div className="grid grid-cols-2 gap-3">
                {stats.bestTrade && (
                  <div className="bg-green-500/6 border border-green-500/20 rounded-2xl p-4">
                    <p className="text-green-400 text-[10px] font-bold uppercase tracking-wide mb-1">🏆 {t.profile.tradingStats.bestTrade}</p>
                    <p className="text-white font-black text-lg">{stats.bestTrade.symbol}</p>
                    <p className="text-green-400 font-bold text-sm">+${stats.bestTrade.pnl.toFixed(0)}</p>
                    <p className="text-green-400/60 text-[10px]">+{stats.bestTrade.pnl_pct.toFixed(1)}%</p>
                  </div>
                )}
                {stats.worstTrade && (
                  <div className="bg-red-500/6 border border-red-500/20 rounded-2xl p-4">
                    <p className="text-red-400 text-[10px] font-bold uppercase tracking-wide mb-1">💸 {t.profile.tradingStats.worstTrade}</p>
                    <p className="text-white font-black text-lg">{stats.worstTrade.symbol}</p>
                    <p className="text-red-400 font-bold text-sm">-${Math.abs(stats.worstTrade.pnl).toFixed(0)}</p>
                    <p className="text-red-400/60 text-[10px]">{stats.worstTrade.pnl_pct.toFixed(1)}%</p>
                  </div>
                )}
              </div>
            )}

            {stats.closedTrades.length === 0 && (
              <div className="text-center py-10 text-gray-600">
                <p className="text-4xl mb-3">📊</p>
                <p className="text-sm">{t.profile.noTrades}</p>
              </div>
            )}

            {/* Referral */}
            <div className="bg-[#111] border border-white/5 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xl">👥</span>
                <div>
                  <p className="text-white font-bold text-sm">Parrainage</p>
                  <p className="text-gray-500 text-xs">Invite tes amis et gagne 500 XP par filleul</p>
                </div>
              </div>
              <ReferralSection />
            </div>
          </div>
        )}

        {/* ── Tab: Achievements ── */}
        {tab === "achievements" && (
          <div className="bg-[#111] border border-white/5 rounded-2xl p-5 mb-4">
            <AchievementsGrid unlockedIds={unlockedIds} />
          </div>
        )}

        {/* ── Tab: Classement ── */}
        {tab === "classement" && (
          <div className="space-y-3 pb-4">
            {leaderboard.length >= 3 && (
              <div className="bg-[#111] border border-white/5 rounded-2xl p-6">
                <div className="flex items-end justify-center gap-4">
                  {[1, 0, 2].map(idx => {
                    const e = leaderboard[idx]
                    if (!e) return null
                    const medals  = ["🥈", "🥇", "🥉"]
                    const heights = ["h-24", "h-32", "h-20"]
                    const isGold  = idx === 0
                    return (
                      <div key={e.user_id} className="flex flex-col items-center gap-2">
                        <div
                          className="rounded-full flex items-center justify-center font-black text-black"
                          style={{
                            width: isGold ? 52 : 40, height: isGold ? 52 : 40,
                            backgroundColor: e.avatar_color ?? "#4ade80",
                            fontSize: isGold ? 20 : 16,
                          }}
                        >
                          {(e.username ?? "?")[0]?.toUpperCase()}
                        </div>
                        <p className={`font-bold text-white ${isGold ? "text-sm" : "text-xs"}`}>{e.username ?? "Anonyme"}</p>
                        <p className={`font-black text-xs ${(e.avg_pnl_pct ?? 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
                          {(e.avg_pnl_pct ?? 0) >= 0 ? "+" : ""}{(e.avg_pnl_pct ?? 0).toFixed(1)}%
                        </p>
                        <div className={`${heights[idx]} w-16 rounded-t-xl flex items-center justify-center text-xl ${
                          isGold  ? "bg-yellow-500/20 border border-yellow-500/30" :
                          idx === 1 ? "bg-gray-400/10 border border-gray-400/20" :
                          "bg-orange-600/10 border border-orange-600/20"
                        }`}>
                          {medals[idx]}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="space-y-2">
              {leaderboard.slice(0, 20).map((trader: any, i: number) => {
                const isMe = trader.user_id === user?.id
                return (
                  <div
                    key={trader.user_id ?? i}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition ${
                      isMe ? "bg-green-500/10 border-green-500/30" : "bg-[#111] border-white/5"
                    }`}
                  >
                    <span className="text-sm font-black text-gray-500 w-6 text-center flex-shrink-0">
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                    </span>
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-black text-xs font-black flex-shrink-0"
                      style={{ backgroundColor: trader.avatar_color ?? "#4ade80" }}
                    >
                      {(trader.username ?? "?")[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-bold truncate ${isMe ? "text-green-400" : "text-white"}`}>
                        {trader.username ?? "Anonyme"}
                        {isMe && <span className="text-[10px] text-green-500 ml-1">← {t.profile.leaderboard.you}</span>}
                      </p>
                      <p className="text-gray-600 text-xs">{trader.total_trades ?? 0} trades</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`text-sm font-black ${(trader.avg_pnl_pct ?? 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {(trader.avg_pnl_pct ?? 0) >= 0 ? "+" : ""}{(trader.avg_pnl_pct ?? 0).toFixed(1)}%
                      </p>
                      <p className="text-gray-600 text-[10px]">{Math.round(trader.win_rate ?? 0)}% WR</p>
                    </div>
                  </div>
                )
              })}
              {leaderboard.length === 0 && (
                <div className="text-center py-16 text-gray-600">
                  <p className="text-4xl mb-3">🏆</p>
                  <p className="text-sm">Pas encore de données de classement</p>
                </div>
              )}
            </div>

            {myRank !== null && myRank > 20 && (
              <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 text-center">
                <p className="text-green-400 font-bold text-sm">Ton classement : #{myRank}</p>
                <p className="text-gray-500 text-xs mt-1">Continue à trader pour grimper !</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Shimmer keyframe */}
      <style>{`
        @keyframes shimmer {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
      `}</style>
    </div>
  )
}
