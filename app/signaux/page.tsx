"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import type { SignalResult } from "@/app/api/signals/route"
import UpgradeModal from "@/app/components/UpgradeModal"
import Tour, { SIGNAUX_TOUR_STEPS } from "@/app/components/Tour"
import { getPlan } from "@/lib/plans"
import { formatPrice, formatChange } from "@/lib/format"
import { useLanguage } from "@/lib/i18n/context"

// ─── Types ────────────────────────────────────────────────────────────────────

type Stats = {
  total: number; fort: number; achats: number; ventes: number; avg_confluence: number
}

type HistoriqueRow = {
  id: string; ticker: string; direction: string; prix_entree: number
  take_profit_1: number; take_profit_2: number; take_profit_3?: number
  stop_loss: number; timeframe: string; score_confiance: number; statut: string
  raisonnement?: string; indicateurs?: Record<string, any>; created_at: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isNYSEOpenNow(): boolean {
  const et  = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }))
  const day = et.getDay(), mins = et.getHours() * 60 + et.getMinutes()
  return day >= 1 && day <= 5 && mins >= 570 && mins < 960
}

function formatCountdown(secs: number): string {
  const m = Math.floor(secs / 60), s = secs % 60
  return `${m}:${s.toString().padStart(2, "0")}`
}

function timeUntilExpiry(expires_at: string): string {
  const diff = new Date(expires_at).getTime() - Date.now()
  if (diff <= 0) return "Expiré"
  const h = Math.floor(diff / 3_600_000), m = Math.floor((diff % 3_600_000) / 60_000)
  if (h > 0) return `${h}h${m > 0 ? m + "m" : ""}`
  return `${m}m`
}

function localTimeAgo(date: string): string {
  const mins = Math.floor((Date.now() - new Date(date).getTime()) / 60000)
  if (mins < 2) return "à l'instant"
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}j`
}

function pctChange(from: number, to: number): string {
  if (!from) return "—"
  const v = ((to - from) / Math.abs(from)) * 100
  return (v >= 0 ? "+" : "") + v.toFixed(1) + "%"
}

function humanReason(indicator: string, ind?: Record<string, string>): string {
  if (!ind) return indicator
  const map: Record<string, string> = {
    "RSI": ind.overboughtOversold, "Stoch": ind.likelyReversal, "MACD": ind.momentumChange,
    "BB": ind.bollingerLimits, "Volume": ind.abnormalVolume, "Williams": ind.reversalZone,
    "EMA": ind.trendCrossover, "OBV": ind.volumePressure, "Ichimoku": ind.ichimokuSignal, "CCI": ind.cciOscillator,
  }
  const key = Object.keys(map).find(k => indicator.includes(k))
  return key ? map[key] : indicator
}

function isBull(signal: string) { return signal === "ACHAT" || signal === "ACHAT_FORT" }

function sigLabel(signal: string) {
  if (signal === "ACHAT_FORT") return "⚡ Strong Buy"
  if (signal === "ACHAT")      return "↗ Buy"
  if (signal === "VENTE_FORT") return "⚡ Strong Sell"
  return "↘ Sell"
}
function sigLabelShort(signal: string) {
  if (signal === "ACHAT_FORT") return "⚡ Strong"
  if (signal === "ACHAT")      return "↗ Buy"
  if (signal === "VENTE_FORT") return "⚡ Strong"
  return "↘ Sell"
}

// ─── Signal color helper ──────────────────────────────────────────────────────
function sigColor(signal: string) {
  if (signal === "ACHAT_FORT") return "#4ade80"
  if (signal === "ACHAT")      return "#86efac"
  if (signal === "VENTE_FORT") return "#f87171"
  return "#fca5a5"
}

// ─── HeroSignalCard ───────────────────────────────────────────────────────────
function HeroSignalCard({ signal, onUpgrade, blurred }: {
  signal: SignalResult; onUpgrade: () => void; blurred?: boolean
}) {
  const router  = useRouter()
  const { t }   = useLanguage()
  const bullish = isBull(signal.signal)
  const color   = bullish ? "#22c55e" : "#ef4444"
  const pctTp   = signal.entry_price ? ((signal.tp1 - signal.entry_price) / signal.entry_price) * 100 : 0
  const pctSl   = signal.entry_price ? ((signal.sl  - signal.entry_price) / signal.entry_price) * 100 : 0
  const rr      = Math.abs(signal.sl - signal.entry_price) > 0
    ? Math.abs(signal.tp1 - signal.entry_price) / Math.abs(signal.sl - signal.entry_price)
    : signal.risk_reward_tp1
  const reasons = signal.confirmed_by.slice(0, 4).map(i => humanReason(i, t.signals.indicators as Record<string, string>))

  return (
    <div className="relative rounded-2xl overflow-hidden"
      style={{
        background: bullish
          ? "linear-gradient(135deg, rgba(34,197,94,0.07), rgba(34,197,94,0.02))"
          : "linear-gradient(135deg, rgba(239,68,68,0.07), rgba(239,68,68,0.02))",
        border: `1px solid ${bullish ? "rgba(34,197,94,0.20)" : "rgba(239,68,68,0.20)"}`,
      }}>

      {/* Top accent line */}
      <div className="h-[2px] w-full" style={{ background: `linear-gradient(90deg, ${color}, transparent)` }} />

      {blurred && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-2xl"
          style={{ backdropFilter: "blur(8px)", background: "rgba(4,7,6,0.82)" }}>
          <p className="text-3xl">🔒</p>
          <p className="text-white font-black text-[14px]">Signal Premium</p>
          <button onClick={onUpgrade}
            className="px-5 py-2.5 rounded-xl text-[13px] font-black text-black"
            style={{ background: "linear-gradient(135deg,#22c55e,#16a34a)" }}>
            Débloquer →
          </button>
        </div>
      )}

      <div className="p-5">
        <div className="flex flex-col lg:flex-row lg:items-start gap-5">

          {/* ── LEFT ── */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-3">
              <span className="text-[11px] font-black px-2.5 py-1 rounded-full"
                style={{ background: `${color}18`, color, border: `1px solid ${color}35` }}>
                {sigLabel(signal.signal)}
              </span>
              <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                {signal.type === "crypto" ? "₿ Crypto" : signal.type === "stock" ? "📈 Action" : "📦 ETF"}
              </span>
              {signal.candle_pattern && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg"
                  style={{ background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.22)", color: "#a78bfa" }}>
                  {signal.candle_pattern}
                </span>
              )}
            </div>

            <div className="flex items-baseline gap-3 mb-1 flex-wrap">
              <h2 className="text-[24px] font-black text-white leading-none">{signal.symbol.replace("-USD","")}</h2>
              <div>
                <p className="text-[18px] font-black text-white tabular-nums">{formatPrice(signal.price)}</p>
                <p className={`text-[12px] font-bold ${signal.change_24h >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {formatChange(signal.change_24h)} today
                </p>
              </div>
            </div>
            <p className="text-[12px] mb-4" style={{ color: "var(--text-tertiary)" }}>{signal.name}</p>

            {/* AI comment */}
            {signal.ai_comment ? (
              <div className="mb-4 p-3.5 rounded-xl"
                style={{ background: "rgba(139,92,246,0.07)", border: "1px solid rgba(139,92,246,0.15)" }}>
                <p className="text-[10px] font-black uppercase tracking-widest mb-1.5" style={{ color: "rgba(167,139,250,0.6)" }}>
                  🤖 Pourquoi ce signal ?
                </p>
                <p className="text-[12px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>{signal.ai_comment}</p>
              </div>
            ) : reasons.length > 0 ? (
              <div className="mb-4">
                <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>
                  Confirmé par
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {reasons.map((r, i) => (
                    <span key={i} className="text-[11px] font-semibold px-2.5 py-1 rounded-lg"
                      style={{ background: "var(--bg-active)", color: "var(--text-secondary)", border: "1px solid var(--border-subtle)" }}>
                      ✓ {r}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Confluence bar */}
            <div>
              <div className="flex justify-between text-[11px] mb-1.5">
                <span style={{ color: "var(--text-muted)" }}>Score de confiance</span>
                <span className="font-black" style={{ color }}>
                  {signal.confluence_score.toFixed(0)}%
                  {signal.confluence_score >= 70 ? " 🔥" : signal.confluence_score >= 55 ? " ✅" : " ⚠️"}
                </span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--bg-active)" }}>
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
          <div className="lg:w-[196px] flex-shrink-0 space-y-2">
            <div className="rounded-xl p-3" style={{ background: "rgba(34,197,94,0.07)", border: "1px solid rgba(34,197,94,0.18)" }}>
              <p className="text-[9px] font-black uppercase tracking-widest mb-1" style={{ color: "rgba(74,222,128,0.55)" }}>🎯 Objectif (TP)</p>
              <p className="text-[16px] font-black text-green-400 tabular-nums">{formatPrice(signal.tp1)}</p>
              <p className="text-[11px] font-bold text-green-400/55">{pctTp >= 0 ? "+" : ""}{pctTp.toFixed(1)}%</p>
            </div>
            <div className="rounded-xl p-3" style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.18)" }}>
              <p className="text-[9px] font-black uppercase tracking-widest mb-1" style={{ color: "rgba(248,113,113,0.55)" }}>🛡️ Stop Loss</p>
              <p className="text-[16px] font-black text-red-400 tabular-nums">{formatPrice(signal.sl)}</p>
              <p className="text-[11px] font-bold text-red-400/55">{pctSl >= 0 ? "+" : ""}{pctSl.toFixed(1)}%</p>
            </div>
            <div className="rounded-xl p-3" style={{ background: "var(--bg-active)", border: "1px solid var(--border-subtle)" }}>
              <p className="text-[9px] font-black uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>⚖️ Risk / Reward</p>
              <p className="text-[16px] font-black text-white">1:{rr.toFixed(1)}</p>
              <p className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>{rr >= 2 ? "🏆 Excellent" : rr >= 1.5 ? "✅ Bon" : "⚠️ Correct"}</p>
            </div>
            <button onClick={() => router.push(`/signaux/${signal.symbol}`)}
              className="w-full py-2.5 rounded-xl text-[12px] font-black transition-all hover:scale-[1.02]"
              style={{ background: color, color: "black" }}>
              Analyse complète →
            </button>
            <button onClick={() => router.push(`/dashboard?symbol=${signal.symbol}&action=${bullish ? "buy" : "sell"}&tp=${signal.tp1}&sl=${signal.sl}`)}
              className="w-full py-2.5 rounded-xl text-[12px] font-bold transition-all hover:brightness-110"
              style={{ background: "var(--bg-active)", color: "var(--text-secondary)", border: "1px solid var(--border-default)" }}>
              📈 Trader →
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
  const { t }   = useLanguage()
  const bullish = isBull(signal.signal)
  const color   = bullish ? "#22c55e" : "#ef4444"
  const pctTp   = signal.entry_price ? ((signal.tp1 - signal.entry_price) / signal.entry_price) * 100 : 0
  const pctSl   = signal.entry_price ? ((signal.sl  - signal.entry_price) / signal.entry_price) * 100 : 0
  const rr      = Math.abs(signal.sl - signal.entry_price) > 0
    ? Math.abs(signal.tp1 - signal.entry_price) / Math.abs(signal.sl - signal.entry_price)
    : signal.risk_reward_tp1
  const reasons = signal.confirmed_by.slice(0, 2).map(i => humanReason(i, t.signals.indicators as Record<string, string>))

  return (
    <div className="relative rounded-2xl overflow-hidden cursor-pointer transition-all hover:-translate-y-0.5"
      style={{
        background: bullish ? "rgba(34,197,94,0.05)" : "rgba(239,68,68,0.05)",
        border: `1px solid ${bullish ? "rgba(34,197,94,0.16)" : "rgba(239,68,68,0.16)"}`,
      }}
      onClick={() => !blurred && router.push(`/signaux/${signal.symbol}`)}>

      <div className="h-[2px]" style={{ background: `linear-gradient(90deg, ${color}90, transparent)` }} />

      {blurred && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-2xl"
          style={{ backdropFilter: "blur(6px)", background: "rgba(4,7,6,0.78)" }}>
          <p className="text-2xl">🔒</p>
          <button onClick={e => { e.stopPropagation(); onUpgrade() }}
            className="text-[11px] font-black px-4 py-1.5 rounded-lg"
            style={{ background: "rgba(34,197,94,0.18)", border: "1px solid rgba(34,197,94,0.30)", color: "#4ade80" }}>
            Premium
          </button>
        </div>
      )}

      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-xl flex items-center justify-center text-[11px] font-black text-black flex-shrink-0"
              style={{ background: color }}>
              #{rank}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-[14px] font-black text-white">{signal.symbol.replace("-USD","")}</p>
                <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full"
                  style={{ background: `${color}18`, color, border: `1px solid ${color}28` }}>
                  {sigLabelShort(signal.signal)}
                </span>
              </div>
              <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{signal.name.slice(0, 22)}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[13px] font-black text-white tabular-nums">{formatPrice(signal.price)}</p>
            <p className={`text-[11px] font-bold ${signal.change_24h >= 0 ? "text-green-400" : "text-red-400"}`}>
              {formatChange(signal.change_24h)}
            </p>
          </div>
        </div>

        {reasons.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {reasons.map((r, i) => (
              <span key={i} className="text-[10px] font-semibold px-2 py-0.5 rounded-lg"
                style={{ background: "var(--bg-active)", color: "var(--text-secondary)", border: "1px solid var(--border-subtle)" }}>
                ✓ {r}
              </span>
            ))}
          </div>
        )}

        <div className="mb-3">
          <div className="flex justify-between text-[11px] mb-1">
            <span style={{ color: "var(--text-muted)" }}>Confiance</span>
            <span className="font-black" style={{ color }}>{signal.confluence_score.toFixed(0)}%</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--bg-active)" }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${signal.confluence_score}%`, background: color }} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-1.5 mb-3">
          {[
            { label: "Entrée", val: formatPrice(signal.entry_price), sub: null, c: "var(--text-secondary)" },
            { label: "🎯 TP",   val: formatPrice(signal.tp1),        sub: `${pctTp >= 0 ? "+" : ""}${pctTp.toFixed(1)}%`, c: "#4ade80" },
            { label: "🛡️ SL",   val: formatPrice(signal.sl),         sub: `${pctSl >= 0 ? "+" : ""}${pctSl.toFixed(1)}%`, c: "#f87171" },
          ].map(item => (
            <div key={item.label} className="text-center p-2 rounded-xl" style={{ background: "var(--bg-active)" }}>
              <p className="text-[9px] font-bold mb-0.5" style={{ color: "var(--text-muted)" }}>{item.label}</p>
              <p className="text-[11px] font-black tabular-nums" style={{ color: item.c }}>{item.val}</p>
              {item.sub && <p className="text-[9px]" style={{ color: item.c + "99" }}>{item.sub}</p>}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[11px] font-black px-2.5 py-1 rounded-full"
            style={{
              background: rr >= 2 ? "rgba(34,197,94,0.08)" : "var(--bg-active)",
              color: rr >= 2 ? "#4ade80" : "var(--text-muted)",
              border: `1px solid ${rr >= 2 ? "rgba(34,197,94,0.18)" : "var(--border-subtle)"}`,
            }}>
            R/R 1:{rr.toFixed(1)} {rr >= 2 ? "🏆" : rr >= 1.5 ? "✅" : ""}
          </span>
          <span className="text-[11px] font-black px-3 py-1.5 rounded-xl"
            style={{ background: `${color}15`, color, border: `1px solid ${color}22` }}>
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
  const { t }  = useLanguage()
  if (rows.length === 0) return (
    <div className="text-center py-16 rounded-2xl" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
      <p className="text-4xl mb-3">📋</p>
      <p className="text-[16px] font-black text-white mb-1">Aucun historique</p>
      <p className="text-[13px]" style={{ color: "var(--text-tertiary)" }}>Les signaux apparaîtront ici après le premier scan</p>
    </div>
  )
  return (
    <div className="space-y-2">
      {rows.map(row => {
        const isLong = row.direction === "LONG"
        const ind    = row.indicateurs as any
        const color  = isLong ? "#22c55e" : "#ef4444"
        const sigStr = (ind?.signal as string) ?? (isLong ? "ACHAT" : "VENTE")
        const confirmedBy = (ind?.confirmed_by ?? []) as string[]
        const confluenceScore = ind?.confluence_score ?? row.score_confiance ?? 0
        const confluenceCount = ind?.confluence_count as number | undefined
        const totalInd = ind?.total_indicators as number | undefined
        const rr1 = ind?.risk_reward_tp1 as number | undefined
        const assetName = ind?.name as string | undefined
        const expiresAt = ind?.expires_at as string | undefined
        const isActive = expiresAt ? new Date(expiresAt).getTime() > Date.now() : false
        return (
          <div key={row.id} className="rounded-2xl p-4 transition-all hover:brightness-105"
            style={{
              background: "var(--bg-surface)",
              border: `1px solid var(--border-subtle)`,
              borderLeft: `3px solid ${isLong ? "rgba(34,197,94,0.5)" : "rgba(239,68,68,0.5)"}`,
            }}>
            <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-black px-2.5 py-1 rounded-full"
                  style={{ background: `${color}18`, color, border: `1px solid ${color}30` }}>
                  {sigLabel(sigStr)}
                </span>
                <span className="text-[14px] font-black text-white">{row.ticker}</span>
                {assetName && <span className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>{assetName}</span>}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                  style={isActive
                    ? { background: "rgba(245,158,11,0.10)", border: "1px solid rgba(245,158,11,0.20)", color: "#fbbf24" }
                    : { background: "var(--bg-active)", border: "1px solid var(--border-subtle)", color: "var(--text-muted)" }}>
                  {isActive ? "Actif ⏳" : "Fermé ◼"}
                </span>
                <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{localTimeAgo(row.created_at)}</span>
              </div>
            </div>
            {confluenceScore > 0 && (
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>Confluence</span>
                  <span className="text-[11px] font-black text-white">
                    {confluenceScore.toFixed(0)}%
                    {confluenceCount != null && totalInd != null && (
                      <span className="font-normal ml-1" style={{ color: "var(--text-muted)" }}>({confluenceCount}/{totalInd})</span>
                    )}
                  </span>
                </div>
                <div className="h-1.5 rounded-full" style={{ background: "var(--bg-active)" }}>
                  <div className="h-1.5 rounded-full" style={{ width: `${confluenceScore}%`, background: isLong ? "rgba(34,197,94,0.5)" : "rgba(239,68,68,0.5)" }} />
                </div>
                {confirmedBy.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {confirmedBy.slice(0, 6).map(l => (
                      <span key={l} className="text-[9px] px-1.5 py-0.5 rounded-full"
                        style={{ background: isLong ? "rgba(34,197,94,0.06)" : "rgba(239,68,68,0.06)", border: isLong ? "1px solid rgba(34,197,94,0.12)" : "1px solid rgba(239,68,68,0.12)", color: isLong ? "rgba(74,222,128,0.6)" : "rgba(248,113,113,0.6)" }}>
                        {l}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="grid grid-cols-5 gap-1.5 text-center">
              {[
                { label: t.signals.card.entry, key: "entry", val: row.prix_entree },
                { label: t.signals.card.tp1,   key: "tp1",   val: row.take_profit_1 },
                { label: "TP2",                key: "tp2",   val: row.take_profit_2 },
                { label: "TP3",                key: "tp3",   val: row.take_profit_3 ?? null },
                { label: t.signals.card.sl,    key: "sl",    val: row.stop_loss },
              ].map(({ label, key, val }) => val != null && (
                <div key={key}>
                  <p className="text-[9px] font-bold uppercase mb-0.5"
                    style={{ color: key === "sl" ? "#f87171" : key === "entry" ? "var(--text-muted)" : "#4ade80" }}>
                    {label}
                  </p>
                  <p className="text-[11px] font-semibold text-white">
                    {val < 1 ? val.toFixed(4) : val.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}
                  </p>
                  {key !== "entry" && (
                    <p className="text-[9px]" style={{ color: key === "sl" ? "rgba(239,68,68,0.6)" : "rgba(34,197,94,0.6)" }}>
                      {pctChange(row.prix_entree, val)}
                    </p>
                  )}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-4 mt-3 pt-3" style={{ borderTop: "1px solid var(--border-faint)" }}>
              {rr1 != null && (
                <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                  R/R TP1 <span className="font-black" style={{ color: isLong ? "#4ade80" : "#f87171" }}>{rr1.toFixed(1)}x</span>
                </span>
              )}
              <button onClick={() => router.push(`/signaux/${row.ticker}?id=${row.id}`)}
                className="ml-auto text-[11px] font-semibold transition-all hover:text-white"
                style={{ color: "var(--text-muted)" }}>
                Voir le graphe ↗
              </button>
            </div>
            {row.raisonnement && (
              <p className="text-[11px] italic mt-2" style={{ color: "var(--text-muted)" }}>
                🧠 "{row.raisonnement.slice(0, 120)}{row.raisonnement.length > 120 ? "…" : ""}"
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 px-5 py-4 rounded-2xl animate-pulse"
      style={{ background: "var(--bg-surface)", border: "1px solid var(--border-faint)" }}>
      <div className="h-6 w-20 rounded-full skeleton" />
      <div className="w-9 h-9 rounded-xl skeleton flex-shrink-0" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3 w-20 skeleton rounded" />
        <div className="h-2.5 w-32 skeleton rounded" />
      </div>
      <div className="h-3 w-16 skeleton rounded hidden md:block" />
      <div className="h-3 w-12 skeleton rounded" />
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function Signaux() {
  const router = useRouter()
  const { t } = useLanguage()

  const [user,         setUser]         = useState<any>(null)
  const [plan,         setPlan]         = useState("free")
  const [showUpgrade,  setShowUpgrade]  = useState(false)
  const [showTour,     setShowTour]     = useState(false)
  const tourCheckedRef                   = useRef(false)
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
  const [signalStats,  setSignalStats]  = useState<{
    total: number; hits: number; misses: number
    winRate: number; avgPnl: number
    topTickers: { ticker: string; winRate: number; total: number }[]
  } | null>(null)

  useEffect(() => {
    setIsMarketOpen(isNYSEOpenNow())
    const t = setInterval(() => setIsMarketOpen(isNYSEOpenNow()), 60_000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    fetch("/api/signaux/stats")
      .then(r => r.json())
      .then(d => setSignalStats(d))
      .catch(() => {})
  }, [])

  const fetchSignals = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch("/api/signals")
      if (!res.ok) return
      const data = await res.json()
      setSignals(data.signals ?? [])
      setStats(data.stats ?? null)
      setCountdown(300)
    } catch {}
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push("/login"); return }
      setUser(data.user)
      const { data: profile } = await supabase.from("profiles").select("plan").eq("email", data.user.email).maybeSingle()
      setPlan(getPlan(profile?.plan ?? "free"))
    })
  }, [router])

  useEffect(() => {
    if (!user) return
    fetchSignals()
    const interval = setInterval(fetchSignals, 300_000)
    return () => clearInterval(interval)
  }, [user, fetchSignals])

  useEffect(() => {
    if (loading || tourCheckedRef.current) return
    tourCheckedRef.current = true
    if (localStorage.getItem("tour_signaux_v1") !== "1") {
      const t = setTimeout(() => setShowTour(true), 800)
      return () => clearTimeout(t)
    }
  }, [loading])

  useEffect(() => {
    const t = setInterval(() => setCountdown(c => c <= 1 ? 300 : c - 1), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (tab !== "historique" || plan === "free" || historique.length > 0) return
    setHistLoading(true)
    supabase.from("signaux").select("*").order("created_at", { ascending: false }).limit(50)
      .then(({ data }) => { if (data) setHistorique(data as HistoriqueRow[]); setHistLoading(false) })
  }, [tab, plan, historique.length])

  if (!user) return null

  const filtered = signals
    .filter(s => filterSignal === "all" || s.signal === filterSignal)
    .filter(s => filterType  === "all_types" || s.type === filterType)
    .sort((a, b) => {
      if (sortBy === "confluence") return b.confluence_score - a.confluence_score
      if (sortBy === "rr")         return b.risk_reward_tp1 - a.risk_reward_tp1
      if (sortBy === "change")     return Math.abs(b.change_24h) - Math.abs(a.change_24h)
      return 0
    })

  const topSignals = [...signals].sort((a, b) => b.confluence_score - a.confluence_score).slice(0, 3)
  const isBlurring = plan === "free"
  const s = stats ?? { total: 0, fort: 0, achats: 0, ventes: 0, avg_confluence: 0 }

  // Sentiment ratio (0 = full bear, 100 = full bull)
  const sentimentPct = s.total > 0 ? Math.round((s.achats / s.total) * 100) : 50

  return (
    <>
      <div className="min-h-screen page-enter">

        {/* ══════════════════════════════════════════════════════
            HEADER
        ══════════════════════════════════════════════════════ */}
        <div className="px-6 py-5 border-b" style={{ borderColor: "var(--border-faint)" }}>

          {/* Row 1: Title + market status + signal feed btn */}
          <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
            <div className="flex items-center gap-3 flex-wrap">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.13em] mb-0.5" style={{ color: "var(--green-light)" }}>
                  Signaux IA
                </p>
                <h1 className="text-[22px] font-black text-white leading-none">{t.signals.title}</h1>
              </div>

              {/* Tabs */}
              <div className="flex rounded-xl overflow-hidden ml-2" style={{ border: "1px solid var(--border-subtle)" }}>
                {(["live", "historique"] as const).map(tabKey => (
                  <button key={tabKey} onClick={() => setTab(tabKey)}
                    className="px-4 py-2 text-[12px] font-bold transition-all"
                    style={tab === tabKey ? { background: "var(--bg-active)", color: "white" } : { background: "transparent", color: "var(--text-muted)" }}>
                    {tabKey === "live" ? t.signals.live : t.signals.history}
                  </button>
                ))}
              </div>

              {/* Market status */}
              {isMarketOpen ? (
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black text-green-400"
                  style={{ background: "var(--green-dim)", border: "1px solid var(--green-border)" }}>
                  <span className="live-dot" />
                  LIVE
                </span>
              ) : (
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black"
                  style={{ background: "var(--yellow-dim)", border: "1px solid rgba(245,158,11,0.22)", color: "var(--yellow-light)" }}>
                  🌙 Marché fermé
                </span>
              )}
            </div>

            {/* Refresh + countdown */}
            <div className="flex items-center gap-2">
              {/* Countdown pill */}
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl"
                style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
                <div className="w-1.5 h-1.5 rounded-full"
                  style={{ background: countdown <= 60 ? "#ef4444" : "#22c55e", boxShadow: `0 0 4px ${countdown <= 60 ? "#ef4444" : "#22c55e"}` }} />
                <span className={`text-[11px] font-black tabular-nums ${countdown <= 60 ? "text-red-400" : ""}`}
                  style={countdown > 60 ? { color: "var(--text-muted)" } : {}}>
                  {formatCountdown(countdown)}
                </span>
              </div>
              <button onClick={fetchSignals} disabled={loading}
                className="w-9 h-9 rounded-xl flex items-center justify-center transition-all disabled:opacity-40 hover:scale-110"
                style={{ border: "1px solid var(--border-default)", color: "var(--text-muted)", background: "var(--bg-surface)" }}>
                <span className={`text-base ${loading ? "animate-spin" : ""}`}>↻</span>
              </button>
              <a href="/news"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold transition-all hover:scale-[1.02]"
                style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", color: "var(--text-muted)" }}>
                📰 News
              </a>
            </div>
          </div>

          {/* ── Stats + Sentiment gauge ── */}
          {s.total > 0 && (
            <div className="flex flex-col sm:flex-row gap-3">

              {/* KPI cards */}
              <div className="flex gap-3 flex-1">
                {/* Forts */}
                <div className="flex-1 rounded-xl px-3 py-2.5 min-w-0"
                  style={{ background: s.fort > 0 ? "rgba(249,115,22,0.08)" : "var(--bg-surface)", border: `1px solid ${s.fort > 0 ? "rgba(249,115,22,0.20)" : "var(--border-subtle)"}` }}>
                  <p className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>⚡ Forts</p>
                  <p className="text-[20px] font-black tabular-nums leading-none mb-1.5" style={{ color: s.fort > 0 ? "#f97316" : "var(--text-muted)" }}>{s.fort}</p>
                  <div className="h-1 rounded-full overflow-hidden" style={{ background: "var(--bg-active)" }}>
                    <div className="h-full rounded-full" style={{ width: `${s.total > 0 ? (s.fort / s.total) * 100 : 0}%`, background: "#f97316" }} />
                  </div>
                  <p className="text-[9px] mt-1" style={{ color: "var(--text-muted)" }}>{s.total > 0 ? `${((s.fort / s.total) * 100).toFixed(0)}% du total` : "—"}</p>
                </div>
                {/* Achats */}
                <div className="flex-1 rounded-xl px-3 py-2.5 min-w-0"
                  style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.14)" }}>
                  <p className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>📈 Achats</p>
                  <p className="text-[20px] font-black tabular-nums leading-none mb-1.5" style={{ color: "#4ade80" }}>{s.achats}</p>
                  <div className="h-1 rounded-full overflow-hidden" style={{ background: "var(--bg-active)" }}>
                    <div className="h-full rounded-full" style={{ width: `${s.total > 0 ? (s.achats / s.total) * 100 : 0}%`, background: "#4ade80" }} />
                  </div>
                  <p className="text-[9px] mt-1" style={{ color: "var(--text-muted)" }}>{s.total > 0 ? `${((s.achats / s.total) * 100).toFixed(0)}% haussiers` : "—"}</p>
                </div>
                {/* Ventes */}
                <div className="flex-1 rounded-xl px-3 py-2.5 min-w-0"
                  style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.14)" }}>
                  <p className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>📉 Ventes</p>
                  <p className="text-[20px] font-black tabular-nums leading-none mb-1.5" style={{ color: "#f87171" }}>{s.ventes}</p>
                  <div className="h-1 rounded-full overflow-hidden" style={{ background: "var(--bg-active)" }}>
                    <div className="h-full rounded-full" style={{ width: `${s.total > 0 ? (s.ventes / s.total) * 100 : 0}%`, background: "#f87171" }} />
                  </div>
                  <p className="text-[9px] mt-1" style={{ color: "var(--text-muted)" }}>{s.total > 0 ? `${((s.ventes / s.total) * 100).toFixed(0)}% baissiers` : "—"}</p>
                </div>
                {/* Score moy */}
                <div className="flex-1 rounded-xl px-3 py-2.5 min-w-0"
                  style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
                  <p className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>Score moy.</p>
                  <p className="text-[20px] font-black tabular-nums leading-none mb-1.5" style={{ color: "var(--blue-light)" }}>{s.avg_confluence.toFixed(0)}%</p>
                  <div className="h-1 rounded-full overflow-hidden" style={{ background: "var(--bg-active)" }}>
                    <div className="h-full rounded-full" style={{ width: `${s.avg_confluence}%`, background: s.avg_confluence >= 65 ? "#22c55e" : s.avg_confluence >= 50 ? "#f59e0b" : "#ef4444" }} />
                  </div>
                  <p className="text-[9px] mt-1" style={{ color: "var(--text-muted)" }}>{s.avg_confluence >= 65 ? "Confluence forte" : s.avg_confluence >= 50 ? "Confluence correcte" : "Confluence faible"}</p>
                </div>
              </div>

              {/* Sentiment gauge */}
              <div className="sm:w-48 flex-shrink-0 rounded-xl p-3"
                style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
                <p className="text-[9px] font-bold uppercase tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>
                  Sentiment marché
                </p>
                <div className="h-2 rounded-full overflow-hidden mb-1.5"
                  style={{ background: "linear-gradient(90deg, rgba(239,68,68,0.3), rgba(239,68,68,0.1) 45%, rgba(34,197,94,0.1) 55%, rgba(34,197,94,0.3))" }}>
                  <div className="h-full w-1.5 rounded-full transition-all duration-700 -translate-y-px"
                    style={{ marginLeft: `calc(${sentimentPct}% - 3px)`, background: sentimentPct >= 50 ? "#4ade80" : "#f87171", boxShadow: `0 0 6px ${sentimentPct >= 50 ? "#4ade80" : "#f87171"}` }} />
                </div>
                <div className="flex justify-between text-[9px]" style={{ color: "var(--text-muted)" }}>
                  <span style={{ color: "#f87171" }}>Baissier</span>
                  <span className="font-black" style={{ color: sentimentPct >= 50 ? "#4ade80" : "#f87171" }}>
                    {sentimentPct >= 50 ? `${sentimentPct}% haussier` : `${100 - sentimentPct}% baissier`}
                  </span>
                  <span style={{ color: "#4ade80" }}>Haussier</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Widget stats performance signaux ── */}
        {signalStats && signalStats.total >= 5 && (
          <div className="px-6 py-3 border-b" style={{ borderColor: "var(--border-faint)" }}>
            <div className="rounded-2xl px-5 py-4 flex items-center gap-6 flex-wrap"
              style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.15)" }}>
              {[
                { label: "Taux de succès", value: `${signalStats.winRate}%`, color: signalStats.winRate >= 60 ? "#4ade80" : "#f59e0b" },
                { label: "Signaux trackés", value: String(signalStats.total), color: "rgba(255,255,255,0.85)" },
                { label: "TP atteints", value: String(signalStats.hits), color: "#4ade80" },
                { label: "SL touchés", value: String(signalStats.misses), color: "#f87171" },
                { label: "P&L moyen", value: `${signalStats.avgPnl >= 0 ? "+" : ""}${signalStats.avgPnl.toFixed(1)}%`, color: signalStats.avgPnl >= 0 ? "#4ade80" : "#f87171" },
              ].map((item, i) => (
                <div key={item.label} className="flex items-center gap-6">
                  {i > 0 && <div className="w-px h-8 flex-shrink-0" style={{ background: "rgba(255,255,255,0.10)" }} />}
                  <div>
                    <p className="text-[9px] uppercase tracking-widest font-bold mb-0.5" style={{ color: "var(--text-muted)" }}>{item.label}</p>
                    <p className="text-2xl font-black" style={{ color: item.color }}>{item.value}</p>
                  </div>
                </div>
              ))}
              {signalStats.topTickers.length > 0 && (
                <>
                  <div className="w-px h-8 flex-shrink-0" style={{ background: "rgba(255,255,255,0.10)" }} />
                  <div>
                    <p className="text-[9px] uppercase tracking-widest font-bold mb-1.5" style={{ color: "var(--text-muted)" }}>Meilleurs actifs</p>
                    <div className="flex gap-2">
                      {signalStats.topTickers.slice(0, 3).map(t => (
                        <span key={t.ticker} className="text-[10px] font-black px-2 py-0.5 rounded-full"
                          style={{ background: "rgba(34,197,94,0.12)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.2)" }}>
                          {t.ticker} {t.winRate}%
                        </span>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── Filters ── */}
        {tab === "live" && (
          <div className="px-6 py-3 border-b" style={{ borderColor: "var(--border-faint)", background: "rgba(255,255,255,0.01)" }}>
            <div className="flex flex-wrap items-center gap-2">
              {/* Signal type */}
              {[
                { key: "all",        label: "Tous",       color: undefined },
                { key: "ACHAT_FORT", label: "⚡ Strong Buy", color: "#f97316" },
                { key: "ACHAT",      label: "↗ Buy",       color: "#4ade80" },
                { key: "VENTE_FORT", label: "⚡ Strong Sell",color: "#f97316" },
                { key: "VENTE",      label: "↘ Sell",      color: "#f87171" },
              ].map(f => (
                <button key={f.key} onClick={() => setFilterSignal(f.key)}
                  className="px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all"
                  style={filterSignal === f.key ? {
                    background: f.color ? `${f.color}15` : "var(--bg-active)",
                    color: f.color ?? "white",
                    border: `1px solid ${f.color ? `${f.color}28` : "var(--border-default)"}`,
                  } : {
                    background: "transparent",
                    color: "var(--text-muted)",
                    border: "1px solid transparent",
                  }}>
                  {f.label}
                </button>
              ))}

              <div className="h-4 w-px mx-1" style={{ background: "var(--border-subtle)" }} />

              {/* Asset type */}
              {[
                { key: "all_types", label: "Tous actifs" },
                { key: "stock",     label: "📈 Stocks" },
                { key: "crypto",    label: "₿ Crypto" },
                { key: "etf",       label: "📦 ETF" },
              ].map(f => (
                <button key={f.key} onClick={() => setFilterType(f.key)}
                  className="px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all"
                  style={filterType === f.key ? {
                    background: "var(--bg-active)", color: "white", border: "1px solid var(--border-default)"
                  } : {
                    background: "transparent", color: "var(--text-muted)", border: "1px solid transparent"
                  }}>
                  {f.label}
                </button>
              ))}

              {/* Sort + view — right side */}
              <div className="ml-auto flex items-center gap-2">
                <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid var(--border-subtle)" }}>
                  {[
                    { key: "confluence", label: "Score" },
                    { key: "rr",         label: "R/R" },
                    { key: "change",     label: "Var." },
                  ].map(s => (
                    <button key={s.key} onClick={() => setSortBy(s.key)}
                      className="px-2.5 py-1.5 text-[10px] font-bold transition-all"
                      style={sortBy === s.key ? { background: "var(--bg-active)", color: "white" } : { background: "transparent", color: "var(--text-muted)" }}>
                      {s.label}
                    </button>
                  ))}
                </div>
                <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid var(--border-subtle)" }}>
                  {[{ key: "list", icon: "☰" }, { key: "table", icon: "⊞" }].map(v => (
                    <button key={v.key} onClick={() => setView(v.key as any)}
                      className="w-8 h-7 flex items-center justify-center text-[12px] transition-all"
                      style={view === v.key ? { background: "var(--bg-active)", color: "white" } : { background: "transparent", color: "var(--text-muted)" }}>
                      {v.icon}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            LIVE TAB
        ══════════════════════════════════════════════════════ */}
        {tab === "live" && (
          <>
            {/* Top 3 */}
            {!loading && topSignals.length > 0 && (
              <div className="px-6 py-5 border-b" style={{ borderColor: "var(--border-faint)" }}>
                <p className="label mb-3">⭐ Meilleures opportunités</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {topSignals.map((signal, i) => (
                    <CompactSignalCard key={signal.symbol} signal={signal} rank={i + 1} onUpgrade={() => setShowUpgrade(true)} />
                  ))}
                </div>
              </div>
            )}

            {/* Signal list */}
            <div className="px-6 py-5">
              <div className="flex items-center justify-between mb-4">
                <p className="label">
                  Tous les signaux ({loading ? "…" : filtered.length})
                </p>
              </div>

              {loading && (
                <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)}</div>
              )}

              {!loading && filtered.length === 0 && (
                <div className="text-center py-16 rounded-2xl" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
                  <p className="text-4xl mb-3">📡</p>
                  <p className="font-black text-white text-[15px] mb-2">{t.signals.noSignals}</p>
                  <p className="text-[13px] mb-4" style={{ color: "var(--text-tertiary)" }}>
                    {filterSignal !== "all" || filterType !== "all_types"
                      ? "Essaie de modifier les filtres."
                      : "L'algorithme scanne en continu. Reviens dans quelques minutes."}
                  </p>
                  {(filterSignal !== "all" || filterType !== "all_types") && (
                    <button onClick={() => { setFilterSignal("all"); setFilterType("all_types") }}
                      className="px-5 py-2.5 rounded-xl text-[13px] font-black text-black"
                      style={{ background: "#22c55e" }}>
                      Réinitialiser les filtres
                    </button>
                  )}
                </div>
              )}

              {/* List view */}
              {!loading && filtered.length > 0 && view === "list" && (
                <div className="relative">
                  <div className="space-y-1.5">
                    {filtered.map((signal, idx) => {
                      const blurred   = isBlurring && idx >= 3
                      const bullish   = isBull(signal.signal)
                      const color     = bullish ? "#22c55e" : "#ef4444"
                      const pctTp     = signal.entry_price ? ((signal.tp1 - signal.entry_price) / signal.entry_price) * 100 : 0
                      const rr        = Math.abs(signal.sl - signal.entry_price) > 0
                        ? Math.abs(signal.tp1 - signal.entry_price) / Math.abs(signal.sl - signal.entry_price)
                        : signal.risk_reward_tp1
                      const topReason = signal.confirmed_by[0] ? humanReason(signal.confirmed_by[0], t.signals.indicators as Record<string, string>) : null

                      if (blurred) return (
                        <div key={signal.symbol} className="relative flex items-center gap-4 px-5 py-4 rounded-2xl"
                          style={{ background: "var(--bg-surface)", border: "1px solid var(--border-faint)" }}>
                          <div className="absolute inset-0 z-10 flex items-center justify-end pr-5 rounded-2xl"
                            style={{ backdropFilter: "blur(4px)", background: "rgba(4,7,6,0.65)" }}>
                            <button onClick={() => setShowUpgrade(true)}
                              className="text-[11px] font-black px-3 py-1.5 rounded-xl"
                              style={{ background: "var(--green-dim)", border: "1px solid var(--green-border)", color: "var(--green-light)" }}>
                              🔒 Premium
                            </button>
                          </div>
                          <div className="h-5 w-20 skeleton rounded-full" />
                          <div className="w-9 h-9 rounded-xl skeleton flex-shrink-0" />
                          <div className="flex-1 space-y-1.5">
                            <div className="h-3 w-16 skeleton rounded" />
                            <div className="h-2 w-24 skeleton rounded" />
                          </div>
                        </div>
                      )

                      return (
                        <div key={signal.symbol}
                          className="flex items-center gap-3 md:gap-4 px-5 py-3.5 rounded-2xl cursor-pointer transition-all group"
                          style={{ background: "var(--bg-surface)", border: "1px solid var(--border-faint)" }}
                          onClick={() => router.push(`/signaux/${signal.symbol}`)}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--border-accent)"; e.currentTarget.style.background = "var(--bg-selected)" }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border-faint)"; e.currentTarget.style.background = "var(--bg-surface)" }}>

                          {/* Signal badge */}
                          <span className="text-[10px] font-black px-2.5 py-1 rounded-full flex-shrink-0 w-[88px] text-center tabular-nums"
                            style={{ background: `${color}14`, color, border: `1px solid ${color}22` }}>
                            {sigLabelShort(signal.signal)}
                          </span>

                          {/* Avatar + name */}
                          <div className="flex items-center gap-2.5 flex-1 min-w-0">
                            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-[11px] font-black text-black flex-shrink-0"
                              style={{ background: color }}>
                              {signal.symbol.replace("-USD","")[0]}
                            </div>
                            <div className="min-w-0">
                              <p className="text-[13px] font-black text-white">{signal.symbol.replace("-USD","")}</p>
                              <p className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>{signal.name.slice(0, 24)}</p>
                            </div>
                          </div>

                          {topReason && (
                            <span className="hidden lg:inline text-[10px] px-2 py-1 rounded-lg flex-shrink-0"
                              style={{ background: "var(--bg-active)", color: "var(--text-secondary)", border: "1px solid var(--border-subtle)" }}>
                              ✓ {topReason}
                            </span>
                          )}

                          <p className="text-[13px] font-black text-white tabular-nums flex-shrink-0">{formatPrice(signal.price)}</p>

                          <p className={`text-[12px] font-bold tabular-nums flex-shrink-0 w-14 text-right ${signal.change_24h >= 0 ? "text-green-400" : "text-red-400"}`}>
                            {formatChange(signal.change_24h)}
                          </p>

                          <div className="hidden md:flex items-center gap-2 flex-shrink-0">
                            <div className="w-14 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--bg-active)" }}>
                              <div className="h-full rounded-full"
                                style={{ width: `${signal.confluence_score}%`, background: signal.confluence_score >= 70 ? "#22c55e" : signal.confluence_score >= 55 ? "#f59e0b" : "#ef4444" }} />
                            </div>
                            <span className="text-[11px] font-black w-8 tabular-nums" style={{ color }}>{signal.confluence_score.toFixed(0)}%</span>
                          </div>

                          <span className="hidden md:inline text-[11px] font-bold w-9 text-right flex-shrink-0 tabular-nums" style={{ color: "var(--text-muted)" }}>
                            {rr.toFixed(1)}x
                          </span>

                          <span className="text-[10px] w-12 text-right flex-shrink-0 tabular-nums hidden sm:block" style={{ color: "var(--text-muted)" }}>
                            {timeUntilExpiry(signal.expires_at)}
                          </span>

                          <span className="transition-colors flex-shrink-0 group-hover:text-white/60" style={{ color: "var(--text-muted)" }}>→</span>
                        </div>
                      )
                    })}
                  </div>

                  {isBlurring && filtered.length > 3 && (
                    <div className="relative -mt-20 h-24 flex items-end justify-center pb-5"
                      style={{ background: "linear-gradient(to bottom, transparent, var(--bg-canvas))" }}>
                      <button onClick={() => setShowUpgrade(true)}
                        className="px-7 py-3 rounded-2xl text-[13px] font-black text-black transition-all hover:scale-105"
                        style={{ background: "linear-gradient(135deg,#22c55e,#16a34a)", boxShadow: "0 0 30px rgba(34,197,94,0.28)" }}>
                        🚀 Débloquer tous les signaux
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Table view */}
              {!loading && filtered.length > 0 && view === "table" && (
                <div className="relative overflow-x-auto rounded-2xl" style={{ border: "1px solid var(--border-subtle)" }}>
                  <table className="w-full">
                    <thead>
                      <tr style={{ background: "rgba(255,255,255,0.02)", borderBottom: "1px solid var(--border-subtle)" }}>
                        {[t.signals.tableHeaders.signal, t.signals.tableHeaders.asset, t.signals.tableHeaders.reason, t.signals.tableHeaders.price, t.signals.tableHeaders.change, t.signals.tableHeaders.confidence, t.signals.tableHeaders.rr, t.signals.tableHeaders.expires, ""].map((h, i) => (
                          <th key={i} className="px-4 py-3 text-left text-[9px] uppercase tracking-widest font-bold whitespace-nowrap" style={{ color: "var(--text-muted)" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((signal, idx) => {
                        const blurred = isBlurring && idx >= 3
                        const bullish = isBull(signal.signal)
                        const color   = bullish ? "#22c55e" : "#ef4444"
                        const rr      = Math.abs(signal.sl - signal.entry_price) > 0
                          ? Math.abs(signal.tp1 - signal.entry_price) / Math.abs(signal.sl - signal.entry_price)
                          : signal.risk_reward_tp1
                        const topReason = signal.confirmed_by[0] ? humanReason(signal.confirmed_by[0]) : "—"
                        return (
                          <tr key={signal.symbol} className="transition-all cursor-pointer"
                            style={{ borderBottom: "1px solid var(--border-faint)" }}
                            onClick={() => !blurred && router.push(`/signaux/${signal.symbol}`)}
                            onMouseEnter={e => !blurred && (e.currentTarget.style.background = "var(--bg-hover)")}
                            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                            <td className="px-4 py-3 relative">
                              {blurred && (
                                <div className="absolute inset-0 z-10 flex items-center justify-start pl-4"
                                  style={{ backdropFilter: "blur(4px)", background: "rgba(4,7,6,0.65)" }}>
                                  <button onClick={e => { e.stopPropagation(); setShowUpgrade(true) }}
                                    className="text-[10px] font-black px-2 py-1 rounded-lg"
                                    style={{ background: "var(--green-dim)", color: "var(--green-light)", border: "1px solid var(--green-border)" }}>
                                    🔒 Pro
                                  </button>
                                </div>
                              )}
                              <span className="text-[10px] font-black px-2 py-0.5 rounded-full"
                                style={{ background: `${color}14`, color, border: `1px solid ${color}22` }}>
                                {sigLabelShort(signal.signal)}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black text-black flex-shrink-0" style={{ background: color }}>
                                  {signal.symbol.replace("-USD","")[0]}
                                </div>
                                <div>
                                  <p className="text-[12px] font-bold text-white">{signal.symbol.replace("-USD","")}</p>
                                  <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{signal.name.slice(0, 16)}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3"><span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>✓ {topReason}</span></td>
                            <td className="px-4 py-3 text-[12px] font-bold text-white tabular-nums">{formatPrice(signal.price)}</td>
                            <td className="px-4 py-3">
                              <span className={`text-[12px] font-bold tabular-nums ${signal.change_24h >= 0 ? "text-green-400" : "text-red-400"}`}>
                                {formatChange(signal.change_24h)}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1.5">
                                <div className="w-12 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--bg-active)" }}>
                                  <div className="h-full rounded-full" style={{ width: `${signal.confluence_score}%`, background: color }} />
                                </div>
                                <span className="text-[11px] font-black tabular-nums" style={{ color }}>{signal.confluence_score.toFixed(0)}%</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-[12px] font-bold tabular-nums" style={{ color: "var(--text-secondary)" }}>{rr.toFixed(1)}x</td>
                            <td className="px-4 py-3 text-[10px] tabular-nums" style={{ color: "var(--text-muted)" }}>{timeUntilExpiry(signal.expires_at)}</td>
                            <td className="px-4 py-3">
                              <span className="text-[11px] font-semibold transition-all" style={{ color: "var(--text-muted)" }}
                                onMouseEnter={e => (e.currentTarget.style.color = "white")}
                                onMouseLeave={e => (e.currentTarget.style.color = "var(--text-muted)")}>
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
                      style={{ background: "linear-gradient(to bottom, transparent, var(--bg-canvas))" }}>
                      <button onClick={() => setShowUpgrade(true)}
                        className="px-7 py-2.5 rounded-2xl text-[13px] font-black text-black hover:scale-105 transition-all"
                        style={{ background: "linear-gradient(135deg,#22c55e,#16a34a)" }}>
                        🚀 Débloquer tous les signaux
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {/* ══════════════════════════════════════════════════════
            HISTORIQUE TAB
        ══════════════════════════════════════════════════════ */}
        {tab === "historique" && (
          <div className="px-6 py-6 space-y-4">
            <h2 className="text-[18px] font-black text-white">{t.signals.lastUpdate}</h2>
            {plan === "free" ? (
              <div className="text-center py-16 rounded-2xl" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
                <p className="text-4xl mb-3">🔒</p>
                <p className="text-[16px] font-black text-white mb-1">Accès Premium requis</p>
                <p className="text-[13px] mb-5" style={{ color: "var(--text-tertiary)" }}>
                  Accède à l'historique complet des signaux avec un abonnement Pro
                </p>
                <button onClick={() => setShowUpgrade(true)}
                  className="px-6 py-2.5 rounded-xl text-[13px] font-black text-black"
                  style={{ background: "linear-gradient(135deg,#22c55e,#16a34a)" }}>
                  Débloquer l'historique
                </button>
              </div>
            ) : histLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-28 skeleton rounded-2xl" />
                ))}
              </div>
            ) : (
              <HistoriqueView rows={historique} />
            )}
          </div>
        )}
      </div>

      <UpgradeModal open={showUpgrade} onClose={() => setShowUpgrade(false)} context="signals" />

      {showTour && (
        <Tour steps={SIGNAUX_TOUR_STEPS} storageKey="tour_signaux_v1" onComplete={() => setShowTour(false)} />
      )}
    </>
  )
}
