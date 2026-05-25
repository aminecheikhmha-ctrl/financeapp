import type { CapacitorConfig } from "@capacitor/cli"

const config: CapacitorConfig = {
  appId: "io.tradex.app",
  appName: "Tradex",
  webDir: "out",
  server: {
    // En dev → pointe vers Next.js local, en prod → Vercel
    url:
      process.env.NODE_ENV === "development"
        ? "http://localhost:3000"
        : "https://financeapp-kappa-six.vercel.app",
    cleartext: true,
    androidScheme: "https",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#050505",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: "dark",
      backgroundColor: "#050505",
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
}

export default config
