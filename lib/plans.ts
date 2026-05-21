export const PLANS = {
  free: {
    watchlist_limit: 5,
    alerts_limit: 0,
    signals_per_day: 3,
    ai_analysis_per_day: 2,
    paper_trading_capital: 10_000,
    courses: ["bases-trading", "psychologie-trader", "introduction-marches", "analyse-technique-bases", "gestion-risques"],
    screener: false,
    backtest: false,
  },
  pro: {
    watchlist_limit: -1,
    alerts_limit: 10,
    signals_per_day: -1,
    ai_analysis_per_day: -1,
    paper_trading_capital: 100_000,
    courses: "all" as const,
    screener: true,
    backtest: true,
  },
  premium: {
    watchlist_limit: -1,
    alerts_limit: -1,
    signals_per_day: -1,
    ai_analysis_per_day: -1,
    paper_trading_capital: 1_000_000,
    courses: "all" as const,
    screener: true,
    backtest: true,
    api_access: true,
  },
} as const

export type PlanKey = keyof typeof PLANS

export function getPlan(plan: string): PlanKey {
  if (plan === "pro" || plan === "premium") return plan
  return "free"
}

export function isUnlimited(limit: number) {
  return limit === -1
}

export function canAccess(plan: PlanKey, feature: "screener" | "backtest" | "api_access"): boolean {
  const p = PLANS[plan] as any
  return p[feature] === true
}

export function getLimit(plan: PlanKey, key: "watchlist_limit" | "alerts_limit" | "signals_per_day" | "ai_analysis_per_day"): number {
  return PLANS[plan][key] as number
}
