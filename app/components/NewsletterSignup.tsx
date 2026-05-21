"use client"

import { useState } from "react"

export default function NewsletterSignup({
  source = "blog",
  compact = false,
}: {
  source?: string
  compact?: boolean
}) {
  const [email, setEmail]       = useState("")
  const [loading, setLoading]   = useState(false)
  const [success, setSuccess]   = useState(false)
  const [error, setError]       = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), source }),
      })
      const json = await res.json()
      if (res.ok && json.success) {
        setSuccess(true)
        setEmail("")
      } else {
        setError(json.error ?? "Erreur lors de l'inscription")
      }
    } catch {
      setError("Erreur réseau — réessaie")
    }
    setLoading(false)
  }

  if (success) {
    return (
      <div className={`flex items-center gap-2 ${compact ? "py-2" : "py-4"}`}>
        <span className="text-green-400 text-lg">✅</span>
        <p className="text-green-400 font-semibold text-sm">Inscription confirmée ! Vérifie ta boîte mail.</p>
      </div>
    )
  }

  if (compact) {
    return (
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="ton@email.com"
          required
          className="flex-1 min-w-0 bg-white/5 border border-white/10 text-white px-3 py-2 rounded-lg text-xs focus:outline-none focus:border-green-500/40 placeholder-gray-600 transition"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-3 py-2 rounded-lg bg-green-500 hover:bg-green-400 disabled:opacity-50 text-black font-bold text-xs transition flex-shrink-0"
        >
          {loading ? "…" : "S'abonner"}
        </button>
        {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
      </form>
    )
  }

  return (
    <div className="rounded-2xl p-6" style={{ background: "rgba(34,197,94,0.05)", border: "1px solid rgba(34,197,94,0.15)" }}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">📡</span>
        <h3 className="text-white font-black text-base">Signaux gratuits chaque semaine</h3>
      </div>
      <p className="text-gray-400 text-sm mb-4">Reçois les meilleurs signaux de trading et les derniers articles directement dans ta boîte mail.</p>
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="ton@email.com"
          required
          className="flex-1 bg-white/5 border border-white/10 text-white px-4 py-3 rounded-xl text-sm focus:outline-none focus:border-green-500/40 placeholder-gray-600 transition"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-5 py-3 rounded-xl bg-green-500 hover:bg-green-400 disabled:opacity-50 text-black font-black text-sm transition shadow-lg shadow-green-500/20 flex-shrink-0"
        >
          {loading ? "Envoi…" : "Recevoir les signaux gratuits →"}
        </button>
      </form>
      {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
      <p className="text-gray-600 text-xs mt-2">Pas de spam. Désinscription en un clic.</p>
    </div>
  )
}
