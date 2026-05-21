"use client"
import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"

interface Props {
  symbol?: string
  lesson_context: string
  onComplete?: (decision: string, xp: number) => void
}

interface MarketData {
  price: number
  change: number
  changePct: number
  rsi?: number
  macd?: number
  macdSignal?: number
  volume?: number
}

interface Feedback {
  correct: boolean | null
  feedback: string
  xp_earned: number
  explanation: string
}

function IndicatorCard({
  label,
  value,
  unit,
  color,
  sublabel,
}: {
  label: string
  value: string | number
  unit?: string
  color: string
  sublabel?: string
}) {
  return (
    <motion.div
      className="flex flex-col gap-1 p-3 rounded-xl bg-[#111] border border-[#1a1a1a]"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <span className="text-xs text-[#555] uppercase tracking-wider">{label}</span>
      <span className="text-xl font-bold" style={{ color }}>
        {value}{unit && <span className="text-sm ml-0.5 font-normal">{unit}</span>}
      </span>
      {sublabel && <span className="text-xs" style={{ color }}>{sublabel}</span>}
    </motion.div>
  )
}

function getRsiColor(rsi?: number) {
  if (!rsi) return "#888"
  if (rsi < 30) return "#4ade80"
  if (rsi > 70) return "#f87171"
  return "#60a5fa"
}

function getRsiLabel(rsi?: number) {
  if (!rsi) return ""
  if (rsi < 30) return "Survendu"
  if (rsi > 70) return "Suracheté"
  return "Neutre"
}

function getMacdLabel(macd?: number, signal?: number) {
  if (macd == null || signal == null) return ""
  if (macd > signal) return "Haussier"
  return "Baissier"
}

export default function LivePractice({ symbol = "AAPL", lesson_context, onComplete }: Props) {
  const [data, setData] = useState<MarketData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [decision, setDecision] = useState<"ACHETER" | "VENDRE" | "ATTENDRE" | null>(null)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [loadingFeedback, setLoadingFeedback] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function fetchData() {
      setLoading(true)
      setError(null)
      try {
        // Fetch quote
        const [quoteRes, chartRes] = await Promise.allSettled([
          fetch(`/api/quote?symbol=${symbol}`),
          fetch(`/api/trading/chart?symbol=${symbol}`),
        ])

        let price = 0, change = 0, changePct = 0
        let rsi: number | undefined, macd: number | undefined, macdSignal: number | undefined

        if (quoteRes.status === "fulfilled" && quoteRes.value.ok) {
          const q = await quoteRes.value.json()
          price = q.price ?? q.c ?? q.regularMarketPrice ?? 0
          change = q.change ?? q.d ?? q.regularMarketChange ?? 0
          changePct = q.changePct ?? q.dp ?? q.regularMarketChangePercent ?? 0
        }

        if (chartRes.status === "fulfilled" && chartRes.value.ok) {
          const c = await chartRes.value.json()
          rsi = c.rsi ?? c.indicators?.rsi
          macd = c.macd ?? c.indicators?.macd
          macdSignal = c.macdSignal ?? c.indicators?.macdSignal
        }

        if (!cancelled) {
          setData({ price, change, changePct, rsi, macd, macdSignal })
        }
      } catch {
        if (!cancelled) setError("Impossible de charger les données en direct.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchData()
    return () => { cancelled = true }
  }, [symbol])

  const handleDecision = async (d: "ACHETER" | "VENDRE" | "ATTENDRE") => {
    setDecision(d)
    setLoadingFeedback(true)
    try {
      const context = data
        ? `${symbol} - Prix: $${data.price?.toFixed(2)}, RSI: ${data.rsi ?? "N/A"}, MACD: ${data.macd != null ? data.macd.toFixed(3) : "N/A"}`
        : `${symbol} - données indisponibles`

      const res = await fetch("/api/academy/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exercise_type: "live_practice",
          user_answer: d,
          context,
          lesson_context,
          symbol,
        }),
      })
      const fb = await res.json()
      setFeedback(fb)
      onComplete?.(d, fb.xp_earned ?? 15)
    } catch {
      setFeedback({
        correct: null,
        feedback: "Analyse reçue. Continuez à pratiquer !",
        xp_earned: 10,
        explanation: "Assurez-vous de toujours croiser plusieurs indicateurs avant de prendre une décision.",
      })
      onComplete?.(d, 10)
    } finally {
      setLoadingFeedback(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 bg-[#0d0d0d] rounded-2xl border border-[#1a1a1a] p-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-white">{symbol}</h3>
          <p className="text-xs text-[#888] mt-0.5">
            Tu viens d&apos;apprendre <span className="text-[#60a5fa] font-semibold">{lesson_context}</span>. Voici {symbol} en ce moment :
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#60a5fa11] border border-[#60a5fa33]">
          <span className="w-2 h-2 rounded-full bg-[#4ade80] animate-pulse" />
          <span className="text-xs text-[#60a5fa] font-medium">Live</span>
        </div>
      </div>

      {/* Data cards */}
      {loading ? (
        <div className="grid grid-cols-2 gap-2">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-20 rounded-xl bg-[#111] border border-[#1a1a1a] animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="px-4 py-3 rounded-xl bg-[#f8717111] border border-[#f8717133] text-sm text-[#f87171]">
          {error}
        </div>
      ) : data ? (
        <div className="grid grid-cols-2 gap-2">
          <IndicatorCard
            label="Prix"
            value={`$${data.price?.toFixed(2) ?? "—"}`}
            color={data.change >= 0 ? "#4ade80" : "#f87171"}
            sublabel={`${data.change >= 0 ? "+" : ""}${data.change?.toFixed(2)} (${data.changePct?.toFixed(2)}%)`}
          />
          <IndicatorCard
            label="RSI (14)"
            value={data.rsi != null ? data.rsi.toFixed(1) : "—"}
            color={getRsiColor(data.rsi)}
            sublabel={getRsiLabel(data.rsi)}
          />
          <IndicatorCard
            label="MACD"
            value={data.macd != null ? data.macd.toFixed(3) : "—"}
            color={data.macd != null && data.macdSignal != null && data.macd > data.macdSignal ? "#4ade80" : "#f87171"}
            sublabel={getMacdLabel(data.macd, data.macdSignal)}
          />
          <IndicatorCard
            label="Signal MACD"
            value={data.macdSignal != null ? data.macdSignal.toFixed(3) : "—"}
            color="#a78bfa"
          />
        </div>
      ) : null}

      {/* Decision buttons */}
      <AnimatePresence mode="wait">
        {!decision && !loading && (
          <motion.div key="buttons" className="flex flex-col gap-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <p className="text-sm font-semibold text-white">Quelle est ta décision ?</p>
            <div className="grid grid-cols-3 gap-2">
              {(["ACHETER", "VENDRE", "ATTENDRE"] as const).map((d) => {
                const colors = {
                  ACHETER: { border: "#4ade80", bg: "#4ade8011", text: "#4ade80", hover: "#4ade8022", icon: "📈" },
                  VENDRE: { border: "#f87171", bg: "#f8717111", text: "#f87171", hover: "#f8717122", icon: "📉" },
                  ATTENDRE: { border: "#facc15", bg: "#facc1511", text: "#facc15", hover: "#facc1522", icon: "⏳" },
                }[d]
                return (
                  <motion.button
                    key={d}
                    onClick={() => handleDecision(d)}
                    className="flex flex-col items-center gap-1 py-4 rounded-xl border font-semibold text-sm transition-colors"
                    style={{ borderColor: colors.border, backgroundColor: colors.bg, color: colors.text }}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                  >
                    <span className="text-xl">{colors.icon}</span>
                    {d}
                  </motion.button>
                )
              })}
            </div>
          </motion.div>
        )}

        {decision && (
          <motion.div key="feedback" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {loadingFeedback ? (
              <div className="flex items-center gap-3 px-4 py-4 rounded-xl bg-[#111] border border-[#1a1a1a]">
                <motion.div className="w-5 h-5 rounded-full border-2 border-[#4ade80] border-t-transparent" animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} />
                <span className="text-sm text-[#888]">Analyse en cours…</span>
              </div>
            ) : feedback ? (
              <div className={`flex flex-col gap-3 p-4 rounded-xl border ${feedback.correct === true ? "border-[#4ade80] bg-[#4ade8011]" : feedback.correct === false ? "border-[#f87171] bg-[#f8717111]" : "border-[#facc15] bg-[#facc1511]"}`}>
                <div className="flex items-center justify-between">
                  <p className={`text-sm font-bold ${feedback.correct === true ? "text-[#4ade80]" : feedback.correct === false ? "text-[#f87171]" : "text-[#facc15]"}`}>
                    {feedback.correct === true ? "Bonne analyse !" : feedback.correct === false ? "Attention !" : "Analyse reçue !"}
                    {" "}Décision : <span className="font-black">{decision}</span>
                  </p>
                  <span className="text-sm font-bold text-[#4ade80]">+{feedback.xp_earned} XP</span>
                </div>
                <p className="text-sm text-[#ccc] leading-relaxed">{feedback.feedback}</p>
                {feedback.explanation && feedback.explanation !== feedback.feedback && (
                  <p className="text-xs text-[#888] leading-relaxed border-t border-[#ffffff11] pt-2">{feedback.explanation}</p>
                )}
                <a
                  href={`/dashboard?symbol=${symbol}&lesson=${lesson_context.toLowerCase().replace(/\s+/g, "_")}`}
                  className="mt-1 flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-[#60a5fa22] border border-[#60a5fa55] text-[#60a5fa] font-semibold text-sm hover:bg-[#60a5fa33] transition-colors"
                >
                  Voir {symbol} sur le Dashboard →
                </a>
              </div>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
