"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

export default function ResetPassword() {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState("")

  async function handleReset() {
    setError("")
    if (password !== confirm) { setError("Les mots de passe ne correspondent pas"); return }
    if (password.length < 8) { setError("Minimum 8 caractères"); return }
    setLoading(true)
    const { error: err } = await supabase.auth.updateUser({ password })
    if (err) { setError(err.message); setLoading(false); return }
    setDone(true)
    setTimeout(() => router.push("/dashboard"), 2000)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--bg-canvas)" }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center text-2xl"
            style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)" }}>
            🔑
          </div>
          <h1 className="text-2xl font-black text-white">Nouveau mot de passe</h1>
          <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>Choisis un mot de passe sécurisé</p>
        </div>

        {done ? (
          <div className="text-center">
            <p className="text-5xl mb-4">✅</p>
            <p className="text-white font-bold text-lg">Mot de passe mis à jour !</p>
            <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>Redirection vers le dashboard...</p>
          </div>
        ) : (
          <div className="space-y-3">
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Nouveau mot de passe (8 car. min)"
              className="w-full px-4 py-3 rounded-xl text-white text-sm focus:outline-none transition"
              style={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)" }}
              onFocus={e => (e.currentTarget.style.borderColor = "rgba(34,197,94,0.5)")}
              onBlur={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
            />
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleReset()}
              placeholder="Confirmer le mot de passe"
              className="w-full px-4 py-3 rounded-xl text-white text-sm focus:outline-none transition"
              style={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)" }}
              onFocus={e => (e.currentTarget.style.borderColor = "rgba(34,197,94,0.5)")}
              onBlur={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
            />
            {error && <p className="text-red-400 text-sm px-1">{error}</p>}
            <button
              onClick={handleReset}
              disabled={loading || !password || !confirm}
              className="w-full py-3 rounded-xl font-black text-sm text-black transition-all disabled:opacity-50"
              style={{ background: "#22c55e" }}
            >
              {loading ? "Mise à jour..." : "Mettre à jour le mot de passe"}
            </button>
            <a href="/login" className="block text-center text-sm py-2 transition"
              style={{ color: "rgba(255,255,255,0.3)" }}
              onMouseEnter={e => (e.currentTarget.style.color = "white")}
              onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.3)")}>
              ← Retour à la connexion
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
