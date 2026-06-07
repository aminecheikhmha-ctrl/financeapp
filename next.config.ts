import type { NextConfig } from "next"

const isCapacitor = process.env.CAPACITOR_BUILD === "1"

const nextConfig: NextConfig = {
  output:          isCapacitor ? "export" : undefined,
  trailingSlash:   isCapacitor,
  compress:        true,
  poweredByHeader: false,
  reactStrictMode: true,
  typescript: { ignoreBuildErrors: true },
  eslint:     { ignoreDuringBuilds: true },

  images: {
    unoptimized: isCapacitor,
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "img.youtube.com" },
      { protocol: "https", hostname: "i.ytimg.com" },
      { protocol: "https", hostname: "tradex-kappa-six.vercel.app" },
      { protocol: "https", hostname: "**.supabase.co" },
    ],
  },

  async headers() {
    return [
      // Security headers on all pages
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options",  value: "nosniff" },
          { key: "X-Frame-Options",          value: "DENY" },
          { key: "X-XSS-Protection",         value: "1; mode=block" },
          { key: "Referrer-Policy",          value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy",       value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      // Service worker — no cache
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control",          value: "public, max-age=0, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      // Static assets — 1 year immutable cache
      {
        source: "/_next/static/(.*)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      // Public icons — 7 day cache
      {
        source: "/(icon-192|icon-512)\\.png",
        headers: [
          { key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" },
        ],
      },
      // API routes — no cache by default, add nosniff
      {
        source: "/api/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options",         value: "DENY" },
          { key: "Referrer-Policy",         value: "strict-origin-when-cross-origin" },
        ],
      },
    ]
  },

  async redirects() {
    return [
      { source: "/home",          destination: "/",           permanent: true  },
      { source: "/app",           destination: "/dashboard",  permanent: true  },
      // Pages fusionnées / supprimées
      { source: "/scanner",       destination: "/signaux",    permanent: true  },
      { source: "/calendrier",    destination: "/analyses",   permanent: true  },
      { source: "/classement",    destination: "/communaute", permanent: true  },
      { source: "/reports",       destination: "/portfolio",  permanent: true  },
      { source: "/forum",         destination: "/communaute", permanent: true  },
      { source: "/feed",          destination: "/news",       permanent: true  },
      { source: "/social",        destination: "/communaute", permanent: true  },
      { source: "/room",          destination: "/communaute", permanent: false },
      { source: "/duel",          destination: "/communaute", permanent: false },
      { source: "/replay",        destination: "/dashboard",  permanent: false },
    ]
  },
}

export default nextConfig
