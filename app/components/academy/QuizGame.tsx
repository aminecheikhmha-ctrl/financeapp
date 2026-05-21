"use client"
import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"

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
  if (pct >= 1) return "S"
  if (pct >= 0.8) return "A"
  if (pct >= 0.6) return "B"
  return "C"
}

const GRADE_COLORS: Record<string, string> = {
  S: "#facc15",
  A: "#4ade80",
  B: "#60a5fa",
  C: "#f87171",
}

const LETTERS = ["A", "B", "C", "D"]

// ─── Order Steps (click-to-select-and-place) ──────────────────────────────────

function OrderSteps({
  options,
  onOrder,
}: {
  options: string[]
  onOrder: (order: number[]) => void
}) {
  const [order, setOrder] = useState<number[]>([])
  const [remaining, setRemaining] = useState<number[]>(options.map((_, i) => i))

  const handleSelect = (idx: number) => {
    const newOrder = [...order, idx]
    const newRemaining = remaining.filter(i => i !== idx)
    setOrder(newOrder)
    setRemaining(newRemaining)
    if (newOrder.length === options.length) {
      onOrder(newOrder)
    }
  }

  const handleRemove = (pos: number) => {
    const idx = order[pos]
    setRemaining(prev => [...prev, idx].sort((a, b) => a - b))
    setOrder(prev => prev.filter((_, i) => i !== pos))
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Placed items */}
      <div className="flex flex-col gap-2">
        {order.map((idx, pos) => (
          <motion.button key={`placed-${pos}`} onClick={() => handleRemove(pos)}
            className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[#4ade80] bg-[#4ade8011] text-left"
            initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
            <span className="w-6 h-6 rounded-full bg-[#4ade80] text-[#0d0d0d] text-xs font-bold flex items-center justify-center">{pos + 1}</span>
            <span className="text-sm text-white">{options[idx]}</span>
          </motion.button>
        ))}
        {order.length < options.length && Array.from({ length: options.length - order.length }).map((_, i) => (
          <div key={`empty-${i}`} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-dashed border-[#333] bg-[#111]">
            <span className="w-6 h-6 rounded-full border border-[#333] flex items-center justify-center text-xs text-[#555]">{order.length + i + 1}</span>
            <span className="text-sm text-[#555]">Sélectionner…</span>
          </div>
        ))}
      </div>
      {/* Remaining options */}
      <div className="flex flex-wrap gap-2 mt-1">
        {remaining.map(idx => (
          <motion.button key={`rem-${idx}`} onClick={() => handleSelect(idx)}
            className="px-3 py-2 rounded-lg border border-[#1a1a1a] bg-[#111] text-sm text-white hover:border-[#4ade80] transition-colors"
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            {options[idx]}
          </motion.button>
        ))}
      </div>
    </div>
  )
}

// ─── Fill The Blank ───────────────────────────────────────────────────────────

function FillTheBlank({
  question,
  options,
  hint,
  onAnswer,
}: {
  question: string
  options: string[]
  hint?: string
  onAnswer: (idx: number) => void
}) {
  const [input, setInput] = useState("")
  const [showHint, setShowHint] = useState(false)

  const handleSubmit = () => {
    const normalise = (s: string) => s.trim().toLowerCase()
    const match = options.findIndex(o => normalise(o) === normalise(input))
    onAnswer(match >= 0 ? match : -1)
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => e.key === "Enter" && input && handleSubmit()}
        placeholder="Tapez votre réponse…"
        className="w-full bg-[#111] border border-[#1a1a1a] rounded-xl px-4 py-3 text-white text-sm placeholder-[#555] focus:outline-none focus:border-[#4ade80] transition-colors"
        autoFocus
      />
      {/* Hint hints */}
      {showHint && (
        <motion.div className="flex flex-wrap gap-2" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}>
          {options.map((o, i) => (
            <button key={i} onClick={() => { setInput(o); onAnswer(i) }}
              className="text-xs px-2 py-1 rounded bg-[#1a1a1a] text-[#888] hover:text-white hover:bg-[#222] transition-colors">
              {o}
            </button>
          ))}
        </motion.div>
      )}
      <div className="flex gap-2">
        <button onClick={handleSubmit} disabled={!input}
          className="flex-1 py-3 rounded-xl bg-[#4ade8022] border border-[#4ade8055] text-[#4ade80] text-sm font-semibold disabled:opacity-40 hover:bg-[#4ade8033] transition-colors">
          Valider
        </button>
        <button onClick={() => setShowHint(h => !h)}
          className="px-4 py-3 rounded-xl bg-[#facc1511] border border-[#facc1544] text-[#facc15] text-sm">
          {showHint ? "Cacher" : "Indices"}
        </button>
      </div>
    </div>
  )
}

// ─── Main QuizGame ─────────────────────────────────────────────────────────────

export default function QuizGame({ questions, onComplete, timePerQuestion = 30, title = "Quiz" }: Props) {
  const [qIdx, setQIdx] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [answered, setAnswered] = useState(false)
  const [timeLeft, setTimeLeft] = useState(timePerQuestion)
  const [streak, setStreak] = useState(0)
  const [combo, setCombo] = useState(1)
  const [scores, setScores] = useState<boolean[]>([])
  const [xpTotal, setXpTotal] = useState(0)
  const [showCombo, setShowCombo] = useState(false)
  const [finished, setFinished] = useState(false)
  const [orderAnswer, setOrderAnswer] = useState<number[] | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<number>(Date.now())

  const q = questions[qIdx]

  // Timer
  useEffect(() => {
    if (answered || finished) return
    setTimeLeft(timePerQuestion)
    startTimeRef.current = Date.now()
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timerRef.current!)
          handleAnswer(-1) // time out
          return 0
        }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current!)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qIdx, answered, finished])

  const handleAnswer = (answerIdx: number) => {
    if (answered) return
    clearInterval(timerRef.current!)
    const elapsed = (Date.now() - startTimeRef.current) / 1000
    const isCorrect = answerIdx === q.correct
    setSelected(answerIdx)
    setAnswered(true)

    let xp = isCorrect ? 10 : 0
    if (isCorrect && elapsed < 10) xp += 5
    if (isCorrect && combo >= 2) xp *= 2

    const newStreak = isCorrect ? streak + 1 : 0
    const newCombo = isCorrect ? Math.min(streak + 1, 5) : 1
    setStreak(newStreak)
    setCombo(newCombo)
    setScores(prev => [...prev, isCorrect])
    setXpTotal(prev => prev + xp)

    if (isCorrect && newStreak >= 2) {
      setShowCombo(true)
      setTimeout(() => setShowCombo(false), 1500)
    }
  }

  const handleNext = () => {
    if (qIdx >= questions.length - 1) {
      const correct = [...scores, selected === q.correct].filter(Boolean).length
      const pct = correct / questions.length
      const grade = calcGrade(pct)
      setFinished(true)
      onComplete({ score: correct, xp: xpTotal, grade })
    } else {
      setQIdx(i => i + 1)
      setSelected(null)
      setAnswered(false)
      setOrderAnswer(null)
    }
  }

  if (finished) {
    const correct = scores.filter(Boolean).length
    const pct = correct / questions.length
    const grade = calcGrade(pct)
    return (
      <motion.div className="flex flex-col items-center gap-6 p-8 bg-[#0d0d0d] rounded-2xl border border-[#1a1a1a]"
        initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
        <div className="text-6xl font-black" style={{ color: GRADE_COLORS[grade] }}>{grade}</div>
        <div className="text-center">
          <p className="text-xl font-bold text-white">{correct}/{questions.length} correctes</p>
          <p className="text-[#888] text-sm mt-1">{Math.round(pct * 100)}% de réussite</p>
        </div>
        <div className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-[#4ade8022] border border-[#4ade8055]">
          <span className="text-2xl font-bold text-[#4ade80]">+{xpTotal} XP</span>
        </div>
        <div className="w-full flex flex-col gap-2">
          {questions.map((question, i) => (
            <div key={i} className="flex items-center gap-3 text-sm">
              <span className={scores[i] ? "text-[#4ade80]" : "text-[#f87171]"}>{scores[i] ? "✓" : "✗"}</span>
              <span className="text-[#888] truncate flex-1">{question.question.slice(0, 50)}…</span>
            </div>
          ))}
        </div>
      </motion.div>
    )
  }

  const timerPct = (timeLeft / timePerQuestion) * 100
  const timerColor = timerPct > 50 ? "#4ade80" : timerPct > 25 ? "#facc15" : "#f87171"

  return (
    <div className="flex flex-col gap-4 bg-[#0d0d0d] rounded-2xl border border-[#1a1a1a] p-5 relative overflow-hidden">
      {/* Combo banner */}
      <AnimatePresence>
        {showCombo && (
          <motion.div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none"
            initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1.1, opacity: 1 }}
            exit={{ scale: 1.5, opacity: 0 }} transition={{ duration: 0.4 }}>
            <div className="text-3xl font-black text-[#facc15] drop-shadow-lg">🔥 Combo x{combo}!</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-[#888]">{title}</span>
        <div className="flex items-center gap-3">
          <span className="text-xs text-[#facc15]">🔥 {streak} série</span>
          <span className="text-xs text-[#4ade80]">+{xpTotal} XP</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
        <motion.div className="h-full bg-[#60a5fa] rounded-full" animate={{ width: `${((qIdx) / questions.length) * 100}%` }} />
      </div>
      <div className="text-xs text-[#555] text-right -mt-2">{qIdx + 1} / {questions.length}</div>

      {/* Timer bar */}
      <div className="h-1 bg-[#1a1a1a] rounded-full overflow-hidden">
        <motion.div className="h-full rounded-full transition-colors" style={{ backgroundColor: timerColor }}
          animate={{ width: `${timerPct}%` }} transition={{ duration: 0.5 }} />
      </div>

      {/* Question */}
      <AnimatePresence mode="wait">
        <motion.div key={qIdx} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.3 }}>
          {q.image_description && (
            <div className="mb-3 px-4 py-3 rounded-xl bg-[#111] border border-[#1a1a1a] text-sm text-[#888] italic">
              📊 {q.image_description}
            </div>
          )}
          <p className="text-base font-semibold text-white mb-4 leading-relaxed">{q.question}</p>

          {/* Answer area */}
          {!answered && (
            <>
              {q.type === "multiple_choice" && (
                <div className="flex flex-col gap-2">
                  {q.options.map((opt, i) => (
                    <motion.button key={i} onClick={() => handleAnswer(i)}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[#1a1a1a] bg-[#111] text-left hover:border-[#60a5fa] transition-colors"
                      whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                      <span className="w-7 h-7 rounded-lg bg-[#1a1a1a] text-[#888] text-xs font-bold flex items-center justify-center">{LETTERS[i]}</span>
                      <span className="text-sm text-white">{opt}</span>
                    </motion.button>
                  ))}
                </div>
              )}

              {q.type === "true_false" && (
                <div className="grid grid-cols-2 gap-3">
                  {[0, 1].map(i => (
                    <motion.button key={i} onClick={() => handleAnswer(i)}
                      className={`flex flex-col items-center justify-center gap-2 py-6 rounded-2xl border text-lg font-bold transition-colors ${i === 0 ? "border-[#4ade80] text-[#4ade80] bg-[#4ade8011] hover:bg-[#4ade8022]" : "border-[#f87171] text-[#f87171] bg-[#f8717111] hover:bg-[#f8717122]"}`}
                      whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                      <span className="text-3xl">{i === 0 ? "👍" : "👎"}</span>
                      {q.options[i]}
                    </motion.button>
                  ))}
                </div>
              )}

              {q.type === "fill_the_blank" && (
                <FillTheBlank question={q.question} options={q.options} hint={q.hint} onAnswer={handleAnswer} />
              )}

              {q.type === "order_steps" && (
                <OrderSteps options={q.options} onOrder={(ord) => {
                  setOrderAnswer(ord)
                  // Check if correct order matches indices 0,1,2,3...
                  const isCorrect = ord.every((v, i) => v === i)
                  handleAnswer(isCorrect ? q.correct : -1)
                }} />
              )}
            </>
          )}

          {/* Result */}
          {answered && (
            <motion.div className={`flex flex-col gap-3 p-4 rounded-xl border ${selected === q.correct ? "border-[#4ade80] bg-[#4ade8011]" : "border-[#f87171] bg-[#f8717111]"}`}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              {/* Show correct/incorrect for each option */}
              {q.type !== "order_steps" && (
                <div className="flex flex-col gap-1.5 mb-2">
                  {q.options.map((opt, i) => (
                    <div key={i} className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg ${i === q.correct ? "bg-[#4ade8022] text-[#4ade80]" : i === selected && selected !== q.correct ? "bg-[#f8717122] text-[#f87171]" : "text-[#555]"}`}>
                      <span>{i === q.correct ? "✓" : i === selected && selected !== q.correct ? "✗" : "·"}</span>
                      <span>{opt}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-start gap-2">
                <span className="text-lg">{selected === q.correct ? "🎉" : "💡"}</span>
                <div>
                  <p className={`text-sm font-semibold mb-1 ${selected === q.correct ? "text-[#4ade80]" : "text-[#f87171]"}`}>
                    {selected === q.correct ? "Bonne réponse !" : selected === -1 ? "Temps écoulé !" : "Mauvaise réponse."}
                  </p>
                  <p className="text-sm text-[#ccc]">{q.explanation}</p>
                </div>
              </div>
              <button onClick={handleNext}
                className="mt-1 w-full py-3 rounded-xl bg-[#4ade8022] border border-[#4ade8055] text-[#4ade80] font-semibold text-sm hover:bg-[#4ade8033] transition-colors">
                {qIdx >= questions.length - 1 ? "Voir les résultats →" : "Question suivante →"}
              </button>
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Bottom streak */}
      {!answered && streak >= 2 && (
        <div className="flex justify-center">
          <span className="text-xs text-[#facc15]">🔥 Série de {streak} !</span>
        </div>
      )}
    </div>
  )
}
