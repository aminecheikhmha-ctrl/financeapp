"use client"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

interface Step {
  id: string
  label: string
  done: boolean
}

interface Props {
  positions: any[]
  watchlist: string[]
  onDismiss: () => void
}

export default function OnboardingChecklist({ positions, watchlist, onDismiss }: Props) {
  const [courseStarted, setCourseStarted] = useState(false)
  const [alertCreated, setAlertCreated] = useState(false)
  const [forumPosted, setForumPosted] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    // Check if dismissed
    if (localStorage.getItem("checklist_dismissed") === "1") {
      setDismissed(true)
      return
    }
    // Check course progress
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      const { data: rows } = await supabase.from("user_progress").select("id").eq("user_id", data.user.id).limit(1)
      if (rows && rows.length > 0) setCourseStarted(true)
      // Check alerts
      const { data: session } = await supabase.auth.getSession()
      const token = session.session?.access_token
      if (token) {
        fetch("/api/alerts", { headers: { Authorization: `Bearer ${token}` } })
          .then(r => r.json())
          .then(d => { if (Array.isArray(d) && d.length > 0) setAlertCreated(true) })
          .catch(() => {})
      }
      // Check forum post
      const { data: forumPosts } = await supabase
        .from("forum_posts")
        .select("id")
        .eq("user_id", data.user.id)
        .limit(1)
      if (forumPosts && forumPosts.length > 0) setForumPosted(true)
    })
  }, [])

  const steps: Step[] = [
    { id: "account", label: "Créer ton compte", done: true },
    { id: "watchlist", label: "Ajouter un actif à ta watchlist", done: watchlist.length > 1 },
    { id: "order", label: "Passer ton premier ordre paper trading", done: positions.length > 0 },
    { id: "course", label: "Lire ton premier cours", done: courseStarted },
    { id: "alert", label: "Configurer une alerte de prix", done: alertCreated },
    { id: "tpsl", label: "Configurer un TP et un SL", done: false },
    { id: "forum", label: "Rejoindre le forum", done: forumPosted },
  ]

  const stepLinks: Record<string, string> = {
    watchlist: "/dashboard",
    order: "/dashboard",
    tpsl: "/portfolio",
    course: "/apprendre",
    alert: "/dashboard",
    forum: "/forum",
  }

  const completedCount = steps.filter(s => s.done).length
  const allDone = completedCount === steps.length
  const pct = Math.round((completedCount / steps.length) * 100)

  function dismiss() {
    localStorage.setItem("checklist_dismissed", "1")
    setDismissed(true)
    onDismiss()
  }

  if (dismissed || allDone) return null

  return (
    <div className="bg-[#0f0f0f] border border-white/8 rounded-2xl p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-white font-bold text-sm">Premiers pas 🚀</h3>
          <p className="text-gray-500 text-xs mt-0.5">{completedCount}/{steps.length} étapes complétées</p>
        </div>
        <button onClick={dismiss} className="text-gray-600 hover:text-gray-400 text-xl transition">×</button>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-white/5 rounded-full mb-4 overflow-hidden relative">
        <div
          className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[10px] text-gray-600 text-right mb-3">{pct}% complété</p>

      {/* Steps */}
      <div className="space-y-2">
        {steps.map(step => {
          const href = !step.done ? stepLinks[step.id] : undefined
          const El = href ? "a" : "div"
          return (
            <El key={step.id} href={href} className={`flex items-center gap-3 ${href ? "cursor-pointer group" : ""}`}>
              <div className={`w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 text-xs font-black transition-all ${
                step.done ? "bg-green-500 border-green-500 text-black" : "border-white/20 text-transparent"
              }`}>✓</div>
              <span className={`text-sm transition-all ${step.done ? "line-through text-gray-600" : href ? "text-gray-300 group-hover:text-white" : "text-gray-300"}`}>
                {step.label}
              </span>
              {!step.done && href && <span className="ml-auto text-[10px] text-gray-700 group-hover:text-green-400 transition">→</span>}
            </El>
          )
        })}
      </div>
    </div>
  )
}
