"use client"
import { useState, useEffect, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"

export type VisualizationType =
  | "candlestick_explained"
  | "rsi_calculation"
  | "rsi_divergence"
  | "bollinger_bands"
  | "macd_explained"
  | "support_resistance"

interface Props {
  type: VisualizationType
  autoPlay?: boolean
  onComplete?: () => void
}

// ─── Candlestick Explained — Phase 1/2/3 ─────────────────────────────────────
function CandlestickExplained({ phase }: { phase: number }) {
  // phase 0 = green candle building, 1 = labels, 2 = red candle, 3 = 5 candles
  const W = 560, H = 220

  const candles5 = [
    { cx: 60,  o: 150, c: 80,  h: 60,  l: 170, green: true  },
    { cx: 130, o: 100, c: 140, h: 85,  l: 155, green: false },
    { cx: 200, o: 130, c: 70,  h: 50,  l: 145, green: true  },
    { cx: 270, o: 80,  c: 120, h: 65,  l: 135, green: false },
    { cx: 340, o: 110, c: 60,  h: 40,  l: 125, green: true  },
  ]

  const gc = { cx: 90, o: 145, c: 75, h: 55, l: 160 }  // green candle
  const rc = { cx: 200, o: 75, c: 145, h: 55, l: 160 } // red candle

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full">
      {/* Background */}
      <rect width={W} height={H} fill="#0a0a0a" rx={8} />

      {/* Grid lines */}
      {[60, 100, 140, 160].map(y => (
        <line key={y} x1={10} y1={y} x2={W - 10} y2={y} stroke="#ffffff08" strokeWidth={1} />
      ))}

      {/* === Phase 0-1: Green candle === */}
      {phase >= 0 && (
        <>
          {/* Wick */}
          <motion.line x1={gc.cx} y1={gc.h} x2={gc.cx} y2={gc.l}
            stroke="#4ade80" strokeWidth={2.5} strokeLinecap="round"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
            transition={{ duration: 0.6, ease: "easeOut" }} />
          {/* Body */}
          <motion.rect x={gc.cx - 14} width={28} rx={3}
            fill="#4ade80"
            initial={{ y: gc.o, height: 0 }}
            animate={{ y: gc.c, height: gc.o - gc.c }}
            transition={{ duration: 0.5, delay: 0.3, ease: "easeOut" }} />
        </>
      )}

      {/* === Phase 1: Labels on green candle === */}
      {phase >= 1 && (
        <>
          {[
            { label: "HAUT $190",       y: gc.h,  xOff: 22, color: "#facc15" },
            { label: "FERMETURE $185",  y: gc.c,  xOff: 22, color: "#a78bfa" },
            { label: "OUVERTURE $180",  y: gc.o,  xOff: 22, color: "#60a5fa" },
            { label: "BAS $178",        y: gc.l,  xOff: 22, color: "#f87171" },
          ].map(({ label, y, xOff, color }, i) => (
            <g key={label}>
              <motion.line x1={gc.cx + 16} y1={y} x2={gc.cx + xOff - 2} y2={y}
                stroke={color} strokeWidth={1.5}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                transition={{ delay: 0.1 + i * 0.12 }} />
              <motion.rect x={gc.cx + xOff} y={y - 9} width={110} height={16} rx={3}
                fill={`${color}18`} stroke={`${color}44`} strokeWidth={1}
                initial={{ opacity: 0, x: gc.cx + xOff - 10 }}
                animate={{ opacity: 1, x: gc.cx + xOff }}
                transition={{ delay: 0.15 + i * 0.12 }} />
              <motion.text x={gc.cx + xOff + 5} y={y + 4}
                fill={color} fontSize={10} fontWeight="bold"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                transition={{ delay: 0.2 + i * 0.12 }}>
                {label}
              </motion.text>
            </g>
          ))}
          <motion.text x={gc.cx} y={H - 8} textAnchor="middle"
            fill="#4ade80" fontSize={11} fontWeight="bold"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
            ↑ Bougie HAUSSIÈRE
          </motion.text>
        </>
      )}

      {/* === Phase 2: Red candle === */}
      {phase >= 2 && (
        <>
          <motion.line x1={rc.cx} y1={rc.h} x2={rc.cx} y2={rc.l}
            stroke="#f87171" strokeWidth={2.5} strokeLinecap="round"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
            transition={{ duration: 0.5 }} />
          <motion.rect x={rc.cx - 14} width={28} rx={3}
            fill="#f87171"
            initial={{ y: rc.o, height: 0 }}
            animate={{ y: rc.o, height: rc.l - rc.o - 15 }}
            transition={{ duration: 0.5, delay: 0.2 }} />
          <motion.text x={rc.cx} y={H - 8} textAnchor="middle"
            fill="#f87171" fontSize={11} fontWeight="bold"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
            ↓ Bougie BAISSIÈRE
          </motion.text>
          <motion.text x={rc.cx} y={H - 22} textAnchor="middle"
            fill="#888" fontSize={9}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}>
            Clôture &lt; Ouverture
          </motion.text>
        </>
      )}

      {/* === Phase 3: 5 candles === */}
      {phase >= 3 && (
        <>
          <motion.text x={W / 2} y={20} textAnchor="middle"
            fill="#facc15" fontSize={12} fontWeight="bold"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            Voici une vraie session de trading 📈
          </motion.text>
          {candles5.map((c, i) => (
            <g key={i}>
              <motion.line x1={c.cx} y1={c.h} x2={c.cx} y2={c.l}
                stroke={c.green ? "#4ade80" : "#f87171"} strokeWidth={2}
                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                transition={{ duration: 0.4, delay: i * 0.1 }} />
              <motion.rect x={c.cx - 12} rx={2}
                fill={c.green ? "#4ade80" : "#f87171"}
                initial={{ y: c.o, height: 0 }}
                animate={{ y: Math.min(c.o, c.c), height: Math.abs(c.o - c.c) }}
                transition={{ duration: 0.4, delay: 0.15 + i * 0.1 }}
                width={24} />
            </g>
          ))}
        </>
      )}
    </svg>
  )
}

// ─── RSI Calculation — Animated ───────────────────────────────────────────────
function RsiCalculation({ progress }: { progress: number }) {
  const W = 520, PH = 100, RH = 85, GAP = 18
  const RT = PH + GAP

  const prices = [102,105,101,97,93,88,85,86,90,94,98,103,107,104,110,114,108,112,116,113]
  const rsis   = [50,54,46,38,30,22,18,20,26,33,41,50,57,52,60,67,58,62,68,64]
  const N = prices.length

  const visible = Math.max(2, Math.round(progress * N))
  const pPts = prices.slice(0, visible)
  const rPts = rsis.slice(0, visible)

  const minP = 82, maxP = 120
  const px = (i: number) => 30 + (i / (N - 1)) * (W - 50)
  const py = (v: number) => PH - 8 - ((v - minP) / (maxP - minP)) * (PH - 16)
  const ry = (v: number) => RT + RH - 4 - (v / 100) * (RH - 8)

  const pricePath = pPts.map((v, i) => `${i === 0 ? "M" : "L"} ${px(i).toFixed(1)} ${py(v).toFixed(1)}`).join(" ")
  const rsiPath   = rPts.map((v, i) => `${i === 0 ? "M" : "L"} ${px(i).toFixed(1)} ${ry(v).toFixed(1)}`).join(" ")

  const curRsi    = rPts[rPts.length - 1] ?? 50
  const overBought = curRsi >= 70
  const overSold   = curRsi <= 30

  const rsiColor = overBought ? "#f87171" : overSold ? "#4ade80" : "#a78bfa"

  return (
    <svg viewBox={`0 0 ${W} ${RT + RH + 24}`} className="w-full h-full">
      <rect width={W} height={RT + RH + 24} fill="#0a0a0a" rx={8} />

      {/* Grid */}
      {[30, 55, 80].map(y => (
        <line key={y} x1={28} y1={y} x2={W - 10} y2={y} stroke="#ffffff06" strokeWidth={1} />
      ))}

      {/* Price panel */}
      <rect x={8} y={2} width={W - 16} height={PH} fill="#111" rx={4} />
      <text x={14} y={14} fill="#60a5fa" fontSize={9} fontWeight="bold">PRIX</text>
      <text x={W - 14} y={14} fill="#555" fontSize={8} textAnchor="end">AAPL</text>

      {pPts.length > 1 && (
        <>
          {/* Area fill */}
          <defs>
            <linearGradient id="price-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#60a5fa" stopOpacity="0.01" />
            </linearGradient>
          </defs>
          <path d={`${pricePath} L ${px(pPts.length - 1)} ${PH} L ${px(0)} ${PH} Z`} fill="url(#price-grad)" />
          <path d={pricePath} fill="none" stroke="#60a5fa" strokeWidth={2} strokeLinecap="round" />
          <motion.circle cx={px(pPts.length - 1)} cy={py(pPts[pPts.length - 1])} r={4}
            fill="#60a5fa" animate={{ r: [3, 5, 3] }} transition={{ duration: 1.5, repeat: Infinity }} />
        </>
      )}

      {/* RSI panel */}
      <rect x={8} y={RT} width={W - 16} height={RH} fill="#111" rx={4} />
      <text x={14} y={RT + 12} fill="#a78bfa" fontSize={9} fontWeight="bold">RSI(14)</text>

      {/* RSI reference lines */}
      <line x1={8} y1={ry(70)} x2={W - 8} y2={ry(70)} stroke="#f87171" strokeWidth={1} strokeDasharray="5,3" opacity={0.6} />
      <line x1={8} y1={ry(30)} x2={W - 8} y2={ry(30)} stroke="#4ade80" strokeWidth={1} strokeDasharray="5,3" opacity={0.6} />
      <line x1={8} y1={ry(50)} x2={W - 8} y2={ry(50)} stroke="#ffffff18" strokeWidth={1} />
      <text x={W - 10} y={ry(70) + 3} fill="#f87171" fontSize={8} textAnchor="end" opacity={0.7}>70</text>
      <text x={W - 10} y={ry(30) + 3} fill="#4ade80" fontSize={8} textAnchor="end" opacity={0.7}>30</text>
      <text x={W - 10} y={ry(50) + 3} fill="#555" fontSize={8} textAnchor="end">50</text>

      {/* Colored zones */}
      <rect x={8} y={ry(100)} width={W - 16} height={ry(70) - ry(100)} fill="#f8717108" />
      <rect x={8} y={ry(30)} width={W - 16} height={ry(0) - ry(30)} fill="#4ade8008" />

      {rPts.length > 1 && (
        <>
          <path d={rsiPath} fill="none" stroke={rsiColor} strokeWidth={2.5} strokeLinecap="round" />
          <motion.circle cx={px(rPts.length - 1)} cy={ry(curRsi)} r={5}
            fill={rsiColor}
            animate={{ r: overBought || overSold ? [4, 7, 4] : [3, 4, 3] }}
            transition={{ duration: 0.8, repeat: Infinity }} />
          <motion.rect x={px(rPts.length - 1) + 8} y={ry(curRsi) - 10} width={38} height={18} rx={3}
            fill={`${rsiColor}22`} stroke={rsiColor} strokeWidth={1}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} />
          <motion.text x={px(rPts.length - 1) + 11} y={ry(curRsi) + 4}
            fill={rsiColor} fontSize={10} fontWeight="bold"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {curRsi}
          </motion.text>
        </>
      )}

      {/* Signal labels */}
      {overBought && (
        <motion.text x={W / 2} y={RT + RH + 16} fill="#f87171" fontSize={11} textAnchor="middle" fontWeight="bold"
          initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0, 1] }} transition={{ duration: 0.6 }}>
          ⚠️ RSI &gt; 70 — Zone de SURACHAT !
        </motion.text>
      )}
      {overSold && (
        <motion.text x={W / 2} y={RT + RH + 16} fill="#4ade80" fontSize={11} textAnchor="middle" fontWeight="bold"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          💡 RSI &lt; 30 — Opportunité d'achat possible
        </motion.text>
      )}
    </svg>
  )
}

// ─── Support & Resistance — Dramatic ─────────────────────────────────────────
function SupportResistance({ phase }: { phase: number }) {
  const W = 540, H = 200
  const supportY = 148
  const supportPrice = 174

  // Price path with bounces
  const prePath: [number, number][] = [
    [20, 90], [60, 110], [90, supportY], [120, 95], [150, 105],
    [180, supportY + 2], [210, 88], [240, 100], [270, supportY - 1],
  ]
  const confirmed: [number, number][] = [
    ...prePath, [300, 85], [330, 92],
  ]
  const broken: [number, number][] = [
    ...confirmed, [360, supportY + 5], [390, 168], [420, 180], [460, 188],
  ]

  const getPath = () => {
    if (phase >= 3) return broken
    if (phase >= 2) return confirmed
    if (phase >= 1) return prePath.slice(0, 6)
    return prePath.slice(0, 3)
  }

  const pts = getPath()
  const path = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x} ${y}`).join(" ")
  const areaPts = [...pts, [pts[pts.length - 1][0], H - 10], [pts[0][0], H - 10]].map(([x, y]) => `${x},${y}`).join(" ")

  const bouncePoints = [
    { x: 90,  label: "1ère touche" },
    { x: 180, label: "2ème touche" },
    { x: 270, label: "3ème touche ✅" },
  ]

  return (
    <svg viewBox={`0 0 ${W} ${H + 24}`} className="w-full h-full">
      <rect width={W} height={H + 24} fill="#0a0a0a" rx={8} />

      {/* Background */}
      <rect x={8} y={8} width={W - 16} height={H - 8} fill="#111" rx={4} />

      {/* Support zone fill */}
      {phase >= 2 && (
        <motion.rect x={8} y={supportY - 8} width={phase >= 3 ? 350 : W - 16} height={16} rx={2}
          fill={phase >= 3 ? "rgba(248,113,113,0.08)" : "rgba(74,222,128,0.08)"}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} />
      )}

      {/* Price area */}
      <motion.polygon points={areaPts} fill="rgba(96,165,250,0.08)"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} />

      {/* Price line */}
      <motion.path d={path} fill="none" stroke="#60a5fa" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
        transition={{ duration: 0.8, ease: "easeInOut" }} />

      {/* Support line */}
      {phase >= 2 && (
        <motion.line x1={8} y1={supportY} x2={phase >= 3 ? 355 : W - 8} y2={supportY}
          stroke={phase >= 3 ? "#f87171" : "#4ade80"} strokeWidth={2.5}
          strokeDasharray={phase >= 3 ? "none" : "none"}
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
          transition={{ duration: 0.6 }} />
      )}
      {phase >= 3 && (
        <>
          {/* Resistance line (dashed) */}
          <motion.line x1={355} y1={supportY} x2={W - 8} y2={supportY}
            stroke="#f87171" strokeWidth={2} strokeDasharray="6,4"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
            transition={{ duration: 0.5 }} />
          <motion.text x={W - 12} y={supportY - 5} fill="#f87171" fontSize={10} fontWeight="bold" textAnchor="end"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            RÉSISTANCE
          </motion.text>
        </>
      )}

      {/* Support label */}
      {phase >= 2 && phase < 3 && (
        <motion.text x={14} y={supportY - 5} fill="#4ade80" fontSize={10} fontWeight="bold"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          SUPPORT ${supportPrice}
        </motion.text>
      )}

      {/* Bounce points */}
      {bouncePoints.slice(0, phase >= 2 ? 3 : phase >= 1 ? 2 : 1).map((b, i) => (
        <g key={i}>
          <motion.circle cx={b.x} cy={supportY} r={6} fill="#4ade80"
            initial={{ scale: 0 }} animate={{ scale: 1 }}
            transition={{ delay: i * 0.2, type: "spring", stiffness: 400 }} />
          <motion.text x={b.x} y={supportY + 18} textAnchor="middle" fill="#4ade8088" fontSize={8}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 + i * 0.15 }}>
            {b.label}
          </motion.text>
        </g>
      ))}

      {/* Break signal */}
      {phase >= 3 && (
        <>
          <motion.text x={390} y={165} fill="#f87171" fontSize={10} fontWeight="bold" textAnchor="middle"
            initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0, 1, 1] }}
            transition={{ duration: 0.5 }}>
            ↘ CASSURE !
          </motion.text>
          {/* Arrow */}
          <motion.line x1={360} y1={supportY + 10} x2={415} y2={175}
            stroke="#f87171" strokeWidth={2}
            markerEnd="url(#arrowhead)"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
            transition={{ duration: 0.4 }} />
        </>
      )}

      {/* Label at bottom */}
      {phase === 0 && (
        <text x={W / 2} y={H + 18} fill="#888" fontSize={10} textAnchor="middle">
          Le prix teste un niveau…
        </text>
      )}
      {phase >= 3 && (
        <motion.text x={W / 2} y={H + 18} fill="#f87171" fontSize={11} textAnchor="middle" fontWeight="bold"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          ⚠️ Support Cassé → Devient Résistance !
        </motion.text>
      )}
      {phase === 2 && (
        <motion.text x={W / 2} y={H + 18} fill="#4ade80" fontSize={11} textAnchor="middle" fontWeight="bold"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          ✅ Support Confirmé — 3 touches validées
        </motion.text>
      )}
    </svg>
  )
}

// ─── RSI Divergence — Clear Arrows ───────────────────────────────────────────
function RsiDivergence({ phase }: { phase: number }) {
  const W = 540, PH = 95, RH = 80, GAP = 18, RT = PH + GAP
  const H = PH

  // Bearish divergence data
  const bearPriceY  = [70, 55, 75, 38, 60, H, 85]
  const bearRsiY    = [45, 30, 50, 42, 58, 45, 60]

  // Bullish divergence data
  const bullPriceY  = [30, 65, 40, 78, 55, 30, 20]
  const bullRsiY    = [55, 75, 48, 58, 35, 28, 22]

  const xs = [25, 70, 115, 175, 225, 275, 320].map(x => x)

  const makePoints = (ys: number[], offset = 0) =>
    ys.map((y, i) => `${xs[i]},${y + offset}`).join(" ")

  const isBullish = phase >= 2

  const priceYs = isBullish ? bullPriceY : bearPriceY
  const rsiYs   = isBullish ? bullRsiY   : bearRsiY

  // Highlight the diverging peaks/lows
  const h1Idx = 1, h2Idx = 3  // high/low indices

  return (
    <svg viewBox={`0 0 ${W} ${RT + RH + 30}`} className="w-full h-full">
      <rect width={W} height={RT + RH + 30} fill="#0a0a0a" rx={8} />

      {/* Price panel */}
      <rect x={8} y={2} width={350} height={PH} fill="#111" rx={4} />
      <text x={14} y={14} fill={isBullish ? "#4ade80" : "#f87171"} fontSize={9} fontWeight="bold">
        {isBullish ? "PRIX — Bas décroissants ▼" : "PRIX — Hauts croissants ▲"}
      </text>
      <polyline points={makePoints(priceYs)} fill="none" stroke="#60a5fa" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />

      {/* Highlight price peaks */}
      {[h1Idx, h2Idx].map(i => (
        <circle key={i} cx={xs[i]} cy={priceYs[i]} r={5} fill="#60a5fa" />
      ))}

      {/* Price trend line */}
      {phase >= 1 && (
        <motion.line x1={xs[h1Idx]} y1={priceYs[h1Idx]} x2={xs[h2Idx]} y2={priceYs[h2Idx]}
          stroke="#facc15" strokeWidth={2} strokeDasharray="5,3"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
          transition={{ duration: 0.5 }} />
      )}
      {phase >= 1 && (
        <motion.text x={(xs[h1Idx] + xs[h2Idx]) / 2} y={Math.min(priceYs[h1Idx], priceYs[h2Idx]) - 8}
          fill="#facc15" fontSize={9} textAnchor="middle"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
          {isBullish ? "Prix ↘" : "Prix ↗"}
        </motion.text>
      )}

      {/* RSI panel */}
      <rect x={8} y={RT} width={350} height={RH} fill="#111" rx={4} />
      <text x={14} y={RT + 12} fill={isBullish ? "#f87171" : "#4ade80"} fontSize={9} fontWeight="bold">
        {isBullish ? "RSI — Bas croissants ▲" : "RSI — Hauts décroissants ▼"}
      </text>
      <polyline points={makePoints(rsiYs, RT)} fill="none" stroke="#a78bfa" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />

      {[h1Idx, h2Idx].map(i => (
        <circle key={i} cx={xs[i]} cy={rsiYs[i] + RT} r={5} fill="#a78bfa" />
      ))}

      {phase >= 1 && (
        <motion.line x1={xs[h1Idx]} y1={rsiYs[h1Idx] + RT} x2={xs[h2Idx]} y2={rsiYs[h2Idx] + RT}
          stroke={isBullish ? "#4ade80" : "#facc15"} strokeWidth={2} strokeDasharray="5,3"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
          transition={{ duration: 0.5, delay: 0.15 }} />
      )}
      {phase >= 1 && (
        <motion.text x={(xs[h1Idx] + xs[h2Idx]) / 2} y={Math.min(rsiYs[h1Idx], rsiYs[h2Idx]) + RT - 8}
          fill={isBullish ? "#4ade80" : "#f87171"} fontSize={9} textAnchor="middle"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
          {isBullish ? "RSI ↗" : "RSI ↘"}
        </motion.text>
      )}

      {/* Explanation panel */}
      {phase >= 1 && (
        <motion.rect x={370} y={2} width={160} height={RT + RH - 2} rx={6}
          fill={isBullish ? "rgba(74,222,128,0.06)" : "rgba(250,204,21,0.06)"}
          stroke={isBullish ? "rgba(74,222,128,0.2)" : "rgba(250,204,21,0.2)"} strokeWidth={1}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} />
      )}
      {phase >= 1 && (
        <>
          <motion.text x={450} y={22} textAnchor="middle"
            fill={isBullish ? "#4ade80" : "#facc15"} fontSize={10} fontWeight="bold"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
            {isBullish ? "DIVERGENCE" : "DIVERGENCE"}
          </motion.text>
          <motion.text x={450} y={36} textAnchor="middle"
            fill={isBullish ? "#4ade80" : "#facc15"} fontSize={10} fontWeight="bold"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
            {isBullish ? "HAUSSIÈRE 🚀" : "BAISSIÈRE ⚠️"}
          </motion.text>
          <motion.text x={378} y={58} fill="#888" fontSize={8.5} fontWeight="normal"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
            {isBullish ? "Prix fait" : "Prix fait"}
          </motion.text>
          <motion.text x={378} y={70} fill={isBullish ? "#f87171" : "#60a5fa"} fontSize={8.5} fontWeight="bold"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.55 }}>
            {isBullish ? "nouveaux bas" : "nouveaux hauts"}
          </motion.text>
          <motion.text x={378} y={90} fill="#888" fontSize={8.5}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
            RSI lui
          </motion.text>
          <motion.text x={378} y={102} fill={isBullish ? "#4ade80" : "#f87171"} fontSize={8.5} fontWeight="bold"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.65 }}>
            {isBullish ? "monte ↗ (force)" : "descend ↘ (faible)"}
          </motion.text>
          <motion.text x={378} y={130} fill={isBullish ? "#4ade80" : "#facc15"} fontSize={9}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}>
            {isBullish ? "→ Signal achat" : "→ Signal retour"}
          </motion.text>
          <motion.text x={378} y={144} fill={isBullish ? "#4ade80" : "#facc15"} fontSize={9}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.75 }}>
            {isBullish ? "  potentiel" : "  baissier"}
          </motion.text>
        </>
      )}

      {/* Bottom label */}
      <motion.text x={W / 2} y={RT + RH + 20} fill="#888" fontSize={10} textAnchor="middle"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}>
        {phase === 0 ? "Observons le prix et le RSI…"
          : phase === 1 ? (isBullish ? "✅ Divergence haussière → Prix remonte bientôt" : "⚠️ Divergence baissière → Retournement attendu")
          : isBullish ? "✅ La divergence haussière s'est confirmée : prix remonte !"
          : "⚠️ Divergence baissière : malgré la hausse des prix, le RSI s'affaiblit"}
      </motion.text>
    </svg>
  )
}

// ─── Bollinger Bands ──────────────────────────────────────────────────────────
function BollingerBands({ progress }: { progress: number }) {
  const W = 540, H = 180
  const N = 22
  const prices = [
    100,101,99,101,100,99,101,100,101,100,
    103,106,110,115,118,122,126,123,127,130,126,128
  ]
  const visible = Math.max(2, Math.round(progress * N))
  const isSqueeze = progress < 0.42

  const getSpread = (i: number) => isSqueeze
    ? 5 + Math.sin(i * 0.5) * 1.5
    : 4 + Math.pow((i - 9) / 12, 2) * 20

  const upper = prices.map((v, i) => v + getSpread(i))
  const lower = prices.map((v, i) => v - getSpread(i) * 0.6)
  const ma    = prices.map((v, i) => {
    const slice = prices.slice(Math.max(0, i - 4), i + 1)
    return slice.reduce((s, v) => s + v, 0) / slice.length
  })

  const minV = 88, maxV = 140
  const px = (i: number) => 20 + (i / (N - 1)) * (W - 40)
  const py = (v: number) => H - 10 - ((v - minV) / (maxV - minV)) * (H - 20)

  const priceLine = prices.slice(0, visible).map((v, i) => `${px(i)},${py(v)}`).join(" ")
  const upperLine = upper.slice(0, visible).map((v, i) => `${px(i)},${py(v)}`).join(" ")
  const lowerLine = lower.slice(0, visible).map((v, i) => `${px(i)},${py(v)}`).join(" ")
  const maLine    = ma.slice(0, visible).map((v, i) => `${px(i)},${py(v)}`).join(" ")

  const lastPrice = prices[visible - 1]
  const lastUpper = upper[visible - 1]
  const lastLower = lower[visible - 1]
  const touchLower = lastPrice <= lastLower + 1.5
  const touchUpper = lastPrice >= lastUpper - 1.5
  const bandWidth  = lastUpper - lastLower
  const squeezingNow = isSqueeze && visible > 4

  return (
    <svg viewBox={`0 0 ${W} ${H + 28}`} className="w-full h-full">
      <rect width={W} height={H + 28} fill="#0a0a0a" rx={8} />
      <rect x={8} y={4} width={W - 16} height={H - 4} fill="#111" rx={4} />

      {/* Band fill */}
      {visible > 1 && (
        <>
          <defs>
            <linearGradient id="bb-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#60a5fa" stopOpacity="0.04" />
            </linearGradient>
          </defs>
          <polygon
            points={[
              ...upper.slice(0, visible).map((v, i) => `${px(i)},${py(v)}`),
              ...lower.slice(0, visible).reverse().map((v, i) => `${px(visible - 1 - i)},${py(v)}`),
            ].join(" ")}
            fill="url(#bb-fill)"
          />
        </>
      )}

      {/* Lines */}
      {visible > 1 && (
        <>
          <polyline points={upperLine} fill="none" stroke="#60a5fa" strokeWidth={1.8} strokeLinecap="round" />
          <polyline points={lowerLine} fill="none" stroke="#60a5fa" strokeWidth={1.8} strokeLinecap="round" />
          <polyline points={maLine}    fill="none" stroke="#facc15" strokeWidth={1.2} strokeDasharray="4,3" />
          <polyline points={priceLine} fill="none" stroke="#fff"    strokeWidth={2.5} strokeLinecap="round" />
        </>
      )}

      {/* Labels */}
      <text x={14} y={14} fill="#60a5fa" fontSize={9}>BB Sup</text>
      <text x={W / 2} y={14} fill="#facc15" fontSize={9} textAnchor="middle">MA20</text>
      <text x={14} y={H - 6} fill="#60a5fa" fontSize={9}>BB Inf</text>

      {/* Squeeze pulse */}
      {squeezingNow && (
        <motion.text x={W / 2} y={H + 20} fill="#facc15" fontSize={11} textAnchor="middle" fontWeight="bold"
          animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 0.8, repeat: Infinity }}>
          🔥 Squeeze détecté — Breakout imminent !
        </motion.text>
      )}

      {/* Touch signals */}
      {touchLower && !squeezingNow && (
        <motion.text x={W / 2} y={H + 20} fill="#4ade80" fontSize={11} textAnchor="middle" fontWeight="bold"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          🟢 Signal Achat Potentiel — Prix sur BB inf
        </motion.text>
      )}
      {touchUpper && !squeezingNow && (
        <motion.text x={W / 2} y={H + 20} fill="#f87171" fontSize={11} textAnchor="middle" fontWeight="bold"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          🔴 Zone de Vente — Prix sur BB sup
        </motion.text>
      )}
      {!touchLower && !touchUpper && !squeezingNow && (
        <text x={W / 2} y={H + 20} fill="#555" fontSize={10} textAnchor="middle">
          Largeur des bandes : {bandWidth.toFixed(1)} · Dans la zone neutre
        </text>
      )}
    </svg>
  )
}

// ─── MACD — Phase by Phase ─────────────────────────────────────────────────────
function MacdExplained({ progress }: { progress: number }) {
  const W = 540, PH = 88, MH = 72, GAP = 16, MT = PH + GAP
  const N = 14

  const ema12 = [100,102,104,103,105,108,111,110,113,116,115,118,120,119]
  const ema26 = [100,101,102,102,103,104,106,107,108,110,111,112,113,114]
  const macd  = ema12.map((v, i) => +(v - ema26[i]).toFixed(2))
  const signal = [0, 0.2, 0.5, 0.5, 0.7, 1.1, 1.7, 1.7, 2.1, 2.4, 2.3, 2.6, 2.9, 2.8]

  const visible = Math.max(2, Math.round(progress * N))
  const phaseN  = progress < 0.25 ? 0 : progress < 0.5 ? 1 : progress < 0.75 ? 2 : 3

  const minP = 98, maxP = 123
  const px = (i: number) => 24 + (i / (N - 1)) * (W - 44)
  const py = (v: number) => PH - 6 - ((v - minP) / (maxP - minP)) * (PH - 14)

  const minM = -1, maxM = 5
  const zeroY = MT + MH - 4 - (0 / (maxM - minM)) * (MH - 8)
  const my = (v: number) => MT + MH - 4 - ((v - minM) / (maxM - minM)) * (MH - 8)

  const ema12Line = ema12.slice(0, visible).map((v, i) => `${px(i)},${py(v)}`).join(" ")
  const ema26Line = ema26.slice(0, visible).map((v, i) => `${px(i)},${py(v)}`).join(" ")
  const macdLine  = macd.slice(0, visible).map((v, i) => `${px(i)},${my(v)}`).join(" ")
  const signalLine = signal.slice(0, visible).map((v, i) => `${px(i)},${my(v)}`).join(" ")

  // Bullish crossover at index 4 (MACD crosses above signal)
  const crossoverAt = 4
  const showCrossover = visible > crossoverAt + 1

  return (
    <svg viewBox={`0 0 ${W} ${MT + MH + 26}`} className="w-full h-full">
      <rect width={W} height={MT + MH + 26} fill="#0a0a0a" rx={8} />

      {/* Price panel */}
      <rect x={8} y={2} width={W - 16} height={PH} fill="#111" rx={4} />
      <text x={14} y={13} fill="#60a5fa" fontSize={9}>EMA12</text>
      <text x={65} y={13} fill="#f97316" fontSize={9}>EMA26</text>
      <text x={W - 10} y={13} fill="#888" fontSize={8} textAnchor="end">
        {phaseN === 0 ? "Phase 1 : Les deux EMAs" : phaseN === 1 ? "Phase 2 : La différence = MACD" : phaseN === 2 ? "Phase 3 : Signal = EMA9(MACD)" : "Phase 4 : L'histogramme"}
      </text>

      <polyline points={ema26Line} fill="none" stroke="#f97316" strokeWidth={2} strokeLinecap="round" />
      <polyline points={ema12Line} fill="none" stroke="#60a5fa" strokeWidth={2} strokeLinecap="round" />

      {/* Gap arrow */}
      {phaseN >= 1 && visible > 6 && (
        <motion.line x1={px(6)} y1={py(ema26[6])} x2={px(6)} y2={py(ema12[6])}
          stroke="#4ade80" strokeWidth={1.5} strokeDasharray="2,2"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
          transition={{ duration: 0.4 }} />
      )}

      {/* MACD panel */}
      <rect x={8} y={MT} width={W - 16} height={MH} fill="#111" rx={4} />
      <line x1={12} y1={zeroY} x2={W - 12} y2={zeroY} stroke="#ffffff22" strokeWidth={1} />
      <text x={14} y={MT + 12} fill="#4ade80" fontSize={9}>MACD Line</text>
      <text x={W - 10} y={MT + 12} fill="#f87171" fontSize={9} textAnchor="end">Signal</text>

      {/* Histogram bars */}
      {phaseN >= 3 && macd.slice(0, visible).map((v, i) => {
        const barY = v >= 0 ? my(v) : zeroY
        const barH = Math.abs(my(v) - zeroY)
        return (
          <motion.rect key={i}
            x={px(i) - 6} y={barY} width={12} height={Math.max(1, barH)}
            fill={v >= 0 ? "#4ade8055" : "#f8717155"} rx={1}
            initial={{ scaleY: 0 }} animate={{ scaleY: 1 }}
            transition={{ delay: i * 0.04 }}
            style={{ transformOrigin: `${px(i)}px ${zeroY}px` }} />
        )
      })}

      {phaseN >= 1 && <polyline points={macdLine} fill="none" stroke="#4ade80" strokeWidth={2.5} strokeLinecap="round" />}
      {phaseN >= 2 && <polyline points={signalLine} fill="none" stroke="#f87171" strokeWidth={2} strokeDasharray="5,3" strokeLinecap="round" />}

      {/* Crossover highlight */}
      {phaseN >= 2 && showCrossover && (
        <>
          <motion.circle cx={px(crossoverAt)} cy={my(macd[crossoverAt])} r={10}
            fill="none" stroke="#facc15" strokeWidth={2}
            initial={{ scale: 0 }} animate={{ scale: [0, 1.4, 1] }}
            transition={{ duration: 0.5 }} />
          <motion.text x={px(crossoverAt)} y={MT + MH + 18} fill="#4ade80" fontSize={11} textAnchor="middle" fontWeight="bold"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            🟢 Croisement haussier — Signal d'achat !
          </motion.text>
        </>
      )}

      {!showCrossover && (
        <text x={W / 2} y={MT + MH + 18} fill="#555" fontSize={10} textAnchor="middle">
          {phaseN === 0 ? "EMA12 (rapide) vs EMA26 (lente)" : "La différence entre EMA12 et EMA26 = MACD"}
        </text>
      )}
    </svg>
  )
}

// ─── Config ───────────────────────────────────────────────────────────────────
const TOTAL_PHASES: Record<VisualizationType, number> = {
  candlestick_explained: 4,
  rsi_calculation: 1,
  rsi_divergence: 3,
  bollinger_bands: 1,
  macd_explained: 1,
  support_resistance: 4,
}

const TITLES: Record<VisualizationType, string> = {
  candlestick_explained: "Anatomie d'une Bougie Japonaise",
  rsi_calculation:       "RSI — Indice de Force Relative",
  rsi_divergence:        "Divergences RSI",
  bollinger_bands:       "Bandes de Bollinger",
  macd_explained:        "MACD — Les 4 Phases",
  support_resistance:    "Supports & Résistances",
}

const EXPLANATIONS: Record<VisualizationType, string[]> = {
  candlestick_explained: [
    "La mèche représente le range complet (plus haut / plus bas). Le corps va de l'ouverture à la clôture.",
    "Les 4 données clés : OPEN $180 · CLOSE $185 · HIGH $190 · LOW $178. Une bougie verte = clôture > ouverture.",
    "Bougie rouge = clôture < ouverture. La pression vendeuse a dominé la séance.",
    "En pratique : une session réelle = une succession de bougies. Chaque bougie raconte une histoire.",
  ],
  rsi_calculation: [
    "Le RSI mesure la vitesse et l'amplitude des variations. RSI > 70 = surachat (trop rapide). RSI < 30 = survente (opportunité). Observe comment le RSI réagit aux mouvements de prix.",
  ],
  rsi_divergence: [
    "Quand prix et RSI évoluent dans la même direction : pas de divergence, tendance intacte.",
    "Divergence Baissière : le prix fait de nouveaux hauts, mais le RSI monte moins fort → signal de faiblesse.",
    "Divergence Haussière : le prix fait de nouveaux bas, mais le RSI remonte → signal de force cachée.",
  ],
  bollinger_bands: [
    "Les BB = MA20 ± 2 écarts-types. Pendant le Squeeze (bandes serrées), une explosion de volatilité se prépare. Le prix rebondit sur les bandes en tendance.",
  ],
  macd_explained: [
    "Phase 1 : EMA12 (rapide, bleu) et EMA26 (lente, orange) évoluent ensemble.",
    "Phase 2 : MACD = différence entre EMA12 et EMA26. Il oscille autour de zéro.",
    "Phase 3 : La ligne Signal = EMA9 du MACD. Elle « lisse » le MACD.",
    "Phase 4 : L'histogramme = écart entre MACD et Signal. Croisement haussier = signal achat !",
  ],
  support_resistance: [
    "Le prix descend jusqu'à un niveau, puis rebondit. Un support potentiel se forme.",
    "Deuxième rebond sur le même niveau — les acheteurs défendent ce prix.",
    "Troisième touche ! Le support est validé. Plus il y a de touches, plus le niveau est fort.",
    "Le support est cassé avec conviction → il devient une résistance. Rule #1 du trading.",
  ],
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AnimatedVisualization({ type, autoPlay = false, onComplete }: Props) {
  const isStepBased = ["candlestick_explained", "rsi_divergence", "support_resistance"].includes(type)
  const totalPhases = TOTAL_PHASES[type]

  const [phase,   setPhase]   = useState(0)
  const [progress, setProgress] = useState(0)
  const [playing,  setPlaying]  = useState(autoPlay)
  const [speed,    setSpeed]    = useState(1)
  const rafRef  = useRef<number | null>(null)
  const lastRef = useRef<number | null>(null)

  // Progress-based animation
  useEffect(() => {
    if (isStepBased) return
    if (!playing) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      return
    }
    const duration = 7000 / speed
    const tick = (now: number) => {
      if (!lastRef.current) lastRef.current = now
      const elapsed = now - lastRef.current
      setProgress(p => {
        const next = p + elapsed / duration
        if (next >= 1) { setPlaying(false); onComplete?.(); return 1 }
        return next
      })
      lastRef.current = now
      rafRef.current  = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [playing, speed, isStepBased, onComplete])

  // Step-based auto-advance
  useEffect(() => {
    if (!isStepBased || !playing) return
    const id = setInterval(() => {
      setPhase(s => {
        if (s >= totalPhases - 1) { setPlaying(false); onComplete?.(); return s }
        return s + 1
      })
    }, 2800 / speed)
    return () => clearInterval(id)
  }, [playing, speed, isStepBased, totalPhases, onComplete])

  const handleNext = () => {
    if (phase < totalPhases - 1) setPhase(p => p + 1)
    else onComplete?.()
  }

  const handleReset = () => {
    setPhase(0); setProgress(0); lastRef.current = null; setPlaying(false)
  }

  const displayPhase  = isStepBased ? phase : Math.min(totalPhases - 1, Math.floor(progress * totalPhases))
  const explanations  = EXPLANATIONS[type]
  const explanation   = explanations[Math.min(displayPhase, explanations.length - 1)]
  const progressPct   = isStepBased ? ((phase + 1) / totalPhases) * 100 : progress * 100

  return (
    <div className="flex flex-col gap-3 rounded-xl p-4 select-none"
      style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className="text-xs font-black text-white/70 uppercase tracking-wide">{TITLES[type]}</span>
        <div className="flex items-center gap-2">
          {[0.5, 1, 2].map(s => (
            <button key={s} onClick={() => setSpeed(s)}
              className="text-[10px] px-2 py-1 rounded-lg transition-all font-bold"
              style={{
                background: speed === s ? "rgba(74,222,128,0.15)" : "#111",
                color: speed === s ? "#4ade80" : "#555",
                border: `1px solid ${speed === s ? "rgba(74,222,128,0.3)" : "#1a1a1a"}`,
              }}>
              {s}×
            </button>
          ))}
          <button onClick={() => setPlaying(p => !p)}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-all"
            style={{ background: playing ? "rgba(74,222,128,0.15)" : "#111", border: "1px solid #2a2a2a", color: "#4ade80" }}>
            {playing ? "⏸" : "▶"}
          </button>
          <button onClick={handleReset}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-all text-white/30 hover:text-white/60"
            style={{ background: "#111", border: "1px solid #1a1a1a" }}>
            ↺
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 rounded-full overflow-hidden" style={{ background: "#1a1a1a" }}>
        <motion.div className="h-full rounded-full"
          style={{ background: "linear-gradient(90deg,#4ade80,#60a5fa)" }}
          animate={{ width: `${progressPct}%` }}
          transition={{ duration: 0.3 }} />
      </div>

      {/* SVG Canvas */}
      <div className="w-full rounded-xl overflow-hidden" style={{ background: "#0a0a0a", minHeight: 220 }}>
        <AnimatePresence mode="wait">
          <motion.div key={`${type}-${phase}`} className="w-full"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}>
            {type === "candlestick_explained" && <CandlestickExplained phase={phase} />}
            {type === "rsi_calculation"       && <RsiCalculation progress={progress} />}
            {type === "rsi_divergence"        && <RsiDivergence phase={phase} />}
            {type === "bollinger_bands"       && <BollingerBands progress={progress} />}
            {type === "macd_explained"        && <MacdExplained progress={progress} />}
            {type === "support_resistance"    && <SupportResistance phase={phase} />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Explanation */}
      <AnimatePresence mode="wait">
        <motion.div key={explanation}
          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.3 }}
          className="px-4 py-3 rounded-xl text-sm leading-relaxed"
          style={{ background: "#111", border: "1px solid #1a1a1a", color: "#ccc" }}>
          {explanation}
        </motion.div>
      </AnimatePresence>

      {/* Step controls */}
      {isStepBased && (
        <div className="flex items-center justify-between">
          <div className="flex gap-2 items-center">
            {Array.from({ length: totalPhases }).map((_, i) => (
              <button key={i} onClick={() => setPhase(i)}
                className="transition-all rounded-full"
                style={{
                  width: i === phase ? 20 : 8,
                  height: 8,
                  background: i === phase ? "#4ade80" : i < phase ? "#4ade8055" : "#1a1a1a",
                }} />
            ))}
            <span className="text-[10px] ml-1" style={{ color: "#555" }}>{phase + 1}/{totalPhases}</span>
          </div>
          <button onClick={handleNext}
            className="text-xs px-4 py-2 rounded-xl font-black transition-all"
            style={{ background: "rgba(74,222,128,0.12)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.25)" }}>
            {phase < totalPhases - 1 ? "Suivant →" : "Terminer ✓"}
          </button>
        </div>
      )}
    </div>
  )
}
