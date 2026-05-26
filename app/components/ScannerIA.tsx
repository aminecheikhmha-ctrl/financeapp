"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"

const UP   = "#4ade80"
const DOWN = "#f87171"
const WARN = "#facc15"
const PURPLE = "#a78bfa"

type AssetFull = {
  symbol: string
  name: string
  category: "stock" | "crypto" | "etf"
  sector?: string
  price: number
  change_1d: number
  change_1w: number
  rsi: number
  ma20: number | null
  ma50: number | null
  macd_signal: "bullish" | "bearish" | "neutral"
  bb_position: "upper" | "middle" | "lower" | "above" | "below"
  confluence: number
  volume_ratio: number
  score: number
  signal: string
}

type ScanPattern = {
  id: string
  label: string
  icon: string
  description: string
  check: (a: AssetFull) => boolean
  color: string
}

const PATTERNS: ScanPattern[] = [
  {
    id: "rsi_oversold",
    label: "RSI Survente",
    icon: "📉",
    description: "RSI < 30 — zone de survente extrême, rebond potentiel",
    color: UP,
    check: (a) => a.rsi < 30,
  },
  {
    id: "rsi_overbought",
    label: "RSI Surachat",
    icon: "📈",
    description: "RSI > 70 — zone de surachat, correction probable",
    color: DOWN,
    check: (a) => a.rsi > 70,
  },
  {
    id: "macd_bullish",
    label: "MACD Haussier",
    icon: "⚡",
    description: "Croisement MACD bullish — momentum positif en cours",
    color: UP,
    check: (a) => a.macd_signal === "bullish",
  },
  {
    id: "macd_bearish",
    label: "MACD Baissier",
    icon: "💫",
    description: "Croisement MACD bearish — momentum négatif en cours",
    color: DOWN,
    check: (a) => a.macd_signal === "bearish",
  },
  {
    id: "bb_squeeze_low",
    label: "BB Bande Basse",
    icon: "🎯",
    description: "Prix sur bande de Bollinger inférieure — potentiel rebond",
    color: UP,
    check: (a) => a.bb_position === "lower" || a.bb_position === "below",
  },
  {
    id: "bb_squeeze_high",
    label: "BB Bande Haute",
    icon: "🔔",
    description: "Prix sur bande de Bollinger supérieure — potentiel retournement",
    color: WARN,
    check: (a) => a.bb_position === "upper" || a.bb_position === "above",
  },
  {
    id: "golden_cross",
    label: "Golden Cross",
    icon: "✨",
    description: "Prix au-dessus MA20 et MA50 avec MA20 > MA50 — tendance haussière confirmée",
    color: UP,
    check: (a) =>
      a.ma20 != null &&
      a.ma50 != null &&
      a.price > a.ma20 &&
      a.price > a.ma50 &&
      a.ma20 > a.ma50,
  },
  {
    id: "death_cross",
    label: "Death Cross",
    icon: "💀",
    description: "Prix sous MA20 et MA50 — tendance baissière confirmée",
    color: DOWN,
    check: (a) =>
      a.ma20 != null &&
      a.ma50 != null &&
      a.price < a.ma20 &&
      a.price < a.ma50,
  },
  {
    id: "high_volume",
    label: "Volume Élevé",
    icon: "🔥",
    description: "Volume > 2x la moyenne — forte activité institutionnelle",
    color: PURPLE,
    check: (a) => a.volume_ratio > 2,
  },
  {
    id: "confluence_high",
    label: "Haute Confluence",
    icon: "🔗",
    description: "Confluence ≥ 70% — multiple indicateurs alignés",
    color: UP,
    check: (a) => a.confluence >= 70,
  },
  {
    id: "strong_momentum",
    label: "Momentum Fort",
    icon: "🚀",
    description: "Hausse 1j > 3% avec volume élevé — breakout probable",
    color: UP,
    check: (a) => a.change_1d > 3 && a.volume_ratio > 1.5,
  },
  {
    id: "weekly_pullback",
    label: "Pullback Hebdo",
    icon: "🪝",
    description: "Variation 1S entre -5% et -2% avec RSI > 40 — dip achetable",
    color: WARN,
    check: (a) => a.change_1w < -2 && a.change_1w > -5 && a.rsi > 40,
  },
]

type ScanHit = AssetFull & { pattern: string; patternLabel: string; patternColor: string }

function HitCard({ hit, onClick }: { hit: ScanHit; onClick: () => void }) {
  const up = hit.change_1d >= 0
  const pattern = PATTERNS.find(p => p.id === hit.pattern)

  return (
    <div
      onClick={onClick}
      className="rounded-xl p-3.5 cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99]"
      style={{ background: "#0d0d0d", border: "1px solid #1a1a1a", borderLeft: `3px solid ${hit.patternColor}` }}
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-white font-black text-sm">{hit.symbol.replace("-USD", "")}</span>
            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold"
              style={{ background: "rgba(255,255,255,0.06)", color: "#666" }}>
              {hit.category === "stock" ? "Action" : hit.category === "crypto" ? "Crypto" : "ETF"}
            </span>
          </div>
          <p className="text-[10px] truncate max-w-[120px]" style={{ color: "#555" }}>{hit.name}</p>
        </div>
        <div className="text-right">
          <p className="text-white font-bold text-sm tabular-nums">
            {hit.price >= 1000 ? `$${hit.price.toLocaleString("en-US", { maximumFractionDigits: 0 })}` : `$${hit.price.toFixed(2)}`}
          </p>
          <p className="text-[11px] font-semibold tabular-nums" style={{ color: up ? UP : DOWN }}>
            {up ? "+" : ""}{hit.change_1d.toFixed(2)}%
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-xs">{pattern?.icon}</span>
        <span className="text-[10px] font-bold" style={{ color: hit.patternColor }}>{hit.patternLabel}</span>
      </div>

      <div className="flex items-center gap-3 text-[10px] font-mono">
        <span style={{ color: hit.rsi > 70 ? DOWN : hit.rsi < 30 ? UP : "#555" }}>RSI {hit.rsi}</span>
        <span style={{ color: hit.confluence >= 60 ? UP : "#555" }}>CF {hit.confluence}%</span>
        <span style={{ color: hit.volume_ratio > 1.5 ? PURPLE : "#555" }}>Vol {hit.volume_ratio.toFixed(1)}x</span>
      </div>
    </div>
  )
}

export default function ScannerIA({ assets }: { assets: AssetFull[] }) {
  const router = useRouter()
  const [selectedPatterns, setSelectedPatterns] = useState<Set<string>>(new Set())
  const [category, setCategory] = useState<"all" | "stock" | "crypto" | "etf">("all")
  const [summary, setSummary] = useState<string | null>(null)
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [ran, setRan] = useState(false)

  const togglePattern = useCallback((id: string) => {
    setSelectedPatterns(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    setSummary(null)
    setRan(false)
  }, [])

  const selectAll = useCallback(() => {
    setSelectedPatterns(new Set(PATTERNS.map(p => p.id)))
    setSummary(null)
    setRan(false)
  }, [])

  const clearAll = useCallback(() => {
    setSelectedPatterns(new Set())
    setSummary(null)
    setRan(false)
  }, [])

  const filtered = assets.filter(a => category === "all" || a.category === category)

  const hits: ScanHit[] = []
  for (const pattern of PATTERNS) {
    if (selectedPatterns.size > 0 && !selectedPatterns.has(pattern.id)) continue
    for (const asset of filtered) {
      if (pattern.check(asset)) {
        if (!hits.find(h => h.symbol === asset.symbol && h.pattern === pattern.id)) {
          hits.push({ ...asset, pattern: pattern.id, patternLabel: pattern.label, patternColor: pattern.color })
        }
      }
    }
  }

  // Deduplicate by symbol when showing all patterns (keep highest confluence)
  const deduped = selectedPatterns.size === 0
    ? hits
    : Array.from(
        hits.reduce((map, h) => {
          const existing = map.get(h.symbol)
          if (!existing || h.confluence > existing.confluence) map.set(h.symbol, h)
          return map
        }, new Map<string, ScanHit>()).values()
      )

  async function generateSummary() {
    if (deduped.length === 0) return
    setLoadingSummary(true)
    try {
      const res = await fetch("/api/scanner-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hits: deduped.slice(0, 8).map(h => ({
            symbol: h.symbol,
            name: h.name,
            pattern: h.patternLabel,
            signal: h.signal,
            score: h.score,
            rsi: h.rsi,
            change: h.change_1d,
            confluence: h.confluence,
          }))
        }),
      })
      const data = await res.json()
      setSummary(data.summary ?? null)
    } catch {}
    setLoadingSummary(false)
    setRan(true)
  }

  return (
    <div className="space-y-6">
      {/* Pattern selector */}
      <div className="rounded-2xl p-5" style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-black text-white">Patterns techniques</h3>
            <p className="text-[10px] mt-0.5" style={{ color: "#555" }}>Sélectionne les patterns à scanner</p>
          </div>
          <div className="flex gap-2">
            <button onClick={selectAll}
              className="text-[10px] font-bold px-3 py-1.5 rounded-lg transition"
              style={{ background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.2)", color: UP }}>
              Tout sélectionner
            </button>
            <button onClick={clearAll}
              className="text-[10px] font-bold px-3 py-1.5 rounded-lg transition"
              style={{ background: "#111", border: "1px solid #222", color: "#555" }}>
              Effacer
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {PATTERNS.map(p => {
            const active = selectedPatterns.has(p.id)
            return (
              <button key={p.id} onClick={() => togglePattern(p.id)}
                className="flex items-start gap-2.5 p-3 rounded-xl text-left transition-all"
                style={{
                  background: active ? `${p.color}15` : "#111",
                  border: `1px solid ${active ? `${p.color}40` : "#1a1a1a"}`,
                }}>
                <span className="text-base flex-shrink-0 mt-0.5">{p.icon}</span>
                <div>
                  <p className="text-[11px] font-bold leading-tight" style={{ color: active ? p.color : "#888" }}>{p.label}</p>
                  <p className="text-[9px] mt-0.5 leading-tight" style={{ color: "#444" }}>{p.description.split("—")[0]}</p>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Category + scan controls */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid #1a1a1a" }}>
          {([["all", "Tout"], ["stock", "Actions"], ["crypto", "Crypto"], ["etf", "ETF"]] as const).map(([key, label]) => (
            <button key={key} onClick={() => setCategory(key)}
              className="px-3 py-1.5 text-[11px] font-bold transition-all"
              style={{
                background: category === key ? "#1f2937" : "#0d0d0d",
                color: category === key ? "#60a5fa" : "#555",
              }}>
              {label}
            </button>
          ))}
        </div>

        <button onClick={generateSummary}
          disabled={loadingSummary || deduped.length === 0}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-black transition disabled:opacity-40"
          style={{ background: "rgba(167,139,250,0.15)", border: "1px solid rgba(167,139,250,0.3)", color: PURPLE }}>
          {loadingSummary ? (
            <><span className="w-3.5 h-3.5 border border-purple-400 border-t-transparent rounded-full animate-spin" /> Analyse en cours…</>
          ) : (
            <>🧠 Analyse IA ({deduped.length} actifs)</>
          )}
        </button>
      </div>

      {/* AI Summary */}
      {summary && (
        <div className="rounded-xl px-4 py-3.5 flex gap-3 items-start"
          style={{ background: "rgba(167,139,250,0.07)", border: "1px solid rgba(167,139,250,0.2)" }}>
          <span className="text-lg flex-shrink-0">🧠</span>
          <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.75)" }}>{summary}</p>
        </div>
      )}

      {/* Results */}
      {selectedPatterns.size === 0 && !ran ? (
        <div className="text-center py-12" style={{ color: "#444" }}>
          <p className="text-3xl mb-3">🔍</p>
          <p className="text-white font-bold mb-1">Sélectionne des patterns</p>
          <p className="text-sm">Choisis un ou plusieurs patterns ci-dessus pour lancer le scanner</p>
        </div>
      ) : deduped.length === 0 ? (
        <div className="text-center py-12" style={{ color: "#444" }}>
          <p className="text-3xl mb-3">📡</p>
          <p className="text-white font-bold mb-1">Aucun pattern détecté</p>
          <p className="text-sm">Élargis la sélection de patterns ou la catégorie d'actifs</p>
        </div>
      ) : (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: UP }} />
            <p className="text-[11px] font-black uppercase tracking-widest" style={{ color: "#555" }}>
              {deduped.length} actif{deduped.length > 1 ? "s" : ""} détecté{deduped.length > 1 ? "s" : ""}
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {deduped
              .sort((a, b) => b.confluence - a.confluence)
              .map(hit => (
                <HitCard
                  key={`${hit.symbol}-${hit.pattern}`}
                  hit={hit}
                  onClick={() => router.push(`/dashboard?symbol=${hit.symbol}`)}
                />
              ))}
          </div>
        </div>
      )}
    </div>
  )
}
