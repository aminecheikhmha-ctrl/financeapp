export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import Groq from "groq-sdk"
import { logAIUsage } from "@/lib/ai-logger"
import { langInstruction } from "@/lib/ai-lang"

export const runtime = "nodejs"
export const maxDuration = 30

function makeSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.SUPABASE_SERVICE_KEY || 'placeholder'
  )
}

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

const PAGE_SUGGESTIONS: Record<string, string[]> = {
  "/dashboard": ["Comment se porte mon portfolio ?", "Quels actifs surveiller ?", "Analyse le marché actuel"],
  "/signaux": ["Explique ce signal", "Quels signaux sont les plus fiables ?", "Comment trader ce setup ?"],
  "/analyses": ["Analyse le screener actuel", "Qu'est-ce que le RSI ?", "Comment lire le score IA ?"],
  "/apprendre": ["Résume ce cours", "Quand passer au niveau suivant ?", "Exercice pratique ?"],
  "/coach": ["Analyse mes erreurs", "Comment améliorer mon timing ?", "Objectifs cette semaine ?"],
}

function getSuggestions(page_context: string | null): string[] {
  if (!page_context) return PAGE_SUGGESTIONS["/dashboard"]
  for (const [key, val] of Object.entries(PAGE_SUGGESTIONS)) {
    if (page_context === key || page_context.startsWith(key + "/")) return val
  }
  return PAGE_SUGGESTIONS["/dashboard"]
}

// GET /api/ai/chat — retourne l'historique + suggestions
export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "")
  const page_context = req.nextUrl.searchParams.get("page_context")
  const suggestions = getSuggestions(page_context)

  if (!token) {
    return NextResponse.json({ history: [], suggestions })
  }

  const supabase = makeSupabase()
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) {
    return NextResponse.json({ history: [], suggestions })
  }

  const { data: history } = await supabase
    .from("chat_history")
    .select("role, content")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(10)

  return NextResponse.json({ history: history ?? [], suggestions })
}

// POST /api/ai/chat — envoie un message et obtient une réponse
export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "")
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = makeSupabase()
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { message, page_context, lang } = await req.json()
  if (!message || typeof message !== "string") {
    return NextResponse.json({ error: "Missing message" }, { status: 400 })
  }

  // Récupère l'historique des 10 derniers messages
  const { data: chatHistory } = await supabase
    .from("chat_history")
    .select("role, content")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(10)

  // Récupère le contexte utilisateur
  const [profileRes, positionsRes, ordersRes] = await Promise.allSettled([
    supabase
      .from("user_profiles")
      .select("username, level, risk")
      .eq("id", user.id)
      .single(),
    supabase
      .from("positions")
      .select("symbol, quantity, avg_price")
      .eq("user_id", user.id),
    supabase
      .from("orders")
      .select("symbol, side, price")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5),
  ])

  const profile = profileRes.status === "fulfilled" ? profileRes.value.data : null
  const positions = positionsRes.status === "fulfilled" ? positionsRes.value.data : null
  const recentOrders = ordersRes.status === "fulfilled" ? ordersRes.value.data : null

  const username = profile?.username ?? "trader"
  const level = profile?.level ?? "débutant"
  const portfolioStr = positions?.length
    ? positions.map((p: any) => `${p.symbol} (${p.quantity})`).join(", ")
    : "vide"
  const ordersStr = recentOrders?.length
    ? recentOrders.map((o: any) => `${o.side} ${o.symbol} à ${o.price}`).join(", ")
    : "aucun"

  const systemPrompt = `You are Tradex's AI assistant, an expert in trading and market finance.
You have access to the user's full context.

User: ${username}
Level: ${level}
Current portfolio: ${portfolioStr}
Recent trades: ${ordersStr}
Current page: ${page_context ?? "dashboard"}

Rules:
- Be concise and expert (max 150 words unless a detailed explanation is requested)
- If asked "how is my portfolio doing", use the data above
- For questions about specific assets, give factual analysis
- Suggest app features when relevant (e.g. "You can see this in /analyses")
- Be proactive based on the current page: if on /signals, talk about active signals
- ${langInstruction(lang)}`

  const historyMessages = (chatHistory ?? []).map((h: any) => ({
    role: h.role as "user" | "assistant",
    content: h.content,
  }))

  const groqMessages = [
    { role: "system" as const, content: systemPrompt },
    ...historyMessages,
    { role: "user" as const, content: message },
  ]

  let responseText: string
  try {
    const completion = await Promise.race([
      groq.chat.completions.create({
        messages: groqMessages,
        model: "llama-3.3-70b-versatile",
        max_tokens: 512,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Groq timeout")), 10000)
      ),
    ])
    responseText = completion.choices[0]?.message?.content ?? "Désolé, je n'ai pas pu générer une réponse."
  } catch {
    return NextResponse.json({
      response: "Désolé, je suis temporairement indisponible. Réessaie dans quelques instants.",
      suggestions: getSuggestions(page_context),
    })
  }

  // Sauvegarde les deux messages dans chat_history
  await supabase.from("chat_history").insert([
    { user_id: user.id, role: "user", content: message, page_context: page_context ?? null },
    { user_id: user.id, role: "assistant", content: responseText, page_context: page_context ?? null },
  ])

  void logAIUsage(user.id, "chat")
  const suggestions = getSuggestions(page_context)

  return NextResponse.json({ response: responseText, suggestions })
}
