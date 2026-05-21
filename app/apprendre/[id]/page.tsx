"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { useParams, useRouter } from "next/navigation"
import { getCourse, LEVEL_COLORS, getChapterXP, type Chapter } from "@/lib/courses"
import confetti from "canvas-confetti"
import { motion, AnimatePresence } from "framer-motion"

// ── Academy components ────────────────────────────────────────────────────────
import AnimatedVisualization from "@/app/components/academy/AnimatedVisualization"
import QuizGame               from "@/app/components/academy/QuizGame"
import TradingSandbox         from "@/app/components/academy/TradingSandbox"
import InteractiveChart       from "@/app/components/academy/InteractiveChart"
import LivePractice           from "@/app/components/academy/LivePractice"

// ─── Legacy types (kept for course-content API compat) ────────────────────────
type QuizQuestion = { question: string; options: string[]; correct: number; explanation: string }
type ChapterContent = { content: string; quiz: QuizQuestion[] }
type ChatMessage = { role: "user" | "assistant"; content: string }

// ─── Markdown renderer ────────────────────────────────────────────────────────
function renderMd(text: string) {
  return text.split("\n").map((line, i) => {
    if (line.startsWith("### ")) return <h3 key={i} className="text-white font-black text-base mt-5 mb-2">{line.slice(4)}</h3>
    if (line.startsWith("## "))  return <h2 key={i} className="text-white font-black text-lg mt-6 mb-2">{line.slice(3)}</h2>
    if (line.startsWith("- ")) return (
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

// ─── Helpers ──────────────────────────────────────────────────────────────────
function Skeleton({ h = "h-4", w = "w-full" }: { h?: string; w?: string }) {
  return <div className={`${h} ${w} rounded-lg animate-pulse`} style={{ background: "#151515" }} />
}

function chapterTypeLabel(type: string) {
  switch (type) {
    case "video":         return { icon: "📹", label: "Vidéo",         color: "#60a5fa" }
    case "lecture":       return { icon: "📖", label: "Lecture",       color: "#94a3b8" }
    case "interactive":   return { icon: "🎮", label: "Interactif",    color: "#a78bfa" }
    case "quiz_only":
    case "quiz":          return { icon: "🎯", label: "Quiz",          color: "#facc15" }
    case "visualization": return { icon: "✨", label: "Animation",     color: "#f97316" }
    case "sandbox":       return { icon: "🏦", label: "Simulation",    color: "#4ade80" }
    case "challenge":     return { icon: "⚡", label: "Défi",          color: "#ef4444" }
    default:              return { icon: "📄", label: type,            color: "#666" }
  }
}

// ─── XP Toast ─────────────────────────────────────────────────────────────────
function XPToast({ xp, onDone }: { xp: number; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 2800); return () => clearTimeout(t) }, [onDone])
  return (
    <motion.div
      initial={{ scale: 0.5, opacity: 0, y: 20 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ scale: 0.8, opacity: 0, y: -30 }}
      transition={{ type: "spring", stiffness: 400, damping: 20 }}
      className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-6 py-3.5 rounded-2xl shadow-2xl"
      style={{ background: "linear-gradient(135deg,#1a1a1a,#111)", border: "1px solid rgba(74,222,128,0.4)" }}
    >
      <span className="text-2xl">⚡</span>
      <div>
        <p className="text-xs text-gray-400 font-semibold uppercase tracking-widest">XP Gagné</p>
        <p className="text-2xl font-black" style={{ color: "#4ade80" }}>+{xp} XP</p>
      </div>
    </motion.div>
  )
}

// ─── Video Player ─────────────────────────────────────────────────────────────
function VideoPlayer({ url, title }: { url: string; title: string }) {
  const [playing, setPlaying] = useState(false)
  const videoId = url.split("/embed/")[1]?.split("?")[0]
  const thumb = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
  if (playing) return (
    <div className="relative w-full rounded-xl overflow-hidden mb-6" style={{ paddingBottom: "56.25%" }}>
      <iframe src={`${url}?autoplay=1&rel=0`} className="absolute inset-0 w-full h-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
    </div>
  )
  return (
    <div onClick={() => setPlaying(true)} className="relative w-full rounded-xl overflow-hidden mb-6 cursor-pointer group" style={{ paddingBottom: "56.25%", background: "#000" }}>
      <img src={thumb} alt={title} className="absolute inset-0 w-full h-full object-cover opacity-70 group-hover:opacity-90 transition" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-16 h-16 rounded-full flex items-center justify-center transition-transform group-hover:scale-110" style={{ background: "rgba(239,68,68,0.9)" }}>
          <svg viewBox="0 0 24 24" fill="white" className="w-7 h-7 ml-1"><path d="M8 5v14l11-7z" /></svg>
        </div>
      </div>
    </div>
  )
}

// ─── Legacy Quiz Block (for course-content API quizzes) ───────────────────────
function LegacyQuizBlock({ quiz, onComplete }: { quiz: QuizQuestion[]; onComplete: (score: number) => void }) {
  const [current, setCurrent] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [answers, setAnswers] = useState<(number | null)[]>(quiz.map(() => null))
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
  const stars = finished ? (score >= quiz.length * 0.75 ? 3 : score >= quiz.length * 0.5 ? 2 : 1) : 0
  if (finished) return (
    <div className="rounded-2xl p-6 text-center" style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>
      <p className="text-3xl mb-2">{"⭐".repeat(stars)}{"☆".repeat(3 - stars)}</p>
      <p className="text-white font-black text-xl mb-1">{score}/{quiz.length} correctes</p>
      <p className="text-sm mb-5" style={{ color: "#666" }}>{score === quiz.length ? "Parfait !" : score >= quiz.length * 0.75 ? "Très bien !" : "Continue à pratiquer !"}</p>
      <div className="space-y-3 text-left">{quiz.map((q, i) => {
        const correct = answers[i] === q.correct
        return (<div key={i} className="rounded-xl p-3" style={{ background: correct ? "rgba(74,222,128,0.06)" : "rgba(248,113,113,0.06)", border: `1px solid ${correct ? "rgba(74,222,128,0.15)" : "rgba(248,113,113,0.15)"}` }}>
          <p className="text-xs font-bold mb-1" style={{ color: correct ? "#4ade80" : "#f87171" }}>{correct ? "✓" : "✗"} {q.question}</p>
          <p className="text-[11px]" style={{ color: "#888" }}>{q.explanation}</p>
        </div>)
      })}</div>
    </div>
  )
  return (
    <div className="rounded-2xl p-6" style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "#555" }}>Quiz · {current + 1}/{quiz.length}</p>
        <div className="flex gap-1">{quiz.map((_, i) => <div key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: i < current ? "#4ade80" : i === current ? "#60a5fa" : "#222" }} />)}</div>
      </div>
      <p className="text-white font-bold mb-4 text-sm leading-relaxed">{q.question}</p>
      <div className="space-y-2 mb-4">{q.options.map((opt, idx) => {
        let bg = "#111", border = "#1a1a1a", color = "#aaa"
        if (selected !== null) {
          if (idx === q.correct) { bg = "rgba(74,222,128,0.12)"; border = "rgba(74,222,128,0.3)"; color = "#4ade80" }
          else if (idx === selected) { bg = "rgba(248,113,113,0.12)"; border = "rgba(248,113,113,0.3)"; color = "#f87171" }
        }
        return (<button key={idx} onClick={() => handleSelect(idx)} className="w-full text-left px-4 py-3 rounded-xl text-sm transition-all" style={{ background: bg, border: `1px solid ${border}`, color }}>
          <span className="font-bold mr-2">{String.fromCharCode(65 + idx)}.</span>{opt}
        </button>)
      })}</div>
      {selected !== null && <p className="text-sm mb-4 px-3 py-2 rounded-lg" style={{ background: "#111", color: "#aaa" }}>{q.explanation}</p>}
      {selected !== null && <button onClick={handleNext} className="w-full py-2.5 rounded-xl text-sm font-black" style={{ background: "#4ade8018", color: "#4ade80", border: "1px solid rgba(74,222,128,0.2)" }}>{isLast ? "Terminer →" : "Suivant →"}</button>}
    </div>
  )
}

// ─── AI Tutor ─────────────────────────────────────────────────────────────────
function AiTutor({ courseTitle, chapterTitle }: { courseTitle: string; chapterTitle: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const QUICK = ["Explique-moi ce concept simplement", "Donne un exemple concret", "Comment l'appliquer en trading réel ?", "Quelles sont les erreurs courantes ?"]

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return
    const userMsg: ChatMessage = { role: "user", content: text }
    setMessages(prev => [...prev, userMsg])
    setInput("")
    setLoading(true)
    try {
      const res = await fetch("/api/tutoring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, course: courseTitle, chapter: chapterTitle, history: messages.slice(-4) }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, { role: "assistant", content: data.response ?? "Erreur." }])
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 100)
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Erreur de connexion. Réessaie." }])
    }
    setLoading(false)
  }

  return (
    <div className="rounded-2xl flex flex-col h-full overflow-hidden" style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>
      <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: "#1a1a1a" }}>
        <span className="text-base">🧠</span>
        <p className="text-sm font-black text-white">Tuteur IA</p>
        <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: "rgba(74,222,128,0.1)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.2)" }}>Live</span>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0" style={{ maxHeight: "calc(100vh - 320px)" }}>
        {messages.length === 0 && (
          <div className="text-center py-6">
            <p className="text-2xl mb-2">🎓</p>
            <p className="text-xs" style={{ color: "#555" }}>Pose-moi n'importe quelle question sur ce chapitre !</p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className="max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed"
              style={m.role === "user" ? { background: "#1a1a2e", color: "#90cdf4" } : { background: "#111", color: "#ccc" }}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && <div className="flex gap-1 px-3"><div className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce" /><div className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: "0.15s" }} /><div className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: "0.3s" }} /></div>}
        <div ref={endRef} />
      </div>
      <div className="p-3 space-y-2 border-t" style={{ borderColor: "#1a1a1a" }}>
        <div className="flex flex-wrap gap-1">
          {QUICK.map(q => (
            <button key={q} onClick={() => sendMessage(q)} className="text-[9px] px-2 py-1 rounded-lg transition" style={{ background: "#111", color: "#666", border: "1px solid #1a1a1a" }} onMouseEnter={e => (e.currentTarget.style.color = "#aaa")} onMouseLeave={e => (e.currentTarget.style.color = "#666")}>
              {q}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input type="text" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && sendMessage(input)}
            placeholder="Pose une question…"
            className="flex-1 bg-[#111] border border-[#222] rounded-xl px-3 py-2 text-xs text-white placeholder-gray-700 outline-none focus:border-[#333] transition" />
          <button onClick={() => sendMessage(input)} disabled={!input.trim() || loading}
            className="px-3 py-2 rounded-xl text-xs font-bold transition disabled:opacity-30"
            style={{ background: "#1a1a2e", color: "#60a5fa", border: "1px solid rgba(96,165,250,0.2)" }}>→</button>
        </div>
      </div>
    </div>
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
  const [xpToast,        setXpToast]        = useState<number | null>(null)
  const [totalXP,        setTotalXP]        = useState(0)
  const [lessonMode,     setLessonMode]     = useState<string | null>(null)

  const lc = course ? LEVEL_COLORS[course.level] : LEVEL_COLORS["débutant"]

  // Check for ?lesson= from dashboard
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search)
      const lesson = params.get("lesson")
      if (lesson) setLessonMode(lesson)
    }
  }, [])

  // ── Auth ──────────────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.push("/login"); return }
      setUser(session.user)
      setToken(session.access_token)
      if (course) {
        await fetchProgress(session.user.id)
        // Load total XP
        const { data: xpData } = await supabase
          .from("user_progress")
          .select("xp_earned")
          .eq("user_id", session.user.id)
        if (xpData) setTotalXP(xpData.reduce((s: number, r: any) => s + (r.xp_earned ?? 0), 0))
      }
    })
  }, [])

  async function fetchProgress(userId: string) {
    if (!course) return
    const { data } = await supabase
      .from("user_progress")
      .select("chapter_id")
      .eq("user_id", userId)
      .eq("course_id", course.id)
      .eq("completed", true)
    if (data) setProgress(new Set(data.map((r: any) => r.chapter_id)))
  }

  // ── Load chapter content (video/lecture types) ─────────────────────────────
  const loadChapterContent = useCallback(async (chapterId: number) => {
    if (!course) return
    const ch = course.chapters.find(c => c.id === chapterId)
    // Only load AI content for video/lecture chapters
    if (ch && (ch.type === "video" || ch.type === "lecture")) {
      setChapterContent(null)
      setLoadingContent(true)
      setStartTime(Date.now())
      try {
        const res = await fetch(`/api/course-content?course_id=${course.id}&chapter_id=${chapterId}`)
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

  // ── Mark complete ──────────────────────────────────────────────────────────
  async function markComplete(chapterId: number, quizScore?: number, xpOverride?: number) {
    if (!token || !course) return
    const timeSpent = Math.round((Date.now() - startTime) / 1000)
    const chapter = course.chapters.find(c => c.id === chapterId)
    const xpEarned = xpOverride ?? getChapterXP(chapter!)

    await fetch("/api/course-content", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ course_id: course.id, chapter_id: chapterId, quiz_score: quizScore, time_spent: timeSpent }),
    })

    const newProgress = new Set(progress)
    newProgress.add(chapterId)
    setProgress(newProgress)
    setTotalXP(prev => prev + xpEarned)
    setXpToast(xpEarned)

    // Course complete confetti
    if (newProgress.size === course.chapters.length) {
      confetti({ particleCount: 200, spread: 90, origin: { y: 0.6 }, colors: ["#4ade80", "#22c55e", "#60a5fa", "#a78bfa", "#facc15"] })
      setTimeout(() => confetti({ particleCount: 100, angle: 60, spread: 70, origin: { x: 0, y: 0.6 } }), 400)
      setTimeout(() => confetti({ particleCount: 100, angle: 120, spread: 70, origin: { x: 1, y: 0.6 } }), 800)
    }
  }

  async function handleQuizComplete(score: number, chapterId: number) {
    setQuizDone(prev => new Set([...prev, chapterId]))
    await markComplete(chapterId, score)
  }

  if (!course) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#080808" }}>
      <p style={{ color: "#555" }}>Cours introuvable.</p>
    </div>
  )

  const activeChapter = course.chapters[activeIdx]
  const donePct       = Math.round((progress.size / course.chapters.length) * 100)
  const isChapterDone = progress.has(activeChapter.id)
  const typeInfo      = chapterTypeLabel(activeChapter.type)

  // Determine layout mode based on chapter type
  const isFullWidth = ["visualization", "sandbox", "quiz", "quiz_only", "challenge"].includes(activeChapter.type)
  const isInteractive = activeChapter.type === "interactive"

  function navigate(dir: 1 | -1) {
    const next = activeIdx + dir
    if (next < 0 || next >= course!.chapters.length) return
    setActiveIdx(next)
  }

  return (
    <div className="min-h-screen text-white" style={{ background: "#080808" }}>
      {/* XP Toast */}
      <AnimatePresence>
        {xpToast !== null && <XPToast xp={xpToast} onDone={() => setXpToast(null)} />}
      </AnimatePresence>

      <div className="max-w-[1400px] mx-auto px-4 py-5">

        {/* ── Top bar ──────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-4 mb-5 flex-wrap">
          {lessonMode && (
            <button onClick={() => router.back()}
              className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg transition"
              style={{ background: "rgba(74,222,128,0.08)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.2)" }}>
              ← Retour au dashboard
            </button>
          )}
          <button onClick={() => router.push("/apprendre")} className="text-sm transition hover:text-white" style={{ color: "#555" }}>
            ← Académie
          </button>
          <div className="h-4 w-px" style={{ background: "#222" }} />
          <span className="text-lg">{course.icon}</span>
          <h1 className="text-white font-black text-base truncate flex-1">{course.title}</h1>
          {/* XP counter */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl" style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>
            <span className="text-sm">⚡</span>
            <span className="text-sm font-black" style={{ color: "#facc15" }}>{totalXP.toLocaleString()} XP</span>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
            style={{ background: lc.bg, color: lc.text, border: `1px solid ${lc.border}` }}>{course.level}</span>
        </div>

        {/* ── Lesson context banner (from dashboard) ────────────────────────── */}
        {lessonMode && (
          <div className="mb-4 px-4 py-3 rounded-xl flex items-center gap-3" style={{ background: "rgba(74,222,128,0.05)", border: "1px solid rgba(74,222,128,0.15)" }}>
            <span>💡</span>
            <p className="text-sm text-green-400">
              Tu arrives du dashboard — applique ce que tu apprends sur de vraies données !
            </p>
            <button onClick={() => router.push(`/dashboard?symbol=AAPL&lesson=${lessonMode}`)}
              className="ml-auto text-xs font-bold px-3 py-1.5 rounded-lg transition flex-shrink-0"
              style={{ background: "rgba(74,222,128,0.15)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.25)" }}>
              📈 Voir sur le vrai graphe →
            </button>
          </div>
        )}

        {/* ── 3-column layout ──────────────────────────────────────────────── */}
        <div className="flex gap-5 items-start">

          {/* ── LEFT: Chapter sidebar ────────────────────────────────────────── */}
          <div className="w-60 flex-shrink-0 sticky top-4 hidden lg:block">
            <div className="rounded-2xl overflow-hidden" style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>
              {/* Progress */}
              <div className="px-4 py-3 border-b" style={{ borderColor: "#1a1a1a" }}>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#555" }}>Progression</p>
                  <p className="text-xs font-black" style={{ color: lc.text }}>{donePct}%</p>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "#1a1a1a" }}>
                  <motion.div className="h-full rounded-full" animate={{ width: `${donePct}%` }} transition={{ duration: 0.6 }}
                    style={{ background: `linear-gradient(90deg, ${lc.text}bb, ${lc.text})` }} />
                </div>
                <p className="text-[10px] mt-1" style={{ color: "#444" }}>{progress.size}/{course.chapters.length} chapitres</p>
              </div>

              {/* Chapter list */}
              <div className="overflow-y-auto" style={{ maxHeight: "calc(100vh - 240px)" }}>
                {course.chapters.map((ch, idx) => {
                  const done   = progress.has(ch.id)
                  const active = idx === activeIdx
                  const ti     = chapterTypeLabel(ch.type)
                  return (
                    <button key={ch.id} onClick={() => setActiveIdx(idx)}
                      className="w-full text-left px-3 py-2.5 transition-all flex items-start gap-2.5 border-b"
                      style={{ borderColor: "#111", background: active ? `${lc.text}10` : "transparent", borderLeft: active ? `2px solid ${lc.text}` : "2px solid transparent" }}>
                      <div className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] mt-0.5"
                        style={{ background: done ? lc.text : active ? `${lc.text}20` : "#1a1a1a", color: done ? "#000" : active ? lc.text : "#555", border: done ? "none" : `1px solid ${active ? lc.border : "#222"}` }}>
                        {done ? "✓" : ch.id}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-[11px] font-bold leading-snug truncate ${active ? "text-white" : "text-gray-500"}`}>{ch.title}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[9px]" style={{ color: "#444" }}>⏱ {ch.duration}</span>
                          <span className="text-[9px]" title={ti.label}>{ti.icon}</span>
                          {(ch.xp_reward || getChapterXP(ch)) > 0 && (
                            <span className="text-[9px] font-bold" style={{ color: "#facc15" }}>+{ch.xp_reward ?? getChapterXP(ch)}</span>
                          )}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* ── CENTER: Main content ─────────────────────────────────────────── */}
          <div className="flex-1 min-w-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeIdx}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
                className="space-y-4"
              >

                {/* Chapter header */}
                <div className="rounded-2xl p-5" style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>
                  <div className="flex items-start justify-between gap-4 mb-3 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase"
                          style={{ background: "#111", color: "#555", border: "1px solid #222" }}>
                          {activeChapter.id}/{course.chapters.length}
                        </span>
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase"
                          style={{ background: `${typeInfo.color}15`, color: typeInfo.color, border: `1px solid ${typeInfo.color}30` }}>
                          {typeInfo.icon} {typeInfo.label}
                        </span>
                        <span className="text-[9px]" style={{ color: "#444" }}>⏱ {activeChapter.duration}</span>
                        <span className="text-[9px] font-bold" style={{ color: "#facc15" }}>
                          ⚡ +{activeChapter.xp_reward ?? getChapterXP(activeChapter)} XP
                        </span>
                      </div>
                      <h2 className="text-white font-black text-xl leading-tight">{activeChapter.title}</h2>
                    </div>
                    {isChapterDone && (
                      <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex-shrink-0 text-xs font-bold px-3 py-1.5 rounded-xl"
                        style={{ background: "rgba(74,222,128,0.1)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.2)" }}>
                        ✅ Complété
                      </motion.span>
                    )}
                  </div>

                  {/* Video player (for video chapters) */}
                  {activeChapter.video_url && (
                    <VideoPlayer url={activeChapter.video_url} title={activeChapter.title} />
                  )}

                  {/* Text content (video/lecture only) */}
                  {(activeChapter.type === "video" || activeChapter.type === "lecture") && (
                    <div className="text-sm leading-relaxed space-y-1">
                      {loadingContent ? (
                        <div className="space-y-3">
                          {[...Array(5)].map((_, i) => <Skeleton key={i} h="h-4" w={i % 2 === 0 ? "w-full" : "w-4/5"} />)}
                        </div>
                      ) : chapterContent?.content ? renderMd(chapterContent.content) : null}
                    </div>
                  )}
                </div>

                {/* ── Type-specific interactive content ──────────────────── */}

                {/* VISUALIZATION */}
                {activeChapter.type === "visualization" && activeChapter.visualization && (
                  <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid #1a1a1a" }}>
                    <AnimatedVisualization
                      type={activeChapter.visualization.type}
                      onComplete={() => !isChapterDone && markComplete(activeChapter.id)}
                    />
                  </div>
                )}

                {/* SANDBOX */}
                {activeChapter.type === "sandbox" && (
                  <TradingSandbox
                    scenarioId={activeChapter.sandbox_config?.scenario_id}
                    live={activeChapter.sandbox_config?.live}
                    symbol={activeChapter.sandbox_config?.symbol ?? "AAPL"}
                    context={activeChapter.sandbox_config?.context}
                    question={activeChapter.sandbox_config?.question}
                    onComplete={({ decision, correct, xp }) => {
                      if (!isChapterDone) markComplete(activeChapter.id, undefined, xp)
                    }}
                  />
                )}

                {/* INTERACTIVE */}
                {activeChapter.type === "interactive" && activeChapter.interactive_config && (
                  <InteractiveChart
                    lessonMode={activeChapter.interactive_config.lesson_mode as any}
                    symbol={activeChapter.interactive_config.symbol ?? "AAPL"}
                    instruction={activeChapter.interactive_config.instruction}
                    hint={activeChapter.interactive_config.hint}
                    onCorrect={(xp) => !isChapterDone && markComplete(activeChapter.id, undefined, xp)}
                    onComplete={() => {
                      // Navigate to real chart
                    }}
                  />
                )}

                {/* QUIZ (new QuizGame component) */}
                {activeChapter.type === "quiz" && activeChapter.quiz && !quizDone.has(activeChapter.id) && (
                  <QuizGame
                    questions={activeChapter.quiz as any}
                    title={activeChapter.title}
                    onComplete={({ score, xp, grade }) => {
                      handleQuizComplete(score, activeChapter.id)
                    }}
                  />
                )}
                {activeChapter.type === "quiz" && quizDone.has(activeChapter.id) && (
                  <div className="rounded-2xl p-6 text-center" style={{ background: "rgba(74,222,128,0.05)", border: "1px solid rgba(74,222,128,0.2)" }}>
                    <p className="text-3xl mb-2">🎉</p>
                    <p className="text-white font-black text-lg">Quiz complété !</p>
                    <p className="text-gray-500 text-sm mt-1">Passe au chapitre suivant</p>
                  </div>
                )}

                {/* QUIZ_ONLY (legacy API quiz) */}
                {activeChapter.type === "quiz_only" && (
                  <div>
                    {chapterContent?.quiz?.length ? (
                      quizDone.has(activeChapter.id) ? (
                        <div className="rounded-2xl p-6 text-center" style={{ background: "rgba(74,222,128,0.05)", border: "1px solid rgba(74,222,128,0.2)" }}>
                          <p className="text-3xl mb-2">✅</p>
                          <p className="text-white font-black">Quiz déjà complété</p>
                        </div>
                      ) : (
                        <LegacyQuizBlock quiz={chapterContent.quiz} onComplete={score => handleQuizComplete(score, activeChapter.id)} />
                      )
                    ) : loadingContent ? (
                      <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} h="h-12" />)}</div>
                    ) : null}
                  </div>
                )}

                {/* Practical example */}
                {activeChapter.practical_example && !isFullWidth && !loadingContent && (
                  <div className="rounded-xl p-4" style={{ background: "rgba(74,222,128,0.05)", border: "1px solid rgba(74,222,128,0.12)" }}>
                    <p className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: "#4ade80" }}>💡 Exemple pratique</p>
                    <p className="text-sm" style={{ color: "#aaa" }}>{activeChapter.practical_example}</p>
                  </div>
                )}

                {/* Key concepts */}
                {activeChapter.key_concepts?.length > 0 && !loadingContent && (
                  <div className="rounded-xl p-4" style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>
                    <p className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: "#555" }}>🔑 Concepts clés</p>
                    <div className="flex flex-wrap gap-2">
                      {activeChapter.key_concepts.map(kc => (
                        <span key={kc} className="text-[11px] font-semibold px-3 py-1 rounded-full"
                          style={{ background: `${lc.text}12`, color: lc.text, border: `1px solid ${lc.border}` }}>{kc}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Legacy quiz from content API (for video/lecture chapters with quiz) */}
                {(activeChapter.type === "video" || activeChapter.type === "lecture") && chapterContent?.quiz?.length ? (
                  <div>
                    <p className="text-sm font-black uppercase tracking-widest mb-3" style={{ color: "#555" }}>🎯 Quiz du chapitre</p>
                    {quizDone.has(activeChapter.id) ? (
                      <div className="rounded-xl p-4 text-center" style={{ background: "rgba(74,222,128,0.06)", border: "1px solid rgba(74,222,128,0.15)" }}>
                        <p className="text-green-400 font-bold">✓ Quiz déjà complété</p>
                      </div>
                    ) : (
                      <LegacyQuizBlock quiz={chapterContent.quiz} onComplete={score => handleQuizComplete(score, activeChapter.id)} />
                    )}
                  </div>
                ) : null}

                {/* Connect to real chart button */}
                {!lessonMode && (activeChapter.type === "visualization" || activeChapter.type === "interactive") && (
                  <button onClick={() => router.push(`/dashboard?symbol=AAPL&lesson=${activeChapter.interactive_config?.lesson_mode ?? activeChapter.visualization?.type ?? "general"}`)}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition"
                    style={{ background: "#0d1117", color: "#60a5fa", border: "1px solid rgba(96,165,250,0.2)" }}>
                    📈 Voir cet indicateur sur un vrai graphe AAPL →
                  </button>
                )}

                {/* Navigation */}
                <div className="flex items-center justify-between pt-2">
                  <button onClick={() => navigate(-1)} disabled={activeIdx === 0}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition disabled:opacity-20"
                    style={{ background: "#111", border: "1px solid #222", color: "#888" }}>
                    ← Précédent
                  </button>

                  {/* Mark complete for non-interactive types */}
                  {!isChapterDone && !loadingContent && (activeChapter.type === "video" || activeChapter.type === "lecture") && !chapterContent?.quiz?.length && (
                    <button onClick={() => markComplete(activeChapter.id)}
                      className="px-4 py-2.5 rounded-xl text-sm font-bold transition"
                      style={{ background: "rgba(74,222,128,0.15)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.25)" }}>
                      ✓ Marquer comme complété
                    </button>
                  )}

                  <button onClick={() => navigate(1)} disabled={activeIdx === course.chapters.length - 1}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition disabled:opacity-20"
                    style={{ background: `${lc.text}18`, border: `1px solid ${lc.border}`, color: lc.text }}>
                    Suivant →
                  </button>
                </div>

              </motion.div>
            </AnimatePresence>
          </div>

          {/* ── RIGHT: AI Tutor ──────────────────────────────────────────────── */}
          <div className="w-72 flex-shrink-0 sticky top-4 hidden xl:block" style={{ height: "calc(100vh - 80px)" }}>
            <AiTutor courseTitle={course.title} chapterTitle={activeChapter.title} />
          </div>

        </div>
      </div>
    </div>
  )
}
