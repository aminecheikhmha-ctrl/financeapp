"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { usePathname, useRouter } from "next/navigation"
import { LayoutDashboard, TrendingUp, Briefcase, BookOpen, MoreHorizontal, Users, MessageSquare, FileText, Bot, Settings, LogOut, Newspaper, Star, GitCompare } from "lucide-react"
import { cn } from "@/lib/utils"
import { haptic } from "@/lib/capacitor"

const PUBLIC_ROUTES = ["/", "/login", "/signup", "/onboarding", "/pricing", "/preuves"]

const TABS = [
  { href: "/dashboard", Icon: LayoutDashboard, label: "Dashboard" },
  { href: "/signaux",   Icon: TrendingUp,      label: "Signaux"   },
  { href: "/news",      Icon: Newspaper,       label: "News"      },
  { href: "/portfolio", Icon: Briefcase,       label: "Portfolio" },
  { href: "/apprendre", Icon: BookOpen,        label: "Apprendre" },
]

const MENU_ITEMS = [
  { href: "/watchlist",           Icon: Star,           label: "Watchlist" },
  { href: "/compare",             Icon: GitCompare,     label: "Comparer"  },
  { href: "/social",              Icon: Users,          label: "Social"    },
  { href: "/forum",               Icon: MessageSquare,  label: "Forum"     },
  { href: "/reports",             Icon: FileText,       label: "Rapports"  },
  { href: "/coach",               Icon: Bot,            label: "Coach IA"  },
  { href: "/parametres",          Icon: Settings,       label: "Paramètres"},
]

export default function BottomNav() {
  const pathname = usePathname()
  const router   = useRouter()

  const [user,        setUser]        = useState<any>(null)
  const [strongCount, setStrongCount] = useState(0)
  const [menuOpen,    setMenuOpen]    = useState(false)
  const [username,    setUsername]    = useState<string | null>(null)
  const [avatarColor, setAvatarColor] = useState("#4ade80")

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      setUser(data.user)
      const { data: up } = await supabase
        .from("user_profiles")
        .select("username, avatar_color")
        .eq("id", data.user.id)
        .single()
      if (up?.username)    setUsername(up.username)
      if (up?.avatar_color) setAvatarColor(up.avatar_color)
    })

    fetch("/api/signals")
      .then(r => r.json())
      .then(d => setStrongCount(
        (d?.signals ?? []).filter((s: { strength: string }) => s.strength === "strong").length
      )).catch(() => {})

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
    router.push("/")
  }

  const profileSectionActive = ["/profil", "/parametres", "/social", "/forum", "/reports", "/coach", "/analyses", "/preuves", "/pricing"].some(
    p => pathname.startsWith(p)
  )
  const initial = (username ?? user?.email ?? "?")[0]?.toUpperCase()

  return (
    <>
      {/* Slide-up menu backdrop */}
      {menuOpen && (
        <div
          className="md:hidden fixed inset-0 z-[55] bg-black/60 backdrop-blur-sm"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* Slide-up profile menu */}
      <div className={cn(
        "md:hidden fixed bottom-16 left-0 right-0 z-[60] rounded-t-2xl transition-transform duration-300 ease-out",
        menuOpen ? "translate-y-0" : "translate-y-full"
      )} style={{ background: "#111", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* User info row */}
        <a
          href="/profil"
          onClick={() => setMenuOpen(false)}
          className="flex items-center gap-3 mx-4 mb-3 mt-1 p-3 rounded-2xl bg-white/[0.03] active:bg-white/[0.08] transition"
        >
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-black font-black text-sm flex-shrink-0"
            style={{ backgroundColor: avatarColor }}
          >
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-sm truncate">{username ?? user?.email?.split("@")[0]}</p>
            <p className="text-white/30 text-xs">Voir mon profil →</p>
          </div>
        </a>

        {/* Menu items grid */}
        <div className="px-4 grid grid-cols-2 gap-2 mb-3">
          {MENU_ITEMS.map(item => {
            const basePath = item.href.split("?")[0]
            const isActive = pathname === basePath || (basePath !== "/" && pathname.startsWith(basePath + "/"))
            return (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-3 rounded-xl transition active:scale-95",
                  isActive
                    ? "bg-green-500/15 border border-green-500/20"
                    : "bg-white/[0.03] active:bg-white/[0.08]"
                )}
              >
                <item.Icon
                  size={18}
                  className={cn(
                    "flex-shrink-0",
                    isActive ? "text-green-400" : "text-white/50"
                  )}
                />
                <span className={cn(
                  "text-sm font-semibold",
                  isActive ? "text-green-400" : "text-white/80"
                )}>
                  {item.label}
                </span>
              </a>
            )
          })}
        </div>

        {/* Logout */}
        <div className="px-4 pb-6 border-t border-white/[0.05] pt-2">
          <button
            onClick={handleLogout}
            aria-label="Se déconnecter"
            className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-red-400 hover:bg-red-500/5 active:bg-red-500/10 transition"
          >
            <LogOut size={18} className="flex-shrink-0" />
            <span className="text-sm font-semibold">Déconnexion</span>
          </button>
        </div>
      </div>

      {/* Bottom tab bar */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 h-16"
        style={{ background: "rgba(5,5,5,0.95)", backdropFilter: "blur(24px)", borderTop: "1px solid rgba(255,255,255,0.07)" }}
      >
        <div className="flex items-stretch h-full">
          {TABS.map(tab => {
            const active = pathname === tab.href || (tab.href !== "/dashboard" && pathname.startsWith(tab.href + "/"))
            const isSignaux = tab.href === "/signaux"
            return (
              <a
                key={tab.href}
                href={tab.href}
                aria-label={tab.label}
                onClick={() => haptic("light")}
                className={cn(
                  "flex-1 flex flex-col items-center justify-center gap-0.5 transition-all active:scale-90",
                  active ? "text-white" : "text-white/30"
                )}
              >
                <div className="relative flex flex-col items-center gap-0.5">
                  {active && (
                    <span className="absolute -top-2 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-green-400" />
                  )}
                  <tab.Icon size={20} className="flex-shrink-0" />
                  {isSignaux && strongCount > 0 && (
                    <span className="absolute -top-1 -right-3 min-w-[16px] h-4 px-0.5 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">
                      {strongCount > 9 ? "9+" : strongCount}
                    </span>
                  )}
                </div>
                <span className={cn("text-[10px] leading-none", active ? "font-semibold text-white" : "text-white/30")}>
                  {tab.label}
                </span>
              </a>
            )
          })}

          {/* More/Profil tab — opens slide-up */}
          <button
            onClick={() => { haptic("light"); setMenuOpen(!menuOpen) }}
            aria-label="Menu profil"
            className={cn(
              "flex-1 flex flex-col items-center justify-center gap-0.5 transition-all active:scale-90",
              profileSectionActive || menuOpen ? "text-white" : "text-white/30"
            )}
          >
            <div className="relative flex flex-col items-center gap-0.5">
              {(profileSectionActive || menuOpen) && (
                <span className="absolute -top-2 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-green-400" />
              )}
              <MoreHorizontal size={20} className="flex-shrink-0" />
            </div>
            <span className={cn("text-[10px] leading-none", profileSectionActive || menuOpen ? "font-semibold text-white" : "text-white/30")}>
              Plus
            </span>
          </button>
        </div>
      </nav>
    </>
  )
}
