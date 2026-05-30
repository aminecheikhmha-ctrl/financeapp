import Groq from "groq-sdk"

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

// ── Filtre local (instantané, sans IA) ────────────────────────────────────────

const BANNED_WORDS = [
  // Insultes françaises
  "connard","connasse","salope","pute","enculé","fdp","ntm",
  "batard","bâtard","pd","nègre","negro","tapette","gouine",
  // Insultes anglaises
  "fuck","shit","bitch","asshole","nigger","faggot","cunt",
  // Spam / arnaque
  "telegram","whatsapp","signal","discord.gg",
  "pump and dump","guaranteed profit","100x guaranteed",
  "dm me","contact me","make money fast",
  "crypto signal paid","join my group","join my channel",
  // Contenu adulte
  "porn","sex","nude","naked","xxx",
]

const SPAM_PATTERNS = [
  /https?:\/\//gi,          // Liens externes
  /t\.me\//gi,              // Telegram
  /discord\.gg\//gi,        // Discord invite
  /bit\.ly/gi,              // URL shorteners
  /(.)\1{5,}/gi,            // Répétition excessive (aaaaaa)
  /[A-Z]{12,}/g,            // Tout en majuscules excessif
]

export type ModerationResult = {
  approved: boolean
  reason?: string
  severity: "none" | "low" | "medium" | "high"
  flagged_words?: string[]
}

function quickModerate(text: string): ModerationResult | null {
  const lower = text.toLowerCase()

  const flagged = BANNED_WORDS.filter(w => lower.includes(w))
  if (flagged.length > 0) {
    return {
      approved:      false,
      reason:        "Ce contenu contient des mots inappropriés.",
      severity:      "high",
      flagged_words: flagged,
    }
  }

  for (const pattern of SPAM_PATTERNS) {
    // reset lastIndex pour les regex globales
    pattern.lastIndex = 0
    if (pattern.test(text)) {
      return {
        approved: false,
        reason:   "Ce contenu ressemble à du spam ou contient des liens non autorisés.",
        severity: "medium",
      }
    }
  }

  if (text.trim().length < 3) {
    return { approved: false, reason: "Contenu trop court.", severity: "low" }
  }
  if (text.length > 10000) {
    return { approved: false, reason: "Contenu trop long (max 10 000 caractères).", severity: "low" }
  }

  return null
}

async function aiModerate(text: string, type: "post" | "comment"): Promise<ModerationResult> {
  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: `Tu es un modérateur strict pour un forum de trading financier en français.

Approuve UNIQUEMENT les contenus qui :
- Parlent de trading, finance, marchés, investissement
- Posent des questions légitimes sur l'app Tradex
- Partagent des analyses ou opinions sur les actifs
- Sont des discussions générales respectueuses

Refuse les contenus qui :
- Contiennent des insultes ou langage agressif
- Font la promotion de services externes ou arnaques
- Contiennent du spam ou du hors-sujet total
- Promeuvent des activités illégales ou du contenu adulte

Réponds UNIQUEMENT en JSON valide :
{"approved": true/false, "reason": "raison si refusé", "severity": "none/low/medium/high"}`,
        },
        {
          role: "user",
          content: `Modère ce ${type === "post" ? "post de forum" : "commentaire"} :\n\n"${text.slice(0, 800)}"`,
        },
      ],
      max_tokens: 120,
      temperature: 0.1,
    })

    const raw   = completion.choices[0]?.message?.content ?? "{}"
    const clean = raw.replace(/```json?|```/g, "").trim()
    const parsed = JSON.parse(clean)
    return {
      approved: parsed.approved ?? true,
      reason:   parsed.reason,
      severity: parsed.severity ?? "none",
    }
  } catch {
    // En cas d'erreur IA → approuve par défaut pour ne pas bloquer
    return { approved: true, severity: "none" }
  }
}

// ── Export principal ───────────────────────────────────────────────────────────

export async function moderate(
  text: string,
  type: "post" | "comment" = "post",
): Promise<ModerationResult> {
  // 1. Filtre rapide local (sync, < 1 ms)
  const quick = quickModerate(text)
  if (quick) return quick

  // 2. Modération IA pour les cas ambigus
  return aiModerate(text, type)
}
