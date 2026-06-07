"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"

type BriefSignal = {
  symbol: string
  signal: string
  confluence: number
  price: string
  change: string
  bullish: boolean
}

type BriefData = {
  date: string
  market: { regime: string; vix: string; change: string; sentiment: number }
  signals: BriefSignal[]
  insight: string
  tip: string
  loading: boolean
}

function sentimentLabel(pct: number) {
  if (pct >= 70) return { label: "Très haussier 🚀", color: "#4ade80" }
  if (pct >= 55) return { label: "Haussier 📈", color: "#86efac" }
  if (pct <= 30) return { label: "Très baissier 📉", color: "#f87171" }
  if (pct <= 45) return { label: "Baissier 🐻", color: "#fca5a5" }
  return { label: "Neutre ⚖️", color: "#f59e0b" }
}

function SignalBadge({ signal }: { signal: string }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    "ACHAT_FORT": { label: "⚡ Strong Buy", color: "#4ade80", bg: "rgba(34,197,94,0.15)" },
    "ACHAT":      { label: "↗ Buy",         color: "#86efac", bg: "rgba(34,197,94,0.10)" },
    "VENTE_FORT": { label: "⚡ Strong Sell", color: "#f87171", bg: "rgba(239,68,68,0.15)" },
    "VENTE":      { label: "↘ Sell",        color: "#fca5a5", bg: "rgba(239,68,68,0.10)" },
  }
  const s = map[signal] ?? { label: signal, color: "#60a5fa", bg: "rgba(96,165,250,0.10)" }
  return (
    <span className="text-[10px] font-black px-2 py-0.5 rounded-full"
      style={{ background: s.bg, color: s.color, border: `1px solid ${s.color}30` }}>
      {s.label}
    </span>
  )
}

export default function BriefPage() {
  const router = useRouter()
  const [email,      setEmail]      = useState("")
  const [subscribed, setSubscribed] = useState(false)
  const [subLoading, setSubLoading] = useState(false)
  const [user,       setUser]       = useState<any>(null)
  const [brief,      setBrief]      = useState<BriefData>({
    date: "",
    market: { regime: "—", vix: "—", change: "—", sentiment: 50 },
    signals: [],
    insight: "",
    tip: "",
    loading: true,
  })

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) { setUser(data.user); setEmail(data.user.email ?? "") }
    })
    loadBrief()
  }, [])

  async function loadBrief() {
    try {
      // Fetch signaux réels
      const [signalsRes, macroRes] = await Promise.allSettled([
        fetch("/api/signals"),
        fetch("/api/macro/snapshot"),
      ])

      let signals: BriefSignal[] = []
      let market = { regime: "Risk On", vix: "—", change: "—", sentiment: 50 }
      let insight = ""
      let tip = ""

      if (signalsRes.status === "fulfilled" && signalsRes.value.ok) {
        const data = await signalsRes.value.json()
        const rawSignals = (data.signals ?? []) as any[]
        const stats = data.stats

        // Top 3 par confluence
        const top3 = [...rawSignals]
          .sort((a, b) => b.confluence_score - a.confluence_score)
          .slice(0, 3)

        signals = top3.map(s => ({
          symbol:     s.symbol.replace("-USD", ""),
          signal:     s.signal,
          confluence: Math.round(s.confluence_score),
          price:      s.price > 1000
            ? `$${s.price.toLocaleString("en-US", { maximumFractionDigits: 0 })}`
            : `$${s.price.toFixed(2)}`,
          change:     `${s.change_24h >= 0 ? "+" : ""}${s.change_24h.toFixed(2)}%`,
          bullish:    s.signal === "ACHAT" || s.signal === "ACHAT_FORT",
        }))

        // Sentiment
        if (stats?.total > 0) {
          market.sentiment = Math.round((stats.achats / stats.total) * 100)
        }

        // Générer insight depuis les données
        const bullishCount = rawSignals.filter((s: any) => s.signal === "ACHAT" || s.signal === "ACHAT_FORT").length
        const bearishCount = rawSignals.filter((s: any) => s.signal === "VENTE" || s.signal === "VENTE_FORT").length
        const avgConf = stats?.avg_confluence ?? 0
        const topSymbol = top3[0]?.symbol?.replace("-USD", "") ?? "le marché"

        if (bullishCount > bearishCount * 1.5) {
          insight = `Le marché affiche une tendance nettement haussière avec ${bullishCount} signaux d'achat contre ${bearishCount} de vente. Le score de confiance moyen de ${avgConf.toFixed(0)}% indique des setups de qualité. ${topSymbol} se démarque comme la meilleure opportunité du jour.`
          tip = `Priorité aux ${top3[0]?.signal === "ACHAT_FORT" ? "Strong Buys" : "achats"} — concentre-toi sur $${topSymbol} avec un sizing adapté à ton capital. Respecte toujours ton stop loss.`
        } else if (bearishCount > bullishCount * 1.5) {
          insight = `Marché baissier dominant avec ${bearishCount} signaux de vente. Sois prudent et réduis l'exposition. Le score moyen de ${avgConf.toFixed(0)}% suggère une conviction modérée.`
          tip = `Journée à éviter pour les positions longues. Si tu es déjà en position, surveille tes stops. Le cash est aussi une position.`
        } else {
          insight = `Marché mixte avec ${bullishCount} signaux haussiers et ${bearishCount} baissiers. Score de confiance moyen : ${avgConf.toFixed(0)}%. Sélectivité maximale recommandée — seuls les signaux forts méritent attention.`
          tip = `Dans un marché indécis, mise sur la qualité pas la quantité. Filtre sur les confluences > 70% uniquement.`
        }
      }

      if (macroRes.status === "fulfilled" && macroRes.value.ok) {
        const macroData = await macroRes.value.json()
        const spy = macroData?.assets?.find((a: any) => a.key === "SPY")
        const vixData = macroData?.assets?.find((a: any) => a.key === "VIX")
        if (spy) market.change = `${(spy.change1d ?? 0) >= 0 ? "+" : ""}${(spy.change1d ?? 0).toFixed(2)}%`
        if (vixData) market.vix = (vixData.price ?? 0).toFixed(1)
        if (macroData?.regime) market.regime = macroData.regime
      }

      const now = new Date()
      const dateStr = now.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })

      setBrief({
        date: dateStr.charAt(0).toUpperCase() + dateStr.slice(1),
        market,
        signals,
        insight,
        tip,
        loading: false,
      })
    } catch {
      setBrief(prev => ({ ...prev, loading: false }))
    }
  }

  async function subscribe() {
    if (!email) return
    setSubLoading(true)
    await fetch("/api/newsletter/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, source: "brief_page" }),
    })
    setSubscribed(true)
    setSubLoading(false)
  }

  const sentiment = sentimentLabel(brief.market.sentiment)

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

        {/* Subscribe */}
        {!subscribed ? (
          <div className="rounded-2xl p-6 mb-8"
            style={{ background: "rgba(251,191,36,0.05)", border: "1px solid rgba(251,191,36,0.15)" }}>
            <p className="text-sm font-black text-white mb-4">S'abonner gratuitement</p>
            <div className="flex gap-2">
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="ton@email.com"
                className="flex-1 px-4 py-3 rounded-xl text-sm text-white placeholder-white/20 outline-none"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }} />
              <button onClick={subscribe} disabled={!email || subLoading}
                className="px-5 py-3 rounded-xl text-sm font-black text-black transition-all hover:scale-[1.02] disabled:opacity-50"
                style={{ background: "#fbbf24" }}>
                {subLoading ? "…" : "S'abonner"}
              </button>
            </div>
            <p className="text-[10px] text-white/20 mt-2 text-center">Gratuit · Sans spam · Désinscription en 1 clic</p>
          </div>
        ) : (
          <div className="rounded-2xl p-6 mb-8 text-center"
            style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}>
            <p className="text-2xl mb-2">✅</p>
            <p className="text-white font-black">Inscrit ! Tu recevras ton premier Brief demain à 7h.</p>
          </div>
        )}

        {/* Brief du jour — données réelles */}
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-black text-white/25 uppercase tracking-widest">Brief du jour</p>
          {!brief.loading && (
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-[10px] text-white/30 font-bold">Données live</span>
            </div>
          )}
        </div>

        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.1)" }}>

          {/* Brief header */}
          <div className="px-5 py-4"
            style={{ background: "linear-gradient(135deg, rgba(10,22,40,0.9), rgba(13,31,13,0.9))" }}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center font-black text-xs text-black"
                  style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)" }}>T</div>
                <span className="text-sm font-black text-white">The Tradex Brief</span>
              </div>
              <span className="text-xs text-white/30">
                {brief.loading ? "Chargement…" : brief.date}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs px-2 py-0.5 rounded-full font-black"
                style={{ background: "rgba(34,197,94,0.2)", color: "#4ade80" }}>
                {brief.market.regime}
              </span>
              {brief.market.vix !== "—" && (
                <span className="text-xs text-white/40">VIX {brief.market.vix}</span>
              )}
              {brief.market.change !== "—" && (
                <span className={`text-xs font-bold ${brief.market.change.startsWith("+") ? "text-green-400" : "text-red-400"}`}>
                  S&P500 {brief.market.change}
                </span>
              )}
              <span className="text-xs font-bold ml-auto" style={{ color: sentiment.color }}>
                {sentiment.label}
              </span>
            </div>
          </div>

          {/* Sentiment bar */}
          <div className="px-5 py-3 border-t" style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.01)" }}>
            <div className="flex justify-between text-[10px] mb-1.5" style={{ color: "var(--text-muted)" }}>
              <span className="text-red-400">Baissier</span>
              <span className="font-black" style={{ color: sentiment.color }}>
                Sentiment : {brief.market.sentiment}% haussier
              </span>
              <span className="text-green-400">Haussier</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
              <div className="h-full rounded-full transition-all duration-1000"
                style={{
                  width: `${brief.market.sentiment}%`,
                  background: brief.market.sentiment >= 55 ? "linear-gradient(90deg, rgba(34,197,94,0.5), #22c55e)" : "linear-gradient(90deg, rgba(239,68,68,0.5), #ef4444)",
                }} />
            </div>
          </div>

          {/* Top 3 signaux */}
          <div className="px-5 py-4 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
            <p className="text-xs font-black text-white/25 uppercase tracking-widest mb-3">📡 Top 3 signaux du jour</p>
            {brief.loading ? (
              <div className="space-y-2">
                {[1,2,3].map(i => (
                  <div key={i} className="h-12 skeleton rounded-xl" />
                ))}
              </div>
            ) : brief.signals.length === 0 ? (
              <p className="text-sm text-white/30 text-center py-4">Aucun signal disponible pour le moment</p>
            ) : (
              <div className="space-y-2">
                {brief.signals.map((s, i) => (
                  <button key={s.symbol}
                    onClick={() => router.push(`/signaux/${s.symbol}`)}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all hover:bg-white/[0.03]"
                    style={{
                      background: s.bullish ? "rgba(34,197,94,0.06)" : "rgba(239,68,68,0.06)",
                      border: `1px solid ${s.bullish ? "rgba(34,197,94,0.14)" : "rgba(239,68,68,0.14)"}`,
                    }}>
                    <div className="flex items-center gap-2.5">
                      <span className="text-xs font-black text-white/30">#{i+1}</span>
                      <span className="text-sm font-black text-white">{s.symbol}</span>
                      <SignalBadge signal={s.signal} />
                      <span className="text-[10px] text-white/30">{s.confluence}% conf.</span>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-black text-white">{s.price}</p>
                      <p className={`text-[10px] font-bold ${s.change.startsWith("+") ? "text-green-400" : "text-red-400"}`}>
                        {s.change}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Insight IA */}
          <div className="px-5 py-4 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
            <p className="text-xs font-black text-white/25 uppercase tracking-widest mb-2">🧠 Analyse IA du marché</p>
            {brief.loading ? (
              <div className="space-y-1.5">
                <div className="h-3 skeleton rounded w-full" />
                <div className="h-3 skeleton rounded w-4/5" />
                <div className="h-3 skeleton rounded w-3/4" />
              </div>
            ) : (
              <p className="text-sm text-white/60 leading-relaxed">
                {brief.insight || "Analyse en cours de génération…"}
              </p>
            )}
          </div>

          {/* Tip */}
          <div className="px-5 py-4 border-t"
            style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(251,191,36,0.03)" }}>
            <p className="text-xs font-black text-yellow-400 uppercase tracking-widest mb-1">💡 Tip du jour</p>
            {brief.loading ? (
              <div className="h-3 skeleton rounded w-3/4" />
            ) : (
              <p className="text-sm text-white/60 leading-relaxed">
                {brief.tip || "Tip en cours de génération…"}
              </p>
            )}
          </div>
        </div>

        {/* CTA signaux */}
        {!brief.loading && brief.signals.length > 0 && (
          <button onClick={() => router.push("/signaux")}
            className="w-full mt-4 py-3 rounded-2xl text-sm font-black text-black transition-all hover:scale-[1.01]"
            style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)", boxShadow: "0 4px 20px rgba(34,197,94,0.25)" }}>
            📡 Voir tous les signaux du jour →
          </button>
        )}

        <p className="text-center text-xs text-white/15 mt-4">
          Envoyé chaque matin à 7h00 · Lundi–Vendredi
        </p>
      </div>
    </div>
  )
}
