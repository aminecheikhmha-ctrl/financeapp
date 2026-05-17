import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Signaux",
  description: "Signaux de trading IA en temps réel — ACHAT, VENTE, score de confluence et niveaux TP/SL.",
}

export default function SignauxLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
