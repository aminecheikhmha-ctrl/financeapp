"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import { useLanguage } from "@/lib/i18n/context"

export default function Signup() {
  const router = useRouter()
  const { t } = useLanguage()

  const [email,        setEmail]        = useState("")
  const [password,     setPassword]     = useState("")
  const [loading,      setLoading]      = useState(false)
  const [loadingGoogle,setLoadingGoogle]= useState(false)
  const [error,        setError]        = useState("")
  const [success,      setSuccess]      = useState(false)

  async function handleGoogleSignup() {
    setLoadingGoogle(true); setError("")
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) { setError(error.message); setLoadingGoogle(false) }
  }

  async function handleSignup() {
    if (password.length < 6) { setError("Le mot de passe doit faire au moins 6 caractères."); return }
    setLoading(true); setError("")
    const { data: signUpData, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) {
      setError(error.message)
    } else {
      if (signUpData.user) {
        await fetch("/api/auth/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: signUpData.user.id }),
        }).catch(() => {})
      }
      const { error: loginError } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      fetch("/api/emails/welcome", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      }).catch(() => {})
      if (!loginError) { router.push("/onboarding"); return }
      setSuccess(true)
    }
    setLoading(false)
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[#080808] flex items-center justify-center px-6">
        <div className="bg-[#111] border border-white/10 rounded-2xl p-8 w-full max-w-md text-center">
          <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center text-green-400 text-3xl mx-auto mb-4">✓</div>
          <h2 className="text-2xl font-black text-white mb-2">{t.auth.emailSent}</h2>
          <p className="text-gray-400 text-sm">Ton compte <span className="text-white font-semibold">{email}</span> est prêt.</p>
          <a href="/login" className="inline-block mt-6 px-6 py-3 rounded-xl bg-green-500 hover:bg-green-400 text-black font-black text-sm transition">{t.auth.loginCta} →</a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#080808] flex">

      {/* LEFT — Form */}
      <div className="flex-1 flex flex-col justify-center px-8 py-12 max-w-md mx-auto lg:mx-0 lg:px-16 w-full">

        <div className="flex items-center justify-between mb-12">
          <a href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center" style={{ boxShadow: "0 0 16px rgba(34,197,94,0.3)" }}>
              <span className="text-black font-black text-sm">T</span>
            </div>
            <span className="text-white font-black text-lg">Tradex</span>
          </a>
          <a href="/" className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition font-semibold">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            {t.common.back}
          </a>
        </div>

        <div className="mb-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-bold mb-4">
            🎁 Gratuit pour toujours
          </span>
        </div>
        <h1 className="text-3xl font-black text-white mb-1">{t.auth.signupTitle}</h1>
        <p className="text-gray-500 mb-8 text-sm">{t.auth.signupSubtitle}</p>

        {error && (
          <div className="bg-red-500/10 border border-red-500/25 text-red-400 px-4 py-3 rounded-xl mb-5 text-sm">
            {error}
          </div>
        )}

        {/* Google OAuth */}
        <button onClick={handleGoogleSignup} disabled={loadingGoogle}
          className="w-full flex items-center justify-center gap-3 bg-white/5 hover:bg-white/8 disabled:opacity-50 border border-white/10 text-white py-3 rounded-xl font-semibold transition text-sm mb-5">
          <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          {loadingGoogle ? t.common.loading : t.auth.googleLogin}
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="flex-1 h-px bg-white/8" />
          <span className="text-gray-600 text-xs">{t.common.or}</span>
          <div className="flex-1 h-px bg-white/8" />
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-gray-500 mb-1.5 block font-semibold uppercase tracking-wide">{t.auth.email}</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSignup()}
              placeholder="toi@email.com"
              className="w-full bg-[#111] border border-white/10 text-white px-4 py-3 rounded-xl focus:outline-none focus:border-green-500/50 transition text-sm placeholder-gray-700" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1.5 block font-semibold uppercase tracking-wide">{t.auth.password}</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSignup()}
              placeholder="minimum 6 caractères"
              className="w-full bg-[#111] border border-white/10 text-white px-4 py-3 rounded-xl focus:outline-none focus:border-green-500/50 transition text-sm placeholder-gray-700" />
          </div>
          <button onClick={handleSignup} disabled={loading}
            className="w-full bg-green-500 hover:bg-green-400 disabled:opacity-50 text-black py-3 rounded-xl font-black transition-all shadow-lg shadow-green-500/25 hover:shadow-green-400/30 mt-2 text-sm">
            {loading ? t.common.loading : t.auth.signupCta}
          </button>
        </div>

        <p className="text-gray-700 text-xs text-center mt-4">
          En créant un compte, tu acceptes nos <a href="#" className="underline hover:text-gray-500">CGU</a> et notre <a href="#" className="underline hover:text-gray-500">politique de confidentialité</a>.
        </p>

        <p className="text-gray-600 text-sm text-center mt-6">
          {t.auth.hasAccount}{" "}
          <a href="/login" className="text-green-400 hover:text-green-300 font-semibold">{t.auth.loginLink}</a>
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
            <p className="text-gray-400 text-sm leading-relaxed">Rejoins 10 000+ traders qui utilisent Tradex au quotidien.</p>
          </div>
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
