"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts"
import {
  ACHIEVEMENTS, RARITY_COLORS, getLevelInfo,
  type AchievementCategory, type Rarity,
} from "@/lib/achievements"

// ─── Utils ────────────────────────────────────────────────────────────────────

function daysSince(dateStr?: string) {
  if (!dateStr) return 0
  return Math.max(1, Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000))
}

function buildPortfolioChart(pnlPct: number) {
  const points = Array.from({ length: 30 }, (_, i) => {
    const noise = (Math.random() - 0.5) * 1.5
    const trend = (pnlPct / 30) * i
    return { day: i + 1, value: +(100000 * (1 + (trend + noise) / 100)).toFixed(0) }
  })
  points[29].value = +(100000 * (1 + pnlPct / 100)).toFixed(0)
  return points
}

// ─── Referral Section ─────────────────────────────────────────────────────────

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
          {copied ? "✓ Copié" : "Copier"}
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

// ─── Achievements Grid ────────────────────────────────────────────────────────

const CATEGORY_TABS: { key: AchievementCategory | "all"; label: string }[] = [
  { key: "all",       label: "Tous"       },
  { key: "trading",   label: "Trading"    },
  { key: "learning",  label: "Formation"  },
  { key: "community", label: "Forum"      },
  { key: "social",    label: "Social"     },
  { key: "streak",    label: "Assiduité"  },
]

function AchievementsGrid({ unlockedIds }: { unlockedIds: string[] }) {
  const [catFilter, setCatFilter] = useState<AchievementCategory | "all">("all")
  const [rarityFilter, setRarityFilter] = useState<Rarity | "all">("all")

  const filtered = ACHIEVEMENTS.filter(a => {
    if (catFilter !== "all" && a.category !== catFilter) return false
    if (rarityFilter !== "all" && a.rarity !== rarityFilter) return false
    return true
  })

  const unlocked = filtered.filter(a => unlockedIds.includes(a.id))
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
                rarityFilter === r
                  ? "opacity-100"
                  : "opacity-40 hover:opacity-70"
              }`}
              style={c ? { color: c.hex, borderColor: `${c.hex}40`, background: `${c.hex}10` } : { color: "#9ca3af", borderColor: "rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)" }}
            >
              {r === "all" ? "Tous" : RARITY_COLORS[r].label}
            </button>
          )
        })}
      </div>

      {/* Stats */}
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
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-white/5 text-gray-600">
                🔒
              </span>
            </div>
            <p className="text-gray-500 text-xs font-bold leading-tight">{a.title}</p>
            <p className="text-gray-700 text-[10px] mt-0.5 leading-tight">{a.description}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type Tab = "trading" | "achievements" | "classement"

export default function ProfilPage() {
  const router = useRouter()
  const [user, setUser]                     = useState<any>(null)
  const [profile, setProfile]               = useState<any>(null)
  const [account, setAccount]               = useState<{ cash: number } | null>(null)
  const [positions, setPositions]           = useState<any[]>([])
  const [completedCourses, setCompletedCourses] = useState<any[]>([])
  const [orders, setOrders]                 = useState<any[]>([])
  const [unlockedIds, setUnlockedIds]       = useState<string[]>([])
  const [leaderboard, setLeaderboard]       = useState<any[]>([])
  const [loading, setLoading]               = useState(true)
  const [tab, setTab]                       = useState<Tab>("trading")
  const [myRank, setMyRank]                 = useState<number | null>(null)

  async function getToken() {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token
  }

  useEffect(() => {
    async function load() {
      const { data: { user: u } } = await supabase.auth.getUser()
      if (!u) { router.push("/login"); return }
      setUser(u)

      const token = await getToken()
      if (!token) return

      const [profileRes, accRes, posRes, ordRes] = await Promise.allSettled([
        fetch("/api/user-profile", { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
        fetch("/api/trading/account", { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
        fetch("/api/trading/positions", { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
        fetch("/api/trading/orders", { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      ])

      if (profileRes.status === "fulfilled") setProfile(profileRes.value?.profile ?? null)
      if (accRes.status === "fulfilled") setAccount(accRes.value?.account ?? null)
      if (posRes.status === "fulfilled") setPositions(Array.isArray(posRes.value?.positions) ? posRes.value.positions : [])
      if (ordRes.status === "fulfilled") setOrders(Array.isArray(ordRes.value) ? ordRes.value : [])

      try {
        const { data: rows } = await supabase
          .from("user_progress").select("*").eq("user_id", u.id).eq("completed", true)
        setCompletedCourses(rows ?? [])
      } catch {}

      try {
        const { data: rows } = await supabase
          .from("user_achievements").select("achievement_id").eq("user_id", u.id)
        setUnlockedIds((rows ?? []).map((r: any) => r.achievement_id))
      } catch {}

      try {
        const res = await fetch("/api/social/top-traders")
        const traders = await res.json()
        if (Array.isArray(traders)) {
          setLeaderboard(traders)
          const idx = traders.findIndex((t: any) => t.user_id === u.id)
          setMyRank(idx >= 0 ? idx + 1 : null)
        }
      } catch {}

      setLoading(false)
    }
    load()
  }, [])

  const positionsValue = positions.reduce((s, p) => s + (p.qty ?? 0) * (p.current_price ?? p.avg_price ?? 0), 0)
  const portfolioValue = (account?.cash ?? 0) + positionsValue
  const pnlPct  = portfolioValue > 0 ? ((portfolioValue - 100000) / 100000) * 100 : 0
  const pnlAbs  = portfolioValue - 100000
  const sellOrders = orders.filter((o: any) => o.type === "sell")
  const winRate = sellOrders.length > 0
    ? Math.round((sellOrders.filter((o: any) => o.price > (o.avg_price ?? 0)).length / sellOrders.length) * 100)
    : 0
  const chartData = buildPortfolioChart(pnlPct)

  const xp = profile?.xp ?? 0
  const levelInfo = getLevelInfo(xp)
  const initial = (profile?.username ?? user?.email ?? "?")[0]?.toUpperCase()
  const avatarBg = profile?.avatar_color ?? "#4ade80"
  const username = profile?.username ?? user?.email?.split("@")[0] ?? "Trader"

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0a0a0a]">
        <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "trading",      label: "📊 Trading"    },
    { key: "achievements", label: "🏅 Succès"     },
    { key: "classement",   label: "🏆 Classement" },
  ]

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white pb-16 overflow-x-hidden">
      <div className="max-w-2xl mx-auto px-4 pt-6">

        {/* Hero Header */}
        <div className="bg-[#111] border border-white/5 rounded-2xl p-6 mb-6 relative overflow-hidden">
          {/* Glow */}
          <div
            className="absolute inset-0 opacity-20 pointer-events-none"
            style={{ background: `radial-gradient(circle at 30% 50%, ${levelInfo.color}30, transparent 70%)` }}
          />

          <div className="relative flex items-start gap-4">
            {/* Avatar with glow ring */}
            <div className="relative flex-shrink-0">
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-black text-black"
                style={{ backgroundColor: avatarBg, boxShadow: `0 0 20px ${levelInfo.color}40` }}
              >
                {initial}
              </div>
              <div
                className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full border-2 border-[#111] flex items-center justify-center text-sm"
                style={{ background: `${levelInfo.color}20`, borderColor: `${levelInfo.color}60` }}
              >
                {levelInfo.icon}
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                <h1 className="text-xl font-black text-white">{username}</h1>
                <span
                  className="text-xs px-2.5 py-0.5 rounded-full font-bold"
                  style={{ background: `${levelInfo.color}18`, color: levelInfo.color, border: `1px solid ${levelInfo.color}35` }}
                >
                  {levelInfo.name}
                </span>
                <a
                  href="/parametres"
                  className="ml-auto text-xs px-2.5 py-1 rounded-lg text-white/30 hover:text-white transition flex-shrink-0"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  ⚙️
                </a>
              </div>
              <p className="text-gray-600 text-xs mb-3">{user?.email}</p>

              {/* Stats strip */}
              <div className="flex gap-4 mb-4">
                {[
                  { value: daysSince(user?.created_at), label: "jours" },
                  { value: unlockedIds.length,           label: "succès" },
                  { value: completedCourses.length,      label: "cours"  },
                  { value: orders.length,                label: "trades" },
                ].map(s => (
                  <div key={s.label} className="text-center">
                    <p className="text-white font-black text-base leading-none">{s.value}</p>
                    <p className="text-gray-600 text-[10px] mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* XP Bar */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] text-gray-500 font-medium">{xp} XP</span>
                  {levelInfo.nextLevel && (
                    <span className="text-[11px] text-gray-600">{levelInfo.nextLevel} → {levelInfo.nextLevelXP} XP</span>
                  )}
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${levelInfo.progress}%`,
                      background: `linear-gradient(90deg, ${levelInfo.color}aa, ${levelInfo.color})`,
                      boxShadow: `0 0 8px ${levelInfo.color}50`,
                    }}
                  />
                </div>
                {!levelInfo.nextLevel && (
                  <p className="text-[10px] text-yellow-400 font-bold mt-1 text-center">Niveau maximum atteint 👑</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
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

        {/* Tab: Trading */}
        {tab === "trading" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#111] border border-white/5 rounded-2xl p-4">
                <div className="text-gray-500 text-xs mb-1 font-semibold uppercase tracking-wide">Portfolio</div>
                <div className="text-white text-2xl font-black">
                  ${portfolioValue.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                </div>
                <div className={`text-sm font-bold mt-1 ${pnlAbs >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {pnlAbs >= 0 ? "+" : ""}${pnlAbs.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                </div>
              </div>
              <div className="bg-[#111] border border-white/5 rounded-2xl p-4">
                <div className="text-gray-500 text-xs mb-1 font-semibold uppercase tracking-wide">Performance</div>
                <div className={`text-2xl font-black ${pnlPct >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%
                </div>
                <div className="text-gray-500 text-xs mt-1">vs $100,000 initial</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#111] border border-white/5 rounded-2xl p-4">
                <div className="text-gray-500 text-xs mb-1 font-semibold uppercase tracking-wide">Win Rate</div>
                <div className="text-white text-2xl font-black">{winRate}%</div>
                <div className="text-gray-500 text-xs mt-1">{sellOrders.length} ventes</div>
              </div>
              <div className="bg-[#111] border border-white/5 rounded-2xl p-4">
                <div className="text-gray-500 text-xs mb-1 font-semibold uppercase tracking-wide">Liquidités</div>
                <div className="text-white text-2xl font-black">
                  ${(account?.cash ?? 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}
                </div>
                <div className="text-gray-500 text-xs mt-1">disponibles</div>
              </div>
            </div>

            <div className="bg-[#111] border border-white/5 rounded-2xl p-4">
              <div className="text-gray-500 text-xs mb-3 font-semibold uppercase tracking-wide">Évolution (30j)</div>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="portfolioGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4ade80" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#4ade80" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="day" hide />
                    <YAxis hide domain={["auto", "auto"]} />
                    <Tooltip
                      contentStyle={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}
                      formatter={(v: any) => [`$${Number(v).toLocaleString()}`, "Valeur"]}
                    />
                    <Area type="monotone" dataKey="value" stroke="#4ade80" strokeWidth={2} fill="url(#portfolioGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

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

        {/* Tab: Achievements */}
        {tab === "achievements" && (
          <div className="bg-[#111] border border-white/5 rounded-2xl p-5">
            <AchievementsGrid unlockedIds={unlockedIds} />
          </div>
        )}

        {/* Tab: Classement */}
        {tab === "classement" && (
          <div className="space-y-3">
            {/* Podium */}
            {leaderboard.length >= 3 && (
              <div className="bg-[#111] border border-white/5 rounded-2xl p-6">
                <div className="flex items-end justify-center gap-4">
                  {[1, 0, 2].map(idx => {
                    const e = leaderboard[idx]
                    if (!e) return null
                    const medals = ["🥈", "🥇", "🥉"]
                    const heights = ["h-24", "h-32", "h-20"]
                    const isGold = idx === 0
                    return (
                      <div key={e.user_id} className="flex flex-col items-center gap-2">
                        <div
                          className="rounded-full flex items-center justify-center font-black text-black"
                          style={{
                            width: isGold ? 52 : 40,
                            height: isGold ? 52 : 40,
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
                          isGold ? "bg-yellow-500/20 border border-yellow-500/30" :
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

            {/* List */}
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
                        {isMe && <span className="text-[10px] text-green-500 ml-1">← vous</span>}
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
    </div>
  )
}
