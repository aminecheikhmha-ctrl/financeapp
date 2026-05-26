"use client"

import { useEffect, useState } from "react"
import { haptic } from "@/lib/capacitor"

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

export default function PWAInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [show, setShow] = useState(false)

  useEffect(() => {
    // Déjà installée ou déjà refusée
    if (typeof window === "undefined") return
    if (localStorage.getItem("pwa_dismissed")) return
    if (window.matchMedia("(display-mode: standalone)").matches) return

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      // Affiche après 4 secondes pour ne pas interrompre immédiatement
      setTimeout(() => setShow(true), 4000)
    }

    window.addEventListener("beforeinstallprompt", handler)
    window.addEventListener("appinstalled", () => setShow(false))

    return () => window.removeEventListener("beforeinstallprompt", handler)
  }, [])

  async function install() {
    if (!deferredPrompt) return
    try { await haptic("medium") } catch {}
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === "accepted") setShow(false)
    setDeferredPrompt(null)
    setShow(false)
  }

  function dismiss() {
    localStorage.setItem("pwa_dismissed", "1")
    setShow(false)
  }

  if (!show) return null

  return (
    <div className="fixed bottom-20 md:bottom-6 left-4 right-4 md:left-auto md:right-6 md:w-80 z-40 animate-slide-up">
      <div
        className="rounded-2xl p-4 shadow-2xl"
        style={{
          background: "#0d0d0d",
          border: "1px solid rgba(34,197,94,0.2)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
        }}
      >
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 text-black font-black text-xl"
            style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)" }}
          >
            T
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-white">Installer TradEx</p>
            <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.4)" }}>
              Accès rapide depuis ton écran d&apos;accueil
            </p>
          </div>
          <button
            onClick={dismiss}
            className="text-xl w-7 h-7 flex items-center justify-center flex-shrink-0 transition"
            style={{ color: "rgba(255,255,255,0.2)" }}
            onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.7)")}
            onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.2)")}
            aria-label="Fermer"
          >
            ×
          </button>
        </div>
        <div className="flex gap-2">
          <button
            onClick={dismiss}
            className="flex-1 py-2 rounded-xl text-xs font-semibold transition"
            style={{ color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            Plus tard
          </button>
          <button
            onClick={install}
            className="flex-1 py-2 rounded-xl text-xs font-black text-black transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{ background: "#22c55e" }}
          >
            📲 Installer
          </button>
        </div>
      </div>
    </div>
  )
}
