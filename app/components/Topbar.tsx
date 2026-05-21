"use client"

import { useEffect, useState, useRef } from "react"
import { usePathname, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Search, Bell, ChevronDown, LogOut, Settings, User } from "lucide-react"
import { cn } from "@/lib/utils"

const PUBLIC_ROUTES = ["/", "/login", "/signup", "/onboarding", "/pricing", "/preuves"]

const PAGE_TITLES: Record<string, string> = {
  "/dashboard":  "Dashboard",
  "/portfolio":  "Portfolio",
  "/signaux":    "Signaux",
  "/analyses":   "Analyses",
  "/apprendre":  "Apprendre",
  "/social":     "Social",
  "/forum":      "Forum",
  "/reports":    "Rapports",
  "/profil":     "Profil",
  "/parametres": "Paramètres",
  "/coach":      "Coach IA",
}

export default function Topbar() {
  const pathname  = usePathname()
  const router    = useRouter()

  const [user,        setUser]        = useState<any>(null)
  const [username,    setUsername]    = useState<string | null>(null)
  const [avatarColor, setAvatarColor] = useState("#4ade80")
  const [search,      setSearch]      = useState("")
  const [results,     setResults]     = useState<any[]>([])
  const [showSearch,  setShowSearch]  = useState(false)
  const [showDrop,    setShowDrop]    = useState(false)
  const [marketOpen,  setMarketOpen]  = useState(false)

  const searchRef = useRef<any>(null)
  const dropRef   = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // US market: Mon-Fri 9:30-16:00 ET
    const now = new Date()
    const et  = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }))
    const day = et.getDay()
    const h   = et.getHours()
    const m   = et.getMinutes()
    const mins = h * 60 + m
    setMarketOpen(day >= 1 && day <= 5 && mins >= 570 && mins < 960)

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

    const { data: listener } = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null))
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!search.trim()) { setResults([]); return }
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/search?q=${search}`)
        setResults(await r.json())
      } catch { setResults([]) }
    }, 250)
    return () => clearTimeout(t)
  }, [search])

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setShowDrop(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  // Cmd+K
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        searchRef.current?.focus()
        setShowSearch(true)
      }
      if (e.key === "Escape") setShowSearch(false)
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    document.cookie = "onboarding_done=; path=/; max-age=0"
    router.push("/")
  }

  if (!user || PUBLIC_ROUTES.some(r => pathname === r || pathname.startsWith(r + "/"))) return null

  const pageTitle = PAGE_TITLES[pathname] ?? ""
  const initial   = (username ?? user?.email ?? "?")[0]?.toUpperCase()

  return (
    <div
      className="fixed top-0 right-0 z-40 h-14 flex items-center gap-4 px-5"
      style={{
        left: "var(--sidebar-w, 64px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(5,5,5,0.9)",
        backdropFilter: "blur(20px)",
        transition: "left 0.2s",
      }}
    >
      {/* Page title */}
      <h1 className="text-[15px] font-semibold text-white/70 flex-shrink-0">{pageTitle}</h1>

      {/* Search — centre */}
      <div className="flex-1 max-w-md mx-auto relative">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25 pointer-events-none" />
          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setShowSearch(true) }}
            onFocus={() => setShowSearch(true)}
            onBlur={() => setTimeout(() => setShowSearch(false), 150)}
            placeholder="Rechercher un actif… (⌘K)"
            className="w-full h-9 bg-white/5 border border-white/8 rounded-lg pl-8 pr-3 text-[13px] text-white placeholder-white/25 focus:outline-none focus:border-white/15 focus:bg-white/7 transition-all"
          />
        </div>
        {showSearch && results.length > 0 && (
          <div className="absolute top-full mt-1.5 left-0 right-0 rounded-xl overflow-hidden shadow-2xl z-50" style={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)" }}>
            {results.slice(0, 6).map(r => (
              <button
                key={r.symbol}
                onMouseDown={() => { router.push(`/dashboard?symbol=${r.symbol}`); setSearch(""); setShowSearch(false) }}
                className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-white/[0.05] transition border-b border-white/[0.04] last:border-0"
              >
                <div className="text-left">
                  <p className="text-[13px] font-semibold text-white">{r.symbol}</p>
                  <p className="text-[11px] text-white/40 truncate max-w-[200px]">{r.name}</p>
                </div>
                <span className="text-[11px] text-green-400/60">→</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3 flex-shrink-0">
        {/* Market status */}
        <div className="hidden sm:flex items-center gap-1.5">
          <div className={cn("w-1.5 h-1.5 rounded-full", marketOpen ? "bg-green-400 shadow-[0_0_5px_rgba(74,222,128,0.8)]" : "bg-white/20")} />
          <span className="text-[11px] text-white/35">{marketOpen ? "Marché ouvert" : "Marché fermé"}</span>
        </div>

        {/* Notifications */}
        <button className="relative p-2 rounded-lg text-white/35 hover:text-white/70 hover:bg-white/5 transition">
          <Bell size={16} />
        </button>

        {/* Avatar dropdown */}
        <div className="relative" ref={dropRef}>
          <button
            onClick={() => setShowDrop(d => !d)}
            className="flex items-center gap-2 p-1 rounded-lg hover:bg-white/5 transition"
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-black flex-shrink-0"
              style={{ backgroundColor: avatarColor }}
            >
              {initial}
            </div>
            <ChevronDown size={12} className={cn("text-white/25 transition-transform", showDrop && "rotate-180")} />
          </button>
          {showDrop && (
            <div
              className="absolute top-full right-0 mt-1.5 w-44 rounded-xl overflow-hidden shadow-2xl z-50"
              style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              <a href="/profil" className="flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-white/70 hover:text-white hover:bg-white/[0.04] transition border-b border-white/[0.06]">
                <User size={14} className="text-white/35" />
                Profil
              </a>
              <a href="/profil" className="flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-white/70 hover:text-white hover:bg-white/[0.04] transition border-b border-white/[0.06]">
                <Settings size={14} className="text-white/35" />
                Paramètres
              </a>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-white/70 hover:text-red-400 hover:bg-white/[0.04] transition"
              >
                <LogOut size={14} className="text-white/35" />
                Déconnexion
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
