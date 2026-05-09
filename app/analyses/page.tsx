"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"

export default function Analyses() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [plan, setPlan] = useState("free")
  const [ticker, setTicker] = useState("")
  const [resultat, setResultat] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [restant, setRestant] = useState<any>(null)
  const [historique, setHistorique] = useState<any[]>([])

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
      if (profile) setPlan(profile.plan)

      const today = new Date().toISOString().split("T")[0]
      const { data: hist } = await supabase
        .from("analyses")
        .select("*")
        .eq("user_email", data.user.email)
        .gte("created_at", `${today}T00:00:00`)
        .order("created_at", { ascending: false })
      if (hist) setHistorique(hist)
    })
  }, [])

  const limites: Record<string, number | string> = {
    free: 1,
    pro: 15,
    premium: "∞",
  }

  async function handleAnalyse() {
    if (!ticker) return
    setLoading(true)
    setError("")
    setResultat("")

    try {
      const res = await fetch("/api/analyse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: ticker.toUpperCase(), email: user.email }),
      })

      const text = await res.text()
      const data = JSON.parse(text)

      if (data.error) {
        setError(data.error)
      } else {
        setResultat(data.resultat)
        setRestant(data.restant)
        const today = new Date().toISOString().split("T")[0]
        const { data: hist } = await supabase
          .from("analyses")
          .select("*")
          .eq("user_email", user.email)
          .gte("created_at", `${today}T00:00:00`)
          .order("created_at", { ascending: false })
        if (hist) setHistorique(hist)
      }
    } catch (e: any) {
      console.error("Erreur:", e)
      setError("Erreur de connexion.")
    }

    setLoading(false)
  }

  function renderMarkdown(text: string, dimmed = false) {
    return text.split("\n").map((line, i) => {
      if (line.startsWith("### ")) return (
        <h3 key={i} className="text-white font-bold text-base mt-4 mb-1">{line.replace("### ", "")}</h3>
      )
      if (line.startsWith("## ")) return (
        <h2 key={i} className="text-white font-bold text-lg mt-4 mb-1">{line.replace("## ", "")}</h2>
      )
      if (line.startsWith("- ")) return (
        <div key={i} className="flex gap-2 ml-2 my-0.5">
          <span className="text-green-400 mt-0.5">•</span>
          <span
            className={dimmed ? "text-gray-400" : "text-gray-300"}
            dangerouslySetInnerHTML={{
              __html: line.replace("- ", "").replaceAll(/\*\*(.*?)\*\*/g, "<strong class='text-white'>$1</strong>")
            }}
          />
        </div>
      )
      if (line.trim() === "") return <div key={i} className="h-2" />
      return (
        <p
          key={i}
          className={dimmed ? "text-gray-400" : "text-gray-300"}
          dangerouslySetInnerHTML={{
            __html: line.replaceAll(/\*\*(.*?)\*\*/g, "<strong class='text-white'>$1</strong>")
          }}
        />
      )
    })
  }

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-4xl mx-auto">

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Analyses</h1>
            <p className="text-gray-400 mt-1">Analyse instantanée de n'importe quel actif</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-xs px-3 py-1 rounded-full font-semibold uppercase ${
              plan === "premium" ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30" :
              plan === "pro" ? "bg-green-500/20 text-green-400 border border-green-500/30" :
              "bg-gray-500/20 text-gray-400 border border-gray-500/30"
            }`}>
              {plan === "free" ? "Free" : plan === "pro" ? "⭐ Pro" : "💎 Premium"}
            </span>
            <span className="text-gray-400 text-sm">
              {limites[plan]} analyse{plan !== "premium" ? "(s)" : ""}/jour
            </span>
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-8">
          <div className="flex gap-4">
            <input
              type="text"
              value={ticker}
              onChange={(e) => setTicker(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAnalyse()}
              placeholder="Ticker (ex: AAPL, BTC-USD, TSLA)"
              className="flex-1 bg-gray-800 border border-gray-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:border-green-500"
            />
            <button
              onClick={handleAnalyse}
              disabled={loading}
              className="bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white px-8 py-3 rounded-lg font-semibold transition"
            >
              {loading ? "Analyse en cours..." : "Analyser"}
            </button>
          </div>

          {error && (
            <div className="mt-4 bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg">
              {error}
              {error.includes("Limite") && (
                <a href="/pricing" className="ml-2 text-green-400 hover:text-green-300 underline">
                  Upgrader mon plan
                </a>
              )}
            </div>
          )}

          {resultat && (
            <div className="mt-6 bg-gray-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-green-400 text-lg">Résultat — {ticker.toUpperCase()}</h3>
                {restant !== null && (
                  <span className="text-gray-400 text-sm bg-gray-700 px-3 py-1 rounded-full">
                    {restant} restante(s) aujourd'hui
                  </span>
                )}
              </div>
              <div className="text-sm leading-relaxed">
                {renderMarkdown(resultat)}
              </div>
            </div>
          )}
        </div>

        {historique.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Analyses d'aujourd'hui</h2>
            <div className="flex flex-col gap-4">
              {historique.map((a) => (
                <div key={a.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <span className="font-bold text-lg">{a.ticker}</span>
                    <span className="text-gray-400 text-sm">
                      {new Intl.DateTimeFormat("fr-FR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      }).format(new Date(a.created_at))}
                    </span>
                  </div>
                  <div className="text-sm leading-relaxed">
                    {renderMarkdown(a.resultat, true)}
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