import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Portfolio",
  description: "Gère ton portefeuille de trading — positions ouvertes, performance et historique des ordres.",
}

export default function PortfolioLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
