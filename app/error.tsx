"use client"

import { useEffect } from "react"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Report to Sentry if installed
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Sentry = require("@sentry/nextjs")
      Sentry.captureException(error)
    } catch {}
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center p-6"
      style={{ background: "#050505" }}>
      <div className="max-w-md w-full text-center">

        {/* Animated icon */}
        <div className="relative w-24 h-24 mx-auto mb-6">
          <div className="absolute inset-0 rounded-3xl animate-ping opacity-20"
            style={{ background: "rgba(239,68,68,0.5)" }} />
          <div className="relative w-24 h-24 rounded-3xl flex items-center justify-center text-5xl"
            style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}>
            ⚡
          </div>
        </div>

        <h1 className="text-2xl font-black text-white mb-2">
          Quelque chose s&apos;est mal passé
        </h1>
        <p className="text-white/40 text-sm leading-relaxed mb-2">
          Une erreur inattendue est survenue. Notre équipe a été notifiée automatiquement.
        </p>
        {error.digest && (
          <p className="text-white/20 text-xs mb-6 font-mono">
            Code : {error.digest}
          </p>
        )}

        <div className="flex gap-3 justify-center">
          <button onClick={reset}
            className="px-5 py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-[1.02]"
            style={{ background: "#22c55e", color: "black" }}>
            ↻ Réessayer
          </button>
          <a href="/dashboard"
            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white/50 hover:text-white transition border border-white/10">
            ← Dashboard
          </a>
        </div>
      </div>
    </div>
  )
}
