"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter, usePathname } from "next/navigation"
import { getTotalChapters } from "@/lib/courses"
import { getLevelFromXP, getXPProgress } from "@/lib/achievements"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard, TrendingUp, BarChart2, Briefcase,
  BookOpen, Users, MessageSquare, FileText, Bot,
  Bell, Settings, ChevronRight, LogOut, Zap, Newspaper,
  Star, GitCompare
} from "lucide-react"

const PRINCIPAL = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard"  },
  { href: "/portfolio", icon: Briefcase,        label: "Portfolio"  },
  { href: "/watchlist", icon: Star,             label: "Watchlist"  },
  { href: "/compare",   icon: GitCompare,       label: "Comparer"   },
  { href: "/signaux",   icon: TrendingUp,       label: "Signaux"    },
  { href: "/analyses",  icon: BarChart2,        label: "Analyses"   },
  { href: "/news",      icon: Newspaper,        label: "News"       },
]

const COMMUNAUTE = [
  { href: "/social",    icon: Users,           label: "Social"    },
  { href: "/apprendre", icon: BookOpen,        label: "Apprendre" },
  { href: "/forum",     icon: MessageSquare,   label: "Forum"     },
  { href: "/reports",   icon: FileText,        label: "Rapports"  },
  { href: "/coach",     icon: Bot,             label: "Coach IA"  },
]

function getLabelForLevel(defaultLabel: string, href: string, level: string): string {
  if (level !== "débutant") return defaultLabel
  const map: Record<string, string> = {
    "/dashboard": "Mon tableau de bord",
    "/portfolio": "Mon portefeuille",
    "/signaux": "Signaux",
    "/analyses": "Analyses",
    "/news": "Actualités",
    "/social": "Communauté",
    "/apprendre": "Apprendre",
    "/forum": "Forum",
    "/reports": "Mes rapports",
  }
  return map[href] ?? defaultLabel
}

interface NavItemProps {
  href: string
  Icon: React.ElementType
  label: string
  active: boolean
  collapsed: boolean
  badge?: React.ReactNode
}

function NavItem({ href, Icon, label, active, collapsed, badge }: NavItemProps) {
  return (
    <a
      href={href}
      className={cn(
        "relative flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-150 group",
        active
          ? "bg-white/8 text-white"
          : "text-white/40 hover:text-white/80 hover:bg-white/4",
        collapsed && "justify-center px-0"
      )}
    >
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-full bg-green-400" />
      )}
      <Icon
        size={16}
        className={cn(
          "flex-shrink-0 transition-colors",
          active ? "text-white" : "text-white/40 group-hover:text-white/70"
        )}
      />
      {!collapsed && (
        <span className={cn("text-[13px] truncate flex-1 font-medium", active && "font-semibold text-white")}>
          {label}
        </span>
      )}
      {!collapsed && badge}
      {/* Tooltip shown only when sidebar is collapsed */}
      {collapsed && (
        <span className="pointer-events-none absolute left-full ml-2 top-1/2 -translate-y-1/2 z-[999] whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[12px] font-semibold text-white opacity-0 group-hover:opacity-100 transition-opacity duration-150 shadow-lg"
          style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)" }}>
          {label}
        </span>
      )}
    </a>
  )
}

export default function Sidebar() {
  const router   = useRouter()
  const pathname = usePathname()

  const [user,          setUser]          = useState<any>(null)
  const [plan,          setPlan]          = useState("free")
  const [collapsed,     setCollapsed]     = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("sidebar_collapsed") !== "false"
    }
    return true
  })
  const [strongCount,   setStrongCount]   = useState(0)
  const [learnProgress, setLearnProgress] = useState(0)
  const [forumCount,    setForumCount]    = useState(0)
  const [username,      setUsername]      = useState<string | null>(null)
  const [avatarColor,   setAvatarColor]   = useState("#4ade80")
  const [xp,            setXp]            = useState(0)
  const [levelName,     setLevelName]     = useState("Novice")
  const [userLevel,     setUserLevel]     = useState<string>("")

  // Sync --sidebar-w CSS variable so Topbar + main content shift together
  useEffect(() => {
    const w = collapsed ? "64px" : "220px"
    document.documentElement.style.setProperty("--sidebar-w", w)
  }, [collapsed])

  function toggleCollapsed() {
    setCollapsed(c => {
      const next = !c
      localStorage.setItem("sidebar_collapsed", String(next))
      return next
    })
  }

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      setUser(data.user)
      const { data: profile } = await supabase
        .from("profiles").select("plan").eq("email", data.user.email).single()
      if (profile) setPlan(profile.plan)

      const { data: up } = await supabase
        .from("user_profiles")
        .select("username, avatar_color, xp, level_name, level")
        .eq("id", data.user.id)
        .single()
      if (up) {
        if (up.username)     setUsername(up.username)
        if (up.avatar_color) setAvatarColor(up.avatar_color)
        if (up.xp != null)   setXp(up.xp)
        if (up.level_name)   setLevelName(up.level_name)
        if (up.level)        setUserLevel(up.level)
      }
    })

    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      const { data: rows } = await supabase
        .from("user_progress").select("chapter_id")
        .eq("user_id", data.user.id).eq("completed", true)
      const total = getTotalChapters()
      if (rows && total > 0) setLearnProgress(Math.round((rows.length / total) * 100))
    })

    fetch("/api/forum/posts?sort=recent&category=all")
      .then(r => r.json())
      .then(d => {
        const cutoff = Date.now() - 24 * 60 * 60 * 1000
        setForumCount((d?.posts ?? []).filter(
          (p: { created_at: string }) => new Date(p.created_at).getTime() > cutoff
        ).length)
      }).catch(() => {})

    fetch("/api/signals")
      .then(r => r.json())
      .then(d => setStrongCount(
        (d?.signals ?? []).filter((s: { strength: string }) => s.strength === "strong").length
      )).catch(() => {})

    const { data: listener } = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null))
    return () => listener.subscription.unsubscribe()
  }, [])

  // Window event listener for same-tab XP sync
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail?.xp != null) setXp(detail.xp)
    }
    window.addEventListener("xp-updated", handler)
    return () => window.removeEventListener("xp-updated", handler)
  }, [])

  // Supabase realtime subscription for cross-tab XP sync
  useEffect(() => {
    if (!user) return
    const channel = supabase
      .channel("xp-updates")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "user_profiles",
          filter: `id=eq.${user.id}`,
        },
        (payload: any) => {
          if (payload.new?.xp != null)        setXp(payload.new.xp)
          if (payload.new?.level_name)         setLevelName(payload.new.level_name)
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user])

  async function handleLogout() {
    await supabase.auth.signOut()
    document.cookie = "onboarding_done=; path=/; max-age=0"
    router.push("/")
  }

  if (!user || pathname === "/onboarding") return null

  const xpPct  = getXPProgress(xp)
  const level  = getLevelFromXP(xp)
  const initial = (username ?? user?.email ?? "?")[0]?.toUpperCase()

  function badgeFor(href: string) {
    if (href === "/signaux" && strongCount > 0)
      return (
        <span className="ml-auto min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
          {strongCount > 99 ? "99+" : strongCount}
        </span>
      )
    if (href === "/forum" && forumCount > 0)
      return (
        <span className="ml-auto min-w-[18px] h-[18px] px-1 bg-blue-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
          {forumCount > 99 ? "99+" : forumCount}
        </span>
      )
    if (href === "/apprendre" && learnProgress > 0)
      return (
        <span className="ml-auto text-[10px] font-semibold text-green-400/70">
          {learnProgress}%
        </span>
      )
    if (href === "/analyses")
      return (
        <span className="ml-auto">
          <span className="live-dot" style={{ width: 6, height: 6 }} />
        </span>
      )
    return null
  }

  const w = collapsed ? "w-16" : "w-[220px]"

  return (
    <aside
      className={cn(
        "hidden md:flex fixed left-0 top-0 h-screen flex-col z-50 transition-all duration-200",
        w
      )}
      style={{ background: "#080808", borderRight: "1px solid rgba(255,255,255,0.06)", overflow: collapsed ? "visible" : "hidden" }}
    >
      {/* Logo */}
      <div className={cn(
        "flex items-center h-14 flex-shrink-0 border-b px-3",
        "border-white/[0.06]",
        collapsed ? "justify-center" : "gap-2.5"
      )}>
        <button
          onClick={toggleCollapsed}
          className="flex items-center gap-2.5 group"
          aria-label={collapsed ? "Agrandir" : "Réduire"}
        >
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center flex-shrink-0 shadow-md shadow-green-500/20">
            <span className="text-white font-black text-[11px]">T</span>
          </div>
          {!collapsed && (
            <span className="font-bold text-[15px] text-white tracking-tight">TradEx</span>
          )}
        </button>
        {!collapsed && (
          <button onClick={toggleCollapsed} className="ml-auto text-white/20 hover:text-white/50 transition p-1 rounded">
            <ChevronRight size={14} />
          </button>
        )}
      </div>

      {/* Nav — overflow-x visible so tooltips can peek out */}
      <nav className={cn("flex-1 py-3 overflow-y-auto", collapsed ? "px-2 overflow-x-visible" : "px-2 overflow-x-hidden")}>
        {collapsed && (
          <button
            onClick={toggleCollapsed}
            className="w-full flex justify-center py-1.5 mb-2 text-white/20 hover:text-white/50 transition"
            aria-label="Agrandir"
          >
            <ChevronRight size={14} />
          </button>
        )}

        {!collapsed && (
          <p className="text-[10px] font-semibold text-white/20 uppercase tracking-widest px-3 mb-1.5">Principal</p>
        )}
        <div className="space-y-0.5 mb-4">
          {PRINCIPAL.map(item => (
            <NavItem
              key={item.href}
              href={item.href}
              Icon={item.icon}
              label={getLabelForLevel(item.label, item.href, userLevel)}
              active={pathname === item.href || pathname.startsWith(item.href + "/")}
              collapsed={collapsed}
              badge={badgeFor(item.href)}
            />
          ))}
        </div>

        {!collapsed && (
          <p className="text-[10px] font-semibold text-white/20 uppercase tracking-widest px-3 mb-1.5">Communauté</p>
        )}
        {!collapsed && <div className="w-full h-px bg-white/[0.05] mb-3" />}
        <div className="space-y-0.5">
          {COMMUNAUTE.map(item => (
            <NavItem
              key={item.href}
              href={item.href}
              Icon={item.icon}
              label={getLabelForLevel(item.label, item.href, userLevel)}
              active={pathname === item.href || pathname.startsWith(item.href + "/")}
              collapsed={collapsed}
              badge={badgeFor(item.href)}
            />
          ))}
        </div>
      </nav>

      {/* XP bar */}
      {!collapsed && (
        <div className="px-3 py-3 border-t border-white/[0.05]">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-medium text-white/30">{level.icon} {levelName}</span>
            <span className="text-[11px] text-white/20 tabular-nums">{xp} XP</span>
          </div>
          <div className="h-1 rounded-full overflow-hidden bg-white/[0.06]">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${xpPct}%`, background: "linear-gradient(90deg, #22c55e, #4ade80)", boxShadow: "0 0 6px rgba(74,222,128,0.4)" }}
            />
          </div>
        </div>
      )}

      {/* Bottom actions */}
      <div className={cn("px-2 py-2 space-y-0.5 border-t border-white/[0.05]", collapsed && "flex flex-col items-center")}>
        <button
          aria-label="Notifications"
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-lg text-white/35 hover:text-white/70 hover:bg-white/4 transition-all w-full",
            collapsed && "justify-center px-0 w-10"
          )}
        >
          <Bell size={16} className="flex-shrink-0" />
          {!collapsed && <span className="text-[13px] font-medium">Notifications</span>}
        </button>
        <a
          href="/parametres"
          aria-label="Paramètres"
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-lg transition-all",
            collapsed && "justify-center px-0 w-10",
            pathname.startsWith("/parametres") ? "text-white bg-white/8" : "text-white/35 hover:text-white/70 hover:bg-white/4"
          )}
        >
          <Settings size={16} className="flex-shrink-0" />
          {!collapsed && <span className="text-[13px] font-medium">Paramètres</span>}
        </a>
      </div>

      {/* Upgrade */}
      {!collapsed && plan === "free" && (
        <div className="px-3 pb-2">
          <a
            href="/pricing"
            className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 transition-all hover:opacity-90"
            style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.18)" }}
          >
            <Zap size={14} className="text-green-400 flex-shrink-0" />
            <div>
              <p className="text-[12px] font-semibold text-green-400">Passer à Pro</p>
              <p className="text-[11px] text-white/30">Signaux illimités · IA</p>
            </div>
          </a>
        </div>
      )}

      {/* User row */}
      <div className={cn(
        "px-3 py-3 border-t border-white/[0.05]",
        collapsed ? "flex justify-center" : "flex items-center gap-2"
      )}>
        {!collapsed ? (
          <>
            <a href="/profil" className="flex items-center gap-2 flex-1 min-w-0 group">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-bold text-black group-hover:ring-2 group-hover:ring-green-400/30 transition-all"
                style={{ backgroundColor: avatarColor }}
              >
                {initial}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-white/80 truncate group-hover:text-white transition">{username ?? user?.email}</p>
                <p className="text-[11px] text-white/25">{levelName}</p>
              </div>
            </a>
            <button
              onClick={handleLogout}
              aria-label="Se déconnecter"
              className="text-white/20 hover:text-red-400 transition p-1 rounded flex-shrink-0"
            >
              <LogOut size={14} />
            </button>
          </>
        ) : (
          <button
            onClick={handleLogout}
            aria-label="Se déconnecter"
            className="text-white/20 hover:text-red-400 transition p-1 rounded"
          >
            <LogOut size={14} />
          </button>
        )}
      </div>
    </aside>
  )
}
