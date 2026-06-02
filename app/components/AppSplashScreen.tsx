"use client"

import { useEffect, useState } from "react"
import { isNative } from "@/lib/capacitor"

export default function AppSplashScreen() {
  const [visible, setVisible] = useState(true)
  const [fading, setFading] = useState(false)

  useEffect(() => {
    // Natif a son propre splash screen Capacitor
    if (isNative()) { setVisible(false); return }

    const fadeTimer = setTimeout(() => setFading(true), 1200)
    const hideTimer = setTimeout(() => setVisible(false), 1700)
    return () => { clearTimeout(fadeTimer); clearTimeout(hideTimer) }
  }, [])

  if (!visible) return null

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{
        background: "var(--bg-canvas)",
        opacity: fading ? 0 : 1,
        transition: "opacity 0.5s ease",
        pointerEvents: fading ? "none" : "all",
      }}
    >
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div
            className="absolute inset-0 rounded-3xl animate-ping"
            style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)", opacity: 0.2 }}
          />
          <div
            className="relative w-24 h-24 rounded-3xl flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, #22c55e, #16a34a)",
              boxShadow: "0 0 60px rgba(34,197,94,0.4)",
            }}
          >
            <span className="text-black font-black text-4xl">T</span>
          </div>
        </div>

        <div className="text-center">
          <p className="text-white font-black text-2xl tracking-tight">Tradex</p>
          <p className="text-white/30 text-xs mt-1">Trading intelligent avec l'IA</p>
        </div>

        <div className="w-32 h-0.5 rounded-full overflow-hidden mt-4" style={{ background: "rgba(255,255,255,0.08)" }}>
          <div
            className="h-full rounded-full bg-green-400"
            style={{ animation: "splash-bar 1.1s ease forwards" }}
          />
        </div>
      </div>
    </div>
  )
}
