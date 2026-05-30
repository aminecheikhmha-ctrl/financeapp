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
          content: `Tu es un analyste macro senior rédigeant le briefing de début de séance pour un terminal institutionnel.
Règles :
- 2-3 phrases denses, directes, sans fioriture
- Nomme les données précises (ex: "S&P +0.8%, VIX à 16, spread 10Y-3M à -0.4%")
- Identifie le régime actuel et le trade/risque principal du moment
- Toujours en français
- Pas de pédagogie, pas de définitions — juste le verdict opérationnel`,
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
