import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Ton tableau de bord de trading en temps réel — prix, graphes, ordres et alertes.",
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
