import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"
export const maxDuration = 30

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "")
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const period = req.nextUrl.searchParams.get("period") ?? "1M"

  // Check cache (1h)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { data: cached } = await supabase
    .from("report_cache")
    .select("content, created_at")
    .eq("user_id", user.id)
    .eq("report_type", "portfolio")
    .eq("period", period)
    .gte("created_at", oneHourAgo)
    .single()

  if (cached?.content) return NextResponse.json({ ...cached.content, cached: true })

  // Period filter
  const now = new Date()
  let fromDate: Date | null = null
  if (period === "1M") fromDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  else if (period === "3M") fromDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
  else if (period === "6M") fromDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000)
  else if (period === "1Y") fromDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)

  // Fetch orders
  let ordersQuery = supabase
    .from("orders")
    .select("symbol, side, price, qty, total, status, created_at")
    .eq("user_id", user.id)
    .eq("status", "filled")
    .order("created_at", { ascending: true })

  if (fromDate) ordersQuery = ordersQuery.gte("created_at", fromDate.toISOString())

  const { data: orders } = await ordersQuery

  // Fetch performance snapshots
  let snapshotsQuery = supabase
    .from("performance_snapshots")
    .select("date, portfolio_value, daily_pnl, daily_pnl_pct, trades_count, winning_trades, spy_return_pct")
    .eq("user_id", user.id)
    .order("date", { ascending: true })

  if (fromDate) snapshotsQuery = snapshotsQuery.gte("date", fromDate.toISOString().slice(0, 10))

  const { data: snapshots } = await snapshotsQuery

  // Fetch current positions
  const { data: positions } = await supabase
    .from("positions")
    .select("symbol, qty, avg_price, current_price")
    .eq("user_id", user.id)

  const { data: account } = await supabase
    .from("paper_accounts")
    .select("cash")
    .eq("user_id", user.id)
    .single()

  const safeOrders = orders ?? []
  const safeSnapshots = snapshots ?? []
  const safePositions = positions ?? []

  // ── Compute statistics ──

  // Portfolio value
  const posValue = safePositions.reduce((s: number, p: { qty: number; current_price: number | null; avg_price: number }) => s + p.qty * (p.current_price ?? p.avg_price), 0)
  const portfolioValue = (account?.cash ?? 100000) + posValue
  const totalPnl = portfolioValue - 100000
  const totalPnlPct = (totalPnl / 100000) * 100

  // Per-trade P&L (match buys to sells by symbol)
  type TradePnL = { symbol: string; pnl: number; pnlPct: number; date: string; duration: number }
  const tradesPnl: TradePnL[] = []
  const buyMap: Record<string, { price: number; qty: number; date: string }[]> = {}

  for (const o of safeOrders) {
    if (o.side === "buy") {
      if (!buyMap[o.symbol]) buyMap[o.symbol] = []
      buyMap[o.symbol].push({ price: o.price, qty: o.qty, date: o.created_at })
    } else if (o.side === "sell" && buyMap[o.symbol]?.length) {
      const buy = buyMap[o.symbol].shift()!
      const pnl = (o.price - buy.price) * Math.min(o.qty, buy.qty)
      const pnlPct = ((o.price - buy.price) / buy.price) * 100
      const duration = (new Date(o.created_at).getTime() - new Date(buy.date).getTime()) / (1000 * 60 * 60)
      tradesPnl.push({ symbol: o.symbol, pnl, pnlPct, date: o.created_at, duration })
    }
  }

  const winners = tradesPnl.filter(t => t.pnl > 0)
  const losers = tradesPnl.filter(t => t.pnl < 0)
  const winRate = tradesPnl.length > 0 ? Math.round((winners.length / tradesPnl.length) * 100) : 0
  const grossProfit = winners.reduce((s, t) => s + t.pnl, 0)
  const grossLoss = Math.abs(losers.reduce((s, t) => s + t.pnl, 0))
  const profitFactor = grossLoss > 0 ? +(grossProfit / grossLoss).toFixed(2) : grossProfit > 0 ? 999 : 0
  const avgWin = winners.length > 0 ? grossProfit / winners.length : 0
  const avgLoss = losers.length > 0 ? grossLoss / losers.length : 0
  const avgRR = avgLoss > 0 ? +(avgWin / avgLoss).toFixed(2) : avgWin > 0 ? 999 : 0

  const bestTrade = tradesPnl.reduce((best, t) => t.pnlPct > (best?.pnlPct ?? -Infinity) ? t : best, null as TradePnL | null)
  const worstTrade = tradesPnl.reduce((worst, t) => t.pnlPct < (worst?.pnlPct ?? Infinity) ? t : worst, null as TradePnL | null)

  // Sharpe & Sortino from daily snapshots
  const dailyReturns = safeSnapshots.map((s: { daily_pnl_pct: number | null }) => s.daily_pnl_pct ?? 0)
  const avgReturn = dailyReturns.length > 0 ? dailyReturns.reduce((a: number, b: number) => a + b, 0) / dailyReturns.length : 0
  const stdDev = dailyReturns.length > 1
    ? Math.sqrt(dailyReturns.reduce((s: number, r: number) => s + Math.pow(r - avgReturn, 2), 0) / (dailyReturns.length - 1))
    : 0
  const annualizedVol = stdDev * Math.sqrt(252)
  const sharpe = stdDev > 0 ? +((avgReturn * 252) / (stdDev * Math.sqrt(252))).toFixed(2) : 0

  const downside = dailyReturns.filter((r: number) => r < 0)
  const downsideStd = downside.length > 1
    ? Math.sqrt(downside.reduce((s: number, r: number) => s + r * r, 0) / downside.length)
    : 0
  const sortino = downsideStd > 0 ? +((avgReturn * 252) / (downsideStd * Math.sqrt(252))).toFixed(2) : 0

  // Max Drawdown
  let peak = 100000
  let maxDrawdown = 0
  for (const s of safeSnapshots) {
    const val = s.portfolio_value ?? 100000
    if (val > peak) peak = val
    const dd = ((peak - val) / peak) * 100
    if (dd > maxDrawdown) maxDrawdown = dd
  }
  maxDrawdown = +maxDrawdown.toFixed(2)

  // Per-asset stats
  const assetMap: Record<string, { trades: number; wins: number; pnl: number; bestPct: number; worstPct: number }> = {}
  for (const t of tradesPnl) {
    if (!assetMap[t.symbol]) assetMap[t.symbol] = { trades: 0, wins: 0, pnl: 0, bestPct: -Infinity, worstPct: Infinity }
    assetMap[t.symbol].trades++
    if (t.pnl > 0) assetMap[t.symbol].wins++
    assetMap[t.symbol].pnl += t.pnl
    if (t.pnlPct > assetMap[t.symbol].bestPct) assetMap[t.symbol].bestPct = t.pnlPct
    if (t.pnlPct < assetMap[t.symbol].worstPct) assetMap[t.symbol].worstPct = t.pnlPct
  }
  const perAsset = Object.entries(assetMap).map(([symbol, d]) => ({
    symbol,
    trades: d.trades,
    winRate: d.trades > 0 ? Math.round((d.wins / d.trades) * 100) : 0,
    pnl: +d.pnl.toFixed(2),
    bestTradePct: d.bestPct === -Infinity ? 0 : +d.bestPct.toFixed(2),
    worstTradePct: d.worstPct === Infinity ? 0 : +d.worstPct.toFixed(2),
  })).sort((a, b) => b.pnl - a.pnl)

  // Classify sector (simple heuristic)
  function classifyAsset(symbol: string): string {
    if (["BTC-USD","ETH-USD","SOL-USD","ADA-USD","DOGE-USD"].includes(symbol)) return "Crypto"
    if (["SPY","QQQ","IWM","TLT","GLD","SLV","VTI"].includes(symbol)) return "ETF"
    const techSymbols = ["AAPL","MSFT","NVDA","GOOGL","META","AMZN","AMD","TSLA","NFLX","CRM","ORCL","ADBE","INTC","QCOM","AVGO","TSM","ASML","NOW","SNOW","PLTR"]
    if (techSymbols.includes(symbol)) return "Tech"
    return "Actions"
  }

  const sectorMap: Record<string, number> = {}
  for (const t of tradesPnl) {
    const sector = classifyAsset(t.symbol)
    sectorMap[sector] = (sectorMap[sector] ?? 0) + t.pnl
  }
  const perSector = Object.entries(sectorMap).map(([sector, pnl]) => ({ sector, pnl: +pnl.toFixed(2) }))

  // Heatmap by day/hour
  type HeatCell = { day: number; hour: number; pnl: number; count: number }
  const heatMap: Record<string, HeatCell> = {}
  for (const t of tradesPnl) {
    const d = new Date(t.date)
    const key = `${d.getDay()}-${d.getHours()}`
    if (!heatMap[key]) heatMap[key] = { day: d.getDay(), hour: d.getHours(), pnl: 0, count: 0 }
    heatMap[key].pnl += t.pnl
    heatMap[key].count++
  }
  const heatmapData = Object.values(heatMap)

  // Return distribution buckets
  const buckets: Record<string, number> = {
    "<-10%": 0, "-10 à -5%": 0, "-5 à -2%": 0, "-2 à 0%": 0,
    "0 à 2%": 0, "2 à 5%": 0, "5 à 10%": 0, ">10%": 0,
  }
  for (const t of tradesPnl) {
    const p = t.pnlPct
    if (p < -10) buckets["<-10%"]++
    else if (p < -5) buckets["-10 à -5%"]++
    else if (p < -2) buckets["-5 à -2%"]++
    else if (p < 0) buckets["-2 à 0%"]++
    else if (p < 2) buckets["0 à 2%"]++
    else if (p < 5) buckets["2 à 5%"]++
    else if (p < 10) buckets["5 à 10%"]++
    else buckets[">10%"]++
  }
  const returnDistribution = Object.entries(buckets).map(([range, count]) => ({ range, count }))

  // Avg duration winners vs losers
  const avgWinDuration = winners.length > 0 ? +(winners.reduce((s, t) => s + t.duration, 0) / winners.length).toFixed(1) : 0
  const avgLossDuration = losers.length > 0 ? +(losers.reduce((s, t) => s + t.duration, 0) / losers.length).toFixed(1) : 0

  // Benchmark equity curve (mock SPY/QQQ/BTC relative performance, base 100)
  const benchmarkCurve = safeSnapshots.map((s: { date: string; portfolio_value: number | null; spy_return_pct: number | null }) => ({
    date: s.date,
    portfolio: s.portfolio_value ? +((s.portfolio_value / 100000) * 100).toFixed(2) : 100,
    spy: 100 + (s.spy_return_pct ?? 0),
  }))

  const result = {
    period,
    portfolioValue: +portfolioValue.toFixed(2),
    totalPnl: +totalPnl.toFixed(2),
    totalPnlPct: +totalPnlPct.toFixed(2),
    totalTrades: safeOrders.length,
    closedTrades: tradesPnl.length,
    winRate,
    profitFactor,
    avgRR,
    sharpe,
    sortino,
    maxDrawdown,
    annualizedVol: +annualizedVol.toFixed(2),
    bestTrade,
    worstTrade,
    avgWinDuration,
    avgLossDuration,
    perAsset,
    perSector,
    heatmapData,
    returnDistribution,
    benchmarkCurve,
    dailySnapshots: safeSnapshots,
  }

  // Cache it
  await supabase.from("report_cache").upsert({
    user_id: user.id,
    report_type: "portfolio",
    period,
    content: result,
    created_at: new Date().toISOString(),
  }, { onConflict: "user_id,report_type,period" })

  return NextResponse.json(result)
}
