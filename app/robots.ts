import type { MetadataRoute } from "next"

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://financeapp-kappa-six.vercel.app"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/pricing", "/signup", "/login", "/preuves", "/blog", "/blog/"],
        disallow: ["/api/", "/dashboard", "/portfolio", "/signaux", "/analyses", "/apprendre", "/forum", "/profil", "/onboarding", "/parametres", "/coach"],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  }
}
