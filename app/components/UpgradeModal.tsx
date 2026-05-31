"use client"
import { useEffect } from "react"
import { useLanguage } from "@/lib/i18n/context"

interface Props {
  open: boolean
  onClose: () => void
  context?: "signals" | "analysis" | "alerts" | "screener" | "watchlist" | "courses" | "backtest"
}

export default function UpgradeModal({ open, onClose, context = "signals" }: Props) {
  const { t } = useLanguage()

  const TRANSLATED_CONTEXTS: Record<string, { title: string; desc: string; icon: string }> = {
    signals:  t.upgradeModal.signals,
    analysis: t.upgradeModal.analysis,
    alerts:   t.upgradeModal.alerts,
    coach:    t.upgradeModal.coach,
  }

  const ctx = TRANSLATED_CONTEXTS[context] ?? t.upgradeModal.default

  useEffect(() => {
    if (open) document.body.style.overflow = "hidden"
    else document.body.style.overflow = ""
    return () => { document.body.style.overflow = "" }
  }, [open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center px-0 sm:px-4"
      style={{ animation: "fadeIn 0.15s ease-out" }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div
        className="relative w-full max-w-[95vw] sm:max-w-md bg-[#0f0f0f] border border-white/10 rounded-t-2xl sm:rounded-2xl overflow-hidden mx-auto"
        style={{ animation: "slideUp 0.2s ease-out" }}
      >
        {/* Green gradient top */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-green-500 via-emerald-400 to-green-500" />

        {/* Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-green-500/10 blur-3xl pointer-events-none" />

        <div className="relative p-6">
          {/* Close */}
          <button onClick={onClose} className="absolute top-4 right-4 text-gray-600 hover:text-white transition text-xl">×</button>

          {/* Icon */}
          <div className="w-16 h-16 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center text-3xl mx-auto mb-5">
            {ctx.icon}
          </div>

          <h2 className="text-xl font-black text-white text-center mb-2">{ctx.title}</h2>
          <p className="text-gray-400 text-sm text-center mb-6">{ctx.desc}</p>

          {/* Features */}
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4 mb-5 space-y-2">
            {(t.upgradeModal.features as readonly string[]).map(f => (
              <div key={f} className="flex items-center gap-2 text-sm">
                <span className="text-green-400 font-bold flex-shrink-0">✓</span>
                <span className="text-gray-300">{f}</span>
              </div>
            ))}
          </div>

          {/* Price */}
          <div className="text-center mb-5">
            <span className="text-gray-500 text-sm">À partir de </span>
            <span className="text-white font-black text-2xl">14,99€</span>
            <span className="text-gray-500 text-sm">/mois</span>
          </div>

          {/* CTAs */}
          <a
            href="/pricing"
            className="block w-full text-center py-3 rounded-xl bg-green-500 hover:bg-green-400 text-black font-black text-sm transition mb-2"
          >
            {t.upgradeModal.cta.replace("{price}", "14,99")}
          </a>
          <button
            onClick={onClose}
            className="block w-full text-center py-2 text-gray-600 hover:text-gray-400 text-sm transition"
          >
            {t.common.later}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp { from { transform: translateY(16px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
      `}</style>
    </div>
  )
}
