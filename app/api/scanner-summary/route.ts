import { NextRequest, NextResponse } from "next/server"
import Groq from "groq-sdk"
import { rateLimit, getClientIP } from "@/lib/rate-limit"

export const runtime = "nodejs"

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

type ScanHit = {
  symbol: string
  name: string
  pattern: string
  signal: string
  score: number
  rsi: number
  change: number
  confluence: number
}

export async function POST(req: NextRequest) {
  const ip = getClientIP(req)
  const rl = rateLimit(`scanner-summary:${ip}`, 10, 60_000)
  if (!rl.success) {
    return NextResponse.json({ error: "Trop de requêtes" }, { status: 429 })
  }

  const body = await req.json().catch(() => ({}))
  const hits: ScanHit[] = body?.hits ?? []

  if (hits.length === 0) {
    return NextResponse.json({ summary: "Aucun pattern détecté sur les actifs scannés." })
  }

  const top = hits.slice(0, 8)
  const lines = top.map(h =>
    `${h.symbol} (${h.name}): ${h.pattern} | Signal ${h.signal} | Score ${h.score} | RSI ${h.rsi} | Var ${h.change > 0 ? "+" : ""}${h.change}% | Confluence ${h.confluence}%`
  ).join("\n")

  const prompt = `You are an expert financial analyst. Here are the patterns detected by our technical scanner:\n\n${lines}\n\nWrite a concise analytical summary (3-4 sentences max). Identify the dominant trends, the most interesting setups and give an actionable conclusion for a trader. Be precise and professional.`

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 250,
      temperature: 0.5,
    })
    const summary = completion.choices[0]?.message?.content ?? "Analyse indisponible."
    return NextResponse.json({ summary })
  } catch {
    return NextResponse.json({ summary: "Analyse IA temporairement indisponible." }, { status: 500 })
  }
}
