"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  ResponsiveContainer,
} from "recharts"

export default function CoachPage() {
  const router = useRouter()
  const [coachData, setCoachData] = useState<any>(null)
  const [marketRegime, setMarketRegime] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [activeSection, setActiveSection] = useState<"bilan" | "patterns" | "plan" | "predictions">("bilan")

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/login"); return }

      const session = await supabase.auth.getSession()
      const token = session.data.session?.access_token

      try {
        const [coachRes, regimeRes] = await Promise.all([
          fetch("/api/ai/trade-coach", { headers: { Authorization: `Bearer ${token}` } }),
          fetch("/api/ai/market-regime"),
        ])
        const [coach, regime] = await Promise.all([coachRes.json(), regimeRes.json()])
        setCoachData(coach)
        setMarketRegime(regime)
      } catch {}

      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen text-white overflow-x-hidden" style={{ background: "#080808" }}>
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 space-y-6">
          <div className="h-24 rounded-2xl animate-pulse" style={{ background: "#0d0d0d" }} />
          <div className="h-12 rounded-xl animate-pulse" style={{ background: "#0d0d0d" }} />
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 rounded-2xl animate-pulse" style={{ background: "#0d0d0d" }} />
          ))}
        </div>
      </div>
    )
  }

  if (coachData?.insufficient_data) {
    return (
      <div className="min-h-screen text-white overflow-x-hidden flex items-center justify-center" style={{ background: "#080808" }}>
        <div className="text-center py-20">
          <div className="text-5xl mb-4">📈</div>
          <h2 className="text-xl font-black text-white mb-2">Pas encore assez de données</h2>
          <p className="text-gray-500">{coachData.message}</p>
          <a href="/dashboard" className="inline-block mt-6 px-6 py-3 bg-green-500 text-black font-black rounded-xl">
            Commencer à trader →
          </a>
        </div>
      </div>
    )
  }

  const score = coachData?.score_global ?? 0
  const scoreColor = score > 70 ? "#4ade80" : score > 40 ? "#fb923c" : "#f87171"
  const scoreRingColor = score > 70 ? "text-green-400" : score > 40 ? "text-orange-400" : "text-red-400"

  const radarData = [
    { subject: "Timing", value: coachData?.score_timing ?? 0 },
    { subject: "Risque", value: coachData?.score_risk ?? 0 },
    { subject: "Discipline", value: coachData?.score_discipline ?? 0 },
    { subject: "Diversification", value: coachData?.score_diversification ?? 0 },
  ]

  const tabs = ["bilan", "patterns", "plan", "predictions"] as const

  return (
    <div className="min-h-screen text-white overflow-x-hidden" style={{ background: "#080808" }}>
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 space-y-6">

        {/* Header */}
        <div className="rounded-2xl p-6" style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-black text-white">🧠 Coach IA Personnel</h1>
            <span className="px-2 py-0.5 rounded text-xs font-black text-black" style={{ background: "#4ade80" }}>BETA</span>
          </div>
          <p className="text-gray-500 text-sm mb-4">
            Analyse basée sur tes {coachData?.total_trades ?? 0} trades
          </p>
          <div className="flex items-center gap-4">
            <div className="relative flex items-center justify-center w-20 h-20">
              <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="34" stroke="#1a1a1a" strokeWidth="8" fill="none" />
                <circle
                  cx="40" cy="40" r="34"
                  stroke={scoreColor}
                  strokeWidth="8"
                  fill="none"
                  strokeDasharray={`${(score / 100) * 213.6} 213.6`}
                  strokeLinecap="round"
                />
              </svg>
              <span className={`text-xl font-black z-10 ${scoreRingColor}`}>{score}</span>
            </div>
            <div>
              <p className="text-gray-500 text-xs uppercase tracking-wide">Score global</p>
              <p className={`text-3xl font-black ${scoreRingColor}`}>{score}<span className="text-gray-600 text-lg">/100</span></p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveSection(tab)}
              className={`flex-shrink-0 whitespace-nowrap px-4 py-2 rounded-xl text-sm font-bold transition ${
                activeSection === tab
                  ? "bg-green-500/20 text-green-400 border border-green-500/30"
                  : "text-gray-500 hover:text-white"
              }`}
            >
              {tab === "bilan" ? "📊 Mon Bilan" : tab === "patterns" ? "🔍 Mes Patterns" : tab === "plan" ? "🎯 Plan d'amélio" : "🔮 Prédictions"}
            </button>
          ))}
        </div>

        {/* Section Bilan */}
        {activeSection === "bilan" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Timing", value: coachData?.score_timing ?? 0 },
                { label: "Gestion risque", value: coachData?.score_risk ?? 0 },
                { label: "Diversification", value: coachData?.score_diversification ?? 0 },
                { label: "Discipline", value: coachData?.score_discipline ?? 0 },
              ].map(({ label, value }) => {
                const color = value > 70 ? "#4ade80" : value > 40 ? "#fb923c" : "#f87171"
                const textColor = value > 70 ? "text-green-400" : value > 40 ? "text-orange-400" : "text-red-400"
                return (
                  <div key={label} className="rounded-2xl p-4" style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>
                    <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-2">{label}</p>
                    <p className={`text-2xl font-black ${textColor}`}>{value}<span className="text-gray-600 text-sm">/100</span></p>
                    <div className="mt-2 h-1.5 rounded-full" style={{ background: "#1a1a1a" }}>
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${value}%`, background: color }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="rounded-2xl p-4" style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>
              <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-3">Radar de performance</p>
              <ResponsiveContainer width="100%" height={220}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#1a1a1a" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: "#6b7280", fontSize: 12 }} />
                  <Radar dataKey="value" stroke="#4ade80" fill="#4ade80" fillOpacity={0.15} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Section Patterns */}
        {activeSection === "patterns" && (
          <div className="space-y-3">
            {(coachData?.patterns ?? []).length === 0 ? (
              <div className="rounded-2xl p-8 text-center" style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>
                <p className="text-gray-500">Aucun pattern détecté pour l'instant.</p>
              </div>
            ) : (coachData?.patterns ?? []).map((pattern: any, i: number) => {
              const isPositive = pattern.type === "positif"
              const isNegative = pattern.type === "negatif"
              const icon = isPositive ? "✅" : isNegative ? "⚠️" : "❌"
              const borderColor = isPositive ? "#4ade80" : isNegative ? "#fb923c" : "#f87171"
              return (
                <div
                  key={i}
                  className="rounded-2xl p-4"
                  style={{ background: "#0d0d0d", border: "1px solid #1a1a1a", borderLeft: `4px solid ${borderColor}` }}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-lg flex-shrink-0">{icon}</span>
                    <div className="flex-1">
                      <p className="text-white font-bold text-sm">{pattern.titre ?? pattern.description}</p>
                      {pattern.description && pattern.titre && (
                        <p className="text-gray-500 text-xs mt-1">{pattern.description}</p>
                      )}
                      {pattern.frequence && (
                        <p className="text-gray-600 text-xs mt-1">Fréquence : {pattern.frequence}</p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Section Plan */}
        {activeSection === "plan" && (
          <div className="space-y-4">
            <div className="space-y-3">
              {(coachData?.objectifs ?? []).slice(0, 3).map((obj: any, i: number) => (
                <div key={i} className="rounded-2xl p-4 flex gap-4" style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>
                  <div className="w-8 h-8 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center font-black text-sm flex-shrink-0">
                    {i + 1}
                  </div>
                  <div className="flex-1">
                    <p className="text-gray-500 text-[10px] uppercase tracking-wide mb-0.5">Objectif 🎯</p>
                    <p className="text-white font-semibold text-sm">{typeof obj === "string" ? obj : obj.titre ?? obj.description ?? JSON.stringify(obj)}</p>
                    {obj.description && obj.titre && (
                      <p className="text-gray-500 text-xs mt-1">{obj.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {(coachData?.cours_recommandes ?? []).length > 0 && (
              <div className="rounded-2xl p-4" style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>
                <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-3">📚 Cours recommandés</p>
                <div className="space-y-2">
                  {(coachData.cours_recommandes ?? []).map((cours: any, i: number) => (
                    <a key={i} href="/apprendre" className="flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition" style={{ border: "1px solid #1a1a1a" }}>
                      <span className="text-white text-sm font-semibold">{typeof cours === "string" ? cours : cours.titre ?? cours}</span>
                      <span className="text-green-400 text-xs">→</span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {coachData?.exercice_semaine && (
              <div className="rounded-2xl p-4" style={{ background: "rgba(74, 222, 128, 0.05)", border: "1px solid rgba(74, 222, 128, 0.2)" }}>
                <p className="text-green-400 text-xs font-black uppercase tracking-wide mb-2">💪 Exercice de la semaine</p>
                <p className="text-white text-sm leading-relaxed">{coachData.exercice_semaine}</p>
              </div>
            )}
          </div>
        )}

        {/* Section Prédictions */}
        {activeSection === "predictions" && (
          <div className="space-y-4">
            {coachData?.synthese && (
              <div className="rounded-2xl p-5" style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>
                <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-2">Synthèse</p>
                <p className="text-white text-sm leading-relaxed">{coachData.synthese}</p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(coachData?.actifs_performants ?? []).length > 0 && (
                <div className="rounded-2xl p-4" style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>
                  <p className="text-green-400 text-xs font-black uppercase tracking-wide mb-3">✅ Actifs performants</p>
                  <div className="space-y-2">
                    {(coachData.actifs_performants ?? []).map((actif: string, i: number) => (
                      <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: "rgba(74, 222, 128, 0.05)", border: "1px solid rgba(74, 222, 128, 0.15)" }}>
                        <span className="text-green-400 text-xs">▲</span>
                        <span className="text-white text-sm font-semibold">{actif}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(coachData?.actifs_sous_performants ?? []).length > 0 && (
                <div className="rounded-2xl p-4" style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>
                  <p className="text-red-400 text-xs font-black uppercase tracking-wide mb-3">⚠️ Sous-performants</p>
                  <div className="space-y-2">
                    {(coachData.actifs_sous_performants ?? []).map((actif: string, i: number) => (
                      <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: "rgba(248, 113, 113, 0.05)", border: "1px solid rgba(248, 113, 113, 0.15)" }}>
                        <span className="text-red-400 text-xs">▼</span>
                        <span className="text-white text-sm font-semibold">{actif}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {(coachData?.meilleures_periodes ?? []).length > 0 && (
              <div className="rounded-2xl p-4" style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>
                <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-3">🕐 Meilleures périodes</p>
                <div className="flex flex-wrap gap-2">
                  {(coachData.meilleures_periodes ?? []).map((periode: string, i: number) => (
                    <span key={i} className="px-3 py-1.5 rounded-xl text-xs font-bold text-green-400" style={{ background: "rgba(74, 222, 128, 0.1)", border: "1px solid rgba(74, 222, 128, 0.2)" }}>
                      {periode}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
