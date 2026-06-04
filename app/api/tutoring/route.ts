export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import Groq from "groq-sdk"

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { message, moduleTitle, chapitreTitle, history, lang } = await req.json()

    const langNote = lang === "fr" ? "Réponds en français." : "Always respond in English."
    const systemPrompt = `You are an expert finance and trading tutor, specialized for beginners and young students. You help students understand the module "${moduleTitle}", chapter "${chapitreTitle}".

Your rules:
- Explain in a simple, clear way adapted for beginners
- Use concrete examples and everyday analogies
- Be encouraging and positive
- If the question goes off-topic, politely refocus
- Be concise (max 200 words per response)
- Use emojis to make explanations more engaging
- ${langNote}`

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
