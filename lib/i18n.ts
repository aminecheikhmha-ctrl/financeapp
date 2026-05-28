import frMessages from "@/messages/fr.json"
import enMessages from "@/messages/en.json"

type Messages = typeof frMessages
type Language = "fr" | "en"

const MESSAGES: Record<Language, Messages> = {
  fr: frMessages,
  en: enMessages as unknown as Messages,
}

export function t(key: string, lang?: Language): string {
  const l: Language = lang ?? getLanguage()
  const messages: Record<string, unknown> = MESSAGES[l] ?? MESSAGES.fr
  const parts = key.split(".")
  let current: unknown = messages
  for (const part of parts) {
    if (typeof current !== "object" || current === null) return key
    current = (current as Record<string, unknown>)[part]
  }
  return typeof current === "string" ? current : key
}

export function getLanguage(): Language {
  if (typeof window !== "undefined") {
    return (localStorage.getItem("tradex_lang") as Language) ?? "fr"
  }
  return "fr"
}

export function setLanguage(lang: Language): void {
  if (typeof window !== "undefined") {
    localStorage.setItem("tradex_lang", lang)
  }
}

/** React hook — use inside client components */
export function useTranslation() {
  const lang = getLanguage()
  return {
    t: (key: string) => t(key, lang),
    lang,
    setLang: setLanguage,
  }
}
