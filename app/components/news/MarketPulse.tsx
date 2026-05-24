"use client"

import { useState, useEffect, useRef } from "react"

type Ticker = {
  symbol: string
  label: string
  price: number
  change: number
  flash: boolean
}

const TICKERS = [
  { symbol: "SPY", label: "S&P 500" },
  { symbol: "QQQ", label: "Nasdaq" },
  { symbol: "GLD", label: "Or" },
  { symbol: "%5EVIX", label: "VIX" },
]

function Skeleton() {
  return (
    <div className="grid grid-cols-2 gap-2 animate-pulse">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-14 rounded-xl bg-white/[0.03]" />
      ))}
    </div>
  )
}

export default function MarketPulse() {
  const [tickers, setTickers] = useState<Ticker[]>([])
  const [loading, setLoading] = useState(true)
  const prevPrices = useRef<Record<string, number>>({})

  async function fetchAll() {
    const results = await Promise.allSettled(
      TICKERS.map(async (t) => {
        const res = await fetch(`/api/price?symbol=${t.symbol}`)
        if (!res.ok) return null
        const data = await res.json()
        return { symbol: t.symbol, label: t.label, price: data.price ?? 0, change: data.change ?? 0 }
      })
    )

    setTickers(prev => {
      const next: Ticker[] = []
      results.forEach((r, i) => {
        if (r.status !== "fulfilled" || !r.value) {
          const existing = prev.find(p => p.symbol === TICKERS[i].symbol)
          next.push(existing ?? { symbol: TICKERS[i].symbol, label: TICKERS[i].label, price: 0, change: 0, flash: false })
          return
        }
        const { symbol, label, price, change } = r.value
        const prevPrice = prevPrices.current[symbol]
        const flash = prevPrice !== undefined && prevPrice !== price
        prevPrices.current[symbol] = price
        next.push({ symbol, label, price, change, flash })
      })
      return next
    })

    setLoading(false)

    // Clear flash after 1s
    setTimeout(() => {
      setTickers(prev => prev.map(t => ({ ...t, flash: false })))
    }, 1000)
  }

  useEffect(() => {
    fetchAll()
    const id = setInterval(fetchAll, 30000)
    return () => clearInterval(id)
  }, [])

  if (loading) return (
    <div className="rounded-3xl p-4" style={{ background: "#0d0d0d", border: "1px solid rgba(255,255,255,0.08)" }}>
      <p className="text-xs font-bold text-white/40 uppercase tracking-widest mb-3">⚡ Market Pulse</p>
      <Skeleton />
    </div>
  )

  return (
    <div
      className="rounded-3xl p-4"
      style={{ background: "#0d0d0d", border: "1px solid rgba(255,255,255,0.08)" }}
    >
      <div className="flex items-center gap-2 mb-3">
        <p className="text-xs font-bold text-white/40 uppercase tracking-widest">⚡ Market Pulse</p>
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
        </span>
        <span className="text-[9px] text-white/30">LIVE</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {tickers.map(t => {
          const isPos = t.change > 0
          const isNeg = t.change < 0
          const flashColor = t.flash ? (isPos ? "rgba(74,222,128,0.15)" : "rgba(239,68,68,0.15)") : "rgba(255,255,255,0.02)"

          return (
            <div
              key={t.symbol}
              className="rounded-xl p-3 transition-colors duration-300"
              style={{
                background: flashColor,
                border: "1px solid rgba(255,255,255,0.05)",
              }}
            >
              <p className="text-[10px] text-white/40 mb-1">{t.label}</p>
              <p className="text-sm font-black text-white">
                {t.price > 0 ? `$${t.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
              </p>
              {t.change !== 0 && (
                <p
                  className="text-[10px] font-bold mt-0.5"
                  style={{ color: isPos ? "#4ade80" : isNeg ? "#ef4444" : "#6b7280" }}
                >
                  {isPos ? "+" : ""}{t.change.toFixed(2)}%
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
