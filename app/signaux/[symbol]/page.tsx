"use client"

import { useState, useEffect, use, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { ArrowLeft, Target, Shield, Zap, RefreshCw } from "lucide-react"
import { formatPrice, formatChange } from "@/lib/format"
import dynamic from "next/dynamic"
import type { SignalResult } from "@/app/api/signals/route"

const TradingChart = dynamic(() => import("@/app/components/TradingChart"), {
  loading: () => <div className="h-[420px] skeleton rounded-2xl" />,
  ssr: false,
})

// ─── Design tokens ────────────────────────────────────────────────────────────
const D = {
  bg:     "#050505",
  card:   "#0a0a0a",
  border: "rgba(255,255,255,0.06)",
  green:  "#22c55e",
  red:    "#ef4444",
  yellow: "#f59e0b",
} as const

// ─── Helpers ──────────────────────────────────────────────────────────────────
function pctBetween(from: number, to: number) {
  if (!from) return "—"
  const v = ((to - from) / Math.abs(from)) * 100
  return (v >= 0 ? "+" : "") + v.toFixed(1) + "%"
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

function renderMarkdown(text: string) {
  return text.split("\n").map((line, i) => {
    if (line.startsWith("### ")) return <h3 key={i} className="font-bold text-base mt-4 mb-1 text-white">{line.replace("### ", "")}</h3>
    if (line.startsWith("## "))  return <h2 key={i} className="font-bold text-lg mt-4 mb-1 text-white">{line.replace("## ", "")}</h2>
    if (line.startsWith("- "))   return (
      <div key={i} className="flex gap-2 ml-2 my-0.5">
        <span className="text-green-400">•</span>
        <span className="text-white/60" dangerouslySetInnerHTML={{ __html: line.replace("- ", "").replaceAll(/\*\*(.*?)\*\*/g, "<strong style='color:white'>$1</strong>") }} />
      </div>
    )
    if (line.trim() === "") return <div key={i} className="h-2" />
    return <p key={i} className="text-white/60" dangerouslySetInnerHTML={{ __html: line.replaceAll(/\*\*(.*?)\*\*/g, "<strong style='color:white'>$1</strong>") }} />
  })
}

// ─── Indicator explanations ───────────────────────────────────────────────────
const INDICATOR_EXPLANATIONS: Record<string, string> = {
  "RSI·14":            "RSI sous 35 — l'actif est en zone de survente",
  "RSI·7":             "RSI court terme sous 30 — momentum très faible",
  "MACD·Hist↑":        "Histogramme MACD positif et croissant — momentum haussier",
  "MACD·Hist↓":        "Histogramme MACD négatif et décroissant — momentum baissier",
  "EMA·Cross":         "EMA9 au-dessus de l'EMA21 — tendance court terme haussière",
  "BB·Lower":          "Prix sous la bande de Bollinger basse — rebond probable",
  "BB·Upper":          "Prix au-dessus de la bande Bollinger haute — retournement probable",
  "Volume·élevé":      "Volume 1.5x la moyenne — intérêt institutionnel",
  "OBV↑":              "On-Balance Volume en hausse — pression acheteuse sous-jacente",
  "Stoch·%K":          "Stochastique en zone de survente — momentum retournement",
  "Support":           "Prix proche d'un support clé — zone d'achat potentielle",
  "Hammer":            "Pattern chandelier Hammer — signal de retournement haussier",
  "Bullish Engulfing": "Bougie englobante haussière — forte pression acheteuse",
  "Bearish Engulfing": "Bougie englobante baissière — forte pression vendeuse",
  "Shooting Star":     "Chandelier Shooting Star — signal de retournement baissier",
  "VWAP":              "Prix sous le VWAP — opportunité d'achat institutionnelle",
  "Ichimoku·Bull":     "Signal Ichimoku haussier — tendance de fond positive",
  "Ichimoku·Bear":     "Signal Ichimoku baissier — tendance de fond négative",
  "RSI·14↑":           "RSI en zone de surachat — pression vendeuse croissante",
}

// ─── Normalized signal view (bridges live API ↔ DB table formats) ─────────────
type NormalizedSignal = {
  symbol:          string
  name:            string
  direction:       "ACHAT_FORT" | "ACHAT" | "VENTE_FORT" | "VENTE"
  isBullish:       boolean
  entryPrice:      number
  tp1:             number
  tp2:             number | null
  tp3:             number | null
  sl:              number
  confluenceScore: number
  confirmedBy:     string[]
  rr:              number
  rsi:             number | null
  macdHist:        number | null
  volumeRatio:     number | null
  bbPosition:      number | null
  aiComment:       string
  raisonnement:    string
  expiresAt:       string | null
  createdAt:       string | null
  type:            string
  // extra DB fields
  ichimokuSignal:  string | null
  aboveMa200:      boolean | null
  volumeSpike:     boolean | null
  candlePattern:   string | null
}

function fromLiveSignal(s: SignalResult): NormalizedSignal {
  return {
    symbol:          s.symbol,
    name:            s.name,
    direction:       s.signal,
    isBullish:       s.signal === "ACHAT" || s.signal === "ACHAT_FORT",
    entryPrice:      s.entry_price,
    tp1:             s.tp1,
    tp2:             s.tp2 ?? null,
    tp3:             s.tp3 ?? null,
    sl:              s.sl,
    confluenceScore: s.confluence_score,
    confirmedBy:     s.confirmed_by,
    rr:              s.risk_reward_tp1,
    rsi:             s.rsi ?? null,
    macdHist:        s.macd_hist ?? null,
    volumeRatio:     s.volume_ratio ?? null,
    bbPosition:      s.bb_position ?? null,
    aiComment:       s.ai_comment ?? "",
    raisonnement:    "",
    expiresAt:       s.expires_at ?? null,
    createdAt:       s.timestamp ?? null,
    type:            s.type,
    ichimokuSignal:  s.ichimoku_signal ?? null,
    aboveMa200:      s.above_ma200 ?? null,
    volumeSpike:     s.volume_spike ?? null,
    candlePattern:   s.candle_pattern ?? null,
  }
}

function fromDbSignal(row: any): NormalizedSignal {
  const ind     = (row.indicateurs ?? {}) as any
  const isLong  = row.direction === "LONG"
  const dir     = (ind?.signal as string) ?? (isLong ? "ACHAT" : "VENTE")
  return {
    symbol:          row.ticker,
    name:            ind?.name ?? row.ticker,
    direction:       dir as NormalizedSignal["direction"],
    isBullish:       isLong,
    entryPrice:      row.prix_entree,
    tp1:             row.take_profit_1,
    tp2:             row.take_profit_2 ?? null,
    tp3:             row.take_profit_3 ?? null,
    sl:              row.stop_loss,
    confluenceScore: ind?.confluence_score ?? row.score_confiance ?? 0,
    confirmedBy:     ind?.confirmed_by ?? [],
    rr:              ind?.risk_reward_tp1 ?? 0,
    rsi:             ind?.rsi ?? null,
    macdHist:        ind?.macd_hist ?? null,
    volumeRatio:     ind?.volume_ratio ?? null,
    bbPosition:      ind?.bb_position ?? null,
    aiComment:       ind?.ai_comment ?? "",
    raisonnement:    row.raisonnement ?? "",
    expiresAt:       ind?.expires_at ?? null,
    createdAt:       row.created_at ?? null,
    type:            ind?.type ?? "stock",
    ichimokuSignal:  ind?.ichimoku_signal ?? null,
    aboveMa200:      ind?.above_ma200 ?? null,
    volumeSpike:     ind?.volume_spike ?? null,
    candlePattern:   ind?.candle_pattern ?? null,
  }
}

// ─── Inner page (uses useSearchParams) ────────────────────────────────────────
function SignalDetailInner({ symbol }: { symbol: string }) {
  const router      = useRouter()
  const searchParams = useSearchParams()
  const signalId    = searchParams.get("id")   // UUID from historique

  const [signal,      setSignal]      = useState<NormalizedSignal | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [notFound,    setNotFound]    = useState(false)
  const [generating,  setGenerating]  = useState(false)
  const [raisonnement, setRaisonnement] = useState("")
  const [dbSignalId,  setDbSignalId]  = useState<string | null>(null)
  const [riskAmount,  setRiskAmount]  = useState(500)
  const [commentaires, setCommentaires] = useState<any[]>([])
  const [contenu,     setContenu]     = useState("")
  const [submitting,  setSubmitting]  = useState(false)
  const [user,        setUser]        = useState<any>(null)
  const [plan,        setPlan]        = useState("free")

  // Auth
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push("/login"); return }
      setUser(data.user)
      const { data: profile } = await supabase
        .from("profiles").select("plan").eq("email", data.user.email).maybeSingle()
      setPlan(profile?.plan ?? "free")
    })
  }, [router])

  // Load signal
  useEffect(() => {
    loadSignal()
  }, [symbol, signalId])

  async function loadSignal() {
    setLoading(true)
    setNotFound(false)
    try {
      // 1) Try DB by UUID id
      if (signalId) {
        const { data } = await supabase
          .from("signaux").select("*").eq("id", signalId).maybeSingle()
        if (data) {
          const norm = fromDbSignal(data)
          setSignal(norm)
          setRaisonnement(norm.raisonnement)
          setDbSignalId(data.id)
          loadComments(data.id)
          if (!norm.raisonnement || norm.raisonnement.length < 100) {
            generateAnalysis(data.ticker, data.id)
          }
          setLoading(false)
          return
        }
      }

      // 2) Try DB by ticker (most recent)
      const { data: dbRow } = await supabase
        .from("signaux").select("*")
        .or(`ticker.eq.${symbol},ticker.eq.${symbol}-USD`)
        .order("created_at", { ascending: false })
        .limit(1).maybeSingle()

      if (dbRow) {
        const norm = fromDbSignal(dbRow)
        setSignal(norm)
        setRaisonnement(norm.raisonnement)
        setDbSignalId(dbRow.id)
        loadComments(dbRow.id)
        if (!norm.raisonnement || norm.raisonnement.length < 100) {
          generateAnalysis(dbRow.ticker, dbRow.id)
        }
        setLoading(false)
        return
      }

      // 3) Fetch live signals and find by symbol
      const res  = await fetch("/api/signals")
      const data = await res.json()
      const live = (data.signals ?? []) as SignalResult[]
      const found = live.find(
        (s: SignalResult) => s.symbol === symbol || s.symbol === `${symbol}-USD` || s.symbol.replace("-USD","") === symbol
      )
      if (found) {
        setSignal(fromLiveSignal(found))
        setLoading(false)
        return
      }

      setNotFound(true)
    } catch {}
    setLoading(false)
  }

  async function generateAnalysis(ticker: string, id: string) {
    setGenerating(true)
    try {
      const res = await fetch("/api/signals/analyse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker, signal_id: id }),
      })
      const data = await res.json()
      if (data.raisonnement) setRaisonnement(data.raisonnement)
    } catch {}
    setGenerating(false)
  }

  async function loadComments(id: string) {
    const { data } = await supabase
      .from("signaux_commentaires").select("*")
      .eq("signal_id", id).order("created_at", { ascending: true })
    if (data) setCommentaires(data)
  }

  async function handleComment() {
    if (!contenu.trim() || !dbSignalId || !user) return
    setSubmitting(true)
    await supabase.from("signaux_commentaires").insert({
      signal_id: dbSignalId, user_email: user.email, contenu,
    })
    setContenu("")
    await loadComments(dbSignalId)
    setSubmitting(false)
  }

  // ── Skeleton ──
  if (loading) return (
    <div className="min-h-screen p-4 md:p-6" style={{ background: D.bg }}>
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="h-8 skeleton rounded w-40" />
        <div className="h-20 skeleton rounded-2xl" />
        <div className="h-[420px] skeleton rounded-2xl" />
        <div className="grid grid-cols-3 gap-4">
          {[0,1,2].map(i => <div key={i} className="h-32 skeleton rounded-2xl" />)}
        </div>
      </div>
    </div>
  )

  // ── Not found ──
  if (notFound || !signal) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: D.bg }}>
      <div className="text-center">
        <p className="text-4xl mb-3">📡</p>
        <p className="font-black text-white text-lg mb-2">Signal introuvable</p>
        <p className="text-white/40 text-sm mb-4">Ce signal n'existe plus ou a expiré.</p>
        <button onClick={() => router.push("/signaux")}
          className="px-5 py-2.5 rounded-xl text-sm font-black text-black"
          style={{ background: D.green }}>
          ← Retour aux signaux
        </button>
      </div>
    </div>
  )

  const signalColor  = signal.isBullish ? D.green : D.red
  const signalBg     = signal.isBullish ? "rgba(34,197,94,0.06)"  : "rgba(239,68,68,0.06)"
  const signalBorder = signal.isBullish ? "rgba(34,197,94,0.18)"  : "rgba(239,68,68,0.18)"

  const signalLabel = signal.direction === "ACHAT_FORT" ? "⚡ Achat Fort"
    : signal.direction === "ACHAT"      ? "↗ Achat"
    : signal.direction === "VENTE_FORT" ? "⚡ Vente Forte"
    : signal.direction === "VENTE"      ? "↘ Vente" : "Signal"

  const pctToTp = signal.entryPrice ? ((signal.tp1 - signal.entryPrice) / signal.entryPrice) * 100 : 0
  const pctToSl = signal.entryPrice ? ((signal.sl  - signal.entryPrice) / signal.entryPrice) * 100 : 0

  // Trade calculator
  const slDist  = Math.abs(signal.entryPrice - signal.sl)
  const qty     = slDist > 0 ? Math.max(1, Math.floor(riskAmount / slDist)) : 0
  const gainTp1 = qty * Math.abs(signal.tp1 - signal.entryPrice)
  const lossMax = qty * slDist

  // Position for TradingChart (draws TP/SL lines)
  const chartPosition = {
    avg_price: signal.entryPrice,
    take_profit: signal.tp1,
    stop_loss: signal.sl,
    qty: 1,
  }

  return (
    <div className="min-h-screen page-enter" style={{ background: D.bg }}>
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-6">

        {/* ── BACK ── */}
        <button onClick={() => router.back()}
          className="flex items-center gap-2 text-sm mb-5 transition-all text-white/30 hover:text-white">
          <ArrowLeft size={14} />
          Retour aux signaux
        </button>

        {/* ── HEADER ── */}
        <div className="rounded-2xl p-5 mb-5"
          style={{ background: signalBg, border: `1px solid ${signalBorder}` }}>
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-3 flex-wrap mb-2">
                <h1 className="text-3xl font-black text-white">
                  {signal.symbol.replace("-USD","")}
                </h1>
                <span className="text-white/40 text-sm">{signal.name}</span>
                <span className="text-sm font-black px-3 py-1 rounded-full"
                  style={{ background: `${signalColor}18`, color: signalColor, border: `1px solid ${signalColor}30` }}>
                  {signalLabel}
                </span>
                {signal.candlePattern && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded"
                    style={{ background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.25)", color: "#a78bfa" }}>
                    {signal.candlePattern}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <p className="text-2xl font-black text-white">{formatPrice(signal.entryPrice)}</p>
                {signal.createdAt && (
                  <p className="text-xs text-white/30">{timeAgo(signal.createdAt)}</p>
                )}
              </div>
            </div>

            {/* Confluence score */}
            <div className="text-right">
              <p className="font-black text-2xl" style={{ color: signal.confluenceScore >= 70 ? D.green : D.yellow }}>
                {signal.confluenceScore.toFixed(0)}%
              </p>
              <p className="text-xs text-white/30">Score de confluence</p>
              <div className="w-32 h-1.5 rounded-full mt-1.5 overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                <div className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${signal.confluenceScore}%`,
                    background: signal.isBullish
                      ? "linear-gradient(90deg, #16a34a, #22c55e)"
                      : "linear-gradient(90deg, #dc2626, #ef4444)",
                  }} />
              </div>
            </div>
          </div>

          {/* TP / SL grid */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-5">
            {[
              { label: "Entrée",    val: signal.entryPrice, color: "rgba(255,255,255,0.5)", bg: "rgba(255,255,255,0.03)" },
              { label: "TP1",       val: signal.tp1,        color: D.green,  bg: "rgba(34,197,94,0.06)"  },
              { label: "TP2",       val: signal.tp2,        color: D.green,  bg: "rgba(34,197,94,0.09)"  },
              { label: "TP3",       val: signal.tp3,        color: D.green,  bg: "rgba(34,197,94,0.12)"  },
              { label: "Stop Loss", val: signal.sl,         color: D.red,    bg: "rgba(239,68,68,0.06)"  },
            ].map(({ label, val, color, bg }) => (
              <div key={label} className="rounded-xl p-3 text-center"
                style={{ background: bg, border: `1px solid ${D.border}` }}>
                <p className="text-[10px] font-bold uppercase mb-1" style={{ color }}>{label}</p>
                <p className="text-white font-bold text-sm">
                  {val != null ? formatPrice(val) : "—"}
                </p>
                {label !== "Entrée" && val != null && signal.entryPrice && (
                  <p className="text-[9px] mt-0.5" style={{ color: label === "Stop Loss" ? "rgba(239,68,68,0.7)" : "rgba(34,197,94,0.7)" }}>
                    {pctBetween(signal.entryPrice, val)}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="flex gap-3 mt-4">
            <button
              onClick={() => router.push(`/dashboard?symbol=${signal.symbol}&action=${signal.isBullish ? "buy" : "sell"}&price=${signal.entryPrice}&tp=${signal.tp1}&sl=${signal.sl}`)}
              className="flex-1 md:flex-none px-6 py-3 rounded-xl text-sm font-black text-black transition-all hover:scale-[1.01]"
              style={{ background: signalColor }}>
              {signal.isBullish ? "📈 Simuler un achat" : "📉 Simuler une vente"} (Paper Trading) →
            </button>
          </div>
        </div>

        {/* ── TRADING CHART ── */}
        <div className="rounded-2xl overflow-hidden mb-5"
          style={{ background: D.card, border: `1px solid ${D.border}` }}>
          <TradingChart
            symbol={signal.symbol}
            position={chartPosition}
          />
        </div>

        {/* ── 2-col layout ── */}
        <div className="flex gap-5">

          {/* LEFT */}
          <div className="flex-1 min-w-0 space-y-4">

            {/* Indicateurs confirmés */}
            {signal.confirmedBy.length > 0 && (
              <div className="rounded-2xl p-5" style={{ background: D.card, border: `1px solid ${D.border}` }}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-black text-white">Pourquoi ce signal ?</h2>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white/30"
                    style={{ background: "rgba(255,255,255,0.05)" }}>
                    {signal.confirmedBy.length} indicateur{signal.confirmedBy.length > 1 ? "s" : ""} confirmé{signal.confirmedBy.length > 1 ? "s" : ""}
                  </span>
                </div>
                <div className="space-y-2">
                  {signal.confirmedBy.map(ind => (
                    <div key={ind} className="flex items-center gap-3 p-2.5 rounded-xl"
                      style={{
                        background: signal.isBullish ? "rgba(34,197,94,0.05)" : "rgba(239,68,68,0.05)",
                        border: `1px solid ${signal.isBullish ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)"}`,
                      }}>
                      <span className="text-sm flex-shrink-0" style={{ color: signalColor }}>✓</span>
                      <div>
                        <p className="text-xs font-bold text-white/70">{ind}</p>
                        <p className="text-[10px] text-white/30">
                          {INDICATOR_EXPLANATIONS[ind] ?? "Signal confirmé par cet indicateur"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Indicateurs techniques */}
            <div className="rounded-2xl p-5" style={{ background: D.card, border: `1px solid ${D.border}` }}>
              <h2 className="text-base font-black text-white mb-4">Indicateurs techniques</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  {
                    label: "RSI(14)",
                    val:   signal.rsi != null ? signal.rsi.toFixed(1) : "—",
                    color: signal.rsi != null && signal.rsi < 30 ? D.green : signal.rsi != null && signal.rsi > 70 ? D.red : "rgba(255,255,255,0.7)",
                    sub:   signal.rsi != null && signal.rsi < 30 ? "Survendu" : signal.rsi != null && signal.rsi > 70 ? "Suracheté" : "Neutre",
                  },
                  {
                    label: "MACD Histo",
                    val:   signal.macdHist != null ? (signal.macdHist > 0 ? "+" : "") + signal.macdHist.toFixed(3) : "—",
                    color: signal.macdHist != null && signal.macdHist > 0 ? D.green : D.red,
                    sub:   signal.macdHist != null && signal.macdHist > 0 ? "Haussier" : "Baissier",
                  },
                  {
                    label: "Bollinger %",
                    val:   signal.bbPosition != null ? signal.bbPosition.toFixed(1) + "%" : "—",
                    color: "rgba(255,255,255,0.7)",
                    sub:   signal.bbPosition != null && signal.bbPosition < 10 ? "Bande basse" : signal.bbPosition != null && signal.bbPosition > 90 ? "Bande haute" : "Centre",
                  },
                  {
                    label: "Volume ratio",
                    val:   signal.volumeRatio != null ? signal.volumeRatio.toFixed(2) + "x" : "—",
                    color: signal.volumeRatio != null && signal.volumeRatio > 1.5 ? D.green : "rgba(255,255,255,0.7)",
                    sub:   signal.volumeRatio != null && signal.volumeRatio > 1.5 ? "Élevé" : "Normal",
                  },
                ].map(item => (
                  <div key={item.label} className="rounded-xl p-3"
                    style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${D.border}` }}>
                    <p className="text-[10px] mb-1 text-white/30">{item.label}</p>
                    <p className="font-black text-base tabular-nums" style={{ color: item.color }}>{item.val}</p>
                    <p className="text-[9px] mt-0.5 text-white/20">{item.sub}</p>
                  </div>
                ))}
              </div>

              {/* Extras */}
              {(signal.ichimokuSignal || signal.aboveMa200 != null || signal.volumeSpike) && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {signal.ichimokuSignal && signal.ichimokuSignal !== "neutral" && (
                    <span className="text-[10px] font-semibold px-2.5 py-1 rounded-lg"
                      style={{
                        background: signal.ichimokuSignal === "bullish" ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
                        border: signal.ichimokuSignal === "bullish" ? "1px solid rgba(34,197,94,0.2)" : "1px solid rgba(239,68,68,0.2)",
                        color: signal.ichimokuSignal === "bullish" ? "#4ade80" : "#f87171",
                      }}>
                      Ichimoku {signal.ichimokuSignal === "bullish" ? "haussier ↑" : "baissier ↓"}
                    </span>
                  )}
                  {signal.aboveMa200 != null && (
                    <span className="text-[10px] font-semibold px-2.5 py-1 rounded-lg"
                      style={{
                        background: signal.aboveMa200 ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
                        border: signal.aboveMa200 ? "1px solid rgba(34,197,94,0.2)" : "1px solid rgba(239,68,68,0.2)",
                        color: signal.aboveMa200 ? "#4ade80" : "#f87171",
                      }}>
                      {signal.aboveMa200 ? "Au-dessus MA200" : "Sous MA200"}
                    </span>
                  )}
                  {signal.volumeSpike && (
                    <span className="text-[10px] font-semibold px-2.5 py-1 rounded-lg"
                      style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", color: D.yellow }}>
                      Volume spike ×2
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Analyse IA / raisonnement */}
            <div className="rounded-2xl p-5" style={{ background: D.card, border: `1px solid ${D.border}` }}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-base">🤖</span>
                  <h2 className="text-base font-black text-white">Analyse algorithmique</h2>
                  <span className="text-[9px] font-black px-2 py-0.5 rounded-full"
                    style={{ background: "rgba(139,92,246,0.15)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.25)" }}>
                    Groq
                  </span>
                </div>
                {dbSignalId && (
                  <button onClick={() => generateAnalysis(signal.symbol, dbSignalId)} disabled={generating}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40 text-white/40 hover:text-white transition"
                    style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${D.border}` }}>
                    <RefreshCw size={11} className={generating ? "animate-spin" : ""} />
                    Régénérer
                  </button>
                )}
              </div>

              {generating && !raisonnement ? (
                <div className="space-y-2">
                  {[0.9, 1, 0.8, 0.65, 0.85].map((w, i) => (
                    <div key={i} className="h-3.5 rounded skeleton" style={{ width: `${w * 100}%` }} />
                  ))}
                </div>
              ) : raisonnement ? (
                <div className="text-sm leading-relaxed space-y-1">
                  {renderMarkdown(raisonnement)}
                </div>
              ) : signal.aiComment ? (
                <p className="text-sm text-white/60 leading-relaxed italic">"{signal.aiComment}"</p>
              ) : (
                <p className="text-sm text-white/25">
                  {dbSignalId ? "Génération de l'analyse en cours…" : "Analyse disponible pour les signaux archivés."}
                </p>
              )}
            </div>

            {/* Discussion (DB signals only) */}
            {dbSignalId && (
              <div className="rounded-2xl p-5" style={{ background: D.card, border: `1px solid ${D.border}` }}>
                <h2 className="text-base font-black text-white mb-4">
                  💬 Discussion ({commentaires.length})
                </h2>
                <div className="space-y-3 mb-4">
                  {commentaires.length === 0 ? (
                    <p className="text-sm text-white/25">Sois le premier à commenter ce signal.</p>
                  ) : commentaires.map(c => (
                    <div key={c.id} className="rounded-xl p-3"
                      style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${D.border}` }}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-semibold text-green-400">{c.user_email}</span>
                        <span className="text-[10px] text-white/25">{timeAgo(c.created_at)}</span>
                      </div>
                      <p className="text-sm text-white/60">{c.contenu}</p>
                    </div>
                  ))}
                </div>
                {plan !== "free" ? (
                  <div>
                    <textarea value={contenu} onChange={e => setContenu(e.target.value)}
                      placeholder="Donne ton avis sur ce signal..."
                      rows={3}
                      className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none mb-3 text-white"
                      style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${D.border}` }}
                      onFocus={e => (e.currentTarget.style.borderColor = "rgba(34,197,94,0.4)")}
                      onBlur={e  => (e.currentTarget.style.borderColor = D.border)} />
                    <button onClick={handleComment} disabled={submitting || !contenu.trim()}
                      className="px-6 py-2.5 rounded-xl text-sm font-black text-black disabled:opacity-40 hover:opacity-90 transition"
                      style={{ background: D.green }}>
                      {submitting ? "Envoi..." : "Commenter"}
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-4 rounded-xl" style={{ border: `1px solid ${D.border}` }}>
                    <p className="text-sm text-white/30 mb-3">Plan Pro requis pour commenter</p>
                    <a href="/pricing" className="px-5 py-2 rounded-lg text-sm font-black text-black inline-block hover:opacity-90 transition"
                      style={{ background: D.green }}>Upgrader</a>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* RIGHT — Trade calculator */}
          <div className="w-72 flex-shrink-0 hidden lg:block">
            <div className="sticky top-6 space-y-4">

              {/* TP / SL cards */}
              <div className="rounded-2xl p-4"
                style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.18)" }}>
                <div className="flex items-center gap-2 mb-3">
                  <Target size={14} className="text-green-400" />
                  <p className="text-sm font-black text-white">Objectif (TP1)</p>
                </div>
                <p className="text-xl font-black text-green-400 mb-1">{formatPrice(signal.tp1)}</p>
                <p className="text-sm font-bold text-green-400/70">
                  {pctToTp >= 0 ? "+" : ""}{pctToTp.toFixed(1)}% depuis l'entrée
                </p>
                <p className="text-[11px] text-white/35 mt-2 leading-relaxed">
                  {signal.isBullish
                    ? "Si le prix monte jusqu'ici, c'est là qu'on prend les bénéfices."
                    : "Si le prix descend jusqu'ici, prends tes profits ici."}
                </p>
              </div>

              <div className="rounded-2xl p-4"
                style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.18)" }}>
                <div className="flex items-center gap-2 mb-3">
                  <Shield size={14} className="text-red-400" />
                  <p className="text-sm font-black text-white">Stop Loss (SL)</p>
                </div>
                <p className="text-xl font-black text-red-400 mb-1">{formatPrice(signal.sl)}</p>
                <p className="text-sm font-bold text-red-400/70">
                  {pctToSl >= 0 ? "+" : ""}{pctToSl.toFixed(1)}% depuis l'entrée
                </p>
                <p className="text-[11px] text-white/35 mt-2 leading-relaxed">
                  Si ce niveau est atteint, la position se ferme — limite ta perte à {Math.abs(pctToSl).toFixed(1)}%.
                </p>
              </div>

              {/* R/R card */}
              <div className="rounded-2xl p-4" style={{ background: D.card, border: `1px solid ${D.border}` }}>
                <div className="flex items-center gap-2 mb-3">
                  <Zap size={14} className="text-yellow-400" />
                  <p className="text-sm font-black text-white">Setup du trade</p>
                </div>

                <div className="mb-3">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-white/40">Risque / Rendement</span>
                    <span className="font-black text-white">1:{signal.rr.toFixed(1)}</span>
                  </div>
                  <p className="text-[10px] text-white/25">
                    {signal.rr >= 2 ? "Excellent ratio — gain potentiel 2× le risque"
                      : signal.rr >= 1.5 ? "Bon ratio — tu gagnes plus que tu ne risques"
                      : "Ratio serré — gère bien ta taille de position"}
                  </p>
                </div>

                {/* Risk slider */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[11px] text-white/40">Capital risqué</label>
                    <span className="text-sm font-black text-white">{riskAmount.toLocaleString("fr-FR")} €</span>
                  </div>
                  <input type="range" min={100} max={5000} step={100} value={riskAmount}
                    onChange={e => setRiskAmount(Number(e.target.value))}
                    className="w-full" style={{ accentColor: signalColor }} />
                </div>

                <div className="grid grid-cols-2 gap-2 mb-4">
                  {[
                    { label: "Quantité", val: qty > 0 ? qty.toString() : "—", color: "white" },
                    { label: "Entrée",   val: formatPrice(signal.entryPrice), color: "white" },
                    { label: "Gain TP1", val: gainTp1 > 0 ? "+" + gainTp1.toFixed(0) + " €" : "—", color: D.green },
                    { label: "Perte max",val: lossMax > 0 ? "-" + lossMax.toFixed(0) + " €" : "—", color: D.red },
                  ].map(item => (
                    <div key={item.label} className="rounded-xl p-2.5 text-center"
                      style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${D.border}` }}>
                      <p className="text-[9px] uppercase font-bold mb-0.5 text-white/25">{item.label}</p>
                      <p className="text-xs font-black" style={{ color: item.color }}>{item.val}</p>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => router.push(`/dashboard?symbol=${signal.symbol}&action=${signal.isBullish ? "buy" : "sell"}&price=${signal.entryPrice}&tp=${signal.tp1}&sl=${signal.sl}`)}
                  className="w-full py-3 rounded-xl text-sm font-black text-black transition-all hover:opacity-90"
                  style={{ background: signalColor }}>
                  {signal.isBullish ? "▲ Simuler l'achat" : "▼ Simuler la vente"}
                </button>
              </div>

              {/* Disclaimer */}
              <div className="rounded-xl p-3" style={{ background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.12)" }}>
                <p className="text-[10px] text-yellow-400/60 leading-relaxed">
                  ⚠️ Signal éducatif généré algorithmiquement. Tradex est un outil de <strong className="text-yellow-400">paper trading</strong> — argent fictif uniquement.
                </p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

// ─── Page wrapper (params are async in Next 15) ───────────────────────────────
export default function SignalDetailPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = use(params)
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: "transparent" }}>
        <div className="w-8 h-8 border-2 border-t-green-400 rounded-full animate-spin border-white/10" />
      </div>
    }>
      <SignalDetailInner symbol={symbol} />
    </Suspense>
  )
}
