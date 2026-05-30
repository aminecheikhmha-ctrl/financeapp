"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"

// ── Types ──────────────────────────────────────────────────────────────────────

export interface TourStep {
  id:       string
  title:    string
  content:  string
  selector: string
  cardSide: "top" | "bottom" | "left" | "right"
  padding?: number
}

interface Rect { top: number; left: number; width: number; height: number }

interface Props {
  steps:      TourStep[]
  storageKey: string
  onComplete: () => void
}

// ── Per-page step configs ──────────────────────────────────────────────────────

export const DASHBOARD_TOUR_STEPS: TourStep[] = [
  {
    id: "watchlist",
    title: "🔖 Ta Watchlist",
    content: "Tes actifs favoris. Clique sur un actif pour charger son graphe et ses données en temps réel.",
    selector: "[data-tour='watchlist']",
    cardSide: "bottom",
    padding: 8,
  },
  {
    id: "chart",
    title: "📊 Le Graphe",
    content: "Évolution du prix en bougies japonaises. Vert = hausse, rouge = baisse. Utilise la souris pour zoomer.",
    selector: "[data-tour='chart']",
    cardSide: "top",
    padding: 4,
  },
  {
    id: "ia-tab",
    title: "🤖 Analyse IA",
    content: "Une analyse complète générée en un clic : tendance, signaux RSI/MACD, prédiction de prix.",
    selector: "[data-tour='ia-tab']",
    cardSide: "bottom",
    padding: 6,
  },
  {
    id: "buy-btn",
    title: "💰 Paper Trading",
    content: "Achète et vends en simulation — sans argent réel. Parfait pour apprendre sans risque.",
    selector: "[data-tour='buy-btn']",
    cardSide: "top",
    padding: 8,
  },
  {
    id: "alerts",
    title: "🔔 Alertes de prix",
    content: "Fixe un prix cible et reçois une notification dès qu'il est atteint.",
    selector: "[data-tour='alerts']",
    cardSide: "top",
    padding: 8,
  },
]

export const SIGNAUX_TOUR_STEPS: TourStep[] = [
  {
    id: "top-signals",
    title: "⭐ Meilleures opportunités",
    content: "Les 3 signaux avec le score de confluence le plus élevé. Ce sont les setups les plus solides du moment.",
    selector: "[data-tour='top-signals']",
    cardSide: "bottom",
    padding: 8,
  },
  {
    id: "signal-filters",
    title: "🔍 Filtres",
    content: "Filtre par direction (achat/vente), classe d'actif (actions, crypto, ETF) et trie par confiance, R/R ou variation.",
    selector: "[data-tour='signal-filters']",
    cardSide: "bottom",
    padding: 6,
  },
  {
    id: "signal-list",
    title: "📡 Feed de signaux",
    content: "Chaque carte montre le symbole, la direction, le score de confluence, TP/SL et RSI. Plus le score est élevé, plus la confluence technique est forte.",
    selector: "[data-tour='signal-list']",
    cardSide: "top",
    padding: 8,
  },
]

export const ANALYSES_TOUR_STEPS: TourStep[] = [
  {
    id: "analyses-tabs",
    title: "🗂️ Navigation par sections",
    content: "Clique sur une section pour y accéder directement. La section active est soulignée en vert.",
    selector: "[data-tour='analyses-tabs']",
    cardSide: "bottom",
    padding: 6,
  },
  {
    id: "snapshot-section",
    title: "🌡️ Snapshot Macro",
    content: "Le régime économique actuel calculé à partir du VIX, de la courbe des taux et du S&P 500.",
    selector: "[data-tour='snapshot-section']",
    cardSide: "bottom",
    padding: 8,
  },
  {
    id: "briefing-ia",
    title: "🤖 Briefing IA",
    content: "Analyse macro générée automatiquement par Groq — le verdict du jour en 2-3 phrases.",
    selector: "[data-tour='briefing-ia']",
    cardSide: "bottom",
    padding: 8,
  },
  {
    id: "market-table",
    title: "📈 Tables de marchés",
    content: "Clique sur les en-têtes (1J, 1S, 1M, YTD) pour trier. Clique sur une ligne pour ouvrir le graphe.",
    selector: "[data-tour='market-table']",
    cardSide: "top",
    padding: 8,
  },
]

export const PORTFOLIO_TOUR_STEPS: TourStep[] = [
  {
    id: "portfolio-stats",
    title: "💼 Vue d'ensemble",
    content: "Valeur totale du portfolio, P&L, cash disponible et performance YTD en temps réel.",
    selector: "[data-tour='portfolio-stats']",
    cardSide: "bottom",
    padding: 8,
  },
  {
    id: "portfolio-positions",
    title: "📊 Positions ouvertes",
    content: "Tes positions en cours avec le prix d'entrée, la valeur actuelle et le P&L par position.",
    selector: "[data-tour='portfolio-positions']",
    cardSide: "top",
    padding: 8,
  },
]

// ── Component ──────────────────────────────────────────────────────────────────

export default function Tour({ steps, storageKey, onComplete }: Props) {
  const [step,          setStep]          = useState(0)
  const [visible,       setVisible]       = useState(true)
  const [spotlightRect, setSpotlightRect] = useState<Rect | null>(null)
  const [windowSize,    setWindowSize]    = useState({ w: 0, h: 0 })

  const measureTarget = useCallback((stepIndex: number) => {
    const s = steps[stepIndex]
    if (!s) return

    const attempt = (retries: number) => {
      const el = document.querySelector(s.selector)
      if (!el) {
        // Retry up to 3 times with increasing delay
        if (retries < 3) setTimeout(() => attempt(retries + 1), 300 * (retries + 1))
        else setSpotlightRect(null)
        return
      }

      // Scroll element into view, then measure after animation settles
      el.scrollIntoView({ behavior: "smooth", block: "center" })
      setTimeout(() => {
        const r   = el.getBoundingClientRect()
        const pad = s.padding ?? 8
        setSpotlightRect({
          top:    r.top    - pad,
          left:   r.left   - pad,
          width:  r.width  + pad * 2,
          height: r.height + pad * 2,
        })
      }, 420)  // wait for smooth scroll
    }

    attempt(0)
  }, [steps])

  // Init
  useEffect(() => {
    if (localStorage.getItem(storageKey) === "1") {
      setVisible(false)
      return
    }
    setWindowSize({ w: window.innerWidth, h: window.innerHeight })
    const onResize = () => setWindowSize({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [storageKey])

  // Measure when step changes
  useEffect(() => {
    if (!visible) return
    const t = setTimeout(() => measureTarget(step), 150)
    return () => clearTimeout(t)
  }, [step, visible, measureTarget])

  function next() {
    if (step < steps.length - 1) setStep(s => s + 1)
    else complete()
  }

  function complete() {
    localStorage.setItem(storageKey, "1")
    setVisible(false)
    onComplete()
  }

  if (!visible) return null

  const current  = steps[step]
  const progress = ((step + 1) / steps.length) * 100
  const W = windowSize.w || (typeof window !== "undefined" ? window.innerWidth  : 1200)
  const H = windowSize.h || (typeof window !== "undefined" ? window.innerHeight : 800)

  // ── Card positioning ──
  const CARD_W = 300
  const CARD_H = 185
  const GAP    = 14

  let cardTop  = H / 2 - CARD_H / 2
  let cardLeft = W / 2 - CARD_W / 2

  if (spotlightRect) {
    const { top, left, width, height } = spotlightRect
    switch (current.cardSide) {
      case "bottom":
        cardTop  = top + height + GAP
        cardLeft = Math.min(Math.max(left + width / 2 - CARD_W / 2, 12), W - CARD_W - 12)
        break
      case "top":
        cardTop  = top - CARD_H - GAP
        cardLeft = Math.min(Math.max(left + width / 2 - CARD_W / 2, 12), W - CARD_W - 12)
        break
      case "left":
        cardTop  = Math.min(Math.max(top + height / 2 - CARD_H / 2, 12), H - CARD_H - 12)
        cardLeft = left - CARD_W - GAP
        break
      case "right":
        cardTop  = Math.min(Math.max(top + height / 2 - CARD_H / 2, 12), H - CARD_H - 12)
        cardLeft = left + width + GAP
        break
    }
    // Clamp to viewport
    cardTop  = Math.max(12, Math.min(cardTop,  H - CARD_H - 12))
    cardLeft = Math.max(12, Math.min(cardLeft, W - CARD_W - 12))
  }

  return (
    <>
      {/* ── Full-screen backdrop — pointer-events:all blocks chart scroll ── */}
      <div
        className="fixed inset-0 z-[9989]"
        style={{ pointerEvents: "all", cursor: "default" }}
        onWheel={e => e.stopPropagation()}
        onClick={e => e.stopPropagation()}
      />

      {/* ── Visual spotlight (SVG) — pointer-events:none, purely decorative ── */}
      <svg
        className="fixed inset-0 z-[9990] pointer-events-none select-none"
        style={{ top: 0, left: 0, width: "100vw", height: "100vh" }}
        width={W} height={H}
      >
        <defs>
          <mask id="tour-spotlight-mask">
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
        {/* Dark overlay with hole */}
        <rect width={W} height={H} fill="rgba(0,0,0,0.72)" mask="url(#tour-spotlight-mask)" />
        {/* Green glow ring around spotlight */}
        {spotlightRect && (
          <rect
            x={spotlightRect.left - 2}
            y={spotlightRect.top   - 2}
            width={spotlightRect.width  + 4}
            height={spotlightRect.height + 4}
            rx="11"
            fill="none"
            stroke="rgba(74,222,128,0.55)"
            strokeWidth="1.5"
          />
        )}
      </svg>

      {/* ── Tooltip card ── */}
      <div
        className="fixed z-[9995] pointer-events-auto"
        style={{ top: cardTop, left: cardLeft, width: CARD_W }}
      >
        <div
          className="rounded-2xl p-4 shadow-2xl"
          style={{
            background: "#111",
            border: "1px solid rgba(34,197,94,0.35)",
            boxShadow: "0 20px 60px rgba(0,0,0,0.7), 0 0 30px rgba(34,197,94,0.08)",
          }}
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-2">
            <h3 className="text-white font-black text-sm leading-tight">{current.title}</h3>
            <button
              onClick={complete}
              className="text-white/25 hover:text-white/60 text-lg leading-none ml-2 flex-shrink-0 transition"
              aria-label="Fermer"
            >×</button>
          </div>

          <p className="text-white/50 text-xs leading-relaxed mb-3">{current.content}</p>

          {/* Progress bar */}
          <div className="h-0.5 bg-white/5 rounded-full overflow-hidden mb-3">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progress}%`,
                background: "linear-gradient(90deg, #22c55e, #4ade80)",
              }}
            />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between">
            {/* Step dots */}
            <div className="flex gap-1">
              {steps.map((_, i) => (
                <div key={i}
                  className={`rounded-full transition-all ${
                    i === step ? "w-3 h-1.5 bg-green-400" : i < step ? "w-1.5 h-1.5 bg-green-400/35" : "w-1.5 h-1.5 bg-white/12"
                  }`}
                />
              ))}
            </div>
            <div className="flex gap-2 items-center">
              <button
                onClick={complete}
                className="text-[11px] text-white/25 hover:text-white/50 transition px-2 py-1"
              >
                Passer
              </button>
              <button
                onClick={next}
                className="text-[11px] font-black px-3 py-1.5 rounded-lg transition-all hover:scale-105 active:scale-95"
                style={{ background: "#22c55e", color: "#000" }}
              >
                {step < steps.length - 1 ? "Suivant →" : "Terminer 🎉"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
