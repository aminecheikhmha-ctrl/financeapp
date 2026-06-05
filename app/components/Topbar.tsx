"use client"

import { useState, useEffect, useRef } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Bell, Search } from "lucide-react"
import { supabase } from "@/lib/supabase"
import GlobalSearch from "@/app/components/GlobalSearch"
import { useLanguage } from "@/lib/i18n/context"
import { useTheme } from "@/lib/theme"
import { cn } from "@/lib/utils"

const PUBLIC_ROUTES = ["/", "/login", "/signup", "/onboarding", "/pricing", "/preuves"]

const PAGE_META: Record<string, { label: string; emoji?: string }> = {
  "/dashboard":    { label: "Dashboard",     emoji: "📊" },
  "/signaux":      { label: "Signaux IA",    emoji: "📡" },
  "/analyses":     { label: "Analyses",      emoji: "🔍" },
  "/portfolio":    { label: "Portfolio",     emoji: "💼" },
  "/watchlist":    { label: "Watchlist",     emoji: "⭐" },
  "/news":         { label: "News",          emoji: "📰" },
  "/apprendre":    { label: "Académie",      emoji: "🎓" },
  "/forum":        { label: "Forum",         emoji: "💬" },
  "/coach":        { label: "Coach IA",      emoji: "🤖" },
  "/social":       { label: "Social",        emoji: "👥" },
  "/reports":      { label: "Rapports",      emoji: "📈" },
  "/compare":      { label: "Comparateur",   emoji: "⚖️" },
  "/profil":       { label: "Mon profil",    emoji: "👤" },
  "/notifications":{ label: "Notifications", emoji: "🔔" },
  "/parametres":   { label: "Paramètres",    emoji: "⚙️" },
  "/classement":   { label: "Classement",    emoji: "🏆" },
  "/duel":         { label: "Duels",         emoji: "🥊" },
  "/room":         { label: "Trading Room",  emoji: "💬" },
  "/feed":         { label: "Signal Feed",   emoji: "📱" },
  "/backtest":     { label: "Backtest",      emoji: "📈" },
  "/replay":       { label: "Replay",        emoji: "⏪" },
  "/scanner":      { label: "Scanner",       emoji: "🔍" },
  "/calendrier":   { label: "Calendrier",    emoji: "📅" },
  "/brief":        { label: "Tradex Brief",  emoji: "☀️" },
  "/referral":     { label: "Parrainage",    emoji: "🎁" },
  "/api-docs":     { label: "API Publique",  emoji: "🔌" },
}

export default function Topbar() {
  const pathname = usePathname()
  const router   = useRouter()
  const dropRef  = useRef<HTMLDivElement>(null)
  const { theme, toggle: toggleTheme } = useTheme()

  const [user,         setUser]         = useState<any>(null)
  const [username,     setUsername]     = useState("")
  const [avatarColor,  setAvatarColor]  = useState("#22c55e")
  const [avatarUrl,    setAvatarUrl]    = useState<string | null>(null)
  const [plan,         setPlan]         = useState("free")
  const [xp,           setXp]           = useState(0)
  const [levelName,    setLevelName]    = useState("")
  const [unreadCount,  setUnreadCount]  = useState(0)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [marketOpen,   setMarketOpen]   = useState(false)
  const [profileLoaded,setProfileLoaded]= useState(false)

  const meta = Object.entries(PAGE_META).find(
    ([key]) => pathname === key || pathname.startsWith(key + "/"),
  )?.[1] ?? { label: "Tradex" }

  useEffect(() => {
    const et = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }))
    const day = et.getDay(), mins = et.getHours() * 60 + et.getMinutes()
    setMarketOpen(day >= 1 && day <= 5 && mins >= 570 && mins < 960)

    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      setUser(data.user)
      const [profileRes, planRes, notifRes] = await Promise.all([
        supabase.from("user_profiles").select("username,xp,level_name,avatar_color,avatar_url").eq("id", data.user.id).single(),
        supabase.from("profiles").select("plan").eq("id", data.user.id).single(),
        supabase.from("user_notifications").select("*", { count: "exact", head: true }).eq("user_id", data.user.id).eq("read", false),
      ])
      if (profileRes.data) {
        setUsername(profileRes.data.username ?? data.user.email?.split("@")[0] ?? "")
        setXp(profileRes.data.xp ?? 0)
        setLevelName(profileRes.data.level_name ?? "Novice")
        setAvatarColor(profileRes.data.avatar_color ?? "#22c55e")
        if (profileRes.data.avatar_url) setAvatarUrl(profileRes.data.avatar_url)
      }
      if (planRes.data?.plan) setPlan(planRes.data.plan)
      setUnreadCount(notifRes.count ?? 0)
      setProfileLoaded(true)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null))
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setShowUserMenu(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    document.cookie = "onboarding_done=; path=/; max-age=0"
    window.location.href = "/"
  }

  if (!user || PUBLIC_ROUTES.some(r => pathname === r || pathname.startsWith(r + "/"))) return null

  const initial = (username || user?.email || "?")[0]?.toUpperCase()

  return (
    <header
      className="hidden md:flex items-center gap-3 flex-shrink-0"
      style={{
        position: "fixed",
        top: 0,
        left: "var(--sidebar-w, 60px)",
        right: 0,
        height: "56px",
        zIndex: 40,
        padding: "0 20px",
        background: "rgba(6,10,7,0.88)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        borderBottom: "1px solid var(--border-faint)",
        transition: "left 220ms var(--ease-spring)",
      }}>

      {/* Page title */}
      <div className="flex items-center gap-2 min-w-0 flex-shrink-0">
        {meta.emoji && <span className="text-sm">{meta.emoji}</span>}
        <p className="text-[14px] font-semibold text-white truncate">{meta.label}</p>
        {/* Market status dot */}
        <div className="flex items-center gap-1.5 ml-1">
          <div
            className="w-[6px] h-[6px] rounded-full flex-shrink-0"
            style={{
              background: marketOpen ? "var(--green)" : "rgba(255,255,255,0.18)",
              boxShadow: marketOpen ? "0 0 6px rgba(34,197,94,0.7)" : "none",
              animation: marketOpen ? "live-pulse 2s infinite" : "none",
            }}
          />
          <span className="text-[10px] hidden lg:block" style={{ color: "var(--text-muted)" }}>
            {marketOpen ? "Marché ouvert" : "Fermé"}
          </span>
        </div>
      </div>

      {/* Search */}
      <div className="flex-1 max-w-md">
        <GlobalSearch />
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-1.5 ml-auto">

        {/* Upgrade chip */}
        {plan === "free" && (
          <a href="/pricing"
            className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all hover:scale-[1.02]"
            style={{ background: "var(--green-dim)", color: "var(--green-light)", border: "1px solid var(--green-border)" }}>
            ⚡ Pro
          </a>
        )}

        {/* Notifications */}
        <button onClick={() => router.push("/notifications")}
          className="relative w-8 h-8 rounded-xl flex items-center justify-center transition-all text-white/30 hover:text-white/70 hover:bg-white/[0.06]"
          style={{ border: "1px solid transparent" }}>
          <Bell size={15} />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 w-[7px] h-[7px] bg-red-500 rounded-full border border-[var(--bg-canvas)]" />
          )}
        </button>

        {/* User avatar + dropdown */}
        <div className="relative" ref={dropRef}>
          {!profileLoaded ? (
            <div className="w-7 h-7 rounded-full skeleton flex-shrink-0" />
          ) : (
            <button
              onClick={() => setShowUserMenu(m => !m)}
              className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black text-black transition-all hover:scale-105 overflow-hidden flex-shrink-0 ring-1 ring-white/10"
              style={{ background: avatarColor }}>
              {avatarUrl ? (
                <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
              ) : initial}
            </button>
          )}

          {/* Dropdown */}
          {showUserMenu && (
            <div
              className="absolute top-full right-0 mt-2 w-52 rounded-2xl overflow-hidden animate-scale-in z-50"
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--border-default)",
                boxShadow: "var(--shadow-xl)",
              }}>

              {/* User info */}
              <div className="px-4 py-3.5 border-b" style={{ borderColor: "var(--border-subtle)" }}>
                <div className="flex items-center gap-2.5 mb-1">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-black text-black overflow-hidden"
                    style={{ background: avatarColor }}>
                    {avatarUrl ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" /> : initial}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-white truncate">{username || user?.email?.split("@")[0]}</p>
                    <p className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>{user?.email}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[10px] font-bold" style={{ color: avatarColor }}>
                    {levelName} · {xp.toLocaleString()} XP
                  </span>
                  {plan !== "free" && (
                    <span className="text-[9px] font-black px-2 py-0.5 rounded-full"
                      style={{
                        background: plan === "premium" ? "rgba(251,191,36,0.15)" : "var(--green-dim)",
                        color: plan === "premium" ? "#fbbf24" : "var(--green-light)",
                      }}>
                      {plan.toUpperCase()}
                    </span>
                  )}
                </div>
              </div>

              {/* Links */}
              {[
                { label: "Mon profil",       href: "/profil",        emoji: "👤" },
                { label: "Paramètres",       href: "/parametres",    emoji: "⚙️" },
                { label: "Abonnement",       href: "/pricing",       emoji: "💎" },
                { label: "Notifications",    href: "/notifications",  emoji: "🔔" },
              ].map(link => (
                <a key={link.href} href={link.href} onClick={() => setShowUserMenu(false)}
                  className="flex items-center gap-2.5 px-4 py-2.5 text-[13px] transition-all hover:bg-white/[0.04]"
                  style={{ color: "var(--text-secondary)" }}>
                  <span className="text-sm">{link.emoji}</span>
                  {link.label}
                </a>
              ))}

              <div className="border-t mx-3" style={{ borderColor: "var(--border-subtle)" }} />

              <button onClick={handleLogout}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] transition-all text-red-400/60 hover:text-red-400 hover:bg-red-500/[0.05]">
                <span className="text-sm">🚪</span>
                Déconnexion
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
