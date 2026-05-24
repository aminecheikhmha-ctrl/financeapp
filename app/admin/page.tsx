"use client"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts"

const ADMIN_EMAIL = "olfagni@gmail.com"

function KPI({ label, value, sub, color = "text-white", trend }: {
  label: string; value: string | number; sub?: string; color?: string; trend?: number
}) {
  return (
    <div className="bg-[#111] border border-white/8 rounded-2xl p-5">
      <p className="text-gray-500 text-xs font-semibold uppercase tracking-widest mb-3">{label}</p>
      <p className={`text-3xl font-black ${color} mb-1`}>{value}</p>
      <div className="flex items-center gap-2">
        {trend !== undefined && (
          <span className={`text-xs font-bold ${trend >= 0 ? "text-green-400" : "text-red-400"}`}>
            {trend >= 0 ? "▲" : "▼"} {Math.abs(trend)}%
          </span>
        )}
        {sub && <span className="text-gray-600 text-xs">{sub}</span>}
      </div>
    </div>
  )
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${color}`}>{label}</span>
  )
}

export default function AdminPage() {
  const router = useRouter()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [activeTab, setActiveTab] = useState<"overview" | "users" | "events">("overview")

  useEffect(() => {
    async function load() {
      const { data: session } = await supabase.auth.getSession()
      const user = session.session?.user
      if (!user || user.email !== ADMIN_EMAIL) {
        router.push("/dashboard")
        return
      }
      const token = session.session?.access_token
      const res = await fetch("/api/analytics", { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) { setError("Accès refusé"); setLoading(false); return }
      const json = await res.json()
      setData(json)
      setLoading(false)
    }
    load()
  }, [])

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

  const { users, plans, mrr, growth, recentEvents } = data
  const total = (plans.free ?? 0) + (plans.pro ?? 0) + (plans.premium ?? 0)
  const paidPct = total > 0 ? Math.round(((plans.pro + plans.premium) / total) * 100) : 0
  const arr = Math.round(mrr * 12)

  const planBars = [
    { name: "Free", count: plans.free, fill: "#374151" },
    { name: "Pro", count: plans.pro, fill: "#4ade80" },
    { name: "Premium", count: plans.premium, fill: "#facc15" },
  ]

  const tabs = [
    { id: "overview", label: "Vue générale" },
    { id: "users", label: "Utilisateurs" },
    { id: "events", label: "Événements" },
  ] as const

  return (
    <div className="min-h-screen bg-[#080808]">
      {/* Header */}
      <div className="border-b border-white/8 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-white">Admin Dashboard</h1>
          <p className="text-gray-600 text-xs mt-0.5">FinanceApp · Accès restreint</p>
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
          <KPI label="Utilisateurs" value={users.total} sub={`+${users.newThisWeek} cette semaine`} color="text-white" />
          <KPI label="Actifs aujourd'hui" value={users.activeToday} sub="connexions" color="text-blue-400" />
          <KPI label="Taux conversion" value={`${paidPct}%`} sub={`${plans.pro + plans.premium} payants`} color="text-yellow-400" />
        </div>

        {/* Plans row */}
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
                <div className={`h-full ${p.bar} rounded-full transition-all`} style={{ width: `${p.pct}%` }} />
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-white/5 rounded-xl mb-6 w-fit">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === t.id ? "bg-white/10 text-white" : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {activeTab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Growth chart */}
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
                  <YAxis tick={{ fill: "#4b5563", fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }}
                    labelStyle={{ color: "#9ca3af" }}
                    itemStyle={{ color: "#4ade80" }}
                  />
                  <Area type="monotone" dataKey="count" stroke="#4ade80" fill="url(#gGrowth)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Plans bar chart */}
            <div className="bg-[#111] border border-white/8 rounded-2xl p-5">
              <h2 className="text-white font-bold mb-1">Répartition plans</h2>
              <p className="text-gray-600 text-xs mb-4">Tous les utilisateurs</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={planBars} barSize={32}>
                  <XAxis dataKey="name" tick={{ fill: "#6b7280", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }}
                    labelStyle={{ color: "#9ca3af" }}
                    cursor={{ fill: "rgba(255,255,255,0.04)" }}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]} fill="#4ade80">
                    {planBars.map((p, i) => (
                      <rect key={i} fill={p.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Quick actions */}
            <div className="lg:col-span-3 bg-[#111] border border-white/8 rounded-2xl p-5">
              <h2 className="text-white font-bold mb-4">Actions rapides</h2>
              <div className="flex flex-wrap gap-3">
                {[
                  { label: "Trigger cron emails", action: "/api/cron/emails", method: "POST" },
                  { label: "Voir Stripe dashboard", href: "https://dashboard.stripe.com" },
                  { label: "Voir Supabase", href: process.env.NEXT_PUBLIC_SUPABASE_URL },
                ].map((a, i) => (
                  a.href ? (
                    <a
                      key={i}
                      href={a.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/8 rounded-xl text-sm text-gray-300 font-medium transition-all"
                    >
                      {a.label} ↗
                    </a>
                  ) : (
                    <button
                      key={i}
                      className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/8 rounded-xl text-sm text-gray-300 font-medium transition-all"
                      onClick={async () => {
                        const { data: s } = await supabase.auth.getSession()
                        await fetch(a.action!, {
                          method: a.method,
                          headers: { Authorization: `Bearer ${s.session?.access_token}` },
                        })
                        alert("Cron déclenché !")
                      }}
                    >
                      {a.label}
                    </button>
                  )
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "users" && (
          <div className="bg-[#111] border border-white/8 rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-white/5">
              <h2 className="text-white font-bold">Utilisateurs récents</h2>
              <p className="text-gray-600 text-xs mt-0.5">Basé sur les événements analytics</p>
            </div>
            <div className="divide-y divide-white/5 max-h-[500px] overflow-y-auto">
              {(recentEvents ?? [])
                .filter((e: any) => e.event === "signup" || e.event === "login")
                .slice(0, 30)
                .map((e: any, i: number) => (
                  <div key={i} className="flex items-center gap-4 px-5 py-3 hover:bg-white/3 transition-all">
                    <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs text-gray-400 font-bold">{e.user_id?.slice(0, 2).toUpperCase() ?? "?"}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-300 text-sm font-medium truncate">{e.user_id ?? "Anonyme"}</p>
                      <p className="text-gray-600 text-xs">{new Date(e.created_at).toLocaleString("fr-FR")}</p>
                    </div>
                    <Badge
                      label={e.event}
                      color={e.event === "signup" ? "bg-green-500/15 text-green-400" : "bg-blue-500/15 text-blue-400"}
                    />
                  </div>
                ))}
            </div>
          </div>
        )}

        {activeTab === "events" && (
          <div className="bg-[#111] border border-white/8 rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-white/5">
              <h2 className="text-white font-bold">Événements récents</h2>
              <p className="text-gray-600 text-xs mt-0.5">50 derniers événements</p>
            </div>
            <div className="divide-y divide-white/5 max-h-[500px] overflow-y-auto">
              {(recentEvents ?? []).map((e: any, i: number) => (
                <div key={i} className="flex items-center gap-4 px-5 py-3 hover:bg-white/3 transition-all">
                  <span className="text-gray-600 text-xs w-20 flex-shrink-0 font-mono">
                    {new Date(e.created_at).toLocaleTimeString("fr-FR")}
                  </span>
                  <Badge
                    label={e.event}
                    color={
                      e.event === "signup" ? "bg-green-500/15 text-green-400" :
                      e.event === "upgrade" ? "bg-yellow-500/15 text-yellow-400" :
                      "bg-white/5 text-gray-400"
                    }
                  />
                  {e.metadata && Object.keys(e.metadata).length > 0 && (
                    <span className="text-gray-600 text-xs truncate font-mono">
                      {JSON.stringify(e.metadata)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
