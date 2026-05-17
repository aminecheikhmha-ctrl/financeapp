"use client"

import { useEffect, useRef, useState } from "react"
import {
  createChart,
  CrosshairMode,
  LineStyle,
  IChartApi,
  ISeriesApi,
  Time,
} from "lightweight-charts"

// ── Formatters ────────────────────────────────────────────────────────────────
function fmtN(n: number | null, d = 2) { return n != null ? n.toFixed(d) : "—" }
function fmtVol(n: number | null) {
  if (n == null) return "—"
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M"
  if (n >= 1_000)     return (n / 1_000).toFixed(0) + "K"
  return String(n)
}

// ── Types ─────────────────────────────────────────────────────────────────────
type BarSignal = {
  type: "buy" | "sell"
  strength: "weak" | "moderate" | "strong"
  confluence: string[]
  confluence_count: number
}

type Bar = {
  ts: number; date: string
  open: number; high: number; low: number; close: number; volume: number
  ma20: number | null; ma50: number | null
  rsi: number | null
  bb_upper: number | null; bb_middle: number | null; bb_lower: number | null
  ema9: number | null; ema21: number | null
  vwap: number | null; atr: number | null
  stoch_k: number | null; stoch_d: number | null
  obv: number | null
  macd_line: number | null; macd_signal: number | null; macd_hist: number | null
  williams_r: number | null
  bar_signal: BarSignal | null
}

type Signal = {
  type: "buy" | "sell"; price: number; date: string; qty?: number; reason?: string
}

type Position = {
  avg_price: number; take_profit: number | null; stop_loss: number | null; qty: number
  symbol?: string; name?: string
}

// ── Timeframe config ──────────────────────────────────────────────────────────
type Timeframe = "1D" | "5D" | "1M" | "3M" | "6M" | "1Y" | "5Y" | "MAX"

const TIMEFRAMES: Record<Timeframe, { interval: string; range: string; displayBars: number }> = {
  // range = maximum Yahoo Finance allows for that interval
  // displayBars = how many bars are visible on load (scroll back to see the rest)
  "1D":  { interval: "1m",  range: "7d",   displayBars: 390   },
  "5D":  { interval: "5m",  range: "60d",  displayBars: 390   },
  "1M":  { interval: "60m", range: "730d", displayBars: 160   },
  "3M":  { interval: "60m", range: "730d", displayBars: 480   },
  "6M":  { interval: "1d",  range: "max",  displayBars: 130   },
  "1Y":  { interval: "1d",  range: "max",  displayBars: 252   },
  "5Y":  { interval: "1wk", range: "max",  displayBars: 260   },
  "MAX": { interval: "1mo", range: "max",  displayBars: 99999 },
}

const INTERVAL_LABEL: Record<string, string> = {
  "1m": "1m", "5m": "5m", "60m": "1h", "1d": "1D", "1wk": "1W", "1mo": "1M",
}

const NORMAL_TFS: Timeframe[] = ["1D", "5D", "1M", "3M", "6M", "1Y"]

// ── Colors ────────────────────────────────────────────────────────────────────
const BG     = "#0a0a0a"
const GRID   = "#111111"
const BORDER = "#1a1a1a"
const TEXT   = "#666666"
const UP     = "#4ade80"
const DOWN   = "#f87171"
const MA20C  = "#3b82f6"
const MA50C  = "#f97316"
const BBC    = "rgba(139,92,246,0.5)"
const RSIC   = "#a78bfa"
const EMA9C  = "#22d3ee"
const EMA21C = "#facc15"
const STOCHC = "#fb923c"

// ── Toggle button ─────────────────────────────────────────────────────────────
function ToggleBtn({
  label, active, color, onClick,
}: { label: string; active: boolean; color?: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-2 py-0.5 rounded text-[10px] font-semibold transition-all"
      style={{
        background: active ? "rgba(255,255,255,0.08)" : "transparent",
        color: active ? (color ?? "#aaa") : "#333",
        border: `1px solid ${active ? (color ?? "#444") : "#222"}`,
      }}
    >
      {label}
    </button>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function TradingChart({
  symbol, position, signals = [],
  bars: _bars, support: _support, resistance: _resistance,
}: {
  symbol: string
  position?: Position | null
  signals?: Signal[]
  bars?: any; support?: any; resistance?: any
}) {
  // DOM refs
  const mainDivRef     = useRef<HTMLDivElement>(null)
  const rsiDivRef      = useRef<HTMLDivElement>(null)
  const macdDivRef     = useRef<HTMLDivElement>(null)
  const legendDivRef   = useRef<HTMLDivElement>(null)
  const sidebarLiveRef = useRef<HTMLDivElement>(null)

  // Chart instances
  const mainChart  = useRef<IChartApi | null>(null)
  const rsiChart   = useRef<IChartApi | null>(null)
  const macdChart  = useRef<IChartApi | null>(null)

  // Series — main
  const candleSeries  = useRef<ISeriesApi<"Candlestick"> | null>(null)
  const volumeSeries  = useRef<ISeriesApi<"Histogram"> | null>(null)
  const ma20Series    = useRef<ISeriesApi<"Line"> | null>(null)
  const ma50Series    = useRef<ISeriesApi<"Line"> | null>(null)
  const bbUpperSeries = useRef<ISeriesApi<"Line"> | null>(null)
  const bbMidSeries   = useRef<ISeriesApi<"Line"> | null>(null)
  const bbLowerSeries = useRef<ISeriesApi<"Line"> | null>(null)
  const ema9Series    = useRef<ISeriesApi<"Line"> | null>(null)
  const ema21Series   = useRef<ISeriesApi<"Line"> | null>(null)
  const zoneSeries    = useRef<ISeriesApi<"Baseline"> | null>(null)

  // Series — RSI + Stoch
  const rsiLineSeries = useRef<ISeriesApi<"Line"> | null>(null)
  const stochKSeries  = useRef<ISeriesApi<"Line"> | null>(null)
  const stochDSeries  = useRef<ISeriesApi<"Line"> | null>(null)

  // Series — MACD
  const macdHistSeries = useRef<ISeriesApi<"Histogram"> | null>(null)
  const macdLineSeries = useRef<ISeriesApi<"Line"> | null>(null)
  const macdSigSeries  = useRef<ISeriesApi<"Line"> | null>(null)

  const priceLines  = useRef<{ line: any; series: any }[]>([])
  const barsMap     = useRef<Map<number, Bar>>(new Map())
  const chartsReady = useRef(false)
  const signalsRef  = useRef(signals)
  const positionRef = useRef(position)

  // State
  const [chartsInitialized, setChartsInitialized] = useState(false)
  const [fullscreen, setFullscreen]   = useState(false)
  const [showBB,      setShowBB]      = useState(true)
  const [showEMA,     setShowEMA]     = useState(true)
  const [showSignals, setShowSignals] = useState(true)
  const [showVolume,  setShowVolume]  = useState(true)
  const [timeframe, setTimeframe]     = useState<Timeframe>("3M")
  const [bars, setBars]               = useState<Bar[]>([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState("")

  signalsRef.current  = signals
  positionRef.current = position

  // ── ESC to exit fullscreen ────────────────────────────────────────────────
  useEffect(() => {
    if (!fullscreen) return
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") setFullscreen(false) }
    window.addEventListener("keydown", h)
    return () => window.removeEventListener("keydown", h)
  }, [fullscreen])

  // ── Chart initialization (once) ───────────────────────────────────────────
  useEffect(() => {
    if (!mainDivRef.current || !rsiDivRef.current || !macdDivRef.current) return

    // Main chart
    const mc = createChart(mainDivRef.current, {
      autoSize: true,
      layout: { background: { color: BG }, textColor: TEXT },
      grid: { vertLines: { color: GRID }, horzLines: { color: GRID } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: BORDER },
      timeScale: { borderColor: BORDER, timeVisible: true, secondsVisible: false },
    })

    const cs = mc.addCandlestickSeries({
      upColor: UP, downColor: DOWN,
      borderUpColor: UP, borderDownColor: DOWN,
      wickUpColor: UP, wickDownColor: DOWN,
    })
    const vs = mc.addHistogramSeries({
      color: UP, priceFormat: { type: "volume" }, priceScaleId: "volume",
    })
    mc.priceScale("volume").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } })

    const ma20 = mc.addLineSeries({ color: MA20C, lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false })
    const ma50 = mc.addLineSeries({ color: MA50C, lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false })
    const bbU  = mc.addLineSeries({ color: BBC,   lineWidth: 1, lineStyle: LineStyle.Dotted, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false })
    const bbM  = mc.addLineSeries({ color: "rgba(139,92,246,0.22)", lineWidth: 1, lineStyle: LineStyle.Dotted, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false })
    const bbL  = mc.addLineSeries({ color: BBC,   lineWidth: 1, lineStyle: LineStyle.Dotted, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false })
    const ema9  = mc.addLineSeries({ color: EMA9C,  lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false })
    const ema21 = mc.addLineSeries({ color: EMA21C, lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false })
    const zone  = mc.addBaselineSeries({
      baseValue: { type: "price", price: 0 },
      topFillColor1: "rgba(74,222,128,0.10)", topFillColor2: "rgba(74,222,128,0.02)", topLineColor: "rgba(0,0,0,0)",
      bottomFillColor1: "rgba(248,113,113,0.02)", bottomFillColor2: "rgba(248,113,113,0.10)", bottomLineColor: "rgba(0,0,0,0)",
      lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
    })

    // Hide advanced series by default (normal mode)
    bbU.applyOptions({ visible: false }); bbM.applyOptions({ visible: false }); bbL.applyOptions({ visible: false })
    ema9.applyOptions({ visible: false }); ema21.applyOptions({ visible: false })

    // RSI chart
    const rc = createChart(rsiDivRef.current, {
      autoSize: true,
      layout: { background: { color: BG }, textColor: TEXT },
      grid: { vertLines: { color: GRID }, horzLines: { color: GRID } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: BORDER, scaleMargins: { top: 0.1, bottom: 0.1 } },
      timeScale: { borderColor: BORDER, visible: false },
    })
    const rsiLine = rc.addLineSeries({ color: RSIC, lineWidth: 1, priceLineVisible: false, lastValueVisible: true, crosshairMarkerVisible: false })
    rsiLine.createPriceLine({ price: 70, color: "rgba(248,113,113,0.5)", lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "70" })
    rsiLine.createPriceLine({ price: 50, color: "rgba(100,100,100,0.3)", lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: false, title: "" })
    rsiLine.createPriceLine({ price: 30, color: "rgba(74,222,128,0.5)",  lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "30" })

    const stochK = rc.addLineSeries({ color: STOCHC, lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false })
    const stochD = rc.addLineSeries({ color: "rgba(251,146,60,0.45)", lineWidth: 1, lineStyle: LineStyle.Dotted, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false })
    stochK.createPriceLine({ price: 80, color: "rgba(251,146,60,0.25)", lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: false, title: "" })
    stochK.createPriceLine({ price: 20, color: "rgba(251,146,60,0.25)", lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: false, title: "" })
    stochK.applyOptions({ visible: false }); stochD.applyOptions({ visible: false })

    // MACD chart
    const macdC = createChart(macdDivRef.current, {
      autoSize: true,
      layout: { background: { color: BG }, textColor: TEXT },
      grid: { vertLines: { color: GRID }, horzLines: { color: GRID } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: BORDER, scaleMargins: { top: 0.1, bottom: 0.1 } },
      timeScale: { borderColor: BORDER, visible: false },
    })
    const macdHist  = macdC.addHistogramSeries({ priceFormat: { type: "price", precision: 4, minMove: 0.0001 }, priceLineVisible: false, lastValueVisible: false })
    const macdLineS = macdC.addLineSeries({ color: "#3b82f6", lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false })
    const macdSig   = macdC.addLineSeries({ color: "#f97316", lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false })
    macdHist.createPriceLine({ price: 0, color: "rgba(100,100,100,0.35)", lineWidth: 1, lineStyle: LineStyle.Solid, axisLabelVisible: false, title: "" })

    // Time scale sync (all 3)
    let syncing = false
    const syncRange = (src: IChartApi, targets: IChartApi[]) =>
      src.timeScale().subscribeVisibleLogicalRangeChange((range) => {
        if (syncing || !range) return
        syncing = true; targets.forEach(t => t.timeScale().setVisibleLogicalRange(range)); syncing = false
      })
    syncRange(mc, [rc, macdC]); syncRange(rc, [mc, macdC]); syncRange(macdC, [mc, rc])

    // Crosshair: main → RSI, MACD, legend, sidebar
    mc.subscribeCrosshairMove((param) => {
      const legend  = legendDivRef.current
      const sidebar = sidebarLiveRef.current
      if (param.time) {
        const cd = param.seriesData.get(cs) as { close?: number } | undefined
        try { rc.setCrosshairPosition(cd?.close ?? 50, param.time as Time, rsiLine) } catch {}
        try { macdC.setCrosshairPosition(0, param.time as Time, macdHist) } catch {}

        const bar = barsMap.current.get(param.time as number)
        if (bar) {
          const isUp     = bar.close >= bar.open
          const rsiCol   = bar.rsi   == null ? RSIC   : bar.rsi   > 70 ? DOWN : bar.rsi   < 30 ? UP : RSIC
          const stochCol = bar.stoch_k == null ? STOCHC : bar.stoch_k > 80 ? DOWN : bar.stoch_k < 20 ? UP : STOCHC
          const macdCol  = (bar.macd_hist ?? 0) >= 0 ? UP : DOWN

          // Legend tooltip
          if (legend) {
            legend.style.display = "block"
            legend.innerHTML = `
              <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
                <span style="color:#444">${bar.date}</span>
                <span style="color:#555">O <span style="color:#ccc">${fmtN(bar.open)}</span></span>
                <span style="color:#555">H <span style="color:${UP}">${fmtN(bar.high)}</span></span>
                <span style="color:#555">L <span style="color:${DOWN}">${fmtN(bar.low)}</span></span>
                <span style="color:#555">C <span style="color:${isUp ? UP : DOWN}">${fmtN(bar.close)}</span></span>
                <span style="color:#444">Vol <span style="color:#666">${fmtVol(bar.volume)}</span></span>
              </div>
              <div style="display:flex;gap:10px;margin-top:3px;flex-wrap:wrap;align-items:center">
                <span style="color:#444">RSI <span style="color:${rsiCol}">${fmtN(bar.rsi, 1)}</span></span>
                <span style="color:${STOCHC}">K <span style="color:${stochCol}">${fmtN(bar.stoch_k, 1)}</span></span>
                <span style="color:#444">MACD <span style="color:${macdCol}">${fmtN(bar.macd_hist, 4)}</span></span>
                <span style="color:${EMA9C}">E9 ${fmtN(bar.ema9)}</span>
                <span style="color:${EMA21C}">E21 ${fmtN(bar.ema21)}</span>
                <span style="color:${MA20C}">MA20 ${fmtN(bar.ma20)}</span>
                ${bar.atr != null ? `<span style="color:#555">ATR <span style="color:#666">${fmtN(bar.atr, 3)}</span></span>` : ""}
              </div>
              ${bar.bar_signal ? `<div style="margin-top:3px;font-size:10px;color:${bar.bar_signal.type === "buy" ? UP : DOWN}">
                ${bar.bar_signal.type === "buy" ? "▲" : "▼"} ${bar.bar_signal.strength.toUpperCase()}
                · ${bar.bar_signal.confluence.slice(0, 2).join(", ")}${bar.bar_signal.confluence.length > 2 ? " …" : ""}
              </div>` : ""}
            `
          }

          // Sidebar live indicators
          if (sidebar) {
            sidebar.innerHTML = `
              <div class="space-y-1.5">
                <div style="display:flex;justify-content:space-between">
                  <span style="color:#444">RSI(14)</span>
                  <span style="color:${rsiCol};font-weight:600">${fmtN(bar.rsi, 1)}${bar.rsi != null ? (bar.rsi > 70 ? " ⚠" : bar.rsi < 30 ? " ↑" : "") : ""}</span>
                </div>
                <div style="display:flex;justify-content:space-between">
                  <span style="color:#444">Stoch K/D</span>
                  <span style="color:${stochCol}">${fmtN(bar.stoch_k, 1)} / ${fmtN(bar.stoch_d, 1)}</span>
                </div>
                <div style="display:flex;justify-content:space-between">
                  <span style="color:#444">MACD hist</span>
                  <span style="color:${macdCol}">${fmtN(bar.macd_hist, 4)}</span>
                </div>
                <div style="display:flex;justify-content:space-between">
                  <span style="color:#444">MACD line</span>
                  <span style="color:#888">${fmtN(bar.macd_line, 4)}</span>
                </div>
                <div style="height:1px;background:#1a1a1a;margin:6px 0"></div>
                <div style="display:flex;justify-content:space-between">
                  <span style="color:${EMA9C}">EMA 9</span>
                  <span style="color:#aaa">${fmtN(bar.ema9)}</span>
                </div>
                <div style="display:flex;justify-content:space-between">
                  <span style="color:${EMA21C}">EMA 21</span>
                  <span style="color:#aaa">${fmtN(bar.ema21)}</span>
                </div>
                <div style="display:flex;justify-content:space-between">
                  <span style="color:${MA20C}">MA 20</span>
                  <span style="color:#aaa">${fmtN(bar.ma20)}</span>
                </div>
                <div style="display:flex;justify-content:space-between">
                  <span style="color:${MA50C}">MA 50</span>
                  <span style="color:#aaa">${fmtN(bar.ma50)}</span>
                </div>
                <div style="height:1px;background:#1a1a1a;margin:6px 0"></div>
                <div style="display:flex;justify-content:space-between">
                  <span style="color:#444">ATR(14)</span>
                  <span style="color:#666">${fmtN(bar.atr, 3)}</span>
                </div>
                <div style="display:flex;justify-content:space-between">
                  <span style="color:#444">Williams %R</span>
                  <span style="color:#666">${fmtN(bar.williams_r, 1)}</span>
                </div>
                <div style="display:flex;justify-content:space-between">
                  <span style="color:#444">Volume</span>
                  <span style="color:#666">${fmtVol(bar.volume)}</span>
                </div>
              </div>
            `
          }
        }
      } else {
        rc.clearCrosshairPosition(); macdC.clearCrosshairPosition()
        if (legend) legend.style.display = "none"
      }
    })

    // Store refs
    mainChart.current = mc; rsiChart.current = rc; macdChart.current = macdC
    candleSeries.current = cs; volumeSeries.current = vs
    ma20Series.current = ma20; ma50Series.current = ma50
    bbUpperSeries.current = bbU; bbMidSeries.current = bbM; bbLowerSeries.current = bbL
    ema9Series.current = ema9; ema21Series.current = ema21
    zoneSeries.current = zone
    rsiLineSeries.current = rsiLine; stochKSeries.current = stochK; stochDSeries.current = stochD
    macdHistSeries.current = macdHist; macdLineSeries.current = macdLineS; macdSigSeries.current = macdSig
    chartsReady.current = true
    setChartsInitialized(true)

    return () => {
      chartsReady.current = false
      setChartsInitialized(false)
      mc.remove(); rc.remove(); macdC.remove()
    }
  }, [])

  // ── Series visibility (responds to fullscreen + toggles) ─────────────────
  useEffect(() => {
    if (!chartsInitialized) return
    const fs = fullscreen
    bbUpperSeries.current?.applyOptions({ visible: fs && showBB })
    bbMidSeries.current?.applyOptions({ visible: fs && showBB })
    bbLowerSeries.current?.applyOptions({ visible: fs && showBB })
    ema9Series.current?.applyOptions({ visible: fs && showEMA })
    ema21Series.current?.applyOptions({ visible: fs && showEMA })
    stochKSeries.current?.applyOptions({ visible: fs })
    stochDSeries.current?.applyOptions({ visible: fs })
    // Volume: always visible in normal, toggleable in fullscreen
    volumeSeries.current?.applyOptions({ visible: fs ? showVolume : true })
  }, [chartsInitialized, fullscreen, showBB, showEMA, showVolume])

  // ── Fetch data ────────────────────────────────────────────────────────────
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError("")
    const cfg = TIMEFRAMES[timeframe]
    fetch(`/api/alpaca/chart?symbol=${encodeURIComponent(symbol)}&interval=${cfg.interval}&range=${cfg.range}`, { signal: controller.signal })
      .then(r => r.json())
      .then(data => {
        if (data?.error) { setError(data.error); return }
        if (Array.isArray(data)) setBars(data)
      })
      .catch(e => { if (e.name !== "AbortError") setError("Erreur chargement") })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [symbol, timeframe])

  // ── Update series data ────────────────────────────────────────────────────
  useEffect(() => {
    if (bars.length === 0) return
    if (!chartsReady.current) {
      const id = setTimeout(() => { if (chartsReady.current) setBars(b => [...b]) }, 100)
      return () => clearTimeout(id)
    }

    barsMap.current.clear()
    bars.forEach(b => barsMap.current.set(b.ts, b))
    const t = (b: Bar) => b.ts as Time

    candleSeries.current?.setData(bars.map(b => ({ time: t(b), open: b.open, high: b.high, low: b.low, close: b.close })))
    volumeSeries.current?.setData(bars.map(b => ({
      time: t(b), value: b.volume,
      color: b.close >= b.open ? "rgba(74,222,128,0.4)" : "rgba(248,113,113,0.4)",
    })))
    ma20Series.current?.setData(bars.filter(b => b.ma20 != null).map(b => ({ time: t(b), value: b.ma20! })))
    ma50Series.current?.setData(bars.filter(b => b.ma50 != null).map(b => ({ time: t(b), value: b.ma50! })))
    bbUpperSeries.current?.setData(bars.filter(b => b.bb_upper != null).map(b => ({ time: t(b), value: b.bb_upper! })))
    bbMidSeries.current?.setData(bars.filter(b => b.bb_middle != null).map(b => ({ time: t(b), value: b.bb_middle! })))
    bbLowerSeries.current?.setData(bars.filter(b => b.bb_lower != null).map(b => ({ time: t(b), value: b.bb_lower! })))
    ema9Series.current?.setData(bars.filter(b => b.ema9 != null).map(b => ({ time: t(b), value: b.ema9! })))
    ema21Series.current?.setData(bars.filter(b => b.ema21 != null).map(b => ({ time: t(b), value: b.ema21! })))
    rsiLineSeries.current?.setData(bars.filter(b => b.rsi != null).map(b => ({ time: t(b), value: b.rsi! })))
    stochKSeries.current?.setData(bars.filter(b => b.stoch_k != null).map(b => ({ time: t(b), value: b.stoch_k! })))
    stochDSeries.current?.setData(bars.filter(b => b.stoch_d != null).map(b => ({ time: t(b), value: b.stoch_d! })))

    const macdHistData = bars.filter(b => b.macd_hist != null).map((b, i, arr) => {
      const prev = arr[i - 1]?.macd_hist ?? b.macd_hist!
      const expanding = Math.abs(b.macd_hist!) >= Math.abs(prev)
      const color = b.macd_hist! >= 0
        ? (expanding ? "rgba(74,222,128,0.85)" : "rgba(74,222,128,0.4)")
        : (expanding ? "rgba(248,113,113,0.85)" : "rgba(248,113,113,0.4)")
      return { time: t(b), value: b.macd_hist!, color }
    })
    macdHistSeries.current?.setData(macdHistData)
    macdLineSeries.current?.setData(bars.filter(b => b.macd_line != null).map(b => ({ time: t(b), value: b.macd_line! })))
    macdSigSeries.current?.setData(bars.filter(b => b.macd_signal != null).map(b => ({ time: t(b), value: b.macd_signal! })))

    const n = Math.min(TIMEFRAMES[timeframe].displayBars, bars.length)
    const from = bars.length - n, to = bars.length - 1
    mainChart.current?.timeScale().setVisibleLogicalRange({ from, to })
    rsiChart.current?.timeScale().setVisibleLogicalRange({ from, to })
    macdChart.current?.timeScale().setVisibleLogicalRange({ from, to })
  }, [bars, timeframe])

  // ── Overlays: price lines + markers ──────────────────────────────────────
  useEffect(() => {
    if (!chartsReady.current || !candleSeries.current) return

    priceLines.current.forEach(({ line, series }) => series.removePriceLine(line))
    priceLines.current = []
    zoneSeries.current?.setData([])

    if (position?.avg_price && candleSeries.current) {
      const add = (price: number, color: string, style: LineStyle, title: string) => {
        const line = candleSeries.current!.createPriceLine({ price, color, lineWidth: 1, lineStyle: style, axisLabelVisible: true, title })
        priceLines.current.push({ line, series: candleSeries.current! })
      }
      if (position.take_profit != null) add(position.take_profit, UP,   LineStyle.Dashed, `TP ${position.take_profit.toFixed(2)}`)
      if (position.stop_loss   != null) add(position.stop_loss,   DOWN, LineStyle.Dashed, `SL ${position.stop_loss.toFixed(2)}`)
    }

    const dateToTs = new Map<string, number>()
    barsMap.current.forEach((bar, ts) => dateToTs.set(bar.date.slice(0, 10), ts))

    const orderMarkers = signalsRef.current
      .map(s => {
        const ts = dateToTs.get(s.date.slice(0, 10))
        if (ts == null) return null
        return {
          time: ts as Time,
          position: s.type === "buy" ? ("belowBar" as const) : ("aboveBar" as const),
          color: s.type === "buy" ? UP : DOWN,
          shape: s.type === "buy" ? ("arrowUp" as const) : ("arrowDown" as const),
          text: s.type === "buy"
            ? `B $${s.price.toFixed(2)}${s.qty ? ` ×${s.qty}` : ""}`
            : `S $${s.price.toFixed(2)}${s.qty ? ` ×${s.qty}` : ""}`,
          size: 1,
        }
      })
      .filter((m): m is NonNullable<typeof m> => m !== null)

    // AI circles: only in fullscreen when showSignals is on
    const aiMarkers = (fullscreen && showSignals)
      ? bars.filter(b => b.bar_signal != null).map(b => ({
          time:     b.ts as Time,
          position: b.bar_signal!.type === "buy" ? ("belowBar" as const) : ("aboveBar" as const),
          color:    b.bar_signal!.type === "buy" ? "rgba(74,222,128,0.75)" : "rgba(248,113,113,0.75)",
          shape:    "circle" as const,
          text:     `${b.bar_signal!.confluence_count}`,
          size:     b.bar_signal!.strength === "strong" ? 2 : 1,
        }))
      : []

    candleSeries.current?.setMarkers(
      [...orderMarkers, ...aiMarkers].sort((a, b) => (a.time as number) - (b.time as number))
    )
  }, [bars, position, fullscreen, showSignals])

  // ── Derived data for sidebar ──────────────────────────────────────────────
  const recentSignals = bars.filter(b => b.bar_signal != null).slice(-6).reverse()
  const lastBar       = bars[bars.length - 1]
  const currentPrice  = lastBar?.close
  const pnl           = position && currentPrice ? (currentPrice - position.avg_price) * position.qty : null
  const pnlPct        = position && currentPrice ? ((currentPrice - position.avg_price) / position.avg_price) * 100 : null
  const cfg           = TIMEFRAMES[timeframe]
  const tfList        = fullscreen ? (Object.keys(TIMEFRAMES) as Timeframe[]) : NORMAL_TFS

  // ── JSX ───────────────────────────────────────────────────────────────────
  const Toolbar = (
    <div className="flex-shrink-0 flex items-center gap-2 px-3 py-1.5 border-b border-[#111] flex-wrap">
      {/* Symbol + interval badge */}
      <span className="text-[#555] text-[11px] font-semibold tracking-widest uppercase">{symbol}</span>
      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold" style={{ background: "#1a1a1a", color: "#555", border: "1px solid #222" }}>
        {INTERVAL_LABEL[cfg.interval] ?? cfg.interval}
      </span>
      <div className="w-px h-3 bg-[#222]" />

      {/* Timeframes */}
      <div className="flex">
        {tfList.map(tf => (
          <button key={tf} onClick={() => setTimeframe(tf)}
            className={`px-2.5 py-1 text-[11px] font-semibold transition-colors rounded ${
              timeframe === tf ? "bg-[#1f2937] text-[#60a5fa]" : "text-[#444] hover:text-[#888] hover:bg-[#111]"
            }`}>{tf}</button>
        ))}
      </div>

      {/* Advanced toggles — fullscreen only */}
      {fullscreen && (
        <>
          <div className="w-px h-3 bg-[#222] mx-1" />
          <ToggleBtn label="BB"      active={showBB}      color={BBC}    onClick={() => setShowBB(v => !v)} />
          <ToggleBtn label="EMA"     active={showEMA}      color={EMA9C}  onClick={() => setShowEMA(v => !v)} />
          <ToggleBtn label="Volume"  active={showVolume}   color="#888"   onClick={() => setShowVolume(v => !v)} />
          <ToggleBtn label="Signaux" active={showSignals}  color={UP}     onClick={() => setShowSignals(v => !v)} />
        </>
      )}

      {/* Spacer + right actions */}
      <div className="ml-auto flex items-center gap-2">
        {!fullscreen && (
          <div className="hidden lg:flex items-center gap-2 text-[10px] mr-2" style={{ color: "#2a2a2a" }}>
            <span style={{ color: MA20C }}>— MA20</span>
            <span style={{ color: MA50C }}>— MA50</span>
            <span style={{ color: RSIC }}>— RSI</span>
          </div>
        )}
        {fullscreen && (
          <div className="flex items-center gap-2 text-[10px] mr-2" style={{ color: "#2a2a2a" }}>
            <span style={{ color: EMA9C }}>— E9</span>
            <span style={{ color: EMA21C }}>— E21</span>
            <span style={{ color: STOCHC }}>— Stoch</span>
            <span style={{ color: "#333" }}>● AI</span>
          </div>
        )}
        {error && <span className="text-[#f87171] text-[11px]">{error}</span>}
        {/* Fullscreen toggle button */}
        <button
          onClick={() => setFullscreen(v => !v)}
          className="flex items-center justify-center w-7 h-7 rounded transition-colors hover:bg-[#1a1a1a]"
          title={fullscreen ? "Quitter plein écran (Echap)" : "Plein écran"}
          style={{ color: "#444" }}
        >
          {fullscreen ? (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M1 5V1h4M9 1h4v4M1 9v4h4M9 13h4V9"/>
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M5 1H1v4M13 5V1H9M1 9v4h4M9 13h4V9"/>
            </svg>
          )}
        </button>
      </div>
    </div>
  )

  const Charts = (
    <>
      {/* Main chart */}
      <div className="relative flex-1 min-h-0">
        <div
          ref={legendDivRef}
          className="absolute top-2 left-2 z-10 pointer-events-none rounded px-3 py-2 text-[11px] font-mono"
          style={{ display: "none", background: "rgba(8,8,8,0.94)", border: "1px solid #1a1a1a" }}
        />
        {loading && (
          <div className="absolute inset-0 z-20 flex flex-col justify-center gap-3 px-6" style={{ background: BG }}>
            {[85, 60, 75, 50, 90, 65, 70].map((w, i) => (
              <div key={i} className="h-2 rounded animate-pulse" style={{ width: `${w}%`, background: "#151515" }} />
            ))}
          </div>
        )}
        <div ref={mainDivRef} className="w-full h-full" />
      </div>

      {/* RSI + Stoch panel */}
      <div
        className="relative flex-shrink-0 border-t border-[#111]"
        style={{ height: fullscreen ? 110 : 80 }}
      >
        <div className="absolute top-1 left-2 z-10 pointer-events-none text-[9px] font-mono flex gap-3">
          <span style={{ color: "#2a2a2a" }}>RSI(14)</span>
          {fullscreen && <span style={{ color: "rgba(251,146,60,0.3)" }}>Stoch(14,3)</span>}
        </div>
        <div ref={rsiDivRef} className="w-full h-full" />
      </div>

      {/* MACD panel — fullscreen only (height 0 collapses it in normal) */}
      <div
        className="relative flex-shrink-0 border-t border-[#111]"
        style={{ height: fullscreen ? 90 : 0, overflow: "hidden" }}
      >
        {fullscreen && (
          <div className="absolute top-1 left-2 z-10 pointer-events-none text-[9px] font-mono" style={{ color: "#2a2a2a" }}>
            MACD(12,26,9)
          </div>
        )}
        <div ref={macdDivRef} className="w-full h-full" />
      </div>

      {/* Position footer */}
      {position?.avg_price && (position.take_profit != null || position.stop_loss != null) && (
        <div className="flex-shrink-0 flex items-center gap-5 px-4 py-2 border-t border-[#111] text-[11px] font-mono flex-wrap" style={{ color: "#444" }}>
          {position.take_profit != null && <span><span style={{ color: UP }}>— </span>TP <span style={{ color: "#888" }}>{position.take_profit.toFixed(2)}</span></span>}
          {position.stop_loss   != null && <span><span style={{ color: DOWN }}>— </span>SL <span style={{ color: "#888" }}>{position.stop_loss.toFixed(2)}</span></span>}
          <span style={{ color: "#333" }}>Qty {position.qty}</span>
        </div>
      )}
    </>
  )

  const Sidebar = (
    <div
      className="flex-shrink-0 flex flex-col overflow-hidden border-l border-[#1a1a1a]"
      style={{ width: 260, background: "#080808" }}
    >
      {/* Symbol header */}
      <div className="px-4 py-3 border-b border-[#111]">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-[#444] uppercase tracking-widest">{symbol}</span>
          <span className="text-[9px] text-[#2a2a2a]">{lastBar?.date ?? ""}</span>
        </div>
        {currentPrice != null && (
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-black text-white">${currentPrice.toFixed(2)}</span>
            {lastBar && (
              <span className={`text-[11px] font-semibold ${lastBar.close >= lastBar.open ? "text-green-400" : "text-red-400"}`}>
                {lastBar.close >= lastBar.open ? "▲" : "▼"}
                {" "}{Math.abs(((lastBar.close - lastBar.open) / lastBar.open) * 100).toFixed(2)}%
              </span>
            )}
          </div>
        )}
      </div>

      {/* Live indicators (updated imperatively on crosshair) */}
      <div className="px-4 py-3 border-b border-[#111]">
        <p className="text-[9px] text-[#333] uppercase tracking-widest mb-3">Indicateurs temps réel</p>
        <div
          ref={sidebarLiveRef}
          className="text-[11px] font-mono space-y-1.5"
          style={{ color: "#555" }}
        >
          <p style={{ color: "#2a2a2a" }}>Survole une bougie pour voir les valeurs</p>
        </div>
      </div>

      {/* Recent AI signals */}
      <div className="px-4 py-3 border-b border-[#111] flex-1 overflow-y-auto">
        <p className="text-[9px] text-[#333] uppercase tracking-widest mb-3">Signaux IA récents</p>
        {recentSignals.length > 0 ? (
          <div className="space-y-2">
            {recentSignals.map((b, i) => {
              const sig = b.bar_signal!
              return (
                <div key={i}
                  className="rounded p-2.5 text-[10px]"
                  style={{
                    background: sig.type === "buy" ? "rgba(74,222,128,0.05)" : "rgba(248,113,113,0.05)",
                    border: `1px solid ${sig.type === "buy" ? "rgba(74,222,128,0.12)" : "rgba(248,113,113,0.12)"}`,
                  }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span style={{ color: sig.type === "buy" ? UP : DOWN, fontWeight: 700 }}>
                      {sig.type === "buy" ? "▲ BUY" : "▼ SELL"}
                    </span>
                    <span
                      className="px-1.5 py-0.5 rounded text-[9px] font-bold"
                      style={{
                        background: sig.strength === "strong" ? "rgba(255,255,255,0.08)" : "transparent",
                        color: sig.strength === "strong" ? "#fff" : "#555",
                      }}
                    >
                      {sig.strength.toUpperCase()}
                    </span>
                  </div>
                  <p style={{ color: "#444" }}>{b.date}</p>
                  <p style={{ color: "#333", marginTop: 3 }}>
                    {sig.confluence.slice(0, 2).join(" · ")}
                    {sig.confluence.length > 2 && ` +${sig.confluence.length - 2}`}
                  </p>
                </div>
              )
            })}
          </div>
        ) : (
          <p style={{ color: "#2a2a2a", fontSize: 11 }}>Aucun signal détecté sur cette période</p>
        )}
      </div>

      {/* Open position */}
      {position?.avg_price && (
        <div className="px-4 py-3 border-t border-[#111]">
          <p className="text-[9px] text-[#333] uppercase tracking-widest mb-3">Position ouverte</p>
          <div className="space-y-1.5 text-[11px] font-mono">
            <div className="flex justify-between">
              <span style={{ color: "#444" }}>Quantité</span>
              <span style={{ color: "#888" }}>{position.qty} actions</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: "#444" }}>Prix moyen</span>
              <span style={{ color: "#888" }}>${position.avg_price.toFixed(2)}</span>
            </div>
            {position.take_profit != null && (
              <div className="flex justify-between">
                <span style={{ color: UP }}>Take Profit</span>
                <span style={{ color: UP }}>${position.take_profit.toFixed(2)}</span>
              </div>
            )}
            {position.stop_loss != null && (
              <div className="flex justify-between">
                <span style={{ color: DOWN }}>Stop Loss</span>
                <span style={{ color: DOWN }}>${position.stop_loss.toFixed(2)}</span>
              </div>
            )}
            {pnl != null && (
              <div
                className="mt-2 pt-2 border-t border-[#1a1a1a] flex justify-between font-bold"
                style={{ borderColor: "#1a1a1a" }}
              >
                <span style={{ color: "#555" }}>P&L</span>
                <span style={{ color: pnl >= 0 ? UP : DOWN }}>
                  {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}{" "}
                  <span style={{ fontSize: 10 }}>({pnlPct! >= 0 ? "+" : ""}{pnlPct!.toFixed(2)}%)</span>
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )

  // ── Render ────────────────────────────────────────────────────────────────
  // Single return — chart divs must stay at the same position in the React
  // tree so lightweight-charts instances never lose their DOM containers.
  return (
    <div
      className={fullscreen ? "fixed inset-0 z-50 flex overflow-hidden" : "w-full flex flex-col overflow-hidden"}
      style={{ background: BG, ...(fullscreen ? {} : { height: 600 }) }}
    >
      {/* Charts column — always present at the same tree depth */}
      <div className={`flex flex-col overflow-hidden min-w-0 ${fullscreen ? "flex-1" : "w-full flex-1"}`}>
        {Toolbar}
        {Charts}
      </div>
      {/* Sidebar — only rendered in fullscreen, but its absence doesn't affect chart divs */}
      {fullscreen && Sidebar}
    </div>
  )
}
