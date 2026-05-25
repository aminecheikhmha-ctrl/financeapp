export type MarketStatus = {
  isOpen: boolean
  market: string
  opensAt: Date | null
  closesAt: Date | null
  nextOpen: Date | null
  timeUntilOpen: number | null   // minutes
  timeUntilClose: number | null  // minutes
  session: "pre-market" | "regular" | "after-hours" | "closed" | "weekend"
  message: string
}

const CRYPTO_FRAGMENTS = ["BTC", "ETH", "SOL", "BNB", "XRP", "ADA", "AVAX",
                           "DOGE", "MATIC", "LINK", "DOT", "ATOM", "UNI", "AAVE"]

function isCrypto(symbol: string): boolean {
  if (symbol.endsWith("-USD")) return true
  return CRYPTO_FRAGMENTS.some(f => symbol === f)
}

export function getMarketStatus(symbol: string): MarketStatus {
  // Crypto — always open
  if (isCrypto(symbol)) {
    return {
      isOpen: true,
      market: "Crypto",
      opensAt: null,
      closesAt: null,
      nextOpen: null,
      timeUntilOpen: null,
      timeUntilClose: null,
      session: "regular",
      message: "Marché crypto ouvert 24h/7j",
    }
  }

  // NYSE/NASDAQ — ET timezone
  const now    = new Date()
  const nyStr  = now.toLocaleString("en-US", { timeZone: "America/New_York" })
  const nyTime = new Date(nyStr)
  const hour   = nyTime.getHours()
  const minute = nyTime.getMinutes()
  const day    = nyTime.getDay()  // 0=Sun, 6=Sat

  const timeInMinutes = hour * 60 + minute
  const regularOpen   = 9 * 60 + 30   // 9:30
  const regularClose  = 16 * 60        // 16:00
  const preOpen       = 4 * 60         // 04:00
  const afterClose    = 20 * 60        // 20:00

  function getNextOpen(): Date {
    const next = new Date(nyTime)
    next.setSeconds(0, 0)
    if (day === 0 /* Sun */) {
      next.setDate(next.getDate() + 1)  // Monday
    } else if (day === 6 /* Sat */) {
      next.setDate(next.getDate() + 2)  // Monday
    } else if (timeInMinutes < regularOpen) {
      // Today at 9:30
    } else {
      // Next weekday
      const daysAhead = day === 5 ? 3 : 1  // Friday → Monday
      next.setDate(next.getDate() + daysAhead)
    }
    next.setHours(9, 30, 0, 0)
    return next
  }

  const isWeekend = day === 0 || day === 6

  if (isWeekend) {
    const nextOpen = getNextOpen()
    const minsUntil = Math.max(0, Math.floor((nextOpen.getTime() - now.getTime()) / 60000))
    return {
      isOpen: false,
      market: "NYSE/NASDAQ",
      opensAt: nextOpen,
      closesAt: null,
      nextOpen,
      timeUntilOpen: minsUntil,
      timeUntilClose: null,
      session: "weekend",
      message: `Marché fermé — Réouvre lundi à 9h30 ET`,
    }
  }

  // Regular session
  if (timeInMinutes >= regularOpen && timeInMinutes < regularClose) {
    const minsUntilClose = regularClose - timeInMinutes
    const closesAt = new Date(nyTime)
    closesAt.setHours(16, 0, 0, 0)
    return {
      isOpen: true,
      market: "NYSE/NASDAQ",
      opensAt: null,
      closesAt,
      nextOpen: null,
      timeUntilOpen: null,
      timeUntilClose: minsUntilClose,
      session: "regular",
      message: `Marché ouvert — Ferme dans ${minsUntilClose} min (16h ET)`,
    }
  }

  // Pre-market
  if (timeInMinutes >= preOpen && timeInMinutes < regularOpen) {
    const minsUntilOpen = regularOpen - timeInMinutes
    const opensAt = new Date(nyTime)
    opensAt.setHours(9, 30, 0, 0)
    return {
      isOpen: false,
      market: "NYSE/NASDAQ",
      opensAt,
      closesAt: null,
      nextOpen: opensAt,
      timeUntilOpen: minsUntilOpen,
      timeUntilClose: null,
      session: "pre-market",
      message: `Pré-marché — Ouverture dans ${minsUntilOpen} min (9h30 ET)`,
    }
  }

  // After-hours
  if (timeInMinutes >= regularClose && timeInMinutes < afterClose) {
    const nextOpen = getNextOpen()
    return {
      isOpen: false,
      market: "NYSE/NASDAQ",
      opensAt: nextOpen,
      closesAt: null,
      nextOpen,
      timeUntilOpen: Math.max(0, Math.floor((nextOpen.getTime() - now.getTime()) / 60000)),
      timeUntilClose: null,
      session: "after-hours",
      message: `After-hours — Réouverture demain à 9h30 ET`,
    }
  }

  // Night (20h–4h)
  const nextOpen = getNextOpen()
  return {
    isOpen: false,
    market: "NYSE/NASDAQ",
    opensAt: nextOpen,
    closesAt: null,
    nextOpen,
    timeUntilOpen: Math.max(0, Math.floor((nextOpen.getTime() - now.getTime()) / 60000)),
    timeUntilClose: null,
    session: "closed",
    message: `Marché fermé — Réouverture à 9h30 ET`,
  }
}

export function formatTimeUntilOpen(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

export function getPendingOrderNote(status: MarketStatus): string {
  if (status.session === "pre-market")  return "Ordre planifié — s'exécutera à l'ouverture (9h30 ET) au prix du marché"
  if (status.session === "after-hours") return "Ordre planifié — s'exécutera demain à l'ouverture (9h30 ET) au prix du marché"
  if (status.session === "weekend")     return "Ordre planifié — s'exécutera lundi à l'ouverture (9h30 ET) au prix du marché"
  return "Ordre planifié — s'exécutera à la prochaine ouverture du marché"
}
