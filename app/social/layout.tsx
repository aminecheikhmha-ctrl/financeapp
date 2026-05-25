import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Social Trading",
  description: "Suis les meilleurs traders et copie leurs stratégies sur TradEx",
}

export default function SocialLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
