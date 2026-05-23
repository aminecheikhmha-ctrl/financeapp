"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import { COURSES } from "@/lib/courses"

// ─── Types ─────────────────────────────────────────────────────────────────────
interface Flashcard {
  id: string
  term: string
  definition: string
  course_id: string
  course_title: string
  level: "débutant" | "intermédiaire" | "avancé"
}

interface CardProgress {
  card_id: string
  difficulty: "easy" | "hard" | "review"
  next_review: string
  streak: number
}

// ─── Generate cards from courses ──────────────────────────────────────────────
function generateCards(): Flashcard[] {
  const cards: Flashcard[] = []
  for (const course of COURSES) {
    for (const chapter of course.chapters) {
      for (const concept of chapter.key_concepts) {
        if (concept.length < 2) continue
        cards.push({
          id: `${course.id}-${chapter.id}-${concept.replace(/\s+/g, "_")}`,
          term: concept,
          definition: chapter.practical_example.length > 20
            ? chapter.practical_example
            : `Concept clé du cours "${course.title}", chapitre "${chapter.title}".`,
          course_id: course.id,
          course_title: course.title,
          level: course.level,
        })
      }
    }
  }
  // Deduplicate by term
  const seen = new Set<string>()
  return cards.filter(c => {
    if (seen.has(c.term.toLowerCase())) return false
    seen.add(c.term.toLowerCase())
    return true
  })
}

const ALL_CARDS = generateCards()

const LEVEL_COLORS = {
  débutant:      { bg: "rgba(74,222,128,0.1)",  text: "#4ade80", border: "rgba(74,222,128,0.25)"  },
  intermédiaire: { bg: "rgba(96,165,250,0.1)",  text: "#60a5fa", border: "rgba(96,165,250,0.25)"  },
  avancé:        { bg: "rgba(167,139,250,0.1)", text: "#a78bfa", border: "rgba(167,139,250,0.25)" },
}

// ─── Flip Card Component ────────────────────────────────────────────────────────
function FlipCard({ card, flipped, onFlip }: {
  card: Flashcard; flipped: boolean; onFlip: () => void
}) {
  const lc = LEVEL_COLORS[card.level]
  return (
    <div className="relative w-full" style={{ perspective: "1200px", height: 340 }} onClick={onFlip}>
      <motion.div
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ duration: 0.5, type: "spring", stiffness: 200, damping: 25 }}
        style={{ transformStyle: "preserve-3d", position: "relative", width: "100%", height: "100%" }}>

        {/* Front */}
        <div className="absolute inset-0 rounded-3xl flex flex-col items-center justify-center p-8 cursor-pointer"
          style={{ backfaceVisibility: "hidden", background: "#0d0d0d", border: `2px solid ${lc.border}` }}>
          <span className="text-[10px] font-black uppercase tracking-widest mb-6" style={{ color: lc.text }}>
            {card.course_title}
          </span>
          <p className="text-3xl font-black text-white text-center mb-6 leading-tight">{card.term}</p>
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <motion.span animate={{ y: [0, -3, 0] }} transition={{ repeat: Infinity, duration: 1.5 }}>👆</motion.span>
            <span className="text-xs font-semibold" style={{ color: "#555" }}>Clique pour révéler la définition</span>
          </div>
        </div>

        {/* Back */}
        <div className="absolute inset-0 rounded-3xl flex flex-col justify-center p-8"
          style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)", background: "#111", border: `2px solid ${lc.border}` }}>
          <p className="text-[10px] font-black uppercase tracking-widest mb-4" style={{ color: lc.text }}>
            ✅ {card.term}
          </p>
          <p className="text-sm leading-relaxed" style={{ color: "#ccc" }}>{card.definition}</p>
          <div className="mt-4 pt-4 border-t" style={{ borderColor: "#1a1a1a" }}>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: lc.bg, color: lc.text, border: `1px solid ${lc.border}` }}>
              {card.level}
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

// ─── Main ──────────────────────────────────────────────────────────────────────
export default function FlashcardsPage() {
  const router   = useRouter()
  const [userId, setUserId]   = useState<string | null>(null)
  const [progMap, setProgMap] = useState<Record<string, CardProgress>>({})
  const [mode,    setMode]    = useState<"menu" | "review" | "challenge">("menu")
  const [queue,   setQueue]   = useState<Flashcard[]>([])
  const [idx,     setIdx]     = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [session, setSession] = useState({ easy: 0, hard: 0, review: 0 })
  const [timeLeft, setTime]   = useState(120)
  const [levelFilter, setLevelFilter] = useState<"all" | "débutant" | "intermédiaire" | "avancé">("all")

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push("/login"); return }
      setUserId(data.user.id)
      supabase.from("flashcard_progress")
        .select("*").eq("user_id", data.user.id)
        .then(({ data: rows }) => {
          const map: Record<string, CardProgress> = {}
          for (const r of rows ?? []) map[r.card_id] = r
          setProgMap(map)
        })
    })
  }, [])

  const dueToday = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    return ALL_CARDS.filter(c => {
      const prog = progMap[c.id]
      if (!prog) return true
      return prog.next_review <= today
    })
  }, [progMap])

  const filteredAll = useMemo(() => {
    if (levelFilter === "all") return ALL_CARDS
    return ALL_CARDS.filter(c => c.level === levelFilter)
  }, [levelFilter])

  async function saveProgress(cardId: string, difficulty: "easy" | "hard" | "review") {
    if (!userId) return
    const today = new Date()
    const daysAdd = difficulty === "easy" ? 7 : difficulty === "review" ? 3 : 1
    today.setDate(today.getDate() + daysAdd)
    const next_review = today.toISOString().slice(0, 10)
    const prev = progMap[cardId]
    const streak = difficulty === "easy" ? (prev?.streak ?? 0) + 1 : 0

    const update: CardProgress = { card_id: cardId, difficulty, next_review, streak }
    setProgMap(prev => ({ ...prev, [cardId]: update }))

    await supabase.from("flashcard_progress").upsert(
      { user_id: userId, card_id: cardId, difficulty, next_review, streak, updated_at: new Date().toISOString() },
      { onConflict: "user_id,card_id" }
    )
  }

  function startReview() {
    const cards = dueToday.length > 0 ? dueToday : filteredAll
    setQueue(cards.sort(() => Math.random() - 0.5).slice(0, 20))
    setIdx(0); setFlipped(false); setSession({ easy: 0, hard: 0, review: 0 })
    setMode("review")
  }

  function startChallenge() {
    const cards = filteredAll.sort(() => Math.random() - 0.5).slice(0, 10)
    setQueue(cards); setIdx(0); setFlipped(false)
    setSession({ easy: 0, hard: 0, review: 0 }); setTime(120)
    setMode("challenge")
  }

  async function answer(difficulty: "easy" | "hard" | "review") {
    const card = queue[idx]
    await saveProgress(card.id, difficulty)
    setSession(prev => ({ ...prev, [difficulty]: prev[difficulty] + 1 }))
    if (idx + 1 >= queue.length) {
      setMode("menu")
    } else {
      setIdx(i => i + 1)
      setFlipped(false)
    }
  }

  // Challenge timer
  useEffect(() => {
    if (mode !== "challenge") return
    if (timeLeft <= 0) { setMode("menu"); return }
    const t = setTimeout(() => setTime(v => v - 1), 1000)
    return () => clearTimeout(t)
  }, [mode, timeLeft])

  const card = queue[idx]
  const totalDue = dueToday.length

  // ── MENU ──
  if (mode === "menu") {
    const totalDone = session.easy + session.hard + session.review
    return (
      <div className="min-h-screen text-white" style={{ background: "var(--bg-canvas)" }}>
        <div className="max-w-2xl mx-auto px-4 py-8">
          <button onClick={() => router.push("/apprendre")}
            className="text-sm mb-6 flex items-center gap-1.5 transition-colors hover:text-white"
            style={{ color: "#555" }}>
            ← Académie
          </button>

          {/* Header */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <div className="flex items-center gap-4 mb-3">
              <span className="text-4xl">🃏</span>
              <div>
                <h1 className="text-3xl font-black text-white">Flashcards</h1>
                <p className="text-sm" style={{ color: "#555" }}>{ALL_CARDS.length} cartes · Répétition espacée</p>
              </div>
            </div>
          </motion.div>

          {/* Stats */}
          {totalDone > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="grid grid-cols-3 gap-3 mb-6">
              {[
                { label: "Faciles", value: session.easy,   color: "#4ade80", emoji: "✓" },
                { label: "À revoir", value: session.review, color: "#facc15", emoji: "?" },
                { label: "Difficiles", value: session.hard,  color: "#f87171", emoji: "✗" },
              ].map(s => (
                <div key={s.label} className="rounded-2xl p-4 text-center"
                  style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>
                  <p className="text-2xl font-black" style={{ color: s.color }}>{s.emoji} {s.value}</p>
                  <p className="text-[10px] mt-1" style={{ color: "#444" }}>{s.label}</p>
                </div>
              ))}
            </motion.div>
          )}

          {/* Due today banner */}
          {totalDue > 0 && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="rounded-2xl p-4 mb-6 flex items-center gap-3"
              style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
              <div className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center text-xl">🔥</div>
              <div>
                <p className="text-white font-black">{totalDue} carte{totalDue > 1 ? "s" : ""} à réviser aujourd'hui</p>
                <p className="text-xs" style={{ color: "#666" }}>Ne laisse pas ta streak tomber !</p>
              </div>
            </motion.div>
          )}

          {/* Level filter */}
          <div className="flex gap-2 mb-6 flex-wrap">
            {(["all", "débutant", "intermédiaire", "avancé"] as const).map(lv => (
              <button key={lv}
                onClick={() => setLevelFilter(lv)}
                className="px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wide transition-all"
                style={{
                  background: levelFilter === lv ? "#1a1a1a" : "transparent",
                  color: levelFilter === lv ? "#fff" : "#444",
                  border: "1px solid " + (levelFilter === lv ? "#333" : "#1a1a1a"),
                }}>
                {lv === "all" ? "Tous" : lv}
              </button>
            ))}
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <motion.button
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={startReview}
              className="w-full py-5 rounded-2xl font-black text-base flex items-center justify-center gap-3"
              style={{ background: "rgba(74,222,128,0.15)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.3)" }}>
              <span className="text-2xl">📚</span>
              {totalDue > 0 ? `Réviser ${Math.min(totalDue, 20)} cartes du jour` : "Révision libre (20 cartes)"}
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={startChallenge}
              className="w-full py-5 rounded-2xl font-black text-base flex items-center justify-center gap-3"
              style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.25)" }}>
              <span className="text-2xl">⚡</span>
              Mode défi — 10 cartes en 2 minutes
            </motion.button>

            <div className="rounded-2xl p-4" style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>
              <p className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: "#444" }}>Statistiques</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xl font-black text-white">{ALL_CARDS.length}</p>
                  <p className="text-[10px]" style={{ color: "#444" }}>Cartes totales</p>
                </div>
                <div>
                  <p className="text-xl font-black" style={{ color: "#4ade80" }}>{Object.values(progMap).filter(p => p.difficulty === "easy" && p.streak >= 3).length}</p>
                  <p className="text-[10px]" style={{ color: "#444" }}>Maîtrisées</p>
                </div>
                <div>
                  <p className="text-xl font-black" style={{ color: "#facc15" }}>{totalDue}</p>
                  <p className="text-[10px]" style={{ color: "#444" }}>À revoir</p>
                </div>
                <div>
                  <p className="text-xl font-black" style={{ color: "#f97316" }}>
                    {filteredAll.filter(c => !progMap[c.id]).length}
                  </p>
                  <p className="text-[10px]" style={{ color: "#444" }}>Nouvelles</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── REVIEW / CHALLENGE ──
  if (!card) return null

  const progress = (idx / queue.length) * 100
  const isChallenge = mode === "challenge"

  return (
    <div className="min-h-screen text-white flex flex-col" style={{ background: "var(--bg-canvas)" }}>
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-4 border-b" style={{ borderColor: "#111" }}>
        <button onClick={() => setMode("menu")} className="text-sm font-bold transition-colors hover:text-white"
          style={{ color: "#555" }}>
          ← Arrêter
        </button>
        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "#111" }}>
          <motion.div className="h-full rounded-full bg-green-400"
            animate={{ width: `${progress}%` }} transition={{ duration: 0.3 }} />
        </div>
        <span className="text-sm font-black" style={{ color: "#555" }}>{idx + 1}/{queue.length}</span>
        {isChallenge && (
          <span className="text-sm font-black px-3 py-1 rounded-xl"
            style={{
              background: timeLeft < 30 ? "rgba(239,68,68,0.15)" : "rgba(74,222,128,0.1)",
              color: timeLeft < 30 ? "#ef4444" : "#4ade80",
              border: `1px solid ${timeLeft < 30 ? "rgba(239,68,68,0.3)" : "rgba(74,222,128,0.2)"}`,
            }}>
            ⏱ {timeLeft}s
          </span>
        )}
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 max-w-lg mx-auto w-full">
        {/* Session counter */}
        <div className="flex gap-3 mb-6">
          {[{ v: session.easy, c: "#4ade80", l: "✓" }, { v: session.review, c: "#facc15", l: "?" }, { v: session.hard, c: "#f87171", l: "✗" }].map((s, i) => (
            <div key={i} className="flex items-center gap-1">
              <span className="text-sm font-black" style={{ color: s.c }}>{s.l} {s.v}</span>
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="w-full mb-6">
          <FlipCard card={card} flipped={flipped} onFlip={() => setFlipped(f => !f)} />
        </div>

        {/* Answer buttons — only shown when flipped */}
        <AnimatePresence>
          {flipped && (
            <motion.div
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }}
              className="grid grid-cols-3 gap-3 w-full">
              {[
                { key: "hard",   label: "Difficile ✗", color: "#f87171",  bg: "rgba(248,113,113,0.1)",  border: "rgba(248,113,113,0.25)" },
                { key: "review", label: "À revoir ?",  color: "#facc15",  bg: "rgba(250,204,21,0.1)",   border: "rgba(250,204,21,0.25)" },
                { key: "easy",   label: "Facile ✓",    color: "#4ade80",  bg: "rgba(74,222,128,0.1)",   border: "rgba(74,222,128,0.25)" },
              ].map(btn => (
                <motion.button
                  key={btn.key}
                  whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                  onClick={() => answer(btn.key as any)}
                  className="py-4 rounded-2xl font-black text-sm transition-all"
                  style={{ background: btn.bg, color: btn.color, border: `1px solid ${btn.border}` }}>
                  {btn.label}
                </motion.button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {!flipped && (
          <p className="text-xs text-center" style={{ color: "#333" }}>Clique sur la carte pour voir la réponse</p>
        )}
      </div>
    </div>
  )
}
