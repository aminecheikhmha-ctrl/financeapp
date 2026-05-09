"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"

export default function Navbar() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push("/")
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-black border-b border-gray-800 px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">

        <a href={user ? "/dashboard" : "/"} className="text-white font-bold text-xl">
          FinanceApp
        </a>

        {user ? (
          <div className="flex items-center gap-8">
           <a href="/dashboard" className="text-gray-400 hover:text-white transition">Dashboard</a>
           <a href="/signaux" className="text-gray-400 hover:text-white transition">Signaux</a>
           <a href="/forum" className="text-gray-400 hover:text-white transition">Forum</a>
           <a href="/analyses" className="text-gray-400 hover:text-white transition">Analyses</a>
           <a href="/preuves" className="text-gray-400 hover:text-white transition">Preuves</a>
           <a href="/pricing" className="text-gray-400 hover:text-white transition">Tarifs</a>
            <span className="text-gray-600">|</span>
            <span className="text-gray-400 text-sm">{user.email}</span>
            <button
              onClick={handleLogout}
              className="border border-gray-700 hover:border-gray-500 text-white px-4 py-2 rounded-lg text-sm transition"
            >
              Déconnexion
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-8">
            <a href="/" className="text-gray-400 hover:text-white transition">Accueil</a>
            <a href="/pricing" className="text-gray-400 hover:text-white transition">Tarifs</a>
            <span className="text-gray-600">|</span>
            <a href="/login" className="text-gray-400 hover:text-white transition">Connexion</a>
            <a href="/signup" className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg font-semibold transition">
              S'inscrire
            </a>
          </div>
        )}

      </div>
    </nav>
  )
}