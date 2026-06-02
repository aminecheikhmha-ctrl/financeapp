"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { useParams, useRouter } from "next/navigation"
import { getCourse, LEVEL_COLORS, getChapterXP, type Chapter } from "@/lib/courses"
import confetti from "canvas-confetti"
import { motion, AnimatePresence } from "framer-motion"

import AnimatedVisualization from "@/app/components/academy/AnimatedVisualization"
import QuizGame               from "@/app/components/academy/QuizGame"
import TradingSandbox         from "@/app/components/academy/TradingSandbox"
import InteractiveChart       from "@/app/components/academy/InteractiveChart"
import VideoPlayer            from "@/app/components/academy/VideoPlayer"
import AITutor                from "@/app/components/academy/AITutor"
import LivePractice           from "@/app/components/academy/LivePractice"

// ─── Types ────────────────────────────────────────────────────────────────────
type QuizQuestion  = { question: string; options: string[]; correct: number; explanation: string }
type ChapterContent = { content: string; quiz: QuizQuestion[] }

// ─── Levels ───────────────────────────────────────────────────────────────────
const LEVELS = [
  { min: 0,     name: "Novice",   icon: "🌱" },
  { min: 500,   name: "Apprenti", icon: "📈" },
  { min: 1500,  name: "Trader",   icon: "💹" },
  { min: 3000,  name: "Expert",   icon: "🎯" },
  { min: 6000,  name: "Master",   icon: "🏆" },
  { min: 10000, name: "Légende",  icon: "👑" },
]
function getLevelForXP(xp: number) {
  return [...LEVELS].reverse().find(l => xp >= l.min) ?? LEVELS[0]
}

// ─── Chapter type config ──────────────────────────────────────────────────────
const TYPE_ICONS: Record<string, string> = {
  video: "🎬", visualization: "🎨", interactive: "🎯",
  sandbox: "🏦", quiz: "❓", challenge: "⚡", lecture: "📖", quiz_only: "🎯",
}
const TYPE_STYLES: Record<string, { bg: string; color: string; border: string; label: string }> = {
  video:         { bg: "rgba(96,165,250,0.12)",  color: "#60a5fa", border: "rgba(96,165,250,0.25)",  label: "Vidéo"       },
  visualization: { bg: "rgba(167,139,250,0.12)", color: "#a78bfa", border: "rgba(167,139,250,0.25)", label: "Animation"   },
  interactive:   { bg: "rgba(249,115,22,0.12)",  color: "#f97316", border: "rgba(249,115,22,0.25)",  label: "Interactif"  },
  sandbox:       { bg: "rgba(74,222,128,0.12)",  color: "#4ade80", border: "rgba(74,222,128,0.25)",  label: "Simulation"  },
  quiz:          { bg: "rgba(250,204,21,0.12)",  color: "#facc15", border: "rgba(250,204,21,0.25)",  label: "Quiz"        },
  quiz_only:     { bg: "rgba(250,204,21,0.12)",  color: "#facc15", border: "rgba(250,204,21,0.25)",  label: "Quiz"        },
  challenge:     { bg: "rgba(239,68,68,0.12)",   color: "#ef4444", border: "rgba(239,68,68,0.25)",   label: "Défi"        },
  lecture:       { bg: "rgba(148,163,184,0.12)", color: "#94a3b8", border: "rgba(148,163,184,0.25)", label: "Lecture"     },
}
function getTypeStyle(t: string) {
  return TYPE_STYLES[t] ?? { bg: "rgba(255,255,255,0.06)", color: "#666", border: "rgba(255,255,255,0.1)", label: t }
}

// ─── Markdown renderer ────────────────────────────────────────────────────────
function renderMd(text: string) {
  return text.split("\n").map((line, i) => {
    if (line.startsWith("### ")) return <h3 key={i} className="text-white font-black text-base mt-5 mb-2">{line.slice(4)}</h3>
    if (line.startsWith("## "))  return <h2 key={i} className="text-white font-black text-lg mt-6 mb-2">{line.slice(3)}</h2>
    if (line.startsWith("- "))   return (
      <div key={i} className="flex gap-2 ml-3 my-1">
        <span style={{ color: "#4ade80" }}>•</span>
        <span style={{ color: "#aaa" }} dangerouslySetInnerHTML={{ __html: line.slice(2).replace(/\*\*(.*?)\*\*/g, "<strong style='color:#fff'>$1</strong>") }} />
      </div>
    )
    if (/^\d+\./.test(line)) return (
      <div key={i} className="flex gap-2 ml-3 my-1">
        <span style={{ color: "#4ade80" }}>{line.split(".")[0]}.</span>
        <span style={{ color: "#aaa" }} dangerouslySetInnerHTML={{ __html: line.split(".").slice(1).join(".").trim().replace(/\*\*(.*?)\*\*/g, "<strong style='color:#fff'>$1</strong>") }} />
      </div>
    )
    if (line.trim() === "") return <div key={i} className="h-2" />
    return <p key={i} style={{ color: "#aaa" }} dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.*?)\*\*/g, "<strong style='color:#fff'>$1</strong>") }} />
  })
}

function Skeleton({ h = "h-4", w = "w-full" }: { h?: string; w?: string }) {
  return <div className={`${h} ${w} rounded-lg animate-pulse`} style={{ background: "#151515" }} />
}

// ─── XP Toast ─────────────────────────────────────────────────────────────────
function XPToast({ xp, onDone }: { xp: number; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 2600); return () => clearTimeout(t) }, [onDone])
  return (
    <motion.div
      initial={{ scale: 0.5, opacity: 0, y: 20 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ scale: 0.8, opacity: 0, y: -30 }}
      transition={{ type: "spring", stiffness: 400, damping: 20 }}
      className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-6 py-3.5 rounded-2xl shadow-2xl"
      style={{ background: "linear-gradient(135deg,#111,#0d0d0d)", border: "1px solid rgba(74,222,128,0.4)" }}>
      <span className="text-2xl">⚡</span>
      <div>
        <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">XP Gagné</p>
        <p className="text-2xl font-black" style={{ color: "#4ade80" }}>+{xp} XP</p>
      </div>
    </motion.div>
  )
}

// ─── Challenge Block ──────────────────────────────────────────────────────────
function ChallengeBlock({ challenge, onComplete }: {
  challenge: { time_limit: number; task: string; symbol: string; type: string }
  onComplete: () => void
}) {
  const [timeLeft, setTimeLeft] = useState(challenge.time_limit)
  const [started,  setStarted]  = useState(false)
  const [done,     setDone]     = useState(false)

  useEffect(() => {
    if (!started || done) return
    if (timeLeft <= 0) { setDone(true); return }
    const t = setTimeout(() => setTimeLeft(v => v - 1), 1000)
    return () => clearTimeout(t)
  }, [started, timeLeft, done])

  const pct   = (timeLeft / challenge.time_limit) * 100
  const color = pct > 50 ? "#4ade80" : pct > 20 ? "#facc15" : "#ef4444"

  return (
    <div className="rounded-2xl p-6 space-y-4" style={{ background: "#0d0d0d", border: "1px solid rgba(239,68,68,0.3)" }}>
      <div className="flex items-center gap-3">
        <span className="text-2xl">⚡</span>
        <div className="flex-1">
          <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: "#ef4444" }}>Défi chronométré</p>
          <p className="text-white font-black text-lg leading-snug">{challenge.task}</p>
        </div>
        <p className="text-3xl font-black" style={{ color }}>{timeLeft}s</p>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: "#1a1a1a" }}>
        <motion.div className="h-full rounded-full" animate={{ width: `${pct}%` }}
          style={{ background: color }} transition={{ duration: 0.4 }} />
      </div>
      <div className="rounded-xl p-3 text-sm" style={{ background: "#111", border: "1px solid #1a1a1a" }}>
        <p style={{ color: "#aaa" }}>📊 Actif : <span className="text-white font-bold">{challenge.symbol}</span></p>
      </div>
      {!started ? (
        <button onClick={() => setStarted(true)} className="w-full py-3 rounded-xl font-black text-sm"
          style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.25)" }}>
          ⚡ Lancer le défi →
        </button>
      ) : (
        <button onClick={onComplete} className="w-full py-3 rounded-xl font-black text-sm"
          style={{ background: "rgba(74,222,128,0.12)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.25)" }}>
          ✅ J'ai terminé !
        </button>
      )}
    </div>
  )
}

// ─── Legacy Quiz ──────────────────────────────────────────────────────────────
function LegacyQuizBlock({ quiz, onComplete }: { quiz: QuizQuestion[]; onComplete: (score: number) => void }) {
  const [current,  setCurrent]  = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [answers,  setAnswers]  = useState<(number | null)[]>(quiz.map(() => null))
  const [finished, setFinished] = useState(false)
  const q = quiz[current], isLast = current === quiz.length - 1
  const score = answers.filter((a, i) => a === quiz[i].correct).length

  function handleSelect(idx: number) {
    if (selected !== null) return
    setSelected(idx)
    const na = [...answers]; na[current] = idx; setAnswers(na)
  }
  function handleNext() {
    if (isLast) { setFinished(true); onComplete(Math.round((score + (selected === q.correct ? 1 : 0)) / quiz.length * 100)) }
    else { setCurrent(c => c + 1); setSelected(null) }
  }
  if (finished) {
    const stars = score >= quiz.length * 0.75 ? 3 : score >= quiz.length * 0.5 ? 2 : 1
    return (
      <div className="rounded-2xl p-6 text-center" style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>
        <p className="text-3xl mb-2">{"⭐".repeat(stars)}{"☆".repeat(3 - stars)}</p>
        <p className="text-white font-black text-xl mb-4">{score}/{quiz.length} correctes</p>
        <div className="space-y-2 text-left">{quiz.map((q, i) => {
          const correct = answers[i] === q.correct
          return (
            <div key={i} className="rounded-xl p-3"
              style={{ background: correct ? "rgba(74,222,128,0.06)" : "rgba(248,113,113,0.06)", border: `1px solid ${correct ? "rgba(74,222,128,0.15)" : "rgba(248,113,113,0.12)"}` }}>
              <p className="text-xs font-bold mb-1" style={{ color: correct ? "#4ade80" : "#f87171" }}>{correct ? "✓" : "✗"} {q.question}</p>
              <p className="text-[11px]" style={{ color: "#888" }}>{q.explanation}</p>
            </div>
          )
        })}</div>
      </div>
    )
  }
  return (
    <div className="rounded-2xl p-5" style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>
      <div className="flex items-center justify-between mb-4">
        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#555" }}>Quiz · {current + 1}/{quiz.length}</p>
        <div className="flex gap-1">{quiz.map((_, i) => <div key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: i < current ? "#4ade80" : i === current ? "#60a5fa" : "#222" }} />)}</div>
      </div>
      <p className="text-white font-bold mb-4 text-sm leading-relaxed">{q.question}</p>
      <div className="space-y-2 mb-4">{q.options.map((opt, idx) => {
        let bg = "#111", border = "#1a1a1a", color = "#aaa"
        if (selected !== null) {
          if (idx === q.correct) { bg = "rgba(74,222,128,0.1)"; border = "rgba(74,222,128,0.3)"; color = "#4ade80" }
          else if (idx === selected) { bg = "rgba(248,113,113,0.1)"; border = "rgba(248,113,113,0.3)"; color = "#f87171" }
        }
        return (
          <button key={idx} onClick={() => handleSelect(idx)}
            className="w-full text-left px-4 py-3 rounded-xl text-sm transition-all"
            style={{ background: bg, border: `1px solid ${border}`, color }}>
            <span className="font-bold mr-2">{String.fromCharCode(65 + idx)}.</span>{opt}
          </button>
        )
      })}</div>
      {selected !== null && <p className="text-sm mb-4 px-3 py-2 rounded-lg" style={{ background: "#111", color: "#aaa" }}>{q.explanation}</p>}
      {selected !== null && <button onClick={handleNext} className="w-full py-2.5 rounded-xl text-sm font-black" style={{ background: "#4ade8015", color: "#4ade80", border: "1px solid rgba(74,222,128,0.2)" }}>{isLast ? "Terminer →" : "Suivant →"}</button>}
    </div>
  )
}

// ─── Course Complete ──────────────────────────────────────────────────────────
function CourseComplete({ course, progress, totalXP, timeSpent, onContinue }: {
  course: any; progress: Set<number>; totalXP: number; timeSpent: number; onContinue: () => void
}) {
  useEffect(() => {
    confetti({ particleCount: 200, spread: 90, origin: { y: 0.4 }, colors: ["#4ade80","#22c55e","#60a5fa","#a78bfa","#facc15"] })
    setTimeout(() => confetti({ particleCount: 100, angle: 60,  spread: 70, origin: { x: 0, y: 0.5 } }), 600)
    setTimeout(() => confetti({ particleCount: 100, angle: 120, spread: 70, origin: { x: 1, y: 0.5 } }), 1000)
  }, [])
  const hours = Math.floor(timeSpent / 3600)
  const mins  = Math.floor((timeSpent % 3600) / 60)
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.88)", backdropFilter: "blur(10px)" }}>
      <div className="max-w-md w-full rounded-3xl p-8 text-center space-y-6"
        style={{ background: "#0a0a0a", border: "1px solid rgba(74,222,128,0.3)" }}>
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.2 }}
          className="text-7xl">🏆</motion.div>
        <div>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
            className="text-2xl font-black text-white mb-1">Cours Complété !</motion.p>
          <p className="font-bold" style={{ color: "#4ade80" }}>{course.title}</p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Chapitres", value: `${progress.size}/${course.chapters.length}`, color: "#60a5fa" },
            { label: "XP Gagnés", value: `⚡ ${totalXP}`, color: "#facc15" },
            { label: "Temps",     value: hours > 0 ? `${hours}h${mins}m` : `${mins}min`, color: "#a78bfa" },
          ].map(s => (
            <div key={s.label} className="rounded-xl p-3" style={{ background: "#111", border: "1px solid #1a1a1a" }}>
              <p className="text-[9px] uppercase tracking-widest font-bold mb-1" style={{ color: "#444" }}>{s.label}</p>
              <p className="font-black text-lg" style={{ color: s.color }}>{s.value}</p>
            </div>
          ))}
        </div>
        <a href={`/apprendre/${course.id}/certificate`}
          className="w-full py-3.5 rounded-xl font-black text-sm transition-all text-center block"
          style={{ background: "rgba(250,204,21,0.12)", color: "#facc15", border: "1px solid rgba(250,204,21,0.3)" }}>
          🏆 Télécharger mon certificat
        </a>
        <button onClick={onContinue}
          className="w-full py-3.5 rounded-xl font-black text-sm transition-all"
          style={{ background: "rgba(74,222,128,0.12)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.25)" }}>
          ← Retour à l'Académie
        </button>
      </div>
    </motion.div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function CoursePage() {
  const { id }  = useParams()
  const router  = useRouter()
  const course  = getCourse(id as string)

  const [user,           setUser]           = useState<any>(null)
  const [token,          setToken]          = useState<string | null>(null)
  const [activeIdx,      setActiveIdx]      = useState(0)
  const [chapterContent, setChapterContent] = useState<ChapterContent | null>(null)
  const [loadingContent, setLoadingContent] = useState(false)
  const [progress,       setProgress]       = useState<Set<number>>(new Set())
  const [quizDone,       setQuizDone]       = useState<Set<number>>(new Set())
  const [startTime,      setStartTime]      = useState(Date.now())
  const [courseStartTime]                   = useState(Date.now())
  const [xpToast,        setXpToast]        = useState<number | null>(null)
  const [levelUpToast,   setLevelUpToast]   = useState<{ name: string; icon: string } | null>(null)
  const [totalXP,        setTotalXP]        = useState(0)
  const [lessonMode,     setLessonMode]     = useState<string | null>(null)
  const [showComplete,   setShowComplete]   = useState(false)
  const [tutorOpen,      setTutorOpen]      = useState(false)
  const [saving,         setSaving]         = useState(false)

  const lc = course ? LEVEL_COLORS[course.level] : LEVEL_COLORS["débutant"]

  useEffect(() => {
    if (typeof window !== "undefined") {
      const lesson = new URLSearchParams(window.location.search).get("lesson")
      if (lesson) setLessonMode(lesson)
    }
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.push("/login"); return }
      setUser(session.user)
      setToken(session.access_token)
      if (course) {
        await fetchProgress(session.user.id)
        const { data: xpData } = await supabase
          .from("user_progress").select("xp_earned").eq("user_id", session.user.id)
        if (xpData) setTotalXP(xpData.reduce((s: number, r: any) => s + (r.xp_earned ?? 0), 0))
      }
    })
  }, [])

  async function fetchProgress(userId: string) {
    if (!course) return
    const { data } = await supabase
      .from("user_progress").select("chapter_id")
      .eq("user_id", userId).eq("course_id", course.id).eq("completed", true)
    if (data) setProgress(new Set(data.map((r: any) => r.chapter_id)))
  }

  const loadChapterContent = useCallback(async (chapterId: number) => {
    if (!course) return
    const ch = course.chapters.find(c => c.id === chapterId)
    if (ch && (ch.type === "video" || ch.type === "lecture")) {
      setChapterContent(null)
      setLoadingContent(true)
      setStartTime(Date.now())
      try {
        const res  = await fetch(`/api/course-content?course_id=${course.id}&chapter_id=${chapterId}`)
        const data = await res.json()
        setChapterContent(data)
      } catch {}
      setLoadingContent(false)
    } else {
      setChapterContent(null)
      setLoadingContent(false)
      setStartTime(Date.now())
    }
  }, [course])

  useEffect(() => {
    if (course) loadChapterContent(course.chapters[activeIdx]?.id)
  }, [activeIdx, course])

  async function markComplete(chapterId: number, quizScore?: number, xpOverride?: number) {
    if (!course) return
    const newProgress = new Set(progress)
    if (newProgress.has(chapterId)) return
    newProgress.add(chapterId)
    const chapter    = course.chapters.find(c => c.id === chapterId)
    const xpEarned   = xpOverride ?? getChapterXP(chapter!)
    const newTotalXP = totalXP + xpEarned

    setProgress(newProgress)
    setTotalXP(newTotalXP)
    setXpToast(xpEarned)
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("xp-updated", { detail: { xp: newTotalXP } }))
    }

    if (token) {
      setSaving(true)
      const timeSpent = Math.round((Date.now() - startTime) / 1000)
      try {
        const res  = await fetch("/api/course-content", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ course_id: course.id, chapter_id: chapterId, quiz_score: quizScore ?? null, time_spent: timeSpent, xp_earned: xpEarned }),
        })
        const data = await res.json()
        if (data.leveled_up && data.new_level) {
          setLevelUpToast({ name: data.new_level, icon: data.level_icon ?? "🏆" })
          setTimeout(() => setLevelUpToast(null), 4000)
        }
        if (data.new_xp != null) {
          setTotalXP(data.new_xp)
          if (typeof window !== "undefined")
            window.dispatchEvent(new CustomEvent("xp-updated", { detail: { xp: data.new_xp } }))
        }
      } catch {}
      setSaving(false)
    }

    if (newProgress.size === course.chapters.length) {
      setTimeout(() => setShowComplete(true), 800)
    }
  }

  async function handleQuizComplete(score: number, chapterId: number) {
    setQuizDone(prev => new Set([...prev, chapterId]))
    await markComplete(chapterId, score)
  }

  if (!course) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-canvas)" }}>
      <p style={{ color: "#555" }}>Cours introuvable.</p>
    </div>
  )

  const activeChapter = course.chapters[activeIdx]
  const donePct       = Math.round((progress.size / course.chapters.length) * 100)
  const isChapterDone = progress.has(activeChapter.id)
  const ts            = getTypeStyle(activeChapter.type)
  const canProceed    = isChapterDone

  function navigate(dir: 1 | -1) {
    const next = activeIdx + dir
    if (next < 0 || next >= course!.chapters.length) return
    setActiveIdx(next)
  }

  async function completeAndNavigate() {
    const ch = course!.chapters[activeIdx]
    if (!progress.has(ch.id)) await markComplete(ch.id)
    navigate(1)
  }

  return (
    <div className="min-h-screen text-white flex flex-col" style={{ background: "var(--bg-canvas)" }}>

      {/* ── Toasts ─────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {xpToast !== null && <XPToast xp={xpToast} onDone={() => setXpToast(null)} />}
      </AnimatePresence>
      <AnimatePresence>
        {levelUpToast && (
          <motion.div
            initial={{ scale: 0.5, opacity: 0, y: 40 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: -20 }}
            transition={{ type: "spring", stiffness: 350, damping: 18 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl"
            style={{ background: "linear-gradient(135deg,#1a0a2e,#0d1a1a)", border: "1px solid rgba(167,139,250,0.5)" }}>
            <span className="text-3xl">{levelUpToast.icon}</span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#a78bfa" }}>Level Up !</p>
              <p className="text-xl font-black text-white">Tu es maintenant {levelUpToast.name}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {showComplete && (
        <CourseComplete course={course} progress={progress} totalXP={totalXP}
          timeSpent={Math.round((Date.now() - courseStartTime) / 1000)}
          onContinue={() => router.push("/apprendre")} />
      )}

      {/* ── Mobile AI Tutor ─────────────────────────────────────────────────── */}
      <motion.button
        whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}
        onClick={() => setTutorOpen(true)}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full flex items-center justify-center shadow-2xl xl:hidden"
        style={{ background: "linear-gradient(135deg,#1a1a2e,#0d1a1a)", border: "1px solid rgba(167,139,250,0.4)" }}>
        <span className="text-2xl">🧠</span>
      </motion.button>

      <AnimatePresence>
        {tutorOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 xl:hidden"
            style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(4px)" }}
            onClick={() => setTutorOpen(false)}>
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30 }}
              className="absolute bottom-0 left-0 right-0 rounded-t-3xl overflow-hidden"
              style={{ height: "75vh", background: "#0d0d0d", border: "1px solid #1a1a1a" }}
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "#1a1a1a" }}>
                <p className="font-black text-white">🧠 Tuteur IA</p>
                <button onClick={() => setTutorOpen(false)} className="text-white/30 hover:text-white text-xl">✕</button>
              </div>
              <div className="h-[calc(75vh-52px)]">
                <AITutor courseTitle={course.title} chapterTitle={activeChapter.title}
                  courseId={course.id} chapterId={activeChapter.id} keyConcepts={activeChapter.key_concepts} />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── HEADER ──────────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 border-b" style={{ borderColor: "#111", background: "rgba(8,8,8,0.97)", backdropFilter: "blur(12px)" }}>
        <div className="max-w-[1440px] mx-auto px-4 py-3 flex items-center gap-3 flex-wrap">
          <button onClick={() => router.push("/apprendre")}
            className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-all hover:text-white"
            style={{ color: "#555", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
            ← Académie
          </button>
          <div className="h-4 w-px hidden sm:block" style={{ background: "#222" }} />
          <span className="text-xl">{course.icon}</span>
          <h1 className="text-white font-black text-sm md:text-base truncate max-w-[200px] md:max-w-xs">{course.title}</h1>
          <span className="text-[10px] font-black px-2 py-0.5 rounded-full hidden sm:inline"
            style={{ background: lc.bg, color: lc.text, border: `1px solid ${lc.border}` }}>
            {course.level}
          </span>

          {/* Progress */}
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-[11px] hidden sm:inline" style={{ color: "#444" }}>
              {progress.size}/{course.chapters.length} chapitres
            </span>
            <div className="w-24 h-1.5 rounded-full overflow-hidden hidden sm:block" style={{ background: "#1a1a1a" }}>
              <motion.div className="h-full rounded-full" animate={{ width: `${donePct}%` }}
                transition={{ duration: 0.6 }} style={{ background: `linear-gradient(90deg,${lc.text}88,${lc.text})` }} />
            </div>
            <span className="text-xs font-black" style={{ color: lc.text }}>{donePct}%</span>
          </div>

          {/* XP */}
          <motion.div key={totalXP} animate={{ scale: [1, 1.12, 1] }} transition={{ duration: 0.3 }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
            style={{ background: "#111", border: "1px solid #1a1a1a" }}>
            <span className="text-sm">⚡</span>
            <span className="text-sm font-black" style={{ color: "#facc15" }}>{totalXP.toLocaleString()}</span>
          </motion.div>
        </div>

        {/* Progress bar under header — full width */}
        <div className="h-0.5 w-full" style={{ background: "#111" }}>
          <motion.div className="h-full" animate={{ width: `${donePct}%` }} transition={{ duration: 0.6 }}
            style={{ background: `linear-gradient(90deg,${lc.text}60,${lc.text})` }} />
        </div>
      </div>

      {/* ── 3-COLUMN LAYOUT ─────────────────────────────────────────────────── */}
      <div className="flex flex-1 max-w-[1440px] mx-auto w-full px-4 gap-5 py-5">

        {/* ── LEFT SIDEBAR ────────────────────────────────────────────────── */}
        <div className="w-[280px] flex-shrink-0 sticky top-5 self-start hidden lg:block"
          style={{ maxHeight: "calc(100vh - 80px)" }}>
          <div className="rounded-2xl overflow-hidden h-full flex flex-col"
            style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>

            {/* Mini progress card */}
            <div className="px-4 py-4 border-b flex-shrink-0" style={{ borderColor: "#111" }}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: "#444" }}>Progression</p>
                <p className="text-xs font-black" style={{ color: lc.text }}>{donePct}%</p>
              </div>
              <div className="h-2 rounded-full overflow-hidden mb-2" style={{ background: "#111" }}>
                <motion.div className="h-full rounded-full" animate={{ width: `${donePct}%` }}
                  transition={{ duration: 0.6 }} style={{ background: `linear-gradient(90deg,${lc.text}80,${lc.text})` }} />
              </div>
              <p className="text-[10px]" style={{ color: "#333" }}>{progress.size}/{course.chapters.length} chapitres complétés</p>
            </div>

            {/* Certificate button when course is 100% done */}
            {donePct === 100 && (
              <div className="px-3 py-3 border-b flex-shrink-0" style={{ borderColor: "#111" }}>
                <a href={`/apprendre/${course.id}/certificate`}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black transition-all text-center"
                  style={{ background: "rgba(250,204,21,0.1)", color: "#facc15", border: "1px solid rgba(250,204,21,0.25)" }}>
                  🏆 Mon certificat
                </a>
              </div>
            )}

            {/* Chapter list */}
            <div className="overflow-y-auto flex-1" style={{ scrollbarWidth: "thin" }}>
              {course.chapters.map((ch, idx) => {
                const done   = progress.has(ch.id)
                const active = idx === activeIdx
                const ts     = getTypeStyle(ch.type)
                return (
                  <button key={ch.id} onClick={() => setActiveIdx(idx)}
                    className="w-full text-left px-3 py-3 transition-all flex items-center gap-3 border-b"
                    style={{
                      borderColor: "#0a0a0a",
                      background: active ? "rgba(255,255,255,0.05)" : "transparent",
                      borderLeft: active ? `2px solid ${lc.text}` : "2px solid transparent",
                    }}>
                    {/* Icon */}
                    <div className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center text-sm transition-all"
                      style={{
                        background: done ? "#22c55e" : active ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.04)",
                        color: done ? "white" : active ? "white" : "#444",
                        border: done ? "none" : `1px solid ${active ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.06)"}`,
                      }}>
                      {done ? "✓" : TYPE_ICONS[ch.type] ?? ch.id}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-semibold truncate ${active ? "text-white" : done ? "text-white/50" : "text-white/30"}`}>
                        {ch.title}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[9px]" style={{ color: "#333" }}>{ch.duration}</span>
                        <span className="text-[9px] font-bold" style={{ color: done ? "#4ade80" : "rgba(250,204,21,0.4)" }}>
                          ⚡+{ch.xp_reward ?? getChapterXP(ch)}
                        </span>
                      </div>
                    </div>
                    {active && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse flex-shrink-0" />}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* ── CENTER CONTENT ──────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 flex flex-col">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeIdx}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="flex-1 space-y-4">

              {/* Chapter header card */}
              <div className="rounded-2xl p-5" style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>
                {/* Type badge + meta */}
                <div className="flex items-center gap-2 mb-4 flex-wrap">
                  <motion.span
                    initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                    className="px-3 py-1 rounded-xl text-xs font-black uppercase tracking-widest"
                    style={{ background: ts.bg, color: ts.color, border: `1px solid ${ts.border}` }}>
                    {TYPE_ICONS[activeChapter.type] ?? "📄"} {ts.label}
                  </motion.span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full"
                    style={{ background: "rgba(255,255,255,0.04)", color: "#444", border: "1px solid rgba(255,255,255,0.06)" }}>
                    {activeIdx + 1}/{course.chapters.length}
                  </span>
                  <span className="text-[10px]" style={{ color: "#444" }}>⏱ {activeChapter.duration}</span>
                  <span className="ml-auto text-sm font-black" style={{ color: "#facc15" }}>
                    ⚡ +{activeChapter.xp_reward ?? getChapterXP(activeChapter)} XP
                  </span>
                  {isChapterDone && (
                    <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 500 }}
                      className="text-xs font-bold px-3 py-1 rounded-xl"
                      style={{ background: "rgba(74,222,128,0.1)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.2)" }}>
                      ✅ Complété
                    </motion.span>
                  )}
                </div>

                <h2 className="text-xl md:text-2xl font-black text-white mb-4 leading-tight">{activeChapter.title}</h2>

                {/* Video player */}
                {activeChapter.video_url && (
                  <VideoPlayer url={activeChapter.video_url} title={activeChapter.title}
                    courseId={course.id} chapterId={activeChapter.id}
                    onWatched={() => !isChapterDone && markComplete(activeChapter.id)} />
                )}

                {/* Text content */}
                {(activeChapter.type === "video" || activeChapter.type === "lecture") && !activeChapter.video_url && (
                  <div className="text-sm leading-relaxed space-y-1">
                    {loadingContent ? (
                      <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} h="h-4" w={i % 2 === 0 ? "w-full" : "w-4/5"} />)}</div>
                    ) : chapterContent?.content ? renderMd(chapterContent.content) : null}
                  </div>
                )}
              </div>

              {/* ── Type-specific content ──────────────────────────────────── */}

              {activeChapter.type === "visualization" && activeChapter.visualization && (
                <div className="rounded-2xl overflow-hidden">
                  <AnimatedVisualization type={activeChapter.visualization.type}
                    onComplete={() => !isChapterDone && markComplete(activeChapter.id)} />
                </div>
              )}

              {activeChapter.type === "sandbox" && (
                <TradingSandbox
                  scenarioId={activeChapter.sandbox_config?.scenario_id}
                  live={activeChapter.sandbox_config?.live}
                  symbol={activeChapter.sandbox_config?.symbol ?? "AAPL"}
                  context={activeChapter.sandbox_config?.context}
                  question={activeChapter.sandbox_config?.question}
                  onComplete={({ xp }) => { if (!isChapterDone) markComplete(activeChapter.id, undefined, xp) }}
                />
              )}

              {activeChapter.type === "interactive" && activeChapter.interactive_config && (
                <InteractiveChart
                  lessonMode={activeChapter.interactive_config.lesson_mode as any}
                  symbol={activeChapter.interactive_config.symbol ?? "AAPL"}
                  instruction={activeChapter.interactive_config.instruction}
                  hint={activeChapter.interactive_config.hint}
                  onCorrect={(xp) => !isChapterDone && markComplete(activeChapter.id, undefined, xp)}
                  onComplete={() => {}}
                />
              )}

              {activeChapter.type === "quiz" && activeChapter.quiz && !quizDone.has(activeChapter.id) && (
                <QuizGame questions={activeChapter.quiz as any} title={activeChapter.title}
                  onComplete={({ score, xp }) => handleQuizComplete(score, activeChapter.id)} />
              )}
              {activeChapter.type === "quiz" && quizDone.has(activeChapter.id) && (
                <div className="rounded-2xl p-6 text-center"
                  style={{ background: "rgba(74,222,128,0.05)", border: "1px solid rgba(74,222,128,0.2)" }}>
                  <p className="text-3xl mb-2">🎉</p>
                  <p className="text-white font-black text-lg">Quiz complété !</p>
                  <p className="text-white/40 text-sm mt-1">Passe au chapitre suivant</p>
                </div>
              )}

              {activeChapter.type === "challenge" && activeChapter.challenge && (
                isChapterDone ? (
                  <div className="rounded-2xl p-6 text-center"
                    style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.2)" }}>
                    <p className="text-3xl mb-2">⚡</p>
                    <p className="text-white font-black text-lg">Défi relevé !</p>
                  </div>
                ) : (
                  <ChallengeBlock challenge={activeChapter.challenge}
                    onComplete={() => markComplete(activeChapter.id)} />
                )
              )}

              {activeChapter.type === "quiz_only" && (
                chapterContent?.quiz?.length ? (
                  quizDone.has(activeChapter.id) ? (
                    <div className="rounded-2xl p-6 text-center"
                      style={{ background: "rgba(74,222,128,0.05)", border: "1px solid rgba(74,222,128,0.2)" }}>
                      <p className="text-3xl mb-2">✅</p><p className="text-white font-black">Quiz complété</p>
                    </div>
                  ) : (
                    <LegacyQuizBlock quiz={chapterContent.quiz}
                      onComplete={score => handleQuizComplete(score, activeChapter.id)} />
                  )
                ) : loadingContent ? (
                  <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} h="h-12" />)}</div>
                ) : null
              )}

              {/* Key concepts */}
              {activeChapter.key_concepts?.length > 0 && !loadingContent && (
                <div className="rounded-xl p-4" style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>
                  <p className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: "#444" }}>🔑 Concepts clés</p>
                  <div className="flex flex-wrap gap-2">
                    {activeChapter.key_concepts.map(kc => (
                      <span key={kc} className="text-[11px] font-semibold px-3 py-1 rounded-full"
                        style={{ background: `${lc.text}10`, color: lc.text, border: `1px solid ${lc.border}` }}>
                        {kc}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Legacy quiz for video/lecture */}
              {(activeChapter.type === "video" || activeChapter.type === "lecture") && chapterContent?.quiz?.length ? (
                <div>
                  <p className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: "#444" }}>🎯 Quiz du chapitre</p>
                  {quizDone.has(activeChapter.id) ? (
                    <div className="rounded-xl p-4 text-center"
                      style={{ background: "rgba(74,222,128,0.06)", border: "1px solid rgba(74,222,128,0.15)" }}>
                      <p className="text-green-400 font-bold">✓ Quiz déjà complété</p>
                    </div>
                  ) : (
                    <LegacyQuizBlock quiz={chapterContent.quiz}
                      onComplete={score => handleQuizComplete(score, activeChapter.id)} />
                  )}
                </div>
              ) : null}

              {/* Real chart button */}
              {!lessonMode && (activeChapter.type === "visualization" || activeChapter.type === "interactive") && (
                <button
                  onClick={() => router.push(`/dashboard?symbol=AAPL&lesson=${activeChapter.interactive_config?.lesson_mode ?? activeChapter.visualization?.type ?? "general"}`)}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all hover:opacity-80"
                  style={{ background: "#0d1117", color: "#60a5fa", border: "1px solid rgba(96,165,250,0.2)" }}>
                  📈 Voir cet indicateur sur un vrai graphe AAPL →
                </button>
              )}

              {/* ── STICKY FOOTER NAV ──────────────────────────────────────── */}
              <div className="sticky bottom-0 flex items-center justify-between px-2 py-4 -mx-2 border-t"
                style={{ borderColor: "rgba(255,255,255,0.05)", background: "rgba(8,8,8,0.97)", backdropFilter: "blur(12px)" }}>

                {/* Prev */}
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={() => navigate(-1)} disabled={activeIdx === 0}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-20"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#666" }}>
                  ← Précédent
                </motion.button>

                {/* Center dots */}
                <div className="flex items-center gap-1.5 flex-1 justify-center mx-4 overflow-hidden">
                  {course.chapters.map((c, i) => (
                    <motion.button key={i}
                      onClick={() => setActiveIdx(i)}
                      animate={{ scale: i === activeIdx ? 1.3 : 1 }}
                      className="rounded-full transition-all flex-shrink-0"
                      style={{
                        width: i === activeIdx ? 24 : 6,
                        height: 6,
                        background: progress.has(c.id) ? "#22c55e" : i === activeIdx ? lc.text : "rgba(255,255,255,0.1)",
                      }}
                    />
                  ))}
                </div>

                {/* Mark complete for text chapters */}
                {!isChapterDone && !loadingContent &&
                  (activeChapter.type === "video" || activeChapter.type === "lecture") &&
                  !activeChapter.video_url && !chapterContent?.quiz?.length && (
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    onClick={() => markComplete(activeChapter.id)}
                    className="px-4 py-2.5 rounded-xl text-sm font-black"
                    style={{ background: "rgba(74,222,128,0.12)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.2)" }}>
                    ✓ J'ai compris
                  </motion.button>
                )}

                {/* Continuer for video without URL */}
                {(activeChapter.type === "video" || activeChapter.type === "lecture") &&
                  activeIdx < course.chapters.length - 1 && !activeChapter.video_url && (
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    onClick={completeAndNavigate}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black"
                    style={{ background: `${lc.text}18`, border: `1px solid ${lc.border}`, color: lc.text }}>
                    {saving && <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />}
                    Continuer →
                  </motion.button>
                )}

                {/* Next for non-video chapters */}
                {activeChapter.type !== "video" && activeChapter.type !== "lecture" && (
                  <motion.button
                    whileHover={{ scale: canProceed ? 1.02 : 1 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => navigate(1)}
                    disabled={activeIdx === course.chapters.length - 1}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black transition-all disabled:opacity-20"
                    style={{
                      background: canProceed ? "#22c55e" : `${lc.text}15`,
                      color: canProceed ? "black" : lc.text,
                      border: `1px solid ${canProceed ? "#22c55e" : lc.border}`,
                    }}>
                    {saving && <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />}
                    Suivant {canProceed && activeChapter.xp_reward ? `(+${activeChapter.xp_reward} XP)` : ""} →
                  </motion.button>
                )}
              </div>

            </motion.div>
          </AnimatePresence>
        </div>

        {/* ── RIGHT AI TUTOR ──────────────────────────────────────────────── */}
        <div className="w-[300px] flex-shrink-0 sticky top-5 self-start hidden xl:flex flex-col"
          style={{ height: "calc(100vh - 100px)" }}>
          <AITutor
            courseTitle={course.title}
            chapterTitle={activeChapter.title}
            courseId={course.id}
            chapterId={activeChapter.id}
            keyConcepts={activeChapter.key_concepts}
          />
        </div>

      </div>
    </div>
  )
}
