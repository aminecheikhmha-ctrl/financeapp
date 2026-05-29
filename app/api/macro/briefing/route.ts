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
          content: `Tu es un professeur de finance qui explique l'économie à des adolescents de 17 ans.
Règles strictes :
- Maximum 3 phrases courtes et percutantes
- Zéro jargon sans explication immédiate entre parenthèses
- Utilise des comparaisons du quotidien (Netflix, voiture, pizza, TikTok, iPhone...)
- Toujours en français
- Explique ce qui se passe ET pourquoi c'est important pour quelqu'un qui commence à investir
- Sois direct et concret, pas académique`,
        },
        {
          role: "user",
          content: `Voici la situation actuelle des marchés :
- Marché actions (S&P 500) : ${spyChange >= 0 ? "+" : ""}${Number(spyChange).toFixed(1)}% aujourd'hui
- Peur des investisseurs (VIX) : ${Number(vix).toFixed(1)} (${Number(vix) > 25 ? "très élevé — panique" : Number(vix) > 18 ? "modéré — nerveux" : "faible — calme"})
- Taux d'intérêt de la banque centrale (Fed) : ${fedRate}%
- Or (variation 1 jour) : ${goldChange >= 0 ? "+" : ""}${Number(goldChange).toFixed(1)}%
- Régime macro actuel : ${regime}

Explique ça en exactement 3 phrases courtes, comme si tu parlais à un ado de 17 ans qui commence à s'intéresser à l'investissement. Sois concret et utilise des exemples du quotidien.`,
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
