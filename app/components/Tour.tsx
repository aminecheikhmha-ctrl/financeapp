"use client"

import { useState, useEffect, useCallback } from "react"

interface TourStep {
  id: string
  title: string
  content: string
  selector: string
  cardSide: "top" | "bottom" | "left" | "right"
  padding?: number
}

const TOUR_STEPS: TourStep[] = [
  {
    id: "watchlist",
    title: "🔖 Ta Watchlist",
    content: "Ici tu retrouves les actifs que tu suis. Clique sur un actif pour charger son graphe et ses données en temps réel.",
    selector: "[data-tour='watchlist']",
    cardSide: "bottom",
    padding: 8,
  },
  {
    id: "chart",
    title: "📊 Le Graphe",
    content: "Ce graphe montre l'évolution du prix. Les bougies vertes = hausse, rouges = baisse. Tu peux zoomer et naviguer dans le temps.",
    selector: "[data-tour='chart']",
    cardSide: "top",
    padding: 4,
  },
  {
    id: "ia-tab",
    title: "🤖 L'IA TradEx",
    content: "Clique ici pour obtenir une analyse et une prédiction de prix générées par intelligence artificielle — en un clic.",
    selector: "[data-tour='ia-tab']",
    cardSide: "bottom",
    padding: 6,
  },
  {
    id: "buy-btn",
    title: "💰 Paper Trading",
    content: "Ce bouton te permet d'acheter en simulation — sans argent réel. Parfait pour apprendre sans aucun risque !",
    selector: "[data-tour='buy-btn']",
    cardSide: "top",
    padding: 8,
  },
  {
    id: "alerts",
    title: "🔔 Alertes de prix",
    content: "Configure ici des alertes pour être notifié quand un actif atteint un prix cible. Très utile pour ne rater aucune opportunité.",
    selector: "[data-tour='alerts']",
    cardSide: "top",
    padding: 8,
  },
]

interface Rect { top: number; left: number; width: number; height: number }

interface Props {
  onComplete: () => void
}

export default function Tour({ onComplete }: Props) {
  const [step, setStep] = useState(0)
  const [visible, setVisible] = useState(true)
  const [spotlightRect, setSpotlightRect] = useState<Rect | null>(null)
  const [windowSize, setWindowSize] = useState({ w: 0, h: 0 })

  const measureTarget = useCallback((stepIndex: number) => {
    const selector = TOUR_STEPS[stepIndex]?.selector
    if (!selector) return
    const el = document.querySelector(selector)
    if (!el) { setSpotlightRect(null); return }
    const r = el.getBoundingClientRect()
    const pad = TOUR_STEPS[stepIndex].padding ?? 8
    setSpotlightRect({
      top: r.top - pad,
      left: r.left - pad,
      width: r.width + pad * 2,
      height: r.height + pad * 2,
    })
    // Scroll element into view smoothly
    el.scrollIntoView({ behavior: "smooth", block: "center" })
  }, [])

  useEffect(() => {
    if (localStorage.getItem("tour_completed") === "1") {
      setVisible(false)
      return
    }
    setWindowSize({ w: window.innerWidth, h: window.innerHeight })
    const onResize = () => setWindowSize({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])

  useEffect(() => {
    if (!visible) return
    // Small delay so the DOM is ready
    const t = setTimeout(() => measureTarget(step), 150)
    return () => clearTimeout(t)
  }, [step, visible, measureTarget])

  function next() {
    if (step < TOUR_STEPS.length - 1) setStep(s => s + 1)
    else complete()
  }

  function complete() {
    localStorage.setItem("tour_completed", "1")
    setVisible(false)
    onComplete()
  }

  if (!visible) return null

  const current = TOUR_STEPS[step]
  const progress = ((step + 1) / TOUR_STEPS.length) * 100
  const W = windowSize.w || (typeof window !== "undefined" ? window.innerWidth : 1200)
  const H = windowSize.h || (typeof window !== "undefined" ? window.innerHeight : 800)

  // Card position logic
  const CARD_W = 320
  const CARD_H = 180
  const GAP = 16

  let cardTop = H / 2 - CARD_H / 2
  let cardLeft = W / 2 - CARD_W / 2

  if (spotlightRect) {
    const { top, left, width, height } = spotlightRect
    switch (current.cardSide) {
      case "bottom":
        cardTop = top + height + GAP
        cardLeft = Math.min(Math.max(left + width / 2 - CARD_W / 2, 12), W - CARD_W - 12)
        break
      case "top":
        cardTop = top - CARD_H - GAP
        cardLeft = Math.min(Math.max(left + width / 2 - CARD_W / 2, 12), W - CARD_W - 12)
        break
      case "left":
        cardTop = Math.min(Math.max(top + height / 2 - CARD_H / 2, 12), H - CARD_H - 12)
        cardLeft = left - CARD_W - GAP
        break
      case "right":
        cardTop = Math.min(Math.max(top + height / 2 - CARD_H / 2, 12), H - CARD_H - 12)
        cardLeft = left + width + GAP
        break
    }
    // Clamp to viewport
    cardTop = Math.max(12, Math.min(cardTop, H - CARD_H - 12))
    cardLeft = Math.max(12, Math.min(cardLeft, W - CARD_W - 12))
  }

  return (
    <>
      {/* SVG spotlight backdrop */}
      <svg
        className="fixed inset-0 z-[9990] pointer-events-none"
        style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh" }}
        width={W}
        height={H}
      >
        <defs>
          <mask id="tour-mask">
            <rect width={W} height={H} fill="white" />
            {spotlightRect && (
              <rect
                x={spotlightRect.left}
                y={spotlightRect.top}
                width={spotlightRect.width}
                height={spotlightRect.height}
                rx="10"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect width={W} height={H} fill="rgba(0,0,0,0.72)" mask="url(#tour-mask)" />
        {/* Glow ring around spotlight */}
        {spotlightRect && (
          <rect
            x={spotlightRect.left - 2}
            y={spotlightRect.top - 2}
            width={spotlightRect.width + 4}
            height={spotlightRect.height + 4}
            rx="11"
            fill="none"
            stroke="rgba(74,222,128,0.6)"
            strokeWidth="2"
          />
        )}
      </svg>

      {/* Tooltip card */}
      <div
        className="fixed z-[9995] pointer-events-auto"
        style={{ top: cardTop, left: cardLeft, width: CARD_W }}
      >
        <div className="bg-[#111] border border-green-500/40 rounded-2xl p-4 shadow-2xl shadow-green-500/10">
          {/* Header */}
          <div className="flex items-start justify-between mb-2">
            <h3 className="text-white font-black text-sm leading-tight">{current.title}</h3>
            <button
              onClick={complete}
              className="text-gray-600 hover:text-gray-400 text-lg leading-none ml-2 flex-shrink-0 transition"
              aria-label="Fermer le tutoriel"
            >×</button>
          </div>

          <p className="text-gray-400 text-xs leading-relaxed mb-3">{current.content}</p>

          {/* Progress bar */}
          <div className="h-1 bg-white/5 rounded-full overflow-hidden mb-3">
            <div
              className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between">
            <div className="flex gap-1">
              {TOUR_STEPS.map((_, i) => (
                <div key={i} className={`w-1.5 h-1.5 rounded-full transition-all ${i === step ? "bg-green-400 scale-125" : i < step ? "bg-green-400/40" : "bg-white/15"}`} />
              ))}
            </div>
            <div className="flex gap-2 items-center">
              <button onClick={complete} className="text-[11px] text-gray-600 hover:text-gray-400 transition px-2 py-1">
                Passer
              </button>
              <button
                onClick={next}
                className="text-[11px] font-bold px-3 py-1.5 rounded-lg bg-green-500 hover:bg-green-400 text-black transition"
              >
                {step < TOUR_STEPS.length - 1 ? "Suivant →" : "Terminer 🎉"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
