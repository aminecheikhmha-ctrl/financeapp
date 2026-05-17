import type { MetadataRoute } from "next"

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://financeapp.io"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/pricing", "/signup", "/login", "/preuves"],
        disallow: ["/dashboard", "/portfolio", "/signaux", "/analyses", "/apprendre", "/forum", "/profil", "/api/", "/onboarding"],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  }
}
