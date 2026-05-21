"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import { COURSES, LEVEL_COLORS, getTotalChapters, type Course } from "@/lib/courses"
import { PLANS, getPlan, type PlanKey } from "@/lib/plans"
import UpgradeModal from "@/app/components/UpgradeModal"

// ─── Types ─────────────────────────────────────────────────────────────────────

type ProgressMap = Record<string, Set<number>> // course_id → set of completed chapter_ids

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getLevelLabel(level: string) {
  if (level === "débutant")      return "Débutant"
  if (level === "intermédiaire") return "Intermédiaire"
  return "Avancé"
}

function getCourseProgress(course: Course, progress: ProgressMap): { done: number; total: number; pct: number } {
  const done  = progress[course.id]?.size ?? 0
  const total = course.chapters.length
  return { done, total, pct: total === 0 ? 0 : Math.round((done / total) * 100) }
}

function hasVideos(course: Course) {
  return course.chapters.some(c => c.video_url)
}

function totalHoursLearned(progress: ProgressMap): number {
  let minutes = 0
  for (const course of COURSES) {
    const done = progress[course.id]
    if (!done) continue
    for (const chapter of course.chapters) {
      if (done.has(chapter.id)) {
        const m = parseInt(chapter.duration) || 0
        minutes += m
      }
    }
  }
  return Math.round(minutes / 60 * 10) / 10
}

// ─── Course Card ───────────────────────────────────────────────────────────────

function CourseCard({ course, progress, onClick, plan, onUpgrade }: {
  course: Course
  progress: ProgressMap
  onClick: () => void
  plan: PlanKey
  onUpgrade: () => void
}) {
  const lc   = LEVEL_COLORS[course.level]
  const { done, total, pct } = getCourseProgress(course, progress)
  const isCompleted  = pct === 100 && total > 0
  const isStarted    = done > 0 && !isCompleted
  const hasVid       = hasVideos(course)

  // Free users can access all débutant courses; intermédiaire + avancé require Pro
  const isLocked = plan === "free" && course.level !== "débutant"

  function handleClick() {
    if (isLocked) {
      onUpgrade()
    } else {
      onClick()
    }
  }

  return (
    <div
      onClick={handleClick}
      className={`relative rounded-2xl cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] overflow-hidden${isLocked ? " opacity-60" : ""}`}
      style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}
    >
      {/* Top color band */}
      <div className="h-1.5 w-full" style={{ background: `linear-gradient(90deg, ${lc.text}66, ${lc.text}22)` }} />

      {/* Lock overlay for free plan */}
      {isLocked && (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          <span className="text-4xl drop-shadow-lg">🔒</span>
        </div>
      )}

      <div className="p-5">
        {/* Header row */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{course.icon}</span>
            <div>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest"
                style={{ background: lc.bg, color: lc.text, border: `1px solid ${lc.border}` }}>
                {getLevelLabel(course.level)}
              </span>
            </div>
          </div>
          {isCompleted ? (
            <span className="text-lg">✅</span>
          ) : isStarted ? (
            <span className="text-xs font-bold px-2 py-1 rounded-lg"
              style={{ background: "rgba(250,204,21,0.1)", color: "#facc15", border: "1px solid rgba(250,204,21,0.2)" }}>
              En cours
            </span>
          ) : null}
        </div>

        {/* Title + desc */}
        <h3 className="text-white font-black text-base mb-1.5 leading-snug">{course.title}</h3>
        <p className="text-[11px] leading-relaxed mb-4" style={{ color: "#666" }}>{course.description}</p>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {hasVid && (
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-md"
              style={{ background: "rgba(96,165,250,0.08)", color: "#60a5fa", border: "1px solid rgba(96,165,250,0.15)" }}>
              📹 Vidéos
            </span>
          )}
          {course.chapters.some(c => c.type === "visualization") && (
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-md"
              style={{ background: "rgba(249,115,22,0.08)", color: "#f97316", border: "1px solid rgba(249,115,22,0.15)" }}>
              ✨ Animations
            </span>
          )}
          {course.chapters.some(c => c.type === "sandbox") && (
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-md"
              style={{ background: "rgba(74,222,128,0.08)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.15)" }}>
              🏦 Simulation
            </span>
          )}
          {course.chapters.some(c => c.type === "interactive") && (
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-md"
              style={{ background: "rgba(167,139,250,0.08)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.15)" }}>
              🎮 Interactif
            </span>
          )}
          {course.chapters.some(c => c.type === "quiz" || c.type === "quiz_only") && (
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-md"
              style={{ background: "rgba(250,204,21,0.08)", color: "#facc15", border: "1px solid rgba(250,204,21,0.15)" }}>
              🎯 Quiz
            </span>
          )}
          <span className="text-[9px] font-bold px-2 py-0.5 rounded-md"
            style={{ background: "rgba(74,222,128,0.08)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.15)" }}>
            🤖 IA Tuteur
          </span>
        </div>

        {/* Meta */}
        <div className="flex items-center justify-between text-[10px] mb-3" style={{ color: "#555" }}>
          <span>⏱ {course.duration}</span>
          <span>{course.chapters.length} chapitres</span>
          <span>{done}/{total} complétés</span>
        </div>

        {/* Progress bar */}
        <div className="h-1 rounded-full mb-4" style={{ background: "#1a1a1a" }}>
          <div className="h-full rounded-full transition-all" style={{
            width: `${pct}%`,
            background: isCompleted ? "#4ade80" : `linear-gradient(90deg, ${lc.text}bb, ${lc.text})`,
          }} />
        </div>

        {/* CTA */}
        <button className="w-full py-2 rounded-xl text-xs font-black uppercase tracking-wider transition" style={{
          background: isCompleted
            ? "rgba(74,222,128,0.08)"
            : isStarted
            ? `${lc.text}15`
            : `${lc.text}22`,
          color: isCompleted ? "#4ade80" : lc.text,
          border: `1px solid ${isCompleted ? "rgba(74,222,128,0.2)" : lc.border}`,
        }}>
          {isCompleted ? "✅ Revoir" : isStarted ? "▶ Reprendre" : "Commencer →"}
        </button>
      </div>
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function Apprendre() {
  const router = useRouter()
  const [user, setUser]           = useState<any>(null)
  const [progress, setProgress]   = useState<ProgressMap>({})
  const [ready, setReady]         = useState(false)
  const [levelFilter, setLevel]   = useState<"all" | "débutant" | "intermédiaire" | "avancé">("all")
  const [typeFilter, setType]     = useState<"all" | "video" | "interactive">("all")
  const [statusFilter, setStatus] = useState<"all" | "started" | "completed" | "new">("all")
  const [plan, setPlan]           = useState<PlanKey>("free")
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [dailyChallenge, setDailyChallenge] = useState<any>(null)
  const [challengeDone, setChallengeDone]   = useState(false)
  const [totalXP, setTotalXP]     = useState(0)
  const [leaderboard, setLeaderboard] = useState<{ username: string; xp: number; avatar_color: string }[]>([])

  useEffect(() => {
    async function init() {
      const { data: authData } = await supabase.auth.getUser()
      if (!authData.user) { router.push("/login"); return }
      setUser(authData.user)

      const { data: profile } = await supabase
        .from("profiles")
        .select("plan")
        .eq("email", authData.user.email)
        .single()
      if (profile?.plan) setPlan(getPlan(profile.plan))

      await fetchProgress(authData.user.id)

      // Fetch total XP
      const { data: xpData } = await supabase
        .from("user_progress")
        .select("xp_earned")
        .eq("user_id", authData.user.id)
      if (xpData) setTotalXP(xpData.reduce((s: number, r: any) => s + (r.xp_earned ?? 0), 0))

      // Fetch daily challenge
      fetch("/api/academy/daily-challenge")
        .then(r => r.json())
        .then(d => { if (d.id) setDailyChallenge(d) })
        .catch(() => {})

      // Simple leaderboard from user_progress (top 5 by total XP)
      const { data: lb } = await supabase
        .from("user_progress")
        .select("user_id, xp_earned")
        .not("xp_earned", "is", null)
      if (lb) {
        const byUser: Record<string, number> = {}
        for (const r of lb) {
          byUser[r.user_id] = (byUser[r.user_id] ?? 0) + (r.xp_earned ?? 0)
        }
        const sorted = Object.entries(byUser).sort((a, b) => b[1] - a[1]).slice(0, 5)
        setLeaderboard(sorted.map(([uid, xp], i) => ({
          username: `Trader #${i + 1}`,
          xp,
          avatar_color: ["#4ade80", "#60a5fa", "#a78bfa", "#f97316", "#facc15"][i],
        })))
      }

      setReady(true)
    }
    init()
  }, [])

  async function fetchProgress(userId: string) {
    const { data } = await supabase
      .from("user_progress")
      .select("course_id, chapter_id")
      .eq("user_id", userId)
      .eq("completed", true)

    const map: ProgressMap = {}
    for (const row of data ?? []) {
      if (!map[row.course_id]) map[row.course_id] = new Set()
      map[row.course_id].add(row.chapter_id)
    }
    setProgress(map)
  }

  // Global stats
  const TOTAL_CHAPTERS    = getTotalChapters()
  const completedChapters = Object.values(progress).reduce((s, set) => s + set.size, 0)
  const completedCourses  = COURSES.filter(c => {
    const done = progress[c.id]?.size ?? 0
    return done === c.chapters.length && c.chapters.length > 0
  }).length
  const globalPct    = TOTAL_CHAPTERS === 0 ? 0 : Math.round((completedChapters / TOTAL_CHAPTERS) * 100)
  const hoursLearned = totalHoursLearned(progress)

  // Badges
  const debutantDone  = COURSES.filter(c => c.level === "débutant").every(c => {
    const done = progress[c.id]?.size ?? 0
    return done === c.chapters.length && c.chapters.length > 0
  })
  const intermDone    = COURSES.filter(c => c.level === "intermédiaire").every(c => {
    const done = progress[c.id]?.size ?? 0
    return done === c.chapters.length && c.chapters.length > 0
  })
  const advancedDone  = COURSES.filter(c => c.level === "avancé").every(c => {
    const done = progress[c.id]?.size ?? 0
    return done === c.chapters.length && c.chapters.length > 0
  })

  // Course in progress (most recently started)
  const inProgress = COURSES.find(c => {
    const done = progress[c.id]?.size ?? 0
    return done > 0 && done < c.chapters.length
  })

  // Filtered courses
  const filtered = COURSES.filter(course => {
    if (levelFilter !== "all" && course.level !== levelFilter) return false
    if (typeFilter === "video"       && !hasVideos(course)) return false
    if (typeFilter === "interactive" && !course.chapters.some(c => c.type === "interactive")) return false
    const done = progress[course.id]?.size ?? 0
    const total = course.chapters.length
    if (statusFilter === "started"   && !(done > 0 && done < total)) return false
    if (statusFilter === "completed" && !(done === total && total > 0)) return false
    if (statusFilter === "new"       && done > 0) return false
    return true
  })

  if (!ready) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-canvas)" }}>
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-500 text-sm">Chargement de l'académie…</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen text-white overflow-x-hidden page-enter" style={{ background: "var(--bg-canvas)" }}>
      <div className="max-w-6xl mx-auto px-4 md:px-5 py-6 md:py-7">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">🎓</span>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight">Académie FinanceApp</h1>
          </div>
          <p className="text-sm mb-6" style={{ color: "#666" }}>
            15 cours complets · ~45h de contenu · Vidéos · Quiz interactifs
          </p>

          {/* Stats strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            {[
              { label: "Cours complétés", value: `${completedCourses}/15`,    color: "#4ade80" },
              { label: "Chapitres faits",  value: `${completedChapters}/${TOTAL_CHAPTERS}`, color: "#60a5fa" },
              { label: "XP Total",         value: `⚡ ${totalXP.toLocaleString()}`, color: "#facc15" },
              { label: "Progression",      value: `${globalPct}%`,             color: "#fb923c" },
            ].map(s => (
              <div key={s.label} className="rounded-xl p-4" style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>
                <p className="text-[9px] uppercase tracking-widest font-bold mb-1" style={{ color: "#444" }}>{s.label}</p>
                <p className="text-2xl font-black" style={{ color: s.color }}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Global progress bar */}
          <div className="rounded-xl p-4 mb-5" style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold" style={{ color: "#888" }}>Progression globale</p>
              <p className="text-xs font-black" style={{ color: "#4ade80" }}>{globalPct}%</p>
            </div>
            <div className="h-2 rounded-full" style={{ background: "#1a1a1a" }}>
              <div className="h-full rounded-full transition-all duration-700"
                style={{ width: `${globalPct}%`, background: "linear-gradient(90deg, #22c55e, #4ade80)" }} />
            </div>
          </div>

          {/* Badges */}
          <div className="flex gap-3 flex-wrap">
            {[
              { label: "🌱 Débutant",      unlocked: debutantDone,  color: "#4ade80" },
              { label: "📊 Intermédiaire", unlocked: intermDone,    color: "#60a5fa" },
              { label: "🏆 Expert",        unlocked: advancedDone,  color: "#a78bfa" },
            ].map(b => (
              <div key={b.label} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition ${b.unlocked ? "" : "opacity-30"}`}
                style={{
                  background: b.unlocked ? `${b.color}18` : "#111",
                  border: `1px solid ${b.unlocked ? `${b.color}35` : "#222"}`,
                  color: b.unlocked ? b.color : "#555",
                }}>
                {b.label}
                {!b.unlocked && <span className="text-[10px]">🔒</span>}
              </div>
            ))}
          </div>
        </div>

        {/* ── Continue section ─────────────────────────────────────────────── */}
        {inProgress && (() => {
          const { done, total, pct } = getCourseProgress(inProgress, progress)
          const lc = LEVEL_COLORS[inProgress.level]
          const nextChapter = inProgress.chapters.find(c => !progress[inProgress.id]?.has(c.id))
          return (
            <div className="rounded-2xl p-5 mb-7 cursor-pointer transition-all hover:brightness-110"
              onClick={() => router.push(`/apprendre/${inProgress.id}`)}
              style={{ background: "#0d0d0d", border: `1px solid ${lc.border}` }}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{inProgress.icon}</span>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: lc.text }}>
                      ▶ Continuer
                    </p>
                    <p className="text-white font-black">{inProgress.title}</p>
                    {nextChapter && (
                      <p className="text-[11px] mt-0.5" style={{ color: "#666" }}>
                        Prochain : Chapitre {nextChapter.id} — {nextChapter.title}
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black" style={{ color: lc.text }}>{pct}%</p>
                  <p className="text-[10px]" style={{ color: "#555" }}>{done}/{total} chapitres</p>
                </div>
              </div>
              <div className="h-1.5 rounded-full" style={{ background: "#1a1a1a" }}>
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${lc.text}bb, ${lc.text})` }} />
              </div>
            </div>
          )
        })()}

        {/* ── Filters ──────────────────────────────────────────────────────── */}
        <div className="flex gap-2 mb-7 overflow-x-auto scrollbar-hide pb-1 flex-nowrap md:flex-wrap">
          {/* Level */}
          <div className="flex rounded-xl overflow-hidden" style={{ border: "1px solid #1a1a1a" }}>
            {(["all", "débutant", "intermédiaire", "avancé"] as const).map(lv => (
              <button key={lv} onClick={() => setLevel(lv)}
                className="px-3 py-2 text-[10px] font-bold uppercase tracking-wide transition"
                style={{
                  background: levelFilter === lv ? "#1a1a1a" : "#0d0d0d",
                  color: levelFilter === lv
                    ? (lv === "all" ? "#fff" : LEVEL_COLORS[lv as keyof typeof LEVEL_COLORS]?.text ?? "#fff")
                    : "#555",
                }}>
                {lv === "all" ? "Tous" : lv === "débutant" ? "🌱" : lv === "intermédiaire" ? "📊" : "🏆"} {lv !== "all" ? getLevelLabel(lv) : ""}
              </button>
            ))}
          </div>

          {/* Type */}
          <div className="flex rounded-xl overflow-hidden" style={{ border: "1px solid #1a1a1a" }}>
            {([["all", "Tous"], ["video", "📹 Vidéo"], ["interactive", "🎮 Interactif"]] as const).map(([k, l]) => (
              <button key={k} onClick={() => setType(k as any)}
                className="px-3 py-2 text-[10px] font-bold uppercase tracking-wide transition"
                style={{ background: typeFilter === k ? "#1a1a1a" : "#0d0d0d", color: typeFilter === k ? "#fff" : "#555" }}>
                {l}
              </button>
            ))}
          </div>

          {/* Status */}
          <div className="flex rounded-xl overflow-hidden" style={{ border: "1px solid #1a1a1a" }}>
            {([["all", "Tous"], ["new", "Nouveau"], ["started", "En cours"], ["completed", "✅ Complété"]] as const).map(([k, l]) => (
              <button key={k} onClick={() => setStatus(k as any)}
                className="px-3 py-2 text-[10px] font-bold uppercase tracking-wide transition"
                style={{ background: statusFilter === k ? "#1a1a1a" : "#0d0d0d", color: statusFilter === k ? "#fff" : "#555" }}>
                {l}
              </button>
            ))}
          </div>

          <span className="flex items-center text-[11px] ml-auto" style={{ color: "#444" }}>
            {filtered.length} cours
          </span>
        </div>

        {/* ── Daily Challenge + Leaderboard row ────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-7">

          {/* Daily Challenge */}
          <div className="rounded-2xl p-5" style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">⚡</span>
              <p className="font-black text-white">Défi du jour</p>
              <span className="ml-auto text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider"
                style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}>
                DAILY
              </span>
            </div>
            {dailyChallenge ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black px-2 py-1 rounded-lg" style={{ background: "#111", color: "#60a5fa", border: "1px solid #1a1a1a" }}>
                    {dailyChallenge.symbol}
                  </span>
                  <span className="text-xs text-gray-500">{dailyChallenge.challenge_type?.replace(/_/g, " ")}</span>
                </div>
                <p className="text-sm text-gray-300 leading-relaxed">{dailyChallenge.description}</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold" style={{ color: "#facc15" }}>⚡ +{dailyChallenge.xp_reward} XP</span>
                  {challengeDone ? (
                    <span className="text-xs font-bold px-3 py-1.5 rounded-xl" style={{ background: "rgba(74,222,128,0.1)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.2)" }}>
                      ✅ Complété aujourd'hui !
                    </span>
                  ) : (
                    <button
                      onClick={() => router.push(`/dashboard?symbol=${dailyChallenge.symbol}&lesson=${dailyChallenge.challenge_type}`)}
                      className="text-xs font-bold px-3 py-1.5 rounded-xl transition"
                      style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}>
                      Relever le défi →
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-4 rounded animate-pulse" style={{ background: "#151515", width: `${85 - i * 10}%` }} />
                ))}
              </div>
            )}
          </div>

          {/* Leaderboard + XP */}
          <div className="rounded-2xl p-5" style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">🏆</span>
              <p className="font-black text-white">Top apprenants</p>
              <span className="ml-auto flex items-center gap-1.5 text-xs font-bold" style={{ color: "#facc15" }}>
                ⚡ {totalXP.toLocaleString()} XP
              </span>
            </div>
            {leaderboard.length > 0 ? (
              <div className="space-y-2">
                {leaderboard.map((entry, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-xl" style={{ background: "#111" }}>
                    <span className="text-xs font-black w-5 text-center" style={{ color: i === 0 ? "#facc15" : i === 1 ? "#94a3b8" : i === 2 ? "#f97316" : "#555" }}>
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`}
                    </span>
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0"
                      style={{ background: `${entry.avatar_color}20`, color: entry.avatar_color, border: `1px solid ${entry.avatar_color}40` }}>
                      {entry.username.slice(-1)}
                    </div>
                    <span className="flex-1 text-xs text-gray-400">{entry.username}</span>
                    <span className="text-xs font-black" style={{ color: "#facc15" }}>⚡ {entry.xp.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-10 rounded-xl animate-pulse" style={{ background: "#111" }} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Course grid ───────────────────────────────────────────────────── */}
        {filtered.length === 0 ? (
          <div className="text-center py-20" style={{ color: "#444" }}>
            <p className="text-4xl mb-3">🎓</p>
            <p>Aucun cours ne correspond aux filtres sélectionnés.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(course => (
              <CourseCard
                key={course.id}
                course={course}
                progress={progress}
                onClick={() => router.push(`/apprendre/${course.id}`)}
                plan={plan}
                onUpgrade={() => setShowUpgrade(true)}
              />
            ))}
          </div>
        )}

      </div>

      <UpgradeModal open={showUpgrade} onClose={() => setShowUpgrade(false)} context="courses" />
    </div>
  )
}
