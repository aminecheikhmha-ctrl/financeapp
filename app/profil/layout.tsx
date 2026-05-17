import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Mon Profil",
  description: "Gère ton profil, tes préférences de trading et tes paramètres de compte.",
}

export default function ProfilLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
