import { NextResponse } from "next/server"

export const runtime = "nodejs"

export type FearGreedResult = {
  score: number
  label: "Peur Extrême" | "Peur" | "Neutre" | "Cupidité" | "Cupidité Extrême"
  color: string
  components: { vix: number; momentum: number; breadth: number; sentiment: number }
  previous_close: number
  change: number
  updated_at: string
}

const cache = new Map<string, { data: FearGreedResult; ts: number }>()
const prevCloseMap = new Map<string, number>()
const CACHE_TTL = 15 * 60 * 1000

function vixToScore(vix: number): number {
  if (vix < 12) return 90
  if (vix < 15) return 80
  if (vix < 20) return 60
  if (vix < 25) return 40
  if (vix < 30) return 25
  if (vix < 40) return 10
  return 5
}

function rsiToScore(rsi: number): number {
  if (rsi > 70) return 85
  if (rsi > 60) return 70
  if (rsi > 50) return 55
  if (rsi > 40) return 40
  if (rsi > 30) return 25
  return 10
}

function scoreToLabel(score: number): { label: FearGreedResult["label"]; color: string } {
  if (score <= 25) return { label: "Peur Extrême", color: "#ef4444" }
  if (score <= 45) return { label: "Peur", color: "#f97316" }
  if (score <= 55) return { label: "Neutre", color: "#facc15" }
  if (score <= 75) return { label: "Cupidité", color: "#84cc16" }
  return { label: "Cupidité Extrême", color: "#22c55e" }
}

function calcRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50
  let gains = 0, losses = 0
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1]
    if (diff > 0) gains += diff
    else losses += Math.abs(diff)
  }
  const avgGain = gains / period
  const avgLoss = losses / period
  if (avgLoss === 0) return 100
  const rs = avgGain / avgLoss
  return 100 - 100 / (1 + rs)
}

async function fetchVIX(): Promise<{ current: number; prevClose: number }> {
  const res = await fetch(
    "https://query1.finance.yahoo.com/v8/finance/chart/%5EVIX?interval=1d&range=2d",
    { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(5000) }
  )
  if (!res.ok) throw new Error("VIX fetch failed")
  const data = await res.json()
  const closes: number[] = data?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? []
  const validCloses = closes.filter((c: number | null) => c != null) as number[]
  if (validCloses.length < 2) throw new Error("Not enough VIX data")
  return { current: validCloses[validCloses.length - 1], prevClose: validCloses[validCloses.length - 2] }
}

async function fetchSPYCloses(): Promise<number[]> {
  const res = await fetch(
    "https://query1.finance.yahoo.com/v8/finance/chart/SPY?interval=1d&range=30d",
    { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(5000) }
  )
  if (!res.ok) return []
  const data = await res.json()
  const closes: (number | null)[] = data?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? []
  return closes.filter((c): c is number => c != null)
}

async function fetchBreadth(): Promise<number> {
  const symbols = ["AAPL", "MSFT", "NVDA", "TSLA", "META", "GOOGL", "AMZN", "JPM", "XOM", "JNJ"]
  const results = await Promise.allSettled(
    symbols.map(async (sym) => {
      const res = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=1d&range=2d`,
        { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(5000) }
      )
      if (!res.ok) return null
      const data = await res.json()
      const closes: (number | null)[] = data?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? []
      const valid = closes.filter((c): c is number => c != null)
      if (valid.length < 2) return null
      return valid[valid.length - 1] > valid[valid.length - 2]
    })
  )
  const settled = results.filter(r => r.status === "fulfilled" && r.value !== null)
  const above = settled.filter(r => r.status === "fulfilled" && r.value === true).length
  return settled.length > 0 ? Math.round((above / settled.length) * 100) : 50
}

export async function GET() {
  const cached = cache.get("fg")
  if (cached && Date.now() - cached.ts < CACHE_TTL) return NextResponse.json(cached.data)

  try {
    const [vixData, spyCloses, breadthScore] = await Promise.all([
      fetchVIX(),
      fetchSPYCloses(),
      fetchBreadth(),
    ])

    const vixScore = vixToScore(vixData.current)
    const rsi = calcRSI(spyCloses)
    const momentumScore = rsiToScore(rsi)
    const sentimentFallback = 50

    const score = Math.round(
      vixScore * 0.3 + momentumScore * 0.3 + breadthScore * 0.25 + sentimentFallback * 0.15
    )

    const prevClose = prevCloseMap.get("fg") ?? vixData.prevClose
    const change = vixData.current - vixData.prevClose
    prevCloseMap.set("fg", vixData.current)

    const { label, color } = scoreToLabel(score)

    const result: FearGreedResult = {
      score,
      label,
      color,
      components: {
        vix: vixScore,
        momentum: momentumScore,
        breadth: breadthScore,
        sentiment: sentimentFallback,
      },
      previous_close: vixData.prevClose,
      change: Math.round(change * 100) / 100,
      updated_at: new Date().toISOString(),
    }

    cache.set("fg", { data: result, ts: Date.now() })
    return NextResponse.json(result)
  } catch (e) {
    console.error("[fear-greed] error:", e)
    const fallback: FearGreedResult = {
      score: 50,
      label: "Neutre",
      color: "#facc15",
      components: { vix: 50, momentum: 50, breadth: 50, sentiment: 50 },
      previous_close: 0,
      change: 0,
      updated_at: new Date().toISOString(),
    }
    return NextResponse.json(fallback)
  }
}
