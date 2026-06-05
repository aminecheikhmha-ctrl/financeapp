"use client"

import { useState } from "react"

const ENDPOINTS = [
  {
    method: "GET",
    path: "/api/v1/signals",
    desc: "Récupère les signaux IA en temps réel pour tous les actifs.",
    params: [
      { name: "api_key", type: "string", required: true,  desc: "Ta clé API" },
      { name: "limit",   type: "number", required: false, desc: "Nombre de signaux (max 50, défaut 10)" },
      { name: "symbol",  type: "string", required: false, desc: "Filtrer par symbole ex: AAPL" },
    ],
    example: `curl "https://tradex-kappa-six.vercel.app/api/v1/signals?api_key=YOUR_KEY&limit=5"`,
    response: `{
  "success": true,
  "count": 5,
  "signals": [
    {
      "symbol": "NVDA",
      "price": 923.5,
      "change_24h": 3.2,
      "signal": "STRONG_BUY",
      "confluence": 89,
      "tp": 960.0,
      "sl": 895.0
    }
  ]
}`,
  },
  {
    method: "GET",
    path: "/api/v1/quote",
    desc: "Prix en temps réel pour un actif.",
    params: [
      { name: "symbol",  type: "string", required: true, desc: "Symbole Yahoo Finance (ex: AAPL, BTC-USD)" },
      { name: "api_key", type: "string", required: true, desc: "Ta clé API" },
    ],
    example: `curl "https://tradex-kappa-six.vercel.app/api/v1/quote?symbol=AAPL&api_key=YOUR_KEY"`,
    response: `{
  "success": true,
  "quote": {
    "symbol": "AAPL",
    "price": 198.30,
    "change": 1.1,
    "high": 199.5,
    "low": 196.2,
    "volume": 52000000
  }
}`,
  },
]

const METHOD_COLORS: Record<string, string> = {
  GET:    "rgba(34,197,94,0.15)",
  POST:   "rgba(96,165,250,0.15)",
  DELETE: "rgba(239,68,68,0.15)",
}

export default function ApiDocsPage() {
  const [copied, setCopied] = useState<string | null>(null)

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="min-h-screen page-enter">
      <div className="max-w-3xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="mb-8">
          <p className="text-xs font-black text-blue-400 uppercase tracking-widest mb-1">🔌 API Publique</p>
          <h1 className="text-2xl font-black text-white mb-2">Tradex API v1</h1>
          <p className="text-white/40 text-sm">Intègre les signaux Tradex dans tes propres outils, bots et applications.</p>
        </div>

        {/* Auth */}
        <div className="rounded-2xl p-5 mb-6" style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.15)" }}>
          <p className="text-sm font-black text-yellow-400 mb-2">🔑 Authentification</p>
          <p className="text-sm text-white/60 mb-3">
            Passe ta clé API via le header <code className="text-yellow-400 bg-white/5 px-1.5 py-0.5 rounded text-xs font-mono">X-Api-Key</code> ou le query param <code className="text-yellow-400 bg-white/5 px-1.5 py-0.5 rounded text-xs font-mono">api_key</code>.
          </p>
          <a href="/parametres" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black transition-all hover:scale-[1.02]"
            style={{ background: "rgba(251,191,36,0.15)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.25)" }}>
            Obtenir ma clé API →
          </a>
        </div>

        {/* Base URL */}
        <div className="rounded-2xl p-4 mb-6" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <p className="text-xs text-white/30 mb-1">Base URL</p>
          <code className="text-green-400 font-mono text-sm">https://tradex-kappa-six.vercel.app</code>
        </div>

        {/* Endpoints */}
        <div className="space-y-6">
          {ENDPOINTS.map((ep, i) => (
            <div key={i} className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>

              {/* Endpoint header */}
              <div className="flex items-center gap-3 px-5 py-4" style={{ background: "var(--bg-surface)" }}>
                <span className="px-2.5 py-1 rounded-lg text-xs font-black font-mono"
                  style={{ background: METHOD_COLORS[ep.method] ?? "rgba(255,255,255,0.1)", color: ep.method === "GET" ? "#4ade80" : ep.method === "POST" ? "#60a5fa" : "#f87171" }}>
                  {ep.method}
                </span>
                <code className="text-white font-mono text-sm">{ep.path}</code>
              </div>

              <div className="px-5 py-4 border-t border-white/5">
                <p className="text-sm text-white/60 mb-4">{ep.desc}</p>

                {/* Params */}
                <p className="text-xs font-black text-white/25 uppercase tracking-widest mb-2">Paramètres</p>
                <div className="space-y-1.5 mb-4">
                  {ep.params.map(p => (
                    <div key={p.name} className="flex items-start gap-3 px-3 py-2 rounded-xl text-sm"
                      style={{ background: "rgba(255,255,255,0.03)" }}>
                      <code className="text-blue-400 font-mono text-xs w-24 flex-shrink-0 mt-0.5">{p.name}</code>
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-bold flex-shrink-0"
                        style={{ background: p.required ? "rgba(239,68,68,0.12)" : "rgba(255,255,255,0.06)", color: p.required ? "#f87171" : "rgba(255,255,255,0.3)" }}>
                        {p.required ? "requis" : "optionnel"}
                      </span>
                      <span className="text-white/40 text-xs">{p.desc}</span>
                    </div>
                  ))}
                </div>

                {/* Example */}
                <p className="text-xs font-black text-white/25 uppercase tracking-widest mb-2">Exemple</p>
                <div className="rounded-xl p-3 mb-4 relative" style={{ background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <code className="text-green-400 text-xs font-mono break-all">{ep.example}</code>
                  <button onClick={() => copy(ep.example, `ex-${i}`)}
                    className="absolute top-2 right-2 px-2 py-1 rounded-lg text-[10px] font-black transition-all hover:scale-[1.02]"
                    style={{ background: copied === `ex-${i}` ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.06)", color: copied === `ex-${i}` ? "#4ade80" : "rgba(255,255,255,0.3)" }}>
                    {copied === `ex-${i}` ? "✓" : "Copier"}
                  </button>
                </div>

                {/* Response */}
                <p className="text-xs font-black text-white/25 uppercase tracking-widest mb-2">Réponse</p>
                <pre className="rounded-xl p-3 text-xs text-white/50 font-mono overflow-x-auto"
                  style={{ background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.06)" }}>
                  {ep.response}
                </pre>
              </div>
            </div>
          ))}
        </div>

        {/* Rate limits */}
        <div className="rounded-2xl p-5 mt-6" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-dim)" }}>
          <p className="text-sm font-black text-white mb-3">Limites d'utilisation</p>
          <div className="space-y-2">
            {[
              { plan: "Free",    limit: "100 requêtes/jour",   color: "#9ca3af" },
              { plan: "Pro",     limit: "1 000 requêtes/jour", color: "#4ade80" },
              { plan: "Premium", limit: "10 000 requêtes/jour",color: "#fbbf24" },
            ].map(r => (
              <div key={r.plan} className="flex items-center justify-between">
                <span className="text-sm font-bold" style={{ color: r.color }}>{r.plan}</span>
                <span className="text-sm text-white/50">{r.limit}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
