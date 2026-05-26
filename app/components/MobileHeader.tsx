"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { usePathname, useRouter } from "next/navigation"

const PUBLIC_ROUTES = ["/", "/login", "/signup", "/onboarding", "/pricing", "/preuves"]

export default function MobileHeader() {
  const pathname = usePathname()
  const router   = useRouter()

  const [user,        setUser]        = useState<any>(null)
  const [searchOpen,  setSearchOpen]  = useState(false)
  const [query,       setQuery]       = useState("")
  const [results,     setResults]     = useState<any[]>([])
  const [searching,   setSearching]   = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
    const { data: listener } = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null))
    return () => listener.subscription.unsubscribe()
  }, [])

  // Close on nav
  useEffect(() => {
    if (searchOpen) { setSearchOpen(false); setQuery(""); setResults([]) }
  }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!user || PUBLIC_ROUTES.includes(pathname)) return null

  async function handleSearch(q: string) {
    setQuery(q)
    if (q.length < 2) { setResults([]); return }
    setSearching(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      setResults(data?.results ?? [])
    } catch { setResults([]) }
    setSearching(false)
  }

  function closeSearch() {
    setSearchOpen(false)
    setQuery("")
    setResults([])
  }

  function goTo(symbol: string) {
    router.push(`/dashboard?symbol=${symbol}`)
    closeSearch()
  }

  return (
    <>
      {/* Mobile header bar */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-50 h-16 border-b border-white/[0.06] flex items-center px-4 gap-3" style={{ background: "rgba(8,8,8,0.88)", backdropFilter: "blur(20px)" }}>
        {/* Logo */}
        <a href="/dashboard" className="flex items-center gap-2 flex-shrink-0">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center" style={{ boxShadow: "0 0 12px rgba(34,197,94,0.3)" }}>
            <span className="text-black font-black text-xs">T</span>
          </div>
          <span className="font-black text-sm tracking-tight text-white">Tradex</span>
        </a>

        {/* Search tap target */}
        <button
          onClick={() => setSearchOpen(true)}
          className="flex-1 flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/8 rounded-xl text-left transition active:bg-white/10"
        >
          <span className="text-gray-500 text-sm">🔍</span>
          <span className="text-gray-600 text-xs">AAPL, BTC, NVDA...</span>
        </button>

        {/* Notifications bell */}
        <button className="relative flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white/5 active:bg-white/10 transition">
          <span className="text-lg">🔔</span>
        </button>
      </header>

      {/* Full-screen search overlay */}
      {searchOpen && (
        <div className="md:hidden fixed inset-0 z-[100] bg-[#080808] flex flex-col">
          {/* Search input row */}
          <div className="flex items-center gap-3 px-4 pt-5 pb-3 border-b border-white/5">
            <div className="flex-1 flex items-center gap-2 px-3 py-3 bg-white/5 border border-white/10 rounded-2xl">
              <span className="text-gray-400 text-sm flex-shrink-0">🔍</span>
              <input
                autoFocus
                value={query}
                onChange={e => handleSearch(e.target.value)}
                placeholder="AAPL, Bitcoin, NVDA..."
                className="flex-1 bg-transparent text-white text-sm outline-none placeholder:text-gray-600"
              />
              {query && (
                <button onClick={() => { setQuery(""); setResults([]) }} className="text-gray-500 flex-shrink-0 active:text-white">
                  ✕
                </button>
              )}
            </div>
            <button
              onClick={closeSearch}
              className="text-gray-400 font-semibold text-sm flex-shrink-0 px-1"
            >
              Annuler
            </button>
          </div>

          {/* Results */}
          <div className="flex-1 overflow-y-auto px-4 pt-3">
            {searching && (
              <div className="flex justify-center mt-8">
                <div className="w-5 h-5 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            {!searching && results.length > 0 && (
              <div className="space-y-1">
                {results.slice(0, 10).map((r: any, i: number) => (
                  <button
                    key={i}
                    onClick={() => goTo(r.symbol)}
                    className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-white/3 active:bg-white/8 text-left transition"
                  >
                    <div className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-black text-xs">{r.symbol?.slice(0, 2)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-bold text-sm">{r.symbol}</p>
                      <p className="text-gray-500 text-xs truncate">{r.name}</p>
                    </div>
                    <span className="text-gray-600 text-xs flex-shrink-0">→</span>
                  </button>
                ))}
              </div>
            )}

            {!searching && query.length >= 2 && results.length === 0 && (
              <div className="text-center mt-12">
                <p className="text-3xl mb-3">🔍</p>
                <p className="text-gray-500 text-sm">Aucun résultat pour <span className="text-white">"{query}"</span></p>
              </div>
            )}

            {!searching && query.length === 0 && (
              <div className="mt-6">
                <p className="text-gray-600 text-xs font-semibold uppercase tracking-widest mb-3">Suggestions</p>
                <div className="flex flex-wrap gap-2">
                  {["AAPL", "TSLA", "NVDA", "BTC-USD", "ETH-USD", "MSFT", "AMZN", "SPY"].map(sym => (
                    <button
                      key={sym}
                      onClick={() => goTo(sym)}
                      className="px-3 py-1.5 bg-white/5 border border-white/8 rounded-lg text-gray-300 text-sm font-semibold active:bg-white/12 transition"
                    >
                      {sym}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
