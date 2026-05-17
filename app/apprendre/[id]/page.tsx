"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { useParams, useRouter } from "next/navigation"
import { getCourse, LEVEL_COLORS, type Chapter } from "@/lib/courses"
import confetti from "canvas-confetti"

// ─── Types ─────────────────────────────────────────────────────────────────────

type QuizQuestion = {
  question:    string
  options:     string[]
  correct:     number
  explanation: string
}

type ChapterContent = {
  content: string
  quiz:    QuizQuestion[]
}

type ChatMessage = { role: "user" | "assistant"; content: string }

// ─── Markdown renderer ────────────────────────────────────────────────────────

function renderMd(text: string) {
  return text.split("\n").map((line, i) => {
    if (line.startsWith("### ")) return (
      <h3 key={i} className="text-white font-black text-base mt-5 mb-2">{line.slice(4)}</h3>
    )
    if (line.startsWith("## ")) return (
      <h2 key={i} className="text-white font-black text-lg mt-6 mb-2">{line.slice(3)}</h2>
    )
    if (line.startsWith("- ")) return (
      <div key={i} className="flex gap-2 ml-3 my-1">
        <span style={{ color: "#4ade80" }}>•</span>
        <span style={{ color: "#aaa" }} dangerouslySetInnerHTML={{
          __html: line.slice(2).replace(/\*\*(.*?)\*\*/g, "<strong style='color:#fff'>$1</strong>"),
        }} />
      </div>
    )
    if (/^\d+\./.test(line)) return (
      <div key={i} className="flex gap-2 ml-3 my-1">
        <span style={{ color: "#4ade80" }}>{line.split(".")[0]}.</span>
        <span style={{ color: "#aaa" }} dangerouslySetInnerHTML={{
          __html: line.split(".").slice(1).join(".").trim().replace(/\*\*(.*?)\*\*/g, "<strong style='color:#fff'>$1</strong>"),
        }} />
      </div>
    )
    if (line.trim() === "") return <div key={i} className="h-2" />
    return (
      <p key={i} style={{ color: "#aaa" }} dangerouslySetInnerHTML={{
        __html: line.replace(/\*\*(.*?)\*\*/g, "<strong style='color:#fff'>$1</strong>"),
      }} />
    )
  })
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ h = "h-4", w = "w-full" }: { h?: string; w?: string }) {
  return <div className={`${h} ${w} rounded-lg animate-pulse`} style={{ background: "#151515" }} />
}

// ─── Video Player ─────────────────────────────────────────────────────────────

function VideoPlayer({ url, title }: { url: string; title: string }) {
  const [playing, setPlaying] = useState(false)
  const videoId = url.split("/embed/")[1]?.split("?")[0]
  const thumb = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`

  if (playing) {
    return (
      <div className="relative w-full rounded-xl overflow-hidden mb-6" style={{ paddingBottom: "56.25%" }}>
        <iframe
          src={`${url}?autoplay=1&rel=0`}
          className="absolute inset-0 w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    )
  }

  return (
    <div
      onClick={() => setPlaying(true)}
      className="relative w-full rounded-xl overflow-hidden mb-6 cursor-pointer group"
      style={{ paddingBottom: "56.25%", background: "#000" }}
    >
      <img src={thumb} alt={title} className="absolute inset-0 w-full h-full object-cover opacity-70 group-hover:opacity-90 transition" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-16 h-16 rounded-full flex items-center justify-center transition-transform group-hover:scale-110"
          style={{ background: "rgba(239,68,68,0.9)" }}>
          <svg viewBox="0 0 24 24" fill="white" className="w-7 h-7 ml-1">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      </div>
      <div className="absolute bottom-3 left-3 text-xs font-semibold px-2 py-0.5 rounded"
        style={{ background: "rgba(0,0,0,0.7)", color: "#ddd" }}>
        ▶ {title}
      </div>
    </div>
  )
}

// ─── Quiz component ───────────────────────────────────────────────────────────

function QuizBlock({
  quiz,
  onComplete,
}: {
  quiz:       QuizQuestion[]
  onComplete: (score: number) => void
}) {
  const [current,   setCurrent]   = useState(0)
  const [selected,  setSelected]  = useState<number | null>(null)
  const [answers,   setAnswers]   = useState<(number | null)[]>(quiz.map(() => null))
  const [finished,  setFinished]  = useState(false)

  const q      = quiz[current]
  const isLast = current === quiz.length - 1
  const score  = answers.filter((a, i) => a === quiz[i].correct).length

  function handleSelect(idx: number) {
    if (selected !== null) return
    setSelected(idx)
    const newAnswers = [...answers]; newAnswers[current] = idx; setAnswers(newAnswers)
  }

  function handleNext() {
    if (isLast) {
      setFinished(true)
      onComplete(Math.round((score + (selected === q.correct ? 1 : 0)) / quiz.length * 100))
    } else {
      setCurrent(c => c + 1)
      setSelected(null)
    }
  }

  const stars = finished ? (score >= quiz.length * 0.75 ? 3 : score >= quiz.length * 0.5 ? 2 : 1) : 0

  if (finished) return (
    <div className="rounded-2xl p-6 text-center" style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>
      <p className="text-3xl mb-2">{"⭐".repeat(stars)}{"☆".repeat(3 - stars)}</p>
      <p className="text-white font-black text-xl mb-1">{score}/{quiz.length} correctes</p>
      <p className="text-sm mb-5" style={{ color: "#666" }}>
        {score === quiz.length ? "Parfait ! Maîtrise totale." : score >= quiz.length * 0.75 ? "Très bien ! Bonne compréhension." : "Continue à pratiquer !"}
      </p>
      <div className="space-y-3 text-left">
        {quiz.map((q, i) => {
          const correct = answers[i] === q.correct
          return (
            <div key={i} className="rounded-xl p-3" style={{
              background: correct ? "rgba(74,222,128,0.06)" : "rgba(248,113,113,0.06)",
              border: `1px solid ${correct ? "rgba(74,222,128,0.15)" : "rgba(248,113,113,0.15)"}`,
            }}>
              <p className="text-xs font-bold mb-1" style={{ color: correct ? "#4ade80" : "#f87171" }}>
                {correct ? "✓" : "✗"} {q.question}
              </p>
              <p className="text-[11px]" style={{ color: "#888" }}>{q.explanation}</p>
            </div>
          )
        })}
      </div>
    </div>
  )

  return (
    <div className="rounded-2xl p-6" style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "#555" }}>
          Quiz · Question {current + 1}/{quiz.length}
        </p>
        <div className="flex gap-1">
          {quiz.map((_, i) => (
            <div key={i} className="w-1.5 h-1.5 rounded-full" style={{
              background: i < current ? "#4ade80" : i === current ? "#60a5fa" : "#222",
            }} />
          ))}
        </div>
      </div>

      <p className="text-white font-bold mb-4 text-sm leading-relaxed">{q.question}</p>

      <div className="space-y-2 mb-4">
        {q.options.map((opt, idx) => {
          let bg = "#111", border = "#1a1a1a", color = "#aaa"
          if (selected !== null) {
            if (idx === q.correct) { bg = "rgba(74,222,128,0.12)"; border = "rgba(74,222,128,0.3)"; color = "#4ade80" }
            else if (idx === selected) { bg = "rgba(248,113,113,0.12)"; border = "rgba(248,113,113,0.3)"; color = "#f87171" }
          } else if (idx === selected) { bg = "#1a1a1a"; border = "#333"; color = "#fff" }

          return (
            <button key={idx} onClick={() => handleSelect(idx)}
              className="w-full text-left px-4 py-3 rounded-xl text-sm transition-all"
              style={{ background: bg, border: `1px solid ${border}`, color }}>
              <span className="font-bold mr-2">{String.fromCharCode(65 + idx)}.</span>
              {opt}
            </button>
          )
        })}
      </div>

      {selected !== null && (
        <div className="rounded-xl p-3 mb-4" style={{
          background: selected === q.correct ? "rgba(74,222,128,0.06)" : "rgba(248,113,113,0.06)",
          border: `1px solid ${selected === q.correct ? "rgba(74,222,128,0.15)" : "rgba(248,113,113,0.15)"}`,
        }}>
          <p className="text-[11px]" style={{ color: "#888" }}>{q.explanation}</p>
        </div>
      )}

      <button onClick={handleNext} disabled={selected === null}
        className="w-full py-2.5 rounded-xl text-sm font-black uppercase tracking-wider transition disabled:opacity-30"
        style={{ background: "#4ade80", color: "#000" }}>
        {isLast ? "Terminer le quiz" : "Question suivante →"}
      </button>
    </div>
  )
}

// ─── AI Tutor sidebar ─────────────────────────────────────────────────────────

function AiTutor({
  courseTitle,
  chapterTitle,
}: {
  courseTitle:  string
  chapterTitle: string
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput]       = useState("")
  const [loading, setLoading]   = useState(false)
  const chatRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const SUGGESTIONS = [
    "Explique-moi ce concept simplement",
    "Donne-moi un autre exemple",
    "Quiz-moi sur ce chapitre",
    "Quelles sont les erreurs courantes ?",
  ]

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [messages, loading])

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return
    const msg = text.trim()
    setInput("")
    setLoading(true)
    const updated = [...messages, { role: "user" as const, content: msg }]
    setMessages(updated)

    try {
      const res = await fetch("/api/tutoring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msg,
          moduleTitle: courseTitle,
          chapitreTitle: chapterTitle,
          history: messages,
        }),
      })
      const data = await res.json()
      setMessages([...updated, { role: "assistant", content: data.response ?? "Désolé, une erreur s'est produite." }])
    } catch {
      setMessages([...updated, { role: "assistant", content: "Erreur de connexion. Réessaie." }])
    }
    setLoading(false)
  }

  return (
    <div className="flex flex-col h-full rounded-2xl overflow-hidden" style={{ background: "#0a0a0a", border: "1px solid #1a1a1a" }}>
      {/* Header */}
      <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: "#1a1a1a" }}>
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-lg flex-shrink-0"
          style={{ background: "rgba(74,222,128,0.15)", border: "1px solid rgba(74,222,128,0.25)" }}>
          🧑‍🏫
        </div>
        <div>
          <p className="text-white text-xs font-black">Tuteur IA</p>
          <p className="text-[10px]" style={{ color: "#555" }}>Groq LLaMA 3.3</p>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span className="text-[9px]" style={{ color: "#4ade80" }}>En ligne</span>
        </div>
      </div>

      {/* Messages */}
      <div ref={chatRef} className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0" style={{ maxHeight: "420px" }}>
        {messages.length === 0 && (
          <div className="text-center py-6 px-2">
            <p className="text-2xl mb-2">👋</p>
            <p className="text-xs font-bold text-white mb-1">Bonjour ! Je suis ton tuteur.</p>
            <p className="text-[11px]" style={{ color: "#555" }}>
              Pose-moi n'importe quelle question sur <span className="text-white">{chapterTitle}</span>
            </p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            {m.role === "assistant" && (
              <span className="text-sm mr-1.5 mt-0.5 flex-shrink-0">🧑‍🏫</span>
            )}
            <div className="max-w-[85%] px-3 py-2 rounded-xl text-[11px] leading-relaxed"
              style={{
                background: m.role === "user" ? "rgba(74,222,128,0.2)" : "#151515",
                color: m.role === "user" ? "#4ade80" : "#ccc",
                borderRadius: m.role === "user" ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
                border: m.role === "user" ? "1px solid rgba(74,222,128,0.3)" : "1px solid #1f1f1f",
              }}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start gap-1.5">
            <span className="text-sm">🧑‍🏫</span>
            <div className="px-3 py-2 rounded-xl text-[11px]" style={{ background: "#151515", border: "1px solid #1f1f1f" }}>
              <span className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <span key={i} className="w-1 h-1 rounded-full bg-gray-500 animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Suggestions */}
      {messages.length === 0 && (
        <div className="px-3 pb-2">
          <div className="flex flex-col gap-1">
            {SUGGESTIONS.map(s => (
              <button key={s} onClick={() => sendMessage(s)}
                className="text-left text-[10px] px-3 py-1.5 rounded-lg transition hover:brightness-125"
                style={{ background: "#111", color: "#888", border: "1px solid #1a1a1a" }}>
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-3 border-t" style={{ borderColor: "#1a1a1a" }}>
        <div className="flex gap-2">
          <input ref={inputRef} type="text" value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && sendMessage(input)}
            placeholder="Pose ta question…"
            className="flex-1 px-3 py-2 rounded-xl text-[11px] text-white outline-none"
            style={{ background: "#111", border: "1px solid #222" }} />
          <button onClick={() => sendMessage(input)} disabled={loading || !input.trim()}
            className="px-3 py-2 rounded-xl text-[11px] font-bold transition disabled:opacity-30"
            style={{ background: "rgba(74,222,128,0.2)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.3)" }}>
            ↑
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main course page ─────────────────────────────────────────────────────────

export default function CoursePage() {
  const { id }   = useParams()
  const router   = useRouter()
  const course   = getCourse(id as string)

  const [user,            setUser]            = useState<any>(null)
  const [token,           setToken]           = useState<string | null>(null)
  const [activeIdx,       setActiveIdx]       = useState(0)
  const [chapterContent,  setChapterContent]  = useState<ChapterContent | null>(null)
  const [loadingContent,  setLoadingContent]  = useState(false)
  const [progress,        setProgress]        = useState<Set<number>>(new Set())
  const [quizDone,        setQuizDone]        = useState<Set<number>>(new Set())
  const [startTime,       setStartTime]       = useState(Date.now())

  const lc = course ? LEVEL_COLORS[course.level] : LEVEL_COLORS["débutant"]

  // ── Auth + initial data ──────────────────────────────────────────────────────

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.push("/login"); return }
      setUser(session.user)
      setToken(session.access_token)
      if (course) await fetchProgress(session.user.id)
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

  // ── Load chapter content ─────────────────────────────────────────────────────

  const loadChapterContent = useCallback(async (chapterId: number) => {
    if (!course) return
    setChapterContent(null)
    setLoadingContent(true)
    setStartTime(Date.now())
    try {
      const res = await fetch(`/api/course-content?course_id=${course.id}&chapter_id=${chapterId}`)
      const data = await res.json()
      setChapterContent(data)
    } catch {}
    setLoadingContent(false)
  }, [course])

  useEffect(() => {
    if (course) loadChapterContent(course.chapters[activeIdx]?.id)
  }, [activeIdx, course])

  // ── Mark complete + confetti ─────────────────────────────────────────────────

  async function markComplete(chapterId: number, quizScore?: number) {
    if (!token || !course) return
    const timeSpent = Math.round((Date.now() - startTime) / 1000)

    await fetch("/api/course-content", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        course_id: course.id,
        chapter_id: chapterId,
        quiz_score: quizScore,
        time_spent: timeSpent,
      }),
    })

    const newProgress = new Set(progress)
    newProgress.add(chapterId)
    setProgress(newProgress)

    // Confetti if entire course complete
    if (newProgress.size === course.chapters.length) {
      confetti({ particleCount: 160, spread: 80, origin: { y: 0.6 }, colors: ["#4ade80", "#22c55e", "#60a5fa", "#a78bfa"] })
      setTimeout(() => confetti({ particleCount: 80, angle: 60,  spread: 60, origin: { x: 0, y: 0.6 } }), 300)
      setTimeout(() => confetti({ particleCount: 80, angle: 120, spread: 60, origin: { x: 1, y: 0.6 } }), 600)
    }
  }

  async function handleQuizComplete(score: number, chapterId: number) {
    const newQuizDone = new Set(quizDone); newQuizDone.add(chapterId); setQuizDone(newQuizDone)
    await markComplete(chapterId, score)
  }

  if (!course) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#080808" }}>
      <p style={{ color: "#555" }}>Cours introuvable.</p>
    </div>
  )

  const activeChapter = course.chapters[activeIdx]
  const donePct = Math.round((progress.size / course.chapters.length) * 100)
  const isChapterDone = progress.has(activeChapter.id)

  return (
    <div className="min-h-screen text-white" style={{ background: "#080808" }}>
      <div className="max-w-[1400px] mx-auto px-4 py-5">

        {/* ── Back + course title ──────────────────────────────────────────── */}
        <div className="flex items-center gap-4 mb-5">
          <button onClick={() => router.push("/apprendre")}
            className="text-sm transition hover:text-white" style={{ color: "#555" }}>
            ← Académie
          </button>
          <div className="h-4 w-px" style={{ background: "#222" }} />
          <span className="text-lg">{course.icon}</span>
          <h1 className="text-white font-black text-base truncate">{course.title}</h1>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full ml-auto flex-shrink-0"
            style={{ background: lc.bg, color: lc.text, border: `1px solid ${lc.border}` }}>
            {course.level}
          </span>
        </div>

        {/* ── 3-column layout ──────────────────────────────────────────────── */}
        <div className="flex gap-5 items-start">

          {/* ── LEFT: Chapter sidebar ───────────────────────────────────────── */}
          <div className="w-64 flex-shrink-0 sticky top-4">
            <div className="rounded-2xl overflow-hidden" style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>
              {/* Progress */}
              <div className="px-4 py-3 border-b" style={{ borderColor: "#1a1a1a" }}>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#555" }}>Progression</p>
                  <p className="text-xs font-black" style={{ color: lc.text }}>{donePct}%</p>
                </div>
                <div className="h-1.5 rounded-full" style={{ background: "#1a1a1a" }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${donePct}%`, background: lc.text }} />
                </div>
                <p className="text-[10px] mt-1" style={{ color: "#444" }}>{progress.size}/{course.chapters.length} chapitres</p>
              </div>

              {/* Chapter list */}
              <div className="overflow-y-auto" style={{ maxHeight: "calc(100vh - 200px)" }}>
                {course.chapters.map((ch, idx) => {
                  const done    = progress.has(ch.id)
                  const active  = idx === activeIdx
                  return (
                    <button key={ch.id} onClick={() => setActiveIdx(idx)}
                      className="w-full text-left px-3 py-2.5 transition-all flex items-start gap-2.5 border-b"
                      style={{
                        borderColor: "#111",
                        background: active ? `${lc.text}12` : "transparent",
                        borderLeft: active ? `2px solid ${lc.text}` : "2px solid transparent",
                      }}>
                      {/* Checkmark / number */}
                      <div className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] mt-0.5"
                        style={{
                          background: done ? lc.text : active ? `${lc.text}20` : "#1a1a1a",
                          color: done ? "#000" : active ? lc.text : "#555",
                          border: done ? "none" : `1px solid ${active ? lc.border : "#222"}`,
                        }}>
                        {done ? "✓" : ch.id}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-[11px] font-bold leading-snug truncate ${active ? "text-white" : "text-gray-500"}`}>
                          {ch.title}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[9px]" style={{ color: "#444" }}>⏱ {ch.duration}</span>
                          {ch.type === "video" && <span className="text-[9px]" style={{ color: "#60a5fa" }}>📹</span>}
                          {ch.type === "interactive" && <span className="text-[9px]" style={{ color: "#a78bfa" }}>🎮</span>}
                          {ch.type === "quiz_only" && <span className="text-[9px]" style={{ color: "#facc15" }}>🎯</span>}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* ── CENTER: Main content ─────────────────────────────────────────── */}
          <div className="flex-1 min-w-0 space-y-5">

            {/* Chapter header */}
            <div className="rounded-2xl p-6" style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase"
                      style={{ background: "#111", color: "#555", border: "1px solid #222" }}>
                      Chapitre {activeChapter.id}/{course.chapters.length}
                    </span>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase"
                      style={{
                        background: activeChapter.type === "video" ? "rgba(96,165,250,0.1)" : "rgba(167,139,250,0.1)",
                        color: activeChapter.type === "video" ? "#60a5fa" : "#a78bfa",
                        border: `1px solid ${activeChapter.type === "video" ? "rgba(96,165,250,0.2)" : "rgba(167,139,250,0.2)"}`,
                      }}>
                      {activeChapter.type === "video" ? "📹 Vidéo" : activeChapter.type === "interactive" ? "🎮 Interactif" : activeChapter.type === "quiz_only" ? "🎯 Quiz" : "📖 Lecture"}
                    </span>
                    <span className="text-[9px]" style={{ color: "#444" }}>⏱ {activeChapter.duration}</span>
                  </div>
                  <h2 className="text-white font-black text-xl">{activeChapter.title}</h2>
                </div>
                {isChapterDone && (
                  <span className="flex-shrink-0 text-xs font-bold px-3 py-1.5 rounded-xl"
                    style={{ background: "rgba(74,222,128,0.1)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.2)" }}>
                    ✓ Complété
                  </span>
                )}
              </div>

              {/* Video player */}
              {activeChapter.video_url && (
                <VideoPlayer url={activeChapter.video_url} title={activeChapter.title} />
              )}

              {/* Content */}
              {activeChapter.type !== "quiz_only" && (
                <div className="text-sm leading-relaxed space-y-1">
                  {loadingContent ? (
                    <div className="space-y-3">
                      <Skeleton h="h-4" w="w-3/4" />
                      <Skeleton h="h-4" />
                      <Skeleton h="h-4" w="w-5/6" />
                      <Skeleton h="h-4" />
                      <Skeleton h="h-4" w="w-4/5" />
                      <div className="h-4" />
                      <Skeleton h="h-4" w="w-1/2" />
                      <Skeleton h="h-4" />
                      <Skeleton h="h-4" w="w-3/4" />
                    </div>
                  ) : chapterContent?.content ? (
                    renderMd(chapterContent.content)
                  ) : null}
                </div>
              )}
            </div>

            {/* Practical example box */}
            {activeChapter.practical_example && activeChapter.type !== "quiz_only" && !loadingContent && (
              <div className="rounded-xl p-4" style={{ background: "rgba(74,222,128,0.05)", border: "1px solid rgba(74,222,128,0.12)" }}>
                <p className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: "#4ade80" }}>
                  💡 Exemple pratique
                </p>
                <p className="text-sm" style={{ color: "#aaa" }}>{activeChapter.practical_example}</p>
              </div>
            )}

            {/* Key concepts */}
            {activeChapter.key_concepts.length > 0 && !loadingContent && (
              <div className="rounded-xl p-4" style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>
                <p className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: "#555" }}>
                  🔑 Concepts clés
                </p>
                <div className="flex flex-wrap gap-2">
                  {activeChapter.key_concepts.map(kc => (
                    <span key={kc} className="text-[11px] font-semibold px-3 py-1 rounded-full"
                      style={{ background: `${lc.text}12`, color: lc.text, border: `1px solid ${lc.border}` }}>
                      {kc}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Quiz */}
            {chapterContent?.quiz?.length ? (
              <div>
                <p className="text-sm font-black uppercase tracking-widest mb-3" style={{ color: "#555" }}>
                  🎯 Quiz du chapitre
                </p>
                {quizDone.has(activeChapter.id) ? (
                  <div className="rounded-xl p-4 text-center" style={{ background: "rgba(74,222,128,0.06)", border: "1px solid rgba(74,222,128,0.15)" }}>
                    <p className="text-green-400 font-bold">✓ Quiz déjà complété pour ce chapitre</p>
                  </div>
                ) : (
                  <QuizBlock
                    quiz={chapterContent.quiz}
                    onComplete={score => handleQuizComplete(score, activeChapter.id)}
                  />
                )}
              </div>
            ) : null}

            {/* Navigation buttons */}
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => { setActiveIdx(i => Math.max(0, i - 1)) }}
                disabled={activeIdx === 0}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition disabled:opacity-20"
                style={{ background: "#111", border: "1px solid #222", color: "#888" }}>
                ← Précédent
              </button>

              {/* Mark complete button (for chapters without quiz) */}
              {!chapterContent?.quiz?.length && !isChapterDone && !loadingContent && (
                <button onClick={() => markComplete(activeChapter.id)}
                  className="px-4 py-2.5 rounded-xl text-sm font-bold transition"
                  style={{ background: "rgba(74,222,128,0.15)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.25)" }}>
                  ✓ Marquer comme complété
                </button>
              )}

              <button
                onClick={() => { setActiveIdx(i => Math.min(course.chapters.length - 1, i + 1)) }}
                disabled={activeIdx === course.chapters.length - 1}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition disabled:opacity-20"
                style={{ background: `${lc.text}18`, border: `1px solid ${lc.border}`, color: lc.text }}>
                Suivant →
              </button>
            </div>

          </div>

          {/* ── RIGHT: AI Tutor ──────────────────────────────────────────────── */}
          <div className="w-72 flex-shrink-0 sticky top-4" style={{ height: "calc(100vh - 80px)" }}>
            <AiTutor
              courseTitle={course.title}
              chapterTitle={activeChapter.title}
            />
          </div>

        </div>
      </div>
    </div>
  )
}
