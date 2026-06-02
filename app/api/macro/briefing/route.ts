import Groq from "groq-sdk"
import { NextResponse } from "next/server"

export const runtime = "nodejs"

export async function POST(req: Request) {
  try {
    const { vix, spyChange, fedRate, goldChange, regime } = await req.json()

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: `You are a senior macro analyst writing the opening session briefing for an institutional terminal.
Rules:
- 2-3 dense, direct sentences, no fluff
- Cite precise data (e.g. "S&P +0.8%, VIX at 16, 10Y-3M spread at -0.4%")
- Identify the current regime and the key trade/risk of the moment
- Always in English
- No pedagogy, no definitions — just the operational verdict`,
        },
        {
          role: "user",
          content: `Données du jour :
- S&P 500 : ${spyChange >= 0 ? "+" : ""}${Number(spyChange).toFixed(1)}% séance
- VIX : ${Number(vix).toFixed(1)} (${Number(vix) > 25 ? "stress élevé" : Number(vix) > 18 ? "tension modérée" : "risk-on"})
- Fed Funds : ${fedRate}%
- Or : ${goldChange >= 0 ? "+" : ""}${Number(goldChange).toFixed(1)}% 1J
- Régime : ${regime}

Rédige le briefing macro du jour en 2-3 phrases. Verdict direct, données chiffrées, sans introduction.`,
        },
      ],
      max_tokens: 220,
      temperature: 0.65,
    })

    const briefing = completion.choices[0]?.message?.content ?? ""
    return NextResponse.json({ briefing })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erreur inconnue"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
