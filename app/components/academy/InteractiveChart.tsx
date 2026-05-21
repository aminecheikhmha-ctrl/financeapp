"use client"
import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"

export type LessonMode =
  | "identify_support"
  | "identify_resistance"
  | "spot_rsi"
  | "identify_macd_crossover"
  | "find_pattern"

interface Props {
  lessonMode: LessonMode
  symbol?: string
  instruction: string
  hint?: string
  onCorrect?: (xp: number) => void
  onComplete?: () => void
}

// ── Constants ─────────────────────────────────────────────────────────────────

const W = 360
const H = 160
const PAD_X = 20
const PAD_Y = 12

// ── Price data helpers ────────────────────────────────────────────────────────

interface PriceBar { close: number; high: number; low: number }

function normalizeToSvg(bars: PriceBar[]): { pts: [number, number][]; minV: number; maxV: number } {
  const closes = bars.map(b => b.close)
  const minV = Math.min(...bars.map(b => b.low))
  const maxV = Math.max(...bars.map(b => b.high))
  const range = maxV - minV || 1
  const pts: [number, number][] = closes.map((c, i) => {
    const x = PAD_X + (i / (closes.length - 1)) * (W - PAD_X * 2)
    const y = PAD_Y + ((maxV - c) / range) * (H - PAD_Y * 2)
    return [x, y]
  })
  return { pts, minV, maxV }
}

function priceToY(price: number, minV: number, maxV: number): number {
  const range = maxV - minV || 1
  return PAD_Y + ((maxV - price) / range) * (H - PAD_Y * 2)
}

function yToPrice(y: number, minV: number, maxV: number): number {
  const range = maxV - minV || 1
  return maxV - ((y - PAD_Y) / (H - PAD_Y * 2)) * range
}

function pointsToPath(pts: [number, number][]): string {
  return pts.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ")
}

// ── Hardcoded fallback price data ─────────────────────────────────────────────

const SUPPORT_BARS: PriceBar[] = [
  { close: 182, high: 184, low: 180 },
  { close: 178, high: 183, low: 177 },
  { close: 175, high: 179, low: 174 },
  { close: 176, high: 178, low: 174 },
  { close: 180, high: 182, low: 175 },
  { close: 184, high: 186, low: 179 },
  { close: 179, high: 185, low: 178 },
  { close: 176, high: 180, low: 174 },
  { close: 175, high: 177, low: 173 },
  { close: 178, high: 180, low: 174 },
  { close: 183, high: 185, low: 177 },
  { close: 186, high: 188, low: 182 },
  { close: 181, high: 187, low: 180 },
  { close: 175, high: 182, low: 174 },
  { close: 174, high: 176, low: 172 },
  { close: 177, high: 178, low: 173 },
  { close: 182, high: 184, low: 176 },
  { close: 185, high: 187, low: 181 },
  { close: 183, high: 186, low: 182 },
  { close: 180, high: 184, low: 179 },
]

const RESISTANCE_BARS: PriceBar[] = SUPPORT_BARS.map(b => ({
  close: 220 - (b.close - 174),
  high: 222 - (b.low - 172),
  low: 218 - (b.high - 188),
}))

// ── Support/Resistance Mode ───────────────────────────────────────────────────

function SupportResistanceMode({
  lessonMode, bars, instruction, hint, onCorrect, onComplete,
}: {
  lessonMode: "identify_support" | "identify_resistance"
  bars: PriceBar[]
  instruction: string
  hint?: string
  onCorrect?: (xp: number) => void
  onComplete?: () => void
}) {
  const { pts, minV, maxV } = normalizeToSvg(bars)
  const path = pointsToPath(pts)
  const areaPath = path + ` L ${pts[pts.length - 1][0]} ${H} L ${pts[0][0]} ${H} Z`

  // Correct level
  const correctPrice = lessonMode === "identify_support"
    ? Math.min(...bars.map(b => b.low)) + 1
    : Math.max(...bars.map(b => b.high)) - 1

  const [lineY, setLineY] = useState(H / 2)
  const [attempts, setAttempts] = useState(0)
  const [status, setStatus] = useState<"idle" | "correct" | "wrong">("idle")
  const [showHint, setShowHint] = useState(false)
  const [xp] = useState(100)

  const correctY = priceToY(correctPrice, minV, maxV)
  const currentPrice = yToPrice(lineY, minV, maxV)

  const validate = () => {
    const pct = Math.abs(currentPrice - correctPrice) / (maxV - minV)
    if (pct < 0.03) {
      setStatus("correct")
      onCorrect?.(xp)
      onComplete?.()
    } else {
      const next = attempts + 1
      setAttempts(next)
      setStatus("wrong")
      if (next >= 3) setShowHint(true)
      setTimeout(() => setStatus("idle"), 1500)
    }
  }

  const lineColor = lessonMode === "identify_support" ? "#4ade80" : "#f87171"

  return (
    <div className="space-y-3">
      <p className="text-sm text-white/80 text-center font-medium">{instruction}</p>

      {/* Chart */}
      <div className="rounded-lg bg-black/40 border border-white/[0.06] px-2 pt-2 pb-1 relative">
        <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ height: H }}>
          <defs>
            <linearGradient id="sr-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#60a5fa" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill="url(#sr-grad)" />
          <path d={path} fill="none" stroke="#60a5fa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          {/* draggable line */}
          <line x1={PAD_X} y1={lineY} x2={W - PAD_X} y2={lineY} stroke={lineColor} strokeWidth="2" strokeDasharray="6 3" />
          <rect x={W - PAD_X - 48} y={lineY - 9} width={46} height={18} rx={4} fill={lineColor} opacity={0.9} />
          <text x={W - PAD_X - 25} y={lineY + 5} textAnchor="middle" fill="#000" fontSize="9" fontWeight="bold">
            ${currentPrice.toFixed(1)}
          </text>
        </svg>
      </div>

      {/* Slider */}
      <div className="px-2">
        <input
          type="range"
          min={PAD_Y}
          max={H - PAD_Y}
          value={lineY}
          onChange={e => setLineY(Number(e.target.value))}
          className="w-full accent-blue-400"
          style={{ direction: "ltr" }}
        />
        <div className="flex justify-between text-[10px] text-white/30 mt-0.5">
          <span>Haut ${maxV.toFixed(0)}</span>
          <span>Glisser pour positionner</span>
          <span>Bas ${minV.toFixed(0)}</span>
        </div>
      </div>

      {showHint && hint && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-300"
        >
          💡 {hint}
        </motion.div>
      )}

      {attempts > 0 && status !== "correct" && (
        <p className="text-center text-xs text-white/40">Tentative {attempts}/3</p>
      )}

      <AnimatePresence>
        {status === "correct" && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="rounded-xl border border-green-500/40 bg-green-500/10 p-3 text-center"
          >
            <div className="text-2xl mb-1">✅</div>
            <p className="text-green-400 font-bold">Correct !</p>
            <p className="text-xs text-white/60 mt-1">Niveau {lessonMode === "identify_support" ? "support" : "résistance"} : ${correctPrice.toFixed(1)}</p>
            <div className="mt-2 inline-flex items-center gap-1 px-3 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-xs font-bold">
              +{xp} XP
            </div>
          </motion.div>
        )}
        {status === "wrong" && (
          <motion.div
            initial={{ x: -6, opacity: 0 }}
            animate={{ x: [0, -4, 4, -4, 0], opacity: 1 }}
            className="rounded-xl border border-red-500/30 bg-red-500/[0.08] p-2 text-center text-red-400 text-sm"
          >
            Pas tout à fait... ajustez votre ligne
          </motion.div>
        )}
      </AnimatePresence>

      {status !== "correct" && (
        <button
          onClick={validate}
          className="w-full py-2.5 rounded-xl bg-blue-500/20 border border-blue-500/40 text-blue-300 text-sm font-semibold hover:bg-blue-500/30 transition-all"
        >
          Valider ma réponse
        </button>
      )}
    </div>
  )
}

// ── RSI Mode ──────────────────────────────────────────────────────────────────

function SpotRSIMode({
  instruction, hint, onCorrect, onComplete,
}: {
  instruction: string
  hint?: string
  onCorrect?: (xp: number) => void
  onComplete?: () => void
}) {
  const rsiValue = 78
  const [selected, setSelected] = useState<string | null>(null)
  const [attempts, setAttempts] = useState(0)
  const [showHint, setShowHint] = useState(false)
  const [status, setStatus] = useState<"idle" | "correct" | "wrong">("idle")

  const correct = rsiValue > 70 ? "overbought" : rsiValue < 30 ? "oversold" : "neutral"

  const options = [
    { id: "overbought", label: "🔴 Suracheté", sub: "RSI > 70" },
    { id: "oversold", label: "🟢 Survendu", sub: "RSI < 30" },
    { id: "neutral", label: "⚪ Neutre", sub: "RSI 30–70" },
  ]

  // RSI bar chart
  const rsiPts: [number, number][] = [22, 35, 48, 60, 55, 62, 70, 74, 78].map((v, i) => {
    const x = PAD_X + (i / 8) * (W - PAD_X * 2)
    const y = PAD_Y + ((100 - v) / 100) * (80 - PAD_Y * 2)
    return [x, y]
  })
  const rsiPath = pointsToPath(rsiPts)

  const validate = (id: string) => {
    setSelected(id)
    if (id === correct) {
      setStatus("correct")
      onCorrect?.(100)
      onComplete?.()
    } else {
      const next = attempts + 1
      setAttempts(next)
      setStatus("wrong")
      if (next >= 2) setShowHint(true)
      setTimeout(() => { setStatus("idle"); setSelected(null) }, 1200)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-white/80 text-center font-medium">{instruction}</p>

      {/* Big RSI number */}
      <div className="flex flex-col items-center gap-1">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", bounce: 0.4 }}
          className="text-6xl font-black text-red-400"
        >
          {rsiValue}
        </motion.div>
        <p className="text-xs text-white/40">RSI(14) actuel</p>
      </div>

      {/* RSI mini chart */}
      <div className="rounded-lg bg-black/40 border border-white/[0.06] px-2 pt-2 pb-1">
        <div className="text-[10px] text-white/30 mb-1">RSI(14) — évolution</div>
        <svg width="100%" viewBox={`0 0 ${W} 80`} style={{ height: 80 }}>
          <line x1={PAD_X} y1={PAD_Y + ((100 - 70) / 100) * (80 - PAD_Y * 2)} x2={W - PAD_X} y2={PAD_Y + ((100 - 70) / 100) * (80 - PAD_Y * 2)} stroke="#f87171" strokeWidth="1" strokeDasharray="4 2" opacity="0.5" />
          <line x1={PAD_X} y1={PAD_Y + ((100 - 30) / 100) * (80 - PAD_Y * 2)} x2={W - PAD_X} y2={PAD_Y + ((100 - 30) / 100) * (80 - PAD_Y * 2)} stroke="#4ade80" strokeWidth="1" strokeDasharray="4 2" opacity="0.5" />
          <path d={rsiPath} fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <text x={W - PAD_X + 2} y={PAD_Y + ((100 - 70) / 100) * (80 - PAD_Y * 2) + 4} fill="#f87171" fontSize="8" opacity="0.6">70</text>
          <text x={W - PAD_X + 2} y={PAD_Y + ((100 - 30) / 100) * (80 - PAD_Y * 2) + 4} fill="#4ade80" fontSize="8" opacity="0.6">30</text>
        </svg>
      </div>

      {showHint && hint && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-300"
        >
          💡 {hint}
        </motion.div>
      )}

      <div className="grid grid-cols-3 gap-2">
        {options.map(opt => (
          <button
            key={opt.id}
            onClick={() => validate(opt.id)}
            disabled={status === "correct"}
            className={`flex flex-col items-center gap-0.5 py-3 rounded-xl border text-sm font-semibold transition-all ${
              status === "correct" && selected === opt.id
                ? "border-green-500/60 bg-green-500/20 text-green-300"
                : status === "wrong" && selected === opt.id
                ? "border-red-500/60 bg-red-500/20 text-red-300"
                : "border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.07]"
            }`}
          >
            <span>{opt.label}</span>
            <span className="text-[10px] opacity-50">{opt.sub}</span>
          </button>
        ))}
      </div>

      <AnimatePresence>
        {status === "correct" && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="rounded-xl border border-green-500/40 bg-green-500/10 p-3 text-center"
          >
            <div className="text-2xl mb-1">✅</div>
            <p className="text-green-400 font-bold">Félicitations !</p>
            <p className="text-xs text-white/60 mt-1">RSI {rsiValue} = surachat → signal baissier potentiel</p>
            <div className="mt-2 inline-flex items-center gap-1 px-3 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-xs font-bold">
              +100 XP
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── MACD Crossover Mode ───────────────────────────────────────────────────────

function MACDCrossoverMode({
  instruction, hint, onCorrect, onComplete,
}: {
  instruction: string
  hint?: string
  onCorrect?: (xp: number) => void
  onComplete?: () => void
}) {
  const [selected, setSelected] = useState<string | null>(null)
  const [attempts, setAttempts] = useState(0)
  const [showHint, setShowHint] = useState(false)
  const [status, setStatus] = useState<"idle" | "correct" | "wrong">("idle")

  // The highlighted crossover is bullish (MACD crosses above Signal)
  const correctAnswer = "buy"

  const macdPts: [number, number][] = [-2, -3, -2.5, -1.5, 0, 1.5, 2, 2.5, 2, 1.5].map((v, i) => [
    PAD_X + (i / 9) * (W - PAD_X * 2),
    60 - v * 12,
  ])
  const signalPts: [number, number][] = [-1.5, -2.5, -2, -2, -1, 0.5, 1.5, 2, 2, 1.8].map((v, i) => [
    PAD_X + (i / 9) * (W - PAD_X * 2),
    60 - v * 12,
  ])

  const crossoverX = PAD_X + (4 / 9) * (W - PAD_X * 2)

  const validate = (ans: string) => {
    setSelected(ans)
    if (ans === correctAnswer) {
      setStatus("correct")
      onCorrect?.(100)
      onComplete?.()
    } else {
      const next = attempts + 1
      setAttempts(next)
      setStatus("wrong")
      if (next >= 2) setShowHint(true)
      setTimeout(() => { setStatus("idle"); setSelected(null) }, 1200)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-white/80 text-center font-medium">{instruction}</p>

      <div className="rounded-lg bg-black/40 border border-white/[0.06] px-2 pt-2 pb-1">
        <div className="text-[10px] text-white/30 mb-1">MACD — croisement mis en évidence ▼</div>
        <svg width="100%" viewBox={`0 0 ${W} 120`} style={{ height: 120 }}>
          {/* Zero line */}
          <line x1={PAD_X} y1={60} x2={W - PAD_X} y2={60} stroke="#ffffff20" strokeWidth="1" />
          {/* Highlight crossover area */}
          <rect x={crossoverX - 10} y={PAD_Y} width={20} height={120 - PAD_Y * 2} fill="#ffffff08" rx={3} />
          <line x1={crossoverX} y1={PAD_Y} x2={crossoverX} y2={120 - PAD_Y} stroke="#fbbf24" strokeWidth="1.5" strokeDasharray="4 2" />
          <text x={crossoverX} y={PAD_Y + 8} textAnchor="middle" fill="#fbbf24" fontSize="9">croisement</text>
          {/* MACD line */}
          <path d={pointsToPath(macdPts as [number,number][])} fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" />
          {/* Signal line */}
          <path d={pointsToPath(signalPts as [number,number][])} fill="none" stroke="#f97316" strokeWidth="1.5" strokeDasharray="5 2" strokeLinecap="round" />
          {/* Legend */}
          <line x1={PAD_X} y1={110} x2={PAD_X + 16} y2={110} stroke="#60a5fa" strokeWidth="2" />
          <text x={PAD_X + 20} y={113} fill="#60a5fa" fontSize="9">MACD</text>
          <line x1={PAD_X + 60} y1={110} x2={PAD_X + 76} y2={110} stroke="#f97316" strokeWidth="1.5" strokeDasharray="5 2" />
          <text x={PAD_X + 80} y={113} fill="#f97316" fontSize="9">Signal</text>
        </svg>
      </div>

      {showHint && hint && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-300">
          💡 {hint}
        </motion.div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => validate("buy")} disabled={status === "correct"} className={`py-3 rounded-xl border font-bold text-sm transition-all ${status === "correct" && selected === "buy" ? "border-green-500/60 bg-green-500/20 text-green-300" : status === "wrong" && selected === "buy" ? "border-red-500/60 bg-red-500/20 text-red-300" : "border-green-500/30 bg-green-500/10 text-green-400 hover:bg-green-500/20"}`}>
          📈 Signal Achat
        </button>
        <button onClick={() => validate("sell")} disabled={status === "correct"} className={`py-3 rounded-xl border font-bold text-sm transition-all ${status === "correct" && selected === "sell" ? "border-green-500/60 bg-green-500/20 text-green-300" : status === "wrong" && selected === "sell" ? "border-red-500/60 bg-red-500/20 text-red-300" : "border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20"}`}>
          📉 Signal Vente
        </button>
      </div>

      <AnimatePresence>
        {status === "correct" && (
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="rounded-xl border border-green-500/40 bg-green-500/10 p-3 text-center">
            <div className="text-2xl mb-1">✅</div>
            <p className="text-green-400 font-bold">Félicitations !</p>
            <p className="text-xs text-white/60 mt-1">MACD croisant Signal vers le haut = croisement haussier = signal d&apos;achat</p>
            <div className="mt-2 inline-flex items-center gap-1 px-3 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-xs font-bold">+100 XP</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Find Pattern Mode ─────────────────────────────────────────────────────────

function FindPatternMode({
  instruction, hint, onCorrect, onComplete,
}: {
  instruction: string
  hint?: string
  onCorrect?: (xp: number) => void
  onComplete?: () => void
}) {
  const [selected, setSelected] = useState<string | null>(null)
  const [attempts, setAttempts] = useState(0)
  const [showHint, setShowHint] = useState(false)
  const [status, setStatus] = useState<"idle" | "correct" | "wrong">("idle")

  const correctPattern = "head_shoulders"

  // Head & shoulders pattern SVG points
  const patternPts: [number, number][] = [
    [PAD_X, 110], [50, 80], [70, 90], [90, 60], [120, 30], [150, 55], [170, 50], [200, 30], [230, 60], [250, 50], [270, 65], [290, 85], [W - PAD_X, 110],
  ]

  const validate = (id: string) => {
    setSelected(id)
    if (id === correctPattern) {
      setStatus("correct")
      onCorrect?.(100)
      onComplete?.()
    } else {
      const next = attempts + 1
      setAttempts(next)
      setStatus("wrong")
      if (next >= 2) setShowHint(true)
      setTimeout(() => { setStatus("idle"); setSelected(null) }, 1200)
    }
  }

  const options = [
    { id: "head_shoulders", label: "Tête-Épaules", emoji: "👤" },
    { id: "double_top", label: "Double Sommet", emoji: "🏔️" },
    { id: "triangle", label: "Triangle Symétrique", emoji: "🔺" },
  ]

  return (
    <div className="space-y-3">
      <p className="text-sm text-white/80 text-center font-medium">{instruction}</p>

      <div className="rounded-lg bg-black/40 border border-white/[0.06] px-2 pt-2 pb-1">
        <div className="text-[10px] text-white/30 mb-1">Identifiez la figure chartiste</div>
        <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ height: H }}>
          <defs>
            <linearGradient id="pat-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#a78bfa" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {/* Neckline */}
          <line x1={PAD_X + 30} y1={90} x2={W - PAD_X - 30} y2={90} stroke="#fbbf24" strokeWidth="1" strokeDasharray="5 3" opacity="0.6" />
          <text x={W - PAD_X - 28} y={87} fill="#fbbf24" fontSize="8" opacity="0.7">neckline</text>
          {/* Pattern */}
          <path d={pointsToPath(patternPts) + ` L ${patternPts[patternPts.length-1][0]} ${H} L ${patternPts[0][0]} ${H} Z`} fill="url(#pat-grad)" />
          <path d={pointsToPath(patternPts)} fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          {/* Labels */}
          <text x={120} y={24} textAnchor="middle" fill="#ffffff50" fontSize="9">Tête</text>
          <text x={90} y={55} textAnchor="middle" fill="#ffffff40" fontSize="8">Épaule G</text>
          <text x={200} y={43} textAnchor="middle" fill="#ffffff40" fontSize="8">Épaule D</text>
        </svg>
      </div>

      {showHint && hint && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-300">
          💡 {hint}
        </motion.div>
      )}

      <div className="grid grid-cols-3 gap-2">
        {options.map(opt => (
          <button
            key={opt.id}
            onClick={() => validate(opt.id)}
            disabled={status === "correct"}
            className={`flex flex-col items-center gap-1 py-3 rounded-xl border text-xs font-semibold transition-all ${
              status === "correct" && selected === opt.id ? "border-green-500/60 bg-green-500/20 text-green-300"
              : status === "wrong" && selected === opt.id ? "border-red-500/60 bg-red-500/20 text-red-300"
              : "border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.07]"
            }`}
          >
            <span className="text-xl">{opt.emoji}</span>
            <span>{opt.label}</span>
          </button>
        ))}
      </div>

      <AnimatePresence>
        {status === "correct" && (
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="rounded-xl border border-green-500/40 bg-green-500/10 p-3 text-center">
            <div className="text-2xl mb-1">✅</div>
            <p className="text-green-400 font-bold">Félicitations !</p>
            <p className="text-xs text-white/60 mt-1">Tête-Épaules : figure de retournement baissière classique. La cassure de la neckline confirme le signal de vente.</p>
            <div className="mt-2 inline-flex items-center gap-1 px-3 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-xs font-bold">+100 XP</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function InteractiveChart({ lessonMode, symbol = "AAPL", instruction, hint, onCorrect, onComplete }: Props) {
  const [priceData, setPriceData] = useState<PriceBar[]>([])
  const [loadingData, setLoadingData] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/trading/chart?symbol=${symbol}`)
        if (res.ok) {
          const data = await res.json()
          if (Array.isArray(data) && data.length >= 10) {
            setPriceData(data.slice(-20))
            setLoadingData(false)
            return
          }
        }
      } catch {
        // fall through to fallback
      }
      setPriceData(lessonMode === "identify_resistance" ? RESISTANCE_BARS : SUPPORT_BARS)
      setLoadingData(false)
    }
    load()
  }, [symbol, lessonMode])

  if (loadingData) {
    return (
      <div className="flex items-center justify-center h-32">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full"
        />
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-white/10 bg-[#0d1117] p-4">
      {/* Mode label */}
      <div className="flex items-center gap-2 mb-4">
        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
          {symbol}
        </span>
        <span className="text-xs text-white/40 capitalize">{lessonMode.replace(/_/g, " ")}</span>
      </div>

      {lessonMode === "identify_support" && (
        <SupportResistanceMode
          lessonMode="identify_support"
          bars={priceData}
          instruction={instruction}
          hint={hint}
          onCorrect={onCorrect}
          onComplete={onComplete}
        />
      )}
      {lessonMode === "identify_resistance" && (
        <SupportResistanceMode
          lessonMode="identify_resistance"
          bars={priceData}
          instruction={instruction}
          hint={hint}
          onCorrect={onCorrect}
          onComplete={onComplete}
        />
      )}
      {lessonMode === "spot_rsi" && (
        <SpotRSIMode
          instruction={instruction}
          hint={hint}
          onCorrect={onCorrect}
          onComplete={onComplete}
        />
      )}
      {lessonMode === "identify_macd_crossover" && (
        <MACDCrossoverMode
          instruction={instruction}
          hint={hint}
          onCorrect={onCorrect}
          onComplete={onComplete}
        />
      )}
      {lessonMode === "find_pattern" && (
        <FindPatternMode
          instruction={instruction}
          hint={hint}
          onCorrect={onCorrect}
          onComplete={onComplete}
        />
      )}
    </div>
  )
}
