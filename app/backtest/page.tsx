"use client"

import { useState } from "react"
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts"

const SYMBOLS = ["AAPL", "TSLA", "NVDA", "MSFT", "BTC-USD", "ETH-USD", "SPY", "QQQ", "META", "AMZN"]

const PERIODS = [
  { key: "3M",  label: "3 mois",  months: 3 },
  { key: "6M",  label: "6 mois",  months: 6 },
  { key: "1Y",  label: "1 an",    months: 12 },
]

const STRATEGIES = [
  { key: "rsi_reversal",  label: "RSI Reversal",   desc: "Achat RSI<30, vente RSI>70" },
  { key: "ma_crossover",  label: "EMA 9/21 Cross",  desc: "Croisement EMA rapide / lente" },
  { key: "macd_cross",    label: "MACD Crossover",  desc: "Croisement ligne MACD/signal" },
  { key: "bb_bounce",     label: "Bollinger Bounce",desc: "Rebond sur bande inférieure" },
  { key: "confluence_3",  label: "Confluence ×3",   desc: "3 indicateurs bullish simultanés" },
]

export default function BacktestPage() {
  const [symbol,   setSymbol]   = useState("AAPL")
  const [period,   setPeriod]   = useState("3M")
  const [strategy, setStrategy] = useState("ma_crossover")
  const [capital,  setCapital]  = useState("10000")
  const [tp,       setTp]       = useState("5")
  const [sl,       setSl]       = useState("3")
  const [loading,  setLoading]  = useState(false)
  const [result,   setResult]   = useState<any>(null)
  const [error,    setError]    = useState("")

  async function runBacktest() {
    setLoading(true)
    setError("")
    setResult(null)
    const months = PERIODS.find(p => p.key === period)?.months ?? 3
    const end   = new Date()
    const start = new Date()
    start.setMonth(start.getMonth() - months)

    try {
      const res = await fetch("/api/backtest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol,
          strategy,
          start_date: start.toISOString().slice(0, 10),
          end_date:   end.toISOString().slice(0, 10),
          initial_capital: parseFloat(capital) || 10000,
          tp_pct: parseFloat(tp) || 5,
          sl_pct: parseFloat(sl) || 3,
        }),
      })
      const data = await res.json()
      if (data.error) { setError(data.error); setLoading(false); return }
      setResult(data)
    } catch { setError("Erreur réseau.") }
    setLoading(false)
  }

  const isPos = (result?.total_return ?? 0) >= 0

  return (
    <div className="min-h-screen page-enter">
      <div className="max-w-4xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="mb-8">
          <p className="text-xs font-black text-green-400 uppercase tracking-widest mb-1">📈 Backtesting</p>
          <h1 className="text-2xl font-black text-white mb-1">Testeur de stratégie</h1>
          <p className="text-white/35 text-sm">Simule une stratégie sur données historiques réelles Yahoo Finance.</p>
        </div>

        {/* Config */}
        <div className="rounded-2xl p-5 mb-6 space-y-5" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-dim)" }}>

          {/* Symbol */}
          <div>
            <label className="text-xs font-bold text-white/40 uppercase tracking-widest block mb-2">Actif</label>
            <div className="flex flex-wrap gap-2">
              {SYMBOLS.map(s => (
                <button key={s} onClick={() => setSymbol(s)}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
                  style={symbol === s ? { background: "rgba(34,197,94,0.15)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.3)" }
                    : { background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Period */}
          <div>
            <label className="text-xs font-bold text-white/40 uppercase tracking-widest block mb-2">Période</label>
            <div className="flex gap-2">
              {PERIODS.map(p => (
                <button key={p.key} onClick={() => setPeriod(p.key)}
                  className="px-4 py-2 rounded-xl text-xs font-bold transition-all"
                  style={period === p.key ? { background: "rgba(96,165,250,0.15)", color: "#60a5fa", border: "1px solid rgba(96,165,250,0.3)" }
                    : { background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Strategy */}
          <div>
            <label className="text-xs font-bold text-white/40 uppercase tracking-widest block mb-2">Stratégie</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {STRATEGIES.map(s => (
                <button key={s.key} onClick={() => setStrategy(s.key)}
                  className="text-left px-4 py-3 rounded-xl transition-all"
                  style={strategy === s.key
                    ? { background: "rgba(167,139,250,0.12)", border: "1px solid rgba(167,139,250,0.3)" }
                    : { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <p className="text-sm font-black" style={{ color: strategy === s.key ? "#a78bfa" : "rgba(255,255,255,0.7)" }}>{s.label}</p>
                  <p className="text-xs mt-0.5 text-white/25">{s.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* TP/SL + Capital */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Capital initial ($)", val: capital, set: setCapital },
              { label: "Take Profit (%)",    val: tp,      set: setTp },
              { label: "Stop Loss (%)",       val: sl,      set: setSl },
            ].map(f => (
              <div key={f.label}>
                <label className="text-xs font-bold text-white/30 uppercase tracking-widest block mb-1.5">{f.label}</label>
                <input type="number" value={f.val} onChange={e => f.set(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-sm text-white outline-none tabular-nums"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }} />
              </div>
            ))}
          </div>

          <button onClick={runBacktest} disabled={loading}
            className="w-full py-3.5 rounded-2xl font-black text-sm text-black transition-all hover:scale-[1.01] disabled:opacity-50 relative overflow-hidden group"
            style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)" }}>
            <div className="absolute inset-0 bg-white/10 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500 skew-x-12" />
            <span className="relative flex items-center justify-center gap-2">
              {loading && <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />}
              {loading ? "Simulation en cours…" : "▶ Lancer le backtest"}
            </span>
          </button>
        </div>

        {error && (
          <div className="rounded-2xl p-4 mb-6" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {result && (
          <div className="space-y-4 animate-fade-in">

            {/* KPI grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Rendement total",  value: `${result.total_return >= 0 ? "+" : ""}${result.total_return?.toFixed(2)}%`, color: isPos ? "#4ade80" : "#f87171" },
                { label: "Taux de réussite", value: `${result.win_rate?.toFixed(0)}%`,  color: (result.win_rate ?? 0) >= 50 ? "#4ade80" : "#f87171" },
                { label: "Trades totaux",    value: String(result.total_trades),         color: "rgba(255,255,255,0.8)" },
                { label: "Max Drawdown",     value: `-${result.max_drawdown?.toFixed(2)}%`, color: "#f87171" },
                { label: "Profit Factor",    value: result.profit_factor?.toFixed(2),    color: (result.profit_factor ?? 0) >= 1.5 ? "#4ade80" : "#facc15" },
                { label: "Sharpe Ratio",     value: result.sharpe_ratio?.toFixed(2),     color: (result.sharpe_ratio ?? 0) >= 1 ? "#4ade80" : "#facc15" },
                { label: "Meilleur trade",   value: `+${result.best_trade?.toFixed(2)}%`, color: "#4ade80" },
                { label: "Pire trade",       value: `${result.worst_trade?.toFixed(2)}%`, color: "#f87171" },
              ].map(k => (
                <div key={k.label} className="rounded-2xl p-4" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-dim)" }}>
                  <p className="text-xs text-white/25 uppercase tracking-widest mb-1">{k.label}</p>
                  <p className="text-xl font-black tabular-nums" style={{ color: k.color }}>{k.value ?? "—"}</p>
                </div>
              ))}
            </div>

            {/* Equity curve */}
            {result.equity_curve?.length > 0 && (
              <div className="rounded-2xl p-5" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-dim)" }}>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm font-black text-white">Courbe de capital</p>
                  <p className="text-xs text-white/30">{result.period?.start} → {result.period?.end}</p>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={result.equity_curve} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={isPos ? "#22c55e" : "#ef4444"} stopOpacity={0.25} />
                        <stop offset="95%" stopColor={isPos ? "#22c55e" : "#ef4444"} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" tick={{ fill: "#555", fontSize: 9 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fill: "#555", fontSize: 9 }} tickLine={false} axisLine={false} tickFormatter={v => `$${(v/1000).toFixed(1)}k`} domain={["auto","auto"]} />
                    <Tooltip contentStyle={{ background: "#111", border: "1px solid #222", borderRadius: 8, fontSize: 11 }}
                      formatter={(v: any) => [`$${Number(v).toLocaleString("en-US", { maximumFractionDigits: 0 })}`, "Capital"]} />
                    <ReferenceLine y={parseFloat(capital) || 10000} stroke="rgba(255,255,255,0.12)" strokeDasharray="4 4" />
                    <Area type="monotone" dataKey="value" stroke={isPos ? "#22c55e" : "#ef4444"} strokeWidth={2} fill="url(#eqGrad)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Trades list */}
            {result.trades?.length > 0 && (
              <div className="rounded-2xl p-5" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-dim)" }}>
                <p className="text-sm font-black text-white mb-3">Trades ({result.trades.length})</p>
                <div className="space-y-1.5 max-h-72 overflow-y-auto scrollbar-hide">
                  {result.trades.map((trade: any, i: number) => (
                    <div key={i} className="flex items-center justify-between px-3 py-2.5 rounded-xl"
                      style={{
                        background: trade.return_pct >= 0 ? "rgba(34,197,94,0.05)" : "rgba(239,68,68,0.05)",
                        border: `1px solid ${trade.return_pct >= 0 ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)"}`,
                      }}>
                      <div className="flex items-center gap-3">
                        <span className={`text-xs font-black ${trade.return_pct >= 0 ? "text-green-400" : "text-red-400"}`}>
                          {trade.return_pct >= 0 ? "▲" : "▼"}
                        </span>
                        <div>
                          <p className="text-xs text-white/60">{trade.date} → {trade.exit_date}</p>
                          <p className="text-[10px] text-white/25">{trade.exit_reason === "tp" ? "✅ TP" : trade.exit_reason === "sl" ? "⛔ SL" : "↗ Signal"}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-black text-white tabular-nums">${trade.price?.toFixed(2)} → ${trade.exit_price?.toFixed(2)}</p>
                        <p className={`text-xs font-black tabular-nums ${trade.return_pct >= 0 ? "text-green-400" : "text-red-400"}`}>
                          {trade.return_pct >= 0 ? "+" : ""}{trade.return_pct?.toFixed(2)}%
                          <span className="text-white/30 ml-1">(${trade.pnl?.toFixed(0)})</span>
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
