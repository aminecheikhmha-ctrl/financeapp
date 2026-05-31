"use client"
import { useEffect, useState, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts"

const ADMIN_EMAIL = "amine_cm@icloud.com"

// ─── Small components ──────────────────────────────────────────────────────────

function KPI({ label, value, sub, color = "text-white" }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="bg-[#111] border border-white/8 rounded-2xl p-5">
      <p className="text-gray-500 text-xs font-semibold uppercase tracking-widest mb-3">{label}</p>
      <p className={`text-3xl font-black ${color} mb-1`}>{value}</p>
      {sub && <p className="text-gray-600 text-xs">{sub}</p>}
    </div>
  )
}

function PlanBadge({ plan }: { plan: string }) {
  const s: Record<string, string> = {
    premium: "bg-yellow-500/15 text-yellow-400 border-yellow-500/25",
    pro: "bg-green-500/15 text-green-400 border-green-500/25",
    free: "bg-white/5 text-gray-500 border-white/10",
  }
  return <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold border ${s[plan] ?? s.free}`}>{plan}</span>
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-white/8">
          <h3 className="text-white font-bold">{title}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl leading-none">✕</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

function Spinner() {
  return <div className="flex items-center justify-center py-12"><div className="w-6 h-6 border-2 border-green-400 border-t-transparent rounded-full animate-spin" /></div>
}

function timeAgo(date: string) {
  if (!date) return "—"
  const diff = Date.now() - new Date(date).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return "à l'instant"
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}j`
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function AdminPage() {
  const router = useRouter()
  const [tk, setTk] = useState("")
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<"overview"|"users"|"forum"|"broadcast"|"signaux"|"alertes"|"events"|"moderation"|"ia_credits">("overview")
  const [moderationLogs, setModerationLogs] = useState<any[]>([])
  const [aiUsage, setAiUsage] = useState<{ users: any[]; totals: any } | null>(null)

  // Tab-specific data
  const [forumPosts, setForumPosts] = useState<any[]>([])
  const [adminSignals, setAdminSignals] = useState<any[]>([])
  const [adminAlerts, setAdminAlerts] = useState<any[]>([])
  const [tabLoaded, setTabLoaded] = useState<Record<string, boolean>>({})

  // Modals
  const [emailModal, setEmailModal] = useState<{ user: any } | null>(null)
  const [emailType, setEmailType] = useState("welcome")
  const [customMsg, setCustomMsg] = useState("")
  const [editModal, setEditModal] = useState<{ post: any } | null>(null)
  const [editTitle, setEditTitle] = useState("")
  const [editContent, setEditContent] = useState("")

  // Broadcast
  const [broadcastSeg, setBroadcastSeg] = useState("all")
  const [broadcastSubject, setBroadcastSubject] = useState("")
  const [broadcastMsg, setBroadcastMsg] = useState("")
  const [broadcastResult, setBroadcastResult] = useState<any>(null)
  const [broadcastLoading, setBroadcastLoading] = useState(false)

  // UI feedback
  const [toast, setToast] = useState("")
  const [userSearch, setUserSearch] = useState("")
  const [forumSearch, setForumSearch] = useState("")

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(""), 3000)
  }

  useEffect(() => {
    async function load() {
      const { data: session } = await supabase.auth.getSession()
      const user = session.session?.user
      if (!user || user.email !== ADMIN_EMAIL) { router.push("/dashboard"); return }
      const token = session.session?.access_token ?? ""
      setTk(token)
      const res = await fetch("/api/analytics", { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) { setLoading(false); return }
      setData(await res.json())
      setLoading(false)
    }
    load()
  }, [])

  const loadTab = useCallback(async (tab: string, token: string) => {
    if (tabLoaded[tab]) return
    setTabLoaded(p => ({ ...p, [tab]: true }))
    if (tab === "forum") {
      const r = await fetch("/api/admin/forum", { headers: { Authorization: `Bearer ${token}` } })
      setForumPosts((await r.json()).posts ?? [])
    }
    if (tab === "signaux") {
      const r = await fetch("/api/admin/signals", { headers: { Authorization: `Bearer ${token}` } })
      setAdminSignals((await r.json()).signals ?? [])
    }
    if (tab === "alertes") {
      const r = await fetch("/api/admin/alerts", { headers: { Authorization: `Bearer ${token}` } })
      setAdminAlerts((await r.json()).alerts ?? [])
    }
    if (tab === "moderation") {
      const { createClient } = await import("@supabase/supabase-js")
      const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
      const { data } = await sb.from("moderation_logs").select("*").order("created_at", { ascending: false }).limit(100)
      setModerationLogs(data ?? [])
    }
    if (tab === "ia_credits") {
      const r = await fetch("/api/admin/ai-usage", { headers: { Authorization: `Bearer ${token}` } })
      if (r.ok) setAiUsage(await r.json())
    }
  }, [tabLoaded])

  useEffect(() => {
    if (tk && activeTab !== "overview" && activeTab !== "users" && activeTab !== "events" && activeTab !== "broadcast") {
      loadTab(activeTab, tk)
    }
  }, [activeTab, tk])

  // ── User actions ──────────────────────────────────────────────────────────────

  async function setPlan(userId: string, plan: string, currentEmail: string) {
    await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json" },
      body: JSON.stringify({ userId, action: "set_plan", plan }),
    })
    setData((d: any) => ({
      ...d,
      userList: d.userList.map((u: any) => u.id === userId ? { ...u, plan } : u),
    }))
    showToast(`Plan de ${currentEmail} → ${plan}`)
  }

  async function sendEmail() {
    if (!emailModal) return
    await fetch("/api/admin/users", {
      method: "POST",
      headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json" },
      body: JSON.stringify({ email: emailModal.user.email, type: emailType, customMessage: customMsg }),
    })
    setEmailModal(null)
    showToast("Email envoyé !")
  }

  // ── Forum actions ─────────────────────────────────────────────────────────────

  async function deletePost(id: string) {
    if (!confirm("Supprimer ce post et ses réponses ?")) return
    await fetch("/api/admin/forum", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    })
    setForumPosts(p => p.filter(x => x.id !== id))
    showToast("Post supprimé")
  }

  async function togglePin(id: string, pinned: boolean) {
    await fetch("/api/admin/forum", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json" },
      body: JSON.stringify({ id, pinned: !pinned }),
    })
    setForumPosts(p => p.map(x => x.id === id ? { ...x, pinned: !pinned } : x))
    showToast(pinned ? "Post désépinglé" : "Post épinglé 📌")
  }

  async function saveEdit() {
    if (!editModal) return
    await fetch("/api/admin/forum", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json" },
      body: JSON.stringify({ id: editModal.post.id, title: editTitle, content: editContent }),
    })
    setForumPosts(p => p.map(x => x.id === editModal.post.id ? { ...x, title: editTitle, content: editContent } : x))
    setEditModal(null)
    showToast("Post modifié")
  }

  async function deleteSignal(id: string) {
    await fetch("/api/admin/signals", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    })
    setAdminSignals(s => s.filter(x => x.id !== id))
    showToast("Signal supprimé")
  }

  async function deleteAlert(id: string) {
    await fetch("/api/admin/alerts", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    })
    setAdminAlerts(a => a.filter(x => x.id !== id))
    showToast("Alerte supprimée")
  }

  async function sendBroadcast() {
    if (!broadcastSubject || !broadcastMsg) return
    setBroadcastLoading(true)
    const r = await fetch("/api/admin/broadcast", {
      method: "POST",
      headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json" },
      body: JSON.stringify({ segment: broadcastSeg, subject: broadcastSubject, message: broadcastMsg }),
    })
    setBroadcastResult(await r.json())
    setBroadcastLoading(false)
  }

  if (loading) return (
    <div className="min-h-screen bg-[#080808] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (!data) return (
    <div className="min-h-screen bg-[#080808] flex items-center justify-center">
      <p className="text-red-400">Accès refusé</p>
    </div>
  )

  const { users, plans, mrr, growth, recentEvents, userList = [] } = data
  const total = (plans.free ?? 0) + (plans.pro ?? 0) + (plans.premium ?? 0)
  const paidPct = total > 0 ? Math.round(((plans.pro + plans.premium) / total) * 100) : 0
  const arr = Math.round(mrr * 12)

  const filteredUsers = userList.filter((u: any) => !userSearch || u.email?.toLowerCase().includes(userSearch.toLowerCase()))
  const filteredPosts = forumPosts.filter(p => !forumSearch || p.title?.toLowerCase().includes(forumSearch.toLowerCase()) || p.username?.toLowerCase().includes(forumSearch.toLowerCase()))

  const TABS = [
    { id: "overview",   icon: "📊", label: "Vue générale" },
    { id: "users",      icon: "👥", label: `Utilisateurs (${users.total})` },
    { id: "forum",      icon: "💬", label: "Forum" },
    { id: "broadcast",  icon: "📢", label: "Broadcast" },
    { id: "signaux",    icon: "📡", label: "Signaux" },
    { id: "alertes",    icon: "🔔", label: "Alertes" },
    { id: "events",      icon: "⚡", label: "Événements" },
    { id: "moderation",  icon: "🛡️", label: "Modération" },
    { id: "ia_credits",  icon: "🤖", label: "IA Credits" },
  ] as const

  return (
    <div className="min-h-screen bg-[#080808]">

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-green-500 text-black text-sm font-bold px-4 py-2 rounded-xl shadow-lg animate-in slide-in-from-top">
          {toast}
        </div>
      )}

      {/* Email Modal */}
      {emailModal && (
        <Modal title={`Envoyer un email à ${emailModal.user.email}`} onClose={() => setEmailModal(null)}>
          <div className="space-y-4">
            <div>
              <label className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-2 block">Type d'email</label>
              <select value={emailType} onChange={e => setEmailType(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-gray-200 text-sm outline-none">
                <option value="welcome">Email de bienvenue</option>
                <option value="upgrade_pro">Confirmation upgrade Pro</option>
                <option value="upgrade_premium">Confirmation upgrade Premium</option>
                <option value="payment_failed">Paiement échoué</option>
                <option value="custom">Message personnalisé</option>
              </select>
            </div>
            {emailType === "custom" && (
              <div>
                <label className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-2 block">Message</label>
                <textarea value={customMsg} onChange={e => setCustomMsg(e.target.value)} rows={5} placeholder="Ton message..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-gray-200 text-sm outline-none resize-none" />
              </div>
            )}
            <button onClick={sendEmail}
              className="w-full bg-green-500 hover:bg-green-400 text-black font-bold py-2.5 rounded-xl text-sm transition-all">
              Envoyer ✉️
            </button>
          </div>
        </Modal>
      )}

      {/* Edit Post Modal */}
      {editModal && (
        <Modal title="Modifier le post" onClose={() => setEditModal(null)}>
          <div className="space-y-4">
            <div>
              <label className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-2 block">Titre</label>
              <input value={editTitle} onChange={e => setEditTitle(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-gray-200 text-sm outline-none" />
            </div>
            <div>
              <label className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-2 block">Contenu</label>
              <textarea value={editContent} onChange={e => setEditContent(e.target.value)} rows={6}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-gray-200 text-sm outline-none resize-none" />
            </div>
            <button onClick={saveEdit}
              className="w-full bg-green-500 hover:bg-green-400 text-black font-bold py-2.5 rounded-xl text-sm transition-all">
              Sauvegarder
            </button>
          </div>
        </Modal>
      )}

      {/* Header */}
      <div className="border-b border-white/8 px-6 py-4 flex items-center justify-between sticky top-0 bg-[#080808]/95 backdrop-blur z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center">
            <span className="text-black font-black text-sm">A</span>
          </div>
          <div>
            <h1 className="text-white font-black text-lg leading-none">Admin</h1>
            <p className="text-gray-600 text-xs mt-0.5">Tradex</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <a href="https://dashboard.stripe.com" target="_blank" rel="noopener noreferrer"
            className="px-3 py-1.5 bg-purple-500/15 border border-purple-500/25 text-purple-400 rounded-xl text-xs font-semibold hover:bg-purple-500/25 transition-all">
            Stripe ↗
          </a>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-green-400 text-xs font-semibold">Live</span>
          </div>
        </div>
      </div>

      <div className="px-4 md:px-6 py-6 max-w-7xl mx-auto">

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <KPI label="MRR" value={`${mrr}€`} sub={`ARR ~${arr}€`} color="text-green-400" />
          <KPI label="Utilisateurs" value={users.total} sub={`+${users.newThisWeek} cette semaine`} />
          <KPI label="Actifs aujourd'hui" value={users.activeToday} color="text-blue-400" />
          <KPI label="Conversion" value={`${paidPct}%`} sub={`${plans.pro + plans.premium} payants`} color="text-yellow-400" />
        </div>

        {/* Plans */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { label: "Free", count: plans.free, pct: total > 0 ? Math.round((plans.free / total) * 100) : 0, color: "text-gray-300", bar: "bg-gray-600" },
            { label: "Pro 🚀", count: plans.pro, pct: total > 0 ? Math.round((plans.pro / total) * 100) : 0, color: "text-green-400", bar: "bg-green-500" },
            { label: "Premium ⭐", count: plans.premium, pct: total > 0 ? Math.round((plans.premium / total) * 100) : 0, color: "text-yellow-400", bar: "bg-yellow-500" },
          ].map(p => (
            <div key={p.label} className="bg-[#111] border border-white/8 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider">{p.label}</p>
                <span className={`text-xs font-bold ${p.color}`}>{p.pct}%</span>
              </div>
              <p className={`text-2xl font-black ${p.color} mb-2`}>{p.count}</p>
              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div className={`h-full ${p.bar} rounded-full transition-all duration-700`} style={{ width: `${p.pct}%` }} />
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-white/5 rounded-xl mb-5 overflow-x-auto">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id as any)}
              className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex-shrink-0 ${
                activeTab === t.id ? "bg-white/10 text-white shadow-sm" : "text-gray-500 hover:text-gray-300"
              }`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* ═══════════════════════ OVERVIEW ═══════════════════════ */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-[#111] border border-white/8 rounded-2xl p-5">
              <h2 className="text-white font-bold mb-0.5">Croissance utilisateurs</h2>
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
              <h2 className="text-white font-bold mb-0.5">Répartition plans</h2>
              <p className="text-gray-600 text-xs mb-4">Tous les utilisateurs</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={[
                  { name: "Free", count: plans.free },
                  { name: "Pro", count: plans.pro },
                  { name: "Premium", count: plans.premium },
                ]} barSize={32}>
                  <XAxis dataKey="name" tick={{ fill: "#6b7280", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]} fill="#4ade80" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="lg:col-span-3 bg-[#111] border border-white/8 rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-white/5"><h2 className="text-white font-bold">Derniers inscrits</h2></div>
              <div className="divide-y divide-white/5">
                {userList.slice(0, 6).map((u: any) => (
                  <div key={u.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="w-8 h-8 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-green-400 text-xs font-black">{(u.email?.[0] ?? "?").toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-200 text-sm font-medium truncate">{u.email}</p>
                      <p className="text-gray-600 text-xs">il y a {timeAgo(u.created_at)}</p>
                    </div>
                    <PlanBadge plan={u.plan} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════ UTILISATEURS ═══════════════════════ */}
        {activeTab === "users" && (
          <div className="bg-[#111] border border-white/8 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/5 flex items-center gap-4 flex-wrap">
              <h2 className="text-white font-bold flex-1">Tous les utilisateurs ({userList.length})</h2>
              <input type="text" placeholder="Rechercher un email..." value={userSearch} onChange={e => setUserSearch(e.target.value)}
                className="bg-white/5 border border-white/8 rounded-xl px-3 py-1.5 text-sm text-gray-300 placeholder-gray-600 outline-none focus:border-green-500/50 w-56" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5">
                    {["Email", "Plan", "Inscrit", "Dernière connexion", "Statut", "Actions"].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-gray-500 text-xs font-semibold uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredUsers.map((u: any) => (
                    <tr key={u.id} className="hover:bg-white/3 transition-all group">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center flex-shrink-0">
                            <span className="text-xs text-gray-400 font-bold">{(u.email?.[0] ?? "?").toUpperCase()}</span>
                          </div>
                          <span className="text-gray-200 font-medium truncate max-w-[200px]">{u.email}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <select value={u.plan} onChange={e => setPlan(u.id, e.target.value, u.email)}
                          className="bg-transparent border border-white/10 rounded-lg px-2 py-1 text-xs font-semibold outline-none cursor-pointer text-gray-200">
                          <option value="free">free</option>
                          <option value="pro">pro</option>
                          <option value="premium">premium</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{new Date(u.created_at).toLocaleDateString("fr-FR")}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{u.last_sign_in_at ? `il y a ${timeAgo(u.last_sign_in_at)}` : "jamais"}</td>
                      <td className="px-4 py-3">
                        {u.payment_failed
                          ? <span className="text-red-400 text-xs font-bold">⚠ paiement</span>
                          : <span className="text-green-400 text-xs">✓ OK</span>}
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => setEmailModal({ user: u })}
                          className="px-3 py-1 bg-blue-500/15 border border-blue-500/25 text-blue-400 rounded-lg text-xs font-semibold hover:bg-blue-500/25 transition-all">
                          ✉ Email
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredUsers.length === 0 && <p className="text-gray-600 text-sm text-center py-8">Aucun utilisateur trouvé</p>}
            </div>
          </div>
        )}

        {/* ═══════════════════════ FORUM ═══════════════════════ */}
        {activeTab === "forum" && (
          <div className="bg-[#111] border border-white/8 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/5 flex items-center gap-4 flex-wrap">
              <h2 className="text-white font-bold flex-1">Modération forum ({forumPosts.length})</h2>
              <input type="text" placeholder="Rechercher..." value={forumSearch} onChange={e => setForumSearch(e.target.value)}
                className="bg-white/5 border border-white/8 rounded-xl px-3 py-1.5 text-sm text-gray-300 placeholder-gray-600 outline-none focus:border-green-500/50 w-56" />
            </div>
            {!tabLoaded["forum"] ? <Spinner /> : (
              <div className="divide-y divide-white/5 max-h-[600px] overflow-y-auto">
                {filteredPosts.length === 0 && <p className="text-gray-600 text-sm text-center py-8">Aucun post</p>}
                {filteredPosts.map((post: any) => (
                  <div key={post.id} className="px-5 py-4 hover:bg-white/2">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          {post.pinned && <span className="text-yellow-400 text-xs font-bold">📌</span>}
                          <span className="bg-white/5 border border-white/8 text-gray-400 text-xs px-2 py-0.5 rounded-full">{post.category}</span>
                          <span className="text-gray-500 text-xs font-medium">@{post.username}</span>
                          <span className="text-gray-700 text-xs">·</span>
                          <span className="text-gray-600 text-xs">{timeAgo(post.created_at)}</span>
                        </div>
                        <p className="text-gray-100 text-sm font-semibold mb-1">{post.title}</p>
                        <p className="text-gray-500 text-xs line-clamp-2">{post.content}</p>
                        <div className="flex gap-3 mt-2 text-gray-600 text-xs">
                          <span>👍 {post.likes}</span>
                          <span>💬 {post.replies_count}</span>
                          <span>👁 {post.views}</span>
                        </div>
                      </div>
                      <div className="flex gap-1.5 flex-shrink-0 flex-wrap justify-end">
                        <button onClick={() => { setEditModal({ post }); setEditTitle(post.title); setEditContent(post.content) }}
                          className="px-2.5 py-1.5 bg-white/5 border border-white/10 text-gray-400 rounded-lg text-xs font-semibold hover:bg-white/10 transition-all">
                          ✏️
                        </button>
                        <button onClick={() => togglePin(post.id, post.pinned)}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                            post.pinned ? "bg-yellow-500/15 text-yellow-400 border-yellow-500/25 hover:bg-yellow-500/25" : "bg-white/5 text-gray-400 border-white/10 hover:bg-white/10"
                          }`}>
                          📌
                        </button>
                        <button onClick={() => deletePost(post.id)}
                          className="px-2.5 py-1.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-xs font-semibold hover:bg-red-500/20 transition-all">
                          🗑
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════ BROADCAST ═══════════════════════ */}
        {activeTab === "broadcast" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-[#111] border border-white/8 rounded-2xl p-5">
              <h2 className="text-white font-bold mb-1">Envoyer un email groupé</h2>
              <p className="text-gray-600 text-xs mb-5">Contacte un segment d'utilisateurs en une fois</p>
              <div className="space-y-4">
                <div>
                  <label className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-2 block">Segment</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: "all", label: "Tous", count: users.total },
                      { id: "free", label: "Free", count: plans.free },
                      { id: "pro", label: "Pro 🚀", count: plans.pro },
                      { id: "premium", label: "Premium ⭐", count: plans.premium },
                    ].map(s => (
                      <button key={s.id} onClick={() => setBroadcastSeg(s.id)}
                        className={`px-3 py-2.5 rounded-xl border text-sm font-semibold transition-all text-left ${
                          broadcastSeg === s.id ? "bg-green-500/15 border-green-500/30 text-green-400" : "bg-white/5 border-white/8 text-gray-400 hover:bg-white/8"
                        }`}>
                        <span>{s.label}</span>
                        <span className="text-xs ml-2 opacity-60">({s.count})</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-2 block">Sujet</label>
                  <input value={broadcastSubject} onChange={e => setBroadcastSubject(e.target.value)}
                    placeholder="Ex: Nouvelles fonctionnalités Tradex 🚀"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-gray-200 text-sm outline-none focus:border-green-500/50" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-2 block">Message</label>
                  <textarea value={broadcastMsg} onChange={e => setBroadcastMsg(e.target.value)} rows={8}
                    placeholder="Écris ton message ici..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-gray-200 text-sm outline-none resize-none focus:border-green-500/50" />
                </div>
                <button onClick={sendBroadcast} disabled={broadcastLoading || !broadcastSubject || !broadcastMsg}
                  className="w-full bg-green-500 hover:bg-green-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold py-3 rounded-xl text-sm transition-all flex items-center justify-center gap-2">
                  {broadcastLoading ? <><div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" /> Envoi...</> : "📢 Envoyer la campagne"}
                </button>
              </div>
            </div>
            <div className="space-y-4">
              {broadcastResult && (
                <div className={`rounded-2xl p-5 border ${broadcastResult.ok ? "bg-green-500/10 border-green-500/25" : "bg-red-500/10 border-red-500/25"}`}>
                  <p className={`font-bold mb-2 ${broadcastResult.ok ? "text-green-400" : "text-red-400"}`}>
                    {broadcastResult.ok ? "✅ Envoyé !" : "❌ Erreur"}
                  </p>
                  {broadcastResult.sent !== undefined && (
                    <p className="text-gray-300 text-sm">{broadcastResult.sent} / {broadcastResult.total} emails envoyés</p>
                  )}
                  {broadcastResult.errors?.length > 0 && (
                    <p className="text-red-400 text-xs mt-2">{broadcastResult.errors.join(", ")}</p>
                  )}
                </div>
              )}
              <div className="bg-[#111] border border-white/8 rounded-2xl p-5">
                <h3 className="text-white font-bold mb-3">Bonnes pratiques</h3>
                <div className="space-y-2">
                  {[
                    "✓ Personnalise le sujet pour chaque segment",
                    "✓ Inclus un appel à l'action clair",
                    "✓ Teste d'abord avec un email perso",
                    "✓ Évite d'envoyer plus d'une fois par semaine",
                    "✓ Respecte le RGPD — inclus une note de désinscription",
                  ].map((t, i) => (
                    <p key={i} className="text-gray-500 text-xs">{t}</p>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════ SIGNAUX ═══════════════════════ */}
        {activeTab === "signaux" && (
          <div className="bg-[#111] border border-white/8 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
              <div>
                <h2 className="text-white font-bold">Signaux en base ({adminSignals.length})</h2>
                <p className="text-gray-600 text-xs mt-0.5">100 derniers signaux stockés</p>
              </div>
            </div>
            {!tabLoaded["signaux"] ? <Spinner /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/5">
                      {["Ticker", "Direction", "Score", "Entrée", "TP1", "SL", "Créé", ""].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-gray-500 text-xs font-semibold uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {adminSignals.map((s: any) => (
                      <tr key={s.id} className="hover:bg-white/3 transition-all">
                        <td className="px-4 py-3 text-gray-100 font-bold font-mono text-xs">{s.ticker}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${
                            s.direction === "LONG" ? "bg-green-500/15 text-green-400 border-green-500/25" : "bg-red-500/15 text-red-400 border-red-500/25"
                          }`}>{s.direction}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-12 h-1.5 bg-white/5 rounded-full overflow-hidden">
                              <div className="h-full bg-green-400 rounded-full" style={{ width: `${s.score_confiance}%` }} />
                            </div>
                            <span className="text-gray-400 text-xs">{s.score_confiance}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-300 text-xs font-mono">${s.prix_entree?.toFixed(2)}</td>
                        <td className="px-4 py-3 text-green-400 text-xs font-mono">${s.take_profit_1?.toFixed(2)}</td>
                        <td className="px-4 py-3 text-red-400 text-xs font-mono">${s.stop_loss?.toFixed(2)}</td>
                        <td className="px-4 py-3 text-gray-600 text-xs">{timeAgo(s.created_at)}</td>
                        <td className="px-4 py-3">
                          <button onClick={() => deleteSignal(s.id)}
                            className="px-2 py-1 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-xs hover:bg-red-500/20 transition-all">
                            🗑
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {adminSignals.length === 0 && <p className="text-gray-600 text-sm text-center py-8">Aucun signal en base</p>}
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════ ALERTES ═══════════════════════ */}
        {activeTab === "alertes" && (
          <div className="bg-[#111] border border-white/8 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/5">
              <h2 className="text-white font-bold">Alertes de prix ({adminAlerts.length})</h2>
              <p className="text-gray-600 text-xs mt-0.5">Toutes les alertes actives et déclenchées</p>
            </div>
            {!tabLoaded["alertes"] ? <Spinner /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/5">
                      {["User", "Symbole", "Condition", "Prix cible", "Statut", "Créée", ""].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-gray-500 text-xs font-semibold uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {adminAlerts.map((a: any) => (
                      <tr key={a.id} className="hover:bg-white/3 transition-all">
                        <td className="px-4 py-3 text-gray-500 text-xs font-mono">{a.user_id?.slice(0, 8)}…</td>
                        <td className="px-4 py-3 text-gray-100 font-bold text-xs">{a.symbol}</td>
                        <td className="px-4 py-3 text-gray-400 text-xs">{a.condition === "above" ? "Au-dessus de" : "En-dessous de"}</td>
                        <td className="px-4 py-3 text-gray-200 text-xs font-mono">${a.price}</td>
                        <td className="px-4 py-3">
                          {a.triggered
                            ? <span className="text-orange-400 text-xs font-bold">✓ Déclenchée</span>
                            : <span className="text-green-400 text-xs font-bold">● Active</span>}
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-xs">{timeAgo(a.created_at)}</td>
                        <td className="px-4 py-3">
                          <button onClick={() => deleteAlert(a.id)}
                            className="px-2 py-1 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-xs hover:bg-red-500/20 transition-all">
                            🗑
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {adminAlerts.length === 0 && <p className="text-gray-600 text-sm text-center py-8">Aucune alerte</p>}
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════ ÉVÉNEMENTS ═══════════════════════ */}
        {activeTab === "events" && (
          <div className="bg-[#111] border border-white/8 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/5">
              <h2 className="text-white font-bold">Événements analytics ({recentEvents.length})</h2>
            </div>
            <div className="divide-y divide-white/5 max-h-[600px] overflow-y-auto">
              {recentEvents.length === 0 && <p className="text-gray-600 text-sm text-center py-8">Aucun événement enregistré</p>}
              {recentEvents.map((e: any, i: number) => (
                <div key={i} className="flex items-center gap-4 px-5 py-3 hover:bg-white/2">
                  <span className="text-gray-600 text-xs w-24 flex-shrink-0 font-mono">
                    {new Date(e.created_at).toLocaleString("fr-FR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold border flex-shrink-0 ${
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

        {/* ══════════════════════ MODÉRATION ══════════════════════ */}
        {activeTab === "moderation" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-white font-bold text-lg">🛡️ Logs de modération</h2>
              <span className="text-xs text-gray-500">{moderationLogs.length} entrées</span>
            </div>
            <div className="bg-[#111] border border-white/8 rounded-2xl overflow-hidden">
              {!tabLoaded["moderation"] ? <Spinner /> : moderationLogs.length === 0 ? (
                <p className="text-gray-600 text-sm text-center py-10">Aucune violation détectée</p>
              ) : (
                <div className="divide-y divide-white/5 max-h-[600px] overflow-y-auto">
                  {moderationLogs.map((log: any) => (
                    <div key={log.id} className="flex items-start gap-4 px-5 py-4 hover:bg-white/2 transition">
                      <span className={`text-[9px] font-black px-2 py-1 rounded-full flex-shrink-0 mt-0.5 ${
                        log.severity === "high"   ? "bg-red-500/20 text-red-400" :
                        log.severity === "medium" ? "bg-orange-500/20 text-orange-400" :
                                                    "bg-yellow-500/20 text-yellow-400"
                      }`}>
                        {(log.severity ?? "low").toUpperCase()}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[10px] font-bold text-white/60">{log.content_type}</span>
                          <span className="text-[10px] text-white/25">{timeAgo(log.created_at)}</span>
                        </div>
                        <p className="text-xs font-bold text-white/80">{log.reason}</p>
                        <p className="text-[10px] text-white/35 mt-0.5 truncate italic">"{log.content_preview}"</p>
                        <p className="text-[9px] text-white/20 mt-1 font-mono">{log.user_id}</p>
                      </div>
                      <button
                        onClick={async () => {
                          await fetch("/api/admin/users", {
                            method: "PATCH",
                            headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json" },
                            body: JSON.stringify({ userId: log.user_id, action: "ban" }),
                          })
                          showToast("Utilisateur banni")
                        }}
                        className="text-[10px] font-bold px-2.5 py-1 rounded-lg text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition flex-shrink-0"
                      >
                        Bannir
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══════════════════════ IA CREDITS ═══════════════════════ */}
        {activeTab === "ia_credits" && (
          <div className="space-y-4">
            {/* KPIs globaux */}
            {aiUsage && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-[#111] border border-white/8 rounded-2xl p-4">
                  <p className="text-gray-500 text-xs font-semibold uppercase tracking-widest mb-2">Total 30j</p>
                  <p className="text-3xl font-black text-purple-400">{aiUsage.totals.total}</p>
                  <p className="text-gray-600 text-xs mt-1">appels IA</p>
                </div>
                <div className="bg-[#111] border border-white/8 rounded-2xl p-4">
                  <p className="text-gray-500 text-xs font-semibold uppercase tracking-widest mb-2">Aujourd&apos;hui</p>
                  <p className="text-3xl font-black text-blue-400">{aiUsage.totals.today}</p>
                  <p className="text-gray-600 text-xs mt-1">appels</p>
                </div>
                <div className="bg-[#111] border border-white/8 rounded-2xl p-4">
                  <p className="text-gray-500 text-xs font-semibold uppercase tracking-widest mb-2">Cette semaine</p>
                  <p className="text-3xl font-black text-green-400">{aiUsage.totals.this_week}</p>
                  <p className="text-gray-600 text-xs mt-1">appels</p>
                </div>
                <div className="bg-[#111] border border-white/8 rounded-2xl p-4">
                  <p className="text-gray-500 text-xs font-semibold uppercase tracking-widest mb-2">Utilisateurs actifs</p>
                  <p className="text-3xl font-black text-yellow-400">{aiUsage.users.length}</p>
                  <p className="text-gray-600 text-xs mt-1">ont utilisé l&apos;IA</p>
                </div>
              </div>
            )}

            {/* Répartition par feature */}
            {aiUsage && (
              <div className="bg-[#111] border border-white/8 rounded-2xl p-5">
                <h3 className="text-white font-bold mb-4">Répartition par feature (30j)</h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {[
                    { key: "chat",               label: "💬 Assistant",  color: "bg-blue-500",   count: aiUsage.totals.chat },
                    { key: "coach",              label: "🎯 Coach",      color: "bg-green-500",  count: aiUsage.totals.coach },
                    { key: "trade_coach",        label: "📈 Trade Coach",color: "bg-yellow-500", count: aiUsage.totals.trade_coach },
                    { key: "portfolio_analysis", label: "💼 Portfolio",  color: "bg-purple-500", count: aiUsage.totals.portfolio_analysis },
                    { key: "moderation",         label: "🛡️ Modération", color: "bg-red-500",    count: aiUsage.totals.moderation },
                  ].map(f => {
                    const pct = aiUsage.totals.total > 0 ? Math.round((f.count / aiUsage.totals.total) * 100) : 0
                    return (
                      <div key={f.key} className="bg-white/3 rounded-xl p-3">
                        <p className="text-xs text-gray-400 mb-1">{f.label}</p>
                        <p className="text-xl font-black text-white">{f.count}</p>
                        <div className="h-1 bg-white/5 rounded-full mt-2 overflow-hidden">
                          <div className={`h-full ${f.color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                        </div>
                        <p className="text-[10px] text-gray-600 mt-1">{pct}%</p>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Tableau par utilisateur */}
            <div className="bg-[#111] border border-white/8 rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
                <div>
                  <h2 className="text-white font-bold">Utilisation par utilisateur</h2>
                  <p className="text-gray-600 text-xs mt-0.5">30 derniers jours · trié par volume</p>
                </div>
              </div>
              {!tabLoaded["ia_credits"] ? <Spinner /> : !aiUsage || aiUsage.users.length === 0 ? (
                <p className="text-gray-600 text-sm text-center py-10">Aucun appel IA enregistré</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/5">
                        {["Utilisateur", "Plan", "Total", "💬 Chat", "🎯 Coach", "📈 Trade", "💼 Portfolio", "Dernier appel"].map(h => (
                          <th key={h} className="text-left px-4 py-3 text-gray-500 text-xs font-semibold uppercase tracking-wide whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {aiUsage.users.map((u: any) => (
                        <tr key={u.user_id} className="hover:bg-white/3 transition-all">
                          <td className="px-4 py-3">
                            <p className="text-gray-200 text-xs font-medium truncate max-w-[160px]">{u.email}</p>
                            {u.username && <p className="text-gray-600 text-[10px]">{u.username}</p>}
                          </td>
                          <td className="px-4 py-3"><PlanBadge plan={u.plan} /></td>
                          <td className="px-4 py-3">
                            <span className="text-purple-400 font-black text-sm">{u.total}</span>
                          </td>
                          <td className="px-4 py-3 text-blue-400 text-xs font-mono">{u.chat || "—"}</td>
                          <td className="px-4 py-3 text-green-400 text-xs font-mono">{u.coach || "—"}</td>
                          <td className="px-4 py-3 text-yellow-400 text-xs font-mono">{u.trade_coach || "—"}</td>
                          <td className="px-4 py-3 text-purple-300 text-xs font-mono">{u.portfolio_analysis || "—"}</td>
                          <td className="px-4 py-3 text-gray-600 text-xs">{timeAgo(u.last_used)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
