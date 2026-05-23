import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import Groq from "groq-sdk"
import { getCourse } from "@/lib/courses"

export const maxDuration = 60

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

// ─── GET — fetch or generate chapter content ──────────────────────────────────

export async function GET(req: NextRequest) {
  const course_id   = req.nextUrl.searchParams.get("course_id")
  const chapter_id  = Number(req.nextUrl.searchParams.get("chapter_id"))

  if (!course_id || !chapter_id) {
    return NextResponse.json({ error: "course_id and chapter_id required" }, { status: 400 })
  }

  const course  = getCourse(course_id)
  const chapter = course?.chapters.find(c => c.id === chapter_id)

  if (!course || !chapter) {
    return NextResponse.json({ error: "Course or chapter not found" }, { status: 404 })
  }

  // Check Supabase cache first
  const { data: cached } = await supabase
    .from("course_content")
    .select("content, quiz")
    .eq("course_id", course_id)
    .eq("chapter_id", chapter_id)
    .single()

  if (cached) {
    return NextResponse.json({ content: cached.content, quiz: cached.quiz })
  }

  // Not cached — generate with Groq
  const prompt = `Tu es un professeur expert en finance et trading, niveau Coursera/CFA. Génère le contenu pédagogique complet pour ce chapitre.

Cours : ${course.title} (niveau ${course.level})
Chapitre ${chapter.id}/${course.chapters.length} : "${chapter.title}"

Exemple pratique à intégrer : ${chapter.practical_example}

Concepts clés à couvrir : ${chapter.key_concepts.join(", ")}

CONTENU (400-550 mots) :
Rédige en français un contenu pédagogique structuré avec :
- Introduction engageante (pourquoi ce concept est important)
- Explication claire avec analogies du quotidien
- Mécanismes détaillés avec des chiffres réels
- L'exemple pratique ci-dessus développé en détail
- Points d'attention et erreurs courantes
- Conclusion avec les takeaways clés

Utilise des titres (## et ###), des listes à puces, et du **gras** pour les termes importants.
Cite des actifs, chiffres et événements réels pour ancrer les concepts.

QUIZ JSON (4 questions QCM, retourne UNIQUEMENT un JSON valide après le contenu) :
Format exact :
[{"question":"...","options":["A...","B...","C...","D..."],"correct":0,"explanation":"..."},...]

Chaque question doit tester un concept différent du chapitre. L'explication doit être pédagogique.`

  let content = ""
  let quiz: any[] = []

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: 2000,
      temperature: 0.4,
      messages: [{ role: "user", content: prompt }],
    })

    const raw = completion.choices[0]?.message?.content ?? ""

    // Extract JSON quiz block from the end of the response
    const jsonMatch = raw.match(/\[[\s\S]*?\](?=[^[]*$)/)
    if (jsonMatch) {
      try {
        quiz = JSON.parse(jsonMatch[0])
      } catch {}
      content = raw.slice(0, raw.indexOf(jsonMatch[0])).trim()
    } else {
      content = raw.trim()
    }

    // Fallback quiz if extraction failed
    if (!quiz.length) {
      quiz = [
        {
          question: `Quel est le concept principal du chapitre "${chapter.title}" ?`,
          options: [chapter.key_concepts[0] ?? "Concept A", chapter.key_concepts[1] ?? "Concept B", "Aucun des deux", "Les deux"],
          correct: 0,
          explanation: `Le concept principal de ce chapitre est : ${chapter.key_concepts[0]}.`,
        },
      ]
    }

    // Save to Supabase
    await supabase.from("course_content").upsert(
      { course_id, chapter_id, content, quiz },
      { onConflict: "course_id,chapter_id" }
    )
  } catch (e: any) {
    // error silenced in production
    content = `## ${chapter.title}\n\nContenu en cours de chargement. Rafraîchis la page dans quelques instants.`
    quiz = []
  }

  return NextResponse.json({ content, quiz })
}

// ─── Levels system ────────────────────────────────────────────────────────────
const LEVELS = [
  { min: 0,     name: "Novice",    icon: "🌱" },
  { min: 500,   name: "Apprenti",  icon: "📈" },
  { min: 1500,  name: "Trader",    icon: "💹" },
  { min: 3000,  name: "Expert",    icon: "🎯" },
  { min: 6000,  name: "Master",    icon: "🏆" },
  { min: 10000, name: "Légende",   icon: "👑" },
]
function getLevelForXP(xp: number) {
  return [...LEVELS].reverse().find(l => xp >= l.min) ?? LEVELS[0]
}

// ─── POST — save user progress + update XP ───────────────────────────────────

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "")
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { course_id, chapter_id, quiz_score, time_spent, xp_earned = 0 } = await req.json()

  // 1. Save progress row
  const { error: progressError } = await supabase.from("user_progress").upsert(
    {
      user_id:      user.id,
      course_id,
      chapter_id,
      completed:    true,
      xp_earned:    xp_earned,
      quiz_score:   quiz_score ?? null,
      time_spent:   time_spent ?? null,
      completed_at: new Date().toISOString(),
    },
    { onConflict: "user_id,course_id,chapter_id" }
  )
  if (progressError) return NextResponse.json({ error: progressError.message }, { status: 500 })

  // 2. Fetch current XP + level from user_profiles
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("xp, level_name")
    .eq("id", user.id)
    .single()

  const oldXP        = profile?.xp ?? 0
  const oldLevelName = profile?.level_name ?? "Novice"
  const newXP        = oldXP + xp_earned
  const newLevel     = getLevelForXP(newXP)
  const leveledUp    = newLevel.name !== oldLevelName

  // 3. Update user_profiles with new XP + level
  await supabase.from("user_profiles").update({
    xp:         newXP,
    level_name: newLevel.name,
  }).eq("id", user.id)

  return NextResponse.json({
    success:    true,
    new_xp:     newXP,
    new_level:  newLevel.name,
    level_icon: newLevel.icon,
    leveled_up: leveledUp,
  })
}
