"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"

const SAMPLE_BRIEF = {
  date: "Jeudi 5 juin 2026",
  market: { regime: "Risk On", vix: "14.2", change: "+0.8%" },
  signals: [
    { symbol: "NVDA",    signal: "STRONG_BUY",  confluence: 89, price: "$923.50", change: "+3.2%" },
    { symbol: "AAPL",    signal: "BUY",          confluence: 74, price: "$198.30", change: "+1.1%" },
    { symbol: "BTC-USD", signal: "STRONG_BUY",   confluence: 82, price: "$68,420", change: "+2.8%" },
  ],
  insight: "Les marchés sont portés par l'optimisme autour des résultats NVDA attendus la semaine prochaine. Le secteur tech montre une force relative exceptionnelle avec un VIX à des plus bas annuels.",
  tip: "Surveille les supports sur QQQ autour de $455 comme point d'entrée si la tendance se confirme.",
}

export default function BriefPage() {
  const [email,      setEmail]      = useState("")
  const [subscribed, setSubscribed] = useState(false)
  const [loading,    setLoading]    = useState(false)
  const [user,       setUser]       = useState<any>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUser(data.user)
        setEmail(data.user.email ?? "")
      }
    })
  }, [])

  async function subscribe() {
    if (!email) return
    setLoading(true)
    await fetch("/api/newsletter/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, source: "brief_page" }),
    })
    setSubscribed(true)
    setLoading(false)
  }

  return (
    <div className="min-h-screen page-enter">
      <div className="max-w-xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-3xl mx-auto mb-4 flex items-center justify-center text-3xl"
            style={{ background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.2)" }}>
            ☀️
          </div>
          <p className="text-xs font-black text-yellow-400 uppercase tracking-widest mb-1">The Tradex Brief</p>
          <h1 className="text-3xl font-black text-white mb-2">Ton briefing marché à 7h</h1>
          <p className="text-white/40 text-sm max-w-sm mx-auto">
            3 signaux top du jour · Sentiment marché · 1 tip actionnable<br />
            <strong className="text-white/60">Chaque matin avant l'ouverture.</strong>
          </p>
        </div>

        {/* Subscribe card */}
        {!subscribed ? (
          <div className="rounded-2xl p-6 mb-8" style={{ background: "rgba(251,191,36,0.05)", border: "1px solid rgba(251,191,36,0.15)" }}>
            <p className="text-sm font-black text-white mb-4">S'abonner gratuitement</p>
            <div className="flex gap-2">
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="ton@email.com"
                className="flex-1 px-4 py-3 rounded-xl text-sm text-white placeholder-white/20 outline-none"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
              />
              <button onClick={subscribe} disabled={!email || loading}
                className="px-5 py-3 rounded-xl text-sm font-black text-black transition-all hover:scale-[1.02] disabled:opacity-50"
                style={{ background: "#fbbf24" }}>
                {loading ? "…" : "S'abonner"}
              </button>
            </div>
            <p className="text-[10px] text-white/20 mt-2 text-center">Gratuit · Sans spam · Désinscription en 1 clic</p>
          </div>
        ) : (
          <div className="rounded-2xl p-6 mb-8 text-center" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}>
            <p className="text-2xl mb-2">✅</p>
            <p className="text-white font-black">Inscrit ! Tu recevras ton premier Brief demain à 7h.</p>
          </div>
        )}

        {/* Sample brief */}
        <p className="text-xs font-black text-white/25 uppercase tracking-widest mb-3">Aperçu d'un Brief</p>
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.1)" }}>

          {/* Brief header */}
          <div className="px-5 py-4"
            style={{ background: "linear-gradient(135deg, #0a1628, #0d1f0d)" }}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center font-black text-xs text-black"
                  style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)" }}>T</div>
                <span className="text-sm font-black text-white">The Tradex Brief</span>
              </div>
              <span className="text-xs text-white/30">{SAMPLE_BRIEF.date}</span>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs px-2 py-0.5 rounded-full font-black" style={{ background: "rgba(34,197,94,0.2)", color: "#4ade80" }}>
                {SAMPLE_BRIEF.market.regime}
              </span>
              <span className="text-xs text-white/40">VIX {SAMPLE_BRIEF.market.vix}</span>
              <span className="text-xs text-green-400 font-bold">S&P500 {SAMPLE_BRIEF.market.change}</span>
            </div>
          </div>

          {/* Signals */}
          <div className="px-5 py-4 border-t border-white/5">
            <p className="text-xs font-black text-white/25 uppercase tracking-widest mb-3">📡 Top 3 signaux du jour</p>
            <div className="space-y-2">
              {SAMPLE_BRIEF.signals.map((s, i) => (
                <div key={s.symbol} className="flex items-center justify-between px-3 py-2.5 rounded-xl"
                  style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.12)" }}>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-white/40">#{i+1}</span>
                    <span className="text-sm font-black text-white">{s.symbol}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-black"
                      style={{ background: "rgba(34,197,94,0.15)", color: "#4ade80" }}>
                      {s.signal.replace("_", " ")}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black text-white">{s.price}</p>
                    <p className="text-[10px] text-green-400 font-bold">{s.change}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Insight */}
          <div className="px-5 py-4 border-t border-white/5">
            <p className="text-xs font-black text-white/25 uppercase tracking-widest mb-2">🧠 Analyse IA du marché</p>
            <p className="text-sm text-white/60 leading-relaxed">{SAMPLE_BRIEF.insight}</p>
          </div>

          {/* Tip */}
          <div className="px-5 py-4 border-t border-white/5"
            style={{ background: "rgba(251,191,36,0.04)" }}>
            <p className="text-xs font-black text-yellow-400 uppercase tracking-widest mb-1">💡 Tip du jour</p>
            <p className="text-sm text-white/60 leading-relaxed">{SAMPLE_BRIEF.tip}</p>
          </div>
        </div>

        <p className="text-center text-xs text-white/15 mt-4">
          Envoyé chaque matin à 7h00 · Lundi–Vendredi
        </p>
      </div>
    </div>
  )
}
