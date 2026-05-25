export const COLORS = {
  // Backgrounds
  canvas:   "#050505",
  surface:  "#0a0a0a",
  elevated: "#0f0f0f",
  overlay:  "#141414",

  // Borders
  border_subtle:  "rgba(255,255,255,0.06)",
  border_default: "rgba(255,255,255,0.10)",
  border_strong:  "rgba(255,255,255,0.16)",

  // Text
  text_primary:   "rgba(255,255,255,0.95)",
  text_secondary: "rgba(255,255,255,0.50)",
  text_muted:     "rgba(255,255,255,0.28)",
  text_disabled:  "rgba(255,255,255,0.15)",

  // Accents
  green:        "#22c55e",
  green_bright: "#4ade80",
  green_dim:    "rgba(34,197,94,0.12)",
  green_border: "rgba(34,197,94,0.25)",

  red:       "#ef4444",
  red_bright: "#f87171",
  red_dim:    "rgba(239,68,68,0.12)",

  blue:     "#3b82f6",
  blue_dim: "rgba(59,130,246,0.12)",

  yellow:     "#f59e0b",
  yellow_dim: "rgba(245,158,11,0.12)",

  purple:     "#8b5cf6",
  purple_dim: "rgba(139,92,246,0.12)",

  orange: "#f97316",
} as const

export const SHADOWS = {
  sm:         "0 1px 2px rgba(0,0,0,0.5)",
  md:         "0 4px 12px rgba(0,0,0,0.4)",
  lg:         "0 8px 32px rgba(0,0,0,0.6)",
  glow_green: "0 0 20px rgba(34,197,94,0.15)",
  glow_red:   "0 0 20px rgba(239,68,68,0.15)",
} as const

export const RADIUS = {
  sm:    "6px",
  md:    "10px",
  lg:    "14px",
  xl:    "18px",
  "2xl": "24px",
  "3xl": "32px",
  full:  "9999px",
} as const

export const CARD_STYLE = {
  background:   COLORS.surface,
  border:       `1px solid ${COLORS.border_subtle}`,
  borderRadius: RADIUS.xl,
}

export const CARD_ACCENT_STYLE = (color: string) => ({
  background:   `${color}06`,
  border:       `1px solid ${color}20`,
  borderRadius: RADIUS.xl,
})

export const BADGE_STYLE = (color: string) => ({
  background:   `${color}12`,
  color,
  border:       `1px solid ${color}20`,
  padding:      "2px 8px",
  borderRadius: RADIUS.full,
  fontSize:     "11px",
  fontWeight:   700,
})
