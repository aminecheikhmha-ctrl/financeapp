import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Forum",
  description: "Échange avec la communauté FinanceApp — analyses, questions et débats sur les marchés.",
}

export default function ForumLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
