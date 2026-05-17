"use client"

import { useState, Suspense } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter, useSearchParams } from "next/navigation"

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleLogin() {
    setLoading(true)
    setError("")
    const { error, data } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    // Check if onboarding is completed
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("onboarding_completed")
      .eq("id", data.user.id)
      .single()
    const redirect = searchParams.get("redirect")
    if (!profile?.onboarding_completed) {
      router.push("/onboarding")
    } else {
      document.cookie = "onboarding_done=1; path=/; max-age=31536000"
      router.push(redirect || "/dashboard")
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#080808] flex">

      {/* LEFT — Form */}
      <div className="flex-1 flex flex-col justify-center px-8 py-12 max-w-md mx-auto lg:mx-0 lg:px-16 w-full">
        <a href="/" className="flex items-center gap-2 mb-12">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center">
            <span className="text-white font-black text-sm">F</span>
          </div>
          <span className="text-white font-black text-lg">FinanceApp</span>
        </a>

        <h1 className="text-3xl font-black text-white mb-1">Bon retour 👋</h1>
        <p className="text-gray-500 mb-8 text-sm">Connecte-toi pour accéder à ton dashboard</p>

        {error && (
          <div className="bg-red-500/10 border border-red-500/25 text-red-400 px-4 py-3 rounded-xl mb-5 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="text-xs text-gray-500 mb-1.5 block font-semibold uppercase tracking-wide">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleLogin()}
              placeholder="toi@email.com"
              className="w-full bg-[#111] border border-white/10 text-white px-4 py-3 rounded-xl focus:outline-none focus:border-green-500/50 transition text-sm placeholder-gray-700"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1.5 block font-semibold uppercase tracking-wide">Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleLogin()}
              placeholder="••••••••"
              className="w-full bg-[#111] border border-white/10 text-white px-4 py-3 rounded-xl focus:outline-none focus:border-green-500/50 transition text-sm placeholder-gray-700"
            />
          </div>

          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full bg-green-500 hover:bg-green-400 disabled:opacity-50 text-black py-3 rounded-xl font-black transition-all shadow-lg shadow-green-500/25 hover:shadow-green-400/30 mt-2 text-sm"
          >
            {loading ? "Connexion..." : "Se connecter →"}
          </button>
        </div>

        <p className="text-gray-600 text-sm text-center mt-8">
          Pas encore de compte ?{" "}
          <a href="/signup" className="text-green-400 hover:text-green-300 font-semibold">
            S'inscrire gratuitement
          </a>
        </p>
      </div>

      {/* RIGHT — Benefits panel */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-green-900/40 via-[#0a0a0a] to-[#080808]" />
        <div className="absolute inset-0" style={{backgroundImage:"radial-gradient(rgba(74,222,128,0.06) 1px,transparent 1px)",backgroundSize:"32px 32px"}} />
        <div className="relative z-10 flex flex-col justify-center px-16 py-12">
          <div className="mb-12">
            <div className="text-4xl font-black text-white leading-tight mb-3">
              Tradez plus intelligemment{" "}
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-emerald-400">avec l'IA</span>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed">
              Signaux en temps réel, analyses IA, paper trading et académie — tout en un.
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 mb-12">
            {[["10 000+","Traders actifs"],["160+","Actifs scannés"],["98%","Satisfaction"],["15","Cours disponibles"]].map(([v,l]) => (
              <div key={l} className="bg-white/5 border border-white/8 rounded-xl p-4">
                <div className="text-2xl font-black text-green-400">{v}</div>
                <div className="text-xs text-gray-500 mt-0.5">{l}</div>
              </div>
            ))}
          </div>

          {/* Testimonial */}
          <div className="bg-white/5 border border-white/8 rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center font-black text-black text-sm">A</div>
              <div>
                <div className="text-white font-semibold text-sm">AlphaTrader92</div>
                <div className="text-yellow-400 text-xs">★★★★★</div>
              </div>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed">
              "Les signaux IA sont incroyables. J'ai fait +18% ce mois-ci grâce à FinanceApp."
            </p>
          </div>
        </div>
      </div>

    </div>
  )
}

export default function Login() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
