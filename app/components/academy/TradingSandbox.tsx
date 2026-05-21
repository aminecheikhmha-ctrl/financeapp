"use client"
import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"

interface Props {
  scenarioId?: string
  live?: boolean
  symbol?: string
  context?: string
  question?: string
  onComplete?: (result: { decision: string; correct: boolean; xp: number }) => void
}

interface Scenario {
  symbol: string
  context: string
  question: string
  correct_action: "buy" | "sell" | "wait"
  result_30d: number
  explanation: string
  indicators: { rsi: number; trend: string; volume: string }
  mood: "bullish" | "bearish" | "neutral"
}

// ── SVG path helpers ──────────────────────────────────────────────────────────

const W = 300
const H = 120
const PAD = 16

function pointsToPath(pts: [number, number][]): string {
  return pts.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x} ${y}`).join(" ")
}

function buildPreChart(mood: "bullish" | "bearish" | "neutral"): [number, number][] {
  const xs = Array.from({ length: 9 }, (_, i) => PAD + (i * (W - PAD * 2)) / 8)
  const baseY = H / 2
  if (mood === "bullish") {
    // price goes down then stabilises — oversold setup
    const ys = [baseY - 10, baseY + 5, baseY + 22, baseY + 35, baseY + 40, baseY + 38, baseY + 35, baseY + 36, baseY + 34]
    return xs.map((x, i) => [x, ys[i]])
  }
  if (mood === "bearish") {
    // price goes up aggressively then flattens — overbought setup
    const ys = [baseY + 30, baseY + 15, baseY - 5, baseY - 28, baseY - 42, baseY - 50, baseY - 52, baseY - 50, baseY - 48]
    return xs.map((x, i) => [x, ys[i]])
  }
  // neutral — consolidation then breakout
  const ys = [baseY + 5, baseY - 2, baseY + 8, baseY + 3, baseY - 4, baseY + 6, baseY + 2, baseY - 15, baseY - 30]
  return xs.map((x, i) => [x, ys[i]])
}

function buildPostPoints(lastPt: [number, number], resultPositive: boolean): [number, number][] {
  const postW = W - PAD * 2
  const [lx, ly] = lastPt
  const step = (W - lx) / 5
  return Array.from({ length: 5 }, (_, i) => {
    const x = lx + step * (i + 1)
    const dir = resultPositive ? -1 : 1
    const y = ly + dir * (10 + i * 8) + (Math.sin(i * 1.3) * 4)
    return [x, Math.max(PAD, Math.min(H - PAD, y))]
  })
}

// ── Mini frozen chart ─────────────────────────────────────────────────────────

function FrozenChart({ mood }: { mood: "bullish" | "bearish" | "neutral" }) {
  const pts = buildPreChart(mood)
  const path = pointsToPath(pts)
  const areaPath = path + ` L ${pts[pts.length - 1][0]} ${H} L ${pts[0][0]} ${H} Z`
  const color = mood === "bullish" ? "#4ade80" : mood === "bearish" ? "#f87171" : "#60a5fa"

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 120 }}>
      <defs>
        <linearGradient id={`grad-pre-${mood}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#grad-pre-${mood})`} />
      <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i === pts.length - 1 ? 4 : 2} fill={color} opacity={i === pts.length - 1 ? 1 : 0.4} />
      ))}
    </svg>
  )
}

// ── Post-reveal animated chart ────────────────────────────────────────────────

function RevealChart({ mood, resultPositive, userCorrect }: { mood: "bullish" | "bearish" | "neutral"; resultPositive: boolean; userCorrect: boolean }) {
  const [visiblePost, setVisiblePost] = useState(0)
  const prePts = buildPreChart(mood)
  const postPts = buildPostPoints(prePts[prePts.length - 1], resultPositive)

  useEffect(() => {
    const id = setInterval(() => {
      setVisiblePost(v => {
        if (v >= postPts.length) { clearInterval(id); return v }
        return v + 1
      })
    }, 300)
    return () => clearInterval(id)
  }, [postPts.length])

  const preColor = mood === "bullish" ? "#4ade80" : mood === "bearish" ? "#f87171" : "#60a5fa"
  const postColor = resultPositive ? "#4ade80" : "#f87171"
  const allPts = [...prePts, ...postPts.slice(0, visiblePost)]
  const fullPath = pointsToPath(allPts)
  const areaPath = fullPath + ` L ${allPts[allPts.length - 1][0]} ${H} L ${allPts[0][0]} ${H} Z`

  // freeze vertical line
  const freezeX = prePts[prePts.length - 1][0]

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 130 }}>
      <defs>
        <linearGradient id="grad-post" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={postColor} stopOpacity="0.2" />
          <stop offset="100%" stopColor={postColor} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {/* pre-period */}
      <path d={pointsToPath(prePts) + ` L ${prePts[prePts.length-1][0]} ${H} L ${prePts[0][0]} ${H} Z`} fill={`url(#grad-post)`} opacity="0.3" />
      <path d={pointsToPath(prePts)} fill="none" stroke={preColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="4 2" />
      {/* freeze line */}
      <line x1={freezeX} y1={PAD} x2={freezeX} y2={H - PAD} stroke="#ffffff30" strokeWidth="1" strokeDasharray="3 3" />
      <text x={freezeX + 4} y={PAD + 10} fill="#ffffff40" fontSize="9">NOW</text>
      {/* post period */}
      {visiblePost > 0 && (
        <>
          <path
            d={pointsToPath([prePts[prePts.length - 1], ...postPts.slice(0, visiblePost)]) + ` L ${postPts[visiblePost - 1][0]} ${H} L ${freezeX} ${H} Z`}
            fill={`url(#grad-post)`}
          />
          <path
            d={pointsToPath([prePts[prePts.length - 1], ...postPts.slice(0, visiblePost)])}
            fill="none"
            stroke={postColor}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {postPts.slice(0, visiblePost).map(([x, y], i) => (
            <motion.circle
              key={i}
              cx={x}
              cy={y}
              r={3}
              fill={postColor}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
            />
          ))}
        </>
      )}
    </svg>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

const FALLBACK_SCENARIO: Scenario = {
  symbol: "AAPL",
  context: "Nous sommes en janvier 2024. AAPL a corrigé de 18% depuis ses plus hauts. Le RSI sur le graphique journalier est à 27, en zone de survente extrême. Les volumes sont faibles, indiquant un manque de vendeurs supplémentaires.",
  question: "Que décidez-vous ?",
  correct_action: "buy",
  result_30d: 14.8,
  explanation: "Le RSI à 27 indiquait une survente extrême. Les acheteurs institutionnels ont profité de ce niveau pour accumuler. AAPL a rallié +14.8% dans les 30 jours suivants.",
  indicators: { rsi: 27, trend: "Correction (-18%)", volume: "Faible" },
  mood: "bullish",
}

const SCENARIO_MAP: Record<string, Scenario> = {
  "aapl_rsi_oversold_2024": {
    symbol: "AAPL",
    context: "Nous sommes en janvier 2024. AAPL a corrigé de 18% depuis ses plus hauts de décembre 2023. Le RSI(14) est à 27 — une survente rare sur ce titre. Les volumes sont en dessous de la moyenne sur les 5 dernières séances.",
    question: "Le RSI est à 27 et le prix est sur un support mensuel. Que faites-vous ?",
    correct_action: "buy",
    result_30d: 14.8,
    explanation: "La survente extrême (RSI 27) combinée au support mensuel était un signal d'entrée classique. AAPL a rallié +14.8% dans les 30 jours suivants grâce aux rachats institutionnels.",
    indicators: { rsi: 27, trend: "Correction (-18%)", volume: "Faible — pas de vendeurs" },
    mood: "bullish",
  },
  "nvda_overbought_2024": {
    symbol: "NVDA",
    context: "Nous sommes en mars 2024. NVDA a explosé de +220% en 6 mois grâce à l'engouement IA. Le RSI(14) est à 84 — en surachat extrême. Les volumes ont commencé à diminuer malgré la hausse continue du prix : divergence baissière.",
    question: "NVDA a doublé en 6 mois, RSI à 84, volumes qui baissent. Que faites-vous ?",
    correct_action: "sell",
    result_30d: -12.4,
    explanation: "La divergence baissière (prix monte, volumes baissent) combinée au RSI 84 signalait un épuisement des acheteurs. NVDA a corrigé de -12.4% dans les 30 jours suivants avant de reprendre sa hausse.",
    indicators: { rsi: 84, trend: "Hausse explosive (+220%)", volume: "Divergence baissière" },
    mood: "bearish",
  },
  "btc_breakout_2024": {
    symbol: "BTC",
    context: "Nous sommes en octobre 2024. Bitcoin consolide depuis 3 mois dans une fourchette étroite entre $58k et $64k. Le RSI est à 52 — neutre. Les bandes de Bollinger se contractent fortement : squeeze en cours. Le halving a eu lieu 6 mois plus tôt.",
    question: "Bitcoin consolide depuis 90 jours, squeeze Bollinger, RSI neutre. Que faites-vous ?",
    correct_action: "buy",
    result_30d: 31.2,
    explanation: "Le squeeze Bollinger post-halving était un signal classique d'accumulation institutionnelle. La compression a précédé un breakout majeur. BTC a rallié +31.2% dans les 30 jours pour atteindre $84k.",
    indicators: { rsi: 52, trend: "Consolidation (3 mois)", volume: "Neutre — compression" },
    mood: "neutral",
  },
}

export default function TradingSandbox({ scenarioId, live = false, symbol, context, question, onComplete }: Props) {
  const [scenario, setScenario] = useState<Scenario | null>(null)
  const [loading, setLoading] = useState(true)
  const [decision, setDecision] = useState<string | null>(null)
  const [phase, setPhase] = useState<"decide" | "waiting" | "reveal">("decide")
  const [xpEarned, setXpEarned] = useState(0)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        if (scenarioId && SCENARIO_MAP[scenarioId]) {
          setScenario(SCENARIO_MAP[scenarioId])
        } else if (scenarioId) {
          const res = await fetch(`/api/academy/scenario?id=${scenarioId}`)
          if (res.ok) {
            const data = await res.json()
            setScenario(data)
          } else {
            setScenario(FALLBACK_SCENARIO)
          }
        } else {
          setScenario({
            ...FALLBACK_SCENARIO,
            symbol: symbol ?? FALLBACK_SCENARIO.symbol,
            context: context ?? FALLBACK_SCENARIO.context,
            question: question ?? FALLBACK_SCENARIO.question,
          })
        }
      } catch {
        setScenario(FALLBACK_SCENARIO)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [scenarioId, symbol, context, question])

  const handleDecision = (d: string) => {
    if (!scenario || phase !== "decide") return
    setDecision(d)
    setPhase("waiting")
    setTimeout(() => {
      setPhase("reveal")
      const correct = d === scenario.correct_action
      const xp = correct ? 200 : 50
      setXpEarned(xp)
      onComplete?.({ decision: d, correct, xp })
    }, 2200)
  }

  if (loading || !scenario) {
    return (
      <div className="flex items-center justify-center h-48">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full"
        />
      </div>
    )
  }

  const isCorrect = decision === scenario.correct_action
  const resultPositive = scenario.result_30d > 0
  const userBenefited =
    (decision === "buy" && resultPositive) ||
    (decision === "sell" && !resultPositive) ||
    (decision === "wait" && Math.abs(scenario.result_30d) < 5)

  return (
    <div className="rounded-xl border border-white/10 bg-[#0d1117] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/[0.02]">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
            {scenario.symbol}
          </span>
          <span className="text-xs text-white/40">Simulateur historique</span>
        </div>
        {live && (
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-500/20 text-red-400 border border-red-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
            Mode Live
          </span>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* Context */}
        <div className="rounded-lg bg-white/[0.03] border border-white/[0.07] p-3">
          <p className="text-sm text-white/75 leading-relaxed">{scenario.context}</p>
        </div>

        {/* Indicators */}
        <div className="grid grid-cols-3 gap-2">
          {Object.entries(scenario.indicators).map(([key, val]) => {
            const label = key === "rsi" ? "RSI(14)" : key === "trend" ? "Tendance" : "Volume"
            const rsiNum = key === "rsi" ? Number(val) : null
            const color = rsiNum !== null
              ? rsiNum > 70 ? "text-red-400 border-red-500/30 bg-red-500/10"
              : rsiNum < 30 ? "text-green-400 border-green-500/30 bg-green-500/10"
              : "text-yellow-400 border-yellow-500/30 bg-yellow-500/10"
              : "text-white/60 border-white/10 bg-white/[0.03]"
            return (
              <div key={key} className={`rounded-lg border p-2 text-center ${color}`}>
                <div className="text-[10px] uppercase tracking-wide opacity-70 mb-0.5">{label}</div>
                <div className="text-sm font-bold">{String(val)}</div>
              </div>
            )
          })}
        </div>

        {/* Mini chart */}
        <div className="rounded-lg bg-black/40 border border-white/[0.06] px-2 pt-2 pb-1">
          <div className="text-[10px] text-white/30 mb-1 px-1">Graphique 30 derniers jours — zone de décision ▼</div>
          <FrozenChart mood={scenario.mood} />
        </div>

        {/* Question */}
        <p className="text-sm font-medium text-white/90 text-center">{scenario.question}</p>

        {/* Decisions */}
        <AnimatePresence mode="wait">
          {phase === "decide" && (
            <motion.div
              key="buttons"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="grid grid-cols-3 gap-3"
            >
              <button
                onClick={() => handleDecision("buy")}
                className="flex flex-col items-center gap-1 py-3 px-2 rounded-xl border border-green-500/40 bg-green-500/10 text-green-400 hover:bg-green-500/20 hover:border-green-400/60 transition-all font-bold text-sm"
              >
                <span className="text-xl">📈</span>
                ACHETER
              </button>
              <button
                onClick={() => handleDecision("sell")}
                className="flex flex-col items-center gap-1 py-3 px-2 rounded-xl border border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:border-red-400/60 transition-all font-bold text-sm"
              >
                <span className="text-xl">📉</span>
                VENDRE
              </button>
              <button
                onClick={() => handleDecision("wait")}
                className="flex flex-col items-center gap-1 py-3 px-2 rounded-xl border border-yellow-500/40 bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20 hover:border-yellow-400/60 transition-all font-bold text-sm"
              >
                <span className="text-xl">⏸️</span>
                ATTENDRE
              </button>
            </motion.div>
          )}

          {phase === "waiting" && (
            <motion.div
              key="waiting"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-3 py-6"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                className="text-3xl"
              >
                ⏳
              </motion.div>
              <p className="text-white/60 text-sm font-medium">Le temps passe...</p>
              <div className="w-32 h-1 rounded-full bg-white/10 overflow-hidden">
                <motion.div
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 2.1 }}
                  className="h-full bg-blue-400 rounded-full"
                />
              </div>
              <p className="text-white/30 text-xs">30 jours s&apos;écoulent...</p>
            </motion.div>
          )}

          {phase === "reveal" && (
            <motion.div
              key="reveal"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", bounce: 0.3 }}
              className="space-y-4"
            >
              {/* Big result number */}
              <div className="flex flex-col items-center gap-2 py-4">
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1, type: "spring", bounce: 0.5 }}
                  className={`text-5xl font-black ${resultPositive ? "text-green-400" : "text-red-400"}`}
                >
                  {resultPositive ? "+" : ""}{scenario.result_30d}%
                </motion.div>
                <p className="text-white/50 text-xs">Performance à 30 jours</p>
              </div>

              {/* Verdict */}
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className={`rounded-xl border p-4 text-center ${
                  isCorrect
                    ? "border-green-500/40 bg-green-500/10"
                    : "border-red-500/30 bg-red-500/[0.07]"
                }`}
              >
                <div className="text-2xl mb-1">{isCorrect ? "🎯" : "😬"}</div>
                <p className={`text-lg font-bold mb-1 ${isCorrect ? "text-green-400" : "text-red-400"}`}>
                  {isCorrect ? "Parfait !" : "Pas cette fois..."}
                </p>
                {isCorrect && (
                  <div className="flex justify-center gap-1 mb-2 text-lg">
                    {"🎉✨🏆🎊⭐".split("").map((e, i) => (
                      <motion.span
                        key={i}
                        initial={{ y: 0, opacity: 0 }}
                        animate={{ y: [-8, 0], opacity: 1 }}
                        transition={{ delay: 0.4 + i * 0.08 }}
                      >
                        {e}
                      </motion.span>
                    ))}
                  </div>
                )}
                <p className="text-sm text-white/70 leading-relaxed">{scenario.explanation}</p>
              </motion.div>

              {/* Post chart */}
              <div className="rounded-lg bg-black/40 border border-white/[0.06] px-2 pt-2 pb-1">
                <div className="text-[10px] text-white/30 mb-1 px-1">Évolution sur les 30 jours suivants ▼</div>
                <RevealChart mood={scenario.mood} resultPositive={resultPositive} userCorrect={isCorrect} />
              </div>

              {/* XP badge */}
              <motion.div
                initial={{ scale: 0, rotate: -15 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.5, type: "spring", bounce: 0.6 }}
                className="flex justify-center"
              >
                <div className="flex items-center gap-2 px-4 py-2 rounded-full border border-yellow-500/40 bg-yellow-500/10">
                  <span className="text-yellow-400 font-black text-lg">+{xpEarned} XP</span>
                  <span className="text-yellow-400 text-sm">gagnés</span>
                </div>
              </motion.div>

              {/* Live mode simplified note */}
              {live && (
                <p className="text-center text-xs text-white/30">
                  Mode Live — résultat simulé basé sur les conditions actuelles
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
