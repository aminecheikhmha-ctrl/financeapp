"use client"

import { useState, useEffect, Suspense } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter, useSearchParams } from "next/navigation"

function LoginForm() {
  const router      = useRouter()
  const searchParams = useSearchParams()

  const [tab,          setTab]          = useState<"email" | "phone">("email")
  const [email,        setEmail]        = useState("")
  const [password,     setPassword]     = useState("")
  const [phone,        setPhone]        = useState("")
  const [otp,          setOtp]          = useState("")
  const [otpSent,      setOtpSent]      = useState(false)
  const [loading,      setLoading]      = useState(false)
  const [loadingGoogle,setLoadingGoogle]= useState(false)
  const [loadingApple, setLoadingApple] = useState(false)
  const [error,        setError]        = useState("")
  const [showReset,    setShowReset]    = useState(false)
  const [resetEmail,   setResetEmail]   = useState("")
  const [resetLoading, setResetLoading] = useState(false)
  const [resetSent,    setResetSent]    = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        const redirect = searchParams.get("redirect")
        router.replace(redirect || "/dashboard")
      }
    })
  }, [router, searchParams])

  async function afterLogin(userId: string) {
    let onboardingDone = false
    try {
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("onboarding_completed")
        .eq("id", userId)
        .maybeSingle()
      onboardingDone = profile?.onboarding_completed === true
    } catch {}
    const redirect = searchParams.get("redirect")
    if (onboardingDone) {
      document.cookie = "onboarding_done=1; path=/; max-age=31536000"
      router.push(redirect || "/dashboard")
    } else {
      router.push("/onboarding")
    }
  }

  async function handleLogin() {
    if (!email.trim() || !password.trim()) { setError("Merci de remplir tous les champs."); return }
    setLoading(true); setError("")
    try {
      const { error: authError, data } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (authError) {
        const msg = authError.message.toLowerCase()
        if (msg.includes("invalid login") || msg.includes("invalid credentials")) setError("Email ou mot de passe incorrect.")
        else if (msg.includes("email not confirmed")) setError("Merci de confirmer ton email avant de te connecter.")
        else setError(authError.message)
        return
      }
      await afterLogin(data.user.id)
    } catch { setError("Une erreur inattendue s'est produite. Réessaie.") }
    finally { setLoading(false) }
  }

  async function handleSendOtp() {
    const cleaned = phone.replace(/\s/g, "")
    if (!cleaned) { setError("Entre ton numéro de téléphone."); return }
    setLoading(true); setError("")
    const { error } = await supabase.auth.signInWithOtp({ phone: cleaned })
    setLoading(false)
    if (error) { setError(error.message) } else { setOtpSent(true) }
  }

  async function handleVerifyOtp() {
    const cleaned = phone.replace(/\s/g, "")
    if (!otp.trim()) { setError("Entre le code reçu par SMS."); return }
    setLoading(true); setError("")
    const { error, data } = await supabase.auth.verifyOtp({ phone: cleaned, token: otp.trim(), type: "sms" })
    setLoading(false)
    if (error) { setError(error.message); return }
    if (data.user) await afterLogin(data.user.id)
  }

  async function handleGoogleLogin() {
    setLoadingGoogle(true); setError("")
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) { setError(error.message); setLoadingGoogle(false) }
  }

  async function handleAppleLogin() {
    setLoadingApple(true); setError("")
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "apple",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) { setError(error.message); setLoadingApple(false) }
  }

  async function handlePasswordReset() {
    if (!resetEmail.trim()) return
    setResetLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setResetLoading(false)
    if (error) { setError(error.message) } else { setResetSent(true) }
  }

  return (
    <div className="min-h-screen bg-[#080808] flex">

      {/* LEFT — Form */}
      <div className="flex-1 flex flex-col justify-center px-8 py-12 max-w-md mx-auto lg:mx-0 lg:px-16 w-full">

        {/* Header */}
        <div className="flex items-center justify-between mb-12">
          <a href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center" style={{ boxShadow: "0 0 16px rgba(34,197,94,0.3)" }}>
              <span className="text-black font-black text-sm">T</span>
            </div>
            <span className="text-white font-black text-lg">Tradex</span>
          </a>
          <a href="/" className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition font-semibold">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            Retour
          </a>
        </div>

        <h1 className="text-3xl font-black text-white mb-1">Bon retour 👋</h1>
        <p className="text-gray-500 mb-8 text-sm">Connecte-toi pour accéder à ton dashboard</p>

        {error && (
          <div className="bg-red-500/10 border border-red-500/25 text-red-400 px-4 py-3 rounded-xl mb-5 text-sm">
            {error}
          </div>
        )}

        {/* Social buttons */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <button onClick={handleGoogleLogin} disabled={loadingGoogle}
            className="flex items-center justify-center gap-2 bg-white/5 hover:bg-white/8 disabled:opacity-50 border border-white/10 text-white py-3 rounded-xl font-semibold transition text-sm">
            <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            {loadingGoogle ? "..." : "Google"}
          </button>
          <button onClick={handleAppleLogin} disabled={loadingApple}
            className="flex items-center justify-center gap-2 bg-white/5 hover:bg-white/8 disabled:opacity-50 border border-white/10 text-white py-3 rounded-xl font-semibold transition text-sm">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
            {loadingApple ? "..." : "Apple"}
          </button>
        </div>

        {/* Tabs: Email / Phone */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex-1 h-px bg-white/8" />
          <div className="flex bg-white/5 border border-white/8 rounded-lg p-0.5 gap-0.5">
            <button onClick={() => { setTab("email"); setError(""); setOtpSent(false) }}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${tab === "email" ? "bg-white/10 text-white" : "text-gray-600 hover:text-gray-400"}`}>
              Email
            </button>
            <button onClick={() => { setTab("phone"); setError(""); setOtpSent(false) }}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${tab === "phone" ? "bg-white/10 text-white" : "text-gray-600 hover:text-gray-400"}`}>
              📱 Téléphone
            </button>
          </div>
          <div className="flex-1 h-px bg-white/8" />
        </div>

        {/* Email form */}
        {tab === "email" && (
          <div className="space-y-4">
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block font-semibold uppercase tracking-wide">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && handleLogin()}
                placeholder="toi@email.com"
                className="w-full bg-[#111] border border-white/10 text-white px-4 py-3 rounded-xl focus:outline-none focus:border-green-500/50 transition text-sm placeholder-gray-700" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Mot de passe</label>
                <button onClick={() => setShowReset(true)} className="text-xs text-gray-600 hover:text-green-400 transition">Mot de passe oublié ?</button>
              </div>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handleLogin()}
                placeholder="••••••••"
                className="w-full bg-[#111] border border-white/10 text-white px-4 py-3 rounded-xl focus:outline-none focus:border-green-500/50 transition text-sm placeholder-gray-700" />
            </div>
            <button onClick={handleLogin} disabled={loading}
              className="w-full bg-green-500 hover:bg-green-400 disabled:opacity-50 text-black py-3 rounded-xl font-black transition-all shadow-lg shadow-green-500/25 mt-2 text-sm">
              {loading ? "Connexion..." : "Se connecter →"}
            </button>
          </div>
        )}

        {/* Phone form */}
        {tab === "phone" && (
          <div className="space-y-4">
            {!otpSent ? (
              <>
                <div>
                  <label className="text-xs text-gray-500 mb-1.5 block font-semibold uppercase tracking-wide">Numéro de téléphone</label>
                  <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSendOtp()}
                    placeholder="+33 6 12 34 56 78"
                    className="w-full bg-[#111] border border-white/10 text-white px-4 py-3 rounded-xl focus:outline-none focus:border-green-500/50 transition text-sm placeholder-gray-700" />
                  <p className="text-[11px] text-gray-700 mt-1.5">Format international requis : +33, +1, +44…</p>
                </div>
                <button onClick={handleSendOtp} disabled={loading}
                  className="w-full bg-green-500 hover:bg-green-400 disabled:opacity-50 text-black py-3 rounded-xl font-black transition-all shadow-lg shadow-green-500/25 text-sm">
                  {loading ? "Envoi..." : "Envoyer le code SMS →"}
                </button>
              </>
            ) : (
              <>
                <div>
                  <label className="text-xs text-gray-500 mb-1.5 block font-semibold uppercase tracking-wide">Code reçu par SMS</label>
                  <input type="text" inputMode="numeric" value={otp} onChange={e => setOtp(e.target.value)} onKeyDown={e => e.key === "Enter" && handleVerifyOtp()}
                    placeholder="123456" maxLength={6}
                    className="w-full bg-[#111] border border-white/10 text-white px-4 py-3 rounded-xl focus:outline-none focus:border-green-500/50 transition text-sm placeholder-gray-700 tracking-widest text-center text-lg" />
                  <p className="text-[11px] text-gray-700 mt-1.5 text-center">Code envoyé au {phone}</p>
                </div>
                <button onClick={handleVerifyOtp} disabled={loading}
                  className="w-full bg-green-500 hover:bg-green-400 disabled:opacity-50 text-black py-3 rounded-xl font-black transition-all shadow-lg shadow-green-500/25 text-sm">
                  {loading ? "Vérification..." : "Vérifier le code →"}
                </button>
                <button onClick={() => { setOtpSent(false); setOtp("") }} className="w-full text-xs text-gray-600 hover:text-gray-400 transition py-1">
                  Changer de numéro
                </button>
              </>
            )}
          </div>
        )}

        <p className="text-gray-600 text-sm text-center mt-8">
          Pas encore de compte ?{" "}
          <a href="/signup" className="text-green-400 hover:text-green-300 font-semibold">S'inscrire gratuitement</a>
        </p>

        {/* Password reset modal */}
        {showReset && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setShowReset(false)}>
            <div className="bg-[#111] border border-white/10 rounded-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
              <h3 className="text-white font-black text-lg mb-1">Réinitialiser le mot de passe</h3>
              <p className="text-gray-500 text-sm mb-4">Entre ton email pour recevoir un lien de réinitialisation.</p>
              {resetSent ? (
                <div className="text-center py-4">
                  <div className="text-3xl mb-2">📬</div>
                  <p className="text-green-400 font-semibold text-sm">Email envoyé ! Vérifie ta boîte mail.</p>
                  <button onClick={() => { setShowReset(false); setResetSent(false) }} className="mt-4 text-gray-500 text-xs hover:text-gray-300 transition">Fermer</button>
                </div>
              ) : (
                <>
                  <input type="email" value={resetEmail} onChange={e => setResetEmail(e.target.value)}
                    placeholder="toi@email.com"
                    className="w-full bg-[#0a0a0a] border border-white/10 text-white px-4 py-3 rounded-xl focus:outline-none focus:border-green-500/50 transition text-sm placeholder-gray-700 mb-3" />
                  <button onClick={handlePasswordReset} disabled={resetLoading || !resetEmail.trim()}
                    className="w-full bg-green-500 hover:bg-green-400 disabled:opacity-50 text-black py-2.5 rounded-xl font-black transition text-sm">
                    {resetLoading ? "Envoi..." : "Envoyer le lien"}
                  </button>
                  <button onClick={() => setShowReset(false)} className="w-full mt-2 text-gray-600 text-xs hover:text-gray-400 transition py-1">Annuler</button>
                </>
              )}
            </div>
          </div>
        )}
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
          <div className="grid grid-cols-2 gap-4 mb-12">
            {[["10 000+","Traders actifs"],["160+","Actifs scannés"],["98%","Satisfaction"],["15","Cours disponibles"]].map(([v,l]) => (
              <div key={l} className="bg-white/5 border border-white/8 rounded-xl p-4">
                <div className="text-2xl font-black text-green-400">{v}</div>
                <div className="text-xs text-gray-500 mt-0.5">{l}</div>
              </div>
            ))}
          </div>
          <div className="bg-white/5 border border-white/8 rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center font-black text-black text-sm">A</div>
              <div>
                <div className="text-white font-semibold text-sm">AlphaTrader92</div>
                <div className="text-yellow-400 text-xs">★★★★★</div>
              </div>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed">
              "Les signaux IA sont incroyables. J'ai fait +18% ce mois-ci grâce à Tradex."
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
