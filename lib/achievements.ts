export const ACHIEVEMENTS = [
  { id: 'first_trade', icon: '🎯', title: 'Premier Trade', description: 'Passer ton premier ordre paper trading', xp: 100 },
  { id: 'profit_streak_3', icon: '🔥', title: 'En feu !', description: '3 trades gagnants consécutifs', xp: 250 },
  { id: 'profit_streak_5', icon: '🚀', title: 'Inarrêtable', description: '5 trades gagnants consécutifs', xp: 500 },
  { id: 'first_10k', icon: '💰', title: 'Première fortune', description: 'Portfolio > $110,000 (+10%)', xp: 300 },
  { id: 'first_50k_profit', icon: '💎', title: 'Diamant', description: 'P&L total > $50,000', xp: 1000 },
  { id: 'tp_hit', icon: '🎯', title: 'Sniper', description: 'Take Profit atteint 5 fois', xp: 200 },
  { id: 'risk_manager', icon: '🛡️', title: 'Gestionnaire de risque', description: 'Stop Loss respecté 10 fois', xp: 300 },
  { id: 'diversified', icon: '🌍', title: 'Diversifié', description: '5 actifs différents en portfolio', xp: 150 },
  { id: 'crypto_trader', icon: '₿', title: 'Crypto trader', description: 'Premier trade sur une crypto', xp: 100 },
  { id: 'day_trader', icon: '⚡', title: 'Day trader', description: '5 trades en une seule journée', xp: 200 },
  { id: 'first_course', icon: '📚', title: 'Élève modèle', description: 'Compléter ton premier cours', xp: 200 },
  { id: 'all_beginner', icon: '🎓', title: 'Diplômé débutant', description: 'Tous les cours débutant complétés', xp: 500 },
  { id: 'quiz_master', icon: '🧠', title: 'Quiz Master', description: '10 quiz avec score parfait', xp: 300 },
  { id: 'speed_learner', icon: '⚡', title: 'Speed Learner', description: '3 cours complétés en une semaine', xp: 400 },
  { id: 'first_post', icon: '💬', title: 'Contributeur', description: 'Premier post sur le forum', xp: 100 },
  { id: 'popular_post', icon: '🌟', title: 'Influenceur', description: 'Post avec 10+ likes', xp: 300 },
  { id: 'helpful', icon: '🤝', title: 'Utile', description: '5 réponses sur le forum', xp: 200 },
  { id: 'referral_1', icon: '👥', title: 'Ambassadeur', description: 'Parrainer 1 ami', xp: 500 },
  { id: 'referral_5', icon: '👑', title: 'Recruteur', description: 'Parrainer 5 amis', xp: 1500 },
  { id: 'streak_7', icon: '📅', title: 'Assidu', description: '7 jours de connexion consécutifs', xp: 200 },
  { id: 'streak_30', icon: '🏆', title: 'Champion', description: '30 jours de connexion consécutifs', xp: 1000 },
  { id: 'early_adopter', icon: '🚀', title: 'Early Adopter', description: 'Inscrit dans les 1000 premiers', xp: 500 },
  { id: 'pro_upgrade', icon: '⭐', title: 'Pro Trader', description: 'Passer au plan Pro', xp: 300 },
  { id: 'alert_master', icon: '🔔', title: 'Vigilant', description: 'Créer 10 alertes de prix', xp: 150 },
] as const

export type AchievementId = typeof ACHIEVEMENTS[number]['id']

export const LEVELS = [
  { min: 0,     name: 'Novice',    icon: '🌱' },
  { min: 500,   name: 'Apprenti',  icon: '📈' },
  { min: 1500,  name: 'Trader',    icon: '💹' },
  { min: 3000,  name: 'Expert',    icon: '🎯' },
  { min: 6000,  name: 'Master',    icon: '🏆' },
  { min: 10000, name: 'Légende',   icon: '👑' },
] as const

export function getLevelFromXP(xp: number) {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].min) return { ...LEVELS[i], index: i }
  }
  return { ...LEVELS[0], index: 0 }
}

export function getNextLevel(xp: number) {
  const current = getLevelFromXP(xp)
  if (current.index >= LEVELS.length - 1) return null
  return LEVELS[current.index + 1]
}

export function getXPProgress(xp: number): number {
  const current = getLevelFromXP(xp)
  const next = getNextLevel(xp)
  if (!next) return 100
  return Math.round(((xp - current.min) / (next.min - current.min)) * 100)
}
