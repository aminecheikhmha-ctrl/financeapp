import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"

export type BriefingResult = {
  date: string
  bullets: string[]
  asia_summary: string
  watch_today: string[]
  trade_idea: string
  generated_at: string
}

const cache = new Map<string, { data: BriefingResult; ts: number }>()

function msUntilMidnightUTCPlus8(): number {
  const now = new Date()
  const utcPlus8 = new Date(now.getTime() + 8 * 60 * 60 * 1000)
  const midnight = new Date(utcPlus8)
  midnight.setUTCHours(24, 0, 0, 0)
  return midnight.getTime() - utcPlus8.getTime()
}

async function fetchYahooTitles(symbol: string, limit = 5): Promise<string[]> {
  try {
    const clean = symbol.replace("-USD", "").replace("-", "")
    const res = await fetch(
      `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${clean}&region=US&lang=en-US`,
      { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(5000) }
    )
    if (!res.ok) return []
    const xml = await res.text()
    const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? []
    return items.slice(0, limit).map(item => {
      return (
        (item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) ?? item.match(/<title>(.*?)<\/title>/))?.[1] ?? ""
      ).trim()
    }).filter(Boolean)
  } catch {
    return []
  }
}

const FALLBACK: BriefingResult = {
  date: new Date().toISOString().split("T")[0],
  bullets: [
    "Les marchés américains évoluent dans un contexte de volatilité modérée.",
    "Les données économiques récentes maintiennent les attentes sur les taux de la Fed.",
    "Les marchés asiatiques ont clôturé en ordre dispersé cette nuit.",
  ],
  asia_summary: "Les marchés asiatiques ont affiché des performances mitigées, avec le Nikkei en légère hausse et le Hang Seng sous pression.",
  watch_today: ["Publications macro américaines", "Déclarations de membres de la Fed"],
  trade_idea: "Surveiller SPY au niveau des supports clés pour une opportunité de rebond.",
  generated_at: new Date().toISOString(),
}

export async function GET(req: NextRequest) {
  const refresh = new URL(req.url).searchParams.get("refresh") === "true"

  const cached = cache.get("briefing")
  const ttl = msUntilMidnightUTCPlus8()
  if (!refresh && cached && Date.now() - cached.ts < ttl) {
    return NextResponse.json(cached.data)
  }

  const [spyTitles, nvdaTitles, btcTitles] = await Promise.all([
    fetchYahooTitles("SPY", 5),
    fetchYahooTitles("NVDA", 5),
    fetchYahooTitles("BTC-USD", 5),
  ])

  const allTitles = [...spyTitles, ...nvdaTitles, ...btcTitles]
  const today = new Date().toISOString().split("T")[0]

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey || allTitles.length === 0) {
    cache.set("briefing", { data: FALLBACK, ts: Date.now() })
    return NextResponse.json(FALLBACK)
  }

  try {
    const { default: Groq } = await import("groq-sdk")
    const groq = new Groq({ apiKey })

    const newsList = allTitles.map((t, i) => `${i + 1}. ${t}`).join("\n")
    const chat = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      max_tokens: 600,
      temperature: 0.5,
      messages: [
        {
          role: "user",
          content: `You are a market strategist. Generate a concise morning briefing in English.
Return ONLY JSON (no markdown, no backticks):
{"date":"${today}","bullets":["point1","point2","point3"],"asia_summary":"...","watch_today":["item1","item2"],"trade_idea":"..."}

News récentes :
${newsList}`,
        },
      ],
    })

    const text = chat.choices[0]?.message?.content?.trim() ?? ""
    const jsonStr = text.replace(/^```json?\s*/i, "").replace(/```\s*$/i, "").trim()
    const parsed = JSON.parse(jsonStr)

    const result: BriefingResult = {
      date: parsed.date ?? today,
      bullets: Array.isArray(parsed.bullets) ? parsed.bullets.slice(0, 3) : FALLBACK.bullets,
      asia_summary: parsed.asia_summary ?? FALLBACK.asia_summary,
      watch_today: Array.isArray(parsed.watch_today) ? parsed.watch_today.slice(0, 3) : FALLBACK.watch_today,
      trade_idea: parsed.trade_idea ?? FALLBACK.trade_idea,
      generated_at: new Date().toISOString(),
    }

    cache.set("briefing", { data: result, ts: Date.now() })
    return NextResponse.json(result)
  } catch (e) {
    console.error("[briefing] error:", e)
    cache.set("briefing", { data: FALLBACK, ts: Date.now() })
    return NextResponse.json(FALLBACK)
  }
}
