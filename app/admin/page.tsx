"use client"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts"

const ADMIN_EMAIL = "amine_cm@icloud.com"

function KPI({ label, value, sub, color = "text-white" }: {
  label: string; value: string | number; sub?: string; color?: string
}) {
  return (
    <div className="bg-[#111] border border-white/8 rounded-2xl p-5">
      <p className="text-gray-500 text-xs font-semibold uppercase tracking-widest mb-3">{label}</p>
      <p className={`text-3xl font-black ${color} mb-1`}>{value}</p>
      {sub && <p className="text-gray-600 text-xs">{sub}</p>}
    </div>
  )
}

function PlanBadge({ plan }: { plan: string }) {
  const styles: Record<string, string> = {
    premium: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
    pro: "bg-green-500/15 text-green-400 border-green-500/20",
    free: "bg-white/5 text-gray-500 border-white/8",
  }
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold border ${styles[plan] ?? styles.free}`}>
      {plan}
    </span>
  )
}

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}j`
}

export default function AdminPage() {
  const router = useRouter()
  const [data, setData] = useState<any>(null)
  const [forumPosts, setForumPosts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [forumLoading, setForumLoading] = useState(false)
  const [error, setError] = useState("")
  const [token, setToken] = useState("")
  const [activeTab, setActiveTab] = useState<"overview" | "users" | "events" | "forum">("overview")
  const [userSearch, setUserSearch] = useState("")
  const [forumSearch, setForumSearch] = useState("")

  useEffect(() => {
    async function load() {
      const { data: session } = await supabase.auth.getSession()
      const user = session.session?.user
      if (!user || user.email !== ADMIN_EMAIL) {
        router.push("/dashboard")
        return
      }
      const tk = session.session?.access_token ?? ""
      setToken(tk)
      const res = await fetch("/api/analytics", { headers: { Authorization: `Bearer ${tk}` } })
      if (!res.ok) { setError("Accès refusé"); setLoading(false); return }
      const json = await res.json()
      setData(json)
      setLoading(false)
    }
    load()
  }, [])

  useEffect(() => {
    if (activeTab === "forum" && token && forumPosts.length === 0) {
      setForumLoading(true)
      fetch("/api/admin/forum", { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(j => { setForumPosts(j.posts ?? []); setForumLoading(false) })
        .catch(() => setForumLoading(false))
    }
  }, [activeTab, token])

  async function deletePost(id: string) {
    if (!confirm("Supprimer ce post et ses réponses ?")) return
    await fetch("/api/admin/forum", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    })
    setForumPosts(p => p.filter(x => x.id !== id))
  }

  async function togglePin(id: string, pinned: boolean) {
    await fetch("/api/admin/forum", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ id, pinned: !pinned }),
    })
    setForumPosts(p => p.map(x => x.id === id ? { ...x, pinned: !pinned } : x))
  }

  if (loading) return (
    <div className="min-h-screen bg-[#080808] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (error || !data) return (
    <div className="min-h-screen bg-[#080808] flex items-center justify-center">
      <p className="text-red-400">{error || "Erreur"}</p>
    </div>
  )

  const { users, plans, mrr, growth, recentEvents, userList = [] } = data
  const total = (plans.free ?? 0) + (plans.pro ?? 0) + (plans.premium ?? 0)
  const paidPct = total > 0 ? Math.round(((plans.pro + plans.premium) / total) * 100) : 0
  const arr = Math.round(mrr * 12)

  const filteredUsers = userList.filter((u: any) =>
    !userSearch || u.email?.toLowerCase().includes(userSearch.toLowerCase())
  )
  const filteredPosts = forumPosts.filter(p =>
    !forumSearch || p.title?.toLowerCase().includes(forumSearch.toLowerCase()) || p.username?.toLowerCase().includes(forumSearch.toLowerCase())
  )

  const tabs = [
    { id: "overview", label: "Vue générale", icon: "📊" },
    { id: "users", label: `Utilisateurs (${users.total})`, icon: "👥" },
    { id: "events", label: "Événements", icon: "⚡" },
    { id: "forum", label: "Forum", icon: "💬" },
  ] as const

  return (
    <div className="min-h-screen bg-[#080808]">
      {/* Header */}
      <div className="border-b border-white/8 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-white">Admin Dashboard</h1>
          <p className="text-gray-600 text-xs mt-0.5">FinanceApp · {ADMIN_EMAIL}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-green-400 text-xs font-semibold">Live</span>
        </div>
      </div>

      <div className="px-6 py-6 max-w-7xl mx-auto">
        {/* KPI Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <KPI label="MRR" value={`${mrr}€`} sub={`ARR ~${arr}€`} color="text-green-400" />
          <KPI label="Utilisateurs" value={users.total} sub={`+${users.newThisWeek} cette semaine`} />
          <KPI label="Actifs aujourd'hui" value={users.activeToday} sub="connexions" color="text-blue-400" />
          <KPI label="Conversion" value={`${paidPct}%`} sub={`${plans.pro + plans.premium} payants`} color="text-yellow-400" />
        </div>

        {/* Plans */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: "Free", count: plans.free, pct: total > 0 ? Math.round((plans.free / total) * 100) : 0, color: "text-gray-300", bar: "bg-gray-600" },
            { label: "Pro 🚀", count: plans.pro, pct: total > 0 ? Math.round((plans.pro / total) * 100) : 0, color: "text-green-400", bar: "bg-green-500" },
            { label: "Premium ⭐", count: plans.premium, pct: total > 0 ? Math.round((plans.premium / total) * 100) : 0, color: "text-yellow-400", bar: "bg-yellow-500" },
          ].map(p => (
            <div key={p.label} className="bg-[#111] border border-white/8 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-gray-500 text-xs font-semibold uppercase tracking-widest">{p.label}</p>
                <span className={`text-xs font-bold ${p.color}`}>{p.pct}%</span>
              </div>
              <p className={`text-3xl font-black ${p.color} mb-3`}>{p.count}</p>
              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div className={`h-full ${p.bar} rounded-full`} style={{ width: `${p.pct}%` }} />
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-white/5 rounded-xl mb-6 flex-wrap">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === t.id ? "bg-white/10 text-white" : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW ── */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-[#111] border border-white/8 rounded-2xl p-5">
              <h2 className="text-white font-bold mb-1">Croissance utilisateurs</h2>
              <p className="text-gray-600 text-xs mb-4">30 derniers jours</p>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={growth}>
                  <defs>
                    <linearGradient id="gGrowth" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4ade80" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#4ade80" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fill: "#4b5563", fontSize: 10 }} tickFormatter={d => d.slice(5)} />
                  <YAxis tick={{ fill: "#4b5563", fontSize: 10 }} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }} labelStyle={{ color: "#9ca3af" }} itemStyle={{ color: "#4ade80" }} />
                  <Area type="monotone" dataKey="count" stroke="#4ade80" fill="url(#gGrowth)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-[#111] border border-white/8 rounded-2xl p-5">
              <h2 className="text-white font-bold mb-1">Répartition plans</h2>
              <p className="text-gray-600 text-xs mb-4">Tous les utilisateurs</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={[
                  { name: "Free", count: plans.free, fill: "#374151" },
                  { name: "Pro", count: plans.pro, fill: "#4ade80" },
                  { name: "Premium", count: plans.premium, fill: "#facc15" },
                ]} barSize={32}>
                  <XAxis dataKey="name" tick={{ fill: "#6b7280", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]} fill="#4ade80" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Derniers inscrits */}
            <div className="lg:col-span-3 bg-[#111] border border-white/8 rounded-2xl overflow-hidden">
              <div className="p-5 border-b border-white/5">
                <h2 className="text-white font-bold">Derniers inscrits</h2>
              </div>
              <div className="divide-y divide-white/5">
                {userList.slice(0, 5).map((u: any) => (
                  <div key={u.id} className="flex items-center gap-4 px-5 py-3">
                    <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs text-gray-400 font-bold">{(u.email?.[0] ?? "?").toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-200 text-sm font-medium truncate">{u.email}</p>
                      <p className="text-gray-600 text-xs">Inscrit il y a {timeAgo(u.created_at)}</p>
                    </div>
                    <PlanBadge plan={u.plan} />
                    {u.payment_failed && <span className="text-red-400 text-xs font-bold">⚠ paiement</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── UTILISATEURS ── */}
        {activeTab === "users" && (
          <div className="bg-[#111] border border-white/8 rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-white/5 flex items-center gap-4">
              <h2 className="text-white font-bold flex-1">Tous les utilisateurs ({userList.length})</h2>
              <input
                type="text"
                placeholder="Rechercher un email..."
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                className="bg-white/5 border border-white/8 rounded-xl px-3 py-1.5 text-sm text-gray-300 placeholder-gray-600 outline-none focus:border-green-500/50 w-56"
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="text-left px-5 py-3 text-gray-500 text-xs font-semibold uppercase tracking-wide">Email</th>
                    <th className="text-left px-5 py-3 text-gray-500 text-xs font-semibold uppercase tracking-wide">Plan</th>
                    <th className="text-left px-5 py-3 text-gray-500 text-xs font-semibold uppercase tracking-wide">Inscrit</th>
                    <th className="text-left px-5 py-3 text-gray-500 text-xs font-semibold uppercase tracking-wide">Dernière connexion</th>
                    <th className="text-left px-5 py-3 text-gray-500 text-xs font-semibold uppercase tracking-wide">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredUsers.map((u: any) => (
                    <tr key={u.id} className="hover:bg-white/3 transition-all">
                      <td className="px-5 py-3 text-gray-200 font-medium">{u.email}</td>
                      <td className="px-5 py-3"><PlanBadge plan={u.plan} /></td>
                      <td className="px-5 py-3 text-gray-500 text-xs">{new Date(u.created_at).toLocaleDateString("fr-FR")}</td>
                      <td className="px-5 py-3 text-gray-500 text-xs">
                        {u.last_sign_in_at ? `il y a ${timeAgo(u.last_sign_in_at)}` : "jamais"}
                      </td>
                      <td className="px-5 py-3">
                        {u.payment_failed
                          ? <span className="text-red-400 text-xs font-bold">⚠ paiement échoué</span>
                          : <span className="text-green-400 text-xs">✓ OK</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredUsers.length === 0 && (
                <p className="text-gray-600 text-sm text-center py-8">Aucun utilisateur trouvé</p>
              )}
            </div>
          </div>
        )}

        {/* ── ÉVÉNEMENTS ── */}
        {activeTab === "events" && (
          <div className="bg-[#111] border border-white/8 rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-white/5">
              <h2 className="text-white font-bold">Événements analytics ({recentEvents.length})</h2>
              <p className="text-gray-600 text-xs mt-0.5">100 derniers événements</p>
            </div>
            <div className="divide-y divide-white/5 max-h-[600px] overflow-y-auto">
              {recentEvents.length === 0 && (
                <p className="text-gray-600 text-sm text-center py-8">Aucun événement enregistré</p>
              )}
              {recentEvents.map((e: any, i: number) => (
                <div key={i} className="flex items-start gap-4 px-5 py-3 hover:bg-white/3 transition-all">
                  <span className="text-gray-600 text-xs w-28 flex-shrink-0 font-mono mt-0.5">
                    {new Date(e.created_at).toLocaleString("fr-FR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold border flex-shrink-0 ${
                    e.event === "signup" ? "bg-green-500/15 text-green-400 border-green-500/20" :
                    e.event === "upgrade" ? "bg-yellow-500/15 text-yellow-400 border-yellow-500/20" :
                    "bg-white/5 text-gray-400 border-white/8"
                  }`}>{e.event}</span>
                  <span className="text-gray-600 text-xs truncate font-mono">
                    {e.user_id ? `${e.user_id.slice(0, 8)}…` : "anon"}
                    {e.metadata && Object.keys(e.metadata).length > 0 ? ` · ${JSON.stringify(e.metadata)}` : ""}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── FORUM ── */}
        {activeTab === "forum" && (
          <div className="bg-[#111] border border-white/8 rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-white/5 flex items-center gap-4">
              <h2 className="text-white font-bold flex-1">Modération forum ({forumPosts.length} posts)</h2>
              <input
                type="text"
                placeholder="Rechercher..."
                value={forumSearch}
                onChange={e => setForumSearch(e.target.value)}
                className="bg-white/5 border border-white/8 rounded-xl px-3 py-1.5 text-sm text-gray-300 placeholder-gray-600 outline-none focus:border-green-500/50 w-56"
              />
            </div>

            {forumLoading && (
              <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            <div className="divide-y divide-white/5 max-h-[600px] overflow-y-auto">
              {!forumLoading && filteredPosts.length === 0 && (
                <p className="text-gray-600 text-sm text-center py-8">Aucun post</p>
              )}
              {filteredPosts.map((post: any) => (
                <div key={post.id} className="px-5 py-4 hover:bg-white/3 transition-all">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        {post.pinned && <span className="text-yellow-400 text-xs font-bold">📌 Épinglé</span>}
                        <span className="bg-white/5 border border-white/8 text-gray-400 text-xs px-2 py-0.5 rounded-full">{post.category}</span>
                        <span className="text-gray-600 text-xs">@{post.username}</span>
                        <span className="text-gray-700 text-xs">·</span>
                        <span className="text-gray-600 text-xs">{timeAgo(post.created_at)}</span>
                      </div>
                      <p className="text-gray-200 text-sm font-semibold mb-1 truncate">{post.title}</p>
                      <p className="text-gray-500 text-xs line-clamp-2">{post.content}</p>
                      <div className="flex items-center gap-3 mt-2 text-gray-600 text-xs">
                        <span>👍 {post.likes}</span>
                        <span>💬 {post.replies_count}</span>
                        <span>👁 {post.views}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => togglePin(post.id, post.pinned)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                          post.pinned
                            ? "bg-yellow-500/15 text-yellow-400 border-yellow-500/20 hover:bg-yellow-500/25"
                            : "bg-white/5 text-gray-400 border-white/8 hover:bg-white/10"
                        }`}
                      >
                        {post.pinned ? "Désépingler" : "📌 Épingler"}
                      </button>
                      <button
                        onClick={() => deletePost(post.id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold border bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20 transition-all"
                      >
                        Supprimer
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
