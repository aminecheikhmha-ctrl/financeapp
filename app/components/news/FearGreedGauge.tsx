"use client"

import { motion } from "framer-motion"

export type FearGreedResult = {
  score: number
  label: "Peur Extrême" | "Peur" | "Neutre" | "Cupidité" | "Cupidité Extrême"
  color: string
  components: { vix: number; momentum: number; breadth: number; sentiment: number }
  previous_close: number
  change: number
  updated_at: string
}

type Props = {
  data: FearGreedResult | null
}

function polarToXY(angle: number, r: number) {
  const x = 150 + r * Math.cos((angle * Math.PI) / 180)
  const y = 150 - r * Math.sin((angle * Math.PI) / 180)
  return { x, y }
}

function arcPath(startScore: number, endScore: number, r: number) {
  const startAngle = 180 - (startScore / 100) * 180
  const endAngle = 180 - (endScore / 100) * 180
  const start = polarToXY(startAngle, r)
  const end = polarToXY(endAngle, r)
  return `M ${start.x.toFixed(1)} ${start.y.toFixed(1)} A ${r} ${r} 0 0 0 ${end.x.toFixed(1)} ${end.y.toFixed(1)}`
}

const SEGMENTS = [
  { start: 0, end: 25, color: "#ef4444" },
  { start: 25, end: 45, color: "#f97316" },
  { start: 45, end: 55, color: "#facc15" },
  { start: 55, end: 75, color: "#84cc16" },
  { start: 75, end: 100, color: "#22c55e" },
]

function Skeleton() {
  return (
    <div
      className="rounded-3xl p-5 animate-pulse"
      style={{ background: "#0d0d0d", border: "1px solid rgba(255,255,255,0.08)" }}
    >
      <div className="h-4 w-32 bg-white/5 rounded mb-4" />
      <div className="h-40 bg-white/5 rounded-2xl" />
    </div>
  )
}

export default function FearGreedGauge({ data }: Props) {
  if (!data) return <Skeleton />

  const needleAngle = 180 - (data.score / 100) * 180
  const needlePt = polarToXY(needleAngle, 85)

  return (
    <div
      className="rounded-3xl p-5"
      style={{ background: "#0d0d0d", border: "1px solid rgba(255,255,255,0.08)" }}
    >
      <p className="text-xs font-bold text-white/40 uppercase tracking-widest mb-3">
        😱 Indice Peur &amp; Cupidité
      </p>

      <svg viewBox="0 0 300 170" className="w-full">
        {/* Background arc */}
        <path
          d="M 50 150 A 100 100 0 0 1 250 150"
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={20}
          strokeLinecap="round"
        />

        {/* Colored segments */}
        {SEGMENTS.map(seg => (
          <path
            key={seg.start}
            d={arcPath(seg.start, seg.end, 100)}
            fill="none"
            stroke={seg.color}
            strokeWidth={18}
            strokeLinecap="round"
            opacity={0.85}
          />
        ))}

        {/* Needle */}
        <motion.line
          x1={150}
          y1={150}
          x2={150}
          y2={65}
          animate={{ x2: needlePt.x, y2: needlePt.y }}
          transition={{ type: "spring", stiffness: 60, damping: 15 }}
          stroke="white"
          strokeWidth={2.5}
          strokeLinecap="round"
        />
        <circle cx={150} cy={150} r={5} fill="white" />

        {/* Score text */}
        <text x={150} y={132} textAnchor="middle" fill="white" fontSize={28} fontWeight="900">
          {data.score}
        </text>
        <text x={150} y={148} textAnchor="middle" fill={data.color} fontSize={10} fontWeight="bold">
          {data.label}
        </text>
      </svg>

      {/* Previous close + change */}
      <div className="flex items-center justify-between mt-2 px-1">
        <span className="text-[10px] text-white/30">VIX préc. {data.previous_close.toFixed(2)}</span>
        <span
          className="text-[10px] font-bold"
          style={{ color: data.change > 0 ? "#ef4444" : "#22c55e" }}
        >
          {data.change > 0 ? "+" : ""}{data.change.toFixed(2)}
        </span>
      </div>

      {/* Component bars */}
      <div className="mt-3 space-y-1.5">
        {[
          { label: "VIX", value: data.components.vix },
          { label: "Momentum", value: data.components.momentum },
          { label: "Breadth", value: data.components.breadth },
        ].map(c => (
          <div key={c.label} className="flex items-center gap-2">
            <span className="text-[9px] text-white/30 w-16">{c.label}</span>
            <div className="flex-1 h-1 rounded-full bg-white/5">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${c.value}%`, background: data.color }}
              />
            </div>
            <span className="text-[9px] text-white/40 w-6 text-right">{c.value}</span>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex justify-between mt-3 px-1">
        <span className="text-[8px] text-red-400">Peur Extrême</span>
        <span className="text-[8px] text-white/30">Neutre</span>
        <span className="text-[8px] text-green-400">Cupidité Extrême</span>
      </div>
    </div>
  )
}
