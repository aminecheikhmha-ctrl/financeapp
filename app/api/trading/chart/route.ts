import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol") ?? "AAPL"

  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=3mo`,
      { headers: { "User-Agent": "Mozilla/5.0" } }
    )
    const data = await res.json()
    const result = data?.chart?.result?.[0]
    const timestamps = result?.timestamp ?? []
    const closes = result?.indicators?.quote?.[0]?.close ?? []
    const highs = result?.indicators?.quote?.[0]?.high ?? []
    const lows = result?.indicators?.quote?.[0]?.low ?? []
    const volumes = result?.indicators?.quote?.[0]?.volume ?? []

    // Moyennes mobiles
    const ma20 = closes.map((_: any, i: number) => {
      if (i < 19) return null
      const slice = closes.slice(i - 19, i + 1)
      return parseFloat((slice.reduce((a: number, b: number) => a + b, 0) / 20).toFixed(2))
    })
    const ma50 = closes.map((_: any, i: number) => {
      if (i < 49) return null
      const slice = closes.slice(i - 49, i + 1)
      return parseFloat((slice.reduce((a: number, b: number) => a + b, 0) / 50).toFixed(2))
    })

    // RSI 14
    const rsi = closes.map((_: any, i: number) => {
      if (i < 14) return null
      const changes = closes.slice(i - 13, i + 1).map((c: number, j: number, arr: number[]) =>
        j === 0 ? 0 : c - arr[j - 1]
      )
      const gains = changes.filter((c: number) => c > 0)
      const losses = changes.filter((c: number) => c < 0).map(Math.abs)
      const avgGain = gains.reduce((a: number, b: number) => a + b, 0) / 14
      const avgLoss = losses.reduce((a: number, b: number) => a + b, 0) / 14
      if (avgLoss === 0) return 100
      return parseFloat((100 - 100 / (1 + avgGain / avgLoss)).toFixed(2))
    })

    // Support / résistance sur 30 derniers jours
    const recent = closes.slice(-30).filter(Boolean)
    const support = parseFloat(Math.min(...recent).toFixed(2))
    const resistance = parseFloat(Math.max(...recent).toFixed(2))

    // Signaux
    const signals: any[] = []
    closes.forEach((_: any, i: number) => {
      if (i < 20) return
      const rsiVal = rsi[i]
      const date = new Date(timestamps[i] * 1000).toISOString().split("T")[0]
      const price = closes[i]
      if (rsiVal && rsiVal < 30) signals.push({ type: "buy", reason: "RSI survendu", price, date })
      else if (rsiVal && rsiVal > 70) signals.push({ type: "sell", reason: "RSI suracheté", price, date })
      else if (ma20[i] && ma50[i] && ma20[i - 1] && ma50[i - 1] &&
        ma20[i - 1] < ma50[i - 1] && ma20[i] > ma50[i])
        signals.push({ type: "buy", reason: "Croisement MM20/MM50", price, date })
      else if (ma20[i] && ma50[i] && ma20[i - 1] && ma50[i - 1] &&
        ma20[i - 1] > ma50[i - 1] && ma20[i] < ma50[i])
        signals.push({ type: "sell", reason: "Croisement MM20/MM50", price, date })
    })

    const bars = timestamps.map((t: number, i: number) => ({
      date: new Date(t * 1000).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }),
      close: parseFloat((closes[i] ?? 0).toFixed(2)),
      high: parseFloat((highs[i] ?? 0).toFixed(2)),
      low: parseFloat((lows[i] ?? 0).toFixed(2)),
      volume: volumes[i] ?? 0,
      ma20: ma20[i],
      ma50: ma50[i],
      rsi: rsi[i],
      signal: signals.find(s => s.date === new Date(t * 1000).toISOString().split("T")[0]) ?? null,
    }))

    return NextResponse.json({ bars, support, resistance, signals: signals.slice(-8) })
  } catch (e) {
    return NextResponse.json({ error: "Chart error" }, { status: 500 })
  }
}