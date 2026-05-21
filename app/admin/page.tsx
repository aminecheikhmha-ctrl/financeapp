"use client"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"

const ADMIN_EMAIL = "olfagni@gmail.com"

export default function AdminPage() {
  const router = useRouter()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

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

  const mrr = data.mrr

  return (
    <div className="min-h-screen bg-[#080808] px-6 py-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-black text-white">Admin Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Vue d'ensemble FinanceApp</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Utilisateurs total", value: data.users.total, color: "text-white" },
          { label: "Actifs aujourd'hui", value: data.users.activeToday, color: "text-green-400" },
          { label: "Nouveaux (7j)", value: data.users.newThisWeek, color: "text-blue-400" },
          { label: "MRR estimé", value: `${mrr}€`, color: "text-yellow-400" },
        ].map(s => (
          <div key={s.label} className="bg-[#111] border border-white/8 rounded-xl p-4">
            <p className="text-gray-500 text-xs mb-1 font-semibold uppercase tracking-wide">{s.label}</p>
            <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Plans */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: "Free", count: data.plans.free, color: "text-gray-400", bg: "bg-white/5" },
          { label: "Pro", count: data.plans.pro, color: "text-green-400", bg: "bg-green-500/10" },
          { label: "Premium", count: data.plans.premium, color: "text-yellow-400", bg: "bg-yellow-500/10" },
        ].map(p => (
          <div key={p.label} className={`${p.bg} border border-white/8 rounded-xl p-4 text-center`}>
            <p className={`text-3xl font-black ${p.color}`}>{p.count}</p>
            <p className="text-gray-500 text-xs font-semibold mt-1">{p.label}</p>
          </div>
        ))}
      </div>

      {/* Growth chart */}
      <div className="bg-[#111] border border-white/8 rounded-xl p-5 mb-8">
        <h2 className="text-white font-bold mb-4">Croissance (30 derniers jours)</h2>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data.growth}>
            <defs>
              <linearGradient id="gGrowth" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#4ade80" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#4ade80" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="date" tick={{ fill: "#6b7280", fontSize: 11 }} tickFormatter={d => d.slice(5)} />
            <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} />
            <Tooltip
              contentStyle={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }}
              labelStyle={{ color: "#9ca3af" }}
              itemStyle={{ color: "#4ade80" }}
            />
            <Area type="monotone" dataKey="count" stroke="#4ade80" fill="url(#gGrowth)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Recent events */}
      <div className="bg-[#111] border border-white/8 rounded-xl p-5">
        <h2 className="text-white font-bold mb-4">Événements récents</h2>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {data.recentEvents.map((e: any, i: number) => (
            <div key={i} className="flex items-center gap-3 text-sm py-1.5 border-b border-white/5">
              <span className="text-gray-600 text-xs w-24 flex-shrink-0">{new Date(e.created_at).toLocaleTimeString("fr-FR")}</span>
              <span className="text-green-400 font-mono text-xs font-semibold">{e.event}</span>
              {e.metadata && Object.keys(e.metadata).length > 0 && (
                <span className="text-gray-600 text-xs truncate">{JSON.stringify(e.metadata)}</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
