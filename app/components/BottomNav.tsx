"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import {
  LayoutDashboard, TrendingUp, Briefcase, BookOpen,
  MoreHorizontal, MessageSquare, FileText, Bot, Settings,
  LogOut, Newspaper, Star, GitCompare, Users,
} from "lucide-react"
import { haptic } from "@/lib/capacitor"
import { supabase } from "@/lib/supabase"

const PUBLIC_ROUTES = ["/", "/login", "/signup", "/onboarding", "/pricing", "/preuves"]

const TABS = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/signaux",   icon: TrendingUp,      label: "Signaux",   badge: true },
  { href: "/portfolio", icon: Briefcase,        label: "Portfolio" },
  { href: "/apprendre", icon: BookOpen,         label: "Académie" },
] as const

const MENU_ITEMS = [
  { href: "/watchlist",    icon: Star,           label: "Watchlist" },
  { href: "/news",         icon: Newspaper,      label: "Actualités" },
  { href: "/forum",        icon: MessageSquare,  label: "Forum" },
  { href: "/compare",      icon: GitCompare,     label: "Comparer" },
  { href: "/reports",      icon: FileText,       label: "Rapports" },
  { href: "/coach",        icon: Bot,            label: "Coach IA" },
  { href: "/social",       icon: Users,          label: "Social" },
  { href: "/parametres",   icon: Settings,       label: "Paramètres" },
]

export default function BottomNav() {
  const pathname = usePathname()
  const router   = useRouter()

  const [user,        setUser]        = useState<any>(null)
  const [signalCount, setSignalCount] = useState(0)
  const [menuOpen,    setMenuOpen]    = useState(false)
  const [username,    setUsername]    = useState<string | null>(null)
  const [avatarColor, setAvatarColor] = useState("#22c55e")
  const [avatarUrl,   setAvatarUrl]   = useState<string | null>(null)
  const touchStartY = useRef(0)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      setUser(data.user)
      const { data: up } = await supabase
        .from("user_profiles")
        .select("username, avatar_color, avatar_url")
        .eq("id", data.user.id)
        .single()
      if (up?.username)     setUsername(up.username)
      if (up?.avatar_color) setAvatarColor(up.avatar_color)
      if (up?.avatar_url)   setAvatarUrl(up.avatar_url)
    })

    fetch("/api/signals")
      .then(r => r.json())
      .then(d => setSignalCount(d.stats?.fort ?? 0))
      .catch(() => {})

    const { data: listener } = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null))
    return () => listener.subscription.unsubscribe()
  }, [])

  // Close menu on route change
  useEffect(() => { setMenuOpen(false) }, [pathname])

  if (!user || PUBLIC_ROUTES.includes(pathname)) return null

  async function handleLogout() {
    setMenuOpen(false)
    await supabase.auth.signOut()
    document.cookie = "onboarding_done=; path=/; max-age=0"
    window.location.href = "/"
  }

  const moreActive = menuOpen || !["/dashboard", "/signaux", "/portfolio", "/apprendre"].some(
    p => pathname === p || pathname.startsWith(p + "/"),
  )
  const initial = (username ?? user?.email ?? "?")[0]?.toUpperCase()

  return (
    <>
      {/* Slide-up backdrop */}
      {menuOpen && (
        <div
          className="md:hidden fixed inset-0 z-[75] bg-black/60"
          style={{ backdropFilter: "blur(4px)" }}
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* Slide-up menu */}
      <div
        className="md:hidden fixed bottom-[68px] left-0 right-0 z-[80] rounded-t-3xl transition-transform duration-300 ease-out"
        style={{
          background: "#0d0d0d",
          borderTop: "1px solid var(--border-default)",
          transform: menuOpen ? "translateY(0)" : "translateY(100%)",
          pointerEvents: menuOpen ? "auto" : "none",
        }}
        onTouchStart={e => { touchStartY.current = e.touches[0].clientY }}
        onTouchEnd={e => {
          const delta = e.changedTouches[0].clientY - touchStartY.current
          if (delta > 60) setMenuOpen(false) // swipe down → ferme
        }}>
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.15)" }} />
        </div>

        {/* User info */}
        <a href="/profil" onClick={() => setMenuOpen(false)}
          className="flex items-center gap-3 mx-4 mb-3 p-3 rounded-2xl transition-all active:scale-[0.98]"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-dim)" }}>
          <div className="w-10 h-10 rounded-full flex-shrink-0 overflow-hidden"
            style={{ background: avatarColor }}>
            {avatarUrl ? (
              <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-black font-black text-sm">
                {initial}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-sm truncate">{username ?? user?.email?.split("@")[0]}</p>
            <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Voir mon profil →</p>
          </div>
        </a>

        {/* Menu grid */}
        <div className="px-4 grid grid-cols-2 gap-2 mb-3">
          {MENU_ITEMS.map(item => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
            return (
              <a key={item.href} href={item.href} onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2.5 px-3 py-3 rounded-xl transition-all active:scale-95"
                style={{
                  background: isActive ? "rgba(34,197,94,0.08)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${isActive ? "rgba(34,197,94,0.2)" : "var(--border-dim)"}`,
                }}>
                <item.icon size={16}
                  style={{ color: isActive ? "var(--green-bright)" : "var(--text-muted)", flexShrink: 0 }} />
                <span className="text-sm font-semibold"
                  style={{ color: isActive ? "var(--green-bright)" : "rgba(255,255,255,0.75)" }}>
                  {item.label}
                </span>
              </a>
            )
          })}
        </div>

        {/* Logout */}
        <div className="px-4 pb-6 pt-1 border-t" style={{ borderColor: "var(--border-dim)" }}>
          <button onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all active:scale-[0.98] text-red-400/60 hover:text-red-400"
            style={{ background: "transparent" }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,0.06)"}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}>
            <LogOut size={16} style={{ flexShrink: 0 }} />
            <span className="text-sm font-semibold">Déconnexion</span>
          </button>
        </div>
      </div>

      {/* Bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-[70]"
        style={{
          height: "var(--bottomnav-h)",
          background: "rgba(5,5,5,0.97)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          borderTop: "1px solid rgba(255,255,255,0.06)",
        }}
        onTouchStart={e => { touchStartY.current = e.touches[0].clientY }}
        onTouchEnd={e => {
          const delta = e.changedTouches[0].clientY - touchStartY.current
          if (delta < -30) { haptic("light"); setMenuOpen(true) } // swipe up → ouvre
        }}>
        <div className="flex items-center justify-around px-2 pt-2 pb-safe h-full">
          {TABS.map(tab => {
            const isActive = pathname === tab.href || pathname.startsWith(tab.href + "/")
            const Icon = tab.icon
            const badge = (tab as any).badge ? signalCount : 0

            return (
              <button key={tab.href}
                onClick={async () => { await haptic("light"); router.push(tab.href) }}
                className="flex flex-col items-center gap-1 px-3 py-1.5 rounded-2xl relative transition-all active:scale-90"
                style={{
                  background: isActive ? "rgba(34,197,94,0.08)" : "transparent",
                  minWidth: 56,
                }}>
                {/* Active top pill */}
                {isActive && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full"
                    style={{ background: "var(--green)" }} />
                )}
                <div className="relative">
                  <Icon size={22}
                    style={{ color: isActive ? "var(--green)" : "rgba(255,255,255,0.3)" }}
                    strokeWidth={isActive ? 2.4 : 1.7} />
                  {badge > 0 && (
                    <div className="absolute -top-1.5 -right-2 min-w-[15px] h-4 px-0.5 bg-red-500 rounded-full flex items-center justify-center">
                      <span className="text-[9px] font-black text-white">{badge > 9 ? "9+" : badge}</span>
                    </div>
                  )}
                </div>
                <span className="text-[10px] font-semibold"
                  style={{ color: isActive ? "var(--green)" : "rgba(255,255,255,0.25)" }}>
                  {tab.label}
                </span>
              </button>
            )
          })}

          {/* More tab */}
          <button
            onClick={async () => { await haptic("light"); setMenuOpen(m => !m) }}
            className="flex flex-col items-center gap-1 px-3 py-1.5 rounded-2xl relative transition-all active:scale-90"
            style={{
              background: moreActive ? "rgba(34,197,94,0.08)" : "transparent",
              minWidth: 56,
            }}>
            {moreActive && (
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full"
                style={{ background: "var(--green)" }} />
            )}
            <MoreHorizontal size={22}
              style={{ color: moreActive ? "var(--green)" : "rgba(255,255,255,0.3)" }}
              strokeWidth={moreActive ? 2.4 : 1.7} />
            <span className="text-[10px] font-semibold"
              style={{ color: moreActive ? "var(--green)" : "rgba(255,255,255,0.25)" }}>
              Plus
            </span>
          </button>
        </div>
      </nav>
    </>
  )
}
