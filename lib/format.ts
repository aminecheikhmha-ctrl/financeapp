// ────────────────────────────────────────────────────────
//  Tradex — Formatting utilities (source of truth for the app)
// ────────────────────────────────────────────────────────

export function formatPrice(price: number | undefined | null): string {
  if (price == null) return "—"
  if (price < 0.01)  return `$${price.toFixed(6)}`
  if (price < 1)     return `$${price.toFixed(4)}`
  if (price < 100)   return `$${price.toFixed(2)}`
  if (price < 10000) return `$${price.toFixed(2)}`
  return `$${price.toLocaleString("fr-FR", { maximumFractionDigits: 0 })}`
}

export function formatChange(change: number | undefined | null, withSign = true): string {
  if (change == null) return "—"
  const sign = change >= 0 && withSign ? "+" : ""
  return `${sign}${change.toFixed(2)}%`
}

export function formatVolume(v: number | undefined | null): string {
  if (v == null)    return "—"
  if (v >= 1e12)    return `${(v / 1e12).toFixed(1)}T`
  if (v >= 1e9)     return `${(v / 1e9).toFixed(1)}B`
  if (v >= 1e6)     return `${(v / 1e6).toFixed(1)}M`
  if (v >= 1e3)     return `${(v / 1e3).toFixed(0)}K`
  return v.toString()
}

export function formatPnl(pnl: number | undefined | null): string {
  if (pnl == null) return "—"
  const sign = pnl >= 0 ? "+" : ""
  return `${sign}$${Math.abs(pnl).toFixed(2)}`
}

export function formatMarketCap(mc: number | undefined | null): string {
  if (mc == null)  return "—"
  if (mc >= 1e12)  return `$${(mc / 1e12).toFixed(2)}T`
  if (mc >= 1e9)   return `$${(mc / 1e9).toFixed(1)}B`
  if (mc >= 1e6)   return `$${(mc / 1e6).toFixed(0)}M`
  return `$${mc.toLocaleString()}`
}

export function timeAgo(dateStr: string | undefined): string {
  if (!dateStr) return "—"
  const diff  = Date.now() - new Date(dateStr).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (mins  < 1)  return "À l'instant"
  if (mins  < 60) return `Il y a ${mins}min`
  if (hours < 24) return `Il y a ${hours}h`
  if (days  < 7)  return `Il y a ${days}j`
  return new Date(dateStr).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })
}

export function formatDate(
  dateStr: string | undefined,
  opts?: Intl.DateTimeFormatOptions,
): string {
  if (!dateStr) return "—"
  return new Date(dateStr).toLocaleDateString(
    "fr-FR",
    opts ?? { day: "numeric", month: "long", year: "numeric" },
  )
}

export function formatPercent(n: number | undefined | null, decimals = 1): string {
  if (n == null) return "—"
  return `${n >= 0 ? "+" : ""}${n.toFixed(decimals)}%`
}
