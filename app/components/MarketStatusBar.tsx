"use client"
import { useEffect, useState } from "react"
import { getMarketStatus, formatTimeUntilOpen, type MarketStatus } from "@/lib/market-hours"

type Props = {
  symbol: string
  showDetail?: boolean
}

export default function MarketStatusBar({ symbol, showDetail = false }: Props) {
  const [status,    setStatus]    = useState<MarketStatus>(() => getMarketStatus(symbol))
  const [countdown, setCountdown] = useState("")

  // Refresh market status every 30s
  useEffect(() => {
    setStatus(getMarketStatus(symbol))
    const interval = setInterval(() => setStatus(getMarketStatus(symbol)), 30000)
    return () => clearInterval(interval)
  }, [symbol])

  // Live countdown (every second)
  useEffect(() => {
    if (!status.nextOpen || status.isOpen) { setCountdown(""); return }
    const update = () => {
      const diff = status.nextOpen!.getTime() - Date.now()
      if (diff <= 0) { setStatus(getMarketStatus(symbol)); return }
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setCountdown(h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`)
    }
    update()
    const timer = setInterval(update, 1000)
    return () => clearInterval(timer)
  }, [status.nextOpen, status.isOpen, symbol])

  const sessionLabel =
    status.session === "pre-market"  ? "PRÉ-MARCHÉ" :
    status.session === "after-hours" ? "AFTER-HOURS" :
    status.session === "weekend"     ? "WEEKEND" :
    status.isOpen                    ? "OUVERT" : "FERMÉ"

  const accentColor =
    status.isOpen                    ? "#4ade80" :
    status.session === "pre-market" ||
    status.session === "after-hours" ? "#fbbf24" :
    "rgba(255,255,255,0.35)"

  if (!showDetail) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
        style={{
          background: status.isOpen ? "rgba(34,197,94,0.1)" : "rgba(255,255,255,0.05)",
          border: `1px solid ${status.isOpen ? "rgba(34,197,94,0.25)" : "rgba(255,255,255,0.10)"}`,
        }}>
        {status.isOpen ? (
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-400" />
          </span>
        ) : (
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: accentColor }} />
        )}
        <span className="text-[10px] font-bold tabular-nums" style={{ color: accentColor }}>
          {sessionLabel}
        </span>
        {!status.isOpen && countdown && (
          <span className="text-[10px] text-white/20 tabular-nums">{countdown}</span>
        )}
        {status.isOpen && status.timeUntilClose && (
          <span className="text-[10px] text-white/20 tabular-nums">
            Ferme dans {formatTimeUntilOpen(status.timeUntilClose)}
          </span>
        )}
      </div>
    )
  }

  // Detailed version
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl"
      style={{
        background: status.isOpen ? "rgba(34,197,94,0.06)" : "rgba(255,255,255,0.03)",
        border: `1px solid ${status.isOpen ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.07)"}`,
      }}>
      <div className="flex items-center gap-1.5">
        {status.isOpen ? (
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400" />
          </span>
        ) : (
          <span className="w-2 h-2 rounded-full" style={{ background: accentColor }} />
        )}
        <span className="text-xs font-bold" style={{ color: accentColor }}>{status.market}</span>
      </div>

      <span className="text-[11px] text-white/30 flex-1">{status.message}</span>

      {!status.isOpen && countdown && (
        <span className="text-[11px] font-black text-white/50 tabular-nums">{countdown}</span>
      )}
      {status.isOpen && status.timeUntilClose && (
        <span className="text-[11px] text-white/25 tabular-nums">
          Ferme dans {formatTimeUntilOpen(status.timeUntilClose)}
        </span>
      )}
    </div>
  )
}
