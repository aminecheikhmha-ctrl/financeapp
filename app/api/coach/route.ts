export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import Groq from "groq-sdk"
import { createClient } from "@supabase/supabase-js"
import { rateLimit, getClientIP } from "@/lib/rate-limit"
import { logAIUsage } from "@/lib/ai-logger"
import { langInstruction } from "@/lib/ai-lang"

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export async function POST(req: NextRequest) {
  const ip = getClientIP(req)
  const { success } = rateLimit(`coach:${ip}`, 20, 60 * 1000)
  if (!success) {
    return NextResponse.json({ error: "Too many requests. Please wait a moment." }, { status: 429 })
  }

  const token = req.headers.get("authorization")?.replace("Bearer ", "")
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.SUPABASE_SERVICE_KEY || 'placeholder'
  )

  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { message, history = [], lang } = await req.json()
    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Message required" }, { status: 400 })
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
          content: `You are a professional, caring and educational trading coach. You help beginner and intermediate traders improve in paper trading (simulated trading). You answer clearly and concisely (3-5 sentences maximum unless a longer explanation is needed). You give actionable, practical advice. You do not make real investment recommendations. If asked something outside trading, politely remind the user of your role. ${langInstruction(lang)}`,
        },
        ...historyMessages,
        { role: "user", content: message },
      ],
      max_tokens: 400,
      temperature: 0.7,
    })

    const reply = completion.choices[0]?.message?.content ?? "I couldn't generate a response."
    void logAIUsage(user.id, "coach")
    return NextResponse.json({ reply })
  } catch (err) {
    console.error("Coach error:", err)
    return NextResponse.json({ error: "Generation error" }, { status: 500 })
  }
}
