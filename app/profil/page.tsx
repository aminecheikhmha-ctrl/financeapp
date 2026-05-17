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

type Tab = "trading" | "progression" | "parametres"

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

  // Settings state
  const [editUsername, setEditUsername] = useState("")
  const [editColor, setEditColor] = useState("#4ade80")
  const [editRisk, setEditRisk] = useState<"faible" | "modéré" | "élevé" | "">("")
  const [notifEmail, setNotifEmail] = useState(false)
  const [notifPush, setNotifPush] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState("")

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

      // Profile
      const profileRes = await fetch("/api/user-profile", {
        headers: { Authorization: `Bearer ${token}` },
      })
      const profileJson = await profileRes.json()
      const p: UserProfile | null = profileJson.profile
      setProfile(p)
      if (p) {
        setEditUsername(p.username ?? "")
        setEditColor(p.avatar_color ?? "#4ade80")
        setEditRisk(p.risk_tolerance ?? "")
        setNotifEmail(p.notifications_email ?? false)
        setNotifPush(p.notifications_push ?? false)
      }

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

  async function handleSaveSettings() {
    setSaving(true)
    setSaveMsg("")
    const token = await getToken()
    if (!token) { setSaving(false); return }
    try {
      const res = await fetch("/api/user-profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          username: editUsername,
          avatar_color: editColor,
          risk_tolerance: editRisk || undefined,
          notifications_email: notifEmail,
          notifications_push: notifPush,
        }),
      })
      const json = await res.json()
      if (json.profile) {
        setProfile(json.profile)
        setSaveMsg("✅ Sauvegardé !")
      } else {
        setSaveMsg("❌ Erreur lors de la sauvegarde.")
      }
    } catch {
      setSaveMsg("❌ Erreur réseau.")
    }
    setSaving(false)
    setTimeout(() => setSaveMsg(""), 3000)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    document.cookie = "onboarding_done=; path=/; max-age=0"
    router.push("/")
  }

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
    { key: "trading", label: "📊 Trading" },
    { key: "progression", label: "📚 Progression" },
    { key: "parametres", label: "⚙️ Paramètres" },
  ]

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white pb-16">
      <div className="max-w-2xl mx-auto px-4 pt-8">

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
                <h1 className="text-2xl font-black text-white truncate">
                  {profile?.username ?? user?.email?.split("@")[0] ?? "Utilisateur"}
                </h1>
                {profile?.level && (
                  <span className={`text-xs px-2.5 py-1 rounded-lg border font-bold ${lv.bg} ${lv.color}`}>
                    {lv.emoji} {profile.level}
                  </span>
                )}
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
        <div className="flex gap-1 bg-[#111] border border-white/5 rounded-xl p-1 mb-6">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
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

        {/* Tab: Paramètres */}
        {tab === "parametres" && (
          <div className="space-y-4">
            {/* Edit profile */}
            <div className="bg-[#111] border border-white/5 rounded-2xl p-5 space-y-5">
              <div className="text-gray-500 text-xs font-semibold uppercase tracking-wide">Modifier le profil</div>

              <div>
                <label className="block text-sm text-gray-400 mb-2 font-semibold">Pseudo</label>
                <input
                  type="text"
                  value={editUsername}
                  onChange={e => setEditUsername(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-green-500/60 transition text-sm"
                  maxLength={30}
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-3 font-semibold">Couleur de l'avatar</label>
                <div className="flex gap-3 flex-wrap">
                  {AVATAR_COLORS.map(color => (
                    <button
                      key={color}
                      onClick={() => setEditColor(color)}
                      className={`w-9 h-9 rounded-full transition-all duration-200 ${
                        editColor === color
                          ? "scale-125 ring-2 ring-white ring-offset-2 ring-offset-[#111]"
                          : "hover:scale-110"
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Risk tolerance */}
            <div className="bg-[#111] border border-white/5 rounded-2xl p-5 space-y-4">
              <div className="text-gray-500 text-xs font-semibold uppercase tracking-wide">Profil de risque</div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { icon: "🛡️", label: "Prudent", value: "faible" as const },
                  { icon: "⚖️", label: "Modéré", value: "modéré" as const },
                  { icon: "🔥", label: "Agressif", value: "élevé" as const },
                ].map(r => (
                  <button
                    key={r.value}
                    onClick={() => setEditRisk(r.value)}
                    className={`p-3 rounded-xl border text-center transition-all ${
                      editRisk === r.value
                        ? "border-green-500/60 bg-green-500/10"
                        : "border-white/10 bg-white/3 hover:border-white/20"
                    }`}
                  >
                    <div className="text-xl mb-1">{r.icon}</div>
                    <div className="text-white text-xs font-bold">{r.label}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Notifications */}
            <div className="bg-[#111] border border-white/5 rounded-2xl p-5 space-y-4">
              <div className="text-gray-500 text-xs font-semibold uppercase tracking-wide">Notifications</div>
              {[
                { label: "Notifications email", value: notifEmail, set: setNotifEmail },
                { label: "Notifications push", value: notifPush, set: setNotifPush },
              ].map(n => (
                <div key={n.label} className="flex items-center justify-between">
                  <span className="text-white text-sm font-semibold">{n.label}</span>
                  <button
                    onClick={() => n.set(!n.value)}
                    className={`w-11 h-6 rounded-full transition-all relative ${
                      n.value ? "bg-green-500" : "bg-white/10"
                    }`}
                  >
                    <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${
                      n.value ? "left-6" : "left-1"
                    }`} />
                  </button>
                </div>
              ))}
            </div>

            {/* Theme */}
            <div className="bg-[#111] border border-white/5 rounded-2xl p-5 flex items-center justify-between">
              <div>
                <div className="text-white text-sm font-semibold">Thème</div>
                <div className="text-gray-500 text-xs mt-0.5">Mode d'affichage</div>
              </div>
              <span className="text-sm px-3 py-1.5 rounded-lg bg-white/5 text-gray-400 border border-white/10 font-semibold">
                🌙 Dark
              </span>
            </div>

            {/* Save button */}
            <button
              onClick={handleSaveSettings}
              disabled={saving}
              className="w-full py-3 rounded-xl bg-green-500 hover:bg-green-400 text-black font-black transition disabled:opacity-40"
            >
              {saving ? "Sauvegarde..." : "Sauvegarder les modifications"}
            </button>
            {saveMsg && (
              <div className="text-center text-sm font-semibold text-gray-300">{saveMsg}</div>
            )}

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="w-full py-3 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 font-bold transition text-sm mt-2"
            >
              Se déconnecter
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
