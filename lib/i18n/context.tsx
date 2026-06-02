"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { translations, type Lang, type Translations } from "./translations"

type I18nContextType = {
  lang: Lang
  setLang: (l: Lang) => void
  t: Translations
}

const I18nContext = createContext<I18nContextType>({
  lang: "en",
  setLang: () => {},
  t: translations.en,
})

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    try {
      const saved = localStorage.getItem("lang") as Lang | null
      if (saved === "en" || saved === "fr") setLangState(saved)
    } catch {
      // localStorage not available
    }
  }, [])

  function setLang(l: Lang) {
    setLangState(l)
    try {
      localStorage.setItem("lang", l)
    } catch {}
  }

  // Always render with consistent state to avoid hydration mismatch
  // Use "en" on first render (matches server), switch after mount
  const effectiveLang = mounted ? lang : "en"

  return (
    <I18nContext.Provider value={{ lang: effectiveLang, setLang, t: translations[effectiveLang] }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useLanguage() {
  return useContext(I18nContext)
}
