"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { usePathname } from "next/navigation"

const PUBLIC_ROUTES = ["/", "/login", "/signup", "/pricing", "/preuves", "/blog"]

export default function Navbar() {
  const pathname = usePathname()
  const [user, setUser] = useState<any>(null)
  const [scrolled, setScrolled] = useState(false)
  const [ready, setReady] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
      setReady(true)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener("scroll", handleScroll)
    return () => {
      listener.subscription.unsubscribe()
      window.removeEventListener("scroll", handleScroll)
    }
  }, [])

  const isPublic = PUBLIC_ROUTES.includes(pathname)
  if (!ready || !isPublic) return null

  const navLinks = [
    { href: "/#features", label: "Fonctionnalités" },
    { href: "/pricing", label: "Tarifs" },
    { href: "/apprendre", label: "Académie" },
    { href: "/blog", label: "Blog" },
    { href: "/signaux", label: "Signaux" },
  ]

  // Logged-in user on a public route → minimal bar with dashboard link
  if (user) {
    return (
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-[#080808]/90 backdrop-blur-xl border-b border-white/5 shadow-xl"
          : "bg-[#080808]/70 backdrop-blur-md border-b border-white/5"
      }`}>
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2.5 group flex-shrink-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-500/30">
              <span className="text-white font-black text-sm">T</span>
            </div>
            <span className="text-white font-black text-lg tracking-tight group-hover:text-green-400 transition">
              TradEx
            </span>
          </a>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500 hidden sm:block">{user.email}</span>
            <a
              href="/dashboard"
              className="px-4 py-2 rounded-xl text-sm font-bold bg-green-500 hover:bg-green-400 text-black transition shadow-lg shadow-green-500/25"
            >
              Dashboard →
            </a>
          </div>
        </div>
      </nav>
    )
  }

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 backdrop-blur-xl border-b border-white/5 ${
      scrolled
        ? "bg-[#080808]/95 shadow-xl"
        : "bg-[#080808]/70"
    }`}>
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
        {/* Logo */}
        <a href="/" className="flex items-center gap-2.5 group flex-shrink-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-500/30">
            <span className="text-white font-black text-sm">T</span>
          </div>
          <span className="text-white font-black text-lg tracking-tight group-hover:text-green-400 transition">
            TradEx
          </span>
        </a>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map(l => (
            <a
              key={l.href}
              href={l.href}
              className="text-gray-400 hover:text-white transition text-sm font-medium"
            >
              {l.label}
            </a>
          ))}
        </div>

        {/* Desktop CTAs */}
        <div className="hidden md:flex items-center gap-3">
          <a
            href="/dashboard"
            className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-300 hover:text-white transition"
          >
            Demo
          </a>
          <a
            href="/login"
            className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-300 border border-white/10 hover:border-white/25 hover:text-white transition"
          >
            Connexion
          </a>
          <a
            href="/signup"
            className="px-4 py-2 rounded-xl text-sm font-bold bg-green-500 hover:bg-green-400 text-black transition shadow-lg shadow-green-500/25"
          >
            Essai gratuit →
          </a>
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="md:hidden flex flex-col gap-1.5 p-2"
        >
          <span className={`block w-5 h-0.5 bg-white transition-all ${menuOpen ? "rotate-45 translate-y-2" : ""}`} />
          <span className={`block w-5 h-0.5 bg-white transition-all ${menuOpen ? "opacity-0" : ""}`} />
          <span className={`block w-5 h-0.5 bg-white transition-all ${menuOpen ? "-rotate-45 -translate-y-2" : ""}`} />
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden bg-[#0d0d0d] border-t border-white/5 px-6 py-4 space-y-3">
          {navLinks.map(l => (
            <a key={l.href} href={l.href} className="block text-gray-300 hover:text-white py-2 text-sm font-medium transition">
              {l.label}
            </a>
          ))}
          <a href="/dashboard" className="block text-green-400 hover:text-green-300 py-2 text-sm font-semibold transition">
            Démo gratuite
          </a>
          <div className="flex gap-3 pt-2">
            <a href="/login" className="flex-1 py-2.5 text-center rounded-xl border border-white/10 text-sm font-semibold text-gray-300">
              Connexion
            </a>
            <a href="/signup" className="flex-1 py-2.5 text-center rounded-xl bg-green-500 text-black text-sm font-bold">
              Essai gratuit
            </a>
          </div>
        </div>
      )}
    </nav>
  )
}
