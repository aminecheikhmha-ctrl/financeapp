"use client"

import { supabase } from "@/lib/supabase"
import { useEffect, useRef, useState } from "react"
import { createChart } from "lightweight-charts"

const DEFAULT_TICKERS = ["AAPL", "TSLA", "MSFT", "NVDA"]

type TickerData = {
  label: string
  value: string
  change: string
}

export default function Dashboard() {
  const chartRef = useRef<HTMLDivElement>(null)
  const chartInstance = useRef<any>(null)
  const seriesInstance = useRef<any>(null)
  const [ticker, setTicker] = useState("AAPL")
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [plan, setPlan] = useState<string>("free")
  const [user, setUser] = useState<any>(null)
  const [tickersData, setTickersData] = useState<TickerData[]>(
    DEFAULT_TICKERS.map((t) => ({ label: t, value: "...", change: "..." }))
  )

  useEffect(() => {
    if (!chartRef.current) return

    const chart = createChart(chartRef.current, {
      width: chartRef.current.clientWidth,
      height: 400,
      layout: {
        background: { color: "#111111" },
        textColor: "#9ca3af",
      },
      grid: {
        vertLines: { color: "#1f2937" },
        horzLines: { color: "#1f2937" },
      },
    })

    const series = chart.addAreaSeries({
      lineColor: "#22c55e",
      topColor: "#22c55e33",
      bottomColor: "#22c55e00",
      lineWidth: 2,
    })

    chartInstance.current = chart
    seriesInstance.current = series

    return () => chart.remove()
  }, [])

useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (data.user) {
        setUser(data.user)
        const { data: profile } = await supabase
          .from("profiles")
          .select("plan")
          .eq("email", data.user.email)
          .single()
        if (profile) setPlan(profile.plan)
      }
    })
  }, [])

  useEffect(() => {
    DEFAULT_TICKERS.forEach((t) => fetchCardData(t))
  }, [])

  useEffect(() => {
    fetchChartData(ticker)
  }, [ticker])

  async function fetchCardData(symbol: string) {
    try {
      const res = await fetch(`/api/quote?symbol=${symbol}`)
      const json = await res.json()
      if (json.error) return

    const change = json.change ?? 0
const isPositive = change >= 0
setTickersData((prev) =>
  prev.map((t) =>
    t.label === symbol
      ? {
          label: symbol,
          value: `$${(json.price ?? 0).toFixed(2)}`,
          change: `${isPositive ? "+" : ""}${change.toFixed(2)}%`,
        }
      : t
  )
)
    } catch (e) {
      console.error("Erreur carte", symbol)
    }
  }

  async function fetchChartData(symbol: string) {
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/api/chart?symbol=${symbol}`)
      const data = await res.json()

      if (data.error) {
        setError("Ticker introuvable.")
        setLoading(false)
        return
      }

      seriesInstance.current?.setData(data)
      chartInstance.current?.timeScale().fitContent()
    } catch (e) {
      setError("Erreur lors du chargement.")
    }
    setLoading(false)
  }

  function handleSearch(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && search.trim()) {
      setTicker(search.trim().toUpperCase())
      setSearch("")
    }
  }

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-6xl mx-auto">

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-gray-400 mt-1">Suis tes actifs en temps réel</p>
          </div>
          <div className="flex items-center gap-4">
            <span className={`text-xs px-3 py-1 rounded-full font-semibold uppercase ${
              plan === "premium" ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30" :
              plan === "pro" ? "bg-green-500/20 text-green-400 border border-green-500/30" :
              "bg-gray-500/20 text-gray-400 border border-gray-500/30"
            }`}>
              {plan === "free" ? "Free" : plan === "pro" ? "⭐ Pro" : "💎 Premium"}
            </span>
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleSearch}
            placeholder="Tape un ticker + Entrée (AAPL, TSLA...)"
            className="bg-gray-900 border border-gray-700 text-white px-4 py-2 rounded-lg w-80 focus:outline-none focus:border-green-500"
          />
        </div>

        <div className="grid grid-cols-4 gap-4 mb-8">
          {tickersData.map((item) => (
            <div
              key={item.label}
              onClick={() => setTicker(item.label)}
              className={`bg-gray-900 border rounded-xl p-4 cursor-pointer transition ${
                ticker === item.label
                  ? "border-green-500"
                  : "border-gray-800 hover:border-gray-600"
              }`}
            >
              <p className="text-gray-400 text-sm">{item.label}</p>
              <p className="text-white text-xl font-bold mt-1">{item.value}</p>
              <p className={`text-sm mt-1 ${
                item.change.startsWith("+") ? "text-green-400" : "text-red-400"
              }`}>
                {item.change}
              </p>
            </div>
          ))}
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">{ticker}</h2>
            {loading && <span className="text-gray-400 text-sm">Chargement...</span>}
            {error && <span className="text-red-400 text-sm">{error}</span>}
          </div>
          <div ref={chartRef} className="w-full" />
        </div>

      </div>
    </div>
  )
}