"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter, usePathname } from "next/navigation"
import { getTotalChapters } from "@/lib/courses"

const NAV_ITEMS = [
  { href: "/dashboard", icon: "📊", label: "Dashboard" },
  { href: "/portfolio", icon: "💼", label: "Portfolio" },
  { href: "/signaux", icon: "📡", label: "Signaux" },
  { href: "/analyses", icon: "🧠", label: "Analyses" },
  { href: "/apprendre", icon: "📚", label: "Apprendre" },
  { href: "/forum", icon: "💬", label: "Forum" },
  { href: "/preuves", icon: "✅", label: "Preuves" },
  { href: "/pricing", icon: "💎", label: "Tarifs" },
]

export default function Sidebar() {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<any>(null)
  const [plan, setPlan] = useState("free")
  const [collapsed, setCollapsed] = useState(false)
  const [strongCount,   setStrongCount]   = useState(0)
  const [learnProgress, setLearnProgress] = useState(0)
  const [forumCount,    setForumCount]    = useState(0)
  const [username, setUsername] = useState<string | null>(null)
  const [avatarColor, setAvatarColor] = useState("#4ade80")

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      setUser(data.user)
      const { data: profile } = await supabase
        .from("profiles").select("plan").eq("email", data.user.email).single()
      if (profile) setPlan(profile.plan)
      // Fetch user profile for avatar/username
      const { data: userProfile } = await supabase
        .from("user_profiles").select("username, avatar_color").eq("id", data.user.id).single()
      if (userProfile) {
        if (userProfile.username) setUsername(userProfile.username)
        if (userProfile.avatar_color) setAvatarColor(userProfile.avatar_color)
      }
    })

    // Fetch learning progress for badge
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      const { data: rows } = await supabase
        .from("user_progress")
        .select("chapter_id")
        .eq("user_id", data.user.id)
        .eq("completed", true)
      const total = getTotalChapters()
      if (rows && total > 0) setLearnProgress(Math.round((rows.length / total) * 100))
    })

    // Fetch recent forum posts count for badge (posts in last 24h)
    fetch("/api/forum/posts?sort=recent&category=all")
      .then(r => r.json())
      .then(d => {
        const cutoff = Date.now() - 24 * 60 * 60 * 1000
        const recent = (d?.posts ?? []).filter(
          (p: { created_at: string }) => new Date(p.created_at).getTime() > cutoff
        ).length
        setForumCount(recent)
      })
      .catch(() => {})

    // Fetch signal count once for the badge
    fetch("/api/signals")
      .then((r) => r.json())
      .then((data) => {
        const count = (data?.signals ?? []).filter(
          (s: { strength: string }) => s.strength === "strong"
        ).length
        setStrongCount(count)
      })
      .catch(() => {})

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push("/")
  }

  if (!user || pathname === "/onboarding") return null

  return (
    <aside className={`fixed left-0 top-0 h-screen bg-[#0a0a0a] border-r border-white/5 flex flex-col transition-all duration-300 z-50 ${
      collapsed ? "w-16" : "w-56"
    }`}>

      {/* Logo */}
      <div className="flex items-center justify-between px-4 py-5 border-b border-white/5">
        {!collapsed && (
          <a href="/dashboard" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center flex-shrink-0">
              <span className="text-white font-black text-xs">F</span>
            </div>
            <span className="text-white font-black text-base tracking-tight">FinanceApp</span>
          </a>
        )}
        {collapsed && (
          <a href="/dashboard" className="mx-auto">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center">
              <span className="text-white font-black text-xs">F</span>
            </div>
          </a>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={`text-gray-600 hover:text-white transition text-xs ${collapsed ? "hidden" : ""}`}
        >
          ←
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 overflow-y-auto">
        {collapsed && (
          <button
            onClick={() => setCollapsed(false)}
            className="w-full flex items-center justify-center py-2 mb-2 text-gray-600 hover:text-white transition"
          >
            →
          </button>
        )}

        <div className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href
            const isAnalyses  = item.href === "/analyses"
            const isSignaux   = item.href === "/signaux"
            const isApprendre = item.href === "/apprendre"
            const isForum     = item.href === "/forum"
            return (
             <a
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group ${
                  active
                    ? "bg-green-500/15 text-green-400"
                    : "text-gray-500 hover:text-white hover:bg-white/5"
                }`}
              >
                <span className="text-lg flex-shrink-0">{item.icon}</span>
                {!collapsed && (
                  <span className="text-sm font-semibold truncate">{item.label}</span>
                )}
                {!collapsed && isAnalyses && (
                  <span className="ml-auto flex items-center gap-1">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400" />
                    </span>
                    <span className="text-[9px] font-black text-green-400">LIVE</span>
                  </span>
                )}
                {!collapsed && isApprendre && learnProgress > 0 && (
                  <span className="ml-auto text-[9px] font-black px-1.5 py-0.5 rounded-md"
                    style={{ background: "rgba(74,222,128,0.15)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.2)" }}>
                    {learnProgress}%
                  </span>
                )}
                {!collapsed && isForum && forumCount > 0 && (
                  <span className="ml-auto flex-shrink-0 min-w-[18px] h-[18px] px-1 bg-blue-500 text-white text-[10px] font-black rounded-full flex items-center justify-center">
                    {forumCount > 99 ? "99+" : forumCount}
                  </span>
                )}
                {!collapsed && isSignaux && strongCount > 0 && (
                  <span className="ml-auto flex-shrink-0 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center">
                    {strongCount > 99 ? "99+" : strongCount}
                  </span>
                )}
                {active && !collapsed && !isAnalyses && !isSignaux && !isApprendre && !isForum && (
                  <span className="ml-auto w-1.5 h-1.5 bg-green-400 rounded-full" />
                )}
                {active && !collapsed && isForum && forumCount === 0 && (
                  <span className="ml-auto w-1.5 h-1.5 bg-green-400 rounded-full" />
                )}
                {active && !collapsed && isSignaux && strongCount === 0 && (
                  <span className="ml-auto w-1.5 h-1.5 bg-green-400 rounded-full" />
                )}
                {active && !collapsed && isApprendre && learnProgress === 0 && (
                  <span className="ml-auto w-1.5 h-1.5 bg-green-400 rounded-full" />
                )}
              </a>
            )
          })}
        </div>
      </nav>

      {/* Plan badge */}
      {!collapsed && (
        <div className="px-3 py-3 border-t border-white/5">
          <div className={`rounded-xl p-3 mb-3 ${
            plan === "premium" ? "bg-yellow-500/10 border border-yellow-500/20" :
            plan === "pro" ? "bg-green-500/10 border border-green-500/20" :
            "bg-white/3 border border-white/8"
          }`}>
            <p className={`text-xs font-bold uppercase tracking-wide ${
              plan === "premium" ? "text-yellow-400" :
              plan === "pro" ? "text-green-400" :
              "text-gray-500"
            }`}>
              {plan === "free" ? "Plan Free" : plan === "pro" ? "⭐ Plan Pro" : "💎 Plan Premium"}
            </p>
            {plan === "free" && (
              <a href="/pricing" className="text-xs text-green-400 hover:text-green-300 transition mt-1 block">
                Upgrader →
              </a>
            )}
          </div>
        </div>
      )}

      {/* User */}
      <div className={`px-3 py-4 border-t border-white/5 ${collapsed ? "flex justify-center" : ""}`}>
        {!collapsed ? (
          <div className="flex items-center gap-2">
            <a href="/profil" className="flex items-center gap-2 flex-1 min-w-0 group">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all group-hover:scale-105"
                style={{ backgroundColor: avatarColor }}
              >
                <span className="text-black text-xs font-bold">
                  {(username ?? user?.email ?? "?")[0]?.toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-xs font-semibold truncate group-hover:text-green-400 transition">
                  {username ?? user?.email}
                </p>
                <span className="text-[10px] text-orange-400 font-bold">🔥 1</span>
              </div>
            </a>
            <button
              onClick={handleLogout}
              className="text-gray-600 hover:text-red-400 transition text-xs flex-shrink-0"
              title="Déconnexion"
            >
              ⏻
            </button>
          </div>
        ) : (
          <button
            onClick={handleLogout}
            className="text-gray-600 hover:text-red-400 transition"
            title="Déconnexion"
          >
            ⏻
          </button>
        )}
      </div>

    </aside>
  )
}