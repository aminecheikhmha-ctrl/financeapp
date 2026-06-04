export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"
import Groq from "groq-sdk"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"
export const maxDuration = 30

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_KEY || "placeholder"
)

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

const SYMBOLS = ["SPY", "QQQ", "TLT", "GLD", "VIX"]

const FALLBACK_RESULT = {
  regime: "transition",
  vix_level: "elevated",
  trend: "neutre",
  force: 50,
  recommended_assets: ["Or", "Obligations", "Secteur défensif"],
  avoid_assets: ["Small caps", "Actifs spéculatifs"],
  commentary: "Analyse de marché indisponible pour le moment.",
  signals: ["Données insuffisantes"],
}

async function fetchYahooPrice(symbol: string): Promise<{ current: number; change5d: number; change1d: number } | null> {
  const fetchData = async (host: string) => {
    const res = await fetch(
      `https://${host}/v8/finance/chart/${symbol}?interval=1d&range=5d`,
      { headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: 0 } }
    )
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json()
  }

  try {
    let data
    try {
      data = await fetchData("query1.finance.yahoo.com")
    } catch {
      data = await fetchData("query2.finance.yahoo.com")
    }

    const closes: number[] = data?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? []
    const valid = closes.filter((v: number) => v != null && !isNaN(v))
    if (valid.length < 2) return null

    const current = valid[valid.length - 1]
    const prev1d = valid[valid.length - 2]
    const oldest = valid[0]

    return {
      current,
      change5d: ((current - oldest) / oldest) * 100,
      change1d: ((current - prev1d) / prev1d) * 100,
    }
  } catch {
    return null
  }
}

export async function GET() {
  // Check cache: if analysis < 4h exists, return it
  const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()
  const { data: cached } = await supabase
    .from("ai_analyses")
    .select("content, created_at")
    .eq("type", "market_regime")
    .is("user_id", null)
    .gte("created_at", fourHoursAgo)
    .order("created_at", { ascending: false })
    .limit(1)
    .single()

  if (cached?.content) {
    return NextResponse.json({ ...cached.content, cached: true })
  }

  // Fetch market data
  const prices: Record<string, { current: number; change5d: number; change1d: number } | null> = {}
  await Promise.all(
    SYMBOLS.map(async (sym) => {
      prices[sym] = await fetchYahooPrice(sym)
    })
  )

  const marketData = SYMBOLS.map((sym) => ({
    symbol: sym,
    ...prices[sym],
  }))

  let result = FALLBACK_RESULT

  try {
    const completion = await Promise.race([
      groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: `Analyse ces données de marché et détermine le régime actuel.
Retourne JSON strict:
{
  "regime": "risk_on" | "risk_off" | "transition",
  "vix_level": "low" | "elevated" | "high" | "extreme",
  "trend": "haussier" | "baissier" | "neutre",
  "force": 0-100,
  "recommended_assets": ["string", ...], // 3-4 actifs/secteurs à privilégier
  "avoid_assets": ["string", ...], // 2-3 à éviter
  "commentary": "string", // 1-2 phrases
  "signals": ["string", ...] // 2-3 signaux clés observés
}
Réponds UNIQUEMENT avec le JSON.`,
          },
          {
            role: "user",
            content: `Données de marché (SPY, QQQ, TLT, GLD, VIX): ${JSON.stringify(marketData)}`,
          },
        ],
        temperature: 0.3,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), 10000)
      ),
    ])

    try {
      result = JSON.parse(
        completion.choices[0]?.message?.content?.trim() ?? "{}"
      )
    } catch {
      result = FALLBACK_RESULT
    }
  } catch {
    result = FALLBACK_RESULT
  }

  await supabase.from("ai_analyses").insert({
    type: "market_regime",
    content: result,
    user_id: null,
  })

  return NextResponse.json(result)
}
