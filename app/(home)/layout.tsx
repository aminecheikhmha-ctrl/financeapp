import Navbar from "@/app/components/Navbar"

export const metadata = {
  title: "Tradex — Trading intelligent avec l'IA | Signaux, Analyses, Académie",
  description: "Signaux de trading IA en temps réel, analyses algorithmiques sur 160+ actifs, paper trading et académie interactive. Tradez plus intelligemment.",
  keywords: ["signaux trading", "trading IA", "analyse technique", "RSI MACD", "paper trading", "académie trading"],
  openGraph: {
    title: "Tradex — Trading intelligent avec l'IA",
    description: "Signaux en temps réel · Analyses IA · Paper Trading · Académie interactive",
    type: "website",
    locale: "fr_FR",
  },
}

export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto" style={{ background: "transparent" }}>
      <Navbar />
      {children}
    </div>
  )
}
