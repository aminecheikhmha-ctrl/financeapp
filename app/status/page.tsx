"use client"

import { useEffect, useState } from "react"

type ServiceStatus = {
  name: string
  key: string
  status: "up" | "down" | "degraded" | "checking"
  latency: number | null
  lastChecked: string
}

const SERVICES = [
  { name: "Base de données", key: "supabase", icon: "🗄️" },
  { name: "Yahoo Finance API", key: "yahoo", icon: "📈" },
  { name: "Groq AI", key: "groq", icon: "🤖" },
  { name: "Stripe", key: "stripe", icon: "💳" },
  { name: "Resend (Emails)", key: "resend", icon: "📧" },
]

export default function StatusPage() {
  const [statuses, setStatuses] = useState<ServiceStatus[]>(
    SERVICES.map(s => ({ ...s, status: "checking", latency: null, lastChecked: "" }))
  )
  const [lastUpdate, setLastUpdate] = useState("")
  const [checking, setChecking] = useState(true)

  async function checkServices() {
    setChecking(true)
    const checks = await Promise.all(
      SERVICES.map(async (service) => {
        const start = Date.now()
        try {
          let url = ""
          if (service.key === "yahoo") url = "/api/price?symbol=AAPL"
          else if (service.key === "supabase") url = "/api/user-profile"
          else if (service.key === "groq") url = "/api/ai/market-regime"
          else if (service.key === "stripe") url = "/api/stripe/checkout"
          else if (service.key === "resend") url = "/api/emails/welcome"
          else url = "/api/search?q=test"

          const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
          const latency = Date.now() - start
          // 401/403 = auth error but service is UP
          const up = res.status < 500
          return {
            ...service,
            status: up ? (latency > 2000 ? "degraded" : "up") : "down",
            latency,
            lastChecked: new Date().toLocaleTimeString("fr-FR"),
          } as ServiceStatus
        } catch {
          return {
            ...service,
            status: "down" as const,
            latency: null,
            lastChecked: new Date().toLocaleTimeString("fr-FR"),
          }
        }
      })
    )
    setStatuses(checks)
    setLastUpdate(new Date().toLocaleString("fr-FR"))
    setChecking(false)
  }

  useEffect(() => {
    checkServices()
    const interval = setInterval(checkServices, 60000)
    return () => clearInterval(interval)
  }, [])

  const allUp = statuses.every(s => s.status === "up")
  const anyDown = statuses.some(s => s.status === "down")
  const overallStatus = checking ? "checking" : anyDown ? "down" : allUp ? "up" : "degraded"

  const overallConfig = {
    checking: { label: "Vérification...", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20", dot: "bg-blue-400" },
    up:       { label: "Tous les systèmes opérationnels", color: "text-green-400", bg: "bg-green-500/10 border-green-500/20", dot: "bg-green-400" },
    degraded: { label: "Performances dégradées", color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20", dot: "bg-orange-400" },
    down:     { label: "Incident en cours", color: "text-red-400", bg: "bg-red-500/10 border-red-500/20", dot: "bg-red-400" },
  }[overallStatus]

  function statusConfig(s: "up" | "down" | "degraded" | "checking") {
    return {
      up:       { label: "Opérationnel", color: "text-green-400", badge: "bg-green-500/10 border-green-500/20" },
      down:     { label: "Incident", color: "text-red-400", badge: "bg-red-500/10 border-red-500/20" },
      degraded: { label: "Dégradé", color: "text-orange-400", badge: "bg-orange-500/10 border-orange-500/20" },
      checking: { label: "...", color: "text-gray-400", badge: "bg-white/5 border-white/10" },
    }[s]
  }

  return (
    <div className="min-h-screen bg-[#080808] text-white pb-20">
      <div className="max-w-2xl mx-auto px-4 pt-8 md:pt-12">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <a href="/dashboard" className="text-gray-600 hover:text-white transition text-sm">← Dashboard</a>
        </div>
        <h1 className="text-2xl md:text-3xl font-black text-white mb-1">Statut des services</h1>
        <p className="text-gray-500 text-sm mb-6">
          {lastUpdate ? `Dernière vérification : ${lastUpdate}` : "Vérification en cours..."}
        </p>

        {/* Overall status */}
        <div className={`border rounded-2xl p-5 mb-6 ${overallConfig.bg}`}>
          <div className="flex items-center gap-3">
            <div className="relative flex h-3 w-3 flex-shrink-0">
              {overallStatus === "up" && <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: "#4ade80" }} />}
              <span className={`relative inline-flex rounded-full h-3 w-3 ${overallConfig.dot}`} />
            </div>
            <p className={`font-bold text-base ${overallConfig.color}`}>{overallConfig.label}</p>
            <button
              onClick={checkServices}
              disabled={checking}
              className="ml-auto text-xs text-gray-500 hover:text-white transition disabled:opacity-50 px-3 py-1.5 bg-white/5 rounded-lg border border-white/10"
            >
              {checking ? "..." : "↻ Actualiser"}
            </button>
          </div>
        </div>

        {/* Services list */}
        <div className="space-y-3">
          {statuses.map((service, i) => {
            const cfg = statusConfig(service.status)
            const svc = SERVICES[i]
            return (
              <div key={service.key} className="bg-[#0f0f0f] border border-white/8 rounded-2xl px-5 py-4 flex items-center gap-4">
                <span className="text-2xl flex-shrink-0">{svc.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold text-sm">{service.name}</p>
                  {service.latency !== null && (
                    <p className="text-gray-600 text-xs">{service.latency}ms de latence</p>
                  )}
                  {service.lastChecked && (
                    <p className="text-gray-700 text-[10px]">Vérifié à {service.lastChecked}</p>
                  )}
                </div>
                <span className={`flex-shrink-0 text-xs font-bold px-3 py-1 rounded-full border ${cfg.badge} ${cfg.color}`}>
                  {cfg.label}
                </span>
              </div>
            )
          })}
        </div>

        {/* Info */}
        <div className="mt-8 bg-[#0f0f0f] border border-white/8 rounded-2xl p-5">
          <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-3">Informations</p>
          <div className="space-y-2 text-gray-400 text-sm">
            <p>🕐 Les vérifications sont effectuées toutes les 60 secondes depuis votre navigateur.</p>
            <p>📊 Les temps de réponse &lt; 500ms sont normaux, &lt; 2000ms acceptables.</p>
            <p>✉️ Pour signaler un incident : <a href="mailto:support@financeapp.io" className="text-green-400 hover:underline">support@financeapp.io</a></p>
          </div>
        </div>

        {/* Footer links */}
        <div className="mt-6 text-center">
          <a href="/legal/privacy" className="text-gray-700 hover:text-gray-500 text-xs mr-4">Confidentialité</a>
          <a href="/legal/terms" className="text-gray-700 hover:text-gray-500 text-xs">CGU</a>
        </div>
      </div>
    </div>
  )
}
