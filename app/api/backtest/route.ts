import { NextRequest, NextResponse } from "next/server"

export const maxDuration = 60

// ─── Indicator helpers ────────────────────────────────────────────────────────

function calcRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50
  let gains = 0, losses = 0
  for (let i = closes.length - period; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1]
    if (d > 0) gains += d; else losses -= d
  }
  const ag = gains / period, al = losses / period
  if (al === 0) return 100
  return 100 - 100 / (1 + ag / al)
}

function calcEMA(closes: number[], period: number): number {
  if (closes.length < period) return closes[closes.length - 1] ?? 0
  const k = 2 / (period + 1)
  let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period
  for (let i = period; i < closes.length; i++) ema = closes[i] * k + ema * (1 - k)
  return ema
}

function calcEMAAtIndex(closes: number[], period: number, endIdx: number): number {
  const slice = closes.slice(0, endIdx + 1)
  return calcEMA(slice, period)
}

function calcMACD(closes: number[]): { histogram: number; prevHistogram: number } {
  if (closes.length < 35) return { histogram: 0, prevHistogram: 0 }
  const k12 = 2 / 13, k26 = 2 / 27, k9 = 2 / 10
  let ema12 = closes.slice(0, 12).reduce((a, b) => a + b, 0) / 12
  let ema26 = closes.slice(0, 26).reduce((a, b) => a + b, 0) / 26
  const macdLine: number[] = []
  for (let i = 12; i < closes.length; i++) {
    ema12 = closes[i] * k12 + ema12 * (1 - k12)
    if (i >= 25) {
      ema26 = closes[i] * k26 + ema26 * (1 - k26)
      macdLine.push(ema12 - ema26)
    }
  }
  if (macdLine.length < 9) return { histogram: 0, prevHistogram: 0 }
  let signal = macdLine.slice(0, 9).reduce((a, b) => a + b, 0) / 9
  for (let i = 9; i < macdLine.length; i++) signal = macdLine[i] * k9 + signal * (1 - k9)
  const h = macdLine[macdLine.length - 1] - signal
  const ph = (macdLine[macdLine.length - 2] ?? macdLine[macdLine.length - 1]) - signal
  return { histogram: h, prevHistogram: ph }
}

function calcBB(closes: number[], period = 20): { upper: number; lower: number } {
  if (closes.length < period) {
    const c = closes[closes.length - 1] ?? 0
    return { upper: c * 1.02, lower: c * 0.98 }
  }
  const slice = closes.slice(-period)
  const sma = slice.reduce((a, b) => a + b, 0) / period
  const std = Math.sqrt(slice.reduce((a, b) => a + (b - sma) ** 2, 0) / period)
  return { upper: sma + 2 * std, lower: sma - 2 * std }
}

function calcVolumeRatio(volumes: number[], period = 20): number {
  if (volumes.length < period + 1) return 1
  const avgVol = volumes.slice(-period - 1, -1).reduce((a, b) => a + b, 0) / period
  return avgVol === 0 ? 1 : volumes[volumes.length - 1] / avgVol
}

// ─── Strategy signal functions ─────────────────────────────────────────────────

type Signal = "buy" | "sell" | null

function signalRSI(closes: number[], i: number): Signal {
  const slice = closes.slice(0, i + 1)
  const rsi = calcRSI(slice)
  const prevRsi = calcRSI(slice.slice(0, -1))
  if (prevRsi >= 30 && rsi < 30) return "buy"
  if (prevRsi <= 70 && rsi > 70) return "sell"
  return null
}

function signalMACross(closes: number[], i: number): Signal {
  if (i < 22) return null
  const slice = closes.slice(0, i + 1)
  const ema9 = calcEMA(slice, 9)
  const ema21 = calcEMA(slice, 21)
  const prevSlice = slice.slice(0, -1)
  const prevEma9 = calcEMA(prevSlice, 9)
  const prevEma21 = calcEMA(prevSlice, 21)
  if (prevEma9 <= prevEma21 && ema9 > ema21) return "buy"
  if (prevEma9 >= prevEma21 && ema9 < ema21) return "sell"
  return null
}

function signalBBBounce(closes: number[], i: number): Signal {
  if (i < 20) return null
  const slice = closes.slice(0, i + 1)
  const price = slice[slice.length - 1]
  const prevPrice = slice[slice.length - 2]
  const { upper, lower } = calcBB(slice.slice(0, -1))
  if (prevPrice <= lower && price > lower) return "buy"
  if (prevPrice >= upper && price < upper) return "sell"
  return null
}

function signalMACDCross(closes: number[], i: number): Signal {
  if (i < 35) return null
  const slice = closes.slice(0, i + 1)
  const { histogram, prevHistogram } = calcMACD(slice)
  if (prevHistogram <= 0 && histogram > 0) return "buy"
  if (prevHistogram >= 0 && histogram < 0) return "sell"
  return null
}

function signalConfluence3(
  closes: number[],
  volumes: number[],
  i: number
): Signal {
  if (i < 35) return null
  const slice = closes.slice(0, i + 1)
  const volSlice = volumes.slice(0, i + 1)
  const rsi = calcRSI(slice)
  const ema9 = calcEMA(slice, 9)
  const ema21 = calcEMA(slice, 21)
  const { upper, lower } = calcBB(slice)
  const price = slice[slice.length - 1]
  const { histogram } = calcMACD(slice)
  const volRatio = calcVolumeRatio(volSlice)

  const bullish = [
    rsi < 40,
    ema9 > ema21,
    price < lower * 1.01,
    histogram > 0,
    volRatio > 1.3,
  ].filter(Boolean).length

  const bearish = [
    rsi > 60,
    ema9 < ema21,
    price > upper * 0.99,
    histogram < 0,
    volRatio > 1.3,
  ].filter(Boolean).length

  if (bullish >= 3) return "buy"
  if (bearish >= 3) return "sell"
  return null
}

// ─── Backtest simulation ───────────────────────────────────────────────────────

type Trade = {
  date: string
  type: "buy" | "sell"
  price: number
  exit_price: number
  exit_date: string
  exit_reason: "tp" | "sl" | "signal"
  return_pct: number
  pnl: number
}

type EquityPoint = { date: string; value: number }

function runBacktest(params: {
  strategy: string
  dates: string[]
  closes: number[]
  highs: number[]
  lows: number[]
  volumes: number[]
  initial_capital: number
  tp_pct: number
  sl_pct: number
}): {
  trades: Trade[]
  equity_curve: EquityPoint[]
} {
  const { strategy, dates, closes, highs, lows, volumes, initial_capital, tp_pct, sl_pct } = params
  const trades: Trade[] = []
  const equity_curve: EquityPoint[] = []

  let capital = initial_capital
  let position: { entry_price: number; entry_date: string; entry_idx: number; shares: number } | null = null

  equity_curve.push({ date: dates[0], value: capital })

  for (let i = 1; i < closes.length; i++) {
    let sig: Signal = null
    if (strategy === "rsi_reversal") sig = signalRSI(closes, i)
    else if (strategy === "ma_crossover") sig = signalMACross(closes, i)
    else if (strategy === "bb_bounce") sig = signalBBBounce(closes, i)
    else if (strategy === "macd_cross") sig = signalMACDCross(closes, i)
    else if (strategy === "confluence_3") sig = signalConfluence3(closes, volumes, i)

    if (position) {
      const tp = position.entry_price * (1 + tp_pct / 100)
      const sl = position.entry_price * (1 - sl_pct / 100)

      let exit_price: number | null = null
      let exit_reason: "tp" | "sl" | "signal" | null = null

      if (highs[i] >= tp) { exit_price = tp; exit_reason = "tp" }
      else if (lows[i] <= sl) { exit_price = sl; exit_reason = "sl" }
      else if (sig === "sell") { exit_price = closes[i]; exit_reason = "signal" }

      if (exit_price !== null && exit_reason !== null) {
        const ret_pct = ((exit_price - position.entry_price) / position.entry_price) * 100
        const pnl = position.shares * (exit_price - position.entry_price)
        capital += pnl
        trades.push({
          date: position.entry_date,
          type: "buy",
          price: position.entry_price,
          exit_price,
          exit_date: dates[i],
          exit_reason,
          return_pct: ret_pct,
          pnl,
        })
        position = null
      }
    } else if (sig === "buy") {
      const entry_price = closes[i]
      const shares = capital / entry_price
      position = { entry_price, entry_date: dates[i], entry_idx: i, shares }
    }

    // Equity = cash if flat, or mark-to-market if in position
    const current_value = position
      ? position.shares * closes[i]
      : capital
    equity_curve.push({ date: dates[i], value: Math.round(current_value * 100) / 100 })
  }

  // Force-close open position at end
  if (position) {
    const exit_price = closes[closes.length - 1]
    const ret_pct = ((exit_price - position.entry_price) / position.entry_price) * 100
    const pnl = position.shares * (exit_price - position.entry_price)
    capital += pnl
    trades.push({
      date: position.entry_date,
      type: "buy",
      price: position.entry_price,
      exit_price,
      exit_date: dates[dates.length - 1],
      exit_reason: "signal",
      return_pct: ret_pct,
      pnl,
    })
  }

  return { trades, equity_curve }
}

// ─── Metrics ───────────────────────────────────────────────────────────────────

function calcMetrics(
  trades: Trade[],
  equity_curve: EquityPoint[],
  initial_capital: number
) {
  const total_trades = trades.length
  if (total_trades === 0) {
    return {
      total_trades: 0, winning_trades: 0, losing_trades: 0,
      win_rate: 0, total_return: 0, max_drawdown: 0,
      sharpe_ratio: 0, profit_factor: 0, avg_trade_return: 0,
      best_trade: 0, worst_trade: 0,
    }
  }

  const winning_trades = trades.filter(t => t.return_pct > 0).length
  const losing_trades = trades.filter(t => t.return_pct <= 0).length
  const win_rate = (winning_trades / total_trades) * 100

  const final_value = equity_curve[equity_curve.length - 1]?.value ?? initial_capital
  const total_return = ((final_value - initial_capital) / initial_capital) * 100

  // Max drawdown
  let peak = initial_capital, max_drawdown = 0
  for (const pt of equity_curve) {
    if (pt.value > peak) peak = pt.value
    const dd = ((peak - pt.value) / peak) * 100
    if (dd > max_drawdown) max_drawdown = dd
  }

  // Sharpe ratio (using daily returns from equity curve)
  const daily_returns: number[] = []
  for (let i = 1; i < equity_curve.length; i++) {
    const r = (equity_curve[i].value - equity_curve[i - 1].value) / equity_curve[i - 1].value
    daily_returns.push(r)
  }
  const avg_r = daily_returns.reduce((a, b) => a + b, 0) / (daily_returns.length || 1)
  const std_r = Math.sqrt(
    daily_returns.reduce((a, b) => a + (b - avg_r) ** 2, 0) / (daily_returns.length || 1)
  )
  const sharpe_ratio = std_r === 0 ? 0 : (avg_r / std_r) * Math.sqrt(252)

  // Profit factor
  const gross_profit = trades.filter(t => t.pnl > 0).reduce((a, t) => a + t.pnl, 0)
  const gross_loss = Math.abs(trades.filter(t => t.pnl < 0).reduce((a, t) => a + t.pnl, 0))
  const profit_factor = gross_loss === 0 ? (gross_profit > 0 ? 99 : 0) : gross_profit / gross_loss

  const avg_trade_return = trades.reduce((a, t) => a + t.return_pct, 0) / total_trades
  const best_trade = Math.max(...trades.map(t => t.return_pct))
  const worst_trade = Math.min(...trades.map(t => t.return_pct))

  return {
    total_trades, winning_trades, losing_trades, win_rate,
    total_return, max_drawdown,
    sharpe_ratio: Math.round(sharpe_ratio * 100) / 100,
    profit_factor: Math.round(profit_factor * 100) / 100,
    avg_trade_return,
    best_trade, worst_trade,
  }
}

// ─── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const body = await req.json()
  const {
    symbol,
    strategy,
    start_date,
    end_date,
    initial_capital = 10000,
    tp_pct = 5,
    sl_pct = 3,
  } = body

  if (!symbol || !strategy) {
    return NextResponse.json({ error: "symbol and strategy required" }, { status: 400 })
  }

  const STRATEGIES = ["rsi_reversal", "ma_crossover", "bb_bounce", "macd_cross", "confluence_3"]
  if (!STRATEGIES.includes(strategy)) {
    return NextResponse.json({ error: "unknown strategy" }, { status: 400 })
  }

  // Build date range — default to 1 year max
  const endTs = end_date ? Math.floor(new Date(end_date).getTime() / 1000) : Math.floor(Date.now() / 1000)
  const startTs = start_date
    ? Math.floor(new Date(start_date).getTime() / 1000)
    : endTs - 365 * 24 * 3600

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&period1=${startTs}&period2=${endTs}`

  let json: any
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      cache: "no-store",
    })
    json = await res.json()
  } catch {
    return NextResponse.json({ error: "Yahoo Finance fetch failed" }, { status: 500 })
  }

  const result = json?.chart?.result?.[0]
  if (!result) return NextResponse.json({ error: "No data from Yahoo Finance" }, { status: 404 })

  const timestamps: number[] = result.timestamp ?? []
  const q = result.indicators?.quote?.[0] ?? {}
  const rawCloses: (number | null)[] = q.close ?? []
  const rawHighs: (number | null)[] = q.high ?? []
  const rawLows: (number | null)[] = q.low ?? []
  const rawVols: (number | null)[] = q.volume ?? []

  // Filter out null candles
  const candles = timestamps
    .map((ts, i) => ({
      date: new Date(ts * 1000).toISOString().slice(0, 10),
      close: rawCloses[i],
      high: rawHighs[i],
      low: rawLows[i],
      volume: rawVols[i] ?? 0,
    }))
    .filter(c => c.close != null && c.high != null && c.low != null) as {
    date: string; close: number; high: number; low: number; volume: number
  }[]

  if (candles.length < 30) {
    return NextResponse.json({ error: "Not enough data (min 30 candles)" }, { status: 400 })
  }

  const dates = candles.map(c => c.date)
  const closes = candles.map(c => c.close)
  const highs = candles.map(c => c.high)
  const lows = candles.map(c => c.low)
  const volumes = candles.map(c => c.volume)

  const { trades, equity_curve } = runBacktest({
    strategy, dates, closes, highs, lows, volumes,
    initial_capital: Number(initial_capital),
    tp_pct: Number(tp_pct),
    sl_pct: Number(sl_pct),
  })

  const metrics = calcMetrics(trades, equity_curve, Number(initial_capital))

  return NextResponse.json({
    symbol: symbol.toUpperCase(),
    strategy,
    period: { start: dates[0], end: dates[dates.length - 1], candles: candles.length },
    ...metrics,
    trades: trades.map(t => ({
      date: t.date,
      exit_date: t.exit_date,
      type: t.type,
      price: Math.round(t.price * 100) / 100,
      exit_price: Math.round(t.exit_price * 100) / 100,
      exit_reason: t.exit_reason,
      return_pct: Math.round(t.return_pct * 100) / 100,
      pnl: Math.round(t.pnl * 100) / 100,
    })),
    equity_curve,
  })
}
