import { NextRequest, NextResponse } from "next/server"
import { getOHLCV, getOHLCVYahooFallback } from "@/lib/marketData"

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol") ?? "AAPL"

  try {
    const to   = new Date().toISOString().slice(0, 10)
    const from = new Date(Date.now() - 90 * 86400_000).toISOString().slice(0, 10)

    const ohlcv = await getOHLCV(symbol, from, to, "day")
    const raw   = ohlcv.length > 0 ? ohlcv : await getOHLCVYahooFallback(symbol)

    const closes    = raw.map(b => b.close)
    const highs     = raw.map(b => b.high)
    const lows      = raw.map(b => b.low)
    const volumes   = raw.map(b => b.volume)
    const dates     = raw.map(b => b.date)

    // Moyennes mobiles
    const ma20 = closes.map((_, i) => {
      if (i < 19) return null
      const slice = closes.slice(i - 19, i + 1)
      return parseFloat((slice.reduce((a, b) => a + b, 0) / 20).toFixed(2))
    })
    const ma50 = closes.map((_, i) => {
      if (i < 49) return null
      const slice = closes.slice(i - 49, i + 1)
      return parseFloat((slice.reduce((a, b) => a + b, 0) / 50).toFixed(2))
    })

    // RSI 14
    const rsi = closes.map((_, i) => {
      if (i < 14) return null
      const changes = closes.slice(i - 13, i + 1).map((c, j, arr) =>
        j === 0 ? 0 : c - arr[j - 1]
      )
      const gains  = changes.filter(c => c > 0)
      const losses = changes.filter(c => c < 0).map(Math.abs)
      const avgGain = gains.reduce((a, b) => a + b, 0) / 14
      const avgLoss = losses.reduce((a, b) => a + b, 0) / 14
      if (avgLoss === 0) return 100
      return parseFloat((100 - 100 / (1 + avgGain / avgLoss)).toFixed(2))
    })

    // Support / résistance sur 30 derniers jours
    const recent     = closes.slice(-30).filter(Boolean)
    const support    = parseFloat(Math.min(...recent).toFixed(2))
    const resistance = parseFloat(Math.max(...recent).toFixed(2))

    // Signaux
    const signals: any[] = []
    closes.forEach((_, i) => {
      if (i < 20) return
      const rsiVal = rsi[i]
      const date   = dates[i]
      const price  = closes[i]
      if (rsiVal && rsiVal < 30)        signals.push({ type: "buy",  reason: "RSI survendu",       price, date })
      else if (rsiVal && rsiVal > 70)   signals.push({ type: "sell", reason: "RSI suracheté",       price, date })
      else if (ma20[i] && ma50[i] && ma20[i - 1] && ma50[i - 1] &&
        ma20[i - 1]! < ma50[i - 1]! && ma20[i]! > ma50[i]!)
        signals.push({ type: "buy",  reason: "Croisement MM20/MM50", price, date })
      else if (ma20[i] && ma50[i] && ma20[i - 1] && ma50[i - 1] &&
        ma20[i - 1]! > ma50[i - 1]! && ma20[i]! < ma50[i]!)
        signals.push({ type: "sell", reason: "Croisement MM20/MM50", price, date })
    })

    const bars = raw.map((b, i) => ({
      date:   new Date(b.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }),
      close:  parseFloat(closes[i].toFixed(2)),
      high:   parseFloat(highs[i].toFixed(2)),
      low:    parseFloat(lows[i].toFixed(2)),
      volume: volumes[i],
      ma20:   ma20[i],
      ma50:   ma50[i],
      rsi:    rsi[i],
      signal: signals.find(s => s.date === dates[i]) ?? null,
    }))

    return NextResponse.json({ bars, support, resistance, signals: signals.slice(-8) })
  } catch {
    return NextResponse.json({ error: "Chart error" }, { status: 500 })
  }
}
