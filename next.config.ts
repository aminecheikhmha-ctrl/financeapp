import type { NextConfig } from "next"

const isCapacitor = process.env.CAPACITOR_BUILD === "1"

const nextConfig: NextConfig = {
  // Static export uniquement pour build mobile offline (non recommandé — utilise server.url)
  output: isCapacitor ? "export" : undefined,
  trailingSlash: isCapacitor,
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,

  images: {
    unoptimized: isCapacitor,
    remotePatterns: [
      { protocol: "https", hostname: "img.youtube.com" },
      { protocol: "https", hostname: "i.ytimg.com" },
      { protocol: "https", hostname: "financeapp-kappa-six.vercel.app" },
    ],
    formats: ["image/avif", "image/webp"],
  },

  // Cache headers for static assets
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/(icon-192|icon-512)\\.png",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        source: "/api/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ]
  },
}

export default nextConfig
