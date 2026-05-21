"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts"

function ReferralSection() {
  const [ref, setRef] = useState<{ code: string; url: string; stats: { total: number; converted: number } } | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const token = data.session?.access_token
      if (!token) return
      fetch("/api/referral", { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(setRef)
        .catch(() => {})
    })
  }, [])

  if (!ref) return <div className="text-gray-600 text-xs">Chargement...</div>

  function copy() {
    navigator.clipboard.writeText(ref!.url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 bg-[#0a0a0a] border border-white/10 rounded-xl px-3 py-2.5 text-green-400 font-mono text-sm truncate">
          {ref.url}
        </div>
        <button onClick={copy} className="px-3 py-2.5 rounded-xl bg-green-500 hover:bg-green-400 text-black font-bold text-xs transition flex-shrink-0">
          {copied ? "✓ Copié" : "Copier"}
        </button>
      </div>
      <div className="flex gap-4">
        <div className="text-center">
          <p className="text-2xl font-black text-white">{ref.stats.total}</p>
          <p className="text-gray-500 text-xs">Parrainés</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-black text-green-400">{ref.stats.converted}</p>
          <p className="text-gray-500 text-xs">Convertis</p>
        </div>
      </div>
    </div>
  )
}

const AVATAR_COLORS = [
  "#4ade80", "#60a5fa", "#f472b6", "#a78bfa",
  "#fb923c", "#34d399", "#facc15", "#f87171",
]

type UserProfile = {
  id: string
  username?: string
  avatar_color?: string
  level?: "débutant" | "intermédiaire" | "avancé"
  goals?: string[]
  preferred_assets?: string[]
  risk_tolerance?: "faible" | "modéré" | "élevé"
  onboarding_completed?: boolean
  created_at?: string
  notifications_email?: boolean
  notifications_push?: boolean
}

type Tab = "trading" | "progression" | "classement"

function getLevelBadge(level?: string) {
  if (level === "débutant") return { emoji: "🌱", color: "text-green-400", bg: "bg-green-500/15 border-green-500/30" }
  if (level === "intermédiaire") return { emoji: "📈", color: "text-blue-400", bg: "bg-blue-500/15 border-blue-500/30" }
  if (level === "avancé") return { emoji: "🎯", color: "text-purple-400", bg: "bg-purple-500/15 border-purple-500/30" }
  return { emoji: "🌱", color: "text-gray-400", bg: "bg-white/5 border-white/10" }
}

function daysSince(dateStr?: string) {
  if (!dateStr) return 0
  const diff = Date.now() - new Date(dateStr).getTime()
  return Math.max(1, Math.floor(diff / (1000 * 60 * 60 * 24)))
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

function CoachRecentAnalysis() {
  const [coachData, setCoachData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) { setLoading(false); return }
      try {
        const res = await fetch("/api/ai/trade-coach", {
          headers: { Authorization: `Bearer ${token}` },
        })
        const json = await res.json()
        setCoachData(json)
      } catch {}
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return <div className="text-gray-600 text-xs">Chargement de l'analyse...</div>
  }

  if (!coachData || coachData.insufficient_data) {
    return (
      <div className="rounded-2xl p-4 text-center" style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>
        <p className="text-gray-500 text-sm">{coachData?.message ?? "Pas encore assez de données."}</p>
      </div>
    )
  }

  const score = coachData.score_global ?? 0
  const scoreColor = score > 70 ? "text-green-400" : score > 40 ? "text-orange-400" : "text-red-400"

  return (
    <div className="space-y-3">
      <div className="rounded-2xl p-4" style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide">Dernier rapport</p>
          <span className={`text-2xl font-black ${scoreColor}`}>{score}<span className="text-gray-600 text-sm">/100</span></span>
        </div>
        {coachData.synthese && (
          <p className="text-gray-400 text-xs leading-relaxed">{coachData.synthese}</p>
        )}
      </div>

      {(coachData.patterns ?? []).slice(0, 3).map((pattern: any, i: number) => {
        const isPositive = pattern.type === "positif"
        const borderColor = isPositive ? "#4ade80" : "#fb923c"
        const icon = isPositive ? "✅" : "⚠️"
        return (
          <div
            key={i}
            className="rounded-xl p-3"
            style={{ background: "#0d0d0d", border: "1px solid #1a1a1a", borderLeft: `3px solid ${borderColor}` }}
          >
            <div className="flex items-start gap-2">
              <span className="text-sm flex-shrink-0">{icon}</span>
              <p className="text-white text-xs font-semibold">{pattern.titre ?? pattern.description}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function ProfilPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [account, setAccount] = useState<{ cash: number } | null>(null)
  const [positions, setPositions] = useState<any[]>([])
  const [completedCourses, setCompletedCourses] = useState<any[]>([])
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>("trading")

  // Leaderboard state
  const [leaderboard, setLeaderboard] = useState<any[]>([])
  const [lbPeriod, setLbPeriod] = useState<"week" | "month" | "all">("week")
  const [lbFilter, setLbFilter] = useState<"performance" | "xp" | "trades">("performance")
  const [myRank, setMyRank] = useState<number | null>(null)


  async function getToken() {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token
  }

  async function fetchLeaderboard() {
    try {
      const res = await fetch("/api/social/top-traders")
      const json = await res.json()
      const traders = Array.isArray(json) ? json : []
      setLeaderboard(traders)
      const idx = traders.findIndex((t: any) => t.user_id === user?.id)
      setMyRank(idx >= 0 ? idx + 1 : null)
    } catch {}
  }

  useEffect(() => {
    async function load() {
      const { data: { user: u } } = await supabase.auth.getUser()
      if (!u) { router.push("/login"); return }
      setUser(u)

      const token = await getToken()
      if (!token) return

      // Profile
      const profileRes = await fetch("/api/user-profile", {
        headers: { Authorization: `Bearer ${token}` },
      })
      const profileJson = await profileRes.json()
      const p: UserProfile | null = profileJson.profile
      setProfile(p)

      // Account
      try {
        const accRes = await fetch("/api/trading/account", {
          headers: { Authorization: `Bearer ${token}` },
        })
        const accJson = await accRes.json()
        setAccount(accJson.account)
      } catch {}

      // Positions
      try {
        const posRes = await fetch("/api/trading/positions", {
          headers: { Authorization: `Bearer ${token}` },
        })
        const posJson = await posRes.json()
        setPositions(Array.isArray(posJson.positions) ? posJson.positions : [])
      } catch {}

      // Completed courses
      try {
        const { data: rows } = await supabase
          .from("user_progress")
          .select("*")
          .eq("user_id", u.id)
          .eq("completed", true)
        setCompletedCourses(rows ?? [])
      } catch {}

      // Orders
      try {
        const ordRes = await fetch("/api/trading/orders", {
          headers: { Authorization: `Bearer ${token}` },
        })
        const ordJson = await ordRes.json()
        setOrders(Array.isArray(ordJson) ? ordJson : [])
      } catch {}

      setLoading(false)
    }
    load()
  }, [])

  useEffect(() => {
    if (user) fetchLeaderboard()
  }, [user, lbPeriod, lbFilter])


  // Computed stats
  const positionsValue = positions.reduce((s, p) => s + (p.qty ?? 0) * (p.current_price ?? p.avg_price ?? 0), 0)
  const portfolioValue = (account?.cash ?? 0) + positionsValue
  const pnlPct = portfolioValue > 0 ? ((portfolioValue - 100000) / 100000) * 100 : 0
  const pnlAbs = portfolioValue - 100000
  const winRate =
    orders.length > 0
      ? Math.round(
          (orders.filter((o: any) => o.type === "sell" && o.price > (o.avg_price ?? 0)).length / orders.filter((o: any) => o.type === "sell").length || 0) * 100
        )
      : 0
  const chartData = buildPortfolioChart(pnlPct)
  const lv = getLevelBadge(profile?.level)
  const initial = (profile?.username ?? user?.email ?? "?")[0]?.toUpperCase()
  const avatarBg = profile?.avatar_color ?? "#4ade80"

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0a0a0a]">
        <div className="text-gray-500 text-sm">Chargement du profil...</div>
      </div>
    )
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "trading",     label: "📊 Trading"     },
    { key: "progression", label: "📚 Progression" },
    { key: "classement",  label: "🏆 Classement"  },
  ]

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white pb-16 overflow-x-hidden">
      <div className="max-w-2xl mx-auto px-4 pt-6 md:pt-8">

        {/* Header */}
        <div className="bg-[#111] border border-white/5 rounded-2xl p-6 mb-6">
          <div className="flex items-start gap-5">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-black text-black flex-shrink-0"
              style={{ backgroundColor: avatarBg }}
            >
              {initial}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-xl md:text-2xl font-black text-white truncate">
                  {profile?.username ?? user?.email?.split("@")[0] ?? "Utilisateur"}
                </h1>
                {profile?.level && (
                  <span className={`text-xs px-2.5 py-1 rounded-lg border font-bold ${lv.bg} ${lv.color}`}>
                    {lv.emoji} {profile.level}
                  </span>
                )}
                <a
                  href="/parametres"
                  className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white/40 hover:text-white transition flex-shrink-0"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  ⚙️ Paramètres
                </a>
              </div>
              <p className="text-gray-500 text-sm mt-0.5 truncate">{user?.email}</p>

              {/* Stats strip */}
              <div className="flex gap-5 mt-3 flex-wrap">
                <div className="text-center">
                  <div className="text-white font-black text-lg">{daysSince(user?.created_at)}</div>
                  <div className="text-gray-500 text-xs">jours sur la plateforme</div>
                </div>
                <div className="text-center">
                  <div className="text-white font-black text-lg">{completedCourses.length}</div>
                  <div className="text-gray-500 text-xs">cours complétés</div>
                </div>
                <div className="text-center">
                  <div className="text-white font-black text-lg">{orders.length}</div>
                  <div className="text-gray-500 text-xs">trades effectués</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-[#111] border border-white/5 rounded-xl p-1 mb-6 overflow-x-auto scrollbar-hide">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 flex-shrink-0 whitespace-nowrap py-2 rounded-lg text-xs md:text-sm font-bold transition-all ${
                tab === t.key
                  ? "bg-green-500/15 text-green-400"
                  : "text-gray-500 hover:text-white"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab: Trading */}
        {tab === "trading" && (
          <div className="space-y-4">
            {/* Portfolio value */}
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
                <div className="text-gray-500 text-xs mt-1">vs 100 000 $ de départ</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#111] border border-white/5 rounded-2xl p-4">
                <div className="text-gray-500 text-xs mb-1 font-semibold uppercase tracking-wide">Win Rate</div>
                <div className="text-white text-2xl font-black">{winRate}%</div>
                <div className="text-gray-500 text-xs mt-1">{orders.filter((o: any) => o.type === "sell").length} ventes</div>
              </div>
              <div className="bg-[#111] border border-white/5 rounded-2xl p-4">
                <div className="text-gray-500 text-xs mb-1 font-semibold uppercase tracking-wide">Liquidités</div>
                <div className="text-white text-2xl font-black">
                  ${(account?.cash ?? 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}
                </div>
                <div className="text-gray-500 text-xs mt-1">disponibles</div>
              </div>
            </div>

            {/* Chart */}
            <div className="bg-[#111] border border-white/5 rounded-2xl p-4">
              <div className="text-gray-500 text-xs mb-3 font-semibold uppercase tracking-wide">Évolution du portfolio (30j)</div>
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
          </div>
        )}

        {/* Tab: Progression */}
        {tab === "progression" && (
          <div className="space-y-4">
            {/* Completed courses */}
            <div className="bg-[#111] border border-white/5 rounded-2xl p-5">
              <div className="text-gray-500 text-xs mb-4 font-semibold uppercase tracking-wide">Cours complétés</div>
              {completedCourses.length === 0 ? (
                <p className="text-gray-500 text-sm">Aucun cours complété pour le moment.</p>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {completedCourses.map((c: any, i: number) => (
                    <div key={i} className="bg-green-500/5 border border-green-500/20 rounded-xl p-3 flex items-center gap-2">
                      <span className="text-green-400 text-lg">✅</span>
                      <span className="text-white text-xs font-semibold truncate">{c.chapter_id ?? `Cours ${i + 1}`}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Badges */}
            <div className="bg-[#111] border border-white/5 rounded-2xl p-5">
              <div className="text-gray-500 text-xs mb-4 font-semibold uppercase tracking-wide">Badges</div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { emoji: "🏆", label: "Premier trade", earned: orders.length > 0 },
                  { emoji: "📚", label: "Premier cours", earned: completedCourses.length > 0 },
                  { emoji: "🎯", label: "TP atteint", earned: false },
                  { emoji: "📈", label: "Profit réalisé", earned: pnlPct > 0 },
                  { emoji: "🔥", label: "5 cours complétés", earned: completedCourses.length >= 5 },
                  { emoji: "💎", label: "Trader confirmé", earned: orders.length >= 10 },
                ].map(badge => (
                  <div
                    key={badge.label}
                    className={`p-3 rounded-xl border text-center transition-all ${
                      badge.earned
                        ? "border-yellow-500/30 bg-yellow-500/10"
                        : "border-white/5 bg-white/3 opacity-40 grayscale"
                    }`}
                  >
                    <div className="text-2xl mb-1">{badge.emoji}</div>
                    <div className="text-xs text-white font-semibold leading-tight">{badge.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Streak */}
            <div className="bg-[#111] border border-white/5 rounded-2xl p-5 flex items-center justify-between">
              <div>
                <div className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-1">Streak actuelle</div>
                <div className="text-white text-2xl font-black">🔥 1 jour</div>
                <div className="text-gray-500 text-xs mt-1">Connexion quotidienne</div>
              </div>
              <div className="text-5xl opacity-20">🔥</div>
            </div>
          </div>
        )}


        {/* Tab: Classement */}
        {tab === "classement" && (
          <div className="space-y-4">
            {/* Period + filter controls */}
            <div className="flex gap-2 flex-wrap">
              {(["week","month","all"] as const).map(p => (
                <button key={p} onClick={() => setLbPeriod(p)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${lbPeriod === p ? "bg-green-500/15 text-green-400 border border-green-500/30" : "bg-white/5 text-gray-500 hover:text-white border border-white/5"}`}>
                  {p === "week" ? "Cette semaine" : p === "month" ? "Ce mois" : "All time"}
                </button>
              ))}
              <div className="ml-auto flex gap-2">
                {(["performance","xp","trades"] as const).map(f => (
                  <button key={f} onClick={() => setLbFilter(f)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${lbFilter === f ? "bg-white/10 text-white border border-white/20" : "bg-white/3 text-gray-600 border border-white/5"}`}>
                    {f === "performance" ? "📈 Perf" : f === "xp" ? "⭐ XP" : "🔢 Trades"}
                  </button>
                ))}
              </div>
            </div>

            {/* Leaderboard list */}
            <div className="space-y-2">
              {leaderboard.slice(0, 20).map((trader: any, i: number) => {
                const isMe = trader.user_id === user?.id
                const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null
                return (
                  <div key={trader.user_id || i}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition ${isMe ? "bg-green-500/10 border-green-500/30" : "bg-[#111] border-white/5"}`}>
                    <span className="text-sm font-black text-gray-500 w-6 text-center flex-shrink-0">
                      {medal ?? `#${i+1}`}
                    </span>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-black text-xs font-black flex-shrink-0"
                      style={{ backgroundColor: trader.avatar_color ?? "#4ade80" }}>
                      {(trader.username ?? "?")[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-bold truncate ${isMe ? "text-green-400" : "text-white"}`}>
                        {trader.username ?? "Anonyme"} {isMe && <span className="text-[10px] text-green-500 ml-1">← vous</span>}
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
                <div className="text-center py-12 text-gray-600">
                  <p className="text-3xl mb-2">🏆</p>
                  <p className="text-sm">Pas encore de données de classement</p>
                </div>
              )}
            </div>

            {/* Your rank (if not in top 20) */}
            {myRank !== null && myRank > 20 && (
              <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 text-center">
                <p className="text-green-400 font-bold text-sm">Ton classement actuel : #{myRank}</p>
                <p className="text-gray-500 text-xs mt-1">Continue à trader pour grimper !</p>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
