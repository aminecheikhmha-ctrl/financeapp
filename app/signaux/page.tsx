"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import type { SignalResult } from "@/app/api/signals/route"
import UpgradeModal from "@/app/components/UpgradeModal"
import { getPlan } from "@/lib/plans"
import { formatPrice, formatChange } from "@/lib/format"

// ─── Design tokens ─────────────────────────────────────────────────────────
const D = {
  bg:     "#050505",
  card:   "#0a0a0a",
  border: "rgba(255,255,255,0.06)",
  green:  "#22c55e",
  red:    "#ef4444",
  yellow: "#f59e0b",
} as const

// ─── Types ──────────────────────────────────────────────────────────────────
type Stats = {
  total:          number
  fort:           number
  achats:         number
  ventes:         number
  avg_confluence: number
}

type HistoriqueRow = {
  id:              string
  ticker:          string
  direction:       string
  prix_entree:     number
  take_profit_1:   number
  take_profit_2:   number
  take_profit_3?:  number
  stop_loss:       number
  timeframe:       string
  score_confiance: number
  statut:          string
  raisonnement?:   string
  indicateurs?:    Record<string, any>
  created_at:      string
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function isNYSEOpenNow(): boolean {
  const now = new Date()
  const et  = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }))
  const day  = et.getDay()
  const mins = et.getHours() * 60 + et.getMinutes()
  return day >= 1 && day <= 5 && mins >= 570 && mins < 960
}

function formatCountdown(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${s.toString().padStart(2, "0")}`
}

function timeUntilExpiry(expires_at: string): string {
  const diff = new Date(expires_at).getTime() - Date.now()
  if (diff <= 0) return "Expiré"
  const h = Math.floor(diff / 3_600_000)
  const m = Math.floor((diff % 3_600_000) / 60_000)
  if (h > 0) return `${h}h${m > 0 ? m + "m" : ""}`
  return `${m}m`
}

function localTimeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 2) return "à l'instant"
  if (mins < 60) return `il y a ${mins} min`
  const h = Math.floor(mins / 60)
  if (h < 24) return `il y a ${h}h`
  return `il y a ${Math.floor(h / 24)}j`
}

function pctChange(from: number, to: number): string {
  if (!from) return "—"
  const v = ((to - from) / Math.abs(from)) * 100
  return (v >= 0 ? "+" : "") + v.toFixed(1) + "%"
}

const REASON_MAP: Record<string, string> = {
  "RSI":      "Survente/Surachat",
  "Stoch":    "Retournement probable",
  "MACD":     "Momentum change",
  "BB":       "Limites Bollinger",
  "Volume":   "Volume anormal",
  "Williams": "Zone retournement",
  "EMA":      "Croisement tendance",
  "OBV":      "Pression volume",
  "Ichimoku": "Signal Ichimoku",
  "CCI":      "Oscillateur CCI",
}

function humanReason(indicator: string): string {
  const key = Object.keys(REASON_MAP).find(k => indicator.includes(k))
  return key ? REASON_MAP[key] : indicator
}

function isBull(signal: string) { return signal === "ACHAT" || signal === "ACHAT_FORT" }

function sigLabel(signal: string) {
  if (signal === "ACHAT_FORT") return "⚡ Achat Fort"
  if (signal === "ACHAT")      return "↗ Achat"
  if (signal === "VENTE_FORT") return "⚡ Vente Forte"
  return "↘ Vente"
}

function sigLabelShort(signal: string) {
  if (signal === "ACHAT_FORT") return "⚡ Fort"
  if (signal === "ACHAT")      return "↗ Achat"
  if (signal === "VENTE_FORT") return "⚡ Fort"
  return "↘ Vente"
}

// ─── HeroSignalCard ──────────────────────────────────────────────────────────
function HeroSignalCard({ signal, onUpgrade, blurred }: {
  signal: SignalResult; onUpgrade: () => void; blurred?: boolean
}) {
  const router  = useRouter()
  const bullish = isBull(signal.signal)
  const color   = bullish ? D.green : D.red
  const pctTp   = signal.entry_price ? ((signal.tp1 - signal.entry_price) / signal.entry_price) * 100 : 0
  const pctSl   = signal.entry_price ? ((signal.sl  - signal.entry_price) / signal.entry_price) * 100 : 0
  const rr      = Math.abs(signal.sl - signal.entry_price) > 0
    ? Math.abs(signal.tp1 - signal.entry_price) / Math.abs(signal.sl - signal.entry_price)
    : signal.risk_reward_tp1

  const reasons = signal.confirmed_by.slice(0, 4).map(humanReason)

  return (
    <div className="relative rounded-2xl overflow-hidden"
      style={{
        background: bullish
          ? "linear-gradient(135deg, rgba(34,197,94,0.06), rgba(34,197,94,0.02))"
          : "linear-gradient(135deg, rgba(239,68,68,0.06), rgba(239,68,68,0.02))",
        border: `1px solid ${bullish ? "rgba(34,197,94,0.18)" : "rgba(239,68,68,0.18)"}`,
      }}>

      {blurred && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-2xl"
          style={{ backdropFilter: "blur(8px)", background: "rgba(5,5,5,0.8)" }}>
          <p className="text-2xl">🔒</p>
          <p className="text-white font-black text-sm">Signal Premium</p>
          <button onClick={onUpgrade}
            className="px-5 py-2 rounded-xl text-sm font-black text-black transition hover:opacity-90"
            style={{ background: D.green }}>
            Débloquer →
          </button>
        </div>
      )}

      <div className="h-0.5 w-full" style={{ background: `linear-gradient(90deg, ${color}, ${color}00)` }} />

      <div className="p-4">
        <div className="flex flex-col lg:flex-row lg:items-start gap-4">

          {/* ── LEFT ── */}
          <div className="flex-1 min-w-0">
            {/* Badges */}
            <div className="flex items-center gap-2 flex-wrap mb-3">
              <span className="text-[10px] font-black px-2.5 py-1 rounded-full"
                style={{ background: `${color}18`, color, border: `1px solid ${color}35` }}>
                {sigLabel(signal.signal)}
              </span>
              <span className="text-[10px] text-white/30">
                {signal.type === "crypto" ? "₿ Crypto" : signal.type === "stock" ? "📈 Action" : "📦 ETF"}
              </span>
              {signal.candle_pattern && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded"
                  style={{ background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.25)", color: "#a78bfa" }}>
                  {signal.candle_pattern}
                </span>
              )}
            </div>

            {/* Symbol + Price */}
            <div className="flex items-baseline gap-3 mb-1 flex-wrap">
              <h2 className="text-2xl font-black text-white leading-none">
                {signal.symbol.replace("-USD", "")}
              </h2>
              <div>
                <p className="text-lg font-black text-white tabular-nums">{formatPrice(signal.price)}</p>
                <p className={`text-xs font-bold ${signal.change_24h >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {formatChange(signal.change_24h)} aujourd'hui
                </p>
              </div>
            </div>
            <p className="text-xs text-white/35 mb-3">{signal.name}</p>

            {/* AI comment OR human reasons */}
            {signal.ai_comment ? (
              <div className="mb-3 p-3 rounded-xl"
                style={{ background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.15)" }}>
                <p className="text-[10px] text-purple-400/60 uppercase tracking-widest font-bold mb-1">
                  🤖 Pourquoi ce signal ?
                </p>
                <p className="text-xs text-white/70 leading-relaxed">{signal.ai_comment}</p>
              </div>
            ) : reasons.length > 0 ? (
              <div className="mb-3">
                <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1.5">Pourquoi ce signal ?</p>
                <div className="flex flex-wrap gap-1.5">
                  {reasons.map((r, i) => (
                    <span key={i} className="text-[10px] font-semibold px-2.5 py-1 rounded-lg"
                      style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.08)" }}>
                      {r}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Confluence bar */}
            <div>
              <div className="flex justify-between text-[10px] mb-1">
                <span className="text-white/40">Score de confiance</span>
                <span className="font-black" style={{ color }}>
                  {signal.confluence_score.toFixed(0)}%
                  {signal.confluence_score >= 70 ? " 🔥" : signal.confluence_score >= 55 ? " ✅" : " ⚠️"}
                </span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                <div className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${signal.confluence_score}%`,
                    background: signal.confluence_score >= 70
                      ? `linear-gradient(90deg, ${color}80, ${color})`
                      : signal.confluence_score >= 55
                        ? "linear-gradient(90deg, #f59e0b80, #f59e0b)"
                        : "linear-gradient(90deg, #9ca3af80, #9ca3af)",
                  }} />
              </div>
            </div>
          </div>

          {/* ── RIGHT ── */}
          <div className="lg:w-[200px] flex-shrink-0 space-y-2">
            {/* TP */}
            <div className="rounded-xl p-3"
              style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.18)" }}>
              <p className="text-[9px] text-green-400/60 uppercase tracking-widest mb-0.5">🎯 Objectif (TP)</p>
              <p className="text-base font-black text-green-400 tabular-nums">{formatPrice(signal.tp1)}</p>
              <p className="text-[10px] font-bold text-green-400/60">
                {pctTp >= 0 ? "+" : ""}{pctTp.toFixed(1)}%
              </p>
            </div>
            {/* SL */}
            <div className="rounded-xl p-3"
              style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.18)" }}>
              <p className="text-[9px] text-red-400/60 uppercase tracking-widest mb-0.5">🛡️ Stop Loss</p>
              <p className="text-base font-black text-red-400 tabular-nums">{formatPrice(signal.sl)}</p>
              <p className="text-[10px] font-bold text-red-400/60">
                {pctSl >= 0 ? "+" : ""}{pctSl.toFixed(1)}%
              </p>
            </div>
            {/* R/R */}
            <div className="rounded-xl p-3"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <p className="text-[9px] text-white/30 uppercase tracking-widest mb-0.5">⚖️ R/R</p>
              <p className="text-base font-black text-white">1:{rr.toFixed(1)}</p>
              <p className="text-[10px] text-white/40">
                {rr >= 2 ? "🏆 Excellent" : rr >= 1.5 ? "✅ Bon" : "⚠️ Correct"}
              </p>
            </div>
            {/* CTAs */}
            <button
              onClick={() => router.push(`/signaux/${signal.symbol}`)}
              className="w-full py-2.5 rounded-xl text-xs font-black transition-all hover:scale-[1.01] active:scale-95"
              style={{ background: color, color: "black" }}>
              🔍 Analyse complète →
            </button>
            <button
              onClick={() => router.push(`/dashboard?symbol=${signal.symbol}&action=${bullish ? "buy" : "sell"}&price=${signal.entry_price}&tp=${signal.tp1}&sl=${signal.sl}`)}
              className="w-full py-3 rounded-2xl text-sm font-bold transition-all"
              style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.08)" }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
              onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}>
              📈 Trader (Paper Trading) →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── CompactSignalCard ────────────────────────────────────────────────────────
function CompactSignalCard({ signal, rank, onUpgrade, blurred }: {
  signal: SignalResult; rank: number; onUpgrade: () => void; blurred?: boolean
}) {
  const router  = useRouter()
  const bullish = isBull(signal.signal)
  const color   = bullish ? D.green : D.red
  const pctTp   = signal.entry_price ? ((signal.tp1 - signal.entry_price) / signal.entry_price) * 100 : 0
  const pctSl   = signal.entry_price ? ((signal.sl  - signal.entry_price) / signal.entry_price) * 100 : 0
  const rr      = Math.abs(signal.sl - signal.entry_price) > 0
    ? Math.abs(signal.tp1 - signal.entry_price) / Math.abs(signal.sl - signal.entry_price)
    : signal.risk_reward_tp1

  const reasons = signal.confirmed_by.slice(0, 2).map(humanReason)

  return (
    <div className="relative rounded-2xl overflow-hidden transition-all hover:scale-[1.005] cursor-pointer"
      style={{
        background: bullish ? "rgba(34,197,94,0.05)" : "rgba(239,68,68,0.05)",
        border: `1px solid ${bullish ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)"}`,
      }}
      onClick={() => !blurred && router.push(`/signaux/${signal.symbol}`)}>

      {blurred && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-2xl"
          style={{ backdropFilter: "blur(6px)", background: "rgba(5,5,5,0.75)" }}>
          <p className="text-2xl">🔒</p>
          <button onClick={e => { e.stopPropagation(); onUpgrade() }}
            className="text-xs font-black px-4 py-1.5 rounded-lg transition"
            style={{ background: "rgba(34,197,94,0.2)", border: "1px solid rgba(34,197,94,0.3)", color: D.green }}>
            Premium
          </button>
        </div>
      )}

      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black text-black flex-shrink-0"
              style={{ background: color }}>
              #{rank}
            </span>
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-black text-white">{signal.symbol.replace("-USD", "")}</p>
                <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full"
                  style={{ background: `${color}18`, color, border: `1px solid ${color}30` }}>
                  {sigLabelShort(signal.signal)}
                </span>
              </div>
              <p className="text-[10px] text-white/35">{signal.name.slice(0, 22)}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-black text-white tabular-nums">{formatPrice(signal.price)}</p>
            <p className={`text-[10px] font-bold ${signal.change_24h >= 0 ? "text-green-400" : "text-red-400"}`}>
              {formatChange(signal.change_24h)}
            </p>
          </div>
        </div>

        {/* Human reasons */}
        {reasons.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {reasons.map((r, i) => (
              <span key={i} className="text-[10px] font-semibold px-2 py-1 rounded-lg"
                style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)" }}>
                ✓ {r}
              </span>
            ))}
          </div>
        )}

        {/* Confluence */}
        <div className="mb-3">
          <div className="flex justify-between text-[10px] mb-1">
            <span className="text-white/30">Confiance</span>
            <span className="font-black" style={{ color }}>{signal.confluence_score.toFixed(0)}%</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
            <div className="h-full rounded-full" style={{ width: `${signal.confluence_score}%`, background: color }} />
          </div>
        </div>

        {/* TP / Entry / SL */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="text-center p-2 rounded-xl" style={{ background: "rgba(255,255,255,0.04)" }}>
            <p className="text-[8px] text-white/25 mb-0.5">Entrée</p>
            <p className="text-xs font-black text-white tabular-nums">{formatPrice(signal.entry_price)}</p>
          </div>
          <div className="text-center p-2 rounded-xl" style={{ background: "rgba(34,197,94,0.08)" }}>
            <p className="text-[8px] text-green-400/50 mb-0.5">🎯 TP</p>
            <p className="text-xs font-black text-green-400 tabular-nums">{formatPrice(signal.tp1)}</p>
            <p className="text-[8px] text-green-400/40">{pctTp >= 0 ? "+" : ""}{pctTp.toFixed(1)}%</p>
          </div>
          <div className="text-center p-2 rounded-xl" style={{ background: "rgba(239,68,68,0.08)" }}>
            <p className="text-[8px] text-red-400/50 mb-0.5">🛡️ SL</p>
            <p className="text-xs font-black text-red-400 tabular-nums">{formatPrice(signal.sl)}</p>
            <p className="text-[8px] text-red-400/40">{pctSl >= 0 ? "+" : ""}{pctSl.toFixed(1)}%</p>
          </div>
        </div>

        {/* R/R + CTA */}
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-black px-2.5 py-1 rounded-full"
            style={{
              background: rr >= 2 ? "rgba(34,197,94,0.1)" : "rgba(255,255,255,0.05)",
              color:      rr >= 2 ? "#4ade80"              : "rgba(255,255,255,0.4)",
            }}>
            R/R 1:{rr.toFixed(1)} {rr >= 2 ? "🏆" : rr >= 1.5 ? "✅" : ""}
          </span>
          <span className="text-[11px] font-black px-3 py-1.5 rounded-xl"
            style={{ background: `${color}18`, color, border: `1px solid ${color}25` }}>
            Analyser →
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── HistoriqueView ───────────────────────────────────────────────────────────
function HistoriqueView({ rows }: { rows: HistoriqueRow[] }) {
  const router = useRouter()
  if (rows.length === 0) return (
    <div className="text-center py-16" style={{ color: "rgba(255,255,255,0.3)" }}>
      <p className="text-4xl mb-3">📋</p>
      <p className="text-lg font-semibold text-white">Aucun historique disponible</p>
      <p className="text-sm mt-1">Les signaux apparaîtront ici après le premier scan</p>
    </div>
  )

  return (
    <div className="space-y-2">
      {rows.map(row => {
        const isLong        = row.direction === "LONG"
        const ind           = row.indicateurs as any
        const color         = isLong ? D.green : D.red
        const sigStr        = (ind?.signal as string) ?? (isLong ? "ACHAT" : "VENTE")
        const confirmedBy   = (ind?.confirmed_by ?? []) as string[]
        const confluenceScore = ind?.confluence_score ?? row.score_confiance ?? 0
        const confluenceCount = ind?.confluence_count as number | undefined
        const totalInd      = ind?.total_indicators as number | undefined
        const rr1           = ind?.risk_reward_tp1 as number | undefined
        const assetName     = ind?.name as string | undefined
        const expiresAt     = ind?.expires_at as string | undefined
        const isActive      = expiresAt ? new Date(expiresAt).getTime() > Date.now() : false

        return (
          <div key={row.id} className="rounded-2xl p-4"
            style={{
              background: D.card,
              border: `1px solid ${D.border}`,
              borderLeft: `2px solid ${isLong ? "rgba(34,197,94,0.5)" : "rgba(239,68,68,0.5)"}`,
            }}>
            <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full"
                  style={{
                    background: `${color}18`,
                    color,
                    border: `1px solid ${color}30`,
                  }}>
                  {sigLabel(sigStr)}
                </span>
                <span className="text-white font-bold text-sm">{row.ticker}</span>
                {assetName && <span className="text-xs text-white/30">{assetName}</span>}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                  style={isActive
                    ? { background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)", color: D.yellow }
                    : { background: "rgba(255,255,255,0.04)", border: `1px solid ${D.border}`, color: "rgba(255,255,255,0.3)" }}>
                  {isActive ? "En cours ⏳" : "Clôturé ◼"}
                </span>
                <span className="text-[10px] text-white/25">{localTimeAgo(row.created_at)}</span>
              </div>
            </div>

            {confluenceScore > 0 && (
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-white/30">Confluence</span>
                  <span className="text-[10px] font-bold text-white">
                    {confluenceScore.toFixed(0)}%
                    {confluenceCount != null && totalInd != null && (
                      <span className="font-normal text-white/30 ml-1">({confluenceCount}/{totalInd})</span>
                    )}
                  </span>
                </div>
                <div className="w-full h-1 rounded-full" style={{ background: "rgba(255,255,255,0.05)" }}>
                  <div className="h-1 rounded-full"
                    style={{ width: `${confluenceScore}%`, background: isLong ? "rgba(34,197,94,0.5)" : "rgba(239,68,68,0.5)" }} />
                </div>
                {confirmedBy.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {confirmedBy.slice(0, 6).map(l => (
                      <span key={l} className="text-[9px] px-1.5 py-0.5 rounded-full"
                        style={{
                          background: isLong ? "rgba(34,197,94,0.06)" : "rgba(239,68,68,0.06)",
                          border: isLong ? "1px solid rgba(34,197,94,0.12)" : "1px solid rgba(239,68,68,0.12)",
                          color: isLong ? "rgba(74,222,128,0.6)" : "rgba(248,113,113,0.6)",
                        }}>
                        {l}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-5 gap-1.5 text-center">
              {[
                { label: "Entrée", val: row.prix_entree },
                { label: "TP1",    val: row.take_profit_1 },
                { label: "TP2",    val: row.take_profit_2 },
                { label: "TP3",    val: row.take_profit_3 ?? null },
                { label: "SL",     val: row.stop_loss },
              ].map(({ label, val }) => val != null && (
                <div key={label}>
                  <p className="text-[9px] font-bold uppercase mb-0.5"
                    style={{ color: label === "SL" ? D.red : label === "Entrée" ? "rgba(255,255,255,0.3)" : D.green }}>
                    {label}
                  </p>
                  <p className="text-white text-[10px] font-semibold">
                    {val < 1 ? val.toFixed(4) : val.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}
                  </p>
                  {label !== "Entrée" && (
                    <p className="text-[9px]" style={{ color: label === "SL" ? "rgba(239,68,68,0.6)" : "rgba(34,197,94,0.6)" }}>
                      {pctChange(row.prix_entree, val)}
                    </p>
                  )}
                </div>
              ))}
            </div>

            <div className="flex items-center gap-4 mt-2 pt-2" style={{ borderTop: `1px solid ${D.border}` }}>
              {rr1 != null && (
                <span className="text-[10px] text-white/40">
                  R/R TP1 <span className="font-bold" style={{ color: isLong ? D.green : D.red }}>{rr1.toFixed(1)}x</span>
                </span>
              )}
              <button
                onClick={() => router.push(`/signaux/${row.ticker}?id=${row.id}`)}
                className="ml-auto text-[10px] transition"
                style={{ color: "rgba(255,255,255,0.25)" }}
                onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.7)")}
                onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.25)")}>
                Voir graphe ↗
              </button>
            </div>

            {row.raisonnement && (
              <p className="text-[10px] italic mt-2 text-white/25">
                🧠 "{row.raisonnement.slice(0, 120)}{row.raisonnement.length > 120 ? "…" : ""}"
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Skeleton row ─────────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 px-5 py-4 rounded-2xl animate-pulse"
      style={{ background: D.card, border: `1px solid ${D.border}` }}>
      <div className="h-7 w-24 rounded-full" style={{ background: "rgba(255,255,255,0.05)" }} />
      <div className="w-9 h-9 rounded-xl flex-shrink-0" style={{ background: "rgba(255,255,255,0.05)" }} />
      <div className="flex-1 space-y-1.5">
        <div className="h-3 w-20 rounded" style={{ background: "rgba(255,255,255,0.05)" }} />
        <div className="h-2.5 w-32 rounded" style={{ background: "rgba(255,255,255,0.03)" }} />
      </div>
      <div className="h-3 w-16 rounded hidden md:block" style={{ background: "rgba(255,255,255,0.05)" }} />
      <div className="h-3 w-12 rounded" style={{ background: "rgba(255,255,255,0.05)" }} />
      <div className="h-3 w-10 rounded" style={{ background: "rgba(255,255,255,0.05)" }} />
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function Signaux() {
  const router = useRouter()

  const [user,         setUser]         = useState<any>(null)
  const [plan,         setPlan]         = useState("free")
  const [showUpgrade,  setShowUpgrade]  = useState(false)
  const [signals,      setSignals]      = useState<SignalResult[]>([])
  const [stats,        setStats]        = useState<Stats | null>(null)
  const [loading,      setLoading]      = useState(true)
  const [tab,          setTab]          = useState<"live" | "historique">("live")
  const [filterSignal, setFilterSignal] = useState("all")
  const [filterType,   setFilterType]   = useState("all_types")
  const [sortBy,       setSortBy]       = useState("confluence")
  const [view,         setView]         = useState<"list" | "table">("list")
  const [countdown,    setCountdown]    = useState(300)
  const [historique,   setHistorique]   = useState<HistoriqueRow[]>([])
  const [histLoading,  setHistLoading]  = useState(false)
  const [isMarketOpen, setIsMarketOpen] = useState(false)

  useEffect(() => {
    setIsMarketOpen(isNYSEOpenNow())
    const t = setInterval(() => setIsMarketOpen(isNYSEOpenNow()), 60_000)
    return () => clearInterval(t)
  }, [])

  const fetchSignals = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/signals")
      if (!res.ok) {
        console.error("[signaux] API error", res.status, await res.text().catch(() => ""))
        return
      }
      const data = await res.json()
      console.log("[signaux] received", data.signals?.length ?? 0, "signals", data.stats)
      setSignals(data.signals ?? [])
      setStats(data.stats ?? null)
      setCountdown(300)
    } catch (e) {
      console.error("[signaux] fetch failed", e)
    }
    finally { setLoading(false) }
  }, [])

  // Auth + plan
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push("/login"); return }
      setUser(data.user)
      const { data: profile } = await supabase
        .from("profiles").select("plan").eq("email", data.user.email).maybeSingle()
      setPlan(getPlan(profile?.plan ?? "free"))
    })
  }, [router])

  // Fetch on mount + interval
  useEffect(() => {
    if (!user) return
    fetchSignals()
    const interval = setInterval(fetchSignals, 300_000)
    return () => clearInterval(interval)
  }, [user, fetchSignals])

  // Countdown
  useEffect(() => {
    const t = setInterval(() => setCountdown(c => c <= 1 ? 300 : c - 1), 1000)
    return () => clearInterval(t)
  }, [])

  // Historique
  useEffect(() => {
    if (tab !== "historique" || plan === "free" || historique.length > 0) return
    setHistLoading(true)
    supabase.from("signaux").select("*").order("created_at", { ascending: false }).limit(50)
      .then(({ data }) => { if (data) setHistorique(data as HistoriqueRow[]); setHistLoading(false) })
  }, [tab, plan, historique.length])

  if (!user) return null

  // ── Filter + sort ────────────────────────────────────────────────────────
  const filtered = signals
    .filter(s => filterSignal === "all" || s.signal === filterSignal)
    .filter(s => filterType  === "all_types" || s.type === filterType)
    .sort((a, b) => {
      if (sortBy === "confluence") return b.confluence_score - a.confluence_score
      if (sortBy === "rr")         return b.risk_reward_tp1 - a.risk_reward_tp1
      if (sortBy === "change")     return Math.abs(b.change_24h) - Math.abs(a.change_24h)
      return 0
    })

  const topSignals = [...signals]
    .sort((a, b) => b.confluence_score - a.confluence_score)
    .slice(0, 3)

  const isBlurring = plan === "free"
  const s = stats ?? { total: 0, fort: 0, achats: 0, ventes: 0, avg_confluence: 0 }

  return (
    <>
      <div className="min-h-screen" style={{ background: D.bg }}>

        {/* ════════════════════════════════════════════════
            HEADER — Market Pulse
        ════════════════════════════════════════════════ */}
        <div className="px-6 py-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>

          {/* Title + status + countdown */}
          <div className="flex items-center justify-between flex-wrap gap-4 mb-4">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-black text-white">Signaux IA</h1>

              {/* Tabs */}
              <div className="flex rounded-xl overflow-hidden" style={{ border: `1px solid ${D.border}` }}>
                {(["live", "historique"] as const).map(t => (
                  <button key={t} onClick={() => setTab(t)}
                    className="px-4 py-1.5 text-[11px] font-bold transition-all"
                    style={{
                      background: tab === t ? "rgba(255,255,255,0.1)" : "transparent",
                      color: tab === t ? "white" : "rgba(255,255,255,0.3)",
                    }}>
                    {t === "live" ? "Live" : "Historique"}
                  </button>
                ))}
              </div>

              {/* Market status */}
              {isMarketOpen ? (
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black text-green-400"
                  style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)" }}>
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-400" />
                  </span>
                  LIVE
                </span>
              ) : (
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black text-yellow-400"
                  style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)" }}>
                  🌙 Marché fermé · Signaux valables à l'ouverture
                </span>
              )}
            </div>

            {/* Countdown + refresh */}
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-[9px] text-white/25 uppercase tracking-widest">Prochain scan</p>
                <p className={`text-lg font-black tabular-nums ${countdown <= 60 ? "text-red-400" : "text-white"}`}>
                  {formatCountdown(countdown)}
                </p>
                <div className="w-20 h-0.5 rounded-full mt-1" style={{ background: "rgba(255,255,255,0.05)" }}>
                  <div className="h-full rounded-full transition-all duration-1000"
                    style={{
                      width: `${(countdown / 300) * 100}%`,
                      background: countdown <= 60 ? D.red : D.green,
                    }} />
                </div>
              </div>
              <button onClick={fetchSignals} disabled={loading}
                className="w-9 h-9 rounded-xl flex items-center justify-center transition-all disabled:opacity-40"
                style={{ border: `1px solid ${D.border}`, color: "rgba(255,255,255,0.4)" }}
                onMouseEnter={e => (e.currentTarget.style.color = "white")}
                onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.4)")}>
                <span className={`text-base ${loading ? "animate-spin" : ""}`}>↻</span>
              </button>
            </div>
          </div>

          {/* Mood du marché */}
          {s.total > 0 && (
            <div className="mb-4 px-4 py-2.5 rounded-xl"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <p className="text-sm text-white/60">
                {s.achats > s.ventes
                  ? `📈 Le marché est plutôt haussier aujourd'hui — ${s.achats} signal${s.achats > 1 ? "s" : ""} d'achat sur ${s.total}.`
                  : s.ventes > s.achats
                    ? `📉 Le marché est plutôt baissier aujourd'hui — ${s.ventes} signal${s.ventes > 1 ? "s" : ""} de vente sur ${s.total}.`
                    : "⚖️ Le marché est neutre — autant de signaux haussiers que baissiers."}
                {s.fort > 0 && (
                  <span className="text-orange-400 font-bold">
                    {" "}⚡ {s.fort} signal{s.fort > 1 ? "s" : ""} fort{s.fort > 1 ? "s" : ""} détecté{s.fort > 1 ? "s" : ""} !
                  </span>
                )}
              </p>
            </div>
          )}

          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
            {[
              {
                label: "⚡ Forts",
                value: String(s.fort),
                color: s.fort > 0 ? "#f97316" : "rgba(255,255,255,0.25)",
                bg:    s.fort > 0 ? "rgba(249,115,22,0.08)" : "rgba(255,255,255,0.03)",
                border:s.fort > 0 ? "rgba(249,115,22,0.2)"  : D.border,
                desc:  "Priorité maximale",
              },
              {
                label: "📈 Achats",
                value: String(s.achats),
                color: "#4ade80",
                bg:    "rgba(34,197,94,0.05)",
                border:"rgba(34,197,94,0.12)",
                desc:  "Signaux haussiers",
              },
              {
                label: "📉 Ventes",
                value: String(s.ventes),
                color: "#f87171",
                bg:    "rgba(239,68,68,0.05)",
                border:"rgba(239,68,68,0.12)",
                desc:  "Signaux baissiers",
              },
              {
                label: "🎯 Confiance moy.",
                value: `${s.avg_confluence}%`,
                color: s.avg_confluence >= 65 ? "#4ade80" : s.avg_confluence >= 50 ? "#fbbf24" : "#9ca3af",
                bg:    "rgba(255,255,255,0.03)",
                border:D.border,
                desc:  s.avg_confluence >= 65 ? "Qualité élevée 🔥" : "Qualité moyenne",
              },
              {
                label: "🌡️ Sentiment",
                value: s.achats > s.ventes ? "Haussier 🐂" : s.ventes > s.achats ? "Baissier 🐻" : "Neutre",
                color: s.achats > s.ventes ? "#4ade80" : s.ventes > s.achats ? "#f87171" : "#9ca3af",
                bg:    "rgba(255,255,255,0.03)",
                border:D.border,
                desc:  "Orientation globale",
              },
            ].map(kpi => (
              <div key={kpi.label} className="rounded-xl p-3"
                style={{ background: kpi.bg, border: `1px solid ${kpi.border}` }}>
                <p className="text-[10px] text-white/30 mb-1">{kpi.label}</p>
                <p className="text-xl font-black tabular-nums" style={{ color: kpi.color }}>{kpi.value}</p>
                <p className="text-[9px] text-white/20 mt-0.5">{kpi.desc}</p>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="flex gap-1.5 flex-wrap items-center">
            {/* Signal type */}
            {[
              { key: "all",        label: "🌐 Tous" },
              { key: "ACHAT_FORT", label: "⚡ Fort achat",  color: "#f97316" },
              { key: "ACHAT",      label: "↗ Achat",        color: "#22c55e" },
              { key: "VENTE",      label: "↘ Vente",        color: "#ef4444" },
              { key: "VENTE_FORT", label: "⚡ Fort vente",  color: "#dc2626" },
            ].map(f => (
              <button key={f.key} onClick={() => setFilterSignal(f.key)}
                className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
                style={{
                  background: filterSignal === f.key
                    ? ((f as any).color ? (f as any).color + "18" : "rgba(255,255,255,0.08)")
                    : "rgba(255,255,255,0.04)",
                  color: filterSignal === f.key ? ((f as any).color ?? "white") : "rgba(255,255,255,0.35)",
                  border: `1px solid ${filterSignal === f.key
                    ? ((f as any).color ? (f as any).color + "30" : "rgba(255,255,255,0.15)")
                    : "rgba(255,255,255,0.06)"}`,
                }}>
                {f.label}
              </button>
            ))}

            <div className="h-5 w-px bg-white/10 mx-0.5 flex-shrink-0" />

            {/* Asset type */}
            {[
              { key: "all_types", label: "Tous" },
              { key: "stock",     label: "📈 Actions" },
              { key: "crypto",    label: "₿ Crypto" },
              { key: "etf",       label: "📦 ETF" },
            ].map(f => (
              <button key={f.key} onClick={() => setFilterType(f.key)}
                className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
                style={{
                  background: filterType === f.key ? "rgba(255,255,255,0.08)" : "transparent",
                  color:      filterType === f.key ? "white" : "rgba(255,255,255,0.30)",
                  border:     `1px solid ${filterType === f.key ? "rgba(255,255,255,0.12)" : "transparent"}`,
                }}>
                {f.label}
              </button>
            ))}

            {/* Sort — pushed right */}
            <div className="ml-auto flex items-center gap-1">
              <span className="text-[10px] text-white/25 hidden sm:block">Trier :</span>
              {[
                { key: "confluence", label: "Confiance" },
                { key: "rr",         label: "R/R" },
                { key: "change",     label: "Variation" },
              ].map(s => (
                <button key={s.key} onClick={() => setSortBy(s.key)}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all"
                  style={{
                    background: sortBy === s.key ? "rgba(255,255,255,0.08)" : "transparent",
                    color:      sortBy === s.key ? "white" : "rgba(255,255,255,0.25)",
                  }}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ════════════════════════════════════════════════
            LIVE TAB
        ════════════════════════════════════════════════ */}
        {tab === "live" && (
          <>
            {/* ── HERO CARD ── */}
            {!loading && topSignals[0] && (
              <div className="px-6 py-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <p className="text-[10px] text-white/25 uppercase tracking-widest font-bold mb-4">
                  ⭐ Meilleure opportunité
                </p>
                <HeroSignalCard
                  signal={topSignals[0]}
                  onUpgrade={() => setShowUpgrade(true)}
                />
              </div>
            )}

            {/* ── COMPACT CARDS #2 & #3 ── */}
            {!loading && topSignals.slice(1, 3).length > 0 && (
              <div className="px-6 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {topSignals.slice(1, 3).map((signal, i) => (
                    <CompactSignalCard
                      key={signal.symbol}
                      signal={signal}
                      rank={i + 2}
                      onUpgrade={() => setShowUpgrade(true)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* ── FEED ── */}
            <div className="px-6 py-4 pb-10">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[10px] text-white/25 uppercase tracking-widest font-bold">
                  Tous les signaux ({loading ? "…" : filtered.length})
                </p>
                {/* View toggle */}
                <div className="flex rounded-lg overflow-hidden" style={{ border: `1px solid ${D.border}` }}>
                  {[{ key: "list", icon: "☰" }, { key: "table", icon: "⊞" }].map(v => (
                    <button key={v.key} onClick={() => setView(v.key as "list" | "table")}
                      className="w-8 h-7 flex items-center justify-center text-xs transition-all"
                      style={{
                        background: view === v.key ? "rgba(255,255,255,0.1)" : "transparent",
                        color:      view === v.key ? "white" : "rgba(255,255,255,0.25)",
                      }}>
                      {v.icon}
                    </button>
                  ))}
                </div>
              </div>

              {/* Loading skeletons */}
              {loading && (
                <div className="space-y-2">
                  {Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)}
                </div>
              )}

              {/* Empty state */}
              {!loading && filtered.length === 0 && (
                <div className="text-center py-16">
                  <p className="text-4xl mb-3">📡</p>
                  <p className="font-black text-white mb-2">Aucun signal trouvé</p>
                  <p className="text-white/40 text-sm mb-4">
                    {filterSignal !== "all" || filterType !== "all_types"
                      ? "Essaie de changer les filtres."
                      : "L'algorithme scanne les marchés en continu. Reviens dans quelques minutes."}
                  </p>
                  {(filterSignal !== "all" || filterType !== "all_types") && (
                    <button onClick={() => { setFilterSignal("all"); setFilterType("all_types") }}
                      className="px-5 py-2.5 rounded-xl text-sm font-black text-black"
                      style={{ background: D.green }}>
                      Réinitialiser les filtres
                    </button>
                  )}
                </div>
              )}

              {/* ── LIST VIEW ── */}
              {!loading && filtered.length > 0 && view === "list" && (
                <div className="relative">
                  <div className="space-y-2">
                    {filtered.map((signal, idx) => {
                      const blurred  = isBlurring && idx >= 3
                      const bullish  = isBull(signal.signal)
                      const color    = bullish ? D.green : D.red
                      const pctTp    = signal.entry_price ? ((signal.tp1 - signal.entry_price) / signal.entry_price) * 100 : 0
                      const rr       = Math.abs(signal.sl - signal.entry_price) > 0
                        ? Math.abs(signal.tp1 - signal.entry_price) / Math.abs(signal.sl - signal.entry_price)
                        : signal.risk_reward_tp1
                      const topReason = signal.confirmed_by[0] ? humanReason(signal.confirmed_by[0]) : null

                      if (blurred) return (
                        <div key={signal.symbol} className="relative flex items-center gap-4 px-5 py-4 rounded-2xl"
                          style={{ background: D.card, border: `1px solid ${D.border}` }}>
                          <div className="absolute inset-0 z-10 flex items-center justify-end pr-5 rounded-2xl"
                            style={{ backdropFilter: "blur(4px)", background: "rgba(5,5,5,0.65)" }}>
                            <button onClick={() => setShowUpgrade(true)}
                              className="text-[10px] font-black px-3 py-1.5 rounded-lg transition"
                              style={{ background: "rgba(34,197,94,0.2)", border: "1px solid rgba(34,197,94,0.3)", color: D.green }}>
                              🔒 Premium
                            </button>
                          </div>
                          <div className="h-6 w-20 rounded-full" style={{ background: "rgba(255,255,255,0.05)" }} />
                          <div className="w-9 h-9 rounded-xl" style={{ background: "rgba(255,255,255,0.04)" }} />
                          <div className="flex-1 space-y-1.5">
                            <div className="h-3 w-16 rounded" style={{ background: "rgba(255,255,255,0.05)" }} />
                            <div className="h-2 w-24 rounded" style={{ background: "rgba(255,255,255,0.03)" }} />
                          </div>
                        </div>
                      )

                      return (
                        <div key={signal.symbol}
                          className="flex items-center gap-3 md:gap-4 px-5 py-4 rounded-2xl cursor-pointer transition-all group"
                          style={{ background: D.card, border: `1px solid ${D.border}` }}
                          onClick={() => router.push(`/signaux/${signal.symbol}`)}
                          onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
                          onMouseLeave={e => (e.currentTarget.style.borderColor = D.border)}>

                          {/* Signal badge */}
                          <span className="text-[10px] font-black px-2.5 py-1 rounded-full flex-shrink-0 w-[88px] text-center"
                            style={{ background: `${color}15`, color, border: `1px solid ${color}25` }}>
                            {sigLabelShort(signal.signal)}
                          </span>

                          {/* Avatar + name */}
                          <div className="flex items-center gap-2.5 flex-1 min-w-0">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-[11px] font-black text-black flex-shrink-0"
                              style={{ background: color }}>
                              {signal.symbol.replace("-USD", "")[0]}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-black text-white">{signal.symbol.replace("-USD", "")}</p>
                              <p className="text-[10px] text-white/30 truncate">{signal.name.slice(0, 24)}</p>
                            </div>
                          </div>

                          {/* Top reason */}
                          {topReason && (
                            <span className="hidden lg:inline text-[10px] text-white/35 px-2 py-1 rounded-lg flex-shrink-0"
                              style={{ background: "rgba(255,255,255,0.04)" }}>
                              ✓ {topReason}
                            </span>
                          )}

                          {/* Price */}
                          <p className="text-sm font-black text-white tabular-nums flex-shrink-0">
                            {formatPrice(signal.price)}
                          </p>

                          {/* Change */}
                          <p className={`text-sm font-bold tabular-nums flex-shrink-0 w-14 text-right ${signal.change_24h >= 0 ? "text-green-400" : "text-red-400"}`}>
                            {formatChange(signal.change_24h)}
                          </p>

                          {/* Confluence bar */}
                          <div className="hidden md:flex items-center gap-2 flex-shrink-0">
                            <div className="w-14 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                              <div className="h-full rounded-full"
                                style={{
                                  width: `${signal.confluence_score}%`,
                                  background: signal.confluence_score >= 70 ? "#22c55e"
                                    : signal.confluence_score >= 55 ? "#f59e0b" : "#ef4444",
                                }} />
                            </div>
                            <span className="text-[10px] font-black w-8" style={{ color }}>
                              {signal.confluence_score.toFixed(0)}%
                            </span>
                          </div>

                          {/* R/R */}
                          <span className="hidden md:inline text-[11px] font-bold text-white/40 flex-shrink-0 w-9 text-right">
                            {rr.toFixed(1)}x
                          </span>

                          {/* Expire */}
                          <span className="text-[10px] text-white/25 flex-shrink-0 w-12 text-right tabular-nums hidden sm:block">
                            {timeUntilExpiry(signal.expires_at)}
                          </span>

                          {/* Arrow */}
                          <span className="text-white/20 group-hover:text-white/60 transition-colors flex-shrink-0">→</span>
                        </div>
                      )
                    })}
                  </div>

                  {/* Upgrade gradient */}
                  {isBlurring && filtered.length > 3 && (
                    <div className="relative -mt-20 h-24 flex items-end justify-center pb-5"
                      style={{ background: `linear-gradient(to bottom, transparent, ${D.bg})` }}>
                      <button onClick={() => setShowUpgrade(true)}
                        className="px-7 py-3 rounded-2xl text-sm font-black text-black transition-all hover:scale-105 active:scale-95"
                        style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)", boxShadow: "0 0 30px rgba(34,197,94,0.3)" }}>
                        🚀 Débloquer tous les signaux
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* ── TABLE VIEW ── */}
              {!loading && filtered.length > 0 && view === "table" && (
                <div className="relative overflow-x-auto rounded-2xl" style={{ border: `1px solid ${D.border}` }}>
                  <table className="w-full">
                    <thead>
                      <tr style={{ background: "rgba(255,255,255,0.02)", borderBottom: `1px solid ${D.border}` }}>
                        {["Signal", "Actif", "Raison", "Prix", "Var.", "Confiance", "R/R", "Expire", ""].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-[9px] text-white/25 uppercase tracking-widest font-bold whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((signal, idx) => {
                        const blurred  = isBlurring && idx >= 3
                        const bullish  = isBull(signal.signal)
                        const color    = bullish ? D.green : D.red
                        const rr       = Math.abs(signal.sl - signal.entry_price) > 0
                          ? Math.abs(signal.tp1 - signal.entry_price) / Math.abs(signal.sl - signal.entry_price)
                          : signal.risk_reward_tp1
                        const topReason = signal.confirmed_by[0] ? humanReason(signal.confirmed_by[0]) : "—"

                        return (
                          <tr key={signal.symbol}
                            className="transition-all cursor-pointer"
                            style={{ borderBottom: `1px solid ${D.border}` }}
                            onClick={() => !blurred && router.push(`/signaux/${signal.symbol}`)}
                            onMouseEnter={e => !blurred && (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
                            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                            <td className="px-4 py-3 relative">
                              {blurred && (
                                <div className="absolute inset-0 z-10 flex items-center justify-start pl-4"
                                  style={{ backdropFilter: "blur(4px)", background: "rgba(5,5,5,0.65)" }}>
                                  <button onClick={e => { e.stopPropagation(); setShowUpgrade(true) }}
                                    className="text-[9px] font-black px-2 py-1 rounded-md"
                                    style={{ background: "rgba(34,197,94,0.2)", color: D.green }}>
                                    🔒 Pro
                                  </button>
                                </div>
                              )}
                              <span className="text-[10px] font-black px-2 py-0.5 rounded-full"
                                style={{ background: `${color}15`, color, border: `1px solid ${color}25` }}>
                                {sigLabelShort(signal.signal)}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black text-black flex-shrink-0"
                                  style={{ background: color }}>
                                  {signal.symbol.replace("-USD", "")[0]}
                                </div>
                                <div>
                                  <p className="text-xs font-bold text-white">{signal.symbol.replace("-USD", "")}</p>
                                  <p className="text-[9px] text-white/25">{signal.name.slice(0, 16)}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-[10px] text-white/40">✓ {topReason}</span>
                            </td>
                            <td className="px-4 py-3 text-xs font-bold text-white tabular-nums">
                              {formatPrice(signal.price)}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`text-xs font-bold tabular-nums ${signal.change_24h >= 0 ? "text-green-400" : "text-red-400"}`}>
                                {formatChange(signal.change_24h)}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1.5">
                                <div className="w-12 h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                                  <div className="h-full rounded-full"
                                    style={{ width: `${signal.confluence_score}%`, background: color }} />
                                </div>
                                <span className="text-[10px] font-black" style={{ color }}>
                                  {signal.confluence_score.toFixed(0)}%
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-xs font-bold text-white/50">{rr.toFixed(1)}x</td>
                            <td className="px-4 py-3 text-[10px] text-white/25 tabular-nums">
                              {timeUntilExpiry(signal.expires_at)}
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-[10px] font-bold text-white/25 hover:text-white transition">
                                Analyser →
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>

                  {isBlurring && filtered.length > 3 && (
                    <div className="relative -mt-12 h-16 flex items-end justify-center pb-4"
                      style={{ background: `linear-gradient(to bottom, transparent, ${D.bg})` }}>
                      <button onClick={() => setShowUpgrade(true)}
                        className="px-7 py-2.5 rounded-2xl text-sm font-black text-black transition-all hover:scale-105"
                        style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)" }}>
                        🚀 Débloquer tous les signaux
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {/* ════════════════════════════════════════════════
            HISTORIQUE TAB
        ════════════════════════════════════════════════ */}
        {tab === "historique" && (
          <div className="px-6 py-6 space-y-4">
            <h2 className="text-xl font-black tracking-tight text-white">Historique des signaux</h2>
            {plan === "free" ? (
              <div className="text-center py-16 rounded-2xl" style={{ border: `1px solid ${D.border}` }}>
                <p className="text-4xl mb-3">🔒</p>
                <p className="text-lg font-bold text-white mb-1">Accès Premium requis</p>
                <p className="text-sm mb-4 text-white/30">
                  Consultez l'historique complet des signaux avec un abonnement Pro
                </p>
                <button onClick={() => setShowUpgrade(true)}
                  className="px-6 py-2.5 rounded-xl text-sm font-black text-black"
                  style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)" }}>
                  Débloquer l'historique
                </button>
              </div>
            ) : histLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-28 rounded-2xl animate-pulse"
                    style={{ background: D.card, border: `1px solid ${D.border}` }} />
                ))}
              </div>
            ) : (
              <HistoriqueView rows={historique} />
            )}
          </div>
        )}

      </div>

      <UpgradeModal open={showUpgrade} onClose={() => setShowUpgrade(false)} context="signals" />
    </>
  )
}
