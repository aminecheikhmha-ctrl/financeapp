import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Analyses IA",
  description: "Analyses techniques et fondamentales générées par IA pour tes actifs favoris.",
}

export default function AnalysesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
