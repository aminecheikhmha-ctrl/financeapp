"use client"
import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import confetti from "canvas-confetti"

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
  date: string
  context: string
  question: string
  correct_action: "buy" | "sell" | "wait"
  result_30d: number
  explanation: string
  indicators: { rsi: number; trend: string; volume: string }
  mood: "bullish" | "bearish" | "neutral"
  portfolio: number
}

// ─── SVG helpers ──────────────────────────────────────────────────────────────
const W = 520, H = 130, PAD = 18

function buildPre(mood: "bullish" | "bearish" | "neutral"): [number, number][] {
  const xs = Array.from({ length: 10 }, (_, i) => PAD + (i * (W - PAD * 2)) / 9)
  const mid = H / 2
  const ys: Record<string, number[]> = {
    bullish: [mid - 14, mid + 2, mid + 18, mid + 30, mid + 38, mid + 40, mid + 37, mid + 35, mid + 36, mid + 34],
    bearish: [mid + 26, mid + 12, mid - 4,  mid - 22, mid - 36, mid - 44, mid - 46, mid - 44, mid - 42, mid - 40],
    neutral: [mid + 4,  mid - 2,  mid + 8,  mid + 3,  mid - 4,  mid + 6,  mid + 2,  mid - 14, mid - 26, mid - 32],
  }
  return xs.map((x, i) => [x, ys[mood][i]])
}

function buildPost(last: [number, number], isPos: boolean): [number, number][] {
  const [lx, ly] = last
  const step = (W - lx) / 6
  return Array.from({ length: 6 }, (_, i) => {
    const x = lx + step * (i + 1)
    const y = ly + (isPos ? -1 : 1) * (8 + i * 9) + Math.sin(i * 1.5) * 4
    return [x, Math.max(PAD, Math.min(H - PAD, y))]
  })
}

function toPath(pts: [number, number][]) {
  return pts.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ")
}

// ─── Pre Chart ────────────────────────────────────────────────────────────────
function PreChart({ mood }: { mood: "bullish" | "bearish" | "neutral" }) {
  const pts  = buildPre(mood)
  const path = toPath(pts)
  const area = path + ` L ${pts[pts.length - 1][0]} ${H} L ${pts[0][0]} ${H} Z`
  const col  = mood === "bullish" ? "#4ade80" : mood === "bearish" ? "#f87171" : "#60a5fa"
  const lastX = pts[pts.length - 1][0]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
      <defs>
        <linearGradient id={`pg-${mood}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={col} stopOpacity="0.25" />
          <stop offset="100%" stopColor={col} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#pg-${mood})`} />
      <motion.path d={path} fill="none" stroke={col} strokeWidth="2.5" strokeLinecap="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.8, ease: "easeInOut" }} />
      {/* "NOW" marker */}
      <line x1={lastX} y1={PAD} x2={lastX} y2={H - PAD} stroke="#ffffff25" strokeWidth={1} strokeDasharray="4 3" />
      <motion.text x={lastX + 6} y={PAD + 10} fill="#ffffff40" fontSize={9} fontWeight="bold"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
        MAINTENANT →
      </motion.text>
      {/* Last price dot */}
      <motion.circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r={5} fill={col}
        animate={{ r: [4, 7, 4] }} transition={{ duration: 1.2, repeat: Infinity }} />
    </svg>
  )
}

// ─── Post Reveal Chart ────────────────────────────────────────────────────────
function PostChart({ mood, resultPos }: { mood: "bullish" | "bearish" | "neutral"; resultPos: boolean }) {
  const prePts  = buildPre(mood)
  const postPts = buildPost(prePts[prePts.length - 1], resultPos)
  const [visible, setVisible] = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
      setVisible(v => { if (v >= postPts.length) { clearInterval(id); return v }; return v + 1 })
    }, 280)
    return () => clearInterval(id)
  }, [postPts.length])

  const preCol  = mood === "bullish" ? "#4ade80" : mood === "bearish" ? "#f87171" : "#60a5fa"
  const postCol = resultPos ? "#4ade80" : "#f87171"
  const freezeX = prePts[prePts.length - 1][0]

  const allPts  = [...prePts, ...postPts.slice(0, visible)]
  const allPath = toPath(allPts)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
      <defs>
        <linearGradient id="post-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={postCol} stopOpacity="0.2" />
          <stop offset="100%" stopColor={postCol} stopOpacity="0.01" />
        </linearGradient>
      </defs>

      {/* Pre path (dashed) */}
      <path d={toPath(prePts)} fill="none" stroke={preCol} strokeWidth={2} strokeLinecap="round" strokeDasharray="4 2" opacity={0.5} />

      {/* Freeze line */}
      <line x1={freezeX} y1={PAD} x2={freezeX} y2={H - PAD} stroke="#ffffff30" strokeWidth={1} strokeDasharray="4 3" />
      <text x={freezeX + 5} y={PAD + 9} fill="#ffffff40" fontSize={8}>DÉCISION</text>

      {/* Post path revealed */}
      {visible > 0 && (
        <>
          <path
            d={toPath([prePts[prePts.length - 1], ...postPts.slice(0, visible)]) + ` L ${postPts[visible - 1][0]} ${H} L ${freezeX} ${H} Z`}
            fill="url(#post-grad)" />
          <motion.path
            d={toPath([prePts[prePts.length - 1], ...postPts.slice(0, visible)])}
            fill="none" stroke={postCol} strokeWidth={3} strokeLinecap="round" />
        </>
      )}
    </svg>
  )
}

// ─── Scenarios ────────────────────────────────────────────────────────────────
const SCENARIOS: Record<string, Scenario> = {
  aapl_rsi_oversold_2024: {
    symbol: "AAPL", date: "Janvier 2024", portfolio: 100_000,
    context: "AAPL a corrigé de 18% depuis ses plus hauts de décembre 2023. Le RSI(14) est à 27 — une survente rare sur ce titre. Les volumes sont en dessous de la moyenne : peu de vendeurs restants.",
    question: "Le RSI est à 27 et le prix est sur un support mensuel. Que fais-tu ?",
    correct_action: "buy", result_30d: 14.8,
    explanation: "La survente extrême (RSI 27) sur un support mensuel était un setup d'entrée classique. Les institutionnels ont accumulé discrètement. AAPL a rallié +14.8% dans les 30 jours.",
    indicators: { rsi: 27, trend: "Correction -18%", volume: "Faible ↓" },
    mood: "bullish",
  },
  nvda_overbought_2024: {
    symbol: "NVDA", date: "Mars 2024", portfolio: 100_000,
    context: "NVDA a explosé de +220% en 6 mois grâce à l'engouement IA. Le RSI(14) est à 84 — surachat extrême. Les volumes commencent à diminuer malgré la hausse : divergence baissière en cours.",
    question: "NVDA a doublé en 6 mois, RSI 84, volumes qui baissent. Que fais-tu ?",
    correct_action: "sell", result_30d: -12.4,
    explanation: "La divergence baissière (prix monte, volumes baissent) + RSI 84 signalait un épuisement des acheteurs. NVDA a corrigé -12.4% avant de reprendre sa hausse 6 semaines plus tard.",
    indicators: { rsi: 84, trend: "Hausse +220%", volume: "Divergence ↓" },
    mood: "bearish",
  },
  btc_breakout_2024: {
    symbol: "BTC", date: "Octobre 2024", portfolio: 100_000,
    context: "Bitcoin consolide depuis 3 mois dans une fourchette $58k–$64k. RSI neutre à 52. Les Bandes de Bollinger se contractent fortement : squeeze détecté. Le halving a eu lieu 6 mois plus tôt.",
    question: "BTC consolide depuis 90 jours, squeeze Bollinger, RSI neutre. Que fais-tu ?",
    correct_action: "buy", result_30d: 31.2,
    explanation: "Le squeeze Bollinger post-halving était un signal d'accumulation institutionnelle classique. BTC a breaké à la hausse avec violence, ralliant +31% en 30 jours vers $84k.",
    indicators: { rsi: 52, trend: "Consolidation 3 mois", volume: "Compression" },
    mood: "neutral",
  },
}

const FALLBACK: Scenario = SCENARIOS.aapl_rsi_oversold_2024

// ─── Context Reveal Lines ─────────────────────────────────────────────────────
function ContextReveal({ scenario, onReady }: { scenario: Scenario; onReady: () => void }) {
  const [lineIdx, setLineIdx] = useState(0)
  const lines = [
    `📅 ${scenario.date}`,
    `${scenario.symbol} — ${scenario.indicators.trend}`,
    `RSI(14) : ${scenario.indicators.rsi}`,
    `Volume : ${scenario.indicators.volume}`,
    `💼 Tu gères $${scenario.portfolio.toLocaleString()}`,
    `Que décides-tu ?`,
  ]

  useEffect(() => {
    if (lineIdx >= lines.length) { setTimeout(onReady, 400); return }
    const t = setTimeout(() => setLineIdx(i => i + 1), 650)
    return () => clearTimeout(t)
  }, [lineIdx, lines.length, onReady])

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-12 min-h-[240px]">
      {lines.slice(0, lineIdx).map((line, i) => (
        <motion.p key={i}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="text-center font-black"
          style={{
            color: i === lines.length - 1 ? "#facc15" : i === 0 ? "#60a5fa" : "#ffffff",
            fontSize: i === 0 ? 13 : i === lines.length - 1 ? 18 : 15,
            letterSpacing: i === 0 ? "0.1em" : "normal",
            opacity: i < lineIdx - 2 ? 0.5 : 1,
          }}>
          {line}
        </motion.p>
      ))}
      {lineIdx < lines.length && (
        <motion.div className="flex gap-1" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity }}>
          {[0, 1, 2].map(i => <div key={i} className="w-1.5 h-1.5 rounded-full bg-white/30" />)}
        </motion.div>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function TradingSandbox({ scenarioId, live = false, symbol, context, question, onComplete }: Props) {
  const [scenario, setScenario] = useState<Scenario | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [cinemaReady, setCinemaReady] = useState(false)
  const [decision, setDecision] = useState<string | null>(null)
  const [phase,    setPhase]    = useState<"cinema" | "decide" | "waiting" | "reveal">("cinema")
  const [xpEarned, setXpEarned] = useState(0)
  const [countdown, setCountdown] = useState(30)
  const cdRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    setLoading(true)
    const sc = scenarioId && SCENARIOS[scenarioId]
      ? SCENARIOS[scenarioId]
      : scenarioId
      ? { ...FALLBACK, symbol: symbol ?? FALLBACK.symbol, context: context ?? FALLBACK.context, question: question ?? FALLBACK.question }
      : { ...FALLBACK, symbol: symbol ?? FALLBACK.symbol, context: context ?? FALLBACK.context, question: question ?? FALLBACK.question }
    setScenario(sc)
    setLoading(false)
  }, [scenarioId, symbol, context, question])

  // Optional countdown during decision phase
  useEffect(() => {
    if (phase !== "decide") return
    setCountdown(30)
    cdRef.current = setInterval(() => {
      setCountdown(c => { if (c <= 1) { clearInterval(cdRef.current!); return 0 }; return c - 1 })
    }, 1000)
    return () => { if (cdRef.current) clearInterval(cdRef.current) }
  }, [phase])

  const handleDecision = (d: string) => {
    if (!scenario || phase !== "decide") return
    if (cdRef.current) clearInterval(cdRef.current)
    setDecision(d)
    setPhase("waiting")
    setTimeout(() => {
      const correct = d === scenario.correct_action
      const xp = correct ? 200 : 60
      setXpEarned(xp)
      setPhase("reveal")
      if (correct) {
        confetti({ particleCount: 80, spread: 70, origin: { y: 0.4 }, colors: ["#4ade80", "#facc15", "#60a5fa"] })
      }
      onComplete?.({ decision: d, correct, xp })
    }, 2400)
  }

  if (loading || !scenario) {
    return (
      <div className="flex items-center justify-center h-48 rounded-2xl" style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 rounded-full border-2 border-t-transparent" style={{ borderColor: "#4ade80" }} />
      </div>
    )
  }

  const isCorrect  = decision === scenario.correct_action
  const resultPos  = scenario.result_30d > 0
  const gain       = Math.abs(Math.round(scenario.portfolio * scenario.result_30d / 100))

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "#111" }}>
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded-full text-xs font-black"
            style={{ background: "rgba(96,165,250,0.15)", color: "#60a5fa", border: "1px solid rgba(96,165,250,0.25)" }}>
            {scenario.symbol}
          </span>
          <span className="text-xs font-bold" style={{ color: "#555" }}>Simulateur historique</span>
        </div>
        {live && (
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold"
            style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}>
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
            Mode Live
          </span>
        )}
      </div>

      <div className="p-4">
        <AnimatePresence mode="wait">

          {/* Phase: Cinema */}
          {phase === "cinema" && (
            <motion.div key="cinema" exit={{ opacity: 0 }}>
              <ContextReveal scenario={scenario} onReady={() => { setCinemaReady(true); setPhase("decide") }} />
            </motion.div>
          )}

          {/* Phase: Decide */}
          {phase === "decide" && (
            <motion.div key="decide" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              {/* Context */}
              <div className="rounded-xl px-4 py-3 text-sm leading-relaxed"
                style={{ background: "#111", border: "1px solid #1a1a1a", color: "#ccc" }}>
                {scenario.context}
              </div>

              {/* Indicators */}
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(scenario.indicators).map(([key, val]) => {
                  const label    = key === "rsi" ? "RSI(14)" : key === "trend" ? "Tendance" : "Volume"
                  const rsiNum   = key === "rsi" ? Number(val) : null
                  const isHot    = rsiNum !== null && rsiNum > 70
                  const isCold   = rsiNum !== null && rsiNum < 30
                  const col      = isHot ? "#f87171" : isCold ? "#4ade80" : "#60a5fa"
                  return (
                    <div key={key} className="rounded-xl p-2.5 text-center"
                      style={{ background: `${col}10`, border: `1px solid ${col}30` }}>
                      <div className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: `${col}99` }}>{label}</div>
                      <div className="text-sm font-black" style={{ color: col }}>{String(val)}</div>
                    </div>
                  )
                })}
              </div>

              {/* Chart */}
              <div className="rounded-xl overflow-hidden" style={{ background: "#0a0a0a", border: "1px solid #111" }}>
                <div className="text-[9px] px-3 pt-2 pb-0 font-bold uppercase tracking-widest" style={{ color: "#444" }}>
                  Graphique — 30 derniers jours
                </div>
                <PreChart mood={scenario.mood} />
              </div>

              {/* Countdown */}
              {countdown > 0 && countdown < 25 && (
                <div className="flex justify-center">
                  <span className="text-xs font-bold" style={{ color: countdown < 10 ? "#f87171" : "#555" }}>
                    ⏱ {countdown}s pour décider
                  </span>
                </div>
              )}

              {/* Decision buttons */}
              <p className="text-sm font-black text-white text-center">{scenario.question}</p>
              <div className="grid grid-cols-3 gap-3">
                {([
                  { d: "buy",  label: "ACHETER",  icon: "📈", col: "#4ade80" },
                  { d: "sell", label: "VENDRE",   icon: "📉", col: "#f87171" },
                  { d: "wait", label: "ATTENDRE", icon: "⏸️", col: "#facc15" },
                ] as const).map(({ d, label, icon, col }) => (
                  <motion.button key={d} onClick={() => handleDecision(d)}
                    whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.95 }}
                    className="flex flex-col items-center gap-2 py-4 rounded-xl font-black text-sm transition-all"
                    style={{ background: `${col}10`, border: `2px solid ${col}35`, color: col }}>
                    <span className="text-2xl">{icon}</span>
                    {label}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Phase: Waiting */}
          {phase === "waiting" && (
            <motion.div key="waiting"
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-5 py-14">
              <motion.div className="text-5xl"
                animate={{ rotate: [0, 15, -15, 0], scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity }}>
                ⏳
              </motion.div>
              <div className="text-center">
                <p className="text-white font-black text-lg">Le temps passe…</p>
                <p className="text-white/30 text-sm mt-1">30 jours s'écoulent</p>
              </div>
              <div className="w-48 h-1.5 rounded-full overflow-hidden" style={{ background: "#1a1a1a" }}>
                <motion.div className="h-full rounded-full"
                  style={{ background: "linear-gradient(90deg,#60a5fa,#4ade80)" }}
                  initial={{ width: "0%" }} animate={{ width: "100%" }}
                  transition={{ duration: 2.3, ease: "easeInOut" }} />
              </div>
              {/* Calendar days counting */}
              {[5, 10, 15, 20, 25, 30].map((day, i) => (
                <motion.span key={day} className="absolute text-white/10 text-xs font-bold"
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: [0, 0.5, 0], scale: [0.5, 1, 0.8] }}
                  transition={{ delay: i * 0.35, duration: 0.6 }}
                  style={{ left: `${15 + i * 13}%`, top: "50%" }}>
                  J+{day}
                </motion.span>
              ))}
            </motion.div>
          )}

          {/* Phase: Reveal */}
          {phase === "reveal" && decision !== null && (
            <motion.div key="reveal"
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", bounce: 0.3 }}
              className="space-y-4">

              {/* Big result */}
              <div className="flex flex-col items-center gap-2 py-4">
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1, type: "spring", stiffness: 280, damping: 18 }}
                  className="text-6xl font-black"
                  style={{ color: resultPos ? "#4ade80" : "#f87171" }}>
                  {resultPos ? "+" : ""}{scenario.result_30d}%
                </motion.div>
                <p className="text-white/40 text-xs">Performance à 30 jours</p>

                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.3, type: "spring" }}
                  className="font-black text-lg"
                  style={{ color: resultPos ? "#4ade80" : "#f87171" }}>
                  {resultPos ? `+$${gain.toLocaleString()}` : `-$${gain.toLocaleString()}`}
                </motion.div>
              </div>

              {/* Verdict */}
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="rounded-2xl p-4 text-center"
                style={{
                  background: isCorrect ? "rgba(74,222,128,0.07)" : "rgba(248,113,113,0.07)",
                  border: `1px solid ${isCorrect ? "rgba(74,222,128,0.25)" : "rgba(248,113,113,0.2)"}`,
                }}>
                <div className="text-3xl mb-2">{isCorrect ? "🎯" : "😬"}</div>
                <p className="font-black text-lg mb-2" style={{ color: isCorrect ? "#4ade80" : "#f87171" }}>
                  {isCorrect ? "Excellent jugement !" : "Pas cette fois…"}
                </p>
                <p className="text-sm leading-relaxed" style={{ color: "#aaa" }}>{scenario.explanation}</p>
              </motion.div>

              {/* Post chart */}
              <div className="rounded-xl overflow-hidden" style={{ background: "#0a0a0a", border: "1px solid #111" }}>
                <div className="text-[9px] px-3 pt-2 font-bold uppercase tracking-widest" style={{ color: "#444" }}>
                  Évolution sur les 30 jours suivants
                </div>
                <PostChart mood={scenario.mood} resultPos={resultPos} />
              </div>

              {/* XP */}
              <motion.div
                initial={{ scale: 0, rotate: -12 }} animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.5, type: "spring", stiffness: 300 }}
                className="flex justify-center">
                <div className="flex items-center gap-2.5 px-6 py-3 rounded-2xl"
                  style={{ background: "rgba(250,204,21,0.1)", border: "1px solid rgba(250,204,21,0.3)" }}>
                  <span className="text-2xl">⚡</span>
                  <span className="text-xl font-black" style={{ color: "#facc15" }}>+{xpEarned} XP</span>
                  <span className="text-sm text-white/40">gagnés</span>
                </div>
              </motion.div>

              {!isCorrect && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}
                  className="rounded-xl px-4 py-3 text-sm text-center"
                  style={{ background: "rgba(96,165,250,0.06)", border: "1px solid rgba(96,165,250,0.15)", color: "#60a5fa" }}>
                  💡 L'échec est la meilleure école — tu gardes les XP pour avoir essayé !
                </motion.div>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  )
}
