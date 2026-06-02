/**
 * Returns a language instruction to append to AI system prompts.
 * Pass `lang` from the request body (sent by the client via useLanguage()).
 */
export function langInstruction(lang?: string): string {
  return lang === "fr"
    ? "Réponds toujours en français."
    : "Always respond in English."
}

/**
 * Replaces hard-coded French language directives in a prompt string.
 */
export function setPromptLang(prompt: string, lang?: string): string {
  const frPatterns = [
    /[Rr]éponds (toujours )?en français[,.]?/g,
    /[Rr]édige (.*?)en français[,.]?/g,
    /Toujours en français[,.]?/g,
    /en français[,.]?/gi,
  ]
  if (lang !== "fr") {
    // Strip French directives and add English one
    let result = prompt
    for (const p of frPatterns) result = result.replace(p, "")
    return result.trim() + " Always respond in English."
  }
  return prompt
}
