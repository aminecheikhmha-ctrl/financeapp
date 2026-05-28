import type { Metadata } from "next"

// Force dynamic rendering — prevent Vercel CDN from serving stale static HTML
// (without this, /dashboard is cached at build time while /dashboard?symbol=X is always fresh)
export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Ton tableau de bord de trading en temps réel — prix, graphes, ordres et alertes.",
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
