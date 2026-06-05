"use client"

import { useRef, useState } from "react"

type Props = {
  username: string
  portfolioValue: number
  totalPnl: number
  totalPnlPct: number
  winRate?: number
  trades?: number
  bestSymbol?: string
  avatarColor?: string
  onClose: () => void
}

export default function SharePnLCard({
  username, portfolioValue, totalPnl, totalPnlPct,
  winRate, trades, bestSymbol, avatarColor = "#22c55e", onClose
}: Props) {
  const cardRef  = useRef<HTMLDivElement>(null)
  const [copying, setCopying] = useState(false)
  const isPos = totalPnl >= 0

  async function downloadCard() {
    if (!cardRef.current) return
    setCopying(true)
    try {
      const { default: html2canvas } = await import("html2canvas")
      const canvas = await html2canvas(cardRef.current, {
        scale: 2,
        backgroundColor: null,
        useCORS: true,
        logging: false,
      })
      const link = document.createElement("a")
      link.download = `tradex-${username}-pnl.png`
      link.href = canvas.toDataURL("image/png")
      link.click()
    } catch {}
    setCopying(false)
  }

  async function copyToClipboard() {
    if (!cardRef.current) return
    setCopying(true)
    try {
      const { default: html2canvas } = await import("html2canvas")
      const canvas = await html2canvas(cardRef.current, { scale: 2, backgroundColor: null, useCORS: true, logging: false })
      canvas.toBlob(async (blob) => {
        if (blob) await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })])
      })
    } catch {}
    setCopying(false)
  }

  const tweetText = encodeURIComponent(
    `Mon portfolio Tradex ${isPos ? "📈" : "📉"} ${isPos ? "+" : ""}${totalPnlPct.toFixed(2)}% sur $${portfolioValue.toLocaleString()}\n\n${winRate ? `Taux de réussite : ${winRate.toFixed(0)}%\n` : ""}Rejoins-moi sur tradex-kappa-six.vercel.app 🚀 #Tradex #Trading`
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md space-y-4" onClick={e => e.stopPropagation()}>

        {/* The card itself */}
        <div ref={cardRef}
          className="relative overflow-hidden rounded-3xl p-6"
          style={{
            background: isPos
              ? "linear-gradient(135deg, #030d03 0%, #051405 50%, #020802 100%)"
              : "linear-gradient(135deg, #0d0303 0%, #140505 50%, #080202 100%)",
            border: `1px solid ${isPos ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)"}`,
            boxShadow: isPos
              ? "0 0 80px rgba(34,197,94,0.15), 0 20px 60px rgba(0,0,0,0.8)"
              : "0 0 80px rgba(239,68,68,0.15), 0 20px 60px rgba(0,0,0,0.8)",
          }}>

          {/* Background glow */}
          <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl opacity-10 pointer-events-none"
            style={{ background: isPos ? "#22c55e" : "#ef4444" }} />

          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-lg font-black text-black"
                style={{ background: avatarColor }}>
                {username[0]?.toUpperCase() ?? "T"}
              </div>
              <div>
                <p className="text-sm font-black text-white">{username}</p>
                <p className="text-xs text-white/30">Tradex Paper Trader</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-[9px] text-white/40 font-bold uppercase tracking-wider">Live</span>
            </div>
          </div>

          {/* Main P&L */}
          <div className="text-center mb-6">
            <p className="text-xs text-white/30 uppercase tracking-widest mb-1">Portfolio total</p>
            <p className="text-4xl font-black text-white tabular-nums mb-2">
              ${portfolioValue.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </p>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl"
              style={{
                background: isPos ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
                border: `1px solid ${isPos ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
              }}>
              <span className={`text-2xl font-black tabular-nums ${isPos ? "text-green-400" : "text-red-400"}`}>
                {isPos ? "▲" : "▼"} {isPos ? "+" : ""}{totalPnlPct.toFixed(2)}%
              </span>
              <span className={`text-sm font-bold tabular-nums ${isPos ? "text-green-400/70" : "text-red-400/70"}`}>
                ({isPos ? "+" : ""}${Math.abs(totalPnl).toFixed(0)})
              </span>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[
              { label: "Capital initial", value: "$100,000" },
              winRate !== undefined ? { label: "Win rate", value: `${winRate.toFixed(0)}%` } : { label: "Trades", value: String(trades ?? 0) },
              bestSymbol ? { label: "Meilleur actif", value: bestSymbol } : { label: "Gain total", value: `$${Math.abs(totalPnl).toFixed(0)}` },
            ].map((s, i) => (
              <div key={i} className="text-center rounded-2xl p-3"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <p className="text-[8px] text-white/25 uppercase tracking-widest mb-1">{s.label}</p>
                <p className="text-sm font-black text-white tabular-nums">{s.value}</p>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center font-black text-xs text-black"
                style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)" }}>T</div>
              <span className="text-xs font-black text-white/40">tradex-kappa-six.vercel.app</span>
            </div>
            <p className="text-[9px] text-white/20">Paper trading · Not financial advice</p>
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-3 gap-2">
          <button onClick={downloadCard} disabled={copying}
            className="py-3 rounded-2xl text-xs font-black transition-all hover:scale-[1.02] disabled:opacity-50"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)" }}>
            📥 Télécharger
          </button>
          <button onClick={copyToClipboard} disabled={copying}
            className="py-3 rounded-2xl text-xs font-black transition-all hover:scale-[1.02] disabled:opacity-50"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)" }}>
            📋 Copier
          </button>
          <a href={`https://twitter.com/intent/tweet?text=${tweetText}`} target="_blank" rel="noopener"
            className="py-3 rounded-2xl text-xs font-black text-center transition-all hover:scale-[1.02] flex items-center justify-center"
            style={{ background: "rgba(29,161,242,0.15)", border: "1px solid rgba(29,161,242,0.3)", color: "#1da1f2" }}>
            𝕏 Tweeter
          </a>
        </div>

        <button onClick={onClose} className="w-full text-xs text-white/20 hover:text-white/50 transition py-1">
          Fermer
        </button>
      </div>
    </div>
  )
}
