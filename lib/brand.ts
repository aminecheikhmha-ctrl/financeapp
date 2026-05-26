// Identité visuelle Tradex — source unique de vérité

export const TRADEX_BRAND = {
  name: "Tradex",
  tagline: "Trading intelligent avec l'IA",
  tagline_short: "Trading IA",
  url: "https://tradex.io",
  email: "contact@tradex.io",
  email_noreply: "noreply@tradex.io",
  app_id: "io.tradex.app",

  colors: {
    primary:       "#22c55e",
    primary_bright: "#4ade80",
    primary_dark:  "#16a34a",
    background:    "#050505",
    surface:       "#0a0a0a",
  },

  social: {
    twitter: "@TradexApp",
  },

  legal: {
    company: "Tradex SAS",
    country: "France",
  },

  disclaimer: "Tradex est un outil éducatif de paper trading. Les performances passées ne garantissent pas les résultats futurs. Ce n'est pas un conseil financier.",
  disclaimer_short: "Paper trading · Sans risque réel",
} as const

export type TradexBrand = typeof TRADEX_BRAND
