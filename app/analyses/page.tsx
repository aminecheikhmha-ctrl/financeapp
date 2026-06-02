"use client"

import React, { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import type { AssetData, SnapshotResponse } from "@/app/api/macro/snapshot/route"
import Tour, { ANALYSES_TOUR_STEPS } from "@/app/components/Tour"

// ── Types ──────────────────────────────────────────────────────────────────────

type MacroRegime = "croissance_forte" | "fin_de_cycle" | "ralentissement" | "recession" | "reprise"

type CorrData = {
  matrix:  Record<string, Record<string, number>>
  symbols: { key: string; label: string }[]
}

type NewsArticle = {
  title:        string
  source:       string
  url:          string
  published_at: string
  category?:    string
  theme?:       string
}

type MarketRow = AssetData & { key: string }

// ── Constants ──────────────────────────────────────────────────────────────────

const REGIME_CONFIG: Record<MacroRegime, {
  label: string; emoji: string; color: string; bg: string
}> = {
  croissance_forte: { label: "Growth",        emoji: "🚀", color: "#22c55e", bg: "rgba(34,197,94,0.08)"   },
  fin_de_cycle:     { label: "Late Cycle",    emoji: "🌤️", color: "#f59e0b", bg: "rgba(245,158,11,0.08)" },
  ralentissement:   { label: "Slowdown",      emoji: "🌧️", color: "#f97316", bg: "rgba(249,115,22,0.08)" },
  recession:        { label: "Recession",     emoji: "⛈️", color: "#ef4444", bg: "rgba(239,68,68,0.08)"  },
  reprise:          { label: "Recovery",      emoji: "🌱", color: "#60a5fa", bg: "rgba(96,165,250,0.08)" },
}

const NAV_SECTIONS = [
  { id: "snapshot",     icon: "🌡️", label: "Snapshot" },
  { id: "marches",      icon: "📈", label: "Markets" },
  { id: "inflation",    icon: "🔥", label: "Inflation & Rates" },
  { id: "obligations",  icon: "📜", label: "Bonds" },
  { id: "devises",      icon: "💱", label: "Currencies" },
  { id: "matieres",     icon: "🥇", label: "Commodities" },
  { id: "crypto",       icon: "₿",  label: "Crypto" },
  { id: "correlations", icon: "⚡", label: "Correlations" },
  { id: "geopolitique", icon: "🌍", label: "Geopolitics" },
  { id: "calendrier",   icon: "📅", label: "Eco. Calendar" },
]

const CORR_LABELS: Record<string, string> = {
  SPY: "S&P 500", BTC: "Bitcoin", GLD: "Gold", DXY: "Dollar", TLT: "Bonds", OIL: "Oil",
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function computeRegime(vix: number, spyChange1m: number, yieldCurve: number | null): MacroRegime {
  const yc = yieldCurve ?? 0.3
  if (vix > 30 && spyChange1m < -10) return "recession"
  if (vix > 20 && spyChange1m < -5)  return "ralentissement"
  if (yc < 0 || vix > 18)            return "fin_de_cycle"
  if (spyChange1m > 5 && vix < 16)   return "croissance_forte"
  return "fin_de_cycle"
}

function fmtPrice(v: number | undefined, isYield = false): string {
  if (v == null) return "—"
  if (isYield) return `${v.toFixed(2)}%`
  if (v > 10000) return `$${v.toLocaleString("en-US", { maximumFractionDigits: 0 })}`
  if (v > 100)   return `$${v.toFixed(2)}`
  if (v > 10)    return `$${v.toFixed(3)}`
  return `$${v.toFixed(4)}`
}

function fmtChg(v: number | undefined): React.ReactElement {
  if (v == null) return <span className="text-white/25">—</span>
  const pos = v >= 0
  return (
    <span className={`font-bold tabular-nums ${pos ? "text-green-400" : "text-red-400"}`}>
      {pos ? "+" : ""}{v.toFixed(2)}%
    </span>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SectionHeader({ icon, title, badge }: { icon: string; title: string; badge?: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <span className="text-xl">{icon}</span>
      <h2 className="text-base font-black text-white">{title}</h2>
      {badge && (
        <span className="text-[9px] text-white/25 bg-white/5 border border-white/8 px-2 py-0.5 rounded-full font-bold">
          {badge}
        </span>
      )}
      <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.05)" }} />
    </div>
  )
}

function Sparkline({ data, positive }: { data: number[]; positive: boolean }) {
  if (!data || data.length < 2) return null
  const min = Math.min(...data), max = Math.max(...data)
  const range = max - min || 1
  const W = 56, H = 22
  const pts = data.map((v, i) => [
    (i / (data.length - 1)) * W,
    H - ((v - min) / range) * (H - 2) - 1,
  ])
  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ")
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
      <path d={d} fill="none"
        stroke={positive ? "#22c55e" : "#ef4444"}
        strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" opacity={0.7}
      />
    </svg>
  )
}

type SortKey = "change_1d" | "change_1w" | "change_1m" | "change_ytd"

function MarketTable({ rows, isYield = false }: { rows: MarketRow[]; isYield?: boolean }) {
  const router = useRouter()
  const [sortBy, setSortBy] = useState<SortKey>("change_1d")
  const sorted = [...rows].sort((a, b) => (b[sortBy] ?? 0) - (a[sortBy] ?? 0))

  const cols: { key: SortKey; label: string }[] = [
    { key: "change_1d",  label: "1J"  },
    { key: "change_1w",  label: "1S"  },
    { key: "change_1m",  label: "1M"  },
    { key: "change_ytd", label: "YTD" },
  ]

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
      <table className="w-full min-w-[520px]">
        <thead>
          <tr style={{ background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <th className="px-4 py-2.5 text-left   text-[9px] text-white/25 uppercase tracking-widest font-bold">Asset</th>
            <th className="px-4 py-2.5 text-right  text-[9px] text-white/25 uppercase tracking-widest font-bold">Price</th>
            {cols.map(c => (
              <th key={c.key} onClick={() => setSortBy(c.key)}
                className={`px-3 py-2.5 text-right text-[9px] uppercase tracking-widest font-bold cursor-pointer transition-colors ${sortBy === c.key ? "text-white/60" : "text-white/25 hover:text-white/50"}`}>
                {c.label}{sortBy === c.key ? " ↓" : ""}
              </th>
            ))}
            <th className="px-3 py-2.5 text-right  text-[9px] text-white/25 uppercase tracking-widest font-bold">RSI</th>
            <th className="px-4 py-2.5 text-left   text-[9px] text-white/25 uppercase tracking-widest font-bold w-16">Trend</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(row => (
            <tr key={row.key}
              className="border-b border-white/[0.04] hover:bg-white/[0.02] cursor-pointer transition-colors"
              style={{ borderColor: "rgba(255,255,255,0.04)" }}
              onClick={() => !isYield && router.push(`/dashboard?symbol=${encodeURIComponent(row.symbol)}`)}>
              <td className="px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-base flex-shrink-0 leading-none">{row.flag}</span>
                  <div>
                    <p className="text-xs font-bold text-white leading-tight">{row.label}</p>
                    <p className="text-[9px] text-white/25 font-mono">{row.key}</p>
                  </div>
                </div>
              </td>
              <td className="px-4 py-2.5 text-right">
                <span className="text-sm font-black text-white tabular-nums">
                  {fmtPrice(row.price, isYield)}
                </span>
              </td>
              {cols.map(c => (
                <td key={c.key} className="px-3 py-2.5 text-right text-xs">
                  {fmtChg(row[c.key])}
                </td>
              ))}
              <td className="px-3 py-2.5 text-right">
                {row.rsi != null && (
                  <span className={`text-xs font-black tabular-nums ${
                    row.rsi < 30 ? "text-green-400" : row.rsi > 70 ? "text-red-400" : "text-white/40"
                  }`}>{row.rsi.toFixed(0)}</span>
                )}
              </td>
              <td className="px-4 py-2.5">
                <Sparkline data={row.sparkline ?? []} positive={(row.change_1m ?? 0) >= 0} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SkeletonTable() {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-white/[0.04]">
          <div className="w-6 h-6 rounded-full skeleton" />
          <div className="flex-1 h-3 skeleton rounded" style={{ width: "30%" }} />
          <div className="h-3 skeleton rounded ml-auto" style={{ width: "15%" }} />
          <div className="h-3 skeleton rounded" style={{ width: "10%" }} />
          <div className="h-3 skeleton rounded" style={{ width: "10%" }} />
          <div className="h-3 skeleton rounded" style={{ width: "10%" }} />
        </div>
      ))}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function AnalysesPage() {
  const [snapshot,      setSnapshot]      = useState<SnapshotResponse | null>(null)
  const [correlations,  setCorrelations]  = useState<CorrData | null>(null)
  const [aiBriefing,    setAiBriefing]    = useState("")
  const [loadingBriefing, setLoadingBriefing] = useState(false)
  const [macroNews,     setMacroNews]     = useState<NewsArticle[]>([])
  const [activeSection, setActiveSection] = useState("snapshot")
  const [loading,       setLoading]       = useState(true)
  const [lastUpdate,    setLastUpdate]    = useState<Date | null>(null)
  const [showTour,      setShowTour]      = useState(false)
  const observerRef   = useRef<IntersectionObserver | null>(null)
  const tourCheckedRef = useRef(false)

  // ── Derived from snapshot ──
  const vix        = snapshot?.vix        ?? 18
  const yieldCurve = snapshot?.yieldCurve ?? null
  const fedRate    = snapshot?.fedRate    ?? 5.25
  const spy        = snapshot?.spy        ?? null
  const regime     = snapshot
    ? computeRegime(vix, spy?.change1m ?? 0, yieldCurve)
    : null

  // ── Ticker tape data ──
  const tickerItems = snapshot ? [
    ...(Object.values(snapshot.indices).slice(0, 4) as AssetData[]),
    ...(Object.values(snapshot.crypto).slice(0, 3)  as AssetData[]),
    ...(Object.values(snapshot.commodities).slice(0, 2) as AssetData[]),
    { ...snapshot.bonds["TNX"], label: "US 10Y", flag: "📜" } as AssetData,
  ].filter(Boolean) : []

  // ── Data fetching ──
  const loadSnapshot = useCallback(async () => {
    try {
      const res  = await fetch("/api/macro/snapshot")
      const data = await res.json() as SnapshotResponse
      setSnapshot(data)
      setLastUpdate(new Date())
    } catch {}
  }, [])

  const loadCorrelations = useCallback(async () => {
    try {
      const res  = await fetch("/api/macro/correlations")
      const data = await res.json() as CorrData
      setCorrelations(data)
    } catch {}
  }, [])

  const loadNews = useCallback(async () => {
    try {
      const res = await fetch("/api/news")
      const { articles } = await res.json()
      const macroKeywords = ["fed", "inflation", "taux", "banque centrale", "bce", "réserve fédérale",
        "recession", "pib", "cpi", "emploi", "chômage", "géopolitique", "petrole", "dollar", "yuan",
        "guerre", "conflit", "sanctions", "tarif", "import", "export"]
      const filtered = (articles as NewsArticle[]).filter(a => {
        const text = (a.title + (a.theme ?? "") + (a.category ?? "")).toLowerCase()
        return a.category === "macro" || macroKeywords.some(k => text.includes(k))
      }).slice(0, 12)
      setMacroNews(filtered)
    } catch {}
  }, [])

  const generateBriefing = useCallback(async (snap: SnapshotResponse, reg: MacroRegime) => {
    setLoadingBriefing(true)
    try {
      const res = await fetch("/api/macro/briefing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spyChange:  snap.spy?.change1d  ?? 0,
          vix:        snap.vix            ?? 18,
          fedRate:    snap.fedRate        ?? 5.25,
          goldChange: snap.gold?.change1d ?? 0,
          regime:     reg,
        }),
      })
      const json = await res.json()
      if (json.briefing) setAiBriefing(json.briefing)
    } catch {}
    setLoadingBriefing(false)
  }, [])

  const loadAllData = useCallback(async () => {
    setLoading(true)
    await Promise.all([loadSnapshot(), loadCorrelations(), loadNews()])
    setLoading(false)
  }, [loadSnapshot, loadCorrelations, loadNews])

  useEffect(() => { loadAllData() }, [loadAllData])

  // Tour — trigger once after first load (ref guard prevents re-trigger on refresh)
  useEffect(() => {
    if (loading || tourCheckedRef.current) return
    tourCheckedRef.current = true
    if (localStorage.getItem("tour_analyses_v1") !== "1") {
      const t = setTimeout(() => setShowTour(true), 800)
      return () => clearTimeout(t)
    }
  }, [loading])

  // Auto-generate briefing once snapshot is loaded
  useEffect(() => {
    if (snapshot && regime && !aiBriefing && !loadingBriefing) {
      generateBriefing(snapshot, regime)
    }
  }, [snapshot, regime]) // eslint-disable-line react-hooks/exhaustive-deps

  // Intersection observer for active section
  useEffect(() => {
    if (loading) return
    const mainEl = document.getElementById("macro-main")
    if (!mainEl) return

    observerRef.current?.disconnect()
    observerRef.current = new IntersectionObserver(
      entries => {
        entries.forEach(e => {
          if (e.isIntersecting) {
            setActiveSection(e.target.id.replace("section-", ""))
          }
        })
      },
      { root: mainEl, threshold: 0.15, rootMargin: "-20px 0px -55% 0px" }
    )
    document.querySelectorAll("[id^='section-']").forEach(el => observerRef.current?.observe(el))
    return () => observerRef.current?.disconnect()
  }, [loading])

  function scrollToSection(id: string) {
    const el = document.getElementById(`section-${id}`)
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" })
    setActiveSection(id)
  }

  // Helper: snapshot group → MarketRow[]
  function toRows(group: Record<string, AssetData> | undefined): MarketRow[] {
    if (!group) return []
    return Object.entries(group).map(([key, data]) => ({ ...data, key }))
  }

  // ── RENDER ─────────────────────────────────────────────────────────────────

  return (
    <div
      className="flex flex-col overflow-hidden"
      style={{ height: "calc(100vh - var(--topbar-h, 56px))", background: "var(--bg-canvas)" }}
    >

      {/* ═══════════════════════════════════════════════════════
          TICKER TAPE — top, full width, flex-shrink-0
      ═══════════════════════════════════════════════════════ */}
      <div className="flex-shrink-0 ticker-wrap overflow-hidden"
        style={{
          background:    "rgba(5,5,5,0.97)",
          backdropFilter:"blur(20px)",
          borderBottom:  "1px solid rgba(255,255,255,0.05)",
        }}>
        <div className="animate-ticker flex gap-10 py-2 px-4 whitespace-nowrap">
          {[...tickerItems, ...tickerItems].map((item, i) => (
            <span key={i} className="flex items-center gap-2 text-[11px] flex-shrink-0">
              <span className="font-mono font-bold" style={{ color: "rgba(255,255,255,0.35)" }}>
                {(item as AssetData & { key?: string }).label?.replace("ETF", "").trim() ?? ""}
              </span>
              <span className="text-white font-bold tabular-nums">{fmtPrice(item.price)}</span>
              <span className={`font-bold tabular-nums ${(item.change_1d ?? 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
                {(item.change_1d ?? 0) >= 0 ? "▲" : "▼"}{Math.abs(item.change_1d ?? 0).toFixed(2)}%
              </span>
            </span>
          ))}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          TAB BAR — sections nav, full width, flex-shrink-0
      ═══════════════════════════════════════════════════════ */}
      <div data-tour="analyses-tabs" className="flex-shrink-0 overflow-x-auto scrollbar-hide"
        style={{
          background:  "rgba(8,8,8,0.98)",
          borderBottom:"1px solid rgba(255,255,255,0.06)",
        }}>
        <div className="flex items-center min-w-max px-2">
          {NAV_SECTIONS.map(s => (
            <button key={s.id}
              onClick={() => scrollToSection(s.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold transition-all whitespace-nowrap relative flex-shrink-0 ${
                activeSection === s.id ? "text-white" : "text-white/30 hover:text-white/60"
              }`}>
              <span className="text-sm leading-none">{s.icon}</span>
              <span>{s.label}</span>
              {/* Active underline */}
              {activeSection === s.id && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full"
                  style={{ background: "var(--green, #22c55e)" }} />
              )}
            </button>
          ))}

          {/* Timestamp + refresh pushed to the right */}
          <div className="flex items-center gap-2 ml-4 pl-4 pr-3 flex-shrink-0"
            style={{ borderLeft: "1px solid rgba(255,255,255,0.06)" }}>
            <span className="live-dot" style={{ width: 6, height: 6 }} />
            <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.25)" }}>
              {lastUpdate?.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) ?? "—"}
            </span>
            <button onClick={loadAllData} disabled={loading} title="Refresh"
              className={`text-white/25 hover:text-white transition disabled:opacity-40 text-sm ml-1 ${loading ? "animate-spin" : ""}`}>
              ↻
            </button>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          MAIN — scrollable content, full width
      ═══════════════════════════════════════════════════════ */}
      <main className="flex-1 overflow-y-auto scrollbar-hide" id="macro-main">

        {/* SECTIONS */}
        <div className="px-4 md:px-6 py-6 space-y-12 max-w-5xl mx-auto">

          {/* ─────────────────────────────────────────
              SECTION 1 — Snapshot Macro
          ───────────────────────────────────────── */}
          <section id="section-snapshot" data-tour="snapshot-section" className="scroll-mt-12">
            <SectionHeader icon="🌡️" title="Snapshot Macro" />

            <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-4 mb-5">

              {/* Régime */}
              <div className="rounded-2xl p-5 flex flex-col justify-between"
                style={{
                  background: regime ? REGIME_CONFIG[regime].bg : "rgba(255,255,255,0.03)",
                  border: `1px solid ${regime ? REGIME_CONFIG[regime].color + "20" : "rgba(255,255,255,0.06)"}`,
                }}>
                <div>
                  <p className="text-[9px] text-white/25 uppercase tracking-widest mb-3">Current Regime</p>
                  <p className="text-4xl mb-2">{regime ? REGIME_CONFIG[regime].emoji : "—"}</p>
                  <p className="text-lg font-black text-white mb-1">{regime ? REGIME_CONFIG[regime].label : "Loading…"}</p>
                </div>
                <div className="mt-4 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-white/25 mb-0.5">VIX</p>
                      <p className="font-black text-white">{vix.toFixed(1)}</p>
                    </div>
                    <div>
                      <p className="text-white/25 mb-0.5">10Y-3M Spread</p>
                      <p className={`font-black ${(yieldCurve ?? 0) < 0 ? "text-red-400" : "text-green-400"}`}>
                        {yieldCurve != null ? `${yieldCurve >= 0 ? "+" : ""}${yieldCurve.toFixed(2)}%` : "—"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Briefing IA */}
              <div data-tour="briefing-ia" className="rounded-2xl p-5"
                style={{ background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.15)" }}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm">🤖</span>
                  <p className="text-[10px] text-purple-400/60 uppercase tracking-widest font-bold">
                    AI Briefing — Daily Verdict
                  </p>
                  <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full ml-auto"
                    style={{ background: "rgba(139,92,246,0.15)", color: "#a78bfa" }}>Groq</span>
                </div>
                {loadingBriefing ? (
                  <div className="space-y-2">
                    {[90, 75, 55].map(w => (
                      <div key={w} className="h-3 skeleton rounded" style={{ width: `${w}%` }} />
                    ))}
                  </div>
                ) : aiBriefing ? (
                  <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.75)" }}>{aiBriefing}</p>
                ) : (
                  <button onClick={() => regime && snapshot && generateBriefing(snapshot, regime)}
                    className="text-sm text-purple-400 hover:text-purple-300 transition">
                    Generate today&apos;s briefing →
                  </button>
                )}
              </div>
            </div>

            {/* 4 KPI cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                {
                  label:  "📈 S&P 500",
                  value:  spy?.price ? `$${spy.price.toFixed(0)}` : "—",
                  change: spy?.change1d,
                  sub:    `YTD ${snapshot?.indices?.SPY?.change_ytd != null ? `${snapshot.indices.SPY.change_ytd >= 0 ? "+" : ""}${snapshot.indices.SPY.change_ytd.toFixed(1)}%` : "—"}`,
                  color:  (spy?.change1d ?? 0) >= 0 ? "#4ade80" : "#f87171",
                  bg:     (spy?.change1d ?? 0) >= 0 ? "rgba(34,197,94,0.07)"  : "rgba(239,68,68,0.07)",
                  border: (spy?.change1d ?? 0) >= 0 ? "rgba(34,197,94,0.15)"  : "rgba(239,68,68,0.15)",
                },
                {
                  label:  "😨 VIX",
                  value:  vix.toFixed(1),
                  change: null,
                  sub:    vix > 25 ? "🔴 Stress" : vix > 18 ? "🟡 Nervous" : "🟢 Risk-on",
                  color:  vix > 25 ? "#f87171" : vix > 18 ? "#fbbf24" : "#4ade80",
                  bg:     vix > 25 ? "rgba(239,68,68,0.07)" : vix > 18 ? "rgba(251,191,36,0.07)" : "rgba(34,197,94,0.07)",
                  border: vix > 25 ? "rgba(239,68,68,0.15)" : vix > 18 ? "rgba(251,191,36,0.15)" : "rgba(34,197,94,0.15)",
                },
                {
                  label:  "💸 Fed Rate",
                  value:  `${fedRate.toFixed(2)}%`,
                  change: null,
                  sub:    fedRate > 4 ? "🔴 Restrictive" : fedRate > 2 ? "🟡 Neutral" : "🟢 Accommodative",
                  color:  fedRate > 4 ? "#f87171" : fedRate > 2 ? "#fbbf24" : "#4ade80",
                  bg:     fedRate > 4 ? "rgba(239,68,68,0.07)" : "rgba(251,191,36,0.07)",
                  border: fedRate > 4 ? "rgba(239,68,68,0.15)" : "rgba(251,191,36,0.15)",
                },
                {
                  label:  "🥇 Gold",
                  value:  snapshot?.gold?.price ? `$${snapshot.gold.price.toFixed(0)}` : "—",
                  change: snapshot?.gold?.change1d,
                  sub:    `1M ${snapshot?.commodities?.GLD?.change_1m != null ? `${snapshot.commodities.GLD.change_1m >= 0 ? "+" : ""}${snapshot.commodities.GLD.change_1m.toFixed(1)}%` : "—"}`,
                  color:  (snapshot?.gold?.change1d ?? 0) >= 0 ? "#fbbf24" : "#9ca3af",
                  bg:     "rgba(251,191,36,0.07)",
                  border: "rgba(251,191,36,0.15)",
                },
              ].map(kpi => (
                <div key={kpi.label} className="rounded-2xl p-4"
                  style={{ background: kpi.bg, border: `1px solid ${kpi.border}` }}>
                  <p className="text-[10px] text-white/35 mb-2 font-bold">{kpi.label}</p>
                  <p className="text-2xl font-black tabular-nums" style={{ color: kpi.color }}>{kpi.value}</p>
                  {kpi.change != null && (
                    <p className={`text-xs font-bold tabular-nums mt-0.5 ${kpi.change >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {kpi.change >= 0 ? "+" : ""}{kpi.change.toFixed(2)}% today
                    </p>
                  )}
                  <p className="text-[10px] text-white/30 mt-1">{kpi.sub}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ─────────────────────────────────────────
              SECTION 2 — Marchés
          ───────────────────────────────────────── */}
          <section id="section-marches" className="scroll-mt-12">
            <SectionHeader icon="📈" title="Markets"
              badge={lastUpdate?.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })} />

            <div data-tour="market-table">
            <p className="text-[10px] text-white/25 uppercase tracking-widest font-bold mb-2 px-0.5">
              Indices — US & World
            </p>
            {loading ? <SkeletonTable /> : <MarketTable rows={toRows(snapshot?.indices)} />}
            </div>

            <p className="text-[10px] text-white/25 uppercase tracking-widest font-bold mb-2 mt-5 px-0.5">
              US Sectors (ETF)
            </p>
            {loading ? <SkeletonTable /> : <MarketTable rows={toRows(snapshot?.sectors)} />}
          </section>

          {/* ─────────────────────────────────────────
              SECTION 3 — Inflation & Taux
          ───────────────────────────────────────── */}
          <section id="section-inflation" className="scroll-mt-12">
            <SectionHeader icon="🔥" title="Inflation & Rates" badge="Fed + ECB" />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">

              {/* USA */}
              <div className="rounded-2xl overflow-hidden"
                style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
                <div className="px-5 py-3 flex items-center gap-2"
                  style={{ background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <span>🇺🇸</span>
                  <p className="text-xs font-black text-white">United States — Federal Reserve</p>
                </div>
                <div>
                  {[
                    { label: "CPI (Inflation)",      value: "3.2%",                           prev: "3.4%",  target: "2.0%", status: "elevated",   trend: "down", note: "↘ Falling, above Fed target" },
                    { label: "Core CPI",             value: "3.8%",                           prev: "3.9%",  target: "2.0%", status: "high",       trend: "down", note: "Sticky — main concern" },
                    { label: "PPI",                  value: "2.4%",                           prev: "2.7%",  target: "—",   status: "normal",     trend: "down", note: "Leading inflation indicator" },
                    { label: "Fed Funds Rate",       value: `${fedRate.toFixed(2)}%`,         prev: "5.25%", target: "2.5%",status: "restrictive", trend:"flat",  note: "Highest rate since 2007" },
                    { label: "Real Rate (Fed-CPI)",  value: `${(fedRate - 3.2).toFixed(2)}%`, prev: "—",     target: "> 0%",status: "positive",   trend: "up",   note: "Positive = truly restrictive policy" },
                  ].map(row => {
                    const sColor: Record<string, string> = {
                      elevated: "#f59e0b", high: "#ef4444", normal: "#4ade80",
                      restrictive: "#f87171", positive: "#4ade80",
                    }
                    const c     = sColor[row.status] ?? "#9ca3af"
                    const tIcon = row.trend === "up" ? "↑" : row.trend === "down" ? "↓" : "→"
                    const tColor= row.trend === "down" && row.label.includes("CPI") ? "#4ade80"
                      : row.trend === "up" && row.label === "Real Rate (Fed-CPI)" ? "#4ade80"
                      : row.trend === "up" ? "#f87171" : "#9ca3af"
                    return (
                      <div key={row.label} className="px-5 py-3 hover:bg-white/[0.01] transition"
                        style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <p className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.65)" }}>
                              {row.label}
                            </p>
                            <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>
                              {row.note}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="flex items-center gap-1.5 justify-end">
                              <span className="text-[10px] font-bold" style={{ color: tColor }}>{tIcon}</span>
                              <span className="text-base font-black" style={{ color: c }}>{row.value}</span>
                            </div>
                            <div className="flex items-center gap-2 justify-end mt-0.5">
                              {row.prev !== "—" && (
                                <span className="text-[9px] text-white/20">Prev. {row.prev}</span>
                              )}
                              <span className="text-[9px] font-bold text-white/25">Target {row.target}</span>
                            </div>
                          </div>
                        </div>
                        {row.target !== "—" && row.target !== "> 0%" && (
                          <div className="mt-2">
                            <div className="h-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.05)" }}>
                              <div className="h-full rounded-full"
                                style={{
                                  width: `${Math.min(100, (parseFloat(row.value) / parseFloat(row.target)) * 50)}%`,
                                  background: c,
                                }} />
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Europe */}
              <div className="rounded-2xl overflow-hidden"
                style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
                <div className="px-5 py-3 flex items-center gap-2"
                  style={{ background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <span>🇪🇺</span>
                  <p className="text-xs font-black text-white">Eurozone — ECB</p>
                </div>
                {[
                  { label: "HICP (EU Inflation)",    value: "2.4%",  prev: "2.6%",  trend: "down", note: "Near ECB target"           },
                  { label: "Core Inflation EU",      value: "2.7%",  prev: "2.9%",  trend: "down", note: "Steady decline"            },
                  { label: "ECB Rate (Deposit)",     value: "3.75%", prev: "4.00%", trend: "down", note: "First cut June 2024"       },
                  { label: "Eurozone GDP (Q1)",      value: "+0.3%", prev: "0.0%",  trend: "up",   note: "Out of stagnation"         },
                  { label: "EU Unemployment",        value: "6.0%",  prev: "6.1%",  trend: "down", note: "Historically low level"   },
                ].map(row => {
                  const tIcon = row.trend === "up" ? "↑" : "↓"
                  const tColor = row.trend === "down" && row.label.includes("Inflation") ? "#4ade80"
                    : row.trend === "down" && row.label.includes("Rate") ? "#4ade80"
                    : row.trend === "down" && row.label.includes("Unemployment") ? "#4ade80"
                    : row.trend === "up" ? "#4ade80" : "#9ca3af"
                  return (
                    <div key={row.label} className="px-5 py-3 hover:bg-white/[0.01] transition"
                      style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <p className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.65)" }}>
                            {row.label}
                          </p>
                          <p className="text-[10px] mt-0.5 text-white/30">{row.note}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="flex items-center gap-1.5 justify-end">
                            <span className="text-[10px] font-bold" style={{ color: tColor }}>{tIcon}</span>
                            <span className="text-base font-black text-white">{row.value}</span>
                          </div>
                          <p className="text-[9px] text-white/20 mt-0.5">Prev. {row.prev}</p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Alert */}
            <div className="rounded-xl px-4 py-3 flex items-center gap-3"
              style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.15)" }}>
              <span className="text-lg flex-shrink-0">⚠️</span>
              <p className="text-xs text-yellow-400/80">
                <strong className="text-yellow-400">Watch:</strong> US Core CPI remains sticky at 3.8% —
                the Fed will not cut rates until Core CPI is close to 2.5%.
                Real rate currently{" "}
                <strong className="text-yellow-300">{fedRate > 3.2 ? "positive" : "negative"} at +{(fedRate - 3.2).toFixed(2)}%</strong>,
                monetary policy remains restrictive.
              </p>
            </div>
          </section>

          {/* ─────────────────────────────────────────
              SECTION 4 — Obligations
          ───────────────────────────────────────── */}
          <section id="section-obligations" className="scroll-mt-12">
            <SectionHeader icon="📜" title="Bonds" badge="US Yield Curve" />

            {/* Yield curve visual */}
            {snapshot?.bonds && (
              <div className="rounded-2xl p-5 mb-4"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <p className="text-[10px] text-white/25 uppercase tracking-widest font-bold mb-4">
                  US Curve — {(yieldCurve ?? 0) < 0 ? "🔴 Inverted (recession signal)" : "🟢 Normal"}
                </p>
                <div className="flex items-end gap-4 h-20">
                  {[
                    { key: "IRX", tenor: "3M" },
                    { key: "FVX", tenor: "5Y" },
                    { key: "TNX", tenor: "10Y" },
                    { key: "TYX", tenor: "30Y" },
                  ].map(({ key, tenor }) => {
                    const val    = snapshot.bonds[key]?.price ?? 0
                    const maxVal = 6
                    const h      = Math.max(8, (val / maxVal) * 72)
                    const irx    = snapshot.bonds["IRX"]?.price ?? 0
                    const inv    = val < irx && key !== "IRX"
                    return (
                      <div key={key} className="flex flex-col items-center gap-1 flex-1">
                        <p className="text-xs font-black" style={{ color: inv ? "#f87171" : "#4ade80" }}>
                          {val.toFixed(2)}%
                        </p>
                        <div className="w-full rounded-t-lg transition-all"
                          style={{
                            height: h,
                            background: inv ? "rgba(239,68,68,0.5)" : "rgba(34,197,94,0.4)",
                            border: `1px solid ${inv ? "rgba(239,68,68,0.6)" : "rgba(34,197,94,0.5)"}`,
                          }} />
                        <p className="text-[10px] font-bold text-white/40">{tenor}</p>
                      </div>
                    )
                  })}
                </div>
                {yieldCurve != null && (
                  <div className="mt-4 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                    <p className="text-xs text-white/50">
                      10Y − 3M Spread:{" "}
                      <span className={`font-black ${yieldCurve < 0 ? "text-red-400" : "text-green-400"}`}>
                        {yieldCurve >= 0 ? "+" : ""}{yieldCurve.toFixed(2)}%
                      </span>
                      {yieldCurve < 0 && (
                        <span className="text-red-400/60 ml-2 text-[10px]">
                          — Inverted curve · Historical recession signal 12-18 months
                        </span>
                      )}
                    </p>
                  </div>
                )}
              </div>
            )}

            {loading ? <SkeletonTable /> : <MarketTable rows={toRows(snapshot?.bonds)} isYield />}
          </section>

          {/* ─────────────────────────────────────────
              SECTION 5 — Devises
          ───────────────────────────────────────── */}
          <section id="section-devises" className="scroll-mt-12">
            <SectionHeader icon="💱" title="Currencies" />
            {loading ? <SkeletonTable /> : <MarketTable rows={toRows(snapshot?.currencies)} />}
          </section>

          {/* ─────────────────────────────────────────
              SECTION 6 — Matières premières
          ───────────────────────────────────────── */}
          <section id="section-matieres" className="scroll-mt-12">
            <SectionHeader icon="🥇" title="Commodities" />
            {loading ? <SkeletonTable /> : <MarketTable rows={toRows(snapshot?.commodities)} />}
          </section>

          {/* ─────────────────────────────────────────
              SECTION 7 — Crypto
          ───────────────────────────────────────── */}
          <section id="section-crypto" className="scroll-mt-12">
            <SectionHeader icon="₿" title="Crypto" />
            {loading ? <SkeletonTable /> : <MarketTable rows={toRows(snapshot?.crypto)} />}
          </section>

          {/* ─────────────────────────────────────────
              SECTION 8 — Corrélations
          ───────────────────────────────────────── */}
          <section id="section-correlations" className="scroll-mt-12">
            <SectionHeader icon="⚡" title="Correlations" badge="30-day rolling" />

            {/* Matrix */}
            <div className="rounded-2xl overflow-auto mb-4"
              style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
              <table className="w-full min-w-[400px]">
                <thead>
                  <tr style={{ background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    <th className="px-4 py-3 text-left text-[9px] text-white/25 uppercase tracking-widest">30D</th>
                    {(correlations?.symbols ?? []).map(s => (
                      <th key={s.key} className="px-3 py-3 text-center text-[9px] text-white/40 font-bold">
                        {s.key}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(correlations?.symbols ?? []).map(row => (
                    <tr key={row.key} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <td className="px-4 py-2.5 text-xs font-bold text-white/60">{row.label}</td>
                      {(correlations?.symbols ?? []).map(col => {
                        if (row.key === col.key) return (
                          <td key={col.key} className="px-3 py-2.5 text-center">
                            <span className="text-xs text-white/20">—</span>
                          </td>
                        )
                        const v = correlations?.matrix?.[row.key]?.[col.key] ?? 0
                        const abs = Math.abs(v)
                        const pos = v > 0
                        const opacity = 0.35 + abs * 0.65
                        return (
                          <td key={col.key} className="px-3 py-2.5 text-center">
                            <span className="text-xs font-black tabular-nums"
                              style={{
                                color: abs < 0.15 ? "rgba(255,255,255,0.2)"
                                  : pos
                                    ? `rgba(74,222,128,${opacity})`
                                    : `rgba(248,113,113,${opacity})`,
                              }}>
                              {v >= 0 ? "+" : ""}{v.toFixed(2)}
                            </span>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                  {!correlations && [...Array(6)].map((_, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <td className="px-4 py-2.5"><div className="h-3 skeleton rounded w-16" /></td>
                      {[...Array(6)].map((_, j) => (
                        <td key={j} className="px-3 py-2.5"><div className="h-3 skeleton rounded w-10 mx-auto" /></td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Alert cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                {
                  icon:  "💵",
                  title: "Strong DXY → pressure on Gold & BTC",
                  desc:  `DXY/Gold correlation: ${correlations?.matrix?.DXY?.GLD?.toFixed(2) ?? "-0.82"}`,
                  color: "#f59e0b",
                },
                {
                  icon:  "📜",
                  title: (yieldCurve ?? 0) < 0 ? "Inverted curve → recession risk" : "Healthy curve",
                  desc:  `10Y-3M Spread: ${yieldCurve != null ? `${yieldCurve.toFixed(2)}%` : "—"}`,
                  color: (yieldCurve ?? 0) < 0 ? "#ef4444" : "#4ade80",
                },
                {
                  icon:  "😨",
                  title: vix > 25 ? "High VIX → risk-off" : vix > 18 ? "Moderate VIX" : "Low VIX → risk-on",
                  desc:  `Current VIX: ${vix.toFixed(1)}`,
                  color: vix > 25 ? "#ef4444" : vix > 18 ? "#fbbf24" : "#4ade80",
                },
              ].map(alert => (
                <div key={alert.title} className="rounded-xl px-4 py-3 flex items-center gap-3"
                  style={{ background: `${alert.color}08`, border: `1px solid ${alert.color}20` }}>
                  <span className="text-lg flex-shrink-0">{alert.icon}</span>
                  <div>
                    <p className="text-xs font-bold text-white">{alert.title}</p>
                    <p className="text-[10px] mt-0.5" style={{ color: alert.color }}>{alert.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ─────────────────────────────────────────
              SECTION 9 — Géopolitique & News
          ───────────────────────────────────────── */}
          <section id="section-geopolitique" className="scroll-mt-12">
            <SectionHeader icon="🌍" title="Geopolitics & Macro News" />

            {macroNews.length === 0 ? (
              <div className="space-y-2">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="flex items-center gap-4 px-5 py-3.5 rounded-xl"
                    style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                    <div className="h-5 skeleton rounded w-20 flex-shrink-0" />
                    <div className="flex-1 h-3 skeleton rounded" />
                    <div className="h-3 skeleton rounded w-12 flex-shrink-0" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {macroNews.map((article, i) => {
                  const hoursAgo = Math.round(
                    (Date.now() - new Date(article.published_at).getTime()) / 3_600_000
                  )
                  const themeConf: Record<string, { color: string; label: string }> = {
                    fed:         { color: "#60a5fa", label: "🏦 FED" },
                    bce:         { color: "#60a5fa", label: "🏦 ECB" },
                    inflation:   { color: "#f59e0b", label: "🔥 Inflation" },
                    recession:   { color: "#ef4444", label: "❄️ Recession" },
                    geopolitique:{ color: "#a78bfa", label: "🌍 Geopolitics" },
                    energie:     { color: "#f97316", label: "⚡ Energy" },
                    devises:     { color: "#22c55e", label: "💱 Currencies" },
                    macro:       { color: "#9ca3af", label: "📊 Macro" },
                  }
                  const theme = themeConf[article.theme ?? article.category ?? "macro"] ?? themeConf.macro
                  return (
                    <a key={i} href={article.url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-4 px-5 py-3 rounded-xl transition-all hover:bg-white/[0.03] group"
                      style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                      <span className="text-[9px] font-black px-2 py-1 rounded-full flex-shrink-0 w-[88px] text-center"
                        style={{ background: `${theme.color}12`, color: theme.color, border: `1px solid ${theme.color}20` }}>
                        {theme.label}
                      </span>
                      <p className="flex-1 text-xs text-white/55 group-hover:text-white/80 transition-colors line-clamp-1">
                        {article.title}
                      </p>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-[10px] text-white/20">{article.source?.split(":")[0]}</span>
                        <span className="text-[10px] text-white/15">
                          {hoursAgo < 1 ? "< 1h" : `${hoursAgo}h`}
                        </span>
                      </div>
                      <span className="text-white/20 group-hover:text-white/50 transition flex-shrink-0 text-xs">↗</span>
                    </a>
                  )
                })}
              </div>
            )}
          </section>

          {/* ─────────────────────────────────────────
              SECTION 10 — Calendrier économique
          ───────────────────────────────────────── */}
          <section id="section-calendrier" className="scroll-mt-12 pb-8">
            <SectionHeader icon="📅" title="Economic Calendar" />

            {[
              {
                period: "This week",
                events: [
                  { date: "Thu Jun 13", time: "8:30 AM", flag: "🇺🇸", name: "US CPI (May)",              impact: "critical", prev: "3.4%",  expected: "3.3%",  desc: "Inflation indicator — direct impact on Fed decisions" },
                  { date: "Fri Jun 14", time: "8:30 AM", flag: "🇺🇸", name: "NFP (Non-farm payrolls)",   impact: "high",     prev: "175k",  expected: "185k",  desc: "US labor market health" },
                ],
              },
              {
                period: "Next week",
                events: [
                  { date: "Tue Jun 18", time: "5:00 AM", flag: "🇪🇺", name: "Eurozone GDP (Q1 final)",  impact: "medium",   prev: "+0.3%", expected: "+0.3%", desc: "" },
                  { date: "Thu Jun 20", time: "8:15 AM", flag: "🇬🇧", name: "BoE Rate Decision",         impact: "high",     prev: "5.25%", expected: "5.25%", desc: "Bank of England — hold expected" },
                  { date: "Fri Jun 21", time: "3:15 AM", flag: "🇪🇺", name: "Flash PMI EU + US",         impact: "medium",   prev: "—",     expected: "—",     desc: "Mfg + services eco. activity" },
                ],
              },
            ].map(group => {
              const impactConf = {
                critical: { color: "#ef4444", bg: "rgba(239,68,68,0.1)", label: "CRITICAL", dot: "🔴" },
                high:     { color: "#f97316", bg: "rgba(249,115,22,0.1)", label: "HIGH",     dot: "🟠" },
                medium:   { color: "#f59e0b", bg: "rgba(245,158,11,0.1)", label: "MEDIUM",   dot: "🟡" },
                low:      { color: "#9ca3af", bg: "rgba(156,163,175,0.1)", label: "LOW",     dot: "⚪" },
              }
              return (
                <div key={group.period} className="mb-5">
                  <p className="text-[10px] text-white/25 uppercase tracking-widest font-bold mb-3 px-0.5">
                    {group.period}
                  </p>
                  <div className="space-y-2">
                    {group.events.map((ev, idx) => {
                      const ic = impactConf[ev.impact as keyof typeof impactConf] ?? impactConf.medium
                      const isFirst = idx === 0 && group.period === "This week"
                      return (
                        <div key={idx} className="flex items-center gap-3 md:gap-4 px-4 md:px-5 py-4 rounded-2xl flex-wrap"
                          style={{
                            background: "rgba(255,255,255,0.02)",
                            border: `1px solid ${isFirst ? ic.color + "25" : "rgba(255,255,255,0.06)"}`,
                          }}>
                          <span className="text-sm flex-shrink-0">{ic.dot}</span>
                          <div className="flex-shrink-0 w-28">
                            <p className="text-[11px] font-bold text-white/70">{ev.date}</p>
                            <p className="text-[10px] text-white/30">{ev.time} ET</p>
                          </div>
                          <div className="flex items-center gap-2 flex-1 min-w-[140px]">
                            <span className="text-base flex-shrink-0">{ev.flag}</span>
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-white truncate">{ev.name}</p>
                              {ev.desc && <p className="text-[10px] text-white/30 truncate">{ev.desc}</p>}
                            </div>
                          </div>
                          <div className="flex items-center gap-4 flex-shrink-0">
                            <div className="text-center">
                              <p className="text-[9px] text-white/20 mb-0.5">Previous</p>
                              <p className="text-xs font-bold text-white/50">{ev.prev}</p>
                            </div>
                            <div className="text-center">
                              <p className="text-[9px] text-white/20 mb-0.5">Expected</p>
                              <p className="text-xs font-bold text-white">{ev.expected}</p>
                            </div>
                          </div>
                          <span className="text-[9px] font-black px-2 py-1 rounded-full flex-shrink-0"
                            style={{ background: ic.bg, color: ic.color }}>
                            {ic.label}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </section>

        </div>
      </main>

      {/* ── Guided tour ── */}
      {showTour && (
        <Tour
          steps={ANALYSES_TOUR_STEPS}
          storageKey="tour_analyses_v1"
          onComplete={() => setShowTour(false)}
        />
      )}
    </div>
  )
}
