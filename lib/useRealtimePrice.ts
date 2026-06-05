"use client"

import { useEffect, useRef, useState } from "react"

/**
 * Hook who polls price every `intervalMs` ms (default 2000ms).
 * Falls back to polling since Supabase Realtime doesn't push Yahoo Finance prices.
 * For a true realtime, connect to a WebSocket price feed (Alpaca/Polygon) here.
 */
export function useRealtimePrice(symbol: string, intervalMs = 2000) {
  const [price,  setPrice]  = useState<number | null>(null)
  const [change, setChange] = useState<number>(0)
  const [flash,  setFlash]  = useState<"up" | "down" | null>(null)
  const prevRef = useRef<number>(0)
  const active  = useRef(true)

  useEffect(() => {
    active.current = true
    prevRef.current = 0

    async function tick() {
      if (!active.current) return
      try {
        const res = await fetch(`/api/price?symbol=${symbol}`, { cache: "no-store" })
        if (!res.ok || !active.current) return
        const data = await res.json()
        if (data.price != null && active.current) {
          const newPrice = data.price
          if (prevRef.current > 0 && newPrice !== prevRef.current) {
            const dir = newPrice > prevRef.current ? "up" : "down"
            setFlash(dir)
            setTimeout(() => setFlash(null), 600)
          }
          prevRef.current = newPrice
          setPrice(newPrice)
          setChange(data.change ?? 0)
        }
      } catch {}
      if (active.current) setTimeout(tick, intervalMs)
    }

    tick()
    return () => { active.current = false }
  }, [symbol, intervalMs])

  return { price, change, flash }
}
