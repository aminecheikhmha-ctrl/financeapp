"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"

export default function Signup() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  async function handleSignup() {
    if (password.length < 6) { setError("Le mot de passe doit faire au moins 6 caractères."); return }
    setLoading(true)
    setError("")
    const { data: signUpData, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) {
      setError(error.message)
    } else {
      // Auto-confirme l'email immédiatement (bypass email verification)
      if (signUpData.user) {
        await fetch("/api/auth/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: signUpData.user.id }),
        }).catch(() => {})
      }
      // Auto-login immédiatement après inscription
      const { error: loginError } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      // Email de bienvenue (best-effort)
      fetch("/api/emails/welcome", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      }).catch(() => {})
      if (!loginError) {
        router.push("/onboarding")
        return
      }
      setSuccess(true)
    }
    setLoading(false)
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[#080808] flex items-center justify-center px-6">
        <div className="bg-[#111] border border-white/10 rounded-2xl p-8 w-full max-w-md text-center">
          <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center text-green-400 text-3xl mx-auto mb-4">✓</div>
          <h2 className="text-2xl font-black text-white mb-2">Compte créé !</h2>
          <p className="text-gray-400 text-sm">Ton compte <span className="text-white font-semibold">{email}</span> est prêt. Tu peux te connecter maintenant.</p>
          <a href="/login" className="inline-block mt-6 px-6 py-3 rounded-xl bg-green-500 hover:bg-green-400 text-black font-black text-sm transition">
            Se connecter →
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#080808] flex">

      {/* LEFT — Form */}
      <div className="flex-1 flex flex-col justify-center px-8 py-12 max-w-md mx-auto lg:mx-0 lg:px-16 w-full">
        <a href="/" className="flex items-center gap-2 mb-12">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center">
            <span className="text-white font-black text-sm">F</span>
          </div>
          <span className="text-white font-black text-lg">TradEx</span>
        </a>

        <div className="mb-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-bold mb-4">
            🎁 Gratuit pour toujours
          </span>
        </div>
        <h1 className="text-3xl font-black text-white mb-1">Crée ton compte</h1>
        <p className="text-gray-500 mb-8 text-sm">Commence à trader intelligemment dès aujourd'hui</p>

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
              onKeyDown={e => e.key === "Enter" && handleSignup()}
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
              onKeyDown={e => e.key === "Enter" && handleSignup()}
              placeholder="minimum 6 caractères"
              className="w-full bg-[#111] border border-white/10 text-white px-4 py-3 rounded-xl focus:outline-none focus:border-green-500/50 transition text-sm placeholder-gray-700"
            />
          </div>

          <button
            onClick={handleSignup}
            disabled={loading}
            className="w-full bg-green-500 hover:bg-green-400 disabled:opacity-50 text-black py-3 rounded-xl font-black transition-all shadow-lg shadow-green-500/25 hover:shadow-green-400/30 mt-2 text-sm"
          >
            {loading ? "Création..." : "Créer mon compte gratuit →"}
          </button>
        </div>

        <p className="text-gray-700 text-xs text-center mt-4">
          En créant un compte, tu acceptes nos <a href="#" className="underline hover:text-gray-500">CGU</a> et notre <a href="#" className="underline hover:text-gray-500">politique de confidentialité</a>.
        </p>

        <p className="text-gray-600 text-sm text-center mt-6">
          Déjà un compte ?{" "}
          <a href="/login" className="text-green-400 hover:text-green-300 font-semibold">
            Se connecter
          </a>
        </p>
      </div>

      {/* RIGHT — Benefits panel */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-green-900/40 via-[#0a0a0a] to-[#080808]" />
        <div className="absolute inset-0" style={{backgroundImage:"radial-gradient(rgba(74,222,128,0.06) 1px,transparent 1px)",backgroundSize:"32px 32px"}} />
        <div className="relative z-10 flex flex-col justify-center px-16 py-12">
          <div className="mb-10">
            <div className="text-4xl font-black text-white leading-tight mb-3">
              Tout ce qu'il te faut{" "}
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-emerald-400">pour réussir</span>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed">
              Rejoins 10 000+ traders qui utilisent TradEx au quotidien.
            </p>
          </div>

          {/* Feature list */}
          <div className="space-y-4 mb-10">
            {[
              ["📊","Graphes professionnels","Candlesticks, RSI, MACD, Bollinger Bands"],
              ["🧠","Analyses IA","20+ indicateurs analysés en temps réel"],
              ["📡","Signaux de trading","Alertes buy/sell basées sur confluence"],
              ["🎓","Académie complète","15 cours du débutant au niveau avancé"],
            ].map(([icon,title,desc]) => (
              <div key={title} className="flex items-start gap-3">
                <span className="text-xl flex-shrink-0 mt-0.5">{icon}</span>
                <div>
                  <div className="text-white font-semibold text-sm">{title}</div>
                  <div className="text-gray-500 text-xs">{desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Social proof */}
          <div className="bg-white/5 border border-white/8 rounded-2xl p-5">
            <div className="flex gap-1 mb-3">
              {[1,2,3,4,5].map(i => <span key={i} className="text-yellow-400 text-sm">★</span>)}
              <span className="text-gray-500 text-xs ml-1 self-center">4.9/5 · 500+ avis</span>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed">
              "J'étais débutant complet. Grâce à l'académie et aux signaux IA, j'ai rentabilisé mon abonnement dès le premier mois."
            </p>
            <div className="flex items-center gap-2 mt-3">
              <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center text-white font-black text-xs">C</div>
              <span className="text-gray-500 text-xs">CryptoVictor · Trader depuis 6 mois</span>
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}
