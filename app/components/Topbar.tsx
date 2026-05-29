"use client"

import { useState, useEffect, useRef } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Bell } from "lucide-react"
import { supabase } from "@/lib/supabase"
import GlobalSearch from "@/app/components/GlobalSearch"

const PUBLIC_ROUTES = ["/", "/login", "/signup", "/onboarding", "/pricing", "/preuves"]

const PAGE_TITLES: Record<string, string> = {
  "/dashboard":    "Dashboard",
  "/signaux":      "Signaux IA",
  "/analyses":     "Analyses Macro",
  "/portfolio":    "Portfolio",
  "/watchlist":    "Watchlist",
  "/news":         "Actualités",
  "/apprendre":    "Académie",
  "/forum":        "Forum",
  "/coach":        "Coach IA",
  "/reports":      "Rapports",
  "/compare":      "Comparateur",
  "/profil":       "Mon Profil",
  "/notifications":"Notifications",
  "/parametres":   "Paramètres",
  "/pricing":      "Tarifs",
  "/social":       "Social Trading",
  "/admin":        "Administration",
  "/status":       "Status",
}

export default function Topbar() {
  const pathname = usePathname()
  const router   = useRouter()
  const dropRef  = useRef<HTMLDivElement>(null)

  const [user,          setUser]          = useState<any>(null)
  const [username,      setUsername]      = useState("")
  const [avatarColor,   setAvatarColor]   = useState("#22c55e")
  const [avatarUrl,     setAvatarUrl]     = useState<string | null>(null)
  const [plan,          setPlan]          = useState("free")
  const [xp,            setXp]            = useState(0)
  const [levelName,     setLevelName]     = useState("")
  const [unreadCount,   setUnreadCount]   = useState(0)
  const [showUserMenu,  setShowUserMenu]  = useState(false)
  const [marketOpen,    setMarketOpen]    = useState(false)
  const [profileLoaded, setProfileLoaded] = useState(false)

  const pageTitle = Object.entries(PAGE_TITLES).find(
    ([key]) => pathname === key || pathname.startsWith(key + "/"),
  )?.[1] ?? "Tradex"

  useEffect(() => {
    // US market: Mon-Fri 9:30-16:00 ET
    const now = new Date()
    const et  = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }))
    const day  = et.getDay()
    const mins = et.getHours() * 60 + et.getMinutes()
    setMarketOpen(day >= 1 && day <= 5 && mins >= 570 && mins < 960)

    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      setUser(data.user)

      const [profileRes, planRes, notifRes] = await Promise.all([
        supabase
          .from("user_profiles")
          .select("username, xp, level_name, avatar_color, avatar_url")
          .eq("id", data.user.id)
          .single(),
        supabase.from("profiles").select("plan").eq("id", data.user.id).single(),
        supabase
          .from("user_notifications")
          .select("*", { count: "exact", head: true })
          .eq("user_id", data.user.id)
          .eq("read", false),
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

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setShowUserMenu(false)
      }
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
      className="hidden md:flex items-center gap-4 px-5 border-b flex-shrink-0"
      style={{
        position: "fixed",
        top: 0,
        left: "var(--sidebar-w, 64px)",
        right: 0,
        height: "var(--topbar-h)",
        zIndex: 40,
        transition: "left 0.2s ease",
        background: "rgba(5,5,5,0.95)",
        backdropFilter: "blur(20px)",
        borderColor: "var(--border-dim)",
      }}>

      {/* Page title */}
      <div className="flex items-center gap-2.5 flex-shrink-0 min-w-[140px]">
        <p className="text-sm font-black text-white">{pageTitle}</p>
        {/* Market status */}
        <div className="flex items-center gap-1">
          <div className="w-1.5 h-1.5 rounded-full"
            style={{
              background: marketOpen ? "var(--green)" : "rgba(255,255,255,0.2)",
              boxShadow: marketOpen ? "0 0 5px rgba(34,197,94,0.8)" : "none",
            }} />
          <span className="text-[10px] hidden lg:block" style={{ color: "var(--text-muted)" }}>
            {marketOpen ? "Ouvert" : "Fermé"}
          </span>
        </div>
      </div>

      {/* Global search */}
      <div className="flex-1 max-w-md">
        <GlobalSearch />
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2 ml-auto">

        {/* Pro upgrade badge */}
        {plan === "free" && (
          <a href="/pricing"
            className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all hover:scale-[1.02] active:scale-95"
            style={{ background: "var(--green-dim)", color: "var(--green-bright)", border: "1px solid var(--green-border)" }}>
            ⭐ Passer à Pro
          </a>
        )}

        {/* Notifications */}
        <button onClick={() => router.push("/notifications")}
          className="relative w-9 h-9 rounded-xl flex items-center justify-center transition-all text-white/35 hover:text-white hover:bg-white/[0.06]">
          <Bell size={16} />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
          )}
        </button>

        {/* User avatar + dropdown */}
        <div className="relative" ref={dropRef}>
          {!profileLoaded ? (
            <div className="w-8 h-8 rounded-full skeleton flex-shrink-0" />
          ) : (
          <button
            onClick={() => setShowUserMenu(m => !m)}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-black text-black transition-all hover:scale-105 overflow-hidden flex-shrink-0"
            style={{ background: avatarColor }}>
            {avatarUrl ? (
              <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              initial
            )}
          </button>
          )}

          {/* Dropdown */}
          {showUserMenu && (
            <div className="absolute top-full right-0 mt-2 w-52 rounded-2xl overflow-hidden shadow-2xl animate-scale-in z-50"
              style={{ background: "#0d0d0d", border: "1px solid var(--border-default)" }}>

              {/* User info */}
              <div className="px-4 py-3 border-b" style={{ borderColor: "var(--border-dim)" }}>
                <p className="text-sm font-black text-white">{username || user?.email?.split("@")[0] || ""}</p>
                <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>{user?.email}</p>
                <p className="text-[10px] font-bold mt-1" style={{ color: avatarColor }}>
                  {levelName} · {xp.toLocaleString()} XP
                </p>
              </div>

              {/* Links */}
              {[
                { label: "👤 Mon profil",    href: "/profil" },
                { label: "⚙️ Paramètres",    href: "/parametres" },
                { label: "💎 Abonnement",    href: "/pricing" },
                { label: "🔔 Notifications", href: "/notifications" },
              ].map(link => (
                <a key={link.href} href={link.href}
                  className="flex items-center px-4 py-2.5 text-sm transition-all text-white/60 hover:text-white hover:bg-white/[0.04]">
                  {link.label}
                </a>
              ))}

              <div className="border-t" style={{ borderColor: "var(--border-dim)" }}>
                <button onClick={handleLogout}
                  className="w-full flex items-center px-4 py-2.5 text-sm transition-all text-red-400/60 hover:text-red-400 hover:bg-red-500/[0.06]">
                  🚪 Se déconnecter
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
