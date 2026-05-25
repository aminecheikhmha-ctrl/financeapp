"use client"
import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { haptic } from "@/lib/capacitor"

type Props = {
  currentPrice: number
  symbol: string
  accountSize?: number
  onApply?: (qty: number, tp: number, sl: number) => void
}

export default function PositionCalculator({ currentPrice, symbol, accountSize = 100000, onApply }: Props) {
  const [riskPct,    setRiskPct]    = useState(1)
  const [capital,    setCapital]    = useState(accountSize)
  const [entryPrice, setEntryPrice] = useState(currentPrice)
  const [slPrice,    setSlPrice]    = useState(parseFloat((currentPrice * 0.97).toFixed(2)))
  const [tpPrice,    setTpPrice]    = useState(parseFloat((currentPrice * 1.05).toFixed(2)))
  const [open,       setOpen]       = useState(false)

  useEffect(() => {
    if (currentPrice <= 0) return
    setEntryPrice(currentPrice)
    setSlPrice(parseFloat((currentPrice * 0.97).toFixed(2)))
    setTpPrice(parseFloat((currentPrice * 1.05).toFixed(2)))
  }, [currentPrice])

  useEffect(() => {
    setCapital(accountSize)
  }, [accountSize])

  const riskAmount     = capital * (riskPct / 100)
  const slDistance     = Math.abs(entryPrice - slPrice)
  const qty            = slDistance > 0 ? Math.floor(riskAmount / slDistance) : 0
  const totalInvested  = qty * entryPrice
  const potentialGain  = qty * Math.abs(tpPrice - entryPrice)
  const potentialLoss  = qty * slDistance
  const rr             = potentialLoss > 0 ? potentialGain / potentialLoss : 0
  const tpPct          = entryPrice > 0 ? ((tpPrice - entryPrice) / entryPrice * 100) : 0
  const slPct          = entryPrice > 0 ? ((entryPrice - slPrice) / entryPrice * 100) : 0

  return (
    <div>
      <button
        onClick={() => { haptic("light"); setOpen(o => !o) }}
        className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all"
        style={{
          background: open ? "rgba(96,165,250,0.1)" : "rgba(255,255,255,0.04)",
          border: `1px solid ${open ? "rgba(96,165,250,0.2)" : "rgba(255,255,255,0.08)"}`,
          color: open ? "#60a5fa" : "rgba(255,255,255,0.4)",
        }}>
        <span className="flex items-center gap-1.5">🧮 Calculateur de position</span>
        <span>{open ? "▲" : "▼"}</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden">
            <div className="mt-2 p-4 rounded-2xl space-y-4"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>

              {/* Capital */}
              <div>
                <p className="text-[9px] uppercase tracking-widest mb-1.5" style={{ color: "rgba(255,255,255,0.3)" }}>Capital disponible ($)</p>
                <input
                  type="number"
                  value={capital}
                  onChange={e => setCapital(parseFloat(e.target.value) || 0)}
                  className="w-full h-9 px-3 rounded-xl text-sm font-bold text-white outline-none"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)" }}
                />
              </div>

              {/* Risk % slider */}
              <div>
                <div className="flex justify-between text-[10px] mb-2" style={{ color: "rgba(255,255,255,0.3)" }}>
                  <span>Risque par trade</span>
                  <span className="font-black text-white">{riskPct}% = ${riskAmount.toLocaleString()}</span>
                </div>
                <input type="range" min={0.5} max={5} step={0.5} value={riskPct}
                  onChange={e => setRiskPct(Number(e.target.value))}
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, #60a5fa 0%, #60a5fa ${((riskPct - 0.5) / 4.5) * 100}%, rgba(255,255,255,0.1) ${((riskPct - 0.5) / 4.5) * 100}%, rgba(255,255,255,0.1) 100%)`,
                  }} />
                <div className="flex justify-between text-[9px] mt-1" style={{ color: "rgba(255,255,255,0.15)" }}>
                  <span>0.5%</span><span>Conservateur</span><span>Agressif</span><span>5%</span>
                </div>
              </div>

              {/* Prices */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Entrée",      value: entryPrice, set: (v: number) => setEntryPrice(v),  color: "rgba(255,255,255,0.6)" },
                  { label: "Take Profit", value: tpPrice,    set: (v: number) => setTpPrice(v),     color: "#4ade80" },
                  { label: "Stop Loss",   value: slPrice,    set: (v: number) => setSlPrice(v),     color: "#f87171" },
                ].map(field => (
                  <div key={field.label}>
                    <p className="text-[9px] uppercase tracking-widest mb-1" style={{ color: field.color }}>{field.label}</p>
                    <input
                      type="number"
                      value={field.value}
                      onChange={e => field.set(parseFloat(e.target.value) || 0)}
                      className="w-full h-8 px-2 rounded-lg text-xs font-bold outline-none text-white"
                      style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${field.color}20` }}
                    />
                  </div>
                ))}
              </div>

              {/* Results */}
              <div className="rounded-xl p-3 space-y-2"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                {[
                  { label: "Quantité à acheter",  value: `${qty} parts`,                                         highlight: true },
                  { label: "Capital investi",      value: `$${totalInvested.toLocaleString()}` },
                  { label: "Gain potentiel (TP)",  value: `+$${potentialGain.toFixed(0)} (+${tpPct.toFixed(1)}%)`, color: "#4ade80" },
                  { label: "Perte max (SL)",       value: `-$${potentialLoss.toFixed(0)} (-${slPct.toFixed(1)}%)`, color: "#f87171" },
                  { label: "Ratio R/R",            value: `${rr.toFixed(2)}x`,                                    color: rr >= 2 ? "#4ade80" : rr >= 1 ? "#fbbf24" : "#f87171" },
                ].map(row => (
                  <div key={row.label} className="flex justify-between items-center">
                    <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>{row.label}</span>
                    <span className="text-xs font-bold tabular-nums"
                      style={{ color: row.color ?? (row.highlight ? "white" : "rgba(255,255,255,0.6)") }}>
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>

              {rr < 1.5 && rr > 0 && (
                <p className="text-[10px]" style={{ color: "rgba(251,191,36,0.7)" }}>
                  ⚠️ R/R inférieur à 1.5 — considère de déplacer ton TP ou ton SL
                </p>
              )}

              {onApply && qty > 0 && (
                <button
                  onClick={() => { haptic("medium"); onApply(qty, tpPrice, slPrice) }}
                  className="w-full py-2.5 rounded-xl text-xs font-black text-black transition-all hover:scale-[1.02]"
                  style={{ background: "#22c55e" }}>
                  ✅ Appliquer — Acheter {qty} {symbol.replace("-USD", "")}
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
