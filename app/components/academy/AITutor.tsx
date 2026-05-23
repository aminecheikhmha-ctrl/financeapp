"use client"
import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { supabase } from "@/lib/supabase"

interface ChatMessage { role: "user" | "assistant"; content: string }

interface Props {
  courseTitle:  string
  chapterTitle: string
  courseId?:    string
  chapterId?:   number
  keyConcepts?: string[]
}

const QUICK_QUESTIONS = [
  "Explique-moi simplement",
  "Exemple concret ?",
  "Comment l'appliquer ?",
  "Erreurs courantes ?",
]

// ─── Typing Indicator ────────────────────────────────────────────────────────
function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-3 py-2">
      {[0, 1, 2].map(i => (
        <motion.div key={i} className="w-1.5 h-1.5 rounded-full"
          style={{ background: "#555" }}
          animate={{ scale: [1, 1.5, 1], opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }} />
      ))}
    </div>
  )
}

export default function AITutor({ courseTitle, chapterTitle, courseId, chapterId, keyConcepts = [] }: Props) {
  const [messages,    setMessages]    = useState<ChatMessage[]>([])
  const [input,       setInput]       = useState("")
  const [loading,     setLoading]     = useState(false)
  const [notes,       setNotes]       = useState("")
  const [notesSaved,  setNotesSaved]  = useState(false)
  const [tab,         setTab]         = useState<"chat" | "notes">("chat")
  const [userId,      setUserId]      = useState<string | null>(null)
  const endRef      = useRef<HTMLDivElement>(null)
  const inputRef    = useRef<HTMLInputElement>(null)

  // Restore chat from sessionStorage
  useEffect(() => {
    if (typeof window === "undefined") return
    const key = `chat_${courseId}_${chapterId}`
    const saved = sessionStorage.getItem(key)
    if (saved) {
      try { setMessages(JSON.parse(saved)) } catch {}
    }
    // Load notes from Supabase
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return
      setUserId(data.user.id)
      supabase.from("academy_notes")
        .select("content")
        .eq("user_id", data.user.id)
        .eq("course_id", courseId ?? "")
        .eq("chapter_id", chapterId ?? 0)
        .single()
        .then(({ data: noteRow }) => {
          if (noteRow?.content) setNotes(noteRow.content)
        })
    })
  }, [courseId, chapterId])

  // Persist chat to sessionStorage
  useEffect(() => {
    if (typeof window === "undefined" || messages.length === 0) return
    const key = `chat_${courseId}_${chapterId}`
    sessionStorage.setItem(key, JSON.stringify(messages.slice(-20)))
  }, [messages, courseId, chapterId])

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
        body: JSON.stringify({
          message: text,
          course:  courseTitle,
          chapter: chapterTitle,
          history: messages.slice(-6),
        }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, { role: "assistant", content: data.response ?? "Erreur — réessaie." }])
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 80)
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Erreur de connexion. Réessaie dans un instant." }])
    }
    setLoading(false)
  }

  async function saveNotes() {
    if (!userId || !courseId || chapterId == null) return
    await supabase.from("academy_notes").upsert(
      { user_id: userId, course_id: courseId, chapter_id: chapterId, content: notes, updated_at: new Date().toISOString() },
      { onConflict: "user_id,course_id,chapter_id" }
    )
    setNotesSaved(true)
    setTimeout(() => setNotesSaved(false), 2000)
  }

  const quickSuggestions = keyConcepts.length > 0
    ? [`Explique ${keyConcepts[0]}`, ...QUICK_QUESTIONS.slice(1)]
    : QUICK_QUESTIONS

  return (
    <div className="flex flex-col h-full rounded-2xl overflow-hidden"
      style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>

      {/* Header */}
      <div className="px-4 py-3 border-b flex items-center gap-2 flex-shrink-0"
        style={{ borderColor: "#1a1a1a" }}>
        <span className="text-base">🧠</span>
        <p className="text-sm font-black text-white">Tuteur IA</p>
        <div className="flex items-center gap-1 ml-1">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span className="text-[9px] font-bold" style={{ color: "#4ade80" }}>LIVE</span>
        </div>
        {/* Tab switcher */}
        <div className="ml-auto flex rounded-lg overflow-hidden" style={{ border: "1px solid #1a1a1a" }}>
          {(["chat", "notes"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide transition-colors"
              style={{
                background: tab === t ? "#1a1a1a" : "transparent",
                color: tab === t ? "#fff" : "#555",
              }}>
              {t === "chat" ? "💬 Chat" : "📝 Notes"}
            </button>
          ))}
        </div>
      </div>

      {/* Chapter context pill */}
      <div className="px-3 pt-2.5 flex-shrink-0">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
          style={{ background: "#111", border: "1px solid #1a1a1a" }}>
          <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "#555" }}>Contexte</span>
          <span className="text-[10px] font-semibold text-white/60 truncate">{chapterTitle}</span>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {tab === "chat" ? (
          <motion.div key="chat" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex-1 flex flex-col min-h-0">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2.5 min-h-0"
              style={{ scrollbarWidth: "thin" }}>
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center py-8">
                  <div className="text-4xl mb-3">🎓</div>
                  <p className="text-xs font-bold text-white/50">Je suis là pour t'aider !</p>
                  <p className="text-[10px] mt-1" style={{ color: "#444" }}>
                    Pose une question sur <span className="text-white/30">{chapterTitle}</span>
                  </p>
                </div>
              )}
              {messages.map((m, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                  className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className="max-w-[88%] rounded-xl px-3 py-2 text-xs leading-relaxed"
                    style={m.role === "user"
                      ? { background: "rgba(96,165,250,0.12)", color: "#90cdf4", border: "1px solid rgba(96,165,250,0.2)" }
                      : { background: "#111", color: "#ddd", border: "1px solid #1a1a1a" }}>
                    {m.content}
                  </div>
                </motion.div>
              ))}
              {loading && <TypingDots />}
              <div ref={endRef} />
            </div>

            {/* Quick suggestions */}
            <div className="px-3 pt-2 flex-shrink-0">
              <div className="flex flex-wrap gap-1">
                {quickSuggestions.map(q => (
                  <button key={q} onClick={() => sendMessage(q)}
                    className="text-[9px] font-semibold px-2 py-1 rounded-lg transition-all hover:text-white/80"
                    style={{ background: "#111", color: "#555", border: "1px solid #1a1a1a" }}>
                    {q}
                  </button>
                ))}
              </div>
            </div>

            {/* Input */}
            <div className="p-3 border-t flex-shrink-0" style={{ borderColor: "#1a1a1a" }}>
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && sendMessage(input)}
                  placeholder="Pose une question…"
                  className="flex-1 rounded-xl px-3 py-2 text-xs text-white placeholder-white/20 outline-none transition-all"
                  style={{ background: "#111", border: "1px solid #1a1a1a" }}
                  onFocus={e => e.currentTarget.style.borderColor = "#333"}
                  onBlur={e => e.currentTarget.style.borderColor = "#1a1a1a"}
                />
                <button onClick={() => sendMessage(input)}
                  disabled={!input.trim() || loading}
                  className="px-3 py-2 rounded-xl text-xs font-black transition-all disabled:opacity-30"
                  style={{ background: "rgba(96,165,250,0.15)", color: "#60a5fa", border: "1px solid rgba(96,165,250,0.25)" }}>
                  →
                </button>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div key="notes" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex-1 flex flex-col min-h-0 p-3">
            <p className="text-[10px] font-bold uppercase tracking-widest mb-2 flex-shrink-0" style={{ color: "#555" }}>📝 Mes notes — {chapterTitle}</p>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Prends des notes ici… elles sont sauvegardées automatiquement."
              className="flex-1 min-h-0 w-full text-xs text-white/80 placeholder-white/20 resize-none outline-none rounded-xl p-3 transition-all"
              style={{ background: "#111", border: "1px solid #1a1a1a" }}
              onFocus={e => e.currentTarget.style.borderColor = "#333"}
              onBlur={e => e.currentTarget.style.borderColor = "#1a1a1a"}
            />
            <div className="flex gap-2 mt-3 flex-shrink-0">
              <button onClick={saveNotes}
                className="flex-1 py-2.5 rounded-xl text-xs font-black transition-all"
                style={{ background: notesSaved ? "rgba(74,222,128,0.15)" : "rgba(96,165,250,0.1)", color: notesSaved ? "#4ade80" : "#60a5fa", border: `1px solid ${notesSaved ? "rgba(74,222,128,0.3)" : "rgba(96,165,250,0.2)"}` }}>
                {notesSaved ? "✅ Sauvegardé !" : "💾 Sauvegarder"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
