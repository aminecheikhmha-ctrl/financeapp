"use client"

import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { getLevelInfo } from "@/lib/achievements"
import { getTotalChapters } from "@/lib/courses"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard, TrendingUp, Briefcase, BookOpen,
  Newspaper, BarChart2, Star, Bot,
  GitCompare, Settings, LogOut, ChevronLeft, ChevronRight,
  Bell, Zap, Users, MessageSquare,
} from "lucide-react"
import { useLanguage } from "@/lib/i18n/context"
import { useTheme } from "@/lib/theme"

// ── Nav groups ────────────────────────────────────────────────
const NAV_GROUPS = [
  {
    label: "TRADE",
    items: [
      { href: "/dashboard",  icon: LayoutDashboard, label: "Dashboard",  badge: null },
      { href: "/signaux",    icon: TrendingUp,      label: "Signaux IA", badge: "LIVE" as const },
      { href: "/analyses",   icon: BarChart2,       label: "Analyses",   badge: null },
      { href: "/portfolio",  icon: Briefcase,       label: "Portfolio",  badge: null },
      { href: "/news",       icon: Newspaper,       label: "Actualités", badge: null },
    ],
  },
  {
    label: "APPRENDRE",
    items: [
      { href: "/apprendre",  icon: BookOpen,        label: "Académie",   badge: null },
      { href: "/communaute", icon: MessageSquare,   label: "Communauté", badge: null },
      { href: "/coach",      icon: Bot,             label: "Coach IA",   badge: null },
    ],
  },
  {
    label: "OUTILS",
    items: [
      { href: "/watchlist",  icon: Star,            label: "Watchlist",  badge: null },
      { href: "/compare",    icon: GitCompare,      label: "Comparer",   badge: null },
    ],
  },
]

const BOTTOM_NAV = [
  { href: "/notifications",icon: Bell,     label: "Notifications" },
  { href: "/parametres",   icon: Settings, label: "Paramètres" },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { t }    = useLanguage()
  const { theme, toggle: toggleTheme } = useTheme()

  const [expanded,      setExpanded]      = useState(true)
  const [moreOpen,      setMoreOpen]      = useState(false) // kept for compat but unused
  const [user,          setUser]          = useState<any>(null)
  const [plan,          setPlan]          = useState("free")
  const [profile,       setProfile]       = useState<{ username: string; xp: number; avatar_color: string } | null>(null)
  const [avatarUrl,     setAvatarUrl]     = useState<string | null>(null)
  const [profileLoaded, setProfileLoaded] = useState(false)
  const [unreadNotifs,  setUnreadNotifs]  = useState(0)
  const [strongCount,   setStrongCount]   = useState(0)
  const [learnProgress, setLearnProgress] = useState(0)

  // Restore sidebar state
  useEffect(() => {
    const stored = localStorage.getItem("sidebar_expanded")
    if (stored !== null) setExpanded(stored === "true")
  }, [])

  useEffect(() => {
    document.documentElement.style.setProperty("--sidebar-w", expanded ? "220px" : "60px")
  }, [expanded])

  function toggle() {
    setExpanded(e => {
      const next = !e
      localStorage.setItem("sidebar_expanded", String(next))
      if (!next) setMoreOpen(false)
      return next
    })
  }

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      setUser(data.user)

      const [profileRes, planRes, notifRes, progressRes] = await Promise.all([
        supabase.from("user_profiles").select("username,xp,avatar_color,avatar_url,level_name").eq("id", data.user.id).single(),
        supabase.from("profiles").select("plan").eq("id", data.user.id).single(),
        supabase.from("user_notifications").select("*", { count: "exact", head: true }).eq("user_id", data.user.id).eq("read", false),
        supabase.from("user_progress").select("chapter_id").eq("user_id", data.user.id).eq("completed", true),
      ])

      if (profileRes.data) {
        setProfile({
          username:    profileRes.data.username ?? data.user.email?.split("@")[0] ?? "Trader",
          xp:          profileRes.data.xp ?? 0,
          avatar_color: profileRes.data.avatar_color ?? "#22c55e",
        })
        if (profileRes.data.avatar_url) setAvatarUrl(profileRes.data.avatar_url)
      }
      if (planRes.data?.plan) setPlan(planRes.data.plan)
      setUnreadNotifs(notifRes.count ?? 0)
      const total = getTotalChapters()
      if (progressRes.data && total > 0) setLearnProgress(Math.round((progressRes.data.length / total) * 100))
      setProfileLoaded(true)
    })

    fetch("/api/signals").then(r => r.json())
      .then(d => setStrongCount((d?.signals ?? []).filter((s: any) => s.strength === "strong").length))
      .catch(() => {})

    const { data: listener } = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null))
    return () => listener.subscription.unsubscribe()
  }, [])

  // Realtime XP sync
  useEffect(() => {
    if (!user) return
    const ch = supabase.channel("sidebar-xp")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "user_profiles", filter: `id=eq.${user.id}` },
        (p: any) => {
          setProfile(prev => prev ? { ...prev, xp: p.new?.xp ?? prev.xp } : prev)
          if (p.new?.avatar_url != null) setAvatarUrl(p.new.avatar_url || null)
        })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [user])

  async function handleLogout() {
    await supabase.auth.signOut()
    document.cookie = "onboarding_done=; path=/; max-age=0"
    window.location.href = "/"
  }

  const PUBLIC_PATHS = ["/", "/login", "/signup", "/onboarding", "/pricing", "/preuves"]
  if (!user || PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + "/"))) return null

  const levelInfo = getLevelInfo(profile?.xp ?? 0)
  const initial   = (profile?.username ?? user?.email ?? "?")[0]?.toUpperCase()

  function isActive(href: string) {
    return pathname === href || (href !== "/" && pathname.startsWith(href + "/"))
  }


  return (
    <aside
      className="fixed top-0 left-0 bottom-0 z-50 hidden md:flex flex-col overflow-hidden"
      style={{
        width: expanded ? "220px" : "60px",
        background: "var(--bg-canvas)",
        borderRight: "1px solid var(--border-faint)",
        transition: "width 220ms var(--ease-spring)",
      }}>

      {/* ── Logo / Toggle ────────────────────────────────────── */}
      <button
        onClick={toggle}
        className="flex items-center h-[56px] border-b w-full flex-shrink-0 group"
        style={{
          borderColor: "var(--border-faint)",
          padding: expanded ? "0 14px" : "0",
          justifyContent: expanded ? "flex-start" : "center",
          transition: "padding 220ms var(--ease-spring)",
        }}>
        {/* Logo mark */}
        <div className="flex-shrink-0 w-7 h-7 rounded-[9px] flex items-center justify-center"
          style={{
            background: "linear-gradient(135deg, #22c55e, #15803d)",
            boxShadow: "0 2px 10px rgba(34,197,94,0.35), inset 0 1px 0 rgba(255,255,255,0.2)",
          }}>
          <span className="text-white font-black text-[11px]">T</span>
        </div>
        {expanded && (
          <div className="flex items-center justify-between flex-1 ml-2.5 overflow-hidden">
            <span className="text-[15px] font-bold text-white tracking-tight leading-none">Tradex</span>
            <ChevronLeft size={13} className="text-white/20 group-hover:text-white/45 transition-colors flex-shrink-0" />
          </div>
        )}
        {!expanded && (
          <ChevronRight size={11} className="absolute right-1 top-1/2 -translate-y-1/2 text-white/20 group-hover:text-white/45 transition-colors" />
        )}
      </button>

      {/* ── Nav groups ───────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide"
        style={{ padding: "8px 6px" }}>

        <div className="space-y-4">
          {NAV_GROUPS.map(group => (
            <div key={group.label}>
              {/* Group label (only when expanded) */}
              {expanded && (
                <p className="px-3 pb-1 text-[9px] font-black uppercase tracking-[0.12em]"
                  style={{ color: "var(--text-muted)" }}>
                  {group.label}
                </p>
              )}
              {!expanded && <div className="h-px mx-2 mb-1" style={{ background: "var(--border-faint)" }} />}

              <div className="space-y-0.5">
                {group.items.map(item => {
                  const active = isActive(item.href)
                  const Icon   = item.icon
                  const showDot = item.href === "/signaux" && strongCount > 0

                  return (
                    <a key={item.href} href={item.href}
                      className={cn(
                        "relative flex items-center gap-2.5 rounded-xl group",
                        "transition-all duration-150",
                        expanded ? "px-3 py-2" : "justify-center py-2.5 px-0",
                        active ? "text-green-400" : ""
                      )}
                      style={active ? {
                        background: "rgba(34,197,94,0.08)",
                        border: "1px solid rgba(34,197,94,0.14)",
                        color: "var(--green-light)",
                      } : {
                        background: "transparent",
                        border: "1px solid transparent",
                        color: "var(--text-secondary)",
                      }}>

                      {/* Active bar */}
                      {active && expanded && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[18px] rounded-r-full"
                          style={{ background: "var(--green-light)" }} />
                      )}

                      {/* Icon */}
                      <div className="relative flex-shrink-0">
                        <Icon size={16} strokeWidth={active ? 2.2 : 1.8} />
                        {item.badge === "LIVE" && (
                          <span className="absolute -top-[5px] -right-[5px] text-[6px] font-black px-1 rounded-full text-black leading-[10px]"
                            style={{ background: "#4ade80" }}>
                            LIVE
                          </span>
                        )}
                        {showDot && !item.badge && (
                          <span className="absolute -top-[4px] -right-[4px] w-[8px] h-[8px] rounded-full bg-red-500 border border-[var(--bg-canvas)]" />
                        )}
                      </div>

                      {/* Label */}
                      {expanded && (
                        <span className={cn("text-[13px] font-medium truncate flex-1", active && "font-semibold")}>
                          {item.label}
                        </span>
                      )}

                      {/* Badges */}
                      {expanded && item.href === "/signaux" && strongCount > 0 && (
                        <span className="ml-auto text-[9px] font-black px-1.5 py-0.5 rounded-full text-black"
                          style={{ background: "#4ade80" }}>
                          {strongCount > 9 ? "9+" : strongCount}
                        </span>
                      )}
                      {expanded && item.href === "/apprendre" && learnProgress > 0 && (
                        <span className="ml-auto text-[9px] font-semibold" style={{ color: "var(--green-light)" }}>
                          {learnProgress}%
                        </span>
                      )}

                      {/* Tooltip (collapsed) */}
                      {!expanded && (
                        <div className="absolute left-full ml-2.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-white whitespace-nowrap z-50 opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity"
                          style={{
                            background: "var(--bg-elevated)",
                            border: "1px solid var(--border-default)",
                            boxShadow: "var(--shadow-md)",
                          }}>
                          {item.label}
                        </div>
                      )}
                    </a>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </nav>

      {/* ── Pro upgrade banner ───────────────────────────────── */}
      {expanded && plan === "free" && (
        <div className="mx-2 mb-2">
          <a href="/pricing"
            className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 group transition-all hover:brightness-110"
            style={{
              background: "linear-gradient(135deg, rgba(34,197,94,0.10), rgba(34,197,94,0.06))",
              border: "1px solid rgba(34,197,94,0.20)",
            }}>
            <Zap size={13} className="flex-shrink-0" style={{ color: "var(--green-light)" }} />
            <div className="min-w-0">
              <p className="text-[12px] font-bold leading-tight" style={{ color: "var(--green-light)" }}>
                Passer à Pro
              </p>
              <p className="text-[10px] leading-tight" style={{ color: "var(--text-tertiary)" }}>
                Signaux illimités · API
              </p>
            </div>
          </a>
        </div>
      )}

      {/* ── Footer: theme + settings + user ─────────────────── */}
      <div className="flex-shrink-0 border-t"
        style={{ borderColor: "var(--border-faint)", padding: "8px 6px" }}>

        {/* Theme toggle + settings */}
        <div className={cn("flex mb-1.5", expanded ? "gap-1" : "flex-col gap-1")}>
          <button onClick={toggleTheme}
            className={cn(
              "flex items-center justify-center rounded-xl transition-all hover:text-white/70 text-white/30",
              expanded ? "flex-1 h-8" : "h-8 w-full"
            )}
            style={{ background: "var(--bg-hover)", border: "1px solid var(--border-faint)" }}
            title={theme === "dark" ? "Mode clair" : "Mode sombre"}>
            <span className="text-sm">{theme === "dark" ? "☀️" : "🌙"}</span>
          </button>

          {[
            { href: "/notifications", icon: Bell,     label: "Notifications" },
            { href: "/parametres",    icon: Settings,  label: "Paramètres" },
          ].map(item => {
            const Icon   = item.icon
            const active = isActive(item.href)
            return (
              <a key={item.href} href={item.href}
                className={cn(
                  "flex items-center justify-center rounded-xl transition-all relative group",
                  expanded ? "flex-1 h-8" : "h-8 w-full",
                  active ? "text-white/70" : "text-white/28 hover:text-white/60"
                )}
                style={{
                  background: active ? "var(--bg-active)" : "var(--bg-hover)",
                  border: `1px solid ${active ? "var(--border-subtle)" : "var(--border-faint)"}`,
                }}>
                <div className="relative">
                  <Icon size={14} strokeWidth={1.8} />
                  {item.href === "/notifications" && unreadNotifs > 0 && (
                    <span className="absolute -top-[4px] -right-[4px] w-[7px] h-[7px] rounded-full bg-red-500 border border-[var(--bg-canvas)]" />
                  )}
                </div>
                {!expanded && (
                  <div className="absolute left-full ml-2 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-white whitespace-nowrap z-50 opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity"
                    style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)", boxShadow: "var(--shadow-md)" }}>
                    {item.label}
                  </div>
                )}
              </a>
            )
          })}
        </div>

        {/* User row */}
        <a href="/profil"
          className={cn(
            "flex items-center rounded-xl transition-all hover:bg-white/[0.04] group",
            expanded ? "gap-2.5 px-2 py-2" : "justify-center py-2"
          )}>
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            {!profileLoaded ? (
              <div className="w-7 h-7 rounded-full skeleton" />
            ) : avatarUrl ? (
              <img src={avatarUrl} alt="avatar"
                className="w-7 h-7 rounded-full object-cover ring-1 ring-white/10" />
            ) : (
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black text-black ring-1 ring-white/10"
                style={{ background: profile?.avatar_color ?? "var(--green)" }}>
                {initial}
              </div>
            )}
            {/* Online dot */}
            <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-[1.5px]"
              style={{ background: "var(--green)", borderColor: "var(--bg-canvas)" }} />
          </div>

          {expanded && profileLoaded && (
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold text-white truncate leading-tight">
                {profile?.username ?? user?.email?.split("@")[0]}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                {levelInfo && (
                  <span className="text-[9px] font-bold" style={{ color: levelInfo.color }}>
                    {levelInfo.icon} {levelInfo.name}
                  </span>
                )}
                {plan !== "free" && (
                  <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full"
                    style={{
                      background: plan === "premium" ? "rgba(251,191,36,0.15)" : "rgba(34,197,94,0.12)",
                      color: plan === "premium" ? "#fbbf24" : "#4ade80",
                    }}>
                    {plan.toUpperCase()}
                  </span>
                )}
              </div>
              {/* XP bar */}
              {levelInfo && (
                <div className="mt-1.5 h-[2px] rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
                  <div className="h-full rounded-full"
                    style={{ width: `${levelInfo.progress}%`, background: levelInfo.color, transition: "width 0.7s var(--ease-spring)" }} />
                </div>
              )}
            </div>
          )}
        </a>

        {/* Logout */}
        {expanded && (
          <button onClick={handleLogout}
            className="flex items-center gap-2 w-full px-2 py-1.5 mt-1 rounded-xl text-[11px] font-medium transition-all text-white/20 hover:text-red-400/70 hover:bg-red-500/[0.05]">
            <LogOut size={12} />
            Déconnexion
          </button>
        )}
      </div>
    </aside>
  )
}
