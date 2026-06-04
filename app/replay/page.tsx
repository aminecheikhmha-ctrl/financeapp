"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"

type Bar = { date: string; open: number; high: number; low: number; close: number; volume: number }

const SYMBOLS = ["AAPL", "TSLA", "NVDA", "MSFT", "BTC-USD", "SPY", "ETH-USD"]
const SPEEDS  = [
  { key: 1000, label: "1×" },
  { key: 500,  label: "2×" },
  { key: 200,  label: "5×" },
  { key: 100,  label: "10×" },
]

async function fetchBars(symbol: string): Promise<Bar[]> {
  const end   = Math.floor(Date.now() / 1000)
  const start = end - 365 * 24 * 3600
  const url   = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&period1=${start}&period2=${end}`
  const res   = await fetch(`/api/proxy-yahoo?url=${encodeURIComponent(url)}`)
  const json  = await res.json()
  const r     = json?.chart?.result?.[0]
  if (!r) return []
  const ts: number[] = r.timestamp ?? []
  const q  = r.indicators?.quote?.[0] ?? {}
  return ts.map((t, i) => ({
    date:   new Date(t * 1000).toLocaleDateString("fr-FR", { month: "short", day: "numeric" }),
    open:   q.open?.[i]   ?? 0,
    high:   q.high?.[i]   ?? 0,
    low:    q.low?.[i]    ?? 0,
    close:  q.close?.[i]  ?? 0,
    volume: q.volume?.[i] ?? 0,
  })).filter(b => b.close > 0)
}

export default function ReplayPage() {
  const [symbol,   setSymbol]   = useState("AAPL")
  const [bars,     setBars]     = useState<Bar[]>([])
  const [loading,  setLoading]  = useState(false)
  const [cursor,   setCursor]   = useState(30)
  const [playing,  setPlaying]  = useState(false)
  const [speed,    setSpeed]    = useState(500)
  const [cash,     setCash]     = useState(10000)
  const [position, setPosition] = useState<{ qty: number; avgPrice: number } | null>(null)
  const [trades,   setTrades]   = useState<{ date: string; type: string; price: number; pnl?: number }[]>([])
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadBars = useCallback(async () => {
    setLoading(true)
    setPlaying(false)
    setCursor(30)
    setCash(10000)
    setPosition(null)
    setTrades([])
    const data = await fetchBars(symbol)
    setBars(data)
    setLoading(false)
  }, [symbol])

  useEffect(() => { loadBars() }, [loadBars])

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (!playing) return
    intervalRef.current = setInterval(() => {
      setCursor(c => {
        if (c >= bars.length - 1) { setPlaying(false); return c }
        return c + 1
      })
    }, speed)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [playing, speed, bars.length])

  const visible = bars.slice(0, cursor + 1)
  const current = bars[cursor]
  const prevBar = bars[cursor - 1]
  const change  = current && prevBar ? ((current.close - prevBar.close) / prevBar.close) * 100 : 0
  const isPos   = change >= 0
  const portValue = cash + (position ? position.qty * (current?.close ?? 0) : 0)
  const totalPnl  = portValue - 10000

  function buy() {
    if (!current || cash < current.close) return
    const qty = Math.floor(cash * 0.5 / current.close)
    if (qty <= 0) return
    const cost = qty * current.close
    setCash(c => c - cost)
    setPosition(p => p ? { qty: p.qty + qty, avgPrice: (p.avgPrice * p.qty + cost) / (p.qty + qty) } : { qty, avgPrice: current.close })
    setTrades(t => [...t, { date: current.date, type: "BUY", price: current.close }])
  }

  function sell() {
    if (!current || !position) return
    const proceeds = position.qty * current.close
    const pnl = ((current.close - position.avgPrice) / position.avgPrice) * 100
    setCash(c => c + proceeds)
    setTrades(t => [...t, { date: current.date, type: "SELL", price: current.close, pnl }])
    setPosition(null)
  }

  return (
    <div className="min-h-screen page-enter">
      <div className="max-w-5xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="mb-6">
          <p className="text-xs font-black text-green-400 uppercase tracking-widest mb-1">⏪ Replay historique</p>
          <h1 className="text-2xl font-black text-white mb-1">Rejoue le marché</h1>
          <p className="text-white/35 text-sm">Entraîne-toi sur l'historique réel — sans spoiler sur le futur.</p>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap gap-3 mb-5 items-center">
          {/* Symbol */}
          <div className="flex gap-1.5 flex-wrap">
            {SYMBOLS.map(s => (
              <button key={s} onClick={() => { setSymbol(s) }} disabled={loading}
                className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all disabled:opacity-40"
                style={symbol === s ? { background: "rgba(34,197,94,0.15)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.3)" }
                  : { background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.08)" }}>
                {s}
              </button>
            ))}
          </div>

          <div className="h-4 w-px bg-white/10" />

          {/* Speed */}
          <div className="flex gap-1 items-center">
            <span className="text-xs text-white/30 mr-1">Vitesse</span>
            {SPEEDS.map(sp => (
              <button key={sp.key} onClick={() => setSpeed(sp.key)}
                className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all"
                style={speed === sp.key ? { background: "rgba(96,165,250,0.15)", color: "#60a5fa", border: "1px solid rgba(96,165,250,0.3)" }
                  : { background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.3)", border: "1px solid rgba(255,255,255,0.07)" }}>
                {sp.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Chart + playback */}
          <div className="lg:col-span-2 space-y-3">

            {/* Stats */}
            {current && (
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: "Jour", value: current.date },
                  { label: "Prix", value: `$${current.close.toFixed(2)}` },
                  { label: "Variation", value: `${isPos ? "+" : ""}${change.toFixed(2)}%`, color: isPos ? "#4ade80" : "#f87171" },
                  { label: "Progress", value: `${cursor + 1}/${bars.length}` },
                ].map(s => (
                  <div key={s.label} className="rounded-xl p-2.5" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-dim)" }}>
                    <p className="text-[9px] text-white/25 uppercase tracking-widest">{s.label}</p>
                    <p className="text-sm font-black tabular-nums" style={s.color ? { color: s.color } : { color: "rgba(255,255,255,0.8)" }}>{s.value}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Chart */}
            <div className="rounded-2xl p-4" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-dim)" }}>
              {loading ? (
                <div className="h-48 flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-green-400/30 border-t-green-400 rounded-full animate-spin" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={visible} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="rpGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={isPos ? "#22c55e" : "#ef4444"} stopOpacity={0.2} />
                        <stop offset="95%" stopColor={isPos ? "#22c55e" : "#ef4444"} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" tick={{ fill: "#555", fontSize: 9 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fill: "#555", fontSize: 9 }} tickLine={false} axisLine={false} tickFormatter={v => `$${v.toFixed(0)}`} domain={["auto","auto"]} />
                    <Tooltip contentStyle={{ background: "#111", border: "1px solid #222", borderRadius: 8, fontSize: 11 }}
                      formatter={(v: any) => [`$${Number(v).toFixed(2)}`, "Prix"]} />
                    <Area type="monotone" dataKey="close" stroke={isPos ? "#22c55e" : "#ef4444"} strokeWidth={2} fill="url(#rpGrad)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Playback controls */}
            <div className="flex items-center gap-2">
              <button onClick={() => setCursor(c => Math.max(30, c - 1))} disabled={playing || cursor <= 30}
                className="px-3 py-2.5 rounded-xl text-sm font-black text-white/50 hover:text-white transition disabled:opacity-30"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>◀</button>

              <button onClick={() => setPlaying(p => !p)} disabled={loading || bars.length === 0}
                className="flex-1 py-2.5 rounded-xl text-sm font-black transition-all hover:scale-[1.01] disabled:opacity-40"
                style={{ background: playing ? "rgba(239,68,68,0.15)" : "rgba(34,197,94,0.15)", color: playing ? "#f87171" : "#4ade80", border: `1px solid ${playing ? "rgba(239,68,68,0.3)" : "rgba(34,197,94,0.3)"}` }}>
                {playing ? "⏸ Pause" : "▶ Play"}
              </button>

              <button onClick={() => setCursor(c => Math.min(bars.length - 1, c + 1))} disabled={playing || cursor >= bars.length - 1}
                className="px-3 py-2.5 rounded-xl text-sm font-black text-white/50 hover:text-white transition disabled:opacity-30"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>▶</button>

              <button onClick={loadBars}
                className="px-3 py-2.5 rounded-xl text-sm font-black text-white/30 hover:text-white transition"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>↺</button>
            </div>

            {/* Scrubber */}
            <input type="range" min={30} max={bars.length - 1} value={cursor}
              onChange={e => { setPlaying(false); setCursor(Number(e.target.value)) }}
              className="w-full accent-green-500 h-1" disabled={bars.length === 0} />
          </div>

          {/* Right panel */}
          <div className="space-y-3">

            {/* Portfolio */}
            <div className="rounded-2xl p-4" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-dim)" }}>
              <p className="text-xs text-white/25 uppercase tracking-widest mb-3">Portfolio simulé</p>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-xs text-white/40">Cash</span>
                  <span className="text-sm font-black text-white tabular-nums">${cash.toFixed(0)}</span>
                </div>
                {position && (
                  <div className="flex justify-between">
                    <span className="text-xs text-white/40">Position ({position.qty} × ${position.avgPrice.toFixed(2)})</span>
                    <span className="text-sm font-black text-green-400 tabular-nums">${(position.qty * (current?.close ?? 0)).toFixed(0)}</span>
                  </div>
                )}
                <div className="h-px bg-white/5" />
                <div className="flex justify-between">
                  <span className="text-xs text-white/40">Total</span>
                  <span className="text-base font-black text-white tabular-nums">${portValue.toFixed(0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-white/40">P&L</span>
                  <span className={`text-sm font-black tabular-nums ${totalPnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(0)} ({((totalPnl / 10000) * 100).toFixed(2)}%)
                  </span>
                </div>
              </div>
            </div>

            {/* Trade buttons */}
            <div className="space-y-2">
              <button onClick={buy} disabled={!current || cash < (current?.close ?? 0) || playing}
                className="w-full py-3 rounded-2xl font-black text-sm text-black transition-all hover:scale-[1.01] disabled:opacity-30 btn-buy"
                style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)" }}>
                ↗ Acheter 50% du cash
              </button>
              <button onClick={sell} disabled={!position || playing}
                className="w-full py-3 rounded-2xl font-black text-sm transition-all hover:scale-[1.01] disabled:opacity-30"
                style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171" }}>
                ↘ Vendre tout
              </button>
            </div>

            {/* Trades history */}
            {trades.length > 0 && (
              <div className="rounded-2xl p-4 max-h-48 overflow-y-auto scrollbar-hide" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-dim)" }}>
                <p className="text-xs text-white/25 uppercase tracking-widest mb-2">Mes trades</p>
                <div className="space-y-1">
                  {[...trades].reverse().map((tr, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] font-black ${tr.type === "BUY" ? "text-green-400" : "text-red-400"}`}>{tr.type === "BUY" ? "▲" : "▼"}</span>
                        <span className="text-[10px] text-white/40">{tr.date}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-black text-white tabular-nums">${tr.price.toFixed(2)}</span>
                        {tr.pnl !== undefined && (
                          <span className={`text-[9px] ml-1.5 ${tr.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                            {tr.pnl >= 0 ? "+" : ""}{tr.pnl.toFixed(1)}%
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
