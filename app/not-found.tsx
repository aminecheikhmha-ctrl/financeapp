export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6"
      style={{ background: "#050505" }}>
      <div className="max-w-md w-full text-center">

        {/* Gradient 404 */}
        <div className="mb-8">
          <p className="text-[120px] font-black leading-none"
            style={{
              background: "linear-gradient(135deg, rgba(34,197,94,0.3), rgba(34,197,94,0.05))",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}>
            404
          </p>
        </div>

        <h1 className="text-2xl font-black text-white mb-3">
          Page introuvable
        </h1>
        <p className="text-white/40 text-sm leading-relaxed mb-8">
          Cette page n&apos;existe pas ou a été déplacée.
          Retourne au dashboard pour continuer à trader.
        </p>

        <div className="flex gap-3 justify-center">
          <a href="/dashboard"
            className="px-6 py-3 rounded-xl text-sm font-black text-black transition-all hover:scale-[1.02]"
            style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)" }}>
            → Dashboard
          </a>
          <a href="/"
            className="px-6 py-3 rounded-xl text-sm font-semibold text-white/50 hover:text-white transition border border-white/10">
            Accueil
          </a>
        </div>
      </div>
    </div>
  )
}
