"use client"

import { useEffect, useState } from "react"

type ServiceStatus = {
  name: string
  status: "operational" | "degraded" | "down" | "checking"
  latency?: number
  message?: string
  icon: string
}

const SERVICES: { name: string; icon: string; check: () => Promise<void> }[] = [
  {
    name: "API Yahoo Finance",
    icon: "📈",
    check: async () => {
      const res = await fetch("/api/quote?symbol=AAPL")
      if (!res.ok) throw new Error()
    },
  },
  {
    name: "Supabase Database",
    icon: "🗄️",
    check: async () => {
      const res = await fetch("/api/trading/account", { headers: { Authorization: "Bearer test" } })
      if (res.status === 500) throw new Error()
    },
  },
  {
    name: "Groq AI",
    icon: "🧠",
    check: async () => {
      const res = await fetch("/api/signals")
      if (!res.ok) throw new Error()
    },
  },
  {
    name: "Signaux IA",
    icon: "📡",
    check: async () => {
      const res = await fetch("/api/signals")
      if (!res.ok) throw new Error()
    },
  },
  {
    name: "News Feed",
    icon: "📰",
    check: async () => {
      const res = await fetch("/api/news")
      if (!res.ok) throw new Error()
    },
  },
]

const STATUS_CONFIG = {
  operational: { color: "#22c55e", bg: "rgba(34,197,94,0.1)",  border: "rgba(34,197,94,0.2)",  label: "Opérationnel", dot: "#22c55e" },
  degraded:    { color: "#f59e0b", bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.2)", label: "Dégradé",       dot: "#f59e0b" },
  down:        { color: "#ef4444", bg: "rgba(239,68,68,0.1)",  border: "rgba(239,68,68,0.2)",  label: "Hors ligne",   dot: "#ef4444" },
  checking:    { color: "#60a5fa", bg: "rgba(96,165,250,0.1)", border: "rgba(96,165,250,0.2)", label: "Vérification", dot: "#60a5fa" },
}

export default function StatusPage() {
  const [services, setServices] = useState<ServiceStatus[]>(
    SERVICES.map(s => ({ name: s.name, status: "checking" as const, icon: s.icon }))
  )
  const [lastCheck, setLastCheck] = useState<Date | null>(null)
  const [checking,  setChecking]  = useState(true)

  async function checkAll() {
    setChecking(true)
    setServices(prev => prev.map(s => ({ ...s, status: "checking" as const })))

    const results = await Promise.all(
      SERVICES.map(async (svc, i) => {
        const start = Date.now()
        try {
          await svc.check()
          const latency = Date.now() - start
          return { ...services[i], name: svc.name, icon: svc.icon, status: latency > 3000 ? "degraded" : "operational", latency } as ServiceStatus
        } catch {
          return { name: svc.name, icon: svc.icon, status: "down", latency: Date.now() - start, message: "Service indisponible" } as ServiceStatus
        }
      })
    )

    setServices(results)
    setLastCheck(new Date())
    setChecking(false)
  }

  useEffect(() => { checkAll() }, [])

  const allOperational = services.every(s => s.status === "operational")
  const hasDown        = services.some(s => s.status === "down")
  const overallStatus  = checking ? "checking" : hasDown ? "down" : allOperational ? "operational" : "degraded"
  const overall        = STATUS_CONFIG[overallStatus]

  return (
    <div className="min-h-screen page-enter" style={{ background: "var(--bg-canvas)" }}>
      <div className="max-w-2xl mx-auto px-6 py-12">

        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)" }}>
              <span className="text-black font-black">F</span>
            </div>
            <span className="font-black text-white text-xl">TradEx Status</span>
          </div>

          {/* Overall status badge */}
          <div className="inline-flex items-center gap-2.5 px-5 py-3 rounded-2xl mb-4"
            style={{ background: overall.bg, border: `1px solid ${overall.border}` }}>
            <span className="relative flex h-3 w-3">
              {overallStatus === "operational" && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                  style={{ background: overall.dot }} />
              )}
              <span className="relative inline-flex rounded-full h-3 w-3"
                style={{ background: overall.dot }} />
            </span>
            <span className="font-black text-sm" style={{ color: overall.color }}>
              {overallStatus === "operational" ? "Tous les systèmes opérationnels" :
               overallStatus === "degraded"    ? "Performances dégradées" :
               overallStatus === "checking"    ? "Vérification en cours..." :
               "Incident en cours"}
            </span>
          </div>

          {lastCheck && (
            <p className="text-xs text-white/25">
              Dernière vérification : {lastCheck.toLocaleTimeString("fr-FR")}
              <button onClick={checkAll} disabled={checking}
                className="ml-2 text-green-400 hover:text-green-300 transition disabled:opacity-40">
                ↻ Actualiser
              </button>
            </p>
          )}
        </div>

        {/* Services list */}
        <div className="rounded-2xl overflow-hidden mb-8"
          style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
          {services.map((service, i) => {
            const cfg = STATUS_CONFIG[service.status]
            return (
              <div key={service.name}
                className="flex items-center gap-4 px-5 py-4 hover:bg-white/[0.02] transition-colors"
                style={{ borderBottom: i < services.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>

                <span className="text-xl flex-shrink-0">{service.icon}</span>

                <div className="flex-1">
                  <p className="text-sm font-semibold text-white">{service.name}</p>
                  {service.message && (
                    <p className="text-[11px] mt-0.5" style={{ color: "#f87171" }}>{service.message}</p>
                  )}
                </div>

                {service.latency && service.status !== "checking" && (
                  <span className="text-[10px] text-white/25 tabular-nums">{service.latency}ms</span>
                )}

                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                  style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
                  {service.status === "checking" ? (
                    <div className="w-2 h-2 rounded-full border border-blue-400/50 border-t-blue-400 animate-spin" />
                  ) : (
                    <span className="w-2 h-2 rounded-full" style={{ background: cfg.dot }} />
                  )}
                  <span className="text-[10px] font-bold" style={{ color: cfg.color }}>{cfg.label}</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer CTA */}
        <div className="text-center">
          <a href="/dashboard"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-black transition-all hover:scale-[1.02]"
            style={{ background: "#22c55e" }}>
            → Aller au Dashboard
          </a>
        </div>
      </div>
    </div>
  )
}
