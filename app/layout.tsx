import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import Navbar from "./components/Navbar"
import Sidebar from "./components/Sidebar"
import ServiceWorker from "./components/ServiceWorker"
import { Analytics } from "@vercel/analytics/react"
import { SpeedInsights } from "@vercel/speed-insights/next"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
})

export const metadata: Metadata = {
  title: {
    default: "FinanceApp — Trading intelligent avec l'IA",
    template: "%s | FinanceApp",
  },
  description: "Signaux de trading en temps réel, analyses IA, graphes professionnels et académie de trading complète. Tradez plus intelligemment.",
  keywords: ["trading", "bourse", "crypto", "signaux", "analyse technique", "IA", "investissement", "paper trading"],
  authors: [{ name: "FinanceApp" }],
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: "https://financeapp.io",
    siteName: "FinanceApp",
    title: "FinanceApp — Trading intelligent avec l'IA",
    description: "Signaux de trading en temps réel, analyses IA et académie de trading — tout en un.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "FinanceApp" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "FinanceApp — Trading intelligent avec l'IA",
    description: "Signaux de trading en temps réel, analyses IA et académie de trading.",
    images: ["/og-image.png"],
  },
  manifest: "/manifest.json",
  icons: {
    icon: "/icon-192.png",
    apple: "/icon-192.png",
  },
}

export const viewport: Viewport = {
  themeColor: "#4ade80",
  width: "device-width",
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <body className={`${inter.variable} font-sans bg-[#080808] text-white`}>
        <ServiceWorker />
        <Navbar />
        <Sidebar />
        <main className="pt-16 sidebar-main">
          {children}
        </main>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
