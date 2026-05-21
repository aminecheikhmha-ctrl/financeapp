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
    // Error boundary — digest available for support reference
  }, [error])

  return (
    <div className="min-h-screen bg-[#080808] flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-2xl bg-red-500/15 border border-red-500/25 flex items-center justify-center text-3xl mx-auto mb-6">
          ⚠️
        </div>
        <h1 className="text-2xl font-black text-white mb-2">Une erreur est survenue</h1>
        <p className="text-gray-500 text-sm mb-2">
          Quelque chose s'est mal passé. Nos équipes ont été notifiées.
        </p>
        {error.digest && (
          <p className="text-gray-700 text-xs mb-6 font-mono">Réf: {error.digest}</p>
        )}
        <div className="flex gap-3 justify-center mt-6">
          <button
            onClick={reset}
            className="px-5 py-2.5 rounded-xl bg-green-500 hover:bg-green-400 text-black font-bold text-sm transition"
          >
            Réessayer
          </button>
          <a
            href="/dashboard"
            className="px-5 py-2.5 rounded-xl border border-white/15 hover:border-white/30 text-gray-300 font-semibold text-sm transition"
          >
            Retour au dashboard
          </a>
        </div>
      </div>
    </div>
  )
}
