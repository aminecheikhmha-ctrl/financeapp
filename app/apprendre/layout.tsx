import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Académie",
  description: "Apprends le trading de A à Z — cours structurés, vidéos et quiz pour tous les niveaux.",
}

export default function ApprendreLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
