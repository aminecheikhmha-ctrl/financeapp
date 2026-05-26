export type Rarity = "common" | "rare" | "epic" | "legendary"
export type AchievementCategory = "trading" | "learning" | "community" | "social" | "streak"

export const RARITY_COLORS: Record<Rarity, { text: string; bg: string; border: string; hex: string; label: string }> = {
  common:    { text: "text-gray-400",   bg: "bg-gray-500/10",   border: "border-gray-500/20",   hex: "#9ca3af", label: "Commun"     },
  rare:      { text: "text-blue-400",   bg: "bg-blue-500/10",   border: "border-blue-500/20",   hex: "#60a5fa", label: "Rare"       },
  epic:      { text: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/20", hex: "#a78bfa", label: "Épique"     },
  legendary: { text: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/20", hex: "#facc15", label: "Légendaire" },
}

export const ACHIEVEMENTS = [
  // Trading
  { id: "first_trade",      icon: "🎯", title: "Premier Trade",       description: "Passer ton premier ordre paper trading",       xp: 100,  rarity: "common"    as Rarity, category: "trading"   as AchievementCategory },
  { id: "profit_streak_3",  icon: "🔥", title: "En feu !",            description: "3 trades gagnants consécutifs",               xp: 250,  rarity: "rare"      as Rarity, category: "trading"   as AchievementCategory },
  { id: "profit_streak_5",  icon: "🚀", title: "Inarrêtable",         description: "5 trades gagnants consécutifs",               xp: 500,  rarity: "epic"      as Rarity, category: "trading"   as AchievementCategory },
  { id: "first_10k",        icon: "💰", title: "Première fortune",    description: "Portfolio > $110,000 (+10%)",                  xp: 300,  rarity: "rare"      as Rarity, category: "trading"   as AchievementCategory },
  { id: "first_50k_profit", icon: "💎", title: "Diamant",             description: "P&L total > $50,000",                         xp: 1000, rarity: "legendary" as Rarity, category: "trading"   as AchievementCategory },
  { id: "tp_hit",           icon: "🎯", title: "Sniper",              description: "Take Profit atteint 5 fois",                  xp: 200,  rarity: "rare"      as Rarity, category: "trading"   as AchievementCategory },
  { id: "risk_manager",     icon: "🛡️", title: "Gestionnaire",        description: "Stop Loss respecté 10 fois",                  xp: 300,  rarity: "rare"      as Rarity, category: "trading"   as AchievementCategory },
  { id: "diversified",      icon: "🌍", title: "Diversifié",          description: "5 actifs différents en portfolio",             xp: 150,  rarity: "common"    as Rarity, category: "trading"   as AchievementCategory },
  { id: "crypto_trader",    icon: "₿",  title: "Crypto Trader",       description: "Premier trade sur une crypto",                xp: 100,  rarity: "common"    as Rarity, category: "trading"   as AchievementCategory },
  { id: "day_trader",       icon: "⚡", title: "Day Trader",          description: "5 trades en une seule journée",               xp: 200,  rarity: "rare"      as Rarity, category: "trading"   as AchievementCategory },
  { id: "big_winner",       icon: "🤑", title: "Gros Gain",           description: "+$5,000 sur un seul trade",                   xp: 750,  rarity: "epic"      as Rarity, category: "trading"   as AchievementCategory },
  { id: "comeback",         icon: "💪", title: "Come-back",           description: "Remonter après -$10,000 de drawdown",         xp: 600,  rarity: "epic"      as Rarity, category: "trading"   as AchievementCategory },
  { id: "patience",         icon: "🧘", title: "Patience",            description: "Tenir une position plus de 7 jours",          xp: 200,  rarity: "common"    as Rarity, category: "trading"   as AchievementCategory },
  // Learning
  { id: "first_course",     icon: "📚", title: "Élève modèle",        description: "Compléter ton premier cours",                 xp: 200,  rarity: "common"    as Rarity, category: "learning"  as AchievementCategory },
  { id: "all_beginner",     icon: "🎓", title: "Diplômé débutant",    description: "Tous les cours débutant complétés",           xp: 500,  rarity: "rare"      as Rarity, category: "learning"  as AchievementCategory },
  { id: "quiz_master",      icon: "🧠", title: "Quiz Master",         description: "10 quiz avec score parfait",                  xp: 300,  rarity: "rare"      as Rarity, category: "learning"  as AchievementCategory },
  { id: "speed_learner",    icon: "⚡", title: "Speed Learner",       description: "3 cours complétés en une semaine",            xp: 400,  rarity: "epic"      as Rarity, category: "learning"  as AchievementCategory },
  // Community
  { id: "first_post",       icon: "💬", title: "Contributeur",        description: "Premier post sur le forum",                   xp: 100,  rarity: "common"    as Rarity, category: "community" as AchievementCategory },
  { id: "popular_post",     icon: "🌟", title: "Influenceur",         description: "Post avec 10+ likes",                         xp: 300,  rarity: "rare"      as Rarity, category: "community" as AchievementCategory },
  { id: "helpful",          icon: "🤝", title: "Utile",               description: "5 réponses sur le forum",                     xp: 200,  rarity: "common"    as Rarity, category: "community" as AchievementCategory },
  { id: "viral_post",       icon: "📣", title: "Viral",               description: "Post avec 50+ likes",                         xp: 800,  rarity: "legendary" as Rarity, category: "community" as AchievementCategory },
  // Social
  { id: "referral_1",       icon: "👥", title: "Ambassadeur",         description: "Parrainer 1 ami",                             xp: 500,  rarity: "rare"      as Rarity, category: "social"    as AchievementCategory },
  { id: "referral_5",       icon: "👑", title: "Recruteur",           description: "Parrainer 5 amis",                            xp: 1500, rarity: "legendary" as Rarity, category: "social"    as AchievementCategory },
  { id: "early_adopter",    icon: "🚀", title: "Early Adopter",       description: "Inscrit dans les 1000 premiers",              xp: 500,  rarity: "epic"      as Rarity, category: "social"    as AchievementCategory },
  { id: "pro_upgrade",      icon: "⭐", title: "Pro Trader",          description: "Passer au plan Pro",                          xp: 300,  rarity: "rare"      as Rarity, category: "social"    as AchievementCategory },
  { id: "top_10",           icon: "🏅", title: "Top 10",              description: "Atteindre le top 10 du classement",          xp: 700,  rarity: "epic"      as Rarity, category: "social"    as AchievementCategory },
  { id: "top_1",            icon: "🏆", title: "N°1",                 description: "Atteindre la première place",                 xp: 2000, rarity: "legendary" as Rarity, category: "social"    as AchievementCategory },
  // Streak
  { id: "streak_7",         icon: "📅", title: "Assidu",              description: "7 jours de connexion consécutifs",            xp: 200,  rarity: "common"    as Rarity, category: "streak"    as AchievementCategory },
  { id: "streak_30",        icon: "🏆", title: "Champion",            description: "30 jours de connexion consécutifs",           xp: 1000, rarity: "epic"      as Rarity, category: "streak"    as AchievementCategory },
  { id: "alert_master",     icon: "🔔", title: "Vigilant",            description: "Créer 10 alertes de prix",                    xp: 150,  rarity: "common"    as Rarity, category: "streak"    as AchievementCategory },
] as const

export type AchievementId = typeof ACHIEVEMENTS[number]["id"]

export const LEVEL_COLORS = [
  "#9ca3af", // Novice - gray
  "#4ade80", // Apprenti - green
  "#60a5fa", // Trader - blue
  "#a78bfa", // Expert - purple
  "#f59e0b", // Master - amber
  "#facc15", // Légende - gold
]

export const XP_LEVELS = [
  { min: 0,     name: "Novice",   icon: "🌱", color: LEVEL_COLORS[0] },
  { min: 500,   name: "Apprenti", icon: "📈", color: LEVEL_COLORS[1] },
  { min: 1500,  name: "Trader",   icon: "💹", color: LEVEL_COLORS[2] },
  { min: 3000,  name: "Expert",   icon: "🎯", color: LEVEL_COLORS[3] },
  { min: 6000,  name: "Master",   icon: "🏆", color: LEVEL_COLORS[4] },
  { min: 10000, name: "Légende",  icon: "👑", color: LEVEL_COLORS[5] },
] as const

export const LEVELS = XP_LEVELS

export function getLevelFromXP(xp: number) {
  for (let i = XP_LEVELS.length - 1; i >= 0; i--) {
    if (xp >= XP_LEVELS[i].min) return { ...XP_LEVELS[i], index: i }
  }
  return { ...XP_LEVELS[0], index: 0 }
}

export function getNextLevel(xp: number) {
  const current = getLevelFromXP(xp)
  if (current.index >= XP_LEVELS.length - 1) return null
  return XP_LEVELS[current.index + 1]
}

export function getXPProgress(xp: number): number {
  const current = getLevelFromXP(xp)
  const next = getNextLevel(xp)
  if (!next) return 100
  return Math.round(((xp - current.min) / (next.min - current.min)) * 100)
}

export function getLevelInfo(xp: number) {
  const current = getLevelFromXP(xp)
  const next = getNextLevel(xp)
  const progress = getXPProgress(xp)
  return {
    level: current.index + 1,
    name: current.name,
    icon: current.icon,
    color: current.color,
    progress,
    nextLevel: next?.name ?? null,
    nextLevelXP: next?.min ?? null,
    xp,
  }
}
