"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import type { SignalResult } from "@/app/api/signals/route"
import UpgradeModal from "@/app/components/UpgradeModal"
import { RefreshCw } from "lucide-react"
import { getPlan } from "@/lib/plans"

// ─── Design tokens ────────────────────────────────────────────────────────────

const D = {
  bg:     "#050505",
  card:   "#0a0a0a",
  border: "rgba(255,255,255,0.06)",
  green:  "#22c55e",
  red:    "#ef4444",
  yellow: "#f59e0b",
  purple: "#8b5cf6",
} as const

// ─── Types ────────────────────────────────────────────────────────────────────

type Stats = {
  total: number
  fort: number
  achats: number
  ventes: number
  avg_confluence: number
}

type HistoriqueRow = {
  id: string
  ticker: string
  direction: string
  prix_entree: number
  take_profit_1: number
  take_profit_2: number
  take_profit_3?: number
  stop_loss: number
  timeframe: string
  score_confiance: number
  statut: string
  raisonnement?: string
  indicateurs?: Record<string, any>
  created_at: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const INDICATOR_EXPLANATIONS: Record<string, string> = {
  "RSI·14": "RSI sous 35 — l'actif est en zone de survente",
  "RSI·7": "RSI court terme sous 30 — momentum très faible",
  "MACD·Hist↑": "Histogramme MACD positif et croissant — momentum haussier",
  "EMA·Cross": "EMA9 au-dessus de l'EMA21 — tendance court terme haussière",
  "BB·Lower": "Prix sous la bande de Bollinger basse — rebond probable",
  "Volume·élevé": "Volume 1.5x la moyenne — intérêt institutionnel",
  "OBV↑": "On-Balance Volume en hausse — pression acheteuse sous-jacente",
  "Stoch·%K": "Stochastique en zone de survente — momentum retournement",
  "Support": "Prix proche d'un support clé — zone d'achat potentielle",
  "Hammer": "Pattern chandelier Hammer — signal de retournement haussier",
  "Bullish Engulfing": "Bougie englobante haussière — forte pression acheteuse",
  "VWAP": "Prix sous le VWAP — opportunité d'achat pour les institutionnels",
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function signalBadge(signal: string): { label: string; color: string; bg: string; border: string } {
  switch (signal) {
    case "ACHAT_FORT":
      return { label: "ACHAT FORT ⚡", color: "#86efac", bg: "rgba(34,197,94,0.15)", border: "rgba(34,197,94,0.35)" }
    case "ACHAT":
      return { label: "ACHAT ↗", color: "#4ade80", bg: "rgba(34,197,94,0.1)", border: "rgba(34,197,94,0.25)" }
    case "VENTE_FORT":
      return { label: "VENTE FORTE ⚡", color: "#fca5a5", bg: "rgba(239,68,68,0.15)", border: "rgba(239,68,68,0.35)" }
    case "VENTE":
      return { label: "VENTE ↘", color: "#f87171", bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.25)" }
    default:
      return { label: signal, color: "rgba(255,255,255,0.4)", bg: "rgba(255,255,255,0.05)", border: "rgba(255,255,255,0.1)" }
  }
}

function formatCountdown(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${s.toString().padStart(2, "0")}`
}

function pctChange(from: number, to: number): string {
  const pct = ((to - from) / Math.abs(from)) * 100
  return (pct >= 0 ? "+" : "") + pct.toFixed(1) + "%"
}

function timeUntilExpiry(expires_at: string): string {
  const diff = new Date(expires_at).getTime() - Date.now()
  if (diff <= 0) return "Expiré"
  const h = Math.floor(diff / 3_600_000)
  const m = Math.floor((diff % 3_600_000) / 60_000)
  if (h > 0) return `${h}h${m > 0 ? m + "m" : ""}`
  return `${m}m`
}

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 2) return "à l'instant"
  if (mins < 60) return `il y a ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `il y a ${hours}h`
  return `il y a ${Math.floor(hours / 24)}j`
}

function isBuySignal(signal: string): boolean {
  return signal === "ACHAT" || signal === "ACHAT_FORT"
}

function fmtPrice(price: number): string {
  return price < 1
    ? price.toFixed(4)
    : price.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ─── Skeleton row ─────────────────────────────────────────────────────────────

function SignalRowSkeleton() {
  return (
    <div className="grid gap-4 px-4 py-3 animate-pulse"
      style={{ gridTemplateColumns: "auto 1fr auto auto auto auto auto auto" }}>
      <div className="h-6 w-20 rounded-lg" style={{ background: "rgba(255,255,255,0.05)" }} />
      <div>
        <div className="h-3.5 w-16 rounded mb-1" style={{ background: "rgba(255,255,255,0.05)" }} />
        <div className="h-2.5 w-24 rounded" style={{ background: "rgba(255,255,255,0.03)" }} />
      </div>
      <div className="h-3.5 w-14 rounded" style={{ background: "rgba(255,255,255,0.05)" }} />
      <div className="h-3.5 w-10 rounded" style={{ background: "rgba(255,255,255,0.05)" }} />
      <div className="h-3.5 w-24 rounded" style={{ background: "rgba(255,255,255,0.05)" }} />
      <div className="h-3.5 w-8 rounded" style={{ background: "rgba(255,255,255,0.05)" }} />
      <div className="h-3.5 w-16 rounded" style={{ background: "rgba(255,255,255,0.05)" }} />
      <div className="h-6 w-16 rounded-lg" style={{ background: "rgba(255,255,255,0.05)" }} />
    </div>
  )
}

// ─── Top 3 Card ───────────────────────────────────────────────────────────────

function Top3Card({ signal, rank }: { signal: SignalResult; rank: number }) {
  const router = useRouter()
  const b = signalBadge(signal.signal)
  const isLong = isBuySignal(signal.signal)
  const isFort = signal.signal === "ACHAT_FORT" || signal.signal === "VENTE_FORT"

  return (
    <div className="relative rounded-2xl overflow-hidden"
      style={{
        background: D.card,
        border: isFort
          ? `1px solid ${isLong ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`
          : `1px solid ${D.border}`,
      }}>
      {/* Color top band */}
      <div className="h-0.5 w-full" style={{ background: isLong ? D.green : D.red }} />

      <div className="p-5 space-y-3">
        {/* Rank badge + signal */}
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              {rank === 1 && (
                <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full"
                  style={{ background: "#f59e0b", color: "#000" }}>
                  #1
                </span>
              )}
              <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-lg"
                style={{ background: b.bg, border: `1px solid ${b.border}`, color: b.color }}>
                {b.label}
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-white font-black text-xl">{signal.symbol}</span>
              <span className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>{signal.name}</span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-white font-black text-lg">{fmtPrice(signal.price)}</p>
            <p className="text-xs font-bold" style={{ color: signal.change_24h >= 0 ? D.green : D.red }}>
              {signal.change_24h >= 0 ? "+" : ""}{signal.change_24h.toFixed(2)}%
            </p>
          </div>
        </div>

        {/* Confluence bar */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.3)" }}>Confluence</span>
            <span className="text-xs font-black text-white">
              {signal.confluence_score.toFixed(0)}%
              <span className="font-normal ml-1" style={{ color: "rgba(255,255,255,0.3)" }}>
                ({signal.confluence_count}/{signal.total_indicators})
              </span>
            </span>
          </div>
          <div className="w-full h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.05)" }}>
            <div className="h-1.5 rounded-full transition-all"
              style={{
                width: `${signal.confluence_score}%`,
                background: isLong
                  ? "linear-gradient(to right, #16a34a, #22c55e)"
                  : "linear-gradient(to right, #dc2626, #ef4444)"
              }} />
          </div>
          <div className="flex flex-wrap gap-1 mt-2">
            {signal.confirmed_by.slice(0, 3).map(label => (
              <span key={label} className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
                style={{
                  background: isLong ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
                  border: isLong ? "1px solid rgba(34,197,94,0.2)" : "1px solid rgba(239,68,68,0.2)",
                  color: isLong ? "#4ade80" : "#f87171",
                }}>
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* TP/SL grid */}
        <div className="grid grid-cols-3 gap-2 text-center rounded-xl p-2"
          style={{ background: "rgba(255,255,255,0.02)" }}>
          {[
            { label: "Entrée", val: signal.entry_price },
            { label: "TP1", val: signal.tp1 },
            { label: "SL", val: signal.sl },
          ].map(({ label, val }) => (
            <div key={label}>
              <p className="text-[9px] font-bold uppercase mb-0.5"
                style={{ color: label === "SL" ? D.red : label === "TP1" ? D.green : "rgba(255,255,255,0.3)" }}>
                {label}
              </p>
              <p className="text-white text-[11px] font-bold">
                {val < 1 ? val.toFixed(4) : val.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}
              </p>
              {label !== "Entrée" && (
                <p className="text-[9px]" style={{ color: label === "SL" ? "rgba(239,68,68,0.6)" : "rgba(34,197,94,0.7)" }}>
                  {pctChange(signal.entry_price, val)}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* AI comment */}
        {signal.ai_comment && (
          <div className="flex gap-2 items-start rounded-xl px-3 py-2"
            style={{ background: "rgba(255,255,255,0.02)" }}>
            <span className="text-sm flex-shrink-0">🧠</span>
            <p className="text-[11px] italic leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>
              "{signal.ai_comment}"
            </p>
          </div>
        )}

        {/* Button */}
        <button
          onClick={() => {
            const params = new URLSearchParams({ symbol: signal.symbol })
            if (signal.entry_price) params.set("price", String(signal.entry_price))
            if (signal.tp1) params.set("tp", String(signal.tp1))
            if (signal.sl) params.set("sl", String(signal.sl))
            router.push(`/dashboard?${params.toString()}`)
          }}
          className="w-full text-[11px] font-bold py-2 rounded-xl transition-all hover:opacity-80"
          style={{
            background: isLong ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
            border: isLong ? "1px solid rgba(34,197,94,0.25)" : "1px solid rgba(239,68,68,0.25)",
            color: isLong ? D.green : D.red,
          }}>
          Voir le graphe →
        </button>
      </div>
    </div>
  )
}

// ─── Table row ────────────────────────────────────────────────────────────────

function SignalRow({ signal, blurred, onUpgrade }: { signal: SignalResult; blurred?: boolean; onUpgrade: () => void }) {
  const router = useRouter()
  const b = signalBadge(signal.signal)
  const isLong = isBuySignal(signal.signal)

  if (blurred) {
    return (
      <div className="relative px-4 py-3 flex items-center gap-4" style={{ borderTop: `1px solid ${D.border}` }}>
        <div className="absolute inset-0 z-10 flex items-center justify-end pr-4"
          style={{ backdropFilter: "blur(4px)", background: "rgba(5,5,5,0.7)" }}>
          <button onClick={onUpgrade}
            className="text-[10px] font-black px-3 py-1 rounded-lg transition-all hover:opacity-80"
            style={{ background: "rgba(34,197,94,0.2)", border: "1px solid rgba(34,197,94,0.3)", color: D.green }}>
            🔒 Premium
          </button>
        </div>
        {/* Blurred content placeholder */}
        <div className="h-6 w-20 rounded" style={{ background: "rgba(255,255,255,0.05)" }} />
        <div className="flex-1">
          <div className="h-3 w-12 rounded mb-1" style={{ background: "rgba(255,255,255,0.05)" }} />
          <div className="h-2.5 w-20 rounded" style={{ background: "rgba(255,255,255,0.03)" }} />
        </div>
      </div>
    )
  }

  return (
    <div
      className="hidden md:grid items-center gap-4 px-4 py-3 transition-colors cursor-pointer group"
      style={{
        gridTemplateColumns: "140px 1fr 90px 60px 140px 50px 70px 80px",
        borderTop: `1px solid ${D.border}`,
      }}
      onClick={() => {
        const params = new URLSearchParams({ symbol: signal.symbol })
        if (signal.entry_price) params.set("price", String(signal.entry_price))
        if (signal.tp1) params.set("tp", String(signal.tp1))
        if (signal.sl) params.set("sl", String(signal.sl))
        router.push(`/dashboard?${params.toString()}`)
      }}
      onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.015)")}
      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
    >
      {/* Signal badge */}
      <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-lg w-fit"
        style={{ background: b.bg, border: `1px solid ${b.border}`, color: b.color }}>
        {b.label}
      </span>

      {/* Asset */}
      <div>
        <div className="flex items-center gap-1.5">
          <p className="text-white font-bold text-sm">{signal.symbol}</p>
          {signal.candle_pattern && (
            <span className="text-[8px] font-bold px-1.5 py-0.5 rounded"
              style={{ background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.25)", color: "#a78bfa" }}>
              {signal.candle_pattern}
            </span>
          )}
        </div>
        <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>{signal.name}</p>
      </div>

      {/* Price */}
      <p className="text-white font-semibold text-sm tabular-nums">{fmtPrice(signal.price)}</p>

      {/* Change */}
      <p className="text-sm font-semibold tabular-nums"
        style={{ color: signal.change_24h >= 0 ? D.green : D.red }}>
        {signal.change_24h >= 0 ? "+" : ""}{signal.change_24h.toFixed(1)}%
      </p>

      {/* Confluence bar */}
      <div>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
            <div className="h-1 rounded-full"
              style={{
                width: `${signal.confluence_score}%`,
                background: isLong ? D.green : D.red,
              }} />
          </div>
          <span className="text-xs font-black text-white tabular-nums">{signal.confluence_score.toFixed(0)}%</span>
        </div>
      </div>

      {/* R/R */}
      <p className="text-sm font-semibold tabular-nums" style={{ color: "rgba(255,255,255,0.6)" }}>
        {signal.risk_reward_tp1.toFixed(1)}x
      </p>

      {/* Expire */}
      <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>
        {timeUntilExpiry(signal.expires_at)}
      </p>

      {/* Action */}
      <button
        className="text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all opacity-0 group-hover:opacity-100"
        style={{
          background: isLong ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
          border: isLong ? "1px solid rgba(34,197,94,0.25)" : "1px solid rgba(239,68,68,0.25)",
          color: isLong ? D.green : D.red,
        }}
        onClick={e => {
          e.stopPropagation()
          const params = new URLSearchParams({ symbol: signal.symbol })
          if (signal.entry_price) params.set("price", String(signal.entry_price))
          if (signal.tp1) params.set("tp", String(signal.tp1))
          if (signal.sl) params.set("sl", String(signal.sl))
          router.push(`/dashboard?${params.toString()}`)
        }}>
        Voir le graphe →
      </button>
    </div>
  )
}

// Mobile signal row (flex instead of grid)
function SignalRowMobile({ signal, blurred, onUpgrade }: { signal: SignalResult; blurred?: boolean; onUpgrade: () => void }) {
  const router = useRouter()
  const b = signalBadge(signal.signal)
  const isLong = isBuySignal(signal.signal)

  if (blurred) {
    return (
      <div className="relative px-4 py-3 flex items-center gap-3 md:hidden" style={{ borderTop: `1px solid ${D.border}` }}>
        <div className="absolute inset-0 z-10 flex items-center justify-end pr-4"
          style={{ backdropFilter: "blur(4px)", background: "rgba(5,5,5,0.7)" }}>
          <button onClick={onUpgrade}
            className="text-[10px] font-black px-3 py-1 rounded-lg"
            style={{ background: "rgba(34,197,94,0.2)", border: "1px solid rgba(34,197,94,0.3)", color: D.green }}>
            🔒 Premium
          </button>
        </div>
        <div className="h-6 w-20 rounded" style={{ background: "rgba(255,255,255,0.05)" }} />
        <div className="flex-1 h-3 rounded" style={{ background: "rgba(255,255,255,0.03)" }} />
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3 md:hidden"
      style={{ borderTop: `1px solid ${D.border}` }}
      onClick={() => {
        const params = new URLSearchParams({ symbol: signal.symbol })
        if (signal.entry_price) params.set("price", String(signal.entry_price))
        if (signal.tp1) params.set("tp", String(signal.tp1))
        if (signal.sl) params.set("sl", String(signal.sl))
        router.push(`/dashboard?${params.toString()}`)
      }}>
      <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded flex-shrink-0"
        style={{ background: b.bg, border: `1px solid ${b.border}`, color: b.color }}>
        {b.label}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-white font-bold text-sm truncate">{signal.symbol}</p>
        <p className="text-[10px] truncate" style={{ color: "rgba(255,255,255,0.3)" }}>{signal.name}</p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-white text-sm font-bold tabular-nums">{fmtPrice(signal.price)}</p>
        <p className="text-[10px] font-semibold tabular-nums"
          style={{ color: signal.change_24h >= 0 ? D.green : D.red }}>
          {signal.change_24h >= 0 ? "+" : ""}{signal.change_24h.toFixed(1)}%
        </p>
      </div>
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <span className="text-[10px] font-black text-white">{signal.confluence_score.toFixed(0)}%</span>
        <div className="w-12 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
          <div className="h-1 rounded-full"
            style={{ width: `${signal.confluence_score}%`, background: isLong ? D.green : D.red }} />
        </div>
      </div>
    </div>
  )
}

// ─── Grid card ────────────────────────────────────────────────────────────────

function GridCard({ signal, blurred, onUpgrade }: { signal: SignalResult; blurred?: boolean; onUpgrade: () => void }) {
  const router = useRouter()
  const b = signalBadge(signal.signal)
  const isLong = isBuySignal(signal.signal)

  return (
    <div className="relative rounded-xl overflow-hidden cursor-pointer transition-all hover:scale-[1.01]"
      style={{ background: D.card, border: `1px solid ${D.border}` }}
      onClick={() => {
        const params = new URLSearchParams({ symbol: signal.symbol })
        if (signal.entry_price) params.set("price", String(signal.entry_price))
        if (signal.tp1) params.set("tp", String(signal.tp1))
        if (signal.sl) params.set("sl", String(signal.sl))
        router.push(`/dashboard?${params.toString()}`)
      }}>
      {blurred && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl"
          style={{ backdropFilter: "blur(6px)", background: "rgba(5,5,5,0.75)" }}>
          <div className="text-center">
            <p className="text-2xl mb-1">🔒</p>
            <button onClick={e => { e.stopPropagation(); onUpgrade() }}
              className="text-[10px] font-black px-3 py-1 rounded-lg"
              style={{ background: "rgba(34,197,94,0.2)", border: "1px solid rgba(34,197,94,0.3)", color: D.green }}>
              Premium
            </button>
          </div>
        </div>
      )}

      <div className="h-0.5 w-full" style={{ background: isLong ? D.green : D.red }} />

      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded"
              style={{ background: b.bg, border: `1px solid ${b.border}`, color: b.color }}>
              {b.label}
            </span>
            <p className="text-white font-black text-base mt-1">{signal.symbol}</p>
            <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>{signal.name}</p>
          </div>
          <div className="text-right">
            <p className="text-white font-bold text-sm tabular-nums">{fmtPrice(signal.price)}</p>
            <p className="text-[10px] font-semibold"
              style={{ color: signal.change_24h >= 0 ? D.green : D.red }}>
              {signal.change_24h >= 0 ? "+" : ""}{signal.change_24h.toFixed(2)}%
            </p>
          </div>
        </div>

        <div>
          <div className="flex justify-between mb-1">
            <span className="text-[9px] font-semibold uppercase" style={{ color: "rgba(255,255,255,0.3)" }}>Confluence</span>
            <span className="text-[10px] font-black text-white">{signal.confluence_score.toFixed(0)}%</span>
          </div>
          <div className="w-full h-1 rounded-full" style={{ background: "rgba(255,255,255,0.05)" }}>
            <div className="h-1 rounded-full" style={{ width: `${signal.confluence_score}%`, background: isLong ? D.green : D.red }} />
          </div>
        </div>

        <div className="flex flex-wrap gap-1">
          {signal.confirmed_by.slice(0, 3).map(label => (
            <span key={label} className="text-[9px] px-1.5 py-0.5 rounded-full"
              style={{
                background: isLong ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
                border: isLong ? "1px solid rgba(34,197,94,0.2)" : "1px solid rgba(239,68,68,0.2)",
                color: isLong ? "#4ade80" : "#f87171",
              }}>
              {label}
            </span>
          ))}
        </div>

        <div className="flex items-center gap-3 text-[10px]">
          <span style={{ color: "rgba(255,255,255,0.3)" }}>TP1 <span className="font-bold" style={{ color: D.green }}>{pctChange(signal.entry_price, signal.tp1)}</span></span>
          <span style={{ color: "rgba(255,255,255,0.3)" }}>SL <span className="font-bold" style={{ color: D.red }}>{pctChange(signal.entry_price, signal.sl)}</span></span>
        </div>

        {signal.ai_comment && (
          <p className="text-[10px] italic truncate" style={{ color: "rgba(255,255,255,0.3)" }}>
            🧠 "{signal.ai_comment}"
          </p>
        )}
      </div>
    </div>
  )
}

// ─── Historique ───────────────────────────────────────────────────────────────

function HistoriqueView({ rows }: { rows: HistoriqueRow[] }) {
  const router = useRouter()

  return (
    <div className="space-y-2">
      {rows.length === 0 && (
        <div className="text-center py-16" style={{ color: "rgba(255,255,255,0.3)" }}>
          <p className="text-4xl mb-3">📋</p>
          <p className="text-lg font-semibold text-white">Aucun historique disponible</p>
          <p className="text-sm mt-1">Les signaux apparaîtront ici après le premier scan</p>
        </div>
      )}
      {rows.map(row => {
        const isLong = row.direction === "LONG"
        const ind = row.indicateurs as any
        const sigLabel = ind?.signal as string | undefined
        const b = sigLabel
          ? signalBadge(sigLabel)
          : isLong
            ? { label: "ACHAT ↗", color: "#4ade80", bg: "rgba(34,197,94,0.1)", border: "rgba(34,197,94,0.25)" }
            : { label: "VENTE ↘", color: "#f87171", bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.25)" }

        const confirmedBy: string[] = ind?.confirmed_by ?? []
        const confluenceScore = ind?.confluence_score as number | undefined
        const confluenceCount = ind?.confluence_count as number | undefined
        const totalInd = ind?.total_indicators as number | undefined
        const rr1 = ind?.risk_reward_tp1 as number | undefined
        const assetName = ind?.name as string | undefined
        const expiresAt = ind?.expires_at as string | undefined
        const isActive = expiresAt ? new Date(expiresAt).getTime() > Date.now() : false

        return (
          <div key={row.id} className="rounded-xl p-4 border-l-2"
            style={{
              background: D.card,
              border: `1px solid ${D.border}`,
              borderLeft: `2px solid ${isLong ? "rgba(34,197,94,0.5)" : "rgba(239,68,68,0.5)"}`,
            }}>
            <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded"
                  style={{ background: b.bg, border: `1px solid ${b.border}`, color: b.color }}>
                  {b.label}
                </span>
                <span className="text-white font-bold">{row.ticker}</span>
                {assetName && <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>{assetName}</span>}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                  style={isActive
                    ? { background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)", color: D.yellow }
                    : { background: "rgba(255,255,255,0.04)", border: `1px solid ${D.border}`, color: "rgba(255,255,255,0.3)" }}>
                  {isActive ? "En cours ⏳" : "Clôturé ◼"}
                </span>
                <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.25)" }}>{timeAgo(row.created_at)}</span>
              </div>
            </div>

            {confluenceScore != null && (
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>Confluence</span>
                  <span className="text-[10px] font-bold text-white">
                    {confluenceScore.toFixed(0)}%
                    {confluenceCount != null && totalInd != null && (
                      <span className="font-normal ml-1" style={{ color: "rgba(255,255,255,0.3)" }}>({confluenceCount}/{totalInd})</span>
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
                { label: "TP1", val: row.take_profit_1 },
                { label: "TP2", val: row.take_profit_2 },
                { label: "TP3", val: row.take_profit_3 ?? null },
                { label: "SL", val: row.stop_loss },
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
                <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>
                  R/R TP1 <span className="font-bold" style={{ color: isLong ? D.green : D.red }}>{rr1.toFixed(1)}x</span>
                </span>
              )}
              <button
                onClick={() => router.push(`/dashboard?symbol=${row.ticker}`)}
                className="ml-auto text-[10px] transition"
                style={{ color: "rgba(255,255,255,0.25)" }}
                onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.7)")}
                onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.25)")}>
                Voir graphe ↗
              </button>
            </div>

            {row.raisonnement && (
              <p className="text-[10px] italic mt-2" style={{ color: "rgba(255,255,255,0.25)" }}>
                🧠 "{row.raisonnement.slice(0, 120)}{row.raisonnement.length > 120 ? "…" : ""}"
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function Signaux() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [plan, setPlan] = useState("free")
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [signals, setSignals] = useState<SignalResult[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<"live" | "historique">("live")
  const [filterSignal, setFilterSignal] = useState("tous")
  const [filterType, setFilterType] = useState("tous")
  const [sortBy, setSortBy] = useState("confluence")
  const [iaOnly, setIaOnly] = useState(false)
  const [viewMode, setViewMode] = useState<"list" | "grid">("list")
  const [countdown, setCountdown] = useState(300)
  const [historique, setHistorique] = useState<HistoriqueRow[]>([])
  const [histLoading, setHistLoading] = useState(false)

  const fetchSignals = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/signals")
      if (!res.ok) return
      const data = await res.json()
      setSignals(data.signals ?? [])
      setStats(data.stats ?? null)
      setCountdown(300)
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [])

  // Auth + plan
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        router.push("/login")
        return
      }
      setUser(data.user)
      const { data: profile } = await supabase
        .from("profiles")
        .select("plan")
        .eq("email", data.user.email)
        .maybeSingle()
      setPlan(getPlan(profile?.plan ?? "free"))
    })
  }, [router])

  // Fetch signals on mount + auto-refresh
  useEffect(() => {
    if (!user) return
    fetchSignals()
    const interval = setInterval(fetchSignals, 300_000)
    return () => clearInterval(interval)
  }, [user, fetchSignals])

  // Countdown timer
  useEffect(() => {
    const t = setInterval(() => setCountdown(c => (c <= 1 ? 300 : c - 1)), 1000)
    return () => clearInterval(t)
  }, [])

  // Historique fetch
  useEffect(() => {
    if (tab !== "historique" || plan === "free" || historique.length > 0) return
    setHistLoading(true)
    supabase
      .from("signaux")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (data) setHistorique(data as HistoriqueRow[])
        setHistLoading(false)
      })
  }, [tab, plan, historique.length])

  if (!user) return null

  // ─── Filtering + sorting ───────────────────────────────────────────────────

  const filtered = signals
    .filter(s => filterSignal === "tous" || s.signal === filterSignal)
    .filter(s => filterType === "tous" || s.type === filterType)
    .filter(s => !iaOnly || !!s.ai_comment)
    .sort((a, b) => {
      if (sortBy === "confluence") return b.confluence_score - a.confluence_score
      if (sortBy === "rr") return b.risk_reward_tp1 - a.risk_reward_tp1
      return b.volume_ratio - a.volume_ratio
    })

  const top3 = [...signals].sort((a, b) => b.confluence_score - a.confluence_score).slice(0, 3)
  const isBlurring = plan === "free"

  return (
    <>
      <div className="min-h-screen" style={{ background: D.bg }}>

        {/* ── HEADER ──────────────────────────────────────────────────────── */}
        <div className="px-6 py-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-black tracking-tight text-white">Signaux</h1>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                  style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)" }}>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400" />
                  </span>
                  <span className="text-[10px] font-black tracking-wider" style={{ color: "#4ade80" }}>LIVE</span>
                </div>
              </div>
              {stats && (
                <div className="flex items-center gap-4 text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
                  <span><span className="text-white font-semibold">{stats.total}</span> signaux actifs</span>
                  <span style={{ color: "rgba(255,255,255,0.1)" }}>·</span>
                  <span><span className="font-semibold" style={{ color: D.yellow }}>{stats.fort}</span> forts</span>
                  <span style={{ color: "rgba(255,255,255,0.1)" }}>·</span>
                  <span><span className="font-semibold" style={{ color: D.green }}>{stats.achats}</span> achats</span>
                  <span style={{ color: "rgba(255,255,255,0.1)" }}>·</span>
                  <span><span className="font-semibold" style={{ color: D.red }}>{stats.ventes}</span> ventes</span>
                  <span style={{ color: "rgba(255,255,255,0.1)" }}>·</span>
                  <span>Confluence moy. <span className="text-white font-semibold">{stats.avg_confluence}%</span></span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              {/* Tabs */}
              <div className="flex rounded-lg overflow-hidden" style={{ border: `1px solid ${D.border}` }}>
                {(["live", "historique"] as const).map(t => (
                  <button key={t} onClick={() => setTab(t)}
                    className="px-4 py-2 text-[11px] font-semibold transition-all capitalize"
                    style={{
                      background: tab === t ? "rgba(255,255,255,0.1)" : "transparent",
                      color: tab === t ? "white" : "rgba(255,255,255,0.3)",
                    }}>
                    {t === "live" ? "Live" : "Historique"}
                  </button>
                ))}
              </div>
              {/* Countdown */}
              <div className="text-right">
                <p className="text-[10px] mb-1" style={{ color: "rgba(255,255,255,0.2)" }}>Prochain scan</p>
                <p className={`text-lg font-black tabular-nums ${countdown <= 60 ? "text-red-400" : "text-white"}`}>
                  {formatCountdown(countdown)}
                </p>
                <div className="w-24 h-0.5 rounded-full mt-1" style={{ background: "rgba(255,255,255,0.05)" }}>
                  <div className="h-full rounded-full transition-all duration-1000"
                    style={{
                      width: `${(countdown / 300) * 100}%`,
                      background: countdown <= 60 ? D.red : D.green,
                    }} />
                </div>
              </div>
              {/* Refresh */}
              <button onClick={fetchSignals} disabled={loading}
                className="w-9 h-9 rounded-xl flex items-center justify-center transition-all disabled:opacity-40"
                style={{ border: `1px solid ${D.border}`, color: "rgba(255,255,255,0.4)" }}
                onMouseEnter={e => (e.currentTarget.style.color = "white")}
                onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.4)")}>
                <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              </button>
            </div>
          </div>
        </div>

        {/* ── LIVE TAB ─────────────────────────────────────────────────────── */}
        {tab === "live" && (
          <>
            {/* ── FILTERS ─────────────────────────────────────────────────── */}
            <div className="px-6 py-3 flex items-center gap-2 overflow-x-auto"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              {/* Signal group */}
              <div className="flex rounded-lg overflow-hidden flex-shrink-0"
                style={{ border: `1px solid ${D.border}` }}>
                {[
                  { key: "tous", label: "Tout" },
                  { key: "ACHAT_FORT", label: "⚡ Fort achat" },
                  { key: "ACHAT", label: "↗ Achat" },
                  { key: "VENTE", label: "↘ Vente" },
                  { key: "VENTE_FORT", label: "⚡ Fort vente" },
                ].map(f => (
                  <button key={f.key} onClick={() => setFilterSignal(f.key)}
                    className="px-3 py-1.5 text-[11px] font-semibold transition-all whitespace-nowrap"
                    style={{
                      background: filterSignal === f.key ? "rgba(255,255,255,0.1)" : "transparent",
                      color: filterSignal === f.key ? "white" : "rgba(255,255,255,0.3)",
                    }}>
                    {f.label}
                  </button>
                ))}
              </div>

              <div className="w-px h-5 flex-shrink-0" style={{ background: "rgba(255,255,255,0.1)" }} />

              {/* Type */}
              <div className="flex gap-1 flex-shrink-0">
                {[
                  { key: "tous", label: "Tous" },
                  { key: "stock", label: "📈 Actions" },
                  { key: "crypto", label: "₿ Crypto" },
                  { key: "etf", label: "📦 ETF" },
                ].map(f => (
                  <button key={f.key} onClick={() => setFilterType(f.key)}
                    className="px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all whitespace-nowrap"
                    style={{
                      background: filterType === f.key ? "rgba(255,255,255,0.08)" : "transparent",
                      border: filterType === f.key ? `1px solid rgba(255,255,255,0.12)` : "1px solid transparent",
                      color: filterType === f.key ? "white" : "rgba(255,255,255,0.3)",
                    }}>
                    {f.label}
                  </button>
                ))}
              </div>

              <div className="w-px h-5 flex-shrink-0" style={{ background: "rgba(255,255,255,0.1)" }} />

              {/* Sort */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.2)" }}>Trier</span>
                {[
                  { key: "confluence", label: "Confluence" },
                  { key: "rr", label: "R/R" },
                  { key: "volume", label: "Volume" },
                ].map(s => (
                  <button key={s.key} onClick={() => setSortBy(s.key)}
                    className="px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all"
                    style={{
                      background: sortBy === s.key ? "rgba(255,255,255,0.08)" : "transparent",
                      color: sortBy === s.key ? "white" : "rgba(255,255,255,0.25)",
                    }}>
                    {s.label}
                  </button>
                ))}
              </div>

              <div className="w-px h-5 flex-shrink-0" style={{ background: "rgba(255,255,255,0.1)" }} />

              {/* View toggle */}
              <div className="flex gap-1 flex-shrink-0">
                {[
                  { key: "list", label: "☰" },
                  { key: "grid", label: "⊞" },
                ].map(v => (
                  <button key={v.key} onClick={() => setViewMode(v.key as "list" | "grid")}
                    className="w-7 h-7 rounded-md text-[12px] font-bold transition-all flex items-center justify-center"
                    style={{
                      background: viewMode === v.key ? "rgba(255,255,255,0.08)" : "transparent",
                      color: viewMode === v.key ? "white" : "rgba(255,255,255,0.3)",
                    }}>
                    {v.label}
                  </button>
                ))}
              </div>

              <div className="ml-auto flex-shrink-0">
                <button onClick={() => setIaOnly(!iaOnly)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
                  style={{
                    background: iaOnly ? "rgba(139,92,246,0.15)" : "transparent",
                    color: iaOnly ? "#a78bfa" : "rgba(255,255,255,0.25)",
                    border: iaOnly ? "1px solid rgba(139,92,246,0.25)" : "1px solid transparent",
                  }}>
                  🧠 Avec commentaire IA
                </button>
              </div>
            </div>

            {/* ── TOP 3 ───────────────────────────────────────────────────── */}
            {!loading && top3.length > 0 && (
              <div className="px-6 pt-5 pb-4">
                <p className="text-[11px] font-black uppercase tracking-widest mb-3"
                  style={{ color: "rgba(255,255,255,0.3)" }}>
                  ⭐ Meilleures opportunités
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {top3.map((s, i) => (
                    <Top3Card key={s.symbol} signal={s} rank={i + 1} />
                  ))}
                </div>
              </div>
            )}

            {/* ── SIGNAL LIST ─────────────────────────────────────────────── */}
            <div className="px-6 pb-6">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-black uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.3)" }}>
                  Tous les signaux ({filtered.length})
                </p>
              </div>

              {loading ? (
                viewMode === "grid" ? (
                  <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className="h-40 rounded-xl animate-pulse"
                        style={{ background: D.card, border: `1px solid ${D.border}` }} />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${D.border}` }}>
                    {/* Table header */}
                    <div className="hidden md:grid items-center gap-4 px-4 py-2.5"
                      style={{
                        gridTemplateColumns: "140px 1fr 90px 60px 140px 50px 70px 80px",
                        background: "rgba(255,255,255,0.02)",
                        borderBottom: `1px solid ${D.border}`,
                      }}>
                      {["Signal", "Actif", "Prix", "Var.", "Confluence", "R/R", "Expire", ""].map(h => (
                        <span key={h} className="text-[9px] uppercase tracking-widest font-bold"
                          style={{ color: "rgba(255,255,255,0.2)" }}>
                          {h}
                        </span>
                      ))}
                    </div>
                    {Array.from({ length: 6 }).map((_, i) => (
                      <SignalRowSkeleton key={i} />
                    ))}
                  </div>
                )
              ) : filtered.length === 0 ? (
                <div className="text-center py-24" style={{ color: "rgba(255,255,255,0.3)" }}>
                  <p className="text-5xl mb-4">📡</p>
                  <p className="text-xl font-semibold text-white">Aucun signal ne correspond aux filtres</p>
                  <p className="mt-2 text-sm">Essayez de modifier les filtres ou attendez la prochaine actualisation</p>
                </div>
              ) : viewMode === "grid" ? (
                <div className="relative">
                  <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {filtered.map((signal, idx) => (
                      <GridCard
                        key={signal.symbol}
                        signal={signal}
                        blurred={isBlurring && idx >= 3}
                        onUpgrade={() => setShowUpgrade(true)}
                      />
                    ))}
                  </div>
                  {isBlurring && filtered.length > 3 && (
                    <div className="relative -mt-16 h-20 flex items-end justify-center pb-4"
                      style={{ background: `linear-gradient(to bottom, transparent, ${D.bg})` }}>
                      <button onClick={() => setShowUpgrade(true)}
                        className="px-6 py-2.5 rounded-xl text-sm font-black text-black transition-all hover:scale-105"
                        style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)" }}>
                        🚀 Débloquer tous les signaux
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="relative rounded-xl overflow-hidden" style={{ border: `1px solid ${D.border}` }}>
                  {/* Table header — desktop */}
                  <div className="hidden md:grid items-center gap-4 px-4 py-2.5"
                    style={{
                      gridTemplateColumns: "140px 1fr 90px 60px 140px 50px 70px 80px",
                      background: "rgba(255,255,255,0.02)",
                      borderBottom: `1px solid ${D.border}`,
                    }}>
                    {["Signal", "Actif", "Prix", "Var.", "Confluence", "R/R", "Expire", ""].map(h => (
                      <span key={h} className="text-[9px] uppercase tracking-widest font-bold"
                        style={{ color: "rgba(255,255,255,0.2)" }}>
                        {h}
                      </span>
                    ))}
                  </div>

                  {/* Rows */}
                  {filtered.map((signal, idx) => (
                    <div key={signal.symbol}>
                      <SignalRow
                        signal={signal}
                        blurred={isBlurring && idx >= 3}
                        onUpgrade={() => setShowUpgrade(true)}
                      />
                      <SignalRowMobile
                        signal={signal}
                        blurred={isBlurring && idx >= 3}
                        onUpgrade={() => setShowUpgrade(true)}
                      />
                    </div>
                  ))}

                  {isBlurring && filtered.length > 3 && (
                    <div className="relative -mt-16 h-20 flex items-end justify-center pb-4"
                      style={{ background: `linear-gradient(to bottom, transparent, ${D.bg})` }}>
                      <button onClick={() => setShowUpgrade(true)}
                        className="px-6 py-2.5 rounded-xl text-sm font-black text-black transition-all hover:scale-105"
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

        {/* ── HISTORIQUE TAB ────────────────────────────────────────────────── */}
        {tab === "historique" && (
          <div className="px-6 py-6 space-y-4">
            <h2 className="text-xl font-black tracking-tight text-white">Historique des signaux</h2>
            {plan === "free" ? (
              <div className="text-center py-16 rounded-2xl" style={{ border: `1px solid ${D.border}` }}>
                <p className="text-4xl mb-3">🔒</p>
                <p className="text-lg font-bold text-white mb-1">Accès Premium requis</p>
                <p className="text-sm mb-4" style={{ color: "rgba(255,255,255,0.3)" }}>
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
                  <div key={i} className="h-24 rounded-xl animate-pulse"
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
