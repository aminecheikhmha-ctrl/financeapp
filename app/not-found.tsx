export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-6 relative overflow-hidden"
      style={{ background: "transparent" }}>

      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 60% 60% at 50% 50%, rgba(34,197,94,0.06) 0%, transparent 70%)" }} />

      <div className="relative">
        {/* Giant 404 */}
        <p className="text-[160px] font-black leading-none select-none mb-0"
          style={{
            background: "linear-gradient(135deg, rgba(34,197,94,0.18), rgba(34,197,94,0.03))",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            letterSpacing: "-0.04em",
          }}>
          404
        </p>

        <h1 className="text-2xl font-black text-white mb-3 -mt-4"
          style={{ letterSpacing: "-0.02em" }}>
          Page not found
        </h1>
        <p className="text-sm max-w-xs mx-auto leading-relaxed mb-8"
          style={{ color: "rgba(255,255,255,0.35)", lineHeight: 1.7 }}>
          This page doesn&apos;t exist or has been moved.
          Head back to the dashboard to continue trading.
        </p>

        <div className="flex gap-3 justify-center">
          <a href="/dashboard"
            className="px-6 py-3 rounded-xl text-sm font-black text-black transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)", boxShadow: "0 4px 20px rgba(34,197,94,0.30)" }}>
            → Dashboard
          </a>
          <a href="/"
            className="px-6 py-3 rounded-xl text-sm font-semibold transition-all hover:text-white"
            style={{ color: "rgba(255,255,255,0.42)", border: "1px solid rgba(255,255,255,0.09)" }}>
            Home
          </a>
        </div>
      </div>
    </div>
  )
}
