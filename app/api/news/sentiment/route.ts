import { NextRequest, NextResponse } from "next/server"
import Groq from "groq-sdk"

export const runtime = "nodejs"

export type SentimentResult = {
  overall_sentiment: string
  sentiment_score: number
  key_themes: string[]
  catalysts: string[]
  risks: string[]
  social_buzz: string
  summary: string
  impact_on_price: string
  confidence: number
}

// In-memory cache (15 min)
const cache = new Map<string, { data: SentimentResult; ts: number }>()
const CACHE_TTL = 15 * 60 * 1000

const FALLBACK: SentimentResult = {
  overall_sentiment: "neutre",
  sentiment_score: 0,
  key_themes: [],
  catalysts: [],
  risks: [],
  social_buzz: "faible",
  summary: "Analyse sentiment indisponible.",
  impact_on_price: "neutre",
  confidence: 50,
}

export async function POST(req: NextRequest) {
  const { articles, symbol } = await req.json().catch(() => ({ articles: [], symbol: "?" }))
  if (!Array.isArray(articles) || articles.length === 0) {
    return NextResponse.json(FALLBACK)
  }

  const cacheKey = `${symbol}-${articles.slice(0, 3).map((a: any) => a.title).join("|").slice(0, 80)}`
  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json(cached.data)
  }

  const top10 = articles.slice(0, 10)
  const articleList = top10.map((a: any) => `- ${a.title} (${a.source})`).join("\n")

  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! })
    const chat = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: 600,
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content: "Tu es un analyste financier expert. Réponds UNIQUEMENT avec du JSON valide, aucun texte avant ou après.",
        },
        {
          role: "user",
          content: `Analyse le sentiment de ces actualités sur ${symbol}.

Articles :
${articleList}

Retourne UNIQUEMENT ce JSON (pas de markdown, pas de backticks) :
{"overall_sentiment":"positif","sentiment_score":45,"key_themes":["thème1","thème2"],"catalysts":["catalyseur1"],"risks":["risque1"],"social_buzz":"modéré","summary":"résumé en 1-2 phrases","impact_on_price":"haussier","confidence":72}

Valeurs possibles :
- overall_sentiment: "très positif" | "positif" | "neutre" | "négatif" | "très négatif"
- sentiment_score: entier -100 à 100
- social_buzz: "faible" | "modéré" | "élevé" | "viral"
- impact_on_price: "haussier" | "baissier" | "neutre"
- confidence: 0-100`,
        },
      ],
    })

    const text = chat.choices[0]?.message?.content?.trim() ?? ""
    // Strip markdown code blocks if any
    const jsonStr = text.replace(/^```json?\s*/i, "").replace(/```\s*$/i, "").trim()
    const parsed: SentimentResult = JSON.parse(jsonStr)

    // Validate shape
    const result: SentimentResult = {
      overall_sentiment: parsed.overall_sentiment ?? "neutre",
      sentiment_score: typeof parsed.sentiment_score === "number" ? Math.max(-100, Math.min(100, parsed.sentiment_score)) : 0,
      key_themes: Array.isArray(parsed.key_themes) ? parsed.key_themes.slice(0, 5) : [],
      catalysts: Array.isArray(parsed.catalysts) ? parsed.catalysts.slice(0, 3) : [],
      risks: Array.isArray(parsed.risks) ? parsed.risks.slice(0, 3) : [],
      social_buzz: parsed.social_buzz ?? "faible",
      summary: parsed.summary ?? "",
      impact_on_price: parsed.impact_on_price ?? "neutre",
      confidence: typeof parsed.confidence === "number" ? Math.max(0, Math.min(100, parsed.confidence)) : 50,
    }

    cache.set(cacheKey, { data: result, ts: Date.now() })
    return NextResponse.json(result)
  } catch (e) {
    console.error("[news/sentiment] error:", e)
    return NextResponse.json(FALLBACK)
  }
}
