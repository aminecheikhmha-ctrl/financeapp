"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

const AVATAR_COLORS = [
  "#4ade80", "#60a5fa", "#f472b6", "#a78bfa",
  "#fb923c", "#34d399", "#facc15", "#f87171",
]

type FormData = {
  username: string
  avatar_color: string
  level: "débutant" | "intermédiaire" | "avancé" | ""
  trading_experience: "jamais" | "moins_1_an" | "1_3_ans" | "plus_3_ans" | ""
  goals: string[]
  capital_range: "moins_1k" | "1k_10k" | "10k_50k" | "plus_50k" | ""
  preferred_assets: string[]
  risk_tolerance: "faible" | "modéré" | "élevé" | ""
}

const TOTAL_STEPS = 5

const GOAL_OPTIONS = [
  { label: "💰 Gains court terme", value: "court_terme" },
  { label: "📦 Investissement long terme", value: "long_terme" },
  { label: "₿ Explorer la crypto", value: "crypto" },
  { label: "💵 Revenus passifs", value: "revenus_passifs" },
  { label: "🎓 Apprendre à trader", value: "apprendre" },
  { label: "🏠 Préparer ma retraite", value: "retraite" },
]

const ASSET_OPTIONS = [
  { label: "🇺🇸 Actions US", value: "actions" },
  { label: "₿ Crypto", value: "crypto" },
  { label: "📊 ETFs", value: "etf" },
  { label: "🥇 Matières premières", value: "matieres_premieres" },
  { label: "🌍 Actions internationales", value: "actions_intl" },
]

const RECOMMENDED_COURSES: Record<string, string[]> = {
  "débutant": ["Les bases du trading", "Introduction aux marchés"],
  "intermédiaire": ["Analyse technique", "Trading des actions"],
  "avancé": ["Trading algorithmique", "Stratégies Hedge Fund"],
}

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [animating, setAnimating] = useState(false)
  const [direction, setDirection] = useState<"forward" | "back">("forward")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  const [form, setForm] = useState<FormData>({
    username: "",
    avatar_color: "#4ade80",
    level: "",
    trading_experience: "",
    goals: [],
    capital_range: "",
    preferred_assets: [],
    risk_tolerance: "",
  })

  function toggleArrayValue(field: "goals" | "preferred_assets", value: string) {
    setForm(prev => {
      const arr = prev[field]
      return {
        ...prev,
        [field]: arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value],
      }
    })
  }

  function navigateStep(nextStep: number) {
    if (animating) return
    setDirection(nextStep > step ? "forward" : "back")
    setAnimating(true)
    setTimeout(() => {
      setStep(nextStep)
      setAnimating(false)
    }, 220)
  }

  async function handleFinish() {
    setSubmitting(true)
    setError("")
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) {
        setError("Session expirée. Reconnecte-toi.")
        setSubmitting(false)
        return
      }
      const res = await fetch("/api/user-profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ...form, onboarding_completed: true }),
      })
      if (!res.ok) {
        const json = await res.json()
        setError(json.error ?? "Erreur lors de la sauvegarde.")
        setSubmitting(false)
        return
      }
      document.cookie = "onboarding_done=1; path=/; max-age=31536000"
      router.push("/dashboard")
    } catch {
      setError("Erreur réseau. Réessaie.")
      setSubmitting(false)
    }
  }

  const canProceed = () => {
    if (step === 1) return form.username.trim().length >= 2
    if (step === 2) return form.level !== "" && form.trading_experience !== ""
    if (step === 3) return form.goals.length > 0 && form.capital_range !== ""
    if (step === 4) return form.preferred_assets.length > 0 && form.risk_tolerance !== ""
    return true
  }

  const outClass = animating
    ? direction === "forward"
      ? "opacity-0 -translate-x-8"
      : "opacity-0 translate-x-8"
    : "opacity-100 translate-x-0"

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Progress bar */}
      <div className="w-full h-1 bg-white/10">
        <div
          className="h-full bg-gradient-to-r from-green-400 to-emerald-500 transition-all duration-500"
          style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
        />
      </div>

      {/* Step counter */}
      <div className="flex justify-between items-center px-8 pt-6 pb-2">
        <div className="flex gap-2">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                i + 1 === step
                  ? "bg-green-400 scale-125"
                  : i + 1 < step
                  ? "bg-green-400/60"
                  : "bg-white/20"
              }`}
            />
          ))}
        </div>
        <span className="text-sm text-gray-500 font-medium">{step} / {TOTAL_STEPS}</span>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div
          className={`w-full max-w-lg transition-all duration-200 ease-in-out ${outClass}`}
        >
          {step === 1 && (
            <Step1 form={form} setForm={setForm} toggleColor={(c) => setForm(f => ({ ...f, avatar_color: c }))} />
          )}
          {step === 2 && (
            <Step2 form={form} setForm={setForm} />
          )}
          {step === 3 && (
            <Step3 form={form} setForm={setForm} toggle={(v) => toggleArrayValue("goals", v)} />
          )}
          {step === 4 && (
            <Step4 form={form} setForm={setForm} toggle={(v) => toggleArrayValue("preferred_assets", v)} />
          )}
          {step === 5 && (
            <Step5 form={form} />
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="text-center text-red-400 text-sm pb-2">{error}</div>
      )}

      {/* Navigation */}
      <div className="flex justify-between items-center px-8 pb-8 pt-2">
        <button
          onClick={() => step > 1 && navigateStep(step - 1)}
          disabled={step === 1 || animating}
          className="px-5 py-2.5 rounded-xl border border-white/10 text-gray-400 hover:text-white hover:border-white/30 transition disabled:opacity-20 text-sm font-semibold"
        >
          ← Retour
        </button>

        {step < TOTAL_STEPS ? (
          <button
            onClick={() => canProceed() && navigateStep(step + 1)}
            disabled={!canProceed() || animating}
            className="px-6 py-2.5 rounded-xl bg-green-500 hover:bg-green-400 text-black font-bold transition disabled:opacity-40 text-sm"
          >
            Continuer →
          </button>
        ) : (
          <button
            onClick={handleFinish}
            disabled={submitting}
            className="px-6 py-2.5 rounded-xl bg-green-500 hover:bg-green-400 text-black font-bold transition disabled:opacity-40 text-sm"
          >
            {submitting ? "Sauvegarde..." : "Commencer l'aventure 🚀"}
          </button>
        )}
      </div>
    </div>
  )
}

/* ---- Step 1: Bienvenue ---- */
function Step1({ form, setForm, toggleColor }: {
  form: FormData
  setForm: React.Dispatch<React.SetStateAction<FormData>>
  toggleColor: (c: string) => void
}) {
  const initial = form.username.trim()[0]?.toUpperCase() ?? "?"
  return (
    <div className="space-y-8">
      <div className="text-center">
        <div className="text-6xl mb-4">🎉</div>
        <h1 className="text-3xl font-black text-white mb-2">Bienvenue sur FinanceApp</h1>
        <p className="text-gray-400">Commençons par faire connaissance</p>
      </div>

      {/* Avatar preview */}
      <div className="flex flex-col items-center gap-4">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-black text-black transition-all duration-300"
          style={{ backgroundColor: form.avatar_color }}
        >
          {initial}
        </div>
      </div>

      {/* Username */}
      <div>
        <label className="block text-sm text-gray-400 mb-2 font-semibold">Ton pseudo</label>
        <input
          type="text"
          value={form.username}
          onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
          placeholder="ex: TradingPro92"
          className="w-full bg-[#111] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-green-500/60 transition text-base"
          maxLength={30}
        />
      </div>

      {/* Color picker */}
      <div>
        <label className="block text-sm text-gray-400 mb-3 font-semibold">Couleur de ton avatar</label>
        <div className="flex gap-3 flex-wrap">
          {AVATAR_COLORS.map(color => (
            <button
              key={color}
              onClick={() => toggleColor(color)}
              className={`w-10 h-10 rounded-full transition-all duration-200 ${
                form.avatar_color === color
                  ? "scale-125 ring-2 ring-white ring-offset-2 ring-offset-black"
                  : "hover:scale-110"
              }`}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

/* ---- Step 2: Niveau ---- */
function Step2({ form, setForm }: { form: FormData; setForm: React.Dispatch<React.SetStateAction<FormData>> }) {
  const levels = [
    { icon: "🌱", label: "Débutant", value: "débutant" as const, desc: "Je commence tout juste" },
    { icon: "📈", label: "Intermédiaire", value: "intermédiaire" as const, desc: "J'ai quelques bases" },
    { icon: "🎯", label: "Avancé", value: "avancé" as const, desc: "Je trade régulièrement" },
  ]

  const experiences = [
    { label: "Jamais", value: "jamais" as const },
    { label: "Moins d'1 an", value: "moins_1_an" as const },
    { label: "1 à 3 ans", value: "1_3_ans" as const },
    { label: "Plus de 3 ans", value: "plus_3_ans" as const },
  ]

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-2xl font-black text-white mb-2">Ton niveau en trading</h2>
        <p className="text-gray-400">Sois honnête, ça aide à personnaliser ton expérience</p>
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-3 font-semibold">Quel est ton niveau ?</label>
        <div className="grid grid-cols-3 gap-3">
          {levels.map(l => (
            <button
              key={l.value}
              onClick={() => setForm(f => ({ ...f, level: l.value }))}
              className={`p-4 rounded-xl border transition-all text-center ${
                form.level === l.value
                  ? "border-green-500/60 bg-green-500/10"
                  : "border-white/10 bg-white/3 hover:border-white/20"
              }`}
            >
              <div className="text-2xl mb-1">{l.icon}</div>
              <div className="text-white text-sm font-bold">{l.label}</div>
              <div className="text-gray-500 text-xs mt-1">{l.desc}</div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-3 font-semibold">Depuis combien de temps tu trades ?</label>
        <div className="grid grid-cols-2 gap-3">
          {experiences.map(e => (
            <button
              key={e.value}
              onClick={() => setForm(f => ({ ...f, trading_experience: e.value }))}
              className={`py-3 px-4 rounded-xl border text-sm font-semibold transition-all ${
                form.trading_experience === e.value
                  ? "border-green-500/60 bg-green-500/10 text-green-400"
                  : "border-white/10 bg-white/3 text-gray-300 hover:border-white/20"
              }`}
            >
              {e.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ---- Step 3: Objectifs ---- */
function Step3({ form, setForm, toggle }: {
  form: FormData
  setForm: React.Dispatch<React.SetStateAction<FormData>>
  toggle: (v: string) => void
}) {
  const capitalRanges = [
    { label: "Moins de 1 000€", value: "moins_1k" as const },
    { label: "1 000 – 10 000€", value: "1k_10k" as const },
    { label: "10 000 – 50 000€", value: "10k_50k" as const },
    { label: "Plus de 50 000€", value: "plus_50k" as const },
  ]

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-2xl font-black text-white mb-2">Tes objectifs</h2>
        <p className="text-gray-400">Sélectionne tout ce qui te correspond</p>
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-3 font-semibold">
          Qu'est-ce que tu veux accomplir ? <span className="text-gray-600">(plusieurs choix)</span>
        </label>
        <div className="grid grid-cols-2 gap-3">
          {GOAL_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => toggle(opt.value)}
              className={`py-3 px-4 rounded-xl border text-sm font-semibold text-left transition-all ${
                form.goals.includes(opt.value)
                  ? "border-green-500/60 bg-green-500/10 text-green-400"
                  : "border-white/10 bg-white/3 text-gray-300 hover:border-white/20"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-3 font-semibold">Quel est ton budget de départ ?</label>
        <div className="grid grid-cols-2 gap-3">
          {capitalRanges.map(r => (
            <button
              key={r.value}
              onClick={() => setForm(f => ({ ...f, capital_range: r.value }))}
              className={`py-3 px-4 rounded-xl border text-sm font-semibold transition-all ${
                form.capital_range === r.value
                  ? "border-green-500/60 bg-green-500/10 text-green-400"
                  : "border-white/10 bg-white/3 text-gray-300 hover:border-white/20"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ---- Step 4: Préférences ---- */
function Step4({ form, setForm, toggle }: {
  form: FormData
  setForm: React.Dispatch<React.SetStateAction<FormData>>
  toggle: (v: string) => void
}) {
  const riskOptions = [
    { icon: "🛡️", label: "Prudent", value: "faible" as const, desc: "Sécurité avant tout" },
    { icon: "⚖️", label: "Modéré", value: "modéré" as const, desc: "Équilibre risque/gain" },
    { icon: "🔥", label: "Agressif", value: "élevé" as const, desc: "Maximiser les gains" },
  ]

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-2xl font-black text-white mb-2">Tes préférences</h2>
        <p className="text-gray-400">Personnalise ton expérience de trading</p>
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-3 font-semibold">
          Quels actifs t'intéressent ? <span className="text-gray-600">(plusieurs choix)</span>
        </label>
        <div className="grid grid-cols-2 gap-3">
          {ASSET_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => toggle(opt.value)}
              className={`py-3 px-4 rounded-xl border text-sm font-semibold text-left transition-all ${
                form.preferred_assets.includes(opt.value)
                  ? "border-green-500/60 bg-green-500/10 text-green-400"
                  : "border-white/10 bg-white/3 text-gray-300 hover:border-white/20"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-3 font-semibold">Quel est ton profil de risque ?</label>
        <div className="grid grid-cols-3 gap-3">
          {riskOptions.map(r => (
            <button
              key={r.value}
              onClick={() => setForm(f => ({ ...f, risk_tolerance: r.value }))}
              className={`p-4 rounded-xl border transition-all text-center ${
                form.risk_tolerance === r.value
                  ? "border-green-500/60 bg-green-500/10"
                  : "border-white/10 bg-white/3 hover:border-white/20"
              }`}
            >
              <div className="text-2xl mb-1">{r.icon}</div>
              <div className="text-white text-sm font-bold">{r.label}</div>
              <div className="text-gray-500 text-xs mt-1">{r.desc}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ---- Step 5: Résumé ---- */
function Step5({ form }: { form: FormData }) {
  const courses = form.level ? RECOMMENDED_COURSES[form.level] ?? [] : []
  const levelLabel: Record<string, { emoji: string; color: string }> = {
    "débutant": { emoji: "🌱", color: "text-green-400" },
    "intermédiaire": { emoji: "📈", color: "text-blue-400" },
    "avancé": { emoji: "🎯", color: "text-purple-400" },
  }
  const lv = form.level ? levelLabel[form.level] : null
  const initial = form.username.trim()[0]?.toUpperCase() ?? "?"

  const ASSET_LABELS: Record<string, string> = {
    actions: "🇺🇸 Actions US",
    crypto: "₿ Crypto",
    etf: "📊 ETFs",
    matieres_premieres: "🥇 Matières premières",
    actions_intl: "🌍 Actions intl.",
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-black text-white mb-1">Ton compte est prêt !</h2>
        <p className="text-gray-400 text-sm">Voici un résumé de ton profil</p>
      </div>

      {/* Profile card */}
      <div className="bg-[#111] border border-white/10 rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-4">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center text-2xl font-black text-black flex-shrink-0"
            style={{ backgroundColor: form.avatar_color }}
          >
            {initial}
          </div>
          <div>
            <div className="text-white font-black text-lg">{form.username || "—"}</div>
            {lv && (
              <span className={`text-sm font-bold ${lv.color}`}>
                {lv.emoji} {form.level}
              </span>
            )}
          </div>
        </div>

        {form.goals.length > 0 && (
          <div>
            <div className="text-xs text-gray-500 mb-2 font-semibold uppercase tracking-wide">Objectifs</div>
            <div className="flex flex-wrap gap-2">
              {form.goals.map(g => {
                const opt = GOAL_OPTIONS.find(o => o.value === g)
                return (
                  <span key={g} className="text-xs px-2 py-1 rounded-lg bg-green-500/10 text-green-400 border border-green-500/20 font-semibold">
                    {opt?.label ?? g}
                  </span>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Recommended courses */}
      {courses.length > 0 && (
        <div className="bg-[#111] border border-white/10 rounded-2xl p-5">
          <div className="text-xs text-gray-500 mb-3 font-semibold uppercase tracking-wide">Cours recommandés pour toi</div>
          <div className="space-y-2">
            {courses.map(c => (
              <div key={c} className="flex items-center gap-3 py-2">
                <div className="w-6 h-6 rounded-lg bg-green-500/20 flex items-center justify-center text-xs">📚</div>
                <span className="text-white text-sm font-semibold">{c}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Assets */}
      {form.preferred_assets.length > 0 && (
        <div className="bg-[#111] border border-white/10 rounded-2xl p-5">
          <div className="text-xs text-gray-500 mb-3 font-semibold uppercase tracking-wide">Actifs sélectionnés</div>
          <div className="flex flex-wrap gap-2">
            {form.preferred_assets.map(a => (
              <span key={a} className="text-xs px-2 py-1 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 font-semibold">
                {ASSET_LABELS[a] ?? a}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Capital fictif */}
      <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-2xl p-4 text-center">
        <div className="text-green-400 text-sm font-bold">Capital fictif de départ</div>
        <div className="text-white text-3xl font-black mt-1">100 000 $</div>
        <div className="text-gray-500 text-xs mt-1">Entraîne-toi sans risque réel</div>
      </div>
    </div>
  )
}
