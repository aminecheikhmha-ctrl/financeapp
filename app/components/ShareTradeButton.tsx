"use client"

import { useState } from "react"

interface Props {
  symbol: string
  gainPct: number
  entryPrice: number
  exitPrice: number
  duration?: string
}

export default function ShareTradeButton({ symbol, gainPct, entryPrice, exitPrice, duration }: Props) {
  const [open, setOpen] = useState(false)

  const isWin = gainPct >= 0
  const sign = isWin ? "+" : ""
  const emoji = isWin ? "🚀" : "📉"

  const text = `${emoji} J'ai ${isWin ? "gagné" : "perdu"} ${sign}${gainPct.toFixed(2)}% sur ${symbol} avec TradEx !\n\nEntrée : $${entryPrice.toFixed(2)} → Sortie : $${exitPrice.toFixed(2)}${duration ? `\nDurée : ${duration}` : ""}\n\nTrader avec l'IA 👇`
  const url = "https://financeapp-kappa-six.vercel.app"
  const encoded = encodeURIComponent(text)
  const encodedUrl = encodeURIComponent(url)

  const shareLinks = [
    {
      name: "Twitter/X",
      icon: "𝕏",
      url: `https://twitter.com/intent/tweet?text=${encoded}&url=${encodedUrl}`,
      color: "hover:bg-black hover:text-white",
    },
    {
      name: "LinkedIn",
      icon: "in",
      url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}&summary=${encoded}`,
      color: "hover:bg-blue-700 hover:text-white",
    },
    {
      name: "WhatsApp",
      icon: "✉",
      url: `https://wa.me/?text=${encoded}%20${encodedUrl}`,
      color: "hover:bg-green-600 hover:text-white",
    },
  ]

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white text-xs font-semibold transition"
      >
        <span>↗</span>
        Partager
      </button>

      {open && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center px-4" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative bg-[#111] border border-white/10 rounded-2xl p-6 w-full max-w-sm"
            onClick={e => e.stopPropagation()}
            style={{ animation: "slideUp 0.2s ease-out" }}
          >
            <button onClick={() => setOpen(false)} className="absolute top-4 right-4 text-gray-600 hover:text-white text-xl">×</button>

            {/* Trade card preview */}
            <div className={`rounded-xl p-4 mb-5 border ${isWin ? "bg-green-500/10 border-green-500/20" : "bg-red-500/10 border-red-500/20"}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-white font-black text-lg">{symbol}</span>
                <span className={`text-2xl font-black ${isWin ? "text-green-400" : "text-red-400"}`}>
                  {sign}{gainPct.toFixed(2)}%
                </span>
              </div>
              <div className="flex justify-between text-xs text-gray-500">
                <span>Entrée: <span className="text-white">${entryPrice.toFixed(2)}</span></span>
                <span>Sortie: <span className="text-white">${exitPrice.toFixed(2)}</span></span>
              </div>
              {duration && <p className="text-xs text-gray-600 mt-1">Durée : {duration}</p>}
              <p className="text-xs text-gray-600 mt-2">Tradé sur TradEx 🤖</p>
            </div>

            <p className="text-gray-400 text-xs text-center mb-4">Partager sur</p>

            <div className="flex gap-3 justify-center">
              {shareLinks.map(link => (
                <a
                  key={link.name}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex flex-col items-center gap-1 px-4 py-3 rounded-xl border border-white/10 text-gray-400 font-bold transition text-sm ${link.color}`}
                >
                  <span className="text-lg">{link.icon}</span>
                  <span className="text-xs">{link.name}</span>
                </a>
              ))}
            </div>

            <style>{`@keyframes slideUp { from { transform: translateY(12px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }`}</style>
          </div>
        </div>
      )}
    </>
  )
}
