"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"

type Signal = {
  id: string
  ticker: string
  direction: string
  prix_entree: number
  take_profit_1: number
  take_profit_2: number
  take_profit_3: number
  stop_loss: number
  timeframe: string
  score_confiance: number
  statut: string
  indicateurs: any
  created_at: string
}

export default function Signaux() {
  const router = useRouter()
  const [signaux, setSignaux] = useState<Signal[]>([])
  const [user, setUser] = useState<any>(null)
  const [plan, setPlan] = useState("free")
  const [filtre, setFiltre] = useState("tous")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        router.push("/login")
        return
      }
      setUser(data.user)

      const { data: profile } = await supabase
        .from("profiles")
        .select("plan")
        .eq("email", data.user.email)
        .single()

      const userPlan = profile?.plan ?? "free"
      setPlan(userPlan)

      if (userPlan === "free") {
        setLoading(false)
        return
      }

      const { data: signaux } = await supabase
        .from("signaux")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50)

      if (signaux) setSignaux(signaux)
      setLoading(false)
    })
  }, [])

  const filtres = ["tous", "LONG", "SHORT", "scalp", "swing", "position"]

  const signauxFiltres = signaux.filter((s) => {
    if (filtre === "tous") return true
    if (filtre === "LONG" || filtre === "SHORT") return s.direction === filtre
    return s.timeframe === filtre
  })

  function scoreColor(score: number) {
    if (score >= 80) return "text-green-400"
    if (score >= 70) return "text-yellow-400"
    return "text-orange-400"
  }

  function scoreBg(score: number) {
    if (score >= 80) return "bg-green-500/20 border-green-500/30"
    if (score >= 70) return "bg-yellow-500/20 border-yellow-500/30"
    return "bg-orange-500/20 border-orange-500/30"
  }

  function timeAgo(date: string) {
    const diff = Date.now() - new Date(date + "Z").getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 2) return "à l'instant"
    if (mins < 60) return `il y a ${mins} min`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `il y a ${hours}h`
    return `il y a ${Math.floor(hours / 24)}j`
  }

  function pnlPotentiel(entree: number, tp3: number, direction: string) {
    const pct = direction === "LONG"
      ? ((tp3 - entree) / entree * 100)
      : ((entree - tp3) / entree * 100)
    return pct.toFixed(1)
  }

  if (loading) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <p className="text-gray-400">Chargement...</p>
    </div>
  )

  if (plan === "free") return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-8">
      <div className="max-w-md text-center">
        <div className="text-6xl mb-6">🔒</div>
        <h1 className="text-3xl font-bold mb-4">Signaux algorithmiques</h1>
        <p className="text-gray-400 mb-4">
          Notre algorithme analyse 10 actifs toutes les 15 minutes et génère des signaux de trading avec raisonnement IA complet.
        </p>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-6 text-left">
          <p className="text-gray-400 text-sm mb-3">Ce que tu obtiens avec Pro :</p>
          <ul className="space-y-2 text-sm">
            <li className="flex gap-2"><span className="text-green-400">✓</span> Signaux avec 24h de délai</li>
            <li className="flex gap-2"><span className="text-green-400">✓</span> RSI, MACD, Bollinger, MM</li>
            <li className="flex gap-2"><span className="text-green-400">✓</span> TP1, TP2, TP3 + Stop Loss</li>
            <li className="flex gap-2"><span className="text-green-400">✓</span> Raisonnement IA complet</li>
            <li className="flex gap-2"><span className="text-yellow-400">✓</span> Premium : signaux temps réel + SMS</li>
          </ul>
        </div>
        <a href="/pricing" className="block w-full bg-green-500 hover:bg-green-600 text-white py-4 rounded-lg font-semibold transition text-center">
          Upgrader mon plan
        </a>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-6xl mx-auto">

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Signaux algorithmiques</h1>
            <p className="text-gray-400 mt-1">
              {plan === "pro"
                ? "⏰ Signaux avec 24h de délai — passez Premium pour le temps réel"
                : "⚡ Signaux en temps réel"}
            </p>
          </div>
          <span className={`text-xs px-3 py-1 rounded-full font-semibold uppercase ${
            plan === "premium"
              ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
              : "bg-green-500/20 text-green-400 border border-green-500/30"
          }`}>
            {plan === "pro" ? "⭐ Pro" : "💎 Premium"}
          </span>
        </div>

        <div className="flex gap-2 mb-8 flex-wrap">
          {filtres.map((f) => (
            <button
              key={f}
              onClick={() => setFiltre(f)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition capitalize ${
                filtre === f
                  ? "bg-green-500 text-white"
                  : "bg-gray-900 border border-gray-800 text-gray-400 hover:border-gray-600"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {signauxFiltres.length === 0 ? (
          <div className="text-center text-gray-400 py-24">
            <p className="text-5xl mb-4">📡</p>
            <p className="text-xl">Aucun signal pour l'instant</p>
            <p className="mt-2 text-sm">L'algorithme analyse les marchés toutes les 15 minutes</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {signauxFiltres.map((signal) => (
              <div
                key={signal.id}
                onClick={() => router.push(`/signaux/${signal.id}`)}
                className="bg-gray-900 border border-gray-800 rounded-2xl p-6 hover:border-gray-600 cursor-pointer transition group"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-white font-bold text-2xl">{signal.ticker}</span>
                    <span className={`text-xs px-3 py-1 rounded-full font-bold border ${
                      signal.direction === "LONG"
                        ? "bg-green-500/20 text-green-400 border-green-500/30"
                        : "bg-red-500/20 text-red-400 border-red-500/30"
                    }`}>
                      {signal.direction === "LONG" ? "▲ LONG" : "▼ SHORT"}
                    </span>
                    <span className="text-xs text-gray-500 capitalize bg-gray-800 px-2 py-1 rounded">
                      {signal.timeframe}
                    </span>
                  </div>
                  <div className={`text-xs px-3 py-1 rounded-full font-bold border ${scoreBg(signal.score_confiance)}`}>
                    <span className={scoreColor(signal.score_confiance)}>
                      {signal.score_confiance}% confiance
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-gray-800 rounded-xl p-3">
                    <p className="text-gray-400 text-xs mb-1">Entrée</p>
                    <p className="text-white font-bold">${signal.prix_entree}</p>
                  </div>
                  <div className="bg-red-500/10 rounded-xl p-3">
                    <p className="text-red-400 text-xs mb-1">Stop Loss</p>
                    <p className="text-white font-bold">${signal.stop_loss}</p>
                  </div>
                  <div className="bg-green-500/10 rounded-xl p-3">
                    <p className="text-green-400 text-xs mb-1">TP1 / TP2</p>
                    <p className="text-white font-bold">${signal.take_profit_1} / ${signal.take_profit_2}</p>
                  </div>
                  <div className="bg-green-500/20 rounded-xl p-3">
                    <p className="text-green-400 text-xs mb-1">TP3 (objectif max)</p>
                    <p className="text-white font-bold">${signal.take_profit_3}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mb-4">
                  {signal.indicateurs?.signals?.slice(0, 3).map((s: string, i: number) => (
                    <span key={i} className="text-xs bg-gray-800 text-gray-400 px-2 py-1 rounded-lg">
                      {s.split("→")[0].trim()}
                    </span>
                  ))}
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">{timeAgo(signal.created_at)}</span>
                  <span className="text-green-400 group-hover:text-green-300 transition text-sm font-semibold">
                    Potentiel +{pnlPotentiel(signal.prix_entree, signal.take_profit_3, signal.direction)}% →
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  )
}