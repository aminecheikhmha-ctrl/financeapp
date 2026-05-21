"use client"
import { useState, useEffect, useRef } from "react"
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

// ─── Candlestick Explained ──────────────────────────────────────────────────

function CandlestickExplained({ step }: { step: number }) {
  const cx = 100
  const highY = 30
  const lowY = 170
  const openY = 130
  const closeY = 60
  const cx2 = 210
  const openY2 = 60
  const closeY2 = 130

  return (
    <svg viewBox="0 0 340 220" className="w-full h-full">
      {/* Green candle */}
      {/* High-Low wick */}
      <motion.line
        x1={cx} y1={highY} x2={cx} y2={lowY}
        stroke="#4ade80" strokeWidth={2}
        initial={{ pathLength: 0 }} animate={{ pathLength: step >= 0 ? 1 : 0 }}
        transition={{ duration: 0.5 }}
      />
      {/* Body */}
      {step >= 1 && (
        <motion.rect
          x={cx - 18} y={closeY} width={36} height={openY - closeY}
          fill="#4ade80" rx={2}
          initial={{ scaleY: 0, originY: "bottom" }}
          animate={{ scaleY: 1 }}
          transition={{ duration: 0.4 }}
        />
      )}
      {/* Labels */}
      {step >= 2 && (
        <>
          <motion.text x={cx + 26} y={highY + 4} fill="#facc15" fontSize={11} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>Haut</motion.text>
          <motion.line x1={cx + 4} y1={highY} x2={cx + 24} y2={highY + 2} stroke="#facc15" strokeWidth={1} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} />
          <motion.text x={cx + 26} y={lowY + 4} fill="#f87171" fontSize={11} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>Bas</motion.text>
          <motion.line x1={cx + 4} y1={lowY} x2={cx + 24} y2={lowY + 2} stroke="#f87171" strokeWidth={1} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} />
          <motion.text x={cx + 26} y={openY + 4} fill="#60a5fa" fontSize={11} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>Ouverture</motion.text>
          <motion.line x1={cx + 4} y1={openY} x2={cx + 24} y2={openY + 2} stroke="#60a5fa" strokeWidth={1} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} />
          <motion.text x={cx + 26} y={closeY + 4} fill="#a78bfa" fontSize={11} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>Fermeture</motion.text>
          <motion.line x1={cx + 4} y1={closeY} x2={cx + 24} y2={closeY + 2} stroke="#a78bfa" strokeWidth={1} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} />
        </>
      )}
      {/* Red candle comparison */}
      {step >= 3 && (
        <>
          <motion.line x1={cx2} y1={40} x2={cx2} y2={180} stroke="#f87171" strokeWidth={2} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.4 }} />
          <motion.rect x={cx2 - 18} y={openY2} width={36} height={closeY2 - openY2} fill="#f87171" rx={2} initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ duration: 0.4 }} />
          <motion.text x={cx2 - 22} y={204} fill="#f87171" fontSize={11} textAnchor="middle" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>Baissière</motion.text>
          <motion.text x={cx - 18} y={204} fill="#4ade80" fontSize={11} textAnchor="middle" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>Haussière</motion.text>
        </>
      )}
    </svg>
  )
}

const CANDLE_STEPS = [
  "La mèche verticale représente le plus haut et le plus bas de la séance.",
  "Le corps va du cours d'ouverture au cours de fermeture. Vert = la clôture est au-dessus de l'ouverture.",
  "Les 4 données clés d'une bougie : Haut, Bas, Ouverture, Fermeture.",
  "Une bougie rouge : la clôture est en-dessous de l'ouverture. Vente dominante.",
]

// ─── RSI Calculation ─────────────────────────────────────────────────────────

const RSI_PRICES = [100, 105, 98, 92, 88, 85, 90, 96]
const RSI_VALUES = [50, 55, 42, 34, 28, 25, 38, 52]

function RsiCalculation({ progress }: { progress: number }) {
  const n = Math.max(1, Math.round(progress * RSI_PRICES.length))
  const pts = RSI_PRICES.slice(0, n)
  const rsiPts = RSI_VALUES.slice(0, n)
  const W = 320
  const priceH = 100
  const rsiH = 80
  const gap = 20
  const priceTop = 10
  const rsiTop = priceTop + priceH + gap

  const px = (i: number) => 20 + (i / (RSI_PRICES.length - 1)) * (W - 40)
  const py = (v: number) => priceTop + priceH - ((v - 82) / 25) * priceH
  const ry = (v: number) => rsiTop + rsiH - (v / 100) * rsiH

  const priceLine = pts.map((v, i) => `${px(i)},${py(v)}`).join(" ")
  const rsiLine = rsiPts.map((v, i) => `${px(i)},${ry(v)}`).join(" ")
  const currentRsi = rsiPts[rsiPts.length - 1] ?? 50

  const oversold = currentRsi <= 30
  const overbought = currentRsi >= 70

  return (
    <svg viewBox={`0 0 ${W} ${rsiTop + rsiH + 20}`} className="w-full h-full">
      {/* Price panel bg */}
      <rect x={10} y={priceTop} width={W - 20} height={priceH} fill="#111" rx={4} />
      <text x={14} y={priceTop + 12} fill="#888" fontSize={9}>PRIX</text>
      {pts.length > 1 && <polyline points={priceLine} fill="none" stroke="#60a5fa" strokeWidth={2} />}
      {pts.map((v, i) => (
        <circle key={i} cx={px(i)} cy={py(v)} r={3} fill="#60a5fa" />
      ))}

      {/* RSI panel bg */}
      <rect x={10} y={rsiTop} width={W - 20} height={rsiH} fill="#111" rx={4} />
      <text x={14} y={rsiTop + 12} fill="#888" fontSize={9}>RSI</text>

      {/* RSI 30 and 70 lines */}
      <line x1={10} y1={ry(30)} x2={W - 10} y2={ry(30)} stroke={oversold ? "#4ade80" : "#4ade8044"} strokeWidth={1} strokeDasharray="4,3" />
      <text x={W - 8} y={ry(30) + 4} fill={oversold ? "#4ade80" : "#4ade8088"} fontSize={9} textAnchor="end">30</text>
      <line x1={10} y1={ry(70)} x2={W - 10} y2={ry(70)} stroke={overbought ? "#f87171" : "#f8717144"} strokeWidth={1} strokeDasharray="4,3" />
      <text x={W - 8} y={ry(70) + 4} fill={overbought ? "#f87171" : "#f8717188"} fontSize={9} textAnchor="end">70</text>

      {rsiPts.length > 1 && <polyline points={rsiLine} fill="none" stroke={oversold ? "#4ade80" : overbought ? "#f87171" : "#a78bfa"} strokeWidth={2} />}
      {rsiPts.map((v, i) => (
        <circle key={i} cx={px(i)} cy={ry(v)} r={3} fill={v <= 30 ? "#4ade80" : v >= 70 ? "#f87171" : "#a78bfa"} />
      ))}

      {/* Current RSI label */}
      {rsiPts.length > 0 && (
        <motion.text
          x={px(rsiPts.length - 1) + 6}
          y={ry(currentRsi) - 4}
          fill={oversold ? "#4ade80" : overbought ? "#f87171" : "#fff"}
          fontSize={10}
          fontWeight="bold"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        >
          {currentRsi}
        </motion.text>
      )}

      {oversold && (
        <motion.text x={W / 2} y={rsiTop + rsiH + 14} fill="#4ade80" fontSize={10} textAnchor="middle" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          ▲ Survendu → Signal d&apos;achat potentiel
        </motion.text>
      )}
      {overbought && (
        <motion.text x={W / 2} y={rsiTop + rsiH + 14} fill="#f87171" fontSize={10} textAnchor="middle" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          ▼ Suracheté → Attention au retournement
        </motion.text>
      )}
    </svg>
  )
}

// ─── RSI Divergence ──────────────────────────────────────────────────────────

function RsiDivergence({ step }: { step: number }) {
  const W = 320
  const H = 100
  const gap = 20
  const top2 = H + gap

  // Bearish divergence: price higher highs, RSI lower highs
  const bearPriceX = [20, 80, 140, 200, 260, 300]
  const bearPriceY = [70, 40, 60, 20, 50, H - 10]
  const bearRsiX = [20, 80, 140, 200, 260, 300]
  const bearRsiY = [50, 20, 45, 35, 60, H - 10]

  // Bullish divergence: price lower lows, RSI higher lows
  const bullPriceX = [20, 80, 140, 200, 260, 300]
  const bullPriceY = [30, 70, 40, 90, 50, 20]
  const bullRsiX = [20, 80, 140, 200, 260, 300]
  const bullRsiY = [60, 80, 50, 60, 30, 20]

  const makeLine = (xs: number[], ys: number[], offset = 0) =>
    xs.map((x, i) => `${x},${ys[i] + offset}`).join(" ")

  return (
    <svg viewBox={`0 0 ${W} ${top2 + H + 20}`} className="w-full h-full">
      {/* Bearish divergence */}
      {step >= 0 && (
        <>
          <rect x={0} y={0} width={W} height={H} fill="#111" rx={4} />
          <text x={8} y={12} fill="#f87171" fontSize={9} fontWeight="bold">PRIX — Hauts croissants ▲</text>
          <polyline points={makeLine(bearPriceX, bearPriceY)} fill="none" stroke="#60a5fa" strokeWidth={2} />
          {/* Highlight highs */}
          {[1, 3].map(i => (
            <circle key={i} cx={bearPriceX[i]} cy={bearPriceY[i]} r={4} fill="#60a5fa" />
          ))}
          {/* Arrow connecting price highs */}
          {step >= 1 && (
            <motion.line x1={bearPriceX[1]} y1={bearPriceY[1]} x2={bearPriceX[3]} y2={bearPriceY[3]}
              stroke="#facc15" strokeWidth={1.5} strokeDasharray="4,3"
              initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.5 }} />
          )}
        </>
      )}

      {step >= 0 && (
        <>
          <rect x={0} y={top2} width={W} height={H} fill="#111" rx={4} />
          <text x={8} y={top2 + 12} fill="#4ade80" fontSize={9} fontWeight="bold">RSI — Hauts décroissants ▼</text>
          <polyline points={makeLine(bearRsiX, bearRsiY, top2)} fill="none" stroke="#a78bfa" strokeWidth={2} />
          {[1, 3].map(i => (
            <circle key={i} cx={bearRsiX[i]} cy={bearRsiY[i] + top2} r={4} fill="#a78bfa" />
          ))}
          {step >= 1 && (
            <motion.line x1={bearRsiX[1]} y1={bearRsiY[1] + top2} x2={bearRsiX[3]} y2={bearRsiY[3] + top2}
              stroke="#facc15" strokeWidth={1.5} strokeDasharray="4,3"
              initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.5, delay: 0.2 }} />
          )}
        </>
      )}

      {step >= 2 && (
        <motion.text x={W / 2} y={top2 + H + 16} fill="#facc15" fontSize={9} textAnchor="middle"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          ⚠ Divergence Baissière : prix monte mais RSI descend
        </motion.text>
      )}

      {/* Bullish divergence panel overlay at step 3 */}
      {step >= 3 && (
        <>
          <rect x={0} y={0} width={W} height={H} fill="#0d1a0d" rx={4} />
          <text x={8} y={12} fill="#4ade80" fontSize={9} fontWeight="bold">PRIX — Bas décroissants ▼</text>
          <polyline points={makeLine(bullPriceX, bullPriceY)} fill="none" stroke="#60a5fa" strokeWidth={2} />
          {[1, 3].map(i => (
            <circle key={i} cx={bullPriceX[i]} cy={bullPriceY[i]} r={4} fill="#60a5fa" />
          ))}
          <motion.line x1={bullPriceX[1]} y1={bullPriceY[1]} x2={bullPriceX[3]} y2={bullPriceY[3]}
            stroke="#4ade80" strokeWidth={1.5} strokeDasharray="4,3"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.5 }} />

          <rect x={0} y={top2} width={W} height={H} fill="#0d1a0d" rx={4} />
          <text x={8} y={top2 + 12} fill="#4ade80" fontSize={9} fontWeight="bold">RSI — Bas croissants ▲</text>
          <polyline points={makeLine(bullRsiX, bullRsiY, top2)} fill="none" stroke="#a78bfa" strokeWidth={2} />
          {[1, 3].map(i => (
            <circle key={i} cx={bullRsiX[i]} cy={bullRsiY[i] + top2} r={4} fill="#a78bfa" />
          ))}
          <motion.line x1={bullRsiX[1]} y1={bullRsiY[1] + top2} x2={bullRsiX[3]} y2={bullRsiY[3] + top2}
            stroke="#4ade80" strokeWidth={1.5} strokeDasharray="4,3"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.5, delay: 0.2 }} />

          <motion.text x={W / 2} y={top2 + H + 16} fill="#4ade80" fontSize={9} textAnchor="middle"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            ✓ Divergence Haussière : prix descend mais RSI monte
          </motion.text>
        </>
      )}
    </svg>
  )
}

const DIV_STEPS = [
  "Observons deux panels : le prix en haut, le RSI en bas.",
  "Quand le prix fait des hauts croissants mais le RSI fait des hauts décroissants...",
  "⚠️ Divergence Baissière : les acheteurs s'essoufflent malgré la hausse des prix.",
  "✅ Divergence Haussière : le RSI remonte alors que le prix continue de chuter — signal de retournement à la hausse.",
]

// ─── Bollinger Bands ─────────────────────────────────────────────────────────

function BollingerBands({ progress }: { progress: number }) {
  const W = 320
  const H = 180
  const n = 20
  const squeeze = progress < 0.4

  // Generate price path that squeezes then breaks out
  const priceData = [
    100, 102, 99, 101, 100, 98, 101, 99, 100, 101,
    103, 105, 108, 112, 116, 118, 121, 124, 120, 122,
  ]
  const upper = squeeze
    ? priceData.map(v => v + 6)
    : priceData.map((v, i) => v + 4 + i * 0.8)
  const lower = squeeze
    ? priceData.map(v => v - 6)
    : priceData.map((v, i) => v - 4 - i * 0.4)
  const ma = priceData

  const visible = Math.max(2, Math.round(progress * n))
  const minV = 88, maxV = 138

  const px = (i: number) => 20 + (i / (n - 1)) * (W - 40)
  const py = (v: number) => H - 10 - ((v - minV) / (maxV - minV)) * (H - 20)

  const priceLine = priceData.slice(0, visible).map((v, i) => `${px(i)},${py(v)}`).join(" ")
  const upperLine = upper.slice(0, visible).map((v, i) => `${px(i)},${py(v)}`).join(" ")
  const lowerLine = lower.slice(0, visible).map((v, i) => `${px(i)},${py(v)}`).join(" ")
  const maLine = ma.slice(0, visible).map((v, i) => `${px(i)},${py(v)}`).join(" ")

  const lastPrice = priceData[visible - 1]
  const lastUpper = upper[visible - 1]
  const lastLower = lower[visible - 1]
  const touchLower = lastPrice <= lastLower + 2
  const touchUpper = lastPrice >= lastUpper - 2
  const isSqueeze = progress > 0.1 && progress < 0.42

  return (
    <svg viewBox={`0 0 ${W} ${H + 20}`} className="w-full h-full">
      <rect x={0} y={0} width={W} height={H} fill="#111" rx={4} />

      {/* Band fill */}
      {visible > 1 && (
        <polyline
          points={[
            ...upper.slice(0, visible).map((v, i) => `${px(i)},${py(v)}`),
            ...lower.slice(0, visible).reverse().map((v, i) => `${px(visible - 1 - i)},${py(v)}`)
          ].join(" ")}
          fill="#60a5fa11" stroke="none"
        />
      )}

      {visible > 1 && (
        <>
          <polyline points={upperLine} fill="none" stroke="#60a5fa88" strokeWidth={1.5} />
          <polyline points={lowerLine} fill="none" stroke="#60a5fa88" strokeWidth={1.5} />
          <polyline points={maLine} fill="none" stroke="#facc1588" strokeWidth={1} strokeDasharray="4,3" />
          <polyline points={priceLine} fill="none" stroke="#fff" strokeWidth={2} />
        </>
      )}

      {isSqueeze && (
        <motion.text x={W / 2} y={H + 14} fill="#facc15" fontSize={10} textAnchor="middle"
          initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0, 1] }} transition={{ duration: 1, repeat: Infinity }}>
          🔥 Squeeze → Breakout potentiel !
        </motion.text>
      )}
      {touchLower && !isSqueeze && (
        <motion.text x={W / 2} y={H + 14} fill="#4ade80" fontSize={10} textAnchor="middle"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          🟢 Support sur BB inférieure
        </motion.text>
      )}
      {touchUpper && !isSqueeze && (
        <motion.text x={W / 2} y={H + 14} fill="#f87171" fontSize={10} textAnchor="middle"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          🔴 Résistance sur BB supérieure
        </motion.text>
      )}

      <text x={14} y={12} fill="#60a5fa" fontSize={9}>BB sup</text>
      <text x={14} y={H - 4} fill="#60a5fa" fontSize={9}>BB inf</text>
      <text x={W / 2} y={12} fill="#facc15" fontSize={9} textAnchor="middle">MA20</text>
    </svg>
  )
}

// ─── MACD Explained ──────────────────────────────────────────────────────────

const MACD_EMA12 = [100, 103, 106, 104, 107, 110, 113, 112, 115, 118]
const MACD_EMA26 = [100, 101, 103, 104, 105, 107, 109, 110, 111, 113]
const MACD_LINE  = MACD_EMA12.map((v, i) => v - MACD_EMA26[i])
const MACD_SIGNAL = [0, 0.2, 0.6, 0.5, 0.8, 1.2, 1.8, 1.7, 2.1, 2.5]

function MacdExplained({ progress }: { progress: number }) {
  const W = 320
  const priceH = 90
  const macdH = 70
  const gap = 15
  const macdTop = priceH + gap

  const n = MACD_EMA12.length
  const visible = Math.max(2, Math.round(progress * n))

  const minP = 98, maxP = 120
  const px = (i: number) => 20 + (i / (n - 1)) * (W - 40)
  const py = (v: number) => priceH - 10 - ((v - minP) / (maxP - minP)) * (priceH - 20)

  const minM = -1, maxM = 5
  const my = (v: number) => macdTop + macdH - 10 - ((v - minM) / (maxM - minM)) * (macdH - 20)
  const zeroY = my(0)

  const ema12Line = MACD_EMA12.slice(0, visible).map((v, i) => `${px(i)},${py(v)}`).join(" ")
  const ema26Line = MACD_EMA26.slice(0, visible).map((v, i) => `${px(i)},${py(v)}`).join(" ")
  const macdLine = MACD_LINE.slice(0, visible).map((v, i) => `${px(i)},${my(v)}`).join(" ")
  const signalLine = MACD_SIGNAL.slice(0, visible).map((v, i) => `${px(i)},${my(v)}`).join(" ")

  // Find crossover at index 4
  const crossoverVisible = visible > 5
  const crossX = px(5)
  const crossY = my(MACD_LINE[5])

  return (
    <svg viewBox={`0 0 ${W} ${macdTop + macdH + 20}`} className="w-full h-full">
      {/* Price panel */}
      <rect x={0} y={0} width={W} height={priceH} fill="#111" rx={4} />
      <text x={14} y={12} fill="#60a5fa" fontSize={9}>EMA12</text>
      <text x={60} y={12} fill="#f97316" fontSize={9}>EMA26</text>
      {visible > 1 && (
        <>
          <polyline points={ema26Line} fill="none" stroke="#f97316" strokeWidth={2} />
          <polyline points={ema12Line} fill="none" stroke="#60a5fa" strokeWidth={2} />
        </>
      )}

      {/* MACD panel */}
      <rect x={0} y={macdTop} width={W} height={macdH} fill="#111" rx={4} />
      <text x={14} y={macdTop + 12} fill="#fff" fontSize={9}>MACD</text>
      <line x1={10} y1={zeroY} x2={W - 10} y2={zeroY} stroke="#ffffff33" strokeWidth={1} />

      {/* Histogram bars */}
      {MACD_LINE.slice(0, visible).map((v, i) => {
        const barY = v >= 0 ? my(v) : zeroY
        const barH = Math.abs(my(v) - zeroY)
        return (
          <motion.rect
            key={i}
            x={px(i) - 5} y={barY} width={10} height={barH}
            fill={v >= 0 ? "#4ade8066" : "#f8717166"}
            initial={{ scaleY: 0 }} animate={{ scaleY: 1 }}
            transition={{ delay: i * 0.05 }}
            style={{ transformOrigin: `${px(i)}px ${zeroY}px` }}
          />
        )
      })}

      {visible > 1 && (
        <>
          <polyline points={macdLine} fill="none" stroke="#4ade80" strokeWidth={2} />
          <polyline points={signalLine} fill="none" stroke="#f87171" strokeWidth={1.5} strokeDasharray="4,3" />
        </>
      )}

      {crossoverVisible && (
        <motion.circle cx={crossX} cy={crossY} r={7} fill="none" stroke="#facc15" strokeWidth={2}
          initial={{ scale: 0 }} animate={{ scale: [0, 1.4, 1] }} transition={{ duration: 0.5 }} />
      )}
      {crossoverVisible && (
        <motion.text x={W / 2} y={macdTop + macdH + 14} fill="#4ade80" fontSize={10} textAnchor="middle"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          🟢 Croisement haussier !
        </motion.text>
      )}

      <text x={W - 10} y={macdTop + 12} fill="#4ade80" fontSize={9} textAnchor="end">Ligne</text>
      <text x={W - 10} y={macdTop + 22} fill="#f87171" fontSize={9} textAnchor="end">Signal</text>
    </svg>
  )
}

// ─── Support & Resistance ─────────────────────────────────────────────────────

function SupportResistance({ progress }: { progress: number }) {
  const W = 320
  const H = 180
  const supportY = 130
  const breakY = 80

  // Phase: 0-0.6 = bounces, 0.6-0.8 = confirmed, 0.8-1 = break
  const phase = progress

  const bounces = [
    { x: 40, startY: 80, bottomY: supportY },
    { x: 110, startY: 75, bottomY: supportY },
    { x: 180, startY: 70, bottomY: supportY },
  ]
  const visibleBounces = phase < 0.25 ? 0 : phase < 0.45 ? 1 : phase < 0.62 ? 2 : 3

  const confirmed = phase >= 0.65
  const broken = phase >= 0.82

  // Build price path
  const buildPath = () => {
    const pts: string[] = [`20,${80}`]
    bounces.slice(0, visibleBounces).forEach(b => {
      pts.push(`${b.x - 20},${b.startY}`)
      pts.push(`${b.x},${b.bottomY}`)
      pts.push(`${b.x + 20},${b.startY - 5}`)
    })
    if (broken) {
      pts.push(`${230},${supportY - 10}`)
      pts.push(`${260},${breakY}`)
      pts.push(`${300},${breakY - 10}`)
    } else if (confirmed) {
      pts.push(`${230},${supportY - 15}`)
    }
    return pts.join(" ")
  }

  return (
    <svg viewBox={`0 0 ${W} ${H + 30}`} className="w-full h-full">
      <rect x={0} y={0} width={W} height={H} fill="#111" rx={4} />

      {/* Faded touch lines */}
      {[0, 1, 2].map(i => visibleBounces > i && (
        <motion.line
          key={i}
          x1={bounces[i].x - 15} y1={supportY}
          x2={bounces[i].x + 15} y2={supportY}
          stroke={confirmed ? "#4ade80" : "#4ade8033"}
          strokeWidth={1}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        />
      ))}

      {/* Main support line */}
      {confirmed && (
        <motion.line x1={10} y1={supportY} x2={broken ? 240 : W - 10} y2={supportY}
          stroke={broken ? "#f87171" : "#4ade80"} strokeWidth={2}
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
          transition={{ duration: 0.5 }}
        />
      )}

      {/* Break → resistance line */}
      {broken && (
        <motion.line x1={240} y1={supportY} x2={W - 10} y2={supportY}
          stroke="#f87171" strokeWidth={2} strokeDasharray="5,3"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
          transition={{ duration: 0.4 }}
        />
      )}

      {/* Price path */}
      {visibleBounces > 0 && (
        <motion.polyline
          points={buildPath()}
          fill="none" stroke="#60a5fa" strokeWidth={2}
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
          transition={{ duration: 0.4 }}
        />
      )}

      {/* Touch point circles */}
      {[0, 1, 2].map(i => visibleBounces > i && (
        <motion.circle key={i} cx={bounces[i].x} cy={supportY} r={5}
          fill="#4ade80" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.3 }} />
      ))}

      {/* Labels */}
      {confirmed && !broken && (
        <motion.text x={W / 2} y={H + 14} fill="#4ade80" fontSize={11} textAnchor="middle" fontWeight="bold"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          ✅ Support Confirmé ! (3 touches)
        </motion.text>
      )}
      {broken && (
        <>
          <motion.text x={W - 30} y={supportY - 6} fill="#f87171" fontSize={9} textAnchor="end"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}>Résistance</motion.text>
          <motion.text x={W / 2} y={H + 14} fill="#f87171" fontSize={10} textAnchor="middle"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            ⚠️ Support Cassé → Devient Résistance !
          </motion.text>
        </>
      )}
      {!confirmed && visibleBounces > 0 && (
        <text x={W / 2} y={H + 14} fill="#888" fontSize={10} textAnchor="middle">
          {visibleBounces}/3 touches…
        </text>
      )}

      <text x={14} y={supportY - 4} fill="#4ade8088" fontSize={9}>Support</text>
    </svg>
  )
}

const SUPPORT_STEPS = [
  "Le prix descend vers un niveau et remonte. Une résistance se forme.",
  "Deuxième touche du même niveau — coïncidence ou vrai support ?",
  "Troisième touche ! Le niveau est maintenant validé comme support.",
  "Le support est cassé avec force — il devient une résistance.",
]

// ─── Main Component ───────────────────────────────────────────────────────────

const TOTAL_STEPS: Record<VisualizationType, number> = {
  candlestick_explained: 4,
  rsi_calculation: 1,
  rsi_divergence: 4,
  bollinger_bands: 1,
  macd_explained: 1,
  support_resistance: 4,
}

const EXPLANATIONS: Record<VisualizationType, string[]> = {
  candlestick_explained: CANDLE_STEPS,
  rsi_calculation: [
    "Le RSI mesure la force relative des mouvements de prix. Il varie entre 0 et 100. En dessous de 30 = survendu (achat potentiel), au-dessus de 70 = suracheté (vente potentielle).",
  ],
  rsi_divergence: DIV_STEPS,
  bollinger_bands: [
    "Les Bandes de Bollinger entourent le prix à ±2 écarts-types de la MA20. Un squeeze (bandes serrées) annonce souvent un fort mouvement. Le prix rebondit sur les bandes en tendance.",
  ],
  macd_explained: [
    "Le MACD = EMA12 - EMA26. La ligne de signal = EMA9 du MACD. Quand le MACD croise la ligne de signal vers le haut → signal haussier. L'histogramme montre la différence entre les deux.",
  ],
  support_resistance: SUPPORT_STEPS,
}

const TITLES: Record<VisualizationType, string> = {
  candlestick_explained: "Anatomie d'une Bougie Japonaise",
  rsi_calculation: "RSI — Indice de Force Relative",
  rsi_divergence: "Divergences RSI",
  bollinger_bands: "Bandes de Bollinger",
  macd_explained: "MACD — Convergence/Divergence des Moyennes Mobiles",
  support_resistance: "Supports & Résistances",
}

export default function AnimatedVisualization({ type, autoPlay = false, onComplete }: Props) {
  const isStepBased = ["candlestick_explained", "rsi_divergence", "support_resistance"].includes(type)
  const totalSteps = TOTAL_STEPS[type]

  const [step, setStep] = useState(0)
  const [progress, setProgress] = useState(0)
  const [playing, setPlaying] = useState(autoPlay)
  const [speed, setSpeed] = useState(1)
  const rafRef = useRef<number | null>(null)
  const lastRef = useRef<number | null>(null)

  // Continuous animation for progress-based
  useEffect(() => {
    if (isStepBased) return
    if (!playing) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      return
    }
    const duration = 6000 / speed
    const tick = (now: number) => {
      if (!lastRef.current) lastRef.current = now
      const elapsed = now - lastRef.current
      setProgress(p => {
        const next = p + elapsed / duration
        if (next >= 1) {
          setPlaying(false)
          onComplete?.()
          return 1
        }
        return next
      })
      lastRef.current = now
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [playing, speed, isStepBased, onComplete])

  // Auto-advance step-based
  useEffect(() => {
    if (!isStepBased || !playing) return
    const interval = setInterval(() => {
      setStep(s => {
        if (s >= totalSteps - 1) {
          setPlaying(false)
          onComplete?.()
          return s
        }
        return s + 1
      })
    }, 2500 / speed)
    return () => clearInterval(interval)
  }, [playing, speed, isStepBased, totalSteps, onComplete])

  const handleNext = () => {
    if (step < totalSteps - 1) setStep(s => s + 1)
    else onComplete?.()
  }

  const handleReset = () => {
    setStep(0)
    setProgress(0)
    lastRef.current = null
    setPlaying(false)
  }

  const displayStep = isStepBased ? step : Math.min(3, Math.floor(progress * 4))
  const explanations = EXPLANATIONS[type]
  const explanation = explanations[Math.min(displayStep, explanations.length - 1)]

  const progressPct = isStepBased ? ((step + 1) / totalSteps) * 100 : progress * 100

  return (
    <div className="flex flex-col gap-3 bg-[#0d0d0d] rounded-xl border border-[#1a1a1a] p-4 select-none">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-[#60a5fa] uppercase tracking-wider">{TITLES[type]}</span>
        <div className="flex items-center gap-2">
          {/* Speed */}
          {[0.5, 1, 2].map(s => (
            <button key={s} onClick={() => setSpeed(s)}
              className={`text-xs px-2 py-0.5 rounded border ${speed === s ? "border-[#4ade80] text-[#4ade80]" : "border-[#1a1a1a] text-[#555]"}`}>
              {s}x
            </button>
          ))}
          {/* Play/Pause */}
          <button onClick={() => setPlaying(p => !p)}
            className="w-7 h-7 rounded-full border border-[#1a1a1a] flex items-center justify-center text-[#4ade80] hover:border-[#4ade80] transition-colors">
            {playing ? "⏸" : "▶"}
          </button>
          <button onClick={handleReset} className="w-7 h-7 rounded-full border border-[#1a1a1a] flex items-center justify-center text-[#888] hover:border-[#555] transition-colors text-xs">
            ↺
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-[#1a1a1a] rounded-full overflow-hidden">
        <motion.div className="h-full bg-[#4ade80] rounded-full" animate={{ width: `${progressPct}%` }} transition={{ duration: 0.3 }} />
      </div>

      {/* SVG visualization */}
      <div className="w-full aspect-[320/240] rounded-lg bg-[#111] overflow-hidden flex items-center justify-center p-2">
        <AnimatePresence mode="wait">
          <motion.div key={`${type}-${step}`} className="w-full h-full"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
            {type === "candlestick_explained" && <CandlestickExplained step={step} />}
            {type === "rsi_calculation" && <RsiCalculation progress={progress} />}
            {type === "rsi_divergence" && <RsiDivergence step={step} />}
            {type === "bollinger_bands" && <BollingerBands progress={progress} />}
            {type === "macd_explained" && <MacdExplained progress={progress} />}
            {type === "support_resistance" && <SupportResistance progress={progress < 0.05 && step > 0 ? (step / (totalSteps - 1)) : isStepBased ? step / (totalSteps - 1) : progress} />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Explanation */}
      <AnimatePresence mode="wait">
        <motion.p key={explanation} className="text-sm text-[#ccc] leading-relaxed min-h-[48px]"
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3 }}>
          {explanation}
        </motion.p>
      </AnimatePresence>

      {/* Step navigation */}
      {isStepBased && (
        <div className="flex items-center justify-between">
          <div className="flex gap-1.5">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <button key={i} onClick={() => setStep(i)}
                className={`w-2 h-2 rounded-full transition-colors ${i === step ? "bg-[#4ade80]" : i < step ? "bg-[#4ade8055]" : "bg-[#1a1a1a]"}`} />
            ))}
          </div>
          <button onClick={handleNext}
            className="text-xs px-3 py-1.5 rounded-lg bg-[#4ade8022] border border-[#4ade8055] text-[#4ade80] hover:bg-[#4ade8033] transition-colors">
            {step < totalSteps - 1 ? "Suivant →" : "Terminer ✓"}
          </button>
        </div>
      )}
    </div>
  )
}
