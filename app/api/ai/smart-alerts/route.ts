import { NextRequest, NextResponse } from "next/server"
import Groq from "groq-sdk"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"
export const maxDuration = 30

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization")?.replace("Bearer ", "")
  if (!authHeader || authHeader !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Fetch signals from Supabase directly
  const { data: signals } = await supabase
    .from("signaux")
    .select("*")
    .gte("confluence_score", 70)
    .order("confluence_score", { ascending: false })

  if (!signals || signals.length === 0) {
    return NextResponse.json({ processed: 0, alerts: [] })
  }

  const alerts: { signal: unknown; alert: string }[] = []

  for (const signal of signals) {
    let alertText = `${signal.symbol ?? "UNKNOWN"}: Signal détecté avec score ${signal.confluence_score ?? 0}.`

    try {
      const completion = await Promise.race([
        groq.chat.completions.create({
          model: "llama-3.3-70b-versatile",
          messages: [
            {
              role: "user",
              content: `Génère une alerte trading courte (max 2 phrases) pour ce signal: ${JSON.stringify(signal)}
Format: "SYMBOL: observation + action suggérée"`,
            },
          ],
          max_tokens: 100,
          temperature: 0.5,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), 10000)
        ),
      ])

      alertText =
        completion.choices[0]?.message?.content?.trim() ?? alertText
    } catch {
      // use fallback alertText
    }

    await supabase.from("ai_analyses").insert({
      type: "smart_alert",
      content: { signal, alert: alertText },
      user_id: null,
    })

    alerts.push({ signal, alert: alertText })
  }

  return NextResponse.json({ processed: alerts.length, alerts })
}
