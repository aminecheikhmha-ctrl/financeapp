"use client"

import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import { COURSES, LEVEL_COLORS, getTotalChapters, type Course } from "@/lib/courses"
import { getPlan, type PlanKey } from "@/lib/plans"
import UpgradeModal from "@/app/components/UpgradeModal"
import { useLanguage } from "@/lib/i18n/context"

// ─── Types ─────────────────────────────────────────────────────────────────────
type ProgressMap = Record<string, Set<number>>

// ─── Helpers ───────────────────────────────────────────────────────────────────
function getLevelLabel(level: string) {
  if (level === "débutant")      return "Beginner"
  if (level === "intermédiaire") return "Intermediate"
  return "Advanced"
}

function getCourseProgress(course: Course, progress: ProgressMap) {
  const done  = progress[course.id]?.size ?? 0
  const total = course.chapters.length
  return { done, total, pct: total === 0 ? 0 : Math.round((done / total) * 100) }
}

function totalHoursLearned(progress: ProgressMap): number {
  let minutes = 0
  for (const course of COURSES) {
    const done = progress[course.id]
    if (!done) continue
    for (const ch of course.chapters) {
      if (done.has(ch.id)) minutes += parseInt(ch.duration) || 0
    }
  }
  return Math.round(minutes / 60 * 10) / 10
}

// ─── Gradient map ──────────────────────────────────────────────────────────────
const COURSE_GRADIENTS: Record<string, string> = {
  "introduction-marches":    "from-blue-950/80 to-slate-950",
  "bases-trading":           "from-green-950/80 to-emerald-950",
  "psychologie-trader":      "from-purple-950/80 to-violet-950",
  "gestion-risque":          "from-red-950/80 to-rose-950",
  "comprendre-crypto":       "from-orange-950/80 to-amber-950",
  "analyse-technique":       "from-cyan-950/80 to-blue-950",
  "analyse-fondamentale":    "from-teal-950/80 to-green-950",
  "trading-actions":         "from-indigo-950/80 to-blue-950",
  "defi-web3":               "from-violet-950/80 to-purple-950",
  "options-derives":         "from-pink-950/80 to-rose-950",
  "trading-algorithmique":   "from-slate-950/80 to-gray-950",
  "market-making":           "from-sky-950/80 to-cyan-950",
  "macro-trading":           "from-stone-950/80 to-neutral-950",
  "hedge-fund-strategies":   "from-zinc-950/80 to-slate-950",
  "risk-management-pro":     "from-red-950/80 to-orange-950",
}

// ─── Floating particles ────────────────────────────────────────────────────────
function Particles() {
  const pts = [
    { x: 10, y: 20, d: 3.2, s: 0.4 }, { x: 25, y: 60, d: 2.8, s: 0.3 },
    { x: 40, y: 15, d: 4.0, s: 0.25 }, { x: 55, y: 45, d: 2.5, s: 0.35 },
    { x: 68, y: 70, d: 3.5, s: 0.28 }, { x: 80, y: 25, d: 2.2, s: 0.42 },
    { x: 90, y: 55, d: 3.8, s: 0.32 }, { x: 15, y: 80, d: 2.0, s: 0.38 },
    { x: 72, y: 10, d: 4.5, s: 0.22 }, { x: 48, y: 85, d: 3.0, s: 0.30 },
  ]
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {pts.map((p, i) => (
        <motion.div key={i}
          className="absolute rounded-full"
          style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.d, height: p.d, background: "#4ade80", opacity: p.s }}
          animate={{ y: [-6, 6, -6], opacity: [p.s * 0.6, p.s, p.s * 0.6] }}
          transition={{ duration: 3 + i * 0.4, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
    </div>
  )
}

// ─── Tag helper ────────────────────────────────────────────────────────────────
function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[9px] font-bold px-2 py-0.5 rounded-md"
      style={{ background: "rgba(255,255,255,0.05)", color: "#666", border: "1px solid rgba(255,255,255,0.08)" }}>
      {children}
    </span>
  )
}

// ─── Course Card ───────────────────────────────────────────────────────────────
function CourseCard({ course, progress, onClick, plan, onUpgrade, index }: {
  course: Course; progress: ProgressMap; onClick: () => void
  plan: PlanKey; onUpgrade: () => void; index: number
}) {
  const { t } = useLanguage()
  const lc   = LEVEL_COLORS[course.level]
  const { done, total, pct } = getCourseProgress(course, progress)
  const isCompleted = pct === 100 && total > 0
  const isStarted   = done > 0 && !isCompleted
  const isLocked    = plan === "free" && course.level !== "débutant"
  const grad        = COURSE_GRADIENTS[course.id] ?? "from-gray-950 to-slate-950"

  const hasVid       = course.chapters.some(c => c.video_url)
  const hasViz       = course.chapters.some(c => c.type === "visualization")
  const hasSandbox   = course.chapters.some(c => c.type === "sandbox")
  const hasInter     = course.chapters.some(c => c.type === "interactive")
  const hasQuiz      = course.chapters.some(c => c.type === "quiz" || c.type === "quiz_only")

  return (
    <motion.div
      variants={{ hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0 } }}
      initial="hidden" animate="visible"
      transition={{ delay: index * 0.04, duration: 0.35 }}
      whileHover={{ y: -4, scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      onClick={isLocked ? onUpgrade : onClick}
      className={`relative rounded-3xl overflow-hidden cursor-pointer bg-gradient-to-br ${grad}`}
      style={{ border: `1px solid ${lc.border}` }}>

      {/* Emoji bg */}
      <div className="absolute top-3 right-3 text-7xl opacity-[0.07] select-none pointer-events-none leading-none">
        {course.icon}
      </div>

      {/* Lock overlay */}
      {isLocked && (
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none"
          style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(1px)" }}>
          <div className="text-center">
            <span className="text-4xl">🔒</span>
            <p className="text-white/40 text-xs font-bold mt-2">{t.academy.locked}</p>
          </div>
        </div>
      )}

      {/* Top color strip */}
      <div className="h-[3px] w-full" style={{ background: `linear-gradient(90deg, ${lc.text}, transparent)` }} />

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <span className="text-3xl">{course.icon}</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest"
              style={{ background: lc.bg, color: lc.text, border: `1px solid ${lc.border}` }}>
              {course.level === "débutant" ? t.academy.levels.beginner : course.level === "intermédiaire" ? t.academy.levels.intermediate : t.academy.levels.advanced}
            </span>
          </div>
          {isCompleted && <span className="text-xl">✅</span>}
          {isStarted && (
            <span className="text-[10px] font-black px-2 py-1 rounded-lg"
              style={{ background: "rgba(250,204,21,0.1)", color: "#facc15", border: "1px solid rgba(250,204,21,0.2)" }}>
              In progress
            </span>
          )}
        </div>

        {/* Title + desc */}
        <h3 className="text-white font-black text-base mb-1.5 leading-snug">{course.title}</h3>
        <p className="text-[11px] leading-relaxed mb-4" style={{ color: "#555" }}>{course.description}</p>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {hasVid      && <Tag>📹 Videos</Tag>}
          {hasViz      && <Tag>✨ Animations</Tag>}
          {hasSandbox  && <Tag>🏦 Simulation</Tag>}
          {hasInter    && <Tag>🎮 Interactive</Tag>}
          {hasQuiz     && <Tag>🎯 Quiz</Tag>}
          <Tag>🤖 AI Tutor</Tag>
        </div>

        {/* Meta */}
        <div className="flex items-center gap-3 text-[10px] mb-3" style={{ color: "#444" }}>
          <span>⏱ {course.duration}</span>
          <span>·</span>
          <span>{course.chapters.length} chapters</span>
          <span>·</span>
          <span>{done}/{total} ✓</span>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 rounded-full mb-4" style={{ background: "rgba(255,255,255,0.05)" }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.9, ease: "easeOut", delay: index * 0.04 + 0.2 }}
            className="h-full rounded-full"
            style={{ background: isCompleted ? "#4ade80" : `linear-gradient(90deg, ${lc.text}80, ${lc.text})` }}
          />
        </div>

        {/* CTA */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="w-full py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all"
          style={{
            background: isCompleted ? "rgba(74,222,128,0.1)" : `${lc.text}20`,
            color: isCompleted ? "#4ade80" : lc.text,
            border: `1px solid ${isCompleted ? "rgba(74,222,128,0.25)" : lc.border}`,
          }}>
          {isCompleted ? `✅ ${t.academy.completed}` : isStarted ? `▶ ${t.academy.continueCourse} →` : `${t.academy.startCourse} →`}
        </motion.button>
      </div>
    </motion.div>
  )
}

// ─── Main ──────────────────────────────────────────────────────────────────────
export default function Apprendre() {
  const router = useRouter()
  const { t } = useLanguage()
  const [user, setUser]                   = useState<any>(null)
  const [progress, setProgress]           = useState<ProgressMap>({})
  const [ready, setReady]                 = useState(false)
  const [levelFilter, setLevel]           = useState<"all" | "débutant" | "intermédiaire" | "avancé">("all")
  const [typeFilter, setType]             = useState<"all" | "video" | "interactive">("all")
  const [statusFilter, setStatus]         = useState<"all" | "started" | "completed" | "new">("all")
  const [plan, setPlan]                   = useState<PlanKey>("free")
  const [showUpgrade, setShowUpgrade]     = useState(false)
  const [dailyChallenge, setDailyChallenge] = useState<any>(null)
  const [challengeDone, setChallengeDone] = useState(false)
  const [totalXP, setTotalXP]             = useState(0)
  const [leaderboard, setLeaderboard]     = useState<{ username: string; xp: number; avatar_color: string }[]>([])
  const [popularIds, setPopularIds]       = useState<string[]>([])
  const [streak,     setStreak]           = useState(0)
  const [streakBonus, setStreakBonus]     = useState(false)

  useEffect(() => {
    async function init() {
      const { data: authData } = await supabase.auth.getUser()
      if (!authData.user) { router.push("/login"); return }
      setUser(authData.user)

      const { data: profile } = await supabase
        .from("profiles").select("plan").eq("email", authData.user.email).maybeSingle()
      if (profile?.plan) setPlan(getPlan(profile.plan))

      await fetchProgress(authData.user.id)

      const { data: xpData } = await supabase
        .from("user_progress").select("xp_earned").eq("user_id", authData.user.id)
      if (xpData) setTotalXP(xpData.reduce((s: number, r: any) => s + (r.xp_earned ?? 0), 0))

      fetch("/api/academy/daily-challenge").then(r => r.json())
        .then(d => { if (d.id) setDailyChallenge(d) }).catch(() => {})

      const { data: lb } = await supabase
        .from("user_profiles")
        .select("username, xp, avatar_color")
        .not("xp", "is", null)
        .gt("xp", 0)
        .order("xp", { ascending: false })
        .limit(5)
      if (lb) {
        const colors = ["#4ade80","#60a5fa","#a78bfa","#f97316","#facc15"]
        setLeaderboard(lb.map((r: any, i: number) => ({
          username: r.username ?? `Trader #${i + 1}`,
          xp: r.xp ?? 0,
          avatar_color: r.avatar_color ?? colors[i],
        })))
      }
      // Popular courses by global completion count
      const { data: popData } = await supabase
        .from("user_progress")
        .select("course_id")
        .eq("completed", true)
      if (popData) {
        const counts: Record<string, number> = {}
        for (const r of popData) counts[r.course_id] = (counts[r.course_id] ?? 0) + 1
        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([id]) => id)
        setPopularIds(sorted.slice(0, 3))
      }

      checkAndUpdateStreak()
      setReady(true)
    }
    init()
  }, [])

  function checkAndUpdateStreak() {
    if (typeof window === "undefined") return
    const today = new Date().toISOString().slice(0, 10)
    const stored = localStorage.getItem("academy_streak")
    let count = 0
    let bonus = false
    if (stored) {
      try {
        const { date, count: prev } = JSON.parse(stored)
        const yesterday = new Date()
        yesterday.setDate(yesterday.getDate() - 1)
        const yesterdayStr = yesterday.toISOString().slice(0, 10)
        if (date === today) {
          count = prev
        } else if (date === yesterdayStr) {
          count = prev + 1
          bonus = count % 7 === 0
        } else {
          count = 1
        }
      } catch { count = 1 }
    } else {
      count = 1
    }
    localStorage.setItem("academy_streak", JSON.stringify({ date: today, count }))
    setStreak(count)
    setStreakBonus(bonus)
  }

  async function fetchProgress(userId: string) {
    const { data } = await supabase
      .from("user_progress").select("course_id, chapter_id")
      .eq("user_id", userId).eq("completed", true)
    const map: ProgressMap = {}
    for (const row of data ?? []) {
      if (!map[row.course_id]) map[row.course_id] = new Set()
      map[row.course_id].add(row.chapter_id)
    }
    setProgress(map)
  }

  const TOTAL_CHAPTERS    = getTotalChapters()
  const completedChapters = Object.values(progress).reduce((s, set) => s + set.size, 0)
  const completedCourses  = COURSES.filter(c => {
    const done = progress[c.id]?.size ?? 0
    return done === c.chapters.length && c.chapters.length > 0
  }).length
  const globalPct = TOTAL_CHAPTERS === 0 ? 0 : Math.round((completedChapters / TOTAL_CHAPTERS) * 100)

  const debutantDone = COURSES.filter(c => c.level === "débutant").every(c => {
    const done = progress[c.id]?.size ?? 0
    return done === c.chapters.length && c.chapters.length > 0
  })
  const intermDone = COURSES.filter(c => c.level === "intermédiaire").every(c => {
    const done = progress[c.id]?.size ?? 0
    return done === c.chapters.length && c.chapters.length > 0
  })
  const advancedDone = COURSES.filter(c => c.level === "avancé").every(c => {
    const done = progress[c.id]?.size ?? 0
    return done === c.chapters.length && c.chapters.length > 0
  })

  // Popular courses from DB, falling back to first debutant courses
  const popularCourses = popularIds.length >= 3
    ? popularIds.map(id => COURSES.find(c => c.id === id)).filter(Boolean) as Course[]
    : COURSES.filter(c => c.level === "débutant").slice(0, 3)

  const inProgress = COURSES.find(c => {
    const done = progress[c.id]?.size ?? 0
    return done > 0 && done < c.chapters.length
  })

  const LEVEL_ORDER: Record<string, number> = { "débutant": 0, "intermédiaire": 1, "avancé": 2 }

  const filtered = COURSES.filter(course => {
    if (levelFilter !== "all" && course.level !== levelFilter) return false
    if (typeFilter === "video"       && !course.chapters.some(c => c.video_url)) return false
    if (typeFilter === "interactive" && !course.chapters.some(c => c.type === "interactive")) return false
    const done = progress[course.id]?.size ?? 0
    const total = course.chapters.length
    if (statusFilter === "started"   && !(done > 0 && done < total)) return false
    if (statusFilter === "completed" && !(done === total && total > 0)) return false
    if (statusFilter === "new"       && done > 0) return false
    return true
  }).sort((a, b) => (LEVEL_ORDER[a.level] ?? 0) - (LEVEL_ORDER[b.level] ?? 0))

  if (!ready) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-canvas)" }}>
      <div className="flex flex-col items-center gap-4">
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 rounded-full border-2 border-green-400/20" />
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-green-400 animate-spin" />
        </div>
        <p className="text-sm font-bold" style={{ color: "#555" }}>Loading academy…</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen text-white overflow-x-hidden" style={{ background: "var(--bg-canvas)" }}>
      <div className="max-w-6xl mx-auto px-4 md:px-5 py-6 md:py-8">

        {/* ── HERO ─────────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative overflow-hidden rounded-3xl p-6 md:p-8 mb-8"
          style={{
            background: "linear-gradient(135deg, #0a1628 0%, #0d1f0d 50%, #080808 100%)",
            border: "1px solid rgba(74,222,128,0.15)",
          }}>
          <Particles />

          <div className="relative z-10 flex flex-col md:flex-row gap-6 md:gap-10">
            {/* Left */}
            <div className="flex-1">
              <p className="text-green-400 text-xs font-black uppercase tracking-widest mb-2">🎓 Tradex Academy</p>
              <h1 className="text-3xl md:text-4xl font-black text-white mb-3 leading-tight">
                Learn to trade<br/>
                <span className="text-green-400">like a professional</span>
              </h1>
              <p className="text-white/40 text-sm max-w-md leading-relaxed">
                {COURSES.length} complete courses · Videos · Interactive quizzes · Real-data simulations · AI tutor
              </p>
            </div>

            {/* Right: stats */}
            <div className="grid grid-cols-2 gap-3 md:w-64 flex-shrink-0">
              {[
                { label: "Completed courses", value: `${completedCourses}/${COURSES.length}`, color: "#4ade80" },
                { label: "Total XP",         value: `⚡ ${totalXP.toLocaleString()}`, color: "#facc15" },
                { label: "Progress",         value: `${globalPct}%`, color: "#60a5fa" },
                { label: "Chapters done",    value: `${completedChapters}/${TOTAL_CHAPTERS}`, color: "#f97316" },
              ].map((s, i) => (
                <motion.div key={s.label}
                  initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.1 + i * 0.07 }}
                  className="rounded-2xl p-3.5"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <p className="text-[9px] uppercase tracking-widest font-bold mb-1" style={{ color: "rgba(255,255,255,0.3)" }}>{s.label}</p>
                  <p className="text-xl font-black" style={{ color: s.color }}>{s.value}</p>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Global progress bar */}
          <div className="relative z-10 mt-6">
            <div className="flex justify-between text-xs mb-2" style={{ color: "rgba(255,255,255,0.25)" }}>
              <span>Overall progress</span>
              <span className="font-black text-green-400">{globalPct}%</span>
            </div>
            <div className="h-3 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
              <motion.div
                initial={{ width: 0 }} animate={{ width: `${globalPct}%` }}
                transition={{ duration: 1.2, ease: "easeOut", delay: 0.3 }}
                className="h-full rounded-full"
                style={{ background: "linear-gradient(90deg, #22c55e, #4ade80, #86efac)" }}
              />
            </div>
          </div>
        </motion.div>

        {/* ── BADGES ───────────────────────────────────────────────────────── */}
        <div className="flex gap-3 md:gap-4 mb-8 flex-wrap">
          {[
            { label: "Beginner",      icon: "🌱", color: "#4ade80", unlocked: debutantDone },
            { label: "Intermediate",  icon: "📊", color: "#60a5fa", unlocked: intermDone   },
            { label: "Expert",        icon: "🏆", color: "#a78bfa", unlocked: advancedDone },
          ].map((b, i) => (
            <motion.div key={b.label}
              initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 + i * 0.08 }}
              whileHover={{ scale: 1.04 }}
              className="flex-1 min-w-[120px] flex items-center gap-3 rounded-2xl p-3.5 cursor-default"
              style={{
                background: b.unlocked ? `${b.color}10` : "rgba(255,255,255,0.02)",
                border: `1px solid ${b.unlocked ? `${b.color}28` : "rgba(255,255,255,0.06)"}`,
                opacity: b.unlocked ? 1 : 0.45,
              }}>
              <span className="text-2xl">{b.icon}</span>
              <div>
                <p className="text-sm font-black text-white">{b.label}</p>
                <p className="text-[10px] font-bold" style={{ color: b.unlocked ? b.color : "#444" }}>
                  {b.unlocked ? "✓ Completed" : "To complete"}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* ── OUTILS D'APPRENTISSAGE ──────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28 }}
          className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-7">
          {/* Glossaire */}
          <motion.div
            whileHover={{ y: -3, scale: 1.01 }} whileTap={{ scale: 0.99 }}
            onClick={() => router.push("/apprendre/glossaire")}
            className="cursor-pointer rounded-2xl p-5 flex items-center gap-5 relative overflow-hidden"
            style={{ background: "linear-gradient(135deg, #0a1420 0%, #080c08 100%)", border: "1px solid rgba(96,165,250,0.2)" }}>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-6xl opacity-[0.06] select-none pointer-events-none">📖</div>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
              style={{ background: "rgba(96,165,250,0.1)", border: "1px solid rgba(96,165,250,0.2)" }}>
              📖
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-white font-black text-base">Financial glossary</p>
                <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md"
                  style={{ background: "rgba(96,165,250,0.12)", color: "#60a5fa", border: "1px solid rgba(96,165,250,0.2)" }}>
                  50+ termes
                </span>
              </div>
              <p className="text-[11px] leading-relaxed" style={{ color: "#444" }}>
                Complete trading & investing vocabulary
              </p>
            </div>
            <span className="text-blue-400/40 text-lg flex-shrink-0">→</span>
          </motion.div>

          {/* Flashcards */}
          <motion.div
            whileHover={{ y: -3, scale: 1.01 }} whileTap={{ scale: 0.99 }}
            onClick={() => router.push("/apprendre/flashcards")}
            className="cursor-pointer rounded-2xl p-5 flex items-center gap-5 relative overflow-hidden"
            style={{ background: "linear-gradient(135deg, #0e0a14 0%, #08080c 100%)", border: "1px solid rgba(167,139,250,0.2)" }}>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-6xl opacity-[0.06] select-none pointer-events-none">🃏</div>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
              style={{ background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.2)" }}>
              🃏
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-white font-black text-base">Flashcards</p>
                <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md"
                  style={{ background: "rgba(167,139,250,0.12)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.2)" }}>
                  Spaced repetition
                </span>
              </div>
              <p className="text-[11px] leading-relaxed" style={{ color: "#444" }}>
                Memorize all key concepts from each course
              </p>
            </div>
            <span className="text-purple-400/40 text-lg flex-shrink-0">→</span>
          </motion.div>
        </motion.div>

        {/* ── STREAK WIDGET ────────────────────────────────────────────────── */}
        {streak > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.32 }}
            className="rounded-2xl p-4 mb-7 flex items-center gap-4 relative overflow-hidden"
            style={{
              background: streakBonus
                ? "linear-gradient(135deg, rgba(250,204,21,0.08), rgba(250,204,21,0.03))"
                : "linear-gradient(135deg, rgba(249,115,22,0.07), rgba(239,68,68,0.03))",
              border: `1px solid ${streakBonus ? "rgba(250,204,21,0.25)" : "rgba(249,115,22,0.2)"}`,
            }}>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-6xl opacity-[0.05] select-none pointer-events-none">🔥</div>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
              style={{
                background: streakBonus ? "rgba(250,204,21,0.12)" : "rgba(249,115,22,0.12)",
                border: `1px solid ${streakBonus ? "rgba(250,204,21,0.25)" : "rgba(249,115,22,0.25)"}`,
              }}>
              🔥
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-white font-black text-base">
                  {streak} day{streak > 1 ? "s" : ""} in a row!
                </p>
                {streakBonus && (
                  <span className="text-[9px] font-black px-2 py-0.5 rounded-full animate-pulse"
                    style={{ background: "rgba(250,204,21,0.15)", color: "#facc15", border: "1px solid rgba(250,204,21,0.3)" }}>
                    +50 XP BONUS 🎉
                  </span>
                )}
              </div>
              <p className="text-xs" style={{ color: "#555" }}>
                {streak % 7 === 0 && streak > 0
                  ? "Weekly milestone reached!"
                  : `${7 - (streak % 7)} day${7 - (streak % 7) > 1 ? "s" : ""} until the next bonus`}
              </p>
              <div className="flex gap-1 mt-2">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} className="flex-1 h-1 rounded-full"
                    style={{ background: i < (streak % 7 || (streak > 0 && streak % 7 === 0 ? 7 : 0)) ? "#f97316" : "rgba(255,255,255,0.06)" }} />
                ))}
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-3xl font-black" style={{ color: streakBonus ? "#facc15" : "#f97316" }}>
                {streak}
              </p>
              <p className="text-[9px] uppercase tracking-widest" style={{ color: "#444" }}>days</p>
            </div>
          </motion.div>
        )}

        {/* ── CONTINUE BANNER ─────────────────────────────────────────────── */}
        {inProgress && (() => {
          const { done, total, pct } = getCourseProgress(inProgress, progress)
          const lc = LEVEL_COLORS[inProgress.level]
          const nextChapter = inProgress.chapters.find(c => !progress[inProgress.id]?.has(c.id))
          return (
            <motion.div
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              whileHover={{ y: -2 }}
              onClick={() => router.push(`/apprendre/${inProgress.id}`)}
              className="rounded-2xl p-5 mb-7 cursor-pointer relative overflow-hidden"
              style={{ background: `linear-gradient(135deg, ${lc.text}08, rgba(0,0,0,0))`, border: `1px solid ${lc.border}` }}>
              <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                    style={{ background: `${lc.text}12`, border: `1px solid ${lc.border}` }}>
                    {inProgress.icon}
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest mb-0.5" style={{ color: lc.text }}>
                      ▶ Continue
                    </p>
                    <p className="text-white font-black text-base">{inProgress.title}</p>
                    {nextChapter && (
                      <p className="text-[11px] mt-0.5" style={{ color: "#555" }}>
                        Next: {nextChapter.title}
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-2xl font-black" style={{ color: lc.text }}>{pct}%</p>
                  <p className="text-[10px]" style={{ color: "#444" }}>{done}/{total} chapters</p>
                </div>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
                <motion.div
                  initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  className="h-full rounded-full"
                  style={{ background: `linear-gradient(90deg, ${lc.text}88, ${lc.text})` }}
                />
              </div>
            </motion.div>
          )
        })()}

        {/* ── DAILY CHALLENGE + LEADERBOARD ───────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-7">

          {/* Daily Challenge */}
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
            className="rounded-3xl p-6 relative overflow-hidden"
            style={{ background: "linear-gradient(135deg, #160800, #0f0600)", border: "1px solid rgba(239,68,68,0.25)" }}>
            {/* DAILY badge */}
            <div className="absolute top-4 right-4 flex items-center gap-1.5 px-2.5 py-1 rounded-full"
              style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.35)" }}>
              <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse" />
              <span className="text-red-400 text-[10px] font-black">DAILY</span>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
                style={{ background: "rgba(239,68,68,0.12)" }}>⚡</div>
              <div className="flex-1 min-w-0 pr-16">
                <p className="text-white font-black text-lg mb-1">Daily challenge</p>
                {dailyChallenge ? (
                  <>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-0.5 rounded-lg text-xs font-black"
                        style={{ background: "rgba(96,165,250,0.1)", color: "#60a5fa", border: "1px solid rgba(96,165,250,0.2)" }}>
                        {dailyChallenge.symbol}
                      </span>
                      <span className="text-[10px]" style={{ color: "#555" }}>{dailyChallenge.challenge_type?.replace(/_/g, " ")}</span>
                    </div>
                    <p className="text-sm leading-relaxed mb-4" style={{ color: "#777" }}>{dailyChallenge.description}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-black" style={{ color: "#facc15" }}>⚡ +{dailyChallenge.xp_reward} XP</span>
                      {challengeDone ? (
                        <span className="text-xs font-bold px-3 py-1.5 rounded-xl"
                          style={{ background: "rgba(74,222,128,0.1)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.2)" }}>
                          ✅ Completed!
                        </span>
                      ) : (
                        <motion.button
                          whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                          onClick={() => router.push(`/dashboard?symbol=${dailyChallenge.symbol}&lesson=${dailyChallenge.challenge_type}`)}
                          className="px-4 py-2 rounded-xl text-xs font-black transition-all"
                          style={{ background: "linear-gradient(135deg,#ef4444,#dc2626)", color: "white" }}>
                          Take the challenge →
                        </motion.button>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="space-y-2 mt-2">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="h-3 rounded animate-pulse" style={{ background: "#1a1a1a", width: `${85 - i * 12}%` }} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>

          {/* Leaderboard */}
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.42 }}
            className="rounded-3xl p-6"
            style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xl">🏆</span>
              <p className="font-black text-white">Top learners</p>
              <span className="ml-auto text-xs font-black" style={{ color: "#facc15" }}>⚡ {totalXP.toLocaleString()} XP</span>
            </div>
            {leaderboard.length > 0 ? (
              <div className="space-y-2">
                {leaderboard.map((entry, i) => (
                  <motion.div key={i}
                    initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + i * 0.06 }}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                    style={{
                      background: i === 0 ? "rgba(250,204,21,0.06)" : "#111",
                      border: i === 0 ? "1px solid rgba(250,204,21,0.15)" : "1px solid transparent",
                    }}>
                    <span className="text-base w-6 text-center">
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`}
                    </span>
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black"
                      style={{ background: `${entry.avatar_color}18`, color: entry.avatar_color, border: `1px solid ${entry.avatar_color}30` }}>
                      T
                    </div>
                    <span className="flex-1 text-xs text-white/50">{entry.username}</span>
                    <span className="text-xs font-black" style={{ color: "#facc15" }}>⚡ {entry.xp.toLocaleString()}</span>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-10 rounded-xl animate-pulse" style={{ background: "#111" }} />
                ))}
              </div>
            )}
          </motion.div>
        </div>

        {/* ── FILTERS ──────────────────────────────────────────────────────── */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1 flex-nowrap md:flex-wrap items-center">
          {/* Level */}
          <div className="flex rounded-xl overflow-hidden flex-shrink-0" style={{ border: "1px solid #1a1a1a" }}>
            {(["all", "débutant", "intermédiaire", "avancé"] as const).map(lv => (
              <button key={lv} onClick={() => setLevel(lv)}
                className="px-3 py-2 text-[10px] font-bold uppercase tracking-wide transition-colors"
                style={{
                  background: levelFilter === lv ? "#1a1a1a" : "transparent",
                  color: levelFilter === lv
                    ? (lv === "all" ? "#fff" : LEVEL_COLORS[lv as keyof typeof LEVEL_COLORS]?.text ?? "#fff")
                    : "#444",
                }}>
                {lv === "all" ? t.signals.filters.all : lv === "débutant" ? "🌱" : lv === "intermédiaire" ? "📊" : "🏆"}{lv !== "all" ? ` ${lv === "débutant" ? t.academy.levels.beginner : lv === "intermédiaire" ? t.academy.levels.intermediate : t.academy.levels.advanced}` : ""}
              </button>
            ))}
          </div>

          {/* Type */}
          <div className="flex rounded-xl overflow-hidden flex-shrink-0" style={{ border: "1px solid #1a1a1a" }}>
            {([["all","All"],["video","📹 Video"],["interactive","🎮 Interactive"]] as const).map(([k,l]) => (
              <button key={k} onClick={() => setType(k as any)}
                className="px-3 py-2 text-[10px] font-bold uppercase tracking-wide transition-colors"
                style={{ background: typeFilter === k ? "#1a1a1a" : "transparent", color: typeFilter === k ? "#fff" : "#444" }}>
                {l}
              </button>
            ))}
          </div>

          {/* Status */}
          <div className="flex rounded-xl overflow-hidden flex-shrink-0" style={{ border: "1px solid #1a1a1a" }}>
            {([["all", t.signals.filters.all],["new","New"],["started",t.academy.continueCourse],["completed",`✅ ${t.academy.completed}`]] as [string, string][]).map(([k,l]) => (
              <button key={k} onClick={() => setStatus(k as any)}
                className="px-3 py-2 text-[10px] font-bold uppercase tracking-wide transition-colors"
                style={{ background: statusFilter === k ? "#1a1a1a" : "transparent", color: statusFilter === k ? "#fff" : "#444" }}>
                {l}
              </button>
            ))}
          </div>

          <span className="ml-auto text-[11px] flex-shrink-0" style={{ color: "#333" }}>
            {filtered.length} courses
          </span>
        </div>

        {/* ── COURSE GRID ───────────────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {filtered.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="text-center py-24" style={{ color: "#333" }}>
              <p className="text-4xl mb-3">🎓</p>
              <p className="text-sm">{t.academy.noCourses}</p>
            </motion.div>
          ) : (
            <motion.div
              key="grid"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((course, index) => (
                <CourseCard
                  key={course.id}
                  course={course}
                  progress={progress}
                  onClick={() => router.push(`/apprendre/${course.id}`)}
                  plan={plan}
                  onUpgrade={() => setShowUpgrade(true)}
                  index={index}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

      </div>

      <UpgradeModal open={showUpgrade} onClose={() => setShowUpgrade(false)} context="courses" />
    </div>
  )
}
