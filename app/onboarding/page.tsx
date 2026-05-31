"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { motion, AnimatePresence } from "framer-motion"
import { haptic } from "@/lib/capacitor"
import TradexLogo from "@/app/components/TradexLogo"
import { useLanguage } from "@/lib/i18n/context"

type OnboardingStep = "language" | "welcome" | "level" | "goals" | "assets" | "capital" | "done"
const STEPS: OnboardingStep[] = ["language", "welcome", "level", "goals", "assets", "capital", "done"]

const LEVELS = [
  { key: "debutant",       labelKey: "beginner" as const,     descKey: "beginnerDesc" as const,     icon: "🌱", color: "#4ade80" },
  { key: "intermediaire",  labelKey: "intermediate" as const, descKey: "intermediateDesc" as const, icon: "📊", color: "#60a5fa" },
  { key: "avance",         labelKey: "advanced" as const,     descKey: "advancedDesc" as const,     icon: "🏆", color: "#a78bfa" },
  { key: "professionnel",  labelKey: "advanced" as const,     descKey: "advancedDesc" as const,     icon: "💎", color: "#fbbf24" },
]

const GOALS = [
  { key: "apprendre",      labelKey: "learn" as const,    descKey: "learnDesc" as const,    icon: "📚" },
  { key: "revenus",        labelKey: "passive" as const,  descKey: "passiveDesc" as const,  icon: "💰" },
  { key: "investissement", labelKey: "grow" as const,     descKey: "growDesc" as const,     icon: "📈" },
  { key: "swing",          labelKey: "fun" as const,      descKey: "funDesc" as const,      icon: "🌊" },
  { key: "crypto",         labelKey: "learn" as const,    descKey: "learnDesc" as const,    icon: "₿"  },
  { key: "decouverte",     labelKey: "fun" as const,      descKey: "funDesc" as const,      icon: "🔭" },
]

const ASSET_TYPES = [
  { key: "stocks",      icon: "📈", desc: "Apple, Tesla, NVIDIA..."  },
  { key: "crypto",      icon: "₿",  desc: "Bitcoin, Ethereum..."     },
  { key: "etf",         icon: "📦", desc: "S&P 500, Nasdaq..."       },
  { key: "forex",       icon: "💱", desc: "EUR/USD, GBP/USD..."      },
  { key: "commodities", icon: "🥇", desc: "Or, pétrole..."           },
]

const ASSET_LABEL_KEYS: Record<string, string> = {
  stocks: "Actions",
  crypto: "Cryptos",
  etf: "ETF / Indices",
  forex: "Forex",
  commodities: "Matières premières",
}

const CAPITAL_RANGES = [
  { key: "discover", label: "Je découvre",       desc: "Mode démo uniquement",      icon: "👀" },
  { key: "small",    label: "< 1 000€",          desc: "Petit portefeuille",        icon: "💶" },
  { key: "medium",   label: "1 000 — 10 000€",   desc: "Portefeuille moyen",        icon: "💰" },
  { key: "large",    label: "10 000 — 50 000€",  desc: "Portefeuille avancé",       icon: "💎" },
  { key: "pro",      label: "> 50 000€",         desc: "Portefeuille professionnel", icon: "🏦" },
]

export default function OnboardingPage() {
  const router = useRouter()
  const { t, lang, setLang } = useLanguage()
  const [step, setStep]   = useState<OnboardingStep>("language")
  const [user, setUser]   = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [selections, setSelections] = useState({
    username: "",
    level: "",
    goals: [] as string[],
    assets: [] as string[],
    capital: "",
  })

  const stepIndex = STEPS.indexOf(step)
  const progress  = (stepIndex / (STEPS.length - 1)) * 100

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push("/signup"); return }
      setUser(session.user)
      const defaultName = session.user.user_metadata?.username
        ?? session.user.email?.split("@")[0]
        ?? ""
      setSelections(s => ({ ...s, username: defaultName }))
    })
  }, [])

  function next() { haptic("light"); setStep(STEPS[stepIndex + 1]) }
  function prev() { haptic("light"); setStep(STEPS[stepIndex - 1]) }

  function toggleGoal(key: string) {
    haptic("light")
    setSelections(s => ({
      ...s,
      goals: s.goals.includes(key) ? s.goals.filter(g => g !== key) : [...s.goals, key],
    }))
  }

  function toggleAsset(key: string) {
    haptic("light")
    setSelections(s => ({
      ...s,
      assets: s.assets.includes(key) ? s.assets.filter(a => a !== key) : [...s.assets, key],
    }))
  }

  async function completeOnboarding() {
    if (!user) return
    setSaving(true)
    haptic("success")
    try {
      await supabase.from("user_profiles").upsert({
        id: user.id,
        username: selections.username.trim() || user.email?.split("@")[0],
        level_name: "Novice",
        xp: 100,
        streak_days: 0,
        last_login: new Date().toISOString(),
        trading_level: selections.level,
        trading_goals: selections.goals,
        preferred_assets: selections.assets,
        capital_range: selections.capital,
        onboarding_completed: true,
        onboarding_completed_at: new Date().toISOString(),
      }, { onConflict: "id" })

      await supabase.from("trading_accounts").upsert({
        user_id: user.id,
        cash: 100000,
        initial_cash: 100000,
      }, { onConflict: "user_id" })

      // XP bonus (best-effort)
      await Promise.resolve(supabase.rpc("increment_xp", { user_id: user.id, amount: 100 })).catch(() => {})

      // Welcome email (best-effort)
      fetch("/api/emails/welcome", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email, username: selections.username }),
      }).catch(() => {})

      setStep("done")
    } catch (e) {
      console.error(e)
    }
    setSaving(false)
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#050505]">

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
        <TradexLogo size={28} showText textSize="sm" />
        {step !== "language" && step !== "welcome" && step !== "done" && (
          <div className="flex items-center gap-3">
            <div className="w-32 h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full rounded-full bg-green-400 transition-all duration-500"
                style={{ width: `${progress}%` }} />
            </div>
            <span className="text-[10px] text-white/30">{stepIndex}/{STEPS.length - 1}</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.18 }}
            className="w-full max-w-lg"
          >

            {/* ── LANGUAGE ── */}
            {step === "language" && (
              <div className="text-center">
                <div className="text-5xl mb-6">🌐</div>
                <h1 className="text-3xl font-black text-white mb-3">{t.onboarding.stepLanguage}</h1>
                <p className="text-white/40 text-sm mb-10">{t.onboarding.languageLabel}</p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                  {(["en", "fr"] as const).map(l => (
                    <button
                      key={l}
                      onClick={() => { setLang(l); haptic("light"); next() }}
                      className="w-full sm:w-48 flex items-center justify-center gap-3 py-5 rounded-2xl font-black text-lg transition-all hover:scale-[1.03]"
                      style={{
                        background: lang === l ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.04)",
                        border: `2px solid ${lang === l ? "rgba(34,197,94,0.40)" : "rgba(255,255,255,0.10)"}`,
                        color: "#fff",
                      }}>
                      <span className="text-3xl">{l === "en" ? "🇬🇧" : "🇫🇷"}</span>
                      <span>{l === "en" ? "English" : "Français"}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── WELCOME ── */}
            {step === "welcome" && (
              <div className="text-center">
                <div className="relative w-24 h-24 mx-auto mb-8">
                  <div className="absolute inset-0 rounded-3xl opacity-20 animate-ping"
                    style={{ background: "rgba(34,197,94,0.5)", animationDuration: "2s" }} />
                  <TradexLogo size={96} />
                </div>
                <h1 className="text-3xl font-black text-white mb-3">{t.onboarding.doneTitle}</h1>
                <p className="text-white/50 text-base leading-relaxed mb-6">
                  {t.onboarding.doneSubtitle}
                </p>

                {/* Username */}
                <div className="mb-6 text-left">
                  <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2 font-bold">
                    Ton pseudo de trader
                  </p>
                  <input
                    value={selections.username}
                    onChange={e => setSelections(s => ({ ...s, username: e.target.value }))}
                    placeholder="MonPseudo123"
                    maxLength={20}
                    className="w-full text-center text-lg font-bold px-4 py-3 rounded-xl outline-none text-white transition focus:border-green-500/50"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}
                  />
                </div>

                {/* Features */}
                <div className="grid grid-cols-2 gap-3 mb-8">
                  {[
                    { icon: "📡", text: "Signaux IA temps réel"  },
                    { icon: "🎓", text: "Académie interactive"   },
                    { icon: "💼", text: "$100k fictifs offerts"  },
                    { icon: "🤖", text: "Tuteur IA personnel"    },
                  ].map(f => (
                    <div key={f.text} className="flex items-center gap-2.5 p-3 rounded-xl text-left"
                      style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.12)" }}>
                      <span className="text-xl">{f.icon}</span>
                      <span className="text-xs font-semibold text-white/70">{f.text}</span>
                    </div>
                  ))}
                </div>

                <button onClick={next} disabled={!selections.username.trim()}
                  className="w-full py-4 rounded-2xl font-black text-base text-black transition-all hover:scale-[1.02] disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)" }}>
                  {t.onboarding.next}
                </button>
              </div>
            )}

            {/* ── LEVEL ── */}
            {step === "level" && (
              <div>
                <div className="text-center mb-8">
                  <p className="text-4xl mb-3">📊</p>
                  <h2 className="text-2xl font-black text-white mb-2">{t.onboarding.stepLevel}</h2>
                  <p className="text-white/40 text-sm">{t.onboarding.doneSubtitle}</p>
                </div>
                <div className="space-y-3 mb-8">
                  {LEVELS.map(level => (
                    <button key={level.key}
                      onClick={() => { setSelections(s => ({ ...s, level: level.key })); haptic("light") }}
                      className="w-full flex items-center gap-4 p-4 rounded-2xl transition-all text-left"
                      style={{
                        background: selections.level === level.key ? `${level.color}12` : "rgba(255,255,255,0.03)",
                        border: `1px solid ${selections.level === level.key ? `${level.color}35` : "rgba(255,255,255,0.07)"}`,
                        transform: selections.level === level.key ? "scale(1.01)" : "scale(1)",
                      }}>
                      <span className="text-3xl">{level.icon}</span>
                      <div className="flex-1">
                        <p className="font-black text-white">{t.onboarding.levels[level.labelKey]}</p>
                        <p className="text-xs text-white/40 mt-0.5">{t.onboarding.levels[level.descKey]}</p>
                      </div>
                      {selections.level === level.key && (
                        <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black text-black flex-shrink-0"
                          style={{ background: level.color }}>✓</span>
                      )}
                    </button>
                  ))}
                </div>
                <div className="flex gap-3">
                  <button onClick={prev} className="px-5 py-3 rounded-xl text-sm font-semibold text-white/40 hover:text-white transition border border-white/[0.08]">{t.onboarding.prev}</button>
                  <button onClick={next} disabled={!selections.level}
                    className="flex-1 py-3 rounded-xl font-black text-sm text-black disabled:opacity-40 transition-all hover:scale-[1.01]"
                    style={{ background: "#22c55e" }}>
                    {t.onboarding.next}
                  </button>
                </div>
              </div>
            )}

            {/* ── GOALS ── */}
            {step === "goals" && (
              <div>
                <div className="text-center mb-8">
                  <p className="text-4xl mb-3">🎯</p>
                  <h2 className="text-2xl font-black text-white mb-2">{t.onboarding.stepGoal}</h2>
                  <p className="text-white/40 text-sm">{t.onboarding.skip}</p>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-8">
                  {GOALS.map(goal => {
                    const selected = selections.goals.includes(goal.key)
                    return (
                      <button key={goal.key} onClick={() => toggleGoal(goal.key)}
                        className="flex items-center gap-3 p-4 rounded-2xl transition-all text-left"
                        style={{
                          background: selected ? "rgba(34,197,94,0.10)" : "rgba(255,255,255,0.03)",
                          border: `1px solid ${selected ? "rgba(34,197,94,0.30)" : "rgba(255,255,255,0.07)"}`,
                        }}>
                        <span className="text-2xl">{goal.icon}</span>
                        <span className="text-sm font-semibold text-white/70 flex-1">{t.onboarding.goals[goal.labelKey]}</span>
                        {selected && <span className="text-green-400 text-sm">✓</span>}
                      </button>
                    )
                  })}
                </div>
                <div className="flex gap-3">
                  <button onClick={prev} className="px-5 py-3 rounded-xl text-sm font-semibold text-white/40 hover:text-white transition border border-white/[0.08]">{t.onboarding.prev}</button>
                  <button onClick={next} disabled={selections.goals.length === 0}
                    className="flex-1 py-3 rounded-xl font-black text-sm text-black disabled:opacity-40 transition-all hover:scale-[1.01]"
                    style={{ background: "#22c55e" }}>
                    {t.onboarding.next}
                  </button>
                </div>
              </div>
            )}

            {/* ── ASSETS ── */}
            {step === "assets" && (
              <div>
                <div className="text-center mb-8">
                  <p className="text-4xl mb-3">💹</p>
                  <h2 className="text-2xl font-black text-white mb-2">{t.onboarding.stepStyle}</h2>
                  <p className="text-white/40 text-sm">{t.onboarding.skip}</p>
                </div>
                <div className="space-y-3 mb-8">
                  {ASSET_TYPES.map(asset => {
                    const selected = selections.assets.includes(asset.key)
                    return (
                      <button key={asset.key} onClick={() => toggleAsset(asset.key)}
                        className="w-full flex items-center gap-4 p-4 rounded-2xl transition-all text-left"
                        style={{
                          background: selected ? "rgba(34,197,94,0.08)" : "rgba(255,255,255,0.03)",
                          border: `1px solid ${selected ? "rgba(34,197,94,0.25)" : "rgba(255,255,255,0.07)"}`,
                        }}>
                        <span className="text-2xl">{asset.icon}</span>
                        <div className="flex-1">
                          <p className="font-bold text-white">{ASSET_LABEL_KEYS[asset.key]}</p>
                          <p className="text-xs text-white/35">{asset.desc}</p>
                        </div>
                        {selected && (
                          <span className="w-5 h-5 rounded-full bg-green-400 flex items-center justify-center text-[10px] font-black text-black flex-shrink-0">✓</span>
                        )}
                      </button>
                    )
                  })}
                </div>
                <div className="flex gap-3">
                  <button onClick={prev} className="px-5 py-3 rounded-xl text-sm font-semibold text-white/40 hover:text-white transition border border-white/[0.08]">{t.onboarding.prev}</button>
                  <button onClick={next} disabled={selections.assets.length === 0}
                    className="flex-1 py-3 rounded-xl font-black text-sm text-black disabled:opacity-40 transition-all hover:scale-[1.01]"
                    style={{ background: "#22c55e" }}>
                    {t.onboarding.next}
                  </button>
                </div>
              </div>
            )}

            {/* ── CAPITAL ── */}
            {step === "capital" && (
              <div>
                <div className="text-center mb-8">
                  <p className="text-4xl mb-3">💰</p>
                  <h2 className="text-2xl font-black text-white mb-2">{t.onboarding.stepRisk}</h2>
                  <p className="text-white/40 text-sm">{t.onboarding.skip}</p>
                </div>
                <div className="space-y-2.5 mb-8">
                  {CAPITAL_RANGES.map(range => (
                    <button key={range.key}
                      onClick={() => { setSelections(s => ({ ...s, capital: range.key })); haptic("light") }}
                      className="w-full flex items-center gap-4 p-4 rounded-2xl transition-all text-left"
                      style={{
                        background: selections.capital === range.key ? "rgba(34,197,94,0.08)" : "rgba(255,255,255,0.03)",
                        border: `1px solid ${selections.capital === range.key ? "rgba(34,197,94,0.25)" : "rgba(255,255,255,0.07)"}`,
                      }}>
                      <span className="text-2xl">{range.icon}</span>
                      <div className="flex-1">
                        <p className="font-bold text-white">{range.label}</p>
                        <p className="text-xs text-white/35">{range.desc}</p>
                      </div>
                      {selections.capital === range.key && (
                        <span className="w-5 h-5 rounded-full bg-green-400 flex items-center justify-center text-[10px] font-black text-black flex-shrink-0">✓</span>
                      )}
                    </button>
                  ))}
                </div>
                <div className="flex gap-3">
                  <button onClick={prev} className="px-5 py-3 rounded-xl text-sm font-semibold text-white/40 hover:text-white transition border border-white/[0.08]">{t.onboarding.prev}</button>
                  <button onClick={completeOnboarding} disabled={!selections.capital || saving}
                    className="flex-1 py-3 rounded-xl font-black text-sm text-black disabled:opacity-40 transition-all hover:scale-[1.01]"
                    style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)" }}>
                    {saving ? "⏳ " + t.common.loading : "🚀 " + t.onboarding.doneCta}
                  </button>
                </div>
              </div>
            )}

            {/* ── DONE ── */}
            {step === "done" && (
              <div className="text-center">
                <div className="text-7xl mb-6 animate-bounce">🎉</div>
                <h2 className="text-3xl font-black text-white mb-3">
                  {t.onboarding.doneTitle}
                </h2>
                <p className="text-white/50 text-base leading-relaxed mb-8">
                  {t.onboarding.doneSubtitle}
                </p>

                {/* Summary */}
                <div className="rounded-2xl p-5 mb-8 text-left"
                  style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.15)" }}>
                  <p className="text-[10px] text-green-400/60 uppercase tracking-widest font-bold mb-3">{t.onboarding.languageLabel}</p>
                  <div className="space-y-2">
                    {[
                      { label: "Pseudo",  value: selections.username },
                      { label: t.onboarding.stepLevel,  value: LEVELS.find(l => l.key === selections.level)?.labelKey ? t.onboarding.levels[LEVELS.find(l => l.key === selections.level)!.labelKey] : "" },
                      { label: t.onboarding.stepStyle,  value: selections.assets.map(a => ASSET_LABEL_KEYS[a]).join(", ") },
                      { label: t.onboarding.stepRisk,   value: CAPITAL_RANGES.find(c => c.key === selections.capital)?.label },
                    ].map(item => (
                      <div key={item.label} className="flex justify-between text-sm">
                        <span className="text-white/40">{item.label}</span>
                        <span className="font-semibold text-white">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <button onClick={() => router.push("/dashboard")}
                    className="w-full py-4 rounded-2xl font-black text-base text-black transition-all hover:scale-[1.02]"
                    style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)", boxShadow: "0 0 40px rgba(34,197,94,0.25)" }}>
                    🚀 {t.onboarding.doneCta}
                  </button>
                </div>
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </div>

      {/* Skip */}
      {step !== "language" && step !== "welcome" && step !== "done" && (
        <div className="text-center pb-6">
          <button onClick={() => router.push("/dashboard")}
            className="text-xs text-white/20 hover:text-white/50 transition">
            {t.onboarding.skip} →
          </button>
        </div>
      )}
    </div>
  )
}
