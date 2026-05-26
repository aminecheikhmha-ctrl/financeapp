import { NextRequest, NextResponse } from "next/server"
import Groq from "groq-sdk"
import { createClient } from "@supabase/supabase-js"
import { rateLimit, getClientIP } from "@/lib/rate-limit"

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export async function POST(req: NextRequest) {
  const ip = getClientIP(req)
  const { success } = rateLimit(`coach:${ip}`, 20, 60 * 1000)
  if (!success) {
    return NextResponse.json({ error: "Trop de requêtes. Attends un moment." }, { status: 429 })
  }

  const token = req.headers.get("authorization")?.replace("Bearer ", "")
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )

  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { message, history = [] } = await req.json()
    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Message requis" }, { status: 400 })
    }

    const historyMessages = (history as { role: string; content: string }[])
      .slice(-8)
      .map(m => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }))

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: `Tu es un coach de trading professionnel, bienveillant et pédagogique. Tu aides les traders débutants et intermédiaires à progresser dans le paper trading (trading simulé). Tu réponds en français, de façon claire et concise (3-5 phrases maximum sauf si une explication plus longue est nécessaire). Tu donnes des conseils actionnables et pratiques. Tu ne fais pas de recommandations d'investissement réels. Si on te pose une question hors trading, rappelle poliment ton rôle.`,
        },
        ...historyMessages,
        {
          role: "user",
          content: message,
        },
      ],
      max_tokens: 400,
      temperature: 0.7,
    })

    const reply = completion.choices[0]?.message?.content ?? "Je n'ai pas pu générer une réponse."
    return NextResponse.json({ reply })
  } catch (err) {
    console.error("Coach error:", err)
    return NextResponse.json({ error: "Erreur de génération" }, { status: 500 })
  }
}
