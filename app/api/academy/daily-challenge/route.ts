export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_KEY || "placeholder"
)

const SYMBOLS = ["AAPL", "BTC-USD", "NVDA", "TSLA", "SPY"]
const CHALLENGE_TYPES = ["identify_support", "spot_rsi", "identify_trend"]

const TEMPLATES: Record<string, (symbol: string) => { description: string; xp_reward: number }> = {
  identify_support: (symbol) => ({
    description: `Analyse le graphique de ${symbol} et identifie le niveau de support le plus proche. Explique pourquoi c'est un support valide.`,
    xp_reward: 50,
  }),
  spot_rsi: (symbol) => ({
    description: `Le RSI de ${symbol} vient d'atteindre un niveau extrême. Identifie si c'est une zone de survente ou de surachat et détermine l'action à prendre.`,
    xp_reward: 40,
  }),
  identify_trend: (symbol) => ({
    description: `En regardant ${symbol} sur les 30 derniers jours, identifie la tendance principale (haussière, baissière, ou latérale) et cite 2 indicateurs qui la confirment.`,
    xp_reward: 45,
  }),
}

function todayString() {
  return new Date().toISOString().split("T")[0]
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export async function GET(_req: NextRequest) {
  const today = todayString()

  try {
    // Check if today's challenge exists
    const { data: existing, error: fetchError } = await supabase
      .from("daily_challenges")
      .select("*")
      .eq("date", today)
      .single()

    if (fetchError && fetchError.code !== "PGRST116") {
      // PGRST116 = no rows found, other errors are real
      throw fetchError
    }

    if (existing) {
      return NextResponse.json(existing)
    }

    // Generate new challenge
    const symbol = pickRandom(SYMBOLS)
    const challenge_type = pickRandom(CHALLENGE_TYPES)
    const template = TEMPLATES[challenge_type](symbol)

    const newChallenge = {
      date: today,
      symbol,
      challenge_type,
      description: template.description,
      xp_reward: template.xp_reward,
    }

    const { data: inserted, error: insertError } = await supabase
      .from("daily_challenges")
      .insert(newChallenge)
      .select()
      .single()

    if (insertError) {
      // Return generated data even if insert fails
      return NextResponse.json({ id: null, ...newChallenge })
    }

    return NextResponse.json(inserted)
  } catch (err) {
    console.error("[daily-challenge GET] error:", err)
    // Fallback: return a static challenge
    return NextResponse.json({
      id: null,
      date: today,
      symbol: "AAPL",
      challenge_type: "identify_trend",
      description: "En regardant AAPL sur les 30 derniers jours, identifie la tendance principale et cite 2 indicateurs qui la confirment.",
      xp_reward: 45,
    })
  }
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization")
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
    }
    const token = authHeader.slice(7)

    // Verify token with Supabase
    const { data: userData, error: authError } = await supabase.auth.getUser(token)
    if (authError || !userData.user) {
      return NextResponse.json({ error: "Token invalide" }, { status: 401 })
    }

    const body = await req.json()
    const { challenge_id, user_answer, score } = body as {
      challenge_id: string | number
      user_answer: string
      score: number
    }

    if (!challenge_id || score == null) {
      return NextResponse.json({ error: "challenge_id et score requis" }, { status: 400 })
    }

    // Get challenge to determine xp
    const { data: challenge } = await supabase
      .from("daily_challenges")
      .select("xp_reward")
      .eq("id", challenge_id)
      .single()

    const xp_earned = challenge?.xp_reward ?? 40

    const { error: upsertError } = await supabase
      .from("challenge_completions_daily")
      .upsert(
        {
          user_id: userData.user.id,
          challenge_id,
          user_answer,
          score,
          xp_earned,
          completed_at: new Date().toISOString(),
        },
        { onConflict: "user_id,challenge_id" }
      )

    if (upsertError) {
      console.error("[daily-challenge POST] upsert error:", upsertError)
      return NextResponse.json({ error: "Erreur lors de l'enregistrement" }, { status: 500 })
    }

    return NextResponse.json({ success: true, xp_earned })
  } catch (err) {
    console.error("[daily-challenge POST] error:", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
