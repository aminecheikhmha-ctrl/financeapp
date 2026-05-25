"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend, CartesianGrid,
} from "recharts"

type Period = "1M" | "3M" | "6M" | "1Y" | "ALL"
type Section = "performance" | "assets" | "sectors" | "comportement"

type ReportData = {
  period: string
  portfolioValue: number
  totalPnl: number
  totalPnlPct: number
  totalTrades: number
  closedTrades: number
  winRate: number
  profitFactor: number
  avgRR: number
  sharpe: number
  sortino: number
  maxDrawdown: number
  annualizedVol: number
  bestTrade: { symbol: string; pnlPct: number; date: string } | null
  worstTrade: { symbol: string; pnlPct: number; date: string } | null
  avgWinDuration: number
  avgLossDuration: number
  perAsset: { symbol: string; trades: number; winRate: number; pnl: number; bestTradePct: number; worstTradePct: number }[]
  perSector: { sector: string; pnl: number }[]
  heatmapData: { day: number; hour: number; pnl: number; count: number }[]
  returnDistribution: { range: string; count: number }[]
  benchmarkCurve: { date: string; portfolio: number; spy: number }[]
  dailySnapshots: { date: string; portfolio_value: number; daily_pnl: number; daily_pnl_pct: number }[]
  cached?: boolean
}

const DAYS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"]
const SECTOR_COLORS = ["#4ade80", "#60a5fa", "#f472b6", "#facc15", "#a78bfa", "#fb923c"]

const KPI_TOOLTIPS: Record<string, string> = {
  sharpe: "Sharpe Ratio : rendement ajusté au risque. > 1 = bon, > 2 = très bon, > 3 = excellent.",
  sortino: "Sortino Ratio : comme Sharpe mais ne pénalise que la volatilité baissière.",
  maxDrawdown: "Max Drawdown : perte maximale pic-à-creux. Plus c'est bas, mieux c'est.",
  winRate: "Win Rate : % de trades gagnants. > 50% est bien, mais le profit factor compte autant.",
  profitFactor: "Profit Factor : gains bruts / pertes brutes. > 1.5 = bon, > 2 = excellent.",
  avgRR: "Risk/Reward moyen : combien tu gagnes en moyenne vs ce que tu risques.",
  volatility: "Volatilité annualisée : écart-type des rendements quotidiens × √252.",
}

function KPICard({ label, value, suffix = "", tooltip, color = "text-white" }: {
  label: string; value: string | number; suffix?: string; tooltip?: string; color?: string
}) {
  const [showTip, setShowTip] = useState(false)
  return (
    <div className="bg-[#111] border border-white/5 rounded-2xl p-4 relative">
      <div className="flex items-center gap-1.5 mb-2">
        <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide">{label}</p>
        {tooltip && (
          <button
            onMouseEnter={() => setShowTip(true)}
            onMouseLeave={() => setShowTip(false)}
            className="w-4 h-4 rounded-full bg-white/10 text-gray-400 text-[9px] font-black flex items-center justify-center flex-shrink-0"
          >?</button>
        )}
      </div>
      {showTip && tooltip && (
        <div className="absolute bottom-full left-0 mb-2 z-20 bg-[#1a1a1a] border border-white/10 rounded-xl p-3 text-xs text-gray-300 w-56 shadow-xl">
          {tooltip}
        </div>
      )}
      <p className={`text-2xl font-black ${color}`}>{value}<span className="text-gray-500 text-sm ml-1">{suffix}</span></p>
    </div>
  )
}

function CalendarHeatmap({ data }: { data: ReportData["dailySnapshots"] }) {
  const today = new Date()
  const cells: { date: string; pnl: number | null }[] = []
  for (let i = 34; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000)
    const dateStr = d.toISOString().slice(0, 10)
    const snap = data.find(s => s.date === dateStr)
    cells.push({ date: dateStr, pnl: snap?.daily_pnl ?? null })
  }
  return (
    <div>
      <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-3">Calendrier de performance (35 derniers jours)</p>
      <div className="flex flex-wrap gap-1">
        {cells.map((c, i) => {
          let bg = "bg-white/5"
          if (c.pnl !== null) bg = c.pnl > 0 ? "bg-green-500/60" : c.pnl < 0 ? "bg-red-500/60" : "bg-white/10"
          return (
            <div key={i} title={`${c.date}: ${c.pnl !== null ? (c.pnl >= 0 ? "+" : "") + c.pnl.toFixed(0) + "$" : "Pas de données"}`}
              className={`w-6 h-6 rounded-sm ${bg} cursor-default`} />
          )
        })}
      </div>
      <div className="flex gap-3 mt-2">
        <span className="flex items-center gap-1 text-[10px] text-gray-600"><span className="w-3 h-3 rounded-sm bg-green-500/60 inline-block" /> Profitable</span>
        <span className="flex items-center gap-1 text-[10px] text-gray-600"><span className="w-3 h-3 rounded-sm bg-red-500/60 inline-block" /> En perte</span>
        <span className="flex items-center gap-1 text-[10px] text-gray-600"><span className="w-3 h-3 rounded-sm bg-white/5 inline-block" /> Pas de trade</span>
      </div>
    </div>
  )
}

function TradeHeatmap({ data }: { data: ReportData["heatmapData"] }) {
  const hours = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]
  const days = [1, 2, 3, 4, 5]
  const getCell = (day: number, hour: number) => data.find(d => d.day === day && d.hour === hour)
  const maxAbs = Math.max(...data.map(d => Math.abs(d.pnl)), 1)
  return (
    <div className="overflow-x-auto">
      <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-3">Quand tu trades le mieux (jour × heure)</p>
      <div className="min-w-[400px]">
        <div className="grid gap-1" style={{ gridTemplateColumns: `40px repeat(${hours.length}, 1fr)` }}>
          <div />
          {hours.map(h => <div key={h} className="text-center text-[9px] text-gray-600">{h}h</div>)}
          {days.map(day => (
            <>
              <div key={`d${day}`} className="text-[10px] text-gray-500 flex items-center">{DAYS[day]}</div>
              {hours.map(hour => {
                const cell = getCell(day, hour)
                const intensity = cell ? Math.abs(cell.pnl) / maxAbs : 0
                const isPositive = (cell?.pnl ?? 0) >= 0
                const alpha = cell ? Math.max(0.1, intensity * 0.8) : 0.05
                const bg = cell
                  ? isPositive ? `rgba(74,222,128,${alpha})` : `rgba(248,113,113,${alpha})`
                  : "rgba(255,255,255,0.03)"
                return (
                  <div key={`${day}-${hour}`} className="h-6 rounded-sm cursor-default" style={{ background: bg }}
                    title={cell ? `${DAYS[day]} ${hour}h: ${cell.pnl >= 0 ? "+" : ""}${cell.pnl.toFixed(0)}$ (${cell.count} trades)` : "Pas de données"} />
                )
              })}
            </>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function ReportsPage() {
  const router = useRouter()
  const reportRef = useRef<HTMLDivElement>(null)

  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<Period>("3M")
  const [report, setReport] = useState<ReportData | null>(null)
  const [section, setSection] = useState<Section>("performance")
  const [pdfLoading, setPdfLoading] = useState(false)
  const [csvLoading, setCsvLoading] = useState(false)
  const [token, setToken] = useState<string | null>(null)

  const fetchReport = useCallback(async (p: Period, tok: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/reports/portfolio?period=${p}`, {
        headers: { Authorization: `Bearer ${tok}` },
      })
      const data = await res.json()
      setReport(data)
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/login"); return }
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return
      setToken(session.access_token)
      await fetchReport(period, session.access_token)
    }
    init()
  }, [])

  useEffect(() => {
    if (token) fetchReport(period, token)
  }, [period, token, fetchReport])

  async function handleCSV() {
    if (!token) return
    setCsvLoading(true)
    try {
      const res = await fetch(`/api/reports/tax?format=csv&year=${new Date().getFullYear()}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `tradex-trades-${new Date().getFullYear()}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch {}
    setCsvLoading(false)
  }

  async function handlePDF() {
    if (!reportRef.current || !report) return
    setPdfLoading(true)
    try {
      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
        import("jspdf"),
        import("html2canvas"),
      ])
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
      const pageW = pdf.internal.pageSize.getWidth()
      const pageH = pdf.internal.pageSize.getHeight()

      // Page 1 — KPIs
      pdf.setFillColor(8, 8, 8)
      pdf.rect(0, 0, pageW, pageH, "F")
      pdf.setFillColor(74, 222, 128)
      pdf.roundedRect(14, 14, 10, 10, 2, 2, "F")
      pdf.setTextColor(255, 255, 255)
      pdf.setFontSize(18)
      pdf.setFont("helvetica", "bold")
      pdf.text("TradEx", 28, 22)
      pdf.setFontSize(11)
      pdf.setTextColor(150, 150, 150)
      pdf.text(`Rapport de performance — Période ${report.period}`, 14, 32)
      pdf.text(`Généré le ${new Date().toLocaleDateString("fr-FR")}`, 14, 38)

      const kpis = [
        { label: "Portfolio", value: `$${report.portfolioValue.toLocaleString("en-US", { maximumFractionDigits: 0 })}` },
        { label: "P&L Total", value: `${report.totalPnlPct >= 0 ? "+" : ""}${report.totalPnlPct.toFixed(2)}%` },
        { label: "Win Rate", value: `${report.winRate}%` },
        { label: "Profit Factor", value: String(report.profitFactor) },
        { label: "Sharpe Ratio", value: String(report.sharpe) },
        { label: "Max Drawdown", value: `-${report.maxDrawdown}%` },
        { label: "Trades fermés", value: String(report.closedTrades) },
        { label: "R/R Moyen", value: String(report.avgRR) },
      ]
      let yPos = 50
      kpis.forEach((kpi, i) => {
        const col = i % 2
        const x = col === 0 ? 14 : 110
        if (i % 2 === 0 && i > 0) yPos += 22
        pdf.setFillColor(17, 17, 17)
        pdf.roundedRect(x, yPos, 90, 18, 2, 2, "F")
        pdf.setTextColor(150, 150, 150)
        pdf.setFontSize(8)
        pdf.text(kpi.label.toUpperCase(), x + 4, yPos + 6)
        if (kpi.value.startsWith("+")) pdf.setTextColor(74, 222, 128)
        else if (kpi.value.startsWith("-")) pdf.setTextColor(248, 113, 113)
        else pdf.setTextColor(255, 255, 255)
        pdf.setFontSize(13)
        pdf.setFont("helvetica", "bold")
        pdf.text(kpi.value, x + 4, yPos + 14)
        pdf.setFont("helvetica", "normal")
      })

      // Page 2 — screenshot
      pdf.addPage()
      pdf.setFillColor(8, 8, 8)
      pdf.rect(0, 0, pageW, pageH, "F")
      pdf.setTextColor(255, 255, 255)
      pdf.setFontSize(14)
      pdf.setFont("helvetica", "bold")
      pdf.text("Analyse détaillée", 14, 20)
      const canvas = await html2canvas(reportRef.current, {
        scale: 1, backgroundColor: "#080808", useCORS: true, logging: false,
      })
      const imgData = canvas.toDataURL("image/jpeg", 0.8)
      const imgW = pageW - 28
      const imgH = (canvas.height / canvas.width) * imgW
      pdf.addImage(imgData, "JPEG", 14, 26, imgW, Math.min(imgH, pageH - 30))

      pdf.save(`tradex-rapport-${report.period.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.pdf`)
    } catch {}
    setPdfLoading(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0a0a0a]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-green-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Calcul du rapport...</p>
        </div>
      </div>
    )
  }

  if (!report) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0a0a0a]">
        <p className="text-gray-500 text-sm">Impossible de charger le rapport.</p>
      </div>
    )
  }

  const pnlColor = report.totalPnlPct >= 0 ? "text-green-400" : "text-red-400"
  const PERIODS: Period[] = ["1M", "3M", "6M", "1Y", "ALL"]
  const SECTIONS = [
    { key: "performance" as Section, label: "📊 Performance" },
    { key: "assets" as Section, label: "📈 Par actif" },
    { key: "sectors" as Section, label: "🌍 Secteurs" },
    { key: "comportement" as Section, label: "🧠 Comportement" },
  ]

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white pb-20 overflow-x-hidden">
      <div className="max-w-4xl mx-auto px-4 pt-6 md:pt-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-white">📊 Rapports</h1>
            <p className="text-gray-500 text-sm mt-1">Analyse professionnelle de tes performances</p>
          </div>
          <div className="flex gap-2">
            <button onClick={handleCSV} disabled={csvLoading}
              className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold text-white transition disabled:opacity-50">
              {csvLoading ? "Export..." : "📊 Exporter CSV"}
            </button>
            <button onClick={handlePDF} disabled={pdfLoading}
              className="flex items-center gap-1.5 px-3 py-2 bg-green-500/15 hover:bg-green-500/25 border border-green-500/30 rounded-xl text-xs font-bold text-green-400 transition disabled:opacity-50">
              {pdfLoading ? "Génération..." : "📄 Exporter PDF"}
            </button>
          </div>
        </div>

        {/* Period selector */}
        <div className="flex gap-1 bg-[#111] border border-white/5 rounded-xl p-1 mb-6 w-fit">
          {PERIODS.map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${period === p ? "bg-green-500/15 text-green-400" : "text-gray-500 hover:text-white"}`}>
              {p}
            </button>
          ))}
        </div>

        {/* Hero strip */}
        <div className="bg-[#111] border border-white/5 rounded-2xl p-5 mb-6">
          <div className="flex items-start gap-6 flex-wrap">
            <div>
              <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-1">Portfolio</p>
              <p className="text-3xl font-black text-white">
                ${report.portfolioValue.toLocaleString("en-US", { maximumFractionDigits: 0 })}
              </p>
            </div>
            <div className="h-12 w-px bg-white/5 hidden sm:block self-center" />
            <div>
              <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-1">P&L Total</p>
              <p className={`text-3xl font-black ${pnlColor}`}>
                {report.totalPnlPct >= 0 ? "+" : ""}{report.totalPnlPct.toFixed(2)}%
              </p>
              <p className={`text-sm font-bold ${pnlColor}`}>
                {report.totalPnl >= 0 ? "+" : ""}${Math.abs(report.totalPnl).toLocaleString("en-US", { maximumFractionDigits: 0 })}
              </p>
            </div>
            <div className="h-12 w-px bg-white/5 hidden sm:block self-center" />
            <div className="flex gap-5 flex-wrap">
              {[
                { v: report.totalTrades, l: "Ordres" },
                { v: `${report.winRate}%`, l: "Win Rate" },
                { v: report.profitFactor, l: "Profit Factor" },
                { v: report.closedTrades, l: "Trades fermés" },
              ].map(({ v, l }) => (
                <div key={l} className="text-center">
                  <p className="text-white font-black text-lg">{v}</p>
                  <p className="text-gray-600 text-xs">{l}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Section tabs */}
        <div className="flex gap-1 bg-[#111] border border-white/5 rounded-xl p-1 mb-6 overflow-x-auto scrollbar-hide">
          {SECTIONS.map(s => (
            <button key={s.key} onClick={() => setSection(s.key)}
              className={`flex-1 flex-shrink-0 whitespace-nowrap py-2 rounded-lg text-xs font-bold transition ${section === s.key ? "bg-green-500/15 text-green-400" : "text-gray-500 hover:text-white"}`}>
              {s.label}
            </button>
          ))}
        </div>

        <div ref={reportRef}>

          {/* ── PERFORMANCE ── */}
          {section === "performance" && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KPICard label="Sharpe Ratio" value={report.sharpe} tooltip={KPI_TOOLTIPS.sharpe}
                  color={report.sharpe > 1 ? "text-green-400" : report.sharpe > 0 ? "text-orange-400" : "text-red-400"} />
                <KPICard label="Max Drawdown" value={`-${report.maxDrawdown}`} suffix="%" tooltip={KPI_TOOLTIPS.maxDrawdown}
                  color={report.maxDrawdown < 10 ? "text-green-400" : report.maxDrawdown < 20 ? "text-orange-400" : "text-red-400"} />
                <KPICard label="Profit Factor" value={report.profitFactor} tooltip={KPI_TOOLTIPS.profitFactor}
                  color={report.profitFactor > 1.5 ? "text-green-400" : report.profitFactor > 1 ? "text-orange-400" : "text-red-400"} />
                <KPICard label="R/R Moyen" value={report.avgRR} tooltip={KPI_TOOLTIPS.avgRR}
                  color={report.avgRR > 1.5 ? "text-green-400" : "text-orange-400"} />
                <KPICard label="Sortino" value={report.sortino} tooltip={KPI_TOOLTIPS.sortino}
                  color={report.sortino > 1 ? "text-green-400" : "text-orange-400"} />
                <KPICard label="Volatilité/an" value={report.annualizedVol.toFixed(1)} suffix="%" tooltip={KPI_TOOLTIPS.volatility} />
                <KPICard label="Meilleur trade" value={report.bestTrade ? `+${report.bestTrade.pnlPct.toFixed(1)}%` : "—"} color="text-green-400" />
                <KPICard label="Pire trade" value={report.worstTrade ? `${report.worstTrade.pnlPct.toFixed(1)}%` : "—"} color="text-red-400" />
              </div>

              {report.benchmarkCurve.length > 1 && (
                <div className="bg-[#111] border border-white/5 rounded-2xl p-5">
                  <p className="text-white font-bold text-sm mb-4">Performance vs SPY (base 100)</p>
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={report.benchmarkCurve} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="pGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#4ade80" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#4ade80" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="sGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#60a5fa" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis dataKey="date" tick={{ fill: "#555", fontSize: 10 }} tickFormatter={v => v.slice(5)} />
                      <YAxis tick={{ fill: "#555", fontSize: 10 }} />
                      <Tooltip contentStyle={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }}
                        labelStyle={{ color: "#999" }} formatter={(v) => [typeof v === "number" ? v.toFixed(2) : String(v ?? ""), ""]} />
                      <Area type="monotone" dataKey="portfolio" stroke="#4ade80" strokeWidth={2} fill="url(#pGrad)" name="Ton portfolio" />
                      <Area type="monotone" dataKey="spy" stroke="#60a5fa" strokeWidth={1.5} fill="url(#sGrad)" strokeDasharray="4 2" name="SPY" />
                      <Legend wrapperStyle={{ fontSize: 11, color: "#999" }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}

              <div className="bg-[#111] border border-white/5 rounded-2xl p-5">
                <CalendarHeatmap data={report.dailySnapshots} />
              </div>

              {report.returnDistribution.some(b => b.count > 0) && (
                <div className="bg-[#111] border border-white/5 rounded-2xl p-5">
                  <p className="text-white font-bold text-sm mb-4">Distribution des returns</p>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={report.returnDistribution} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                      <XAxis dataKey="range" tick={{ fill: "#555", fontSize: 9 }} />
                      <YAxis tick={{ fill: "#555", fontSize: 10 }} allowDecimals={false} />
                      <Tooltip contentStyle={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }} labelStyle={{ color: "#999" }} />
                      <Bar dataKey="count" name="Trades" radius={[4, 4, 0, 0]}>
                        {report.returnDistribution.map((entry, i) => (
                          <Cell key={i} fill={entry.range.startsWith("<") || entry.range.startsWith("-") ? "#f87171" : "#4ade80"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {/* ── PAR ACTIF ── */}
          {section === "assets" && (
            <div className="space-y-6">
              {report.perAsset.length > 0 && (
                <div className="bg-[#111] border border-white/5 rounded-2xl p-5">
                  <p className="text-white font-bold text-sm mb-4">P&L par actif</p>
                  <ResponsiveContainer width="100%" height={Math.max(180, report.perAsset.length * 32)}>
                    <BarChart data={report.perAsset} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
                      <XAxis type="number" tick={{ fill: "#555", fontSize: 10 }} tickFormatter={v => `$${v}`} />
                      <YAxis type="category" dataKey="symbol" tick={{ fill: "#999", fontSize: 11 }} width={60} />
                      <Tooltip contentStyle={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }}
                        formatter={(v) => [typeof v === "number" ? `$${v.toFixed(2)}` : String(v ?? ""), "P&L"]} />
                      <Bar dataKey="pnl" radius={[0, 4, 4, 0]}>
                        {report.perAsset.map((entry, i) => (
                          <Cell key={i} fill={entry.pnl >= 0 ? "#4ade80" : "#f87171"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
              <div className="bg-[#111] border border-white/5 rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-white/5">
                  <p className="text-white font-bold text-sm">Tableau détaillé par actif</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/5">
                        {["Actif", "Trades", "Win %", "P&L", "Best", "Worst"].map(h => (
                          <th key={h} className={`text-gray-500 text-xs font-semibold uppercase tracking-wide px-4 py-3 ${h === "Actif" ? "text-left" : "text-right"} ${["Best","Worst"].includes(h) ? "hidden sm:table-cell" : ""}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {report.perAsset.map((a, i) => (
                        <tr key={i} className="border-b border-white/5 hover:bg-white/2 transition">
                          <td className="px-4 py-3 font-bold text-white">{a.symbol}</td>
                          <td className="px-4 py-3 text-right text-gray-400">{a.trades}</td>
                          <td className="px-4 py-3 text-right font-bold">
                            <span className={a.winRate >= 50 ? "text-green-400" : "text-orange-400"}>{a.winRate}%</span>
                          </td>
                          <td className="px-4 py-3 text-right font-black">
                            <span className={a.pnl >= 0 ? "text-green-400" : "text-red-400"}>
                              {a.pnl >= 0 ? "+" : ""}${a.pnl.toFixed(0)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-green-400 hidden sm:table-cell">+{a.bestTradePct.toFixed(1)}%</td>
                          <td className="px-4 py-3 text-right text-red-400 hidden sm:table-cell">{a.worstTradePct.toFixed(1)}%</td>
                        </tr>
                      ))}
                      {report.perAsset.length === 0 && (
                        <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-600 text-sm">Pas encore assez de trades fermés</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── SECTEURS ── */}
          {section === "sectors" && (
            <div className="space-y-6">
              {report.perSector.length > 0 ? (
                <>
                  <div className="bg-[#111] border border-white/5 rounded-2xl p-5">
                    <p className="text-white font-bold text-sm mb-4">Répartition par secteur</p>
                    <div className="flex flex-col sm:flex-row items-center gap-6">
                      <ResponsiveContainer width={180} height={180}>
                        <PieChart>
                          <Pie data={report.perSector} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="pnl" nameKey="sector">
                            {report.perSector.map((_, i) => (
                              <Cell key={i} fill={SECTOR_COLORS[i % SECTOR_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }}
                            formatter={(v) => [typeof v === "number" ? `$${v.toFixed(2)}` : String(v ?? ""), ""]} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="flex flex-col gap-2 flex-1">
                        {report.perSector.map((s, i) => (
                          <div key={i} className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: SECTOR_COLORS[i % SECTOR_COLORS.length] }} />
                              <span className="text-gray-300 text-sm">{s.sector}</span>
                            </div>
                            <span className={`font-black text-sm ${s.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                              {s.pnl >= 0 ? "+" : ""}${s.pnl.toFixed(0)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="bg-[#111] border border-white/5 rounded-2xl p-5">
                    <p className="text-white font-bold text-sm mb-4">P&L par secteur</p>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={report.perSector} margin={{ top: 0, right: 10, left: -10, bottom: 0 }}>
                        <XAxis dataKey="sector" tick={{ fill: "#999", fontSize: 11 }} />
                        <YAxis tick={{ fill: "#555", fontSize: 10 }} tickFormatter={v => `$${v}`} />
                        <Tooltip contentStyle={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }}
                          formatter={(v) => [typeof v === "number" ? `$${v.toFixed(2)}` : String(v ?? ""), "P&L"]} />
                        <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                          {report.perSector.map((s, i) => (
                            <Cell key={i} fill={s.pnl >= 0 ? SECTOR_COLORS[i % SECTOR_COLORS.length] : "#f87171"} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </>
              ) : (
                <div className="text-center py-16 text-gray-600">
                  <p className="text-3xl mb-2">🌍</p>
                  <p className="text-sm">Pas encore assez de trades pour l&apos;analyse sectorielle</p>
                </div>
              )}
            </div>
          )}

          {/* ── COMPORTEMENT ── */}
          {section === "comportement" && (
            <div className="space-y-6">
              <div className="bg-[#111] border border-white/5 rounded-2xl p-5">
                <TradeHeatmap data={report.heatmapData} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#111] border border-white/5 rounded-2xl p-4">
                  <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-2">Durée moy. gagnants</p>
                  <p className="text-2xl font-black text-green-400">{report.avgWinDuration}h</p>
                  <p className="text-gray-600 text-xs mt-1">Tu laisses courir tes profits</p>
                </div>
                <div className="bg-[#111] border border-white/5 rounded-2xl p-4">
                  <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-2">Durée moy. perdants</p>
                  <p className="text-2xl font-black text-red-400">{report.avgLossDuration}h</p>
                  <p className="text-gray-600 text-xs mt-1">Tu coupes tes pertes</p>
                </div>
              </div>

              <div className="bg-[#111] border border-white/5 rounded-2xl p-5 space-y-3">
                <p className="text-white font-bold text-sm">🔍 Insights comportementaux</p>
                {report.avgWinDuration > 0 && report.avgLossDuration > 0 && report.avgWinDuration < report.avgLossDuration && (
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-orange-500/5 border border-orange-500/15">
                    <span className="text-lg flex-shrink-0">⚠️</span>
                    <div>
                      <p className="text-white text-sm font-bold">Tendance à couper trop tôt</p>
                      <p className="text-gray-500 text-xs mt-0.5">Tes trades gagnants durent moins longtemps que tes perdants. Laisse courir tes profits.</p>
                    </div>
                  </div>
                )}
                {report.avgWinDuration > 0 && report.avgLossDuration > 0 && report.avgWinDuration >= report.avgLossDuration && (
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-green-500/5 border border-green-500/15">
                    <span className="text-lg flex-shrink-0">✅</span>
                    <div>
                      <p className="text-white text-sm font-bold">Bonne gestion du risque</p>
                      <p className="text-gray-500 text-xs mt-0.5">Tu coupes tes pertes rapidement et laisses tes gains courir. Continue !</p>
                    </div>
                  </div>
                )}
                {report.winRate < 40 && report.profitFactor > 1.5 && (
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-blue-500/5 border border-blue-500/15">
                    <span className="text-lg flex-shrink-0">💡</span>
                    <div>
                      <p className="text-white text-sm font-bold">Trader orienté Risk/Reward</p>
                      <p className="text-gray-500 text-xs mt-0.5">Tu gagnes moins souvent mais tes gains sont bien plus grands. Stratégie solide.</p>
                    </div>
                  </div>
                )}
                {report.maxDrawdown > 20 && (
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-red-500/5 border border-red-500/15">
                    <span className="text-lg flex-shrink-0">🚨</span>
                    <div>
                      <p className="text-white text-sm font-bold">Drawdown élevé détecté</p>
                      <p className="text-gray-500 text-xs mt-0.5">Ton drawdown max de {report.maxDrawdown}% est élevé. Réduis la taille de tes positions ou améliore tes stops.</p>
                    </div>
                  </div>
                )}
                {report.closedTrades === 0 && (
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-white/3 border border-white/8">
                    <span className="text-lg flex-shrink-0">📊</span>
                    <div>
                      <p className="text-white text-sm font-bold">Pas encore assez de données</p>
                      <p className="text-gray-500 text-xs mt-0.5">Passe au moins 5 trades fermés pour débloquer l&apos;analyse comportementale.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
