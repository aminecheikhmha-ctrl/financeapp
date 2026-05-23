"use client"
import { useState, useEffect, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import confetti from "canvas-confetti"

export type QuizQuestionType =
  | "multiple_choice"
  | "true_false"
  | "fill_the_blank"
  | "order_steps"

export interface QuizQuestion {
  id: number
  type: QuizQuestionType
  question: string
  options: string[]
  correct: number
  explanation: string
  hint?: string
  image_description?: string
}

interface Props {
  questions: QuizQuestion[]
  onComplete: (result: { score: number; xp: number; grade: "S" | "A" | "B" | "C" }) => void
  timePerQuestion?: number
  title?: string
}

function calcGrade(pct: number): "S" | "A" | "B" | "C" {
  if (pct >= 1)   return "S"
  if (pct >= 0.8) return "A"
  if (pct >= 0.6) return "B"
  return "C"
}

const GRADE_COLORS: Record<string, string> = {
  S: "#facc15", A: "#4ade80", B: "#60a5fa", C: "#f87171",
}
const GRADE_LABELS: Record<string, string> = {
  S: "Parfait !", A: "Excellent !", B: "Bien !", C: "Continue !",
}
const LETTERS = ["A", "B", "C", "D"]

// ─── Circular Timer ───────────────────────────────────────────────────────────
function CircularTimer({ timeLeft, total }: { timeLeft: number; total: number }) {
  const radius = 22
  const circ   = 2 * Math.PI * radius
  const pct    = timeLeft / total
  const dash   = pct * circ
  const color  = pct > 0.5 ? "#4ade80" : pct > 0.25 ? "#facc15" : "#ef4444"
  return (
    <div className="relative w-14 h-14 flex-shrink-0">
      <svg width="56" height="56" className="rotate-[-90deg]">
        <circle cx="28" cy="28" r={radius} fill="none" stroke="#1a1a1a" strokeWidth="4" />
        <circle cx="28" cy="28" r={radius} fill="none" stroke={color} strokeWidth="4"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.4s linear, stroke 0.3s" }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-black" style={{ color }}>{timeLeft}</span>
      </div>
    </div>
  )
}

// ─── Floating XP Badge ────────────────────────────────────────────────────────
function FloatingXP({ xp, onDone }: { xp: number; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 1200); return () => clearTimeout(t) }, [onDone])
  return (
    <motion.div
      initial={{ opacity: 1, y: 0, scale: 1 }}
      animate={{ opacity: 0, y: -40, scale: 1.3 }}
      transition={{ duration: 1.2, ease: "easeOut" }}
      className="absolute right-4 top-16 z-30 pointer-events-none font-black text-lg"
      style={{ color: "#facc15", textShadow: "0 0 20px rgba(250,204,21,0.5)" }}
    >
      +{xp} XP
    </motion.div>
  )
}

// ─── Particle Background ──────────────────────────────────────────────────────
function Particles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: 12 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 rounded-full"
          style={{
            left: `${8 + (i * 7.5) % 90}%`,
            top: `${10 + (i * 11) % 80}%`,
            background: i % 3 === 0 ? "#4ade8022" : i % 3 === 1 ? "#60a5fa22" : "#a78bfa22",
          }}
          animate={{
            y: [0, -12, 0],
            opacity: [0.3, 0.7, 0.3],
          }}
          transition={{
            duration: 3 + (i % 3),
            repeat: Infinity,
            delay: i * 0.25,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  )
}

// ─── Order Steps ─────────────────────────────────────────────────────────────
function OrderSteps({ options, onOrder }: { options: string[]; onOrder: (order: number[]) => void }) {
  const [order, setOrder]         = useState<number[]>([])
  const [remaining, setRemaining] = useState<number[]>(options.map((_, i) => i))

  const handleSelect = (idx: number) => {
    const newOrder     = [...order, idx]
    const newRemaining = remaining.filter(i => i !== idx)
    setOrder(newOrder)
    setRemaining(newRemaining)
    if (newOrder.length === options.length) onOrder(newOrder)
  }

  const handleRemove = (pos: number) => {
    const idx = order[pos]
    setRemaining(prev => [...prev, idx].sort((a, b) => a - b))
    setOrder(prev => prev.filter((_, i) => i !== pos))
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        {order.map((idx, pos) => (
          <motion.button key={`p${pos}`} onClick={() => handleRemove(pos)}
            className="flex items-center gap-3 px-4 py-3 rounded-xl border border-green-500/40 bg-green-500/10 text-left"
            initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
            <span className="w-6 h-6 rounded-full bg-green-400 text-black text-xs font-black flex items-center justify-center">{pos + 1}</span>
            <span className="text-sm text-white">{options[idx]}</span>
          </motion.button>
        ))}
        {Array.from({ length: options.length - order.length }).map((_, i) => (
          <div key={`e${i}`} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-dashed border-white/10 bg-white/[0.02]">
            <span className="w-6 h-6 rounded-full border border-white/20 flex items-center justify-center text-xs text-white/30">{order.length + i + 1}</span>
            <span className="text-sm text-white/30">Sélectionner…</span>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {remaining.map(idx => (
          <motion.button key={`r${idx}`} onClick={() => handleSelect(idx)} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            className="px-3 py-2 rounded-lg border border-white/10 bg-white/[0.04] text-sm text-white/80 hover:border-green-500/40 hover:bg-green-500/10 transition-all">
            {options[idx]}
          </motion.button>
        ))}
      </div>
    </div>
  )
}

// ─── Fill The Blank ───────────────────────────────────────────────────────────
function FillTheBlank({ options, hint, onAnswer }: { options: string[]; hint?: string; onAnswer: (idx: number) => void }) {
  const [input, setInput]         = useState("")
  const [showHint, setShowHint]   = useState(false)

  const handleSubmit = () => {
    const norm = (s: string) => s.trim().toLowerCase()
    const match = options.findIndex(o => norm(o) === norm(input))
    onAnswer(match >= 0 ? match : -1)
  }

  return (
    <div className="flex flex-col gap-3">
      <input value={input} onChange={e => setInput(e.target.value)}
        onKeyDown={e => e.key === "Enter" && input && handleSubmit()}
        placeholder="Tapez votre réponse…" autoFocus
        className="w-full rounded-xl px-4 py-3.5 text-white text-sm placeholder-white/20 outline-none focus:border-green-500/50 transition-all"
        style={{ background: "#111", border: "1px solid #2a2a2a" }} />
      <div className="flex gap-2">
        <button onClick={handleSubmit} disabled={!input}
          className="flex-1 py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-30"
          style={{ background: "rgba(74,222,128,0.15)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.3)" }}>
          Valider
        </button>
        <button onClick={() => setShowHint(h => !h)}
          className="px-4 py-3 rounded-xl text-sm transition-all"
          style={{ background: "rgba(250,204,21,0.1)", color: "#facc15", border: "1px solid rgba(250,204,21,0.2)" }}>
          {showHint ? "Cacher" : "💡 Indice"}
        </button>
      </div>
      {showHint && (
        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap gap-2">
          {options.map((o, i) => (
            <button key={i} onClick={() => { setInput(o); onAnswer(i) }}
              className="text-xs px-2 py-1 rounded-lg transition-all"
              style={{ background: "#1a1a1a", color: "#888", border: "1px solid #2a2a2a" }}>
              {o}
            </button>
          ))}
        </motion.div>
      )}
    </div>
  )
}

// ─── Result Screen ────────────────────────────────────────────────────────────
function ResultScreen({
  questions, scores, xpTotal, onComplete,
}: {
  questions: QuizQuestion[]
  scores: boolean[]
  xpTotal: number
  onComplete: (result: { score: number; xp: number; grade: "S" | "A" | "B" | "C" }) => void
}) {
  const correct  = scores.filter(Boolean).length
  const pct      = correct / questions.length
  const grade    = calcGrade(pct)
  const stars    = pct >= 1 ? 3 : pct >= 0.67 ? 2 : 1
  const [starsShown, setStarsShown] = useState(0)

  useEffect(() => {
    const t = setInterval(() => {
      setStarsShown(n => {
        if (n >= stars) { clearInterval(t); return n }
        return n + 1
      })
    }, 350)
    return () => clearInterval(t)
  }, [stars])

  useEffect(() => {
    if (pct >= 1) {
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.5 }, colors: ["#facc15", "#4ade80", "#60a5fa", "#a78bfa"] })
    }
    const t = setTimeout(() => onComplete({ score: correct, xp: xpTotal, grade }), 200)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <motion.div className="flex flex-col items-center gap-6 p-8 rounded-2xl relative overflow-hidden"
      style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}
      initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 22 }}>
      <Particles />

      {/* Grade circle */}
      <motion.div
        initial={{ scale: 0, rotate: -20 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 18, delay: 0.1 }}
        className="w-24 h-24 rounded-full flex items-center justify-center text-5xl font-black shadow-2xl"
        style={{ background: `${GRADE_COLORS[grade]}22`, border: `3px solid ${GRADE_COLORS[grade]}66`, color: GRADE_COLORS[grade] }}>
        {grade}
      </motion.div>

      {/* Stars */}
      <div className="flex gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <motion.span key={i} className="text-3xl"
            initial={{ scale: 0, y: -10 }}
            animate={{ scale: i < starsShown ? 1 : 0.3, y: 0, opacity: i < starsShown ? 1 : 0.2 }}
            transition={{ type: "spring", delay: i * 0.1 }}>
            ⭐
          </motion.span>
        ))}
      </div>

      <div className="text-center">
        <p className="text-2xl font-black text-white">{GRADE_LABELS[grade]}</p>
        <p className="text-white/50 text-sm mt-1">{correct}/{questions.length} bonnes réponses · {Math.round(pct * 100)}%</p>
      </div>

      {/* XP */}
      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.4, type: "spring" }}
        className="flex items-center gap-2.5 px-6 py-3.5 rounded-2xl"
        style={{ background: "rgba(250,204,21,0.1)", border: "1px solid rgba(250,204,21,0.3)" }}>
        <span className="text-2xl">⚡</span>
        <span className="text-2xl font-black" style={{ color: "#facc15" }}>+{xpTotal} XP</span>
      </motion.div>

      {/* Recap */}
      <div className="w-full space-y-1.5">
        {questions.map((q, i) => (
          <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 + i * 0.07 }}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5"
            style={{ background: scores[i] ? "rgba(74,222,128,0.06)" : "rgba(248,113,113,0.06)", border: `1px solid ${scores[i] ? "rgba(74,222,128,0.15)" : "rgba(248,113,113,0.12)"}` }}>
            <span className="text-base flex-shrink-0">{scores[i] ? "✅" : "❌"}</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-white/60 truncate">{q.question.slice(0, 60)}{q.question.length > 60 ? "…" : ""}</p>
              {!scores[i] && <p className="text-[10px] mt-0.5" style={{ color: "#f87171" }}>{q.explanation.slice(0, 80)}…</p>}
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}

// ─── Main QuizGame ─────────────────────────────────────────────────────────────
export default function QuizGame({ questions, onComplete, timePerQuestion = 30, title = "Quiz" }: Props) {
  const [qIdx,          setQIdx]          = useState(0)
  const [selected,      setSelected]      = useState<number | null>(null)
  const [answered,      setAnswered]      = useState(false)
  const [timeLeft,      setTimeLeft]      = useState(timePerQuestion)
  const [streak,        setStreak]        = useState(0)
  const [combo,         setCombo]         = useState(1)
  const [scores,        setScores]        = useState<boolean[]>([])
  const [xpTotal,       setXpTotal]       = useState(0)
  const [showCombo,     setShowCombo]     = useState(false)
  const [finished,      setFinished]      = useState(false)
  const [floatingXP,    setFloatingXP]    = useState<number | null>(null)
  const timerRef     = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<number>(Date.now())

  const q      = questions[qIdx]
  const isLast = qIdx >= questions.length - 1

  // ── Timer ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (answered || finished) return
    setTimeLeft(timePerQuestion)
    startTimeRef.current = Date.now()
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timerRef.current!)
          handleAnswer(-1)
          return 0
        }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current!)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qIdx, answered, finished])

  const handleAnswer = useCallback((answerIdx: number) => {
    if (answered) return
    clearInterval(timerRef.current!)
    const elapsed    = (Date.now() - startTimeRef.current) / 1000
    const isCorrect  = answerIdx === q.correct
    setSelected(answerIdx)
    setAnswered(true)

    let xp = isCorrect ? 10 : 0
    if (isCorrect && elapsed < 8)    xp += 5   // speed bonus
    if (isCorrect && combo >= 2)     xp = Math.round(xp * combo)

    const newStreak = isCorrect ? streak + 1 : 0
    const newCombo  = isCorrect
      ? streak >= 4 ? 2 : streak >= 2 ? 1.5 : 1
      : 1
    setStreak(newStreak)
    setCombo(newCombo)
    setScores(prev => [...prev, isCorrect])
    setXpTotal(prev => prev + xp)
    if (xp > 0) setFloatingXP(xp)

    if (isCorrect && newStreak >= 2) {
      setShowCombo(true)
      setTimeout(() => setShowCombo(false), 1600)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answered, combo, q, streak])

  const handleNext = () => {
    if (isLast) {
      setFinished(true)
    } else {
      setQIdx(i => i + 1)
      setSelected(null)
      setAnswered(false)
    }
  }

  if (finished) {
    return (
      <ResultScreen
        questions={questions}
        scores={scores}
        xpTotal={xpTotal}
        onComplete={onComplete}
      />
    )
  }

  const timerPct  = (timeLeft / timePerQuestion) * 100
  const isCorrect = selected === q.correct

  return (
    <div className="flex flex-col gap-4 rounded-2xl p-5 relative overflow-hidden"
      style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>
      <Particles />

      {/* Floating XP */}
      <AnimatePresence>
        {floatingXP !== null && <FloatingXP xp={floatingXP} onDone={() => setFloatingXP(null)} />}
      </AnimatePresence>

      {/* Combo banner */}
      <AnimatePresence>
        {showCombo && (
          <motion.div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1.1, opacity: 1 }}
            exit={{ scale: 1.5, opacity: 0 }}
            transition={{ duration: 0.4 }}>
            <div className="px-8 py-4 rounded-2xl text-3xl font-black"
              style={{ background: "rgba(250,204,21,0.15)", border: "1px solid rgba(250,204,21,0.4)", color: "#facc15", textShadow: "0 0 30px rgba(250,204,21,0.6)" }}>
              🔥 Combo ×{combo}!
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between relative z-10">
        <div className="flex items-center gap-3">
          <CircularTimer timeLeft={timeLeft} total={timePerQuestion} />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#555" }}>{title}</p>
            <div className="flex items-center gap-2 mt-0.5">
              {streak >= 2 && (
                <span className="text-xs font-black" style={{ color: "#facc15" }}>🔥 ×{streak}</span>
              )}
              {combo > 1 && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ background: "rgba(250,204,21,0.1)", color: "#facc15", border: "1px solid rgba(250,204,21,0.2)" }}>
                  ×{combo} combo
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-black" style={{ color: "#4ade80" }}>+{xpTotal} XP</span>
          <div className="flex gap-1">
            {questions.map((_, i) => (
              <div key={i} className="w-1.5 h-1.5 rounded-full transition-all"
                style={{ background: i < qIdx ? "#4ade80" : i === qIdx ? "#60a5fa" : "#1a1a1a" }} />
            ))}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 rounded-full overflow-hidden relative z-10" style={{ background: "#1a1a1a" }}>
        <motion.div className="h-full rounded-full" style={{ background: "linear-gradient(90deg,#4ade80,#60a5fa)" }}
          animate={{ width: `${(qIdx / questions.length) * 100}%` }} transition={{ duration: 0.4 }} />
      </div>

      {/* Question */}
      <AnimatePresence mode="wait">
        <motion.div key={qIdx} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.25 }} className="relative z-10">

          {q.image_description && (
            <div className="mb-3 px-4 py-3 rounded-xl text-sm text-white/60 italic"
              style={{ background: "#111", border: "1px solid #1a1a1a" }}>
              📊 {q.image_description}
            </div>
          )}

          <p className="text-lg font-black text-white mb-5 leading-snug">{q.question}</p>

          {/* Answer choices */}
          {!answered && (
            <>
              {q.type === "multiple_choice" && (
                <div className="flex flex-col gap-2.5">
                  {q.options.map((opt, i) => (
                    <motion.button key={i} onClick={() => handleAnswer(i)}
                      whileHover={{ scale: 1.015 }} whileTap={{ scale: 0.985 }}
                      className="flex items-center gap-3 px-4 py-3.5 rounded-xl text-left transition-all"
                      style={{ background: "#111", border: "1px solid #222", color: "#ccc" }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = "#333"; e.currentTarget.style.background = "#161616" }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = "#222"; e.currentTarget.style.background = "#111" }}>
                      <span className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black flex-shrink-0"
                        style={{ background: "#1a1a1a", color: "#666" }}>{LETTERS[i]}</span>
                      <span className="text-sm font-medium">{opt}</span>
                    </motion.button>
                  ))}
                </div>
              )}

              {q.type === "true_false" && (
                <div className="grid grid-cols-2 gap-4">
                  {[0, 1].map(i => (
                    <motion.button key={i} onClick={() => handleAnswer(i)}
                      whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                      className="flex flex-col items-center justify-center gap-3 py-8 rounded-2xl font-black text-lg transition-all"
                      style={{
                        background: i === 0 ? "rgba(74,222,128,0.08)" : "rgba(248,113,113,0.08)",
                        border: `2px solid ${i === 0 ? "rgba(74,222,128,0.3)" : "rgba(248,113,113,0.3)"}`,
                        color: i === 0 ? "#4ade80" : "#f87171",
                      }}>
                      <span className="text-4xl">{i === 0 ? "✓" : "✗"}</span>
                      <span>{q.options[i]}</span>
                    </motion.button>
                  ))}
                </div>
              )}

              {q.type === "fill_the_blank" && (
                <FillTheBlank options={q.options} hint={q.hint} onAnswer={handleAnswer} />
              )}

              {q.type === "order_steps" && (
                <OrderSteps options={q.options} onOrder={ord => {
                  const correct = ord.every((v, i) => v === i)
                  handleAnswer(correct ? q.correct : -1)
                }} />
              )}
            </>
          )}

          {/* Result feedback */}
          {answered && (
            <motion.div className="flex flex-col gap-3"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>

              {/* Options recap */}
              {q.type !== "order_steps" && (
                <div className="flex flex-col gap-2">
                  {q.options.map((opt, i) => {
                    const isRight  = i === q.correct
                    const isWrong  = i === selected && !isRight
                    return (
                      <motion.div key={i}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm"
                        style={{
                          background: isRight ? "rgba(74,222,128,0.1)" : isWrong ? "rgba(248,113,113,0.1)" : "#0d0d0d",
                          border: `1px solid ${isRight ? "rgba(74,222,128,0.3)" : isWrong ? "rgba(248,113,113,0.3)" : "#111"}`,
                          color: isRight ? "#4ade80" : isWrong ? "#f87171" : "#444",
                        }}>
                        <span className="text-base flex-shrink-0">{isRight ? "✅" : isWrong ? "❌" : "·"}</span>
                        <span className={isRight || isWrong ? "font-bold" : ""}>{opt}</span>
                      </motion.div>
                    )
                  })}
                </div>
              )}

              {/* Explanation */}
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                className="flex items-start gap-3 px-4 py-3.5 rounded-xl"
                style={{
                  background: isCorrect ? "rgba(74,222,128,0.06)" : "rgba(96,165,250,0.06)",
                  border: `1px solid ${isCorrect ? "rgba(74,222,128,0.15)" : "rgba(96,165,250,0.15)"}`,
                }}>
                <span className="text-xl flex-shrink-0">{isCorrect ? "🎉" : "💡"}</span>
                <div>
                  <p className="text-sm font-black mb-1" style={{ color: isCorrect ? "#4ade80" : "#60a5fa" }}>
                    {isCorrect ? "Bonne réponse !" : selected === -1 ? "Temps écoulé !" : "Pas tout à fait…"}
                  </p>
                  <p className="text-sm leading-relaxed" style={{ color: "#aaa" }}>{q.explanation}</p>
                </div>
              </motion.div>

              <motion.button onClick={handleNext} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
                className="w-full py-3.5 rounded-xl text-sm font-black transition-all"
                style={{ background: "rgba(74,222,128,0.15)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.3)" }}>
                {isLast ? "Voir les résultats →" : "Question suivante →"}
              </motion.button>
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
