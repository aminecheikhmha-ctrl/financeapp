import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export type AIFeature =
  | "coach"
  | "chat"
  | "trade_coach"
  | "portfolio_analysis"
  | "moderation"

/**
 * Log un appel IA pour un utilisateur donné.
 * Silencieux en cas d'erreur (ne doit jamais bloquer la réponse principale).
 */
export async function logAIUsage(userId: string, feature: AIFeature, model = "llama-3.3-70b-versatile") {
  try {
    await supabase.from("ai_usage_logs").insert({ user_id: userId, feature, model })
  } catch {
    // silencieux
  }
}
