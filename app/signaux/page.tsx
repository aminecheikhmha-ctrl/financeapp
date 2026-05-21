"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import type { SignalResult } from "@/app/api/signals/route"
import UpgradeModal from "@/app/components/UpgradeModal"
import { cn } from "@/lib/utils"

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function signalBadge(signal: string): { label: string; color: string; bg: string; border: string } {
  switch (signal) {
    case "ACHAT_FORT":
      return { label: "ACHAT FORT ⚡", color: "text-green-300", bg: "bg-green-500/20", border: "border-green-500/40" }
    case "ACHAT":
      return { label: "ACHAT ↗", color: "text-green-400", bg: "bg-green-500/15", border: "border-green-500/30" }
    case "VENTE_FORT":
      return { label: "VENTE FORTE ⚡", color: "text-red-300", bg: "bg-red-500/20", border: "border-red-500/40" }
    case "VENTE":
      return { label: "VENTE ↘", color: "text-red-400", bg: "bg-red-500/15", border: "border-red-500/30" }
    default:
      return { label: signal, color: "text-gray-400", bg: "bg-white/10", border: "border-white/20" }
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
  if (h > 0) return `Expire dans ${h}h${m > 0 ? m + "m" : ""}`
  return `Expire dans ${m}m`
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

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="bg-[#0d0d0d] border border-white/8 rounded-2xl p-5 space-y-4 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="h-6 w-28 bg-white/10 rounded-lg" />
        <div className="h-6 w-20 bg-white/5 rounded-lg" />
      </div>
      <div className="h-8 w-32 bg-white/10 rounded-lg" />
      <div className="h-3 w-full bg-white/5 rounded-full" />
      <div className="flex gap-2">
        <div className="h-5 w-16 bg-white/5 rounded-full" />
        <div className="h-5 w-16 bg-white/5 rounded-full" />
        <div className="h-5 w-20 bg-white/5 rounded-full" />
      </div>
      <div className="grid grid-cols-4 gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-12 bg-white/5 rounded-xl" />
        ))}
      </div>
    </div>
  )
}

// ─── Top-3 Premium Card ────────────────────────────────────────────────────────

function Top3Card({ signal }: { signal: SignalResult }) {
  const router = useRouter()
  const b = signalBadge(signal.signal)
  const isLong = isBuySignal(signal.signal)
  const isFort = signal.signal === "ACHAT_FORT" || signal.signal === "VENTE_FORT"

  return (
    <div
      className={`relative bg-[#0d0d0d] rounded-2xl p-5 space-y-3 border overflow-hidden ${
        isFort
          ? isLong
            ? "border-green-500/40"
            : "border-red-500/40"
          : isLong
          ? "border-green-500/20"
          : "border-red-500/20"
      }`}
      style={{
        background: isFort
          ? isLong
            ? "linear-gradient(135deg, #0d1f0d 0%, #0d0d0d 60%)"
            : "linear-gradient(135deg, #1f0d0d 0%, #0d0d0d 60%)"
          : undefined,
      }}
    >
      {/* Badge + symbol + price */}
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <span
            className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-lg border ${b.bg} ${b.border} ${b.color}`}
          >
            {b.label}
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-white font-black text-xl">{signal.symbol}</span>
            <span className="text-gray-500 text-xs">{signal.name}</span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-white font-black text-lg">
            {signal.price < 1 ? signal.price.toFixed(4) : signal.price.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className={`text-xs font-bold ${signal.change_24h >= 0 ? "text-green-400" : "text-red-400"}`}>
            {signal.change_24h >= 0 ? "+" : ""}{signal.change_24h.toFixed(2)}%
          </p>
        </div>
      </div>

      {/* Confluence bar */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-gray-500 text-[10px] font-semibold uppercase tracking-wide">Confluence</span>
          <span className="text-white text-xs font-black">
            {signal.confluence_score.toFixed(0)}%
            <span className="text-gray-600 font-normal ml-1">
              ({signal.confluence_count}/{signal.total_indicators})
            </span>
          </span>
        </div>
        <div className="w-full bg-white/5 rounded-full h-2">
          <div
            className={`h-2 rounded-full ${isLong ? "bg-gradient-to-r from-green-600 to-emerald-400" : "bg-gradient-to-r from-red-600 to-rose-400"}`}
            style={{ width: `${signal.confluence_score}%` }}
          />
        </div>
        <div className="flex flex-wrap gap-1 mt-2">
          {signal.confirmed_by.slice(0, 3).map((label) => (
            <span
              key={label}
              className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full border ${
                isLong
                  ? "bg-green-500/10 text-green-400 border-green-500/20"
                  : "bg-red-500/10 text-red-400 border-red-500/20"
              }`}
            >
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* TP/SL */}
      <div className="grid grid-cols-3 gap-2 text-center bg-white/3 rounded-xl p-2">
        {[
          { label: "Entrée", val: signal.entry_price },
          { label: "TP1", val: signal.tp1 },
          { label: "SL", val: signal.sl },
        ].map(({ label, val }) => (
          <div key={label}>
            <p
              className={`text-[9px] font-bold uppercase mb-0.5 ${
                label === "SL" ? "text-red-400" : label === "TP1" ? "text-green-400" : "text-gray-500"
              }`}
            >
              {label}
            </p>
            <p className="text-white text-[11px] font-bold">
              {val < 1 ? val.toFixed(4) : val.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}
            </p>
            {label !== "Entrée" && (
              <p
                className={`text-[9px] ${label === "SL" ? "text-red-400/70" : "text-green-400/70"}`}
              >
                {pctChange(signal.entry_price, val)}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* AI comment */}
      {signal.ai_comment && (
        <div className="flex gap-2 items-start bg-white/3 rounded-xl px-3 py-2">
          <span className="text-sm flex-shrink-0">🧠</span>
          <p className="text-gray-300 text-[11px] italic leading-relaxed">"{signal.ai_comment}"</p>
        </div>
      )}

      {/* Buttons */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={() => router.push(`/dashboard?symbol=${signal.symbol}`)}
          className="flex-1 text-[11px] font-semibold py-2 rounded-xl border border-white/10 text-gray-400 hover:text-white hover:border-white/20 transition"
        >
          Voir graphe ↗
        </button>
        <button
          onClick={() => router.push(`/signaux/${signal.symbol}`)}
          className={`flex-1 text-[11px] font-bold py-2 rounded-xl transition ${
            isLong ? "bg-green-500 hover:bg-green-600 text-white" : "bg-red-500 hover:bg-red-600 text-white"
          }`}
        >
          Analyse →
        </button>
      </div>
    </div>
  )
}

// ─── Signal Card (list view) ───────────────────────────────────────────────────

function SignalCard({ signal, blurred, buzz }: { signal: SignalResult; blurred?: boolean; buzz?: { buzz_score: number; dominant_sentiment: string; mentions_24h: number } | null }) {
  const router = useRouter()
  const b = signalBadge(signal.signal)
  const isLong = isBuySignal(signal.signal)

  return (
    <div
      className={`relative bg-[#0d0d0d] rounded-2xl p-5 space-y-4 overflow-hidden border-l-4 border border-white/5 ${
        isLong ? "border-l-green-500" : "border-l-red-500"
      }`}
    >
      {blurred && (
        <div className="absolute inset-0 z-10 backdrop-blur-sm bg-black/50 flex items-center justify-center rounded-2xl">
          <div className="text-center">
            <p className="text-3xl mb-2">🔒</p>
            <p className="text-white font-bold text-sm">Premium requis</p>
            <a href="/pricing" className="text-xs text-green-400 underline mt-1 block">
              Passer Premium
            </a>
          </div>
        </div>
      )}

      {/* Row 1 */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <span
            className={`text-[11px] font-black uppercase px-2.5 py-1 rounded-lg border ${b.bg} ${b.border} ${b.color} tracking-wide`}
          >
            {b.label}
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-white font-black text-xl">{signal.symbol}</span>
            <span className="text-gray-500 text-sm">· {signal.name}</span>
          </div>
          <span className="text-xs text-gray-600 bg-white/5 px-2 py-0.5 rounded-full">scalp</span>
          {buzz && buzz.buzz_score > 0 && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
              buzz.dominant_sentiment === "bullish" ? "bg-orange-500/10 text-orange-400 border-orange-500/20" :
              buzz.dominant_sentiment === "bearish" ? "bg-red-500/10 text-red-400 border-red-500/20" :
              "bg-gray-500/10 text-gray-400 border-gray-500/20"
            }`}>
              🔥 {buzz.mentions_24h} Reddit
            </span>
          )}
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-white font-black text-lg">
            {signal.price < 1
              ? signal.price.toFixed(4)
              : signal.price.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className={`text-xs font-semibold ${signal.change_24h >= 0 ? "text-green-400" : "text-red-400"}`}>
            {signal.change_24h >= 0 ? "+" : ""}{signal.change_24h.toFixed(2)}%
          </p>
        </div>
      </div>

      {/* Confluence bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-gray-400 text-xs font-semibold">Confluence</span>
          <span className="text-xs font-black text-white">
            {signal.confluence_score.toFixed(0)}%
            <span className="text-gray-500 font-normal ml-1">
              ({signal.confluence_count}/{signal.total_indicators})
            </span>
          </span>
        </div>
        <div className="w-full bg-white/5 rounded-full h-1.5">
          <div
            className={`h-1.5 rounded-full transition-all ${
              isLong
                ? "bg-gradient-to-r from-green-600 to-emerald-400"
                : "bg-gradient-to-r from-red-600 to-rose-400"
            }`}
            style={{ width: `${signal.confluence_score}%` }}
          />
        </div>
        {signal.confirmed_by.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            <span className="text-[10px] text-gray-500 font-semibold self-center">Confirmé par</span>
            {signal.confirmed_by.slice(0, 9).map((label) => (
              <span
                key={label}
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                  isLong
                    ? "bg-green-500/10 text-green-400 border-green-500/20"
                    : "bg-red-500/10 text-red-400 border-red-500/20"
                }`}
              >
                {label}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Price levels */}
      <div className="bg-white/3 rounded-xl p-3 space-y-2">
        <div className="grid grid-cols-5 gap-1 text-center">
          {[
            { label: "Entrée", val: signal.entry_price, pct: null },
            { label: "TP1", val: signal.tp1, pct: pctChange(signal.entry_price, signal.tp1) },
            { label: "TP2", val: signal.tp2, pct: pctChange(signal.entry_price, signal.tp2) },
            { label: "TP3", val: signal.tp3, pct: pctChange(signal.entry_price, signal.tp3) },
            { label: "SL", val: signal.sl, pct: pctChange(signal.entry_price, signal.sl) },
          ].map(({ label, val, pct }) => (
            <div key={label} className="space-y-0.5">
              <p
                className={`text-[9px] font-bold uppercase ${
                  label === "SL" ? "text-red-400" : label === "Entrée" ? "text-gray-500" : "text-green-400"
                }`}
              >
                {label}
              </p>
              <p className="text-white text-[11px] font-bold">
                {val < 1
                  ? val.toFixed(3)
                  : val.toLocaleString("fr-FR", { maximumFractionDigits: 0 })}
              </p>
              {pct && (
                <p
                  className={`text-[9px] font-semibold ${
                    label === "SL" ? "text-red-400/80" : "text-green-400/80"
                  }`}
                >
                  {pct}
                </p>
              )}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4 pt-1 border-t border-white/5">
          <span className="text-gray-500 text-[10px] font-semibold uppercase tracking-wide">R/R</span>
          <span className="text-xs text-white font-semibold">
            TP1 <span className="text-green-400">{signal.risk_reward_tp1.toFixed(1)}x</span>
          </span>
          <span className="text-xs text-white font-semibold">
            TP2 <span className="text-green-400">{signal.risk_reward_tp2.toFixed(1)}x</span>
          </span>
          <span className="text-[10px] text-gray-500 ml-auto">
            {timeUntilExpiry(signal.expires_at)}
          </span>
        </div>
      </div>

      {/* AI comment */}
      {signal.ai_comment && (
        <div className="flex gap-2 items-start bg-white/3 rounded-xl px-3 py-2.5">
          <span className="text-base flex-shrink-0">🧠</span>
          <p className="text-gray-300 text-xs italic leading-relaxed">"{signal.ai_comment}"</p>
        </div>
      )}

      {/* Buttons */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={() => router.push(`/dashboard?symbol=${signal.symbol}`)}
          className="flex-1 text-xs font-semibold py-2.5 rounded-xl border border-white/10 text-gray-300 hover:text-white hover:border-white/20 transition"
        >
          Voir graphe ↗
        </button>
        <button
          onClick={() => router.push(`/signaux/${signal.symbol}`)}
          className={`flex-1 text-xs font-bold py-2.5 rounded-xl transition ${
            isLong
              ? "bg-green-500 hover:bg-green-600 text-white"
              : "bg-red-500 hover:bg-red-600 text-white"
          }`}
        >
          Analyse complète →
        </button>
      </div>
    </div>
  )
}

// ─── Signal Grid Card (compact) ────────────────────────────────────────────────

function GridCard({ signal, blurred }: { signal: SignalResult; blurred?: boolean }) {
  const router = useRouter()
  const b = signalBadge(signal.signal)
  const isLong = isBuySignal(signal.signal)

  return (
    <div
      className={`relative bg-[#0d0d0d] rounded-2xl p-4 space-y-3 overflow-hidden border-l-4 border border-white/5 ${
        isLong ? "border-l-green-500" : "border-l-red-500"
      }`}
    >
      {blurred && (
        <div className="absolute inset-0 z-10 backdrop-blur-sm bg-black/50 flex items-center justify-center rounded-2xl">
          <div className="text-center">
            <p className="text-2xl mb-1">🔒</p>
            <a href="/pricing" className="text-xs text-green-400 underline">
              Premium
            </a>
          </div>
        </div>
      )}

      <div className="flex items-start justify-between">
        <div>
          <span
            className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border ${b.bg} ${b.border} ${b.color}`}
          >
            {b.label}
          </span>
          <p className="text-white font-black text-base mt-1">{signal.symbol}</p>
          <p className="text-gray-500 text-[10px]">{signal.name}</p>
        </div>
        <div className="text-right">
          <p className="text-white font-bold text-sm">
            {signal.price < 1 ? signal.price.toFixed(4) : signal.price.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}
          </p>
          <p className={`text-[10px] font-semibold ${signal.change_24h >= 0 ? "text-green-400" : "text-red-400"}`}>
            {signal.change_24h >= 0 ? "+" : ""}{signal.change_24h.toFixed(2)}%
          </p>
        </div>
      </div>

      {/* Confluence bar */}
      <div>
        <div className="flex justify-between mb-1">
          <span className="text-gray-500 text-[9px] font-semibold">Confluence</span>
          <span className="text-white text-[10px] font-black">{signal.confluence_score.toFixed(0)}%</span>
        </div>
        <div className="w-full bg-white/5 rounded-full h-1">
          <div
            className={`h-1 rounded-full ${isLong ? "bg-green-500" : "bg-red-500"}`}
            style={{ width: `${signal.confluence_score}%` }}
          />
        </div>
      </div>

      {/* Top 3 pills */}
      <div className="flex flex-wrap gap-1">
        {signal.confirmed_by.slice(0, 3).map((label) => (
          <span
            key={label}
            className={`text-[9px] px-1.5 py-0.5 rounded-full border ${
              isLong
                ? "bg-green-500/10 text-green-400 border-green-500/20"
                : "bg-red-500/10 text-red-400 border-red-500/20"
            }`}
          >
            {label}
          </span>
        ))}
      </div>

      {/* TP1/SL */}
      <div className="flex items-center gap-3 text-[10px]">
        <span className="text-gray-500">Entrée <span className="text-white font-semibold">{signal.entry_price < 1 ? signal.entry_price.toFixed(3) : signal.entry_price.toLocaleString("fr-FR", { maximumFractionDigits: 0 })}</span></span>
        <span className="text-green-400">TP1 {pctChange(signal.entry_price, signal.tp1)}</span>
        <span className="text-red-400">SL {pctChange(signal.entry_price, signal.sl)}</span>
      </div>

      {/* AI comment */}
      {signal.ai_comment && (
        <p className="text-gray-500 text-[10px] italic truncate">🧠 "{signal.ai_comment}"</p>
      )}

      <button
        onClick={() => router.push(`/signaux/${signal.symbol}`)}
        className={`w-full text-[10px] font-bold py-1.5 rounded-lg transition ${
          isLong ? "bg-green-500/20 text-green-400 hover:bg-green-500/30" : "bg-red-500/20 text-red-400 hover:bg-red-500/30"
        }`}
      >
        Analyse →
      </button>
    </div>
  )
}

// ─── Historique tab ────────────────────────────────────────────────────────────

function statusFromIndicateurs(row: HistoriqueRow): { label: string; color: string; bg: string } {
  const ind = row.indicateurs as any
  const signal = ind?.signal as string | undefined
  const isLong = row.direction === "LONG"
  const now = Date.now()
  const expires = ind?.expires_at ? new Date(ind.expires_at).getTime() : 0
  if (now < expires) return { label: "En cours ⏳", color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20" }
  // Expired — show neutral closed state
  if (isLong) return { label: "Clôturé ◼", color: "text-gray-400", bg: "bg-white/5 border-white/10" }
  return { label: "Clôturé ◼", color: "text-gray-400", bg: "bg-white/5 border-white/10" }
}

function HistoriqueView({ rows }: { rows: HistoriqueRow[] }) {
  const router = useRouter()
  return (
    <div className="space-y-3">
      {rows.length === 0 && (
        <div className="text-center text-gray-500 py-16">
          <p className="text-4xl mb-3">📋</p>
          <p className="text-lg font-semibold">Aucun historique disponible</p>
          <p className="text-sm mt-1">Les signaux apparaîtront ici après le premier scan</p>
        </div>
      )}
      {rows.map((row) => {
        const isLong = row.direction === "LONG"
        const ind = row.indicateurs as any
        const sigLabel = ind?.signal as string | undefined
        const b = sigLabel
          ? signalBadge(sigLabel)
          : isLong
            ? { label: "ACHAT ↗", color: "text-green-400", bg: "bg-green-500/15", border: "border-green-500/30" }
            : { label: "VENTE ↘", color: "text-red-400", bg: "bg-red-500/15", border: "border-red-500/30" }

        const status = statusFromIndicateurs(row)
        const confirmedBy: string[] = ind?.confirmed_by ?? []
        const rr1 = ind?.risk_reward_tp1 as number | undefined
        const rr2 = ind?.risk_reward_tp2 as number | undefined
        const assetName = ind?.name as string | undefined
        const confluenceScore = ind?.confluence_score as number | undefined
        const confluenceCount = ind?.confluence_count as number | undefined
        const totalInd = ind?.total_indicators as number | undefined

        return (
          <div
            key={row.id}
            className={`bg-[#0d0d0d] rounded-xl p-4 border border-white/5 border-l-4 ${isLong ? "border-l-green-500/60" : "border-l-red-500/60"}`}
          >
            {/* Header row */}
            <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${b.bg} ${b.border} ${b.color}`}>
                  {b.label}
                </span>
                <span className="text-white font-bold">{row.ticker}</span>
                {assetName && <span className="text-gray-500 text-xs">{assetName}</span>}
                <span className="text-gray-600 text-[10px] bg-white/5 px-2 py-0.5 rounded-full capitalize">{row.timeframe}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${status.bg} ${status.color}`}>
                  {status.label}
                </span>
                <span className="text-gray-600 text-xs">{timeAgo(row.created_at)}</span>
              </div>
            </div>

            {/* Confluence bar */}
            {confluenceScore != null && (
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-gray-600 text-[10px]">Confluence</span>
                  <span className="text-white text-[10px] font-bold">
                    {confluenceScore.toFixed(0)}%
                    {confluenceCount != null && totalInd != null && (
                      <span className="text-gray-600 font-normal ml-1">({confluenceCount}/{totalInd})</span>
                    )}
                  </span>
                </div>
                <div className="w-full bg-white/5 rounded-full h-1">
                  <div
                    className={`h-1 rounded-full ${isLong ? "bg-green-500/60" : "bg-red-500/60"}`}
                    style={{ width: `${confluenceScore}%` }}
                  />
                </div>
                {confirmedBy.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {confirmedBy.slice(0, 6).map(l => (
                      <span key={l} className={`text-[9px] px-1.5 py-0.5 rounded-full border ${isLong ? "bg-green-500/8 text-green-500/70 border-green-500/15" : "bg-red-500/8 text-red-500/70 border-red-500/15"}`}>{l}</span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Prices */}
            <div className="grid grid-cols-5 gap-1.5 text-center">
              {[
                { label: "Entrée", val: row.prix_entree },
                { label: "TP1",    val: row.take_profit_1 },
                { label: "TP2",    val: row.take_profit_2 },
                { label: "TP3",    val: row.take_profit_3 ?? null },
                { label: "SL",     val: row.stop_loss },
              ].map(({ label, val }) => val != null && (
                <div key={label}>
                  <p className={`text-[9px] font-bold uppercase mb-0.5 ${label === "SL" ? "text-red-400" : label === "Entrée" ? "text-gray-500" : "text-green-400"}`}>{label}</p>
                  <p className="text-white text-[10px] font-semibold">
                    {val < 1 ? val.toFixed(4) : val.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}
                  </p>
                  {label !== "Entrée" && (
                    <p className={`text-[9px] ${label === "SL" ? "text-red-400/60" : "text-green-400/60"}`}>
                      {pctChange(row.prix_entree, val)}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* R/R + button */}
            {(rr1 != null || rr2 != null) && (
              <div className="flex items-center gap-4 mt-2 pt-2 border-t border-white/5">
                <span className="text-gray-600 text-[10px] uppercase tracking-wide">R/R</span>
                {rr1 != null && <span className="text-[10px] text-white">TP1 <span className={isLong ? "text-green-400" : "text-red-400"}>{rr1.toFixed(1)}x</span></span>}
                {rr2 != null && <span className="text-[10px] text-white">TP2 <span className={isLong ? "text-green-400" : "text-red-400"}>{rr2.toFixed(1)}x</span></span>}
                <button
                  onClick={() => router.push(`/dashboard?symbol=${row.ticker}`)}
                  className="ml-auto text-[10px] text-gray-500 hover:text-white transition px-2 py-0.5 rounded border border-white/8 hover:border-white/20"
                >
                  Voir graphe ↗
                </button>
              </div>
            )}

            {/* AI comment */}
            {row.raisonnement && (
              <p className="text-gray-600 text-[10px] italic mt-2">🧠 "{row.raisonnement.slice(0, 120)}{row.raisonnement.length > 120 ? "…" : ""}"</p>
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
  const [filterStrength, setFilterStrength] = useState("tous")
  const [filterType, setFilterType] = useState("tous")
  const [sortBy, setSortBy] = useState("confluence")
  const [iaOnly, setIaOnly] = useState(false)
  const [viewMode, setViewMode] = useState<"list" | "grid">("list")
  const [countdown, setCountdown] = useState(300)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [historique, setHistorique] = useState<HistoriqueRow[]>([])
  const [histLoading, setHistLoading] = useState(false)
  const [filter, setFilter] = useState("all")
  const [signalSentiment, setSignalSentiment] = useState<Record<string, { buzz_score: number; dominant_sentiment: string; mentions_24h: number }>>({})

  // Fetch Reddit buzz for visible signals (top 6)
  useEffect(() => {
    if (signals.length === 0) return
    const top = signals.slice(0, 6).map(s => s.symbol)
    Promise.allSettled(
      top.map(sym =>
        fetch(`/api/news/reddit-buzz?symbol=${sym}`)
          .then(r => r.ok ? r.json() : null)
          .then(d => d ? { sym, d } : null)
      )
    ).then(results => {
      const map: Record<string, any> = {}
      for (const r of results) {
        if (r.status === "fulfilled" && r.value) {
          map[r.value.sym] = r.value.d
        }
      }
      setSignalSentiment(map)
    }).catch(() => {})
  }, [signals])

  const fetchSignals = useCallback(async () => {
    try {
      const res = await fetch("/api/signals")
      if (!res.ok) return
      const data = await res.json()
      setSignals(data.signals ?? [])
      setStats(data.stats ?? null)
      setLastUpdate(new Date())
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
        .single()
      const userPlan = profile?.plan ?? "free"
      setPlan(userPlan)
    })
  }, [router])

  // Fetch signals on mount + auto-refresh (free users see first 3)
  useEffect(() => {
    if (!user) return
    fetchSignals()
    const interval = setInterval(fetchSignals, 300_000)
    return () => clearInterval(interval)
  }, [user, plan, fetchSignals])

  // Countdown timer
  useEffect(() => {
    const t = setInterval(() => setCountdown((c) => (c <= 1 ? 300 : c - 1)), 1000)
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

  // ─── Free plan gate ────────────────────────────────────────────────────────

  if (!user) return null


  // ─── Filtering + sorting ─────────────────────────────────────────────────

  const signalFilterMap: Record<string, string> = {
    "achat fort": "ACHAT_FORT",
    achat: "ACHAT",
    vente: "VENTE",
    "vente forte": "VENTE_FORT",
  }

  const typeFilterMap: Record<string, string> = {
    actions: "stock",
    crypto: "crypto",
    etf: "etf",
    "matières premières": "commodity",
  }

  const filtered = signals
    .filter((s) => {
      if (filterSignal === "tous") return true
      return s.signal === (signalFilterMap[filterSignal] ?? filterSignal.toUpperCase())
    })
    .filter((s) => filterStrength === "tous" || s.strength === filterStrength)
    .filter((s) => {
      if (filterType === "tous") return true
      return s.type === (typeFilterMap[filterType] ?? filterType)
    })
    .filter((s) => !iaOnly || !!s.ai_comment)
    .sort((a, b) => {
      if (sortBy === "confluence") return b.confluence_score - a.confluence_score
      if (sortBy === "rsi_buy") return a.rsi - b.rsi
      if (sortBy === "rr") return b.risk_reward_tp2 - a.risk_reward_tp2
      return b.volume_ratio - a.volume_ratio
    })

  const top3 = [...signals].sort((a, b) => b.confluence_score - a.confluence_score).slice(0, 3)

  // Free plan shows first 3 clear, rest blurred
  const isBlurring = plan === "free"

  return (
    <>
    <div className="min-h-screen p-4 md:p-6 overflow-x-hidden page-enter" style={{ background: "var(--bg-canvas)" }}>
      <div className="max-w-6xl mx-auto space-y-5">

        {/* ── Tabs ─────────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-1 bg-white/5 rounded-xl p-1 w-fit">
          {(["live", "historique"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition capitalize ${
                tab === t ? "bg-white text-black" : "text-gray-400 hover:text-white"
              }`}
            >
              {t === "live" ? (
                <span className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400" />
                  </span>
                  Live
                </span>
              ) : (
                "Historique"
              )}
            </button>
          ))}
        </div>

        {/* ── LIVE TAB ─────────────────────────────────────────────────────── */}
        {tab === "live" && (
          <>
            {/* Header */}
            <div className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <h1 className="text-xl md:text-2xl font-black tracking-tight">Signaux de Trading</h1>
                  <span className="flex items-center gap-1.5 bg-green-500/15 border border-green-500/30 px-2.5 py-1 rounded-full">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400" />
                    </span>
                    <span className="text-green-400 text-[10px] font-black tracking-wider">LIVE</span>
                  </span>
                </div>
                {plan !== "free" && (
                  <div className={`text-xs px-3 py-1.5 rounded-full font-bold uppercase tracking-wide ${
                    plan === "premium"
                      ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
                      : "bg-green-500/20 text-green-400 border border-green-500/30"
                  }`}>
                    {plan === "pro" ? "⭐ Pro" : "💎 Premium"}
                  </div>
                )}
                {plan === "free" && (
                  <a href="/pricing" className="text-xs px-3 py-1.5 rounded-full font-bold uppercase tracking-wide bg-white/5 text-white/40 border border-white/10 hover:border-green-500/30 hover:text-green-400 transition">
                    🔒 3 signaux gratuits · Passer Pro
                  </a>
                )}
              </div>

              {/* Stats row */}
              {stats && (
                <div className="flex items-center gap-4 flex-wrap text-xs text-gray-400">
                  <span><span className="text-white font-semibold">{stats.total}</span> actifs</span>
                  <span className="text-white/20">|</span>
                  <span><span className="text-yellow-400 font-semibold">{stats.fort}</span> forts</span>
                  <span className="text-white/20">|</span>
                  <span><span className="text-green-400 font-semibold">{stats.achats}</span> achats</span>
                  <span className="text-white/20">|</span>
                  <span><span className="text-red-400 font-semibold">{stats.ventes}</span> ventes</span>
                  <span className="text-white/20">|</span>
                  <span>Confluence moy: <span className="text-white font-semibold">{stats.avg_confluence}%</span></span>
                </div>
              )}

              {/* Countdown + last update */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] text-gray-500">
                  <span>Actualisation dans <span className="text-white font-semibold">{formatCountdown(countdown)}</span></span>
                  {lastUpdate && (
                    <span>Mis à jour {timeAgo(lastUpdate.toISOString())}</span>
                  )}
                </div>
                <div className="w-full bg-white/5 rounded-full h-0.5">
                  <div
                    className="h-0.5 rounded-full bg-green-500 transition-all duration-1000"
                    style={{ width: `${(countdown / 300) * 100}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Top 3 */}
            {!loading && top3.length > 0 && (
              <div>
                <p className="text-[11px] font-black text-gray-500 uppercase tracking-widest mb-3">
                  ⭐ Top 3 du moment
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {top3.map((s, i) => (
                    <div key={s.symbol} className="relative">
                      {i === 0 && (
                        <div className="absolute -top-2 -right-2 z-10 bg-yellow-500 text-black text-[9px] font-black px-2 py-0.5 rounded-full">
                          #1
                        </div>
                      )}
                      <Top3Card signal={s} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Filter bar */}
            <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-4 space-y-3">

              {/* Row 1 — Signal type */}
              <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide pb-0.5">
                <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest min-w-[44px] flex-shrink-0">Signal</span>
                <div className="flex gap-1.5 flex-nowrap">
                  {[
                    { key: "tous",        label: "Tout",          active: "bg-white/15 text-white border-white/20" },
                    { key: "achat fort",  label: "⚡ Achat Fort", active: "bg-green-500/25 text-green-300 border-green-500/40" },
                    { key: "achat",       label: "↗ Achat",       active: "bg-green-500/15 text-green-400 border-green-500/25" },
                    { key: "vente",       label: "↘ Vente",       active: "bg-red-500/15 text-red-400 border-red-500/25" },
                    { key: "vente forte", label: "⚡ Vente Forte", active: "bg-red-500/25 text-red-300 border-red-500/40" },
                  ].map(({ key, label, active }) => (
                    <button
                      key={key}
                      onClick={() => setFilterSignal(key)}
                      className={`flex-shrink-0 whitespace-nowrap px-3 py-1.5 rounded-lg text-[11px] font-semibold transition border ${
                        filterSignal === key ? active : "border-white/8 text-gray-500 hover:text-white hover:border-white/15"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Row 2 — Force + Type */}
              <div className="flex items-center gap-3 flex-wrap overflow-x-auto scrollbar-hide pb-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest min-w-[44px]">Force</span>
                  <div className="flex bg-white/5 rounded-lg p-0.5">
                    {[
                      { key: "tous",     label: "Tout"   },
                      { key: "strong",   label: "Fort"   },
                      { key: "moderate", label: "Modéré" },
                      { key: "weak",     label: "Faible" },
                    ].map(({ key, label }) => (
                      <button
                        key={key}
                        onClick={() => setFilterStrength(key)}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition ${
                          filterStrength === key ? "bg-white text-black" : "text-gray-500 hover:text-white"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest min-w-[44px]">Type</span>
                  <div className="flex bg-white/5 rounded-lg p-0.5">
                    {[
                      { key: "tous",               label: "Tout"      },
                      { key: "actions",             label: "Actions"   },
                      { key: "crypto",              label: "Crypto"    },
                      { key: "etf",                 label: "ETF"       },
                      { key: "matières premières",  label: "Matières"  },
                    ].map(({ key, label }) => (
                      <button
                        key={key}
                        onClick={() => setFilterType(key)}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition ${
                          filterType === key ? "bg-white text-black" : "text-gray-500 hover:text-white"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Row 3 — Tri + IA toggle + Vue */}
              <div className="flex items-center gap-3 flex-wrap overflow-x-auto scrollbar-hide pb-0.5 pt-2 border-t border-white/5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">Tri</span>
                  <div className="flex bg-white/5 rounded-lg p-0.5">
                    {[
                      { key: "confluence", label: "Confluence" },
                      { key: "rsi_buy",    label: "RSI"        },
                      { key: "rr",         label: "R/R"        },
                      { key: "volume",     label: "Volume"     },
                    ].map(({ key, label }) => (
                      <button
                        key={key}
                        onClick={() => setSortBy(key)}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition ${
                          sortBy === key ? "bg-white text-black" : "text-gray-500 hover:text-white"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => setIaOnly(!iaOnly)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition border ${
                    iaOnly
                      ? "bg-purple-500/20 text-purple-300 border-purple-500/30"
                      : "border-white/8 text-gray-500 hover:text-white hover:border-white/15"
                  }`}
                >
                  🧠 IA uniquement
                </button>

                <div className="ml-auto flex bg-white/5 rounded-lg p-0.5">
                  {[
                    { key: "list", label: "☰ Liste" },
                    { key: "grid", label: "⊞ Grille" },
                  ].map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => setViewMode(key as "list" | "grid")}
                      className={`px-3 py-1 rounded-md text-[11px] font-semibold transition ${
                        viewMode === key ? "bg-white text-black" : "text-gray-500 hover:text-white"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Signal list */}
            {loading ? (
              <div className={viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-3 gap-4" : "grid grid-cols-1 lg:grid-cols-2 gap-5"}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center text-gray-500 py-24">
                <p className="text-5xl mb-4">📡</p>
                <p className="text-xl font-semibold">Aucun signal ne correspond aux filtres</p>
                <p className="mt-2 text-sm">Essayez de modifier les filtres ou attendez la prochaine actualisation</p>
              </div>
            ) : viewMode === "list" ? (
              <div className="relative">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {filtered.map((signal, idx) => (
                    <SignalCard
                      key={signal.symbol}
                      signal={signal}
                      blurred={isBlurring && idx >= 3}
                      buzz={signalSentiment[signal.symbol] ?? null}
                    />
                  ))}
                </div>
                {isBlurring && filtered.length > 3 && (
                  <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-black to-transparent flex items-end justify-center pb-6">
                    <button
                      onClick={() => setShowUpgrade(true)}
                      className="px-6 py-3 rounded-xl bg-green-500 hover:bg-green-400 text-black font-black text-sm transition shadow-lg shadow-green-500/25"
                    >
                      🚀 Débloquer les signaux illimités
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="relative">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {filtered.map((signal, idx) => (
                    <GridCard
                      key={signal.symbol}
                      signal={signal}
                      blurred={isBlurring && idx >= 3}
                    />
                  ))}
                </div>
                {isBlurring && filtered.length > 3 && (
                  <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-black to-transparent flex items-end justify-center pb-6">
                    <button
                      onClick={() => setShowUpgrade(true)}
                      className="px-6 py-3 rounded-xl bg-green-500 hover:bg-green-400 text-black font-black text-sm transition shadow-lg shadow-green-500/25"
                    >
                      🚀 Débloquer les signaux illimités
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ── HISTORIQUE TAB ────────────────────────────────────────────────── */}
        {tab === "historique" && (
          <div className="space-y-4">
            <h2 className="text-xl font-black tracking-tight">Historique des signaux</h2>
            {histLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-24 bg-[#0d0d0d] rounded-xl animate-pulse" />
                ))}
              </div>
            ) : (
              <HistoriqueView rows={historique} />
            )}
          </div>
        )}

      </div>
    </div>
    <UpgradeModal open={showUpgrade} onClose={() => setShowUpgrade(false)} context="signals" />
    </>
  )
}
