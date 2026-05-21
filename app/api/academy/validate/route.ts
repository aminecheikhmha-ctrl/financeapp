import { NextRequest, NextResponse } from "next/server"
import Groq from "groq-sdk"

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

const SYSTEM_PROMPT =
  "Tu es un tuteur trading bienveillant. Tes réponses sont courtes (2-3 phrases), encourageantes et pédagogiques."

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      exercise_type,
      user_answer,
      correct_answer,
      context,
      lesson_context,
      symbol,
    } = body as {
      exercise_type: string
      user_answer: string
      correct_answer?: string
      context?: string
      lesson_context?: string
      symbol?: string
    }

    let userPrompt = ""
    let correct: boolean | null = null
    let xp_earned = 10

    if (exercise_type === "live_practice") {
      userPrompt = `L'élève vient d'apprendre "${lesson_context ?? "le trading"}".
Symbole analysé : ${symbol ?? "inconnu"}.
Données du marché en direct : ${context ?? "non disponibles"}.
Décision de l'élève : ${user_answer}.
Évalue brièvement la pertinence de cette décision par rapport aux indicateurs fournis. Soit encourageant.`
      correct = null
      xp_earned = 15
    } else if (exercise_type === "interactive") {
      const isCorrect = correct_answer != null && user_answer === correct_answer
      correct = isCorrect
      xp_earned = isCorrect ? 10 : 0
      userPrompt = `Question sur "${lesson_context ?? "trading"}".
Réponse correcte : ${correct_answer}.
Réponse de l'élève : ${user_answer}.
${isCorrect ? "La réponse est correcte. Félicite l'élève et renforce le concept." : "La réponse est incorrecte. Explique gentiment pourquoi et donne la bonne réponse."}`
    } else if (exercise_type === "sandbox") {
      userPrompt = `Simulation de trading.
Contexte : ${context ?? "marché général"}.
Décision de l'élève : ${user_answer}.
Évalue la décision, explique le P&L potentiel et ce que l'élève aurait pu faire.`
      correct = null
      xp_earned = 12
    } else {
      userPrompt = `Exercice de type ${exercise_type}.
Contexte : ${context ?? ""}.
Réponse de l'élève : ${user_answer}.
Donne un feedback pédagogique court.`
    }

    let feedback = ""
    let explanation = ""

    try {
      const completion = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 150,
        temperature: 0.7,
      })
      const text = completion.choices[0]?.message?.content ?? ""
      // Split into feedback + explanation if we can
      const sentences = text.split(/(?<=[.!?])\s+/)
      feedback = sentences.slice(0, 2).join(" ").trim()
      explanation = sentences.slice(2).join(" ").trim() || feedback
    } catch {
      // Fallback feedback
      const fallbacks: Record<string, string> = {
        live_practice: "Bonne initiative d'analyser le marché en direct ! Continue à croiser les indicateurs.",
        interactive: correct ? "Bonne réponse ! Tu progresses bien." : "Pas tout à fait. Relis la leçon sur ce concept.",
        sandbox: "Décision enregistrée. Analyse les résultats pour progresser.",
      }
      feedback = fallbacks[exercise_type] ?? "Continue à t'entraîner, tu progresses !"
      explanation = feedback
    }

    return NextResponse.json({
      correct,
      feedback,
      xp_earned,
      explanation,
    })
  } catch (err) {
    console.error("[academy/validate] error:", err)
    return NextResponse.json(
      {
        correct: null,
        feedback: "Une erreur s'est produite. Continue à t'entraîner !",
        xp_earned: 5,
        explanation: "Vérifiez votre connexion et réessayez.",
      },
      { status: 200 }
    )
  }
}
