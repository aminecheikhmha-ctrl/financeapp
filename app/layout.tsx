import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { I18nProvider } from "@/lib/i18n/context"
import Navbar          from "./components/Navbar"
import Sidebar         from "./components/Sidebar"
import BottomNav       from "./components/BottomNav"
import MobileHeader    from "./components/MobileHeader"
import Topbar          from "./components/Topbar"
import ServiceWorker   from "./components/ServiceWorker"
import { ToastProvider } from "./components/Toast"
import { Analytics }   from "@vercel/analytics/react"
import { SpeedInsights } from "@vercel/speed-insights/next"
import ChatBot         from "./components/ChatBot"
import CookieBanner    from "./components/CookieBanner"
import NativePushSetup from "./components/NativePushSetup"
import AppSplashScreen from "./components/AppSplashScreen"
import PWAInstallBanner from "./components/PWAInstallBanner"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
})

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://tradex-kappa-six.vercel.app"),
  title: {
    default: "Tradex — Trading intelligent avec l'IA",
    template: "%s | Tradex",
  },
  description: "Signaux de trading IA en temps réel. Paper trading, analyses sur 160+ actifs et académie interactive.",
  keywords: ["trading", "bourse", "crypto", "signaux", "analyse technique", "IA", "investissement", "paper trading", "RSI", "MACD"],
  authors: [{ name: "Tradex" }],
  creator: "Tradex",
  robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: "Tradex",
    title: "Tradex — Trading intelligent avec l'IA",
    description: "Signaux en temps réel · Analyses IA · Paper Trading · Académie",
    images: [{ url: "/api/og", width: 1200, height: 630, alt: "Tradex Trading IA" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Tradex — Trading IA",
    description: "Signaux en temps réel · Paper Trading · Académie",
    images: ["/api/og"],
  },
  manifest: "/manifest.json",
  icons: {
    icon: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
    shortcut: "/icon-192.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Tradex",
  },
  applicationName: "Tradex",
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  themeColor: "#050505",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  colorScheme: "dark",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="preconnect" href="https://query1.finance.yahoo.com" />
        <link rel="dns-prefetch" href="https://query1.finance.yahoo.com" />
        {/* Compact mode — apply before first paint to avoid flash */}
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            try {
              var s = JSON.parse(localStorage.getItem('tradex_settings') || '{}');
              if (s.compact_mode) document.body && document.body.classList.add('compact');
            } catch(e) {}
          })();
        `}} />
      </head>
      <body className={`${inter.variable} font-sans bg-[#050505] text-white`}>
        <a href="#main-content" className="skip-link">Skip to content</a>
        <I18nProvider>
        <ToastProvider>
          <AppSplashScreen />
          <NativePushSetup />
          <ServiceWorker />
          <Navbar />
          <Sidebar />
          <Topbar />
          <MobileHeader />
          <BottomNav />
          <main id="main-content" className="sidebar-main">
            {children}
          </main>
          <PWAInstallBanner />
          <Analytics />
          <SpeedInsights />
          <ChatBot />
          <CookieBanner />
        </ToastProvider>
        </I18nProvider>
      </body>
    </html>
  )
}
