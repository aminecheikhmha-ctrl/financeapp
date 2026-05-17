import Link from "next/link"

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#080808] flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        {/* Animated 404 */}
        <div className="relative mb-8">
          <p className="text-[120px] font-black leading-none text-white/5 select-none">404</p>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-20 h-20 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
              <svg
                className="w-10 h-10 text-green-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z"
                />
              </svg>
            </div>
          </div>
        </div>

        <h1 className="text-2xl font-black text-white mb-3">Page introuvable</h1>
        <p className="text-gray-500 text-sm mb-8 leading-relaxed">
          Cette page n&apos;existe pas ou a été déplacée.<br />
          Pas de panique, votre portefeuille est en sécurité.
        </p>

        {/* Subtle animated line */}
        <div className="h-px bg-gradient-to-r from-transparent via-green-500/30 to-transparent mb-8" />

        <div className="flex gap-3 justify-center">
          <Link
            href="/dashboard"
            className="px-5 py-2.5 rounded-xl bg-green-500 hover:bg-green-400 text-black font-bold text-sm transition"
          >
            Dashboard
          </Link>
          <Link
            href="/"
            className="px-5 py-2.5 rounded-xl border border-white/15 hover:border-white/30 text-gray-300 font-semibold text-sm transition"
          >
            Accueil
          </Link>
        </div>
      </div>
    </div>
  )
}
