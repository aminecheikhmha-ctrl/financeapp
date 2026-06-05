"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"

type Signal = {
  symbol: string
  name: string
  price: number
  change: number
  signal: string
  confluence: number
  category: string
  sector?: string
  tp?: number
  sl?: number
}

const SIGNAL_META: Record<string, { emoji: string; label: string; color: string; bg: string }> = {
  STRONG_BUY:  { emoji: "⚡", label: "ACHAT FORT",  color: "#4ade80", bg: "rgba(34,197,94,0.12)" },
  BUY:         { emoji: "↗",  label: "ACHAT",        color: "#86efac", bg: "rgba(34,197,94,0.07)" },
  STRONG_SELL: { emoji: "⚡", label: "VENTE FORTE",  color: "#f87171", bg: "rgba(239,68,68,0.12)" },
  SELL:        { emoji: "↘",  label: "VENTE",         color: "#fca5a5", bg: "rgba(239,68,68,0.07)" },
  NEUTRAL:     { emoji: "→",  label: "NEUTRE",        color: "#9ca3af", bg: "rgba(255,255,255,0.04)" },
}

export default function FeedPage() {
  const router = useRouter()
  const [signals, setSignals] = useState<Signal[]>([])
  const [index,   setIndex]   = useState(0)
  const [loading, setLoading] = useState(true)
  const [swipeDir, setSwipeDir] = useState<"left" | "right" | null>(null)
  const [skipped,  setSkipped]  = useState(0)
  const [watched,  setWatched]  = useState(0)
  const startY = useRef(0)
  const startX = useRef(0)

  useEffect(() => {
    fetch("/api/screener?limit=50")
      .then(r => r.json())
      .then(d => {
        const filtered = (d.assets ?? []).filter((a: Signal) => a.signal !== "NEUTRAL")
        setSignals(filtered)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  function next(dir: "left" | "right") {
    setSwipeDir(dir)
    if (dir === "right") setWatched(w => w + 1)
    else setSkipped(s => s + 1)
    setTimeout(() => {
      setSwipeDir(null)
      setIndex(i => Math.min(i + 1, signals.length - 1))
    }, 280)
  }

  function onTouchStart(e: React.TouchEvent) {
    startY.current = e.touches[0].clientY
    startX.current = e.touches[0].clientX
  }
  function onTouchEnd(e: React.TouchEvent) {
    const dy = startY.current - e.changedTouches[0].clientY
    const dx = e.changedTouches[0].clientX - startX.current
    if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 50) {
      if (dy > 0) next("left")      // swipe up = skip
      else        setIndex(i => Math.max(0, i - 1))  // swipe down = back
    } else if (Math.abs(dx) > 50) {
      if (dx > 0) next("right")    // swipe right = interested
      else        next("left")     // swipe left = skip
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-green-400/30 border-t-green-400 rounded-full animate-spin mx-auto mb-3" />
        <p className="text-white/30 text-sm">Chargement des signaux…</p>
      </div>
    </div>
  )

  const signal = signals[index]
  const meta   = signal ? (SIGNAL_META[signal.signal] ?? SIGNAL_META.NEUTRAL) : null
  const isPos  = (signal?.change ?? 0) >= 0
  const done   = index >= signals.length

  return (
    <div className="min-h-screen flex flex-col items-center justify-center overflow-hidden relative select-none"
      style={{ background: "var(--bg-canvas)" }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}>

      {/* Progress bar */}
      <div className="fixed top-0 left-0 right-0 flex gap-0.5 p-2 z-20">
        {signals.slice(0, Math.min(signals.length, 20)).map((_, i) => (
          <div key={i} className="h-0.5 flex-1 rounded-full transition-all"
            style={{ background: i < index ? "#22c55e" : i === index ? "rgba(34,197,94,0.5)" : "rgba(255,255,255,0.1)" }} />
        ))}
      </div>

      {/* Header */}
      <div className="fixed top-6 left-4 right-4 flex items-center justify-between z-20">
        <div>
          <p className="text-xs font-black text-white/40 uppercase tracking-widest">📡 Signal Feed</p>
          <p className="text-[10px] text-white/20">{index + 1}/{signals.length} signaux</p>
        </div>
        <div className="flex gap-3">
          <div className="text-center">
            <p className="text-sm font-black text-green-400">{watched}</p>
            <p className="text-[9px] text-white/25">Suivis</p>
          </div>
          <div className="text-center">
            <p className="text-sm font-black text-white/30">{skipped}</p>
            <p className="text-[9px] text-white/25">Passés</p>
          </div>
        </div>
      </div>

      {done ? (
        <div className="text-center px-8">
          <p className="text-5xl mb-4">🎯</p>
          <p className="text-2xl font-black text-white mb-2">Feed terminé !</p>
          <p className="text-white/40 text-sm mb-6">Tu as vu {signals.length} signaux · {watched} t'intéressaient</p>
          <button onClick={() => { setIndex(0); setWatched(0); setSkipped(0) }}
            className="px-6 py-3 rounded-2xl font-black text-sm text-black"
            style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)" }}>
            ↺ Recommencer
          </button>
        </div>
      ) : signal && meta ? (
        <div
          className="relative w-full max-w-sm px-4 transition-all duration-280"
          style={{
            transform: swipeDir === "right" ? "translateX(120%) rotate(15deg)" :
                       swipeDir === "left"  ? "translateX(-120%) rotate(-15deg)" : "none",
            opacity: swipeDir ? 0 : 1,
          }}>

          {/* Card */}
          <div className="rounded-3xl p-6 relative overflow-hidden"
            style={{
              background: `linear-gradient(135deg, ${meta.bg.replace("0.12","0.15")}, rgba(0,0,0,0))`,
              border: `1px solid ${meta.color}25`,
              boxShadow: `0 0 60px ${meta.color}12, 0 20px 60px rgba(0,0,0,0.6)`,
            }}>

            {/* Glow */}
            <div className="absolute top-0 right-0 w-40 h-40 rounded-full blur-3xl opacity-15 pointer-events-none"
              style={{ background: meta.color }} />

            {/* Signal badge */}
            <div className="flex items-center justify-between mb-6">
              <span className="px-3 py-1.5 rounded-full text-xs font-black"
                style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.color}30` }}>
                {meta.emoji} {meta.label}
              </span>
              <div className="text-right">
                <p className="text-2xl font-black tabular-nums" style={{ color: meta.color }}>
                  {signal.confluence}%
                </p>
                <p className="text-[9px] text-white/25">Confluence</p>
              </div>
            </div>

            {/* Symbol + name */}
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black text-black flex-shrink-0"
                style={{ background: meta.color }}>
                {signal.symbol.replace("-USD","")[0]}
              </div>
              <div>
                <h2 className="text-3xl font-black text-white">{signal.symbol.replace("-USD","")}</h2>
                <p className="text-white/40 text-sm">{signal.name}</p>
                {signal.sector && <p className="text-[10px] text-white/20 mt-0.5">{signal.sector}</p>}
              </div>
            </div>

            {/* Price */}
            <div className="rounded-2xl p-4 mb-5"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="flex items-baseline justify-between">
                <p className="text-3xl font-black text-white tabular-nums">
                  ${signal.price < 1 ? signal.price.toFixed(4) : signal.price.toFixed(2)}
                </p>
                <p className={`text-lg font-black tabular-nums ${isPos ? "text-green-400" : "text-red-400"}`}>
                  {isPos ? "+" : ""}{signal.change.toFixed(2)}%
                </p>
              </div>
            </div>

            {/* TP / SL */}
            {(signal.tp || signal.sl) && (
              <div className="grid grid-cols-2 gap-2 mb-5">
                {signal.tp && (
                  <div className="rounded-xl p-3 text-center"
                    style={{ background: "rgba(34,197,94,0.07)", border: "1px solid rgba(34,197,94,0.15)" }}>
                    <p className="text-[9px] text-white/25 uppercase tracking-wider mb-1">Take Profit</p>
                    <p className="text-sm font-black text-green-400 tabular-nums">${Number(signal.tp).toFixed(2)}</p>
                  </div>
                )}
                {signal.sl && (
                  <div className="rounded-xl p-3 text-center"
                    style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.15)" }}>
                    <p className="text-[9px] text-white/25 uppercase tracking-wider mb-1">Stop Loss</p>
                    <p className="text-sm font-black text-red-400 tabular-nums">${Number(signal.sl).toFixed(2)}</p>
                  </div>
                )}
              </div>
            )}

            {/* Confidence bar */}
            <div>
              <div className="flex justify-between mb-1.5">
                <span className="text-[10px] text-white/25">Force du signal</span>
                <span className="text-[10px] font-black" style={{ color: meta.color }}>{signal.confluence}%</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
                <div className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${signal.confluence}%`, background: `linear-gradient(90deg, ${meta.color}88, ${meta.color})` }} />
              </div>
            </div>
          </div>

          {/* Swipe hints */}
          <div className="flex items-center justify-between mt-6 px-2">
            <div className="flex items-center gap-2 text-white/20">
              <span className="text-lg">←</span>
              <span className="text-xs">Passer</span>
            </div>
            <button onClick={() => router.push(`/dashboard?symbol=${signal.symbol}`)}
              className="px-5 py-2.5 rounded-2xl text-sm font-black text-black transition-all hover:scale-[1.02]"
              style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)" }}>
              Voir le graphe →
            </button>
            <div className="flex items-center gap-2 text-white/20">
              <span className="text-xs">Suivre</span>
              <span className="text-lg">→</span>
            </div>
          </div>
        </div>
      ) : null}

      {/* Action buttons — desktop */}
      {!done && signal && (
        <div className="fixed bottom-24 left-0 right-0 flex justify-center gap-6 z-20 md:bottom-10">
          <button onClick={() => next("left")}
            className="w-14 h-14 rounded-full flex items-center justify-center text-xl transition-all hover:scale-110"
            style={{ background: "rgba(239,68,68,0.12)", border: "2px solid rgba(239,68,68,0.3)", color: "#f87171" }}>
            ✕
          </button>
          <button onClick={() => router.push(`/dashboard?symbol=${signal.symbol}`)}
            className="w-14 h-14 rounded-full flex items-center justify-center text-xl transition-all hover:scale-110"
            style={{ background: "rgba(59,130,246,0.12)", border: "2px solid rgba(59,130,246,0.3)", color: "#60a5fa" }}>
            📊
          </button>
          <button onClick={() => next("right")}
            className="w-14 h-14 rounded-full flex items-center justify-center text-xl transition-all hover:scale-110"
            style={{ background: "rgba(34,197,94,0.12)", border: "2px solid rgba(34,197,94,0.3)", color: "#4ade80" }}>
            ♥
          </button>
        </div>
      )}

      {/* Instructions */}
      <p className="fixed bottom-6 left-0 right-0 text-center text-[10px] text-white/15 z-10">
        Swipe ← passer · Swipe → intéressant · Tap graphe pour trader
      </p>
    </div>
  )
}
