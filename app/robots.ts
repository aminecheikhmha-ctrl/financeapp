import { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://tradex-kappa-six.vercel.app"
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/blog", "/pricing", "/apprendre", "/signup", "/login", "/analyses", "/signaux"],
        disallow: ["/api/", "/portfolio", "/profil", "/parametres", "/admin", "/reports", "/coach"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
