"use client"

import { useLanguage } from "@/lib/i18n/context"

interface Props {
  variant?: "flags" | "text" | "pill"
  className?: string
}

export default function LanguagePicker({ variant = "flags", className = "" }: Props) {
  const { lang, setLang } = useLanguage()

  if (variant === "pill") {
    return (
      <div className={`flex items-center gap-1 p-1 rounded-xl ${className}`}
        style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}>
        {(["en", "fr"] as const).map(l => (
          <button
            key={l}
            onClick={() => setLang(l)}
            className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
            style={{
              background: lang === l ? "rgba(255,255,255,0.12)" : "transparent",
              color: lang === l ? "#fff" : "rgba(255,255,255,0.4)",
            }}>
            {l === "en" ? "🇬🇧 EN" : "🇫🇷 FR"}
          </button>
        ))}
      </div>
    )
  }

  if (variant === "text") {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        {(["en", "fr"] as const).map(l => (
          <button
            key={l}
            onClick={() => setLang(l)}
            className="text-sm font-semibold transition-all"
            style={{ color: lang === l ? "#fff" : "rgba(255,255,255,0.35)" }}>
            {l === "en" ? "English" : "Français"}
          </button>
        ))}
      </div>
    )
  }

  // flags (default)
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {(["en", "fr"] as const).map(l => (
        <button
          key={l}
          onClick={() => setLang(l)}
          title={l === "en" ? "English" : "Français"}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-base transition-all"
          style={{
            background: lang === l ? "rgba(255,255,255,0.1)" : "transparent",
            opacity: lang === l ? 1 : 0.45,
          }}>
          {l === "en" ? "🇬🇧" : "🇫🇷"}
        </button>
      ))}
    </div>
  )
}
