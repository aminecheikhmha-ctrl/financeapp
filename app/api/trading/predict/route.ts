import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  const { symbol, bars, support, resistance, signals } = await req.json()

  const lastBars = bars.slice(-10).map((b: any) =>
    `${b.date}: open=${b.open} high=${b.high} low=${b.low} close=${b.close} volume=${b.volume} RSI=${b.rsi ?? "N/A"} MA20=${b.ma20 ?? "N/A"}`
  ).join("\n")

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        max_tokens: 1500,
        messages: [
          {
            role: "system",
            content: "Tu es un trader quantitatif expert. Tu analyses des données de prix et fournis des prédictions précises et structurées en JSON uniquement. Pas de texte en dehors du JSON."
          },
          {
            role: "user",
            content: `Analyse ${symbol} et retourne UNIQUEMENT ce JSON (pas de markdown, pas de texte autour) :

Données des 10 derniers jours :
${lastBars}

Support identifié: ${support}
Résistance identifiée: ${resistance}
Signaux récents: ${JSON.stringify(signals)}

Retourne exactement ce format JSON :
{
  "trend": "bullish" | "bearish" | "neutral",
  "confidence": 0-100,
  "target_7d": <prix cible dans 7 jours>,
  "target_30d": <prix cible dans 30 jours>,
  "stop_loss": <niveau de stop loss recommandé>,
  "key_levels": [<niveau 1>, <niveau 2>, <niveau 3>],
  "summary": "<analyse en 2-3 phrases en français>",
  "events": [
    {"date": "<date YYYY-MM-DD>", "label": "<événement clé court>", "type": "bullish"|"bearish"|"neutral"}
  ],
  "recommendation": "ACHETER" | "VENDRE" | "ATTENDRE",
  "risk": "faible" | "modéré" | "élevé"
}`
          }
        ]
      })
    })

    const data = await res.json()
    const text = data.choices?.[0]?.message?.content ?? "{}"
    const clean = text.replace(/```json|```/g, "").trim()
    const prediction = JSON.parse(clean)
    return NextResponse.json(prediction)
  } catch {
    return NextResponse.json({ error: "Prediction failed" }, { status: 500 })
  }
}