"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useParams, useRouter } from "next/navigation"

// ─── Design tokens ────────────────────────────────────────────────────────────

const D = {
  bg:     "#050505",
  card:   "#0a0a0a",
  border: "rgba(255,255,255,0.06)",
  green:  "#22c55e",
  red:    "#ef4444",
  yellow: "#f59e0b",
  purple: "#8b5cf6",
} as const

// ─── Constants ────────────────────────────────────────────────────────────────

const INDICATOR_EXPLANATIONS: Record<string, string> = {
  "RSI·14": "RSI sous 35 — l'actif est en zone de survente",
  "RSI·7": "RSI court terme sous 30 — momentum très faible",
  "MACD·Hist↑": "Histogramme MACD positif et croissant — momentum haussier",
  "EMA·Cross": "EMA9 au-dessus de l'EMA21 — tendance court terme haussière",
  "BB·Lower": "Prix sous la bande de Bollinger basse — rebond probable",
  "Volume·élevé": "Volume 1.5x la moyenne — intérêt institutionnel",
  "OBV↑": "On-Balance Volume en hausse — pression acheteuse sous-jacente",
  "Stoch·%K": "Stochastique en zone de survente — momentum retournement",
  "Support": "Prix proche d'un support clé — zone d'achat potentielle",
  "Hammer": "Pattern chandelier Hammer — signal de retournement haussier",
  "Bullish Engulfing": "Bougie englobante haussière — forte pression acheteuse",
  "VWAP": "Prix sous le VWAP — opportunité d'achat pour les institutionnels",
  "RSI·14↑": "RSI en zone de surachat — pression vendeuse croissante",
  "BB·Upper": "Prix au-dessus de la bande Bollinger haute — retournement probable",
  "MACD·Hist↓": "Histogramme MACD négatif et décroissant — momentum baissier",
  "Ichimoku·Bull": "Signal Ichimoku haussier — tendance de fond positive",
  "Ichimoku·Bear": "Signal Ichimoku baissier — tendance de fond négative",
  "Shooting Star": "Pattern chandelier Shooting Star — signal de retournement baissier",
  "Bearish Engulfing": "Bougie englobante baissière — forte pression vendeuse",
  "Doji": "Doji — indécision du marché, possible retournement",
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pctChange(from: number, to: number): string {
  if (!from) return "—"
  const pct = ((to - from) / Math.abs(from)) * 100
  return (pct >= 0 ? "+" : "") + pct.toFixed(1) + "%"
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

function formatDate(date: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  }).format(new Date(date + "Z"))
}

function renderMarkdown(text: string) {
  return text.split("\n").map((line, i) => {
    if (line.startsWith("### ")) return (
      <h3 key={i} className="font-bold text-base mt-4 mb-1 text-white">{line.replace("### ", "")}</h3>
    )
    if (line.startsWith("## ")) return (
      <h2 key={i} className="font-bold text-lg mt-4 mb-1 text-white">{line.replace("## ", "")}</h2>
    )
    if (line.startsWith("- ")) return (
      <div key={i} className="flex gap-2 ml-2 my-0.5">
        <span style={{ color: "#4ade80" }}>•</span>
        <span style={{ color: "rgba(255,255,255,0.6)" }}
          dangerouslySetInnerHTML={{ __html: line.replace("- ", "").replaceAll(/\*\*(.*?)\*\*/g, "<strong style='color:white'>$1</strong>") }} />
      </div>
    )
    if (line.trim() === "") return <div key={i} className="h-2" />
    return (
      <p key={i} style={{ color: "rgba(255,255,255,0.6)" }}
        dangerouslySetInnerHTML={{ __html: line.replaceAll(/\*\*(.*?)\*\*/g, "<strong style='color:white'>$1</strong>") }} />
    )
  })
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function SignalDetail() {
  const { id } = useParams()
  const router = useRouter()
  const [signal, setSignal] = useState<any>(null)
  const [commentaires, setCommentaires] = useState<any[]>([])
  const [user, setUser] = useState<any>(null)
  const [plan, setPlan] = useState("free")
  const [contenu, setContenu] = useState("")
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [riskAmount, setRiskAmount] = useState(500)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push("/login"); return }
      setUser(data.user)
      const { data: profile } = await supabase
        .from("profiles")
        .select("plan")
        .eq("email", data.user.email)
        .single()
      setPlan(profile?.plan ?? "free")
    })

    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id as string)
    const query = isUUID
      ? supabase.from("signaux").select("*").eq("id", id).single()
      : supabase.from("signaux").select("*").eq("ticker", id).order("created_at", { ascending: false }).limit(1).single()
    query.then(({ data }) => { if (data) setSignal(data) })

    supabase.from("signaux_commentaires").select("*")
      .eq("signal_id", id).order("created_at", { ascending: true })
      .then(({ data }) => { if (data) setCommentaires(data) })
  }, [])

  useEffect(() => {
    if (!signal) return
    if (!signal.raisonnement || signal.raisonnement.length < 100) {
      handleGenerate()
    }
  }, [signal?.id])

  async function handleGenerate() {
    setGenerating(true)
    try {
      const res = await fetch("/api/signals/analyse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: signal.ticker, signal_id: signal.id }),
      })
      const data = await res.json()
      if (data.raisonnement) {
        setSignal((prev: any) => ({ ...prev, raisonnement: data.raisonnement }))
      }
    } catch {}
    setGenerating(false)
  }

  async function handleComment() {
    if (!contenu) return
    setLoading(true)
    await supabase.from("signaux_commentaires").insert({
      signal_id: id,
      user_email: user.email,
      contenu,
    })
    setContenu("")
    const { data } = await supabase.from("signaux_commentaires").select("*")
      .eq("signal_id", id).order("created_at", { ascending: true })
    if (data) setCommentaires(data)
    setLoading(false)
  }

  if (!signal) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: D.bg }}>
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: "rgba(255,255,255,0.1)", borderTopColor: "transparent" }} />
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>Chargement...</p>
      </div>
    </div>
  )

  const isLong = signal.direction === "LONG"
  const ind = signal.indicateurs as any
  const confirmedBy: string[] = ind?.confirmed_by ?? []
  const confluenceScore = ind?.confluence_score as number | undefined
  const signalType = ind?.signal as string | undefined

  // Trade setup calculations
  const slDist = signal.prix_entree && signal.stop_loss
    ? Math.abs(signal.prix_entree - signal.stop_loss)
    : 0
  const qty = slDist > 0 ? Math.max(1, Math.floor(riskAmount / slDist)) : 0
  const gainTp1 = qty && signal.take_profit_1 && signal.prix_entree
    ? qty * Math.abs(signal.take_profit_1 - signal.prix_entree)
    : 0
  const lossMax = qty * slDist

  return (
    <div className="min-h-screen" style={{ background: D.bg }}>
      <div className="max-w-6xl mx-auto px-4 py-6">

        {/* Back button */}
        <button onClick={() => router.push("/signaux")}
          className="flex items-center gap-2 text-sm mb-6 transition-all"
          style={{ color: "rgba(255,255,255,0.3)" }}
          onMouseEnter={e => (e.currentTarget.style.color = "white")}
          onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.3)")}>
          ← Retour aux signaux
        </button>

        {/* Signal header card */}
        <div className="rounded-2xl p-6 mb-6"
          style={{ background: D.card, border: `1px solid ${D.border}` }}>
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <span className="text-3xl font-black text-white">{signal.ticker}</span>
                <span className="px-3 py-1 rounded-full text-sm font-bold"
                  style={isLong
                    ? { background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)", color: "#4ade80" }
                    : { background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171" }}>
                  {isLong ? "▲ LONG" : "▼ SHORT"}
                </span>
                {signalType && (
                  <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-lg"
                    style={isLong
                      ? { background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)", color: "#4ade80" }
                      : { background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171" }}>
                    {signalType.replace("_", " ")}
                  </span>
                )}
                <span className="text-xs px-2.5 py-1 rounded-lg capitalize"
                  style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${D.border}`, color: "rgba(255,255,255,0.4)" }}>
                  {signal.timeframe}
                </span>
              </div>
              <p className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>
                Émis le {formatDate(signal.created_at)}
              </p>
            </div>
            {confluenceScore != null && (
              <div className="text-right">
                <p className="font-black text-2xl" style={{ color: confluenceScore >= 80 ? D.green : D.yellow }}>
                  {confluenceScore.toFixed(0)}%
                </p>
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>Score de confluence</p>
                <div className="w-32 h-1.5 rounded-full mt-1" style={{ background: "rgba(255,255,255,0.05)" }}>
                  <div className="h-1.5 rounded-full"
                    style={{
                      width: `${confluenceScore}%`,
                      background: isLong
                        ? "linear-gradient(to right, #16a34a, #22c55e)"
                        : "linear-gradient(to right, #dc2626, #ef4444)",
                    }} />
                </div>
              </div>
            )}
          </div>

          {/* Price levels */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-6">
            {[
              { label: "Entrée", val: signal.prix_entree, color: "rgba(255,255,255,0.4)", bg: "rgba(255,255,255,0.03)" },
              { label: "TP1", val: signal.take_profit_1, color: D.green, bg: "rgba(34,197,94,0.05)" },
              { label: "TP2", val: signal.take_profit_2, color: D.green, bg: "rgba(34,197,94,0.08)" },
              { label: "TP3", val: signal.take_profit_3, color: D.green, bg: "rgba(34,197,94,0.12)" },
              { label: "Stop Loss", val: signal.stop_loss, color: D.red, bg: "rgba(239,68,68,0.05)" },
            ].map(({ label, val, color, bg }) => (
              <div key={label} className="rounded-xl p-3 text-center" style={{ background: bg, border: `1px solid ${D.border}` }}>
                <p className="text-[10px] font-bold uppercase mb-1" style={{ color }}>{label}</p>
                <p className="text-white font-bold text-sm">
                  {val != null ? (val < 1 ? val.toFixed(4) : val.toLocaleString("fr-FR", { maximumFractionDigits: 2 })) : "—"}
                </p>
                {label !== "Entrée" && val != null && signal.prix_entree && (
                  <p className="text-[9px] mt-0.5" style={{ color: label === "Stop Loss" ? "rgba(239,68,68,0.7)" : "rgba(34,197,94,0.7)" }}>
                    {pctChange(signal.prix_entree, val)}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── 2-column layout ─────────────────────────────────────────────── */}
        <div className="flex gap-6">

          {/* LEFT — main content */}
          <div className="flex-1 min-w-0 space-y-5">

            {/* Why this signal? */}
            {confirmedBy.length > 0 && (
              <div className="rounded-2xl p-5" style={{ background: D.card, border: `1px solid ${D.border}` }}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-black text-white">Pourquoi ce signal ?</h2>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.3)" }}>
                    {confirmedBy.length} indicateur{confirmedBy.length > 1 ? "s" : ""} confirmé{confirmedBy.length > 1 ? "s" : ""}
                  </span>
                </div>
                <div className="space-y-2">
                  {confirmedBy.map(ind => (
                    <div key={ind} className="flex items-center gap-3 p-2.5 rounded-xl"
                      style={{
                        background: isLong ? "rgba(34,197,94,0.05)" : "rgba(239,68,68,0.05)",
                        border: `1px solid ${isLong ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)"}`,
                      }}>
                      <span className="text-sm flex-shrink-0" style={{ color: isLong ? D.green : D.red }}>✓</span>
                      <div>
                        <p className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.7)" }}>{ind}</p>
                        <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>
                          {INDICATOR_EXPLANATIONS[ind] ?? "Signal confirmé par cet indicateur"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Technical indicators */}
            <div className="rounded-2xl p-5" style={{ background: D.card, border: `1px solid ${D.border}` }}>
              <h2 className="text-base font-black text-white mb-4">Indicateurs techniques</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  {
                    label: "RSI(14)",
                    val: ind?.rsi != null ? ind.rsi.toFixed(1) : "—",
                    color: ind?.rsi < 30 ? D.green : ind?.rsi > 70 ? D.red : "rgba(255,255,255,0.7)",
                    sub: ind?.rsi < 30 ? "Survendu" : ind?.rsi > 70 ? "Suracheté" : "Neutre",
                  },
                  {
                    label: "MACD Histo",
                    val: ind?.macd_hist != null ? (ind.macd_hist > 0 ? "+" : "") + ind.macd_hist.toFixed(3) : "—",
                    color: ind?.macd_hist > 0 ? D.green : D.red,
                    sub: ind?.macd_hist > 0 ? "Haussier" : "Baissier",
                  },
                  {
                    label: "Bollinger %",
                    val: ind?.bb_position != null ? ind.bb_position.toFixed(1) + "%" : "—",
                    color: "rgba(255,255,255,0.7)",
                    sub: ind?.bb_position < 10 ? "Bande basse" : ind?.bb_position > 90 ? "Bande haute" : "Centre",
                  },
                  {
                    label: "Volume ratio",
                    val: ind?.volume_ratio != null ? ind.volume_ratio.toFixed(2) + "x" : "—",
                    color: ind?.volume_ratio > 1.5 ? D.green : "rgba(255,255,255,0.7)",
                    sub: ind?.volume_ratio > 1.5 ? "Élevé" : "Normal",
                  },
                ].map(item => (
                  <div key={item.label} className="rounded-xl p-3"
                    style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${D.border}` }}>
                    <p className="text-[10px] mb-1" style={{ color: "rgba(255,255,255,0.3)" }}>{item.label}</p>
                    <p className="font-black text-base tabular-nums" style={{ color: item.color }}>{item.val}</p>
                    <p className="text-[9px] mt-0.5" style={{ color: "rgba(255,255,255,0.2)" }}>{item.sub}</p>
                  </div>
                ))}
              </div>

              {/* Ichimoku + MA200 + Volume spike if available */}
              {(ind?.ichimoku_signal || ind?.above_ma200 != null || ind?.volume_spike != null) && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {ind?.ichimoku_signal && ind.ichimoku_signal !== "neutral" && (
                    <span className="text-[10px] font-semibold px-2.5 py-1 rounded-lg"
                      style={{
                        background: ind.ichimoku_signal === "bullish" ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
                        border: ind.ichimoku_signal === "bullish" ? "1px solid rgba(34,197,94,0.2)" : "1px solid rgba(239,68,68,0.2)",
                        color: ind.ichimoku_signal === "bullish" ? "#4ade80" : "#f87171",
                      }}>
                      Ichimoku {ind.ichimoku_signal === "bullish" ? "haussier ↑" : "baissier ↓"}
                    </span>
                  )}
                  {ind?.above_ma200 != null && (
                    <span className="text-[10px] font-semibold px-2.5 py-1 rounded-lg"
                      style={{
                        background: ind.above_ma200 ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
                        border: ind.above_ma200 ? "1px solid rgba(34,197,94,0.2)" : "1px solid rgba(239,68,68,0.2)",
                        color: ind.above_ma200 ? "#4ade80" : "#f87171",
                      }}>
                      {ind.above_ma200 ? "Au-dessus MA200" : "Sous MA200"}
                    </span>
                  )}
                  {ind?.volume_spike && (
                    <span className="text-[10px] font-semibold px-2.5 py-1 rounded-lg"
                      style={{
                        background: "rgba(245,158,11,0.08)",
                        border: "1px solid rgba(245,158,11,0.2)",
                        color: D.yellow,
                      }}>
                      Volume spike ×2
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* AI Analysis */}
            <div className="rounded-2xl p-5" style={{ background: D.card, border: `1px solid ${D.border}` }}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-black text-white">🤖 Analyse algorithmique</h2>
                <button onClick={handleGenerate} disabled={generating}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-40"
                  style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${D.border}`, color: "rgba(255,255,255,0.5)" }}
                  onMouseEnter={e => (e.currentTarget.style.color = "white")}
                  onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.5)")}>
                  {generating ? <><span className="animate-spin inline-block">⟳</span> Génération...</> : "↺ Régénérer"}
                </button>
              </div>
              {generating && !signal.raisonnement ? (
                <div className="space-y-3 animate-pulse">
                  {[0.75, 1, 0.85, 0.65, 0.9].map((w, i) => (
                    <div key={i} className="h-3.5 rounded" style={{ width: `${w * 100}%`, background: "rgba(255,255,255,0.05)" }} />
                  ))}
                </div>
              ) : signal.raisonnement ? (
                <div className="text-sm leading-relaxed space-y-1">
                  {renderMarkdown(signal.raisonnement)}
                </div>
              ) : (
                <p className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>
                  Génération de l'analyse en cours…
                </p>
              )}
            </div>

            {/* Community comments */}
            <div className="rounded-2xl p-5" style={{ background: D.card, border: `1px solid ${D.border}` }}>
              <h2 className="text-base font-black text-white mb-4">
                💬 Discussion ({commentaires.length})
              </h2>

              <div className="space-y-3 mb-5">
                {commentaires.length === 0 ? (
                  <p className="text-sm" style={{ color: "rgba(255,255,255,0.25)" }}>
                    Sois le premier à commenter ce signal.
                  </p>
                ) : (
                  commentaires.map(c => (
                    <div key={c.id} className="rounded-xl p-3"
                      style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${D.border}` }}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-semibold" style={{ color: "#4ade80" }}>{c.user_email}</span>
                        <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.25)" }}>{timeAgo(c.created_at)}</span>
                      </div>
                      <p className="text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>{c.contenu}</p>
                    </div>
                  ))
                )}
              </div>

              {plan !== "free" ? (
                <div>
                  <textarea
                    value={contenu}
                    onChange={e => setContenu(e.target.value)}
                    placeholder="Donne ton avis sur ce signal..."
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none mb-3"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: `1px solid ${D.border}`,
                      color: "white",
                    }}
                    onFocus={e => (e.currentTarget.style.borderColor = "rgba(34,197,94,0.4)")}
                    onBlur={e => (e.currentTarget.style.borderColor = D.border)}
                  />
                  <button onClick={handleComment} disabled={loading || !contenu}
                    className="px-6 py-2.5 rounded-xl text-sm font-black text-black transition-all disabled:opacity-40 hover:opacity-90"
                    style={{ background: D.green }}>
                    {loading ? "Envoi..." : "Commenter"}
                  </button>
                </div>
              ) : (
                <div className="text-center py-4 rounded-xl" style={{ border: `1px solid ${D.border}` }}>
                  <p className="text-sm mb-3" style={{ color: "rgba(255,255,255,0.3)" }}>
                    Plan Pro ou Premium requis pour commenter
                  </p>
                  <a href="/pricing"
                    className="px-5 py-2 rounded-lg text-sm font-black text-black inline-block transition hover:opacity-90"
                    style={{ background: D.green }}>
                    Upgrader
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT — trade setup sidebar */}
          <div className="w-80 flex-shrink-0 hidden lg:block">
            <div className="sticky top-6 space-y-4">

              {/* Trade setup card */}
              <div className="rounded-2xl p-5" style={{ background: D.card, border: `1px solid ${D.border}` }}>
                <h3 className="text-sm font-black text-white mb-4">Setup du trade</h3>

                {/* Risk slider */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[11px] font-semibold" style={{ color: "rgba(255,255,255,0.4)" }}>
                      Capital risqué
                    </label>
                    <span className="text-sm font-black text-white">{riskAmount.toLocaleString("fr-FR")} €</span>
                  </div>
                  <input
                    type="range"
                    min={100}
                    max={5000}
                    step={100}
                    value={riskAmount}
                    onChange={e => setRiskAmount(Number(e.target.value))}
                    className="w-full accent-green-500"
                    style={{ accentColor: isLong ? D.green : D.red }}
                  />
                  <div className="flex justify-between text-[9px] mt-1" style={{ color: "rgba(255,255,255,0.2)" }}>
                    <span>100 €</span>
                    <span>5 000 €</span>
                  </div>
                </div>

                {/* Trade metrics grid */}
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {[
                    { label: "Prix d'entrée", val: signal.prix_entree != null ? signal.prix_entree.toLocaleString("fr-FR", { maximumFractionDigits: 2 }) + " $" : "—" },
                    { label: "Quantité", val: qty > 0 ? qty.toString() : "—" },
                    { label: "Gain TP1", val: gainTp1 > 0 ? "+" + gainTp1.toFixed(0) + " €" : "—", positive: true },
                    { label: "Perte max", val: lossMax > 0 ? "-" + lossMax.toFixed(0) + " €" : "—", negative: true },
                  ].map(item => (
                    <div key={item.label} className="rounded-xl p-3 text-center"
                      style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${D.border}` }}>
                      <p className="text-[9px] uppercase font-bold mb-1" style={{ color: "rgba(255,255,255,0.3)" }}>
                        {item.label}
                      </p>
                      <p className="text-sm font-black"
                        style={{ color: item.positive ? D.green : item.negative ? D.red : "white" }}>
                        {item.val}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Trade button */}
                <button
                  onClick={() => router.push(`/dashboard?symbol=${signal.ticker}`)}
                  className="w-full py-3 rounded-xl text-sm font-black text-white transition-all hover:opacity-85"
                  style={{ background: isLong ? "rgba(34,197,94,0.8)" : "rgba(239,68,68,0.8)" }}>
                  {isLong ? "▲ Acheter sur le Dashboard" : "▼ Vendre sur le Dashboard"}
                </button>
              </div>

              {/* AI comment card */}
              {ind?.ai_comment && (
                <div className="rounded-2xl p-4" style={{ background: D.card, border: `1px solid ${D.border}` }}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-base">🧠</span>
                    <span className="text-[11px] font-bold" style={{ color: "rgba(255,255,255,0.4)" }}>Commentaire IA</span>
                  </div>
                  <p className="text-xs italic leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>
                    "{ind.ai_comment}"
                  </p>
                </div>
              )}

              {/* Signal meta */}
              <div className="rounded-2xl p-4 space-y-2" style={{ background: D.card, border: `1px solid ${D.border}` }}>
                <p className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: "rgba(255,255,255,0.2)" }}>
                  Informations
                </p>
                {[
                  { label: "R/R TP1", val: ind?.risk_reward_tp1 ? ind.risk_reward_tp1.toFixed(1) + "x" : "—" },
                  { label: "R/R TP2", val: ind?.risk_reward_tp2 ? ind.risk_reward_tp2.toFixed(1) + "x" : "—" },
                  { label: "Actif", val: signal.timeframe ?? "—" },
                  { label: "Score", val: signal.score_confiance ? signal.score_confiance + "%" : "—" },
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between">
                    <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.3)" }}>{item.label}</span>
                    <span className="text-[11px] font-bold text-white">{item.val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
