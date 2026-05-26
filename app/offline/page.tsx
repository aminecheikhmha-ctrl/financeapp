"use client"

export default function OfflinePage() {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: "#050505" }}
    >
      <div className="max-w-sm text-center">
        <div
          className="w-20 h-20 rounded-3xl mx-auto mb-6 flex items-center justify-center text-4xl"
          style={{
            background: "rgba(96,165,250,0.1)",
            border: "1px solid rgba(96,165,250,0.2)",
          }}
        >
          📡
        </div>
        <h1 className="text-2xl font-black text-white mb-3">Mode hors ligne</h1>
        <p className="text-sm leading-relaxed mb-6" style={{ color: "rgba(255,255,255,0.4)" }}>
          Tu n&apos;es pas connecté à Internet. Les données en temps réel ne sont
          pas disponibles, mais tu peux consulter les données mises en cache.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-3 rounded-xl font-black text-sm text-black transition-all hover:scale-[1.02] active:scale-[0.98]"
          style={{ background: "#22c55e" }}
        >
          ↻ Réessayer
        </button>
        <a
          href="/dashboard"
          className="block mt-3 text-sm transition"
          style={{ color: "rgba(255,255,255,0.3)" }}
          onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.7)")}
          onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.3)")}
        >
          ← Retour au dashboard
        </a>
      </div>
    </div>
  )
}
