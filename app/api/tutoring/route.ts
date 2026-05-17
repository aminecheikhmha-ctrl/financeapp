import { NextRequest, NextResponse } from "next/server"
import Groq from "groq-sdk"

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { message, moduleTitle, chapitreTitle, history } = await req.json()

    const systemPrompt = `Tu es un tuteur expert en finance et trading, spécialisé pour les débutants et jeunes étudiants. Tu aides les étudiants à comprendre le module "${moduleTitle}", chapitre "${chapitreTitle}".

Tes règles :
- Explique de façon simple, claire et adaptée aux débutants
- Utilise des exemples concrets et des analogies du quotidien
- Sois encourageant et positif
- Si la question sort du sujet du cours, recentre poliment
- Réponds en français
- Sois concis (max 200 mots par réponse)
- Utilise des emojis pour rendre les explications plus vivantes`

    const messages = [
      ...history.map((h: any) => ({ role: h.role, content: h.content })),
      { role: "user", content: message }
    ]

    const groqPromise = groq.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        ...messages
      ],
      model: "llama-3.3-70b-versatile",
      max_tokens: 512,
    })

    let completion
    try {
      completion = await Promise.race([
        groqPromise,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Groq timeout")), 10000)
        ),
      ])
    } catch {
      return NextResponse.json({
        response: "Désolé, le service de tutorat est temporairement indisponible. Veuillez réessayer dans quelques instants.",
      })
    }

    const response = completion.choices[0]?.message?.content ?? ""

    return NextResponse.json({ response })
  } catch (e: any) {
    process.stderr.write(`[tutoring] error: ${e}\n`)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
