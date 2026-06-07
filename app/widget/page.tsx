"use client"

import { useState } from "react"

const POPULAR = ["AAPL", "TSLA", "BTC-USD", "NVDA", "MSFT", "ETH-USD"]

export default function WidgetGeneratorPage() {
  const [symbol, setSymbol] = useState("AAPL")
  const [width,  setWidth]  = useState("240")
  const [height, setHeight] = useState("140")

  const url    = `${typeof window !== "undefined" ? window.location.origin : "https://tradex-kappa-six.vercel.app"}/widget/${symbol}`
  const iframe = `<iframe src="${url}" width="${width}" height="${height}" frameborder="0" style="border-radius:16px;overflow:hidden;" title="Tradex ${symbol} Widget"></iframe>`

  return (
    <div className="min-h-screen page-enter px-4 py-10 max-w-2xl mx-auto">
      <div className="mb-8">
        <p className="text-xs font-black text-green-400 uppercase tracking-widest mb-2">🧩 Widget embarquable</p>
        <h1 className="text-3xl font-black text-white mb-2">Intègre Tradex partout</h1>
        <p className="text-white/40 text-sm">Copie le code iframe et colle-le sur ton site, blog ou notion.</p>
      </div>

      {/* Config */}
      <div className="rounded-2xl p-5 mb-6 space-y-4" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-dim)" }}>
        <div>
          <label className="text-xs font-bold text-white/40 uppercase tracking-widest block mb-2">Actif</label>
          <div className="flex gap-2 flex-wrap mb-2">
            {POPULAR.map(s => (
              <button key={s} onClick={() => setSymbol(s)}
                className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
                style={symbol === s ? {
                  background: "rgba(34,197,94,0.15)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.3)"
                } : {
                  background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.08)"
                }}>
                {s}
              </button>
            ))}
          </div>
          <input
            value={symbol}
            onChange={e => setSymbol(e.target.value.toUpperCase())}
            placeholder="Ticker personnalisé (ex: GOOGL)"
            className="w-full px-3 py-2.5 rounded-xl text-sm text-white placeholder-white/20 outline-none font-bold"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Largeur (px)", val: width, set: setWidth },
            { label: "Hauteur (px)", val: height, set: setHeight },
          ].map(item => (
            <div key={item.label}>
              <label className="text-xs font-bold text-white/40 uppercase tracking-widest block mb-1.5">{item.label}</label>
              <input type="number" value={item.val} onChange={e => item.set(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-sm text-white outline-none tabular-nums"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }} />
            </div>
          ))}
        </div>
      </div>

      {/* Preview */}
      <div className="mb-6">
        <p className="text-xs font-bold text-white/30 uppercase tracking-widest mb-3">Aperçu</p>
        <div className="rounded-2xl p-6 flex items-center justify-center" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", minHeight: 180 }}>
          <iframe
            src={url}
            width={parseInt(width) || 240}
            height={parseInt(height) || 140}
            style={{ borderRadius: 16, border: "none", display: "block" }}
            title={`Widget ${symbol}`}
          />
        </div>
      </div>

      {/* Code */}
      <div>
        <p className="text-xs font-bold text-white/30 uppercase tracking-widest mb-2">Code à copier</p>
        <div className="rounded-2xl p-4 relative" style={{ background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.08)" }}>
          <pre className="text-xs text-green-400 whitespace-pre-wrap break-all font-mono leading-relaxed">{iframe}</pre>
          <button
            onClick={() => navigator.clipboard.writeText(iframe)}
            className="absolute top-3 right-3 px-3 py-1.5 rounded-lg text-xs font-black text-black transition-all hover:scale-[1.02]"
            style={{ background: "#22c55e" }}>
            Copier
          </button>
        </div>
      </div>
    </div>
  )
}
