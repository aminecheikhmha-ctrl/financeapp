"use client"

import { useState, useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { getLevelInfo } from "@/lib/achievements"
import { getTotalChapters } from "@/lib/courses"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard, TrendingUp, Briefcase, BookOpen,
  Newspaper, MessageSquare, BarChart2, Star,
  GitCompare, Trophy, Settings, LogOut, ChevronLeft,
  Bot, FileText, Bell, Zap, Users,
} from "lucide-react"

const NAV_ITEMS = [
  { href: "/dashboard",    icon: LayoutDashboard, label: "Dashboard",    group: "principal" },
  { href: "/signaux",      icon: TrendingUp,      label: "Signaux IA",   group: "principal", badge: "LIVE" },
  { href: "/analyses",     icon: BarChart2,        label: "Analyses",     group: "principal" },
  { href: "/portfolio",    icon: Briefcase,        label: "Portfolio",    group: "principal" },
  { href: "/watchlist",    icon: Star,             label: "Watchlist",    group: "principal" },
  { href: "/news",         icon: Newspaper,        label: "Actualités",   group: "principal" },
  { href: "/apprendre",    icon: BookOpen,         label: "Académie",     group: "apprendre" },
  { href: "/forum",        icon: MessageSquare,    label: "Forum",        group: "apprendre" },
  { href: "/coach",        icon: Bot,              label: "Coach IA",     group: "apprendre" },
  { href: "/social",       icon: Users,            label: "Social",       group: "apprendre", soon: true },
  { href: "/reports",      icon: FileText,         label: "Rapports",     group: "outils" },
  { href: "/compare",      icon: GitCompare,       label: "Comparer",     group: "outils" },
  { href: "/profil",       icon: Trophy,           label: "Profil",       group: "compte" },
  { href: "/notifications",icon: Bell,             label: "Notifications",group: "compte" },
  { href: "/parametres",   icon: Settings,         label: "Paramètres",   group: "compte" },
] as const

type NavItem = typeof NAV_ITEMS[number]

const GROUPS = [
  { key: "principal", label: "Principal" },
  { key: "apprendre", label: "Apprendre" },
  { key: "outils",    label: "Outils" },
  { key: "compte",    label: "Compte" },
] as const

export default function Sidebar() {
  const pathname = usePathname()
  const router   = useRouter()

  const [expanded,      setExpanded]      = useState(false)
  const [user,          setUser]          = useState<any>(null)
  const [plan,          setPlan]          = useState("free")
  const [profile,       setProfile]       = useState<{ username: string; xp: number; streak_days: number } | null>(null)
  const [avatarUrl,     setAvatarUrl]     = useState<string | null>(null)
  const [unreadNotifs,  setUnreadNotifs]  = useState(0)
  const [strongCount,   setStrongCount]   = useState(0)
  const [learnProgress, setLearnProgress] = useState(0)
  const [forumCount,    setForumCount]    = useState(0)

  // Restore from localStorage after hydration
  useEffect(() => {
    const stored = localStorage.getItem("sidebar_expanded")
    if (stored !== null) setExpanded(stored === "true")
  }, [])

  // Keep CSS variable in sync — valeurs hardcodées, pas de var() dans var()
  useEffect(() => {
    document.documentElement.style.setProperty("--sidebar-w", expanded ? "220px" : "64px")
  }, [expanded])

  function toggle() {
    setExpanded(e => {
      const next = !e
      localStorage.setItem("sidebar_expanded", String(next))
      return next
    })
  }

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      setUser(data.user)

      const [profileRes, planRes, notifRes, progressRes] = await Promise.all([
        supabase
          .from("user_profiles")
          .select("username, xp, streak_days, avatar_url, level_name, level")
          .eq("id", data.user.id)
          .single(),
        supabase.from("profiles").select("plan").eq("id", data.user.id).single(),
        supabase
          .from("user_notifications")
          .select("*", { count: "exact", head: true })
          .eq("user_id", data.user.id)
          .eq("read", false),
        supabase
          .from("user_progress")
          .select("chapter_id")
          .eq("user_id", data.user.id)
          .eq("completed", true),
      ])

      if (profileRes.data) {
        setProfile({
          username:    profileRes.data.username ?? "",
          xp:          profileRes.data.xp ?? 0,
          streak_days: profileRes.data.streak_days ?? 0,
        })
        if (profileRes.data.avatar_url) setAvatarUrl(profileRes.data.avatar_url)
      }
      if (planRes.data?.plan) setPlan(planRes.data.plan)
      setUnreadNotifs(notifRes.count ?? 0)

      const total = getTotalChapters()
      if (progressRes.data && total > 0) {
        setLearnProgress(Math.round((progressRes.data.length / total) * 100))
      }
    })

    fetch("/api/signals")
      .then(r => r.json())
      .then(d => setStrongCount(
        (d?.signals ?? []).filter((s: { strength: string }) => s.strength === "strong").length,
      )).catch(() => {})

    fetch("/api/forum/posts?sort=recent&category=all")
      .then(r => r.json())
      .then(d => {
        const cutoff = Date.now() - 24 * 60 * 60 * 1000
        setForumCount(
          (d?.posts ?? []).filter(
            (p: { created_at: string }) => new Date(p.created_at).getTime() > cutoff,
          ).length,
        )
      }).catch(() => {})

    const { data: listener } = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null))
    return () => listener.subscription.unsubscribe()
  }, [])

  // Realtime XP sync
  useEffect(() => {
    if (!user) return
    const channel = supabase
      .channel("sidebar-xp")
      .on("postgres_changes", {
        event: "UPDATE", schema: "public",
        table: "user_profiles", filter: `id=eq.${user.id}`,
      }, (payload: any) => {
        setProfile(prev => prev ? {
          ...prev,
          xp: payload.new?.xp ?? prev.xp,
        } : prev)
        if (payload.new?.avatar_url != null) setAvatarUrl(payload.new.avatar_url || null)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user])

  // Window event for same-tab XP sync
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail?.xp != null) setProfile(prev => prev ? { ...prev, xp: detail.xp } : prev)
    }
    window.addEventListener("xp-updated", handler)
    return () => window.removeEventListener("xp-updated", handler)
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    document.cookie = "onboarding_done=; path=/; max-age=0"
    router.push("/login")
  }

  if (!user || pathname === "/onboarding") return null

  const levelInfo = getLevelInfo(profile?.xp ?? 0)
  const initial   = (profile?.username ?? user?.email ?? "?")[0]?.toUpperCase()

  function badgeFor(item: NavItem): React.ReactNode {
    const href = item.href
    if (href === "/signaux" && strongCount > 0)
      return (
        <span className="ml-auto min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">
          {strongCount > 99 ? "99+" : strongCount}
        </span>
      )
    if (href === "/forum" && forumCount > 0)
      return (
        <span className="ml-auto min-w-[18px] h-[18px] px-1 bg-blue-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">
          {forumCount > 99 ? "99+" : forumCount}
        </span>
      )
    if (href === "/apprendre" && learnProgress > 0)
      return (
        <span className="ml-auto text-[9px] font-semibold text-green-400/70">{learnProgress}%</span>
      )
    if (href === "/notifications" && unreadNotifs > 0)
      return (
        <span className="ml-auto min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">
          {unreadNotifs > 9 ? "9+" : unreadNotifs}
        </span>
      )
    if ((item as any).soon)
      return (
        <span className="ml-auto text-[9px] font-black px-1.5 py-0.5 rounded-md"
          style={{ background: "rgba(251,191,36,0.10)", color: "rgba(251,191,36,0.55)", border: "1px solid rgba(251,191,36,0.15)" }}>
          Bientôt
        </span>
      )
    return null
  }

  return (
    <>
      {/* SIDEBAR */}
      <aside
        className="fixed top-0 left-0 bottom-0 z-50 hidden md:flex flex-col overflow-hidden transition-all duration-200"
        style={{
          width: expanded ? "220px" : "64px",
          background: "#080808",
          borderRight: "1px solid rgba(255,255,255,0.06)",
        }}>

        {/* Logo — toute la zone cliquable pour toggle */}
        <button
          onClick={toggle}
          aria-label={expanded ? "Réduire la sidebar" : "Agrandir la sidebar"}
          className="flex items-center h-14 px-3 border-b flex-shrink-0 w-full transition-colors hover:bg-white/[0.03] group"
          style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-2.5 w-full">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center flex-shrink-0 shadow-md shadow-green-500/20">
              <span className="text-white font-black text-[11px]">T</span>
            </div>
            {expanded && (
              <>
                <span className="font-bold text-[15px] text-white tracking-tight flex-1 text-left">Tradex</span>
                <ChevronLeft size={14} className="text-white/20 group-hover:text-white/50 transition-colors flex-shrink-0" />
              </>
            )}
          </div>
        </button>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 scrollbar-hide">
          {GROUPS.map(group => {
            const items = NAV_ITEMS.filter(item => item.group === group.key)
            return (
              <div key={group.key} className="mb-1">
                {expanded && (
                  <p className="text-[9px] text-white/20 uppercase tracking-widest font-bold px-4 py-2">
                    {group.label}
                  </p>
                )}
                {items.map(item => {
                  const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
                  const Icon     = item.icon
                  const isSoon   = !!(item as any).soon

                  return (
                    <a
                      key={item.href}
                      href={isSoon ? undefined : item.href}
                      onClick={isSoon ? (e: React.MouseEvent) => e.preventDefault() : undefined}
                      className={cn(
                        "relative flex items-center gap-3 mx-2 py-2 rounded-xl transition-all duration-150 group",
                        expanded ? "px-2.5" : "justify-center px-0",
                        isActive
                          ? "bg-green-500/10 text-green-400"
                          : isSoon
                          ? "text-white/20 cursor-not-allowed"
                          : "text-white/40 hover:text-white/75 hover:bg-white/[0.04]",
                      )}>

                      {/* Active indicator bar */}
                      {isActive && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full bg-green-400" />
                      )}

                      {/* Icon */}
                      <div className="relative flex-shrink-0">
                        <Icon size={17} strokeWidth={isActive ? 2.2 : 1.7} />
                        {(item as any).badge === "LIVE" && isActive && expanded && (
                          <span className="absolute -top-1 -right-1 text-[7px] font-black px-1 rounded-full text-black bg-green-400">
                            LIVE
                          </span>
                        )}
                      </div>

                      {/* Label + badge */}
                      {expanded && (
                        <>
                          <span className="text-[13px] font-medium truncate flex-1">{item.label}</span>
                          {badgeFor(item)}
                        </>
                      )}

                      {/* Tooltip when collapsed */}
                      {!expanded && (
                        <div className="absolute left-full ml-2 px-2.5 py-1 rounded-lg text-xs font-semibold text-white whitespace-nowrap z-50 opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity"
                          style={{ background: "#111", border: "1px solid var(--border-default)" }}>
                          {item.label}
                        </div>
                      )}
                    </a>
                  )
                })}
              </div>
            )
          })}
        </nav>

        {/* Upgrade to Pro */}
        {expanded && plan === "free" && (
          <div className="px-3 pb-2">
            <a href="/pricing"
              className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 transition-all hover:opacity-90"
              style={{ background: "var(--green-dim)", border: "1px solid var(--green-border)" }}>
              <Zap size={14} style={{ color: "var(--green-bright)", flexShrink: 0 }} />
              <div>
                <p className="text-[12px] font-bold" style={{ color: "var(--green-bright)" }}>Passer à Pro</p>
                <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Signaux illimités · IA</p>
              </div>
            </a>
          </div>
        )}

        {/* XP bar + user row */}
        <div className="flex-shrink-0 border-t p-3 space-y-2"
          style={{ borderColor: "var(--border-dim)" }}>

          {/* XP bar (expanded only) */}
          {expanded && levelInfo && (
            <div className="px-1">
              <div className="flex items-center justify-between text-[10px] mb-1.5">
                <span className="font-black" style={{ color: levelInfo.color }}>
                  {levelInfo.icon} {levelInfo.name}
                </span>
                <span style={{ color: "var(--text-muted)" }}>
                  {(profile?.xp ?? 0).toLocaleString()} XP
                </span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                <div className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${levelInfo.progress}%`,
                    background: `linear-gradient(90deg, ${levelInfo.color}70, ${levelInfo.color})`,
                    boxShadow: `0 0 6px ${levelInfo.color}60`,
                  }} />
              </div>
              {levelInfo.nextLevel && levelInfo.nextLevelXP && (
                <p className="text-[9px] mt-1" style={{ color: "var(--text-muted)" }}>
                  {(levelInfo.nextLevelXP - (profile?.xp ?? 0)).toLocaleString()} XP → {levelInfo.nextLevel}
                </p>
              )}
            </div>
          )}

          {/* Level badge (collapsed) */}
          {!expanded && levelInfo && (
            <div className="flex justify-center">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black text-black"
                style={{ background: levelInfo.color }}>
                {levelInfo.level}
              </div>
            </div>
          )}

          {/* User row */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-black text-black flex-shrink-0 overflow-hidden"
              style={{ background: levelInfo?.color ?? "var(--green)" }}>
              {avatarUrl ? (
                <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                initial
              )}
            </div>
            {expanded && (
              <>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-bold text-white truncate">
                    {profile?.username ?? "Trader"}
                  </p>
                  <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                    {profile?.streak_days ? `🔥 ${profile.streak_days}j streak` : levelInfo?.name ?? ""}
                  </p>
                </div>
                <button onClick={handleLogout}
                  className="w-7 h-7 rounded-lg flex items-center justify-center transition-all flex-shrink-0 text-white/25 hover:text-red-400 hover:bg-red-500/10">
                  <LogOut size={13} />
                </button>
              </>
            )}
          </div>
        </div>
      </aside>

      {/* No spacer needed — sidebar-main margin-left via CSS var handles it */}
    </>
  )
}
