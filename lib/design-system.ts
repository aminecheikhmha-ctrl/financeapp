export const colors = {
  background: {
    base: "#080808",
    surface: "#0f0f0f",
    elevated: "#111111",
    overlay: "#0c0c0c",
  },
  border: {
    subtle: "rgba(255,255,255,0.05)",
    light: "rgba(255,255,255,0.08)",
    medium: "rgba(255,255,255,0.12)",
  },
  accent: {
    green: "#4ade80",
    greenDim: "rgba(74,222,128,0.15)",
    greenBorder: "rgba(74,222,128,0.2)",
    red: "#f87171",
    redDim: "rgba(248,113,113,0.15)",
    blue: "#60a5fa",
    yellow: "#facc15",
  },
  text: {
    primary: "#ffffff",
    secondary: "#9ca3af",
    muted: "#6b7280",
    faint: "#4b5563",
  },
} as const

export const spacing = {
  xs: "4px",
  sm: "8px",
  md: "12px",
  lg: "16px",
  xl: "24px",
  "2xl": "32px",
} as const

export const radius = {
  sm: "8px",
  md: "12px",
  lg: "16px",
  xl: "20px",
  full: "9999px",
} as const

export const typography = {
  label: "text-[9px] uppercase tracking-widest font-bold text-gray-600",
  caption: "text-[10px] text-gray-500",
  body: "text-sm text-gray-300",
  heading: "text-base font-black text-white",
  number: "font-black tabular-nums",
} as const

export const animation = {
  transition: "transition-all duration-200",
  slow: "transition-all duration-500",
  ping: "animate-ping",
  pulse: "animate-pulse",
  spin: "animate-spin",
} as const
