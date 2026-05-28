import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Politique de Cookies — Tradex",
  description: "Politique d'utilisation des cookies sur la plateforme Tradex",
}

export default function CookiesPage() {
  return (
    <article className="article-content">
      <h1 style={{ fontSize: "2rem", fontWeight: 900, color: "white", marginBottom: "0.5rem" }}>
        Politique de Cookies
      </h1>
      <p style={{ color: "rgba(255,255,255,0.3)", fontSize: "13px", marginBottom: "2rem" }}>
        Dernière mise à jour : mai 2026
      </p>

      <h2>Qu&apos;est-ce qu&apos;un cookie ?</h2>
      <p>
        Un cookie est un petit fichier texte déposé sur votre navigateur lors de la visite d&apos;un site.
        Il permet de mémoriser des informations entre les visites et d&apos;améliorer votre expérience.
      </p>

      <h2>Cookies essentiels (obligatoires)</h2>
      <p>Ces cookies sont nécessaires au fonctionnement du site et ne peuvent pas être désactivés :</p>
      <ul>
        <li><strong>sb-auth-token</strong> : session d&apos;authentification Supabase (durée : session)</li>
        <li><strong>tradex_preferences</strong> : préférences utilisateur locales (durée : 1 an)</li>
        <li><strong>cookie_consent</strong> : mémorisation de vos choix de cookies (durée : 13 mois)</li>
      </ul>

      <h2>Cookies analytiques (optionnels)</h2>
      <p>Ces cookies nous aident à comprendre et améliorer le service (données anonymisées) :</p>
      <ul>
        <li><strong>Vercel Analytics</strong> : statistiques d&apos;utilisation anonymisées, sans tracking cross-site</li>
        <li><strong>Vercel Speed Insights</strong> : mesure des performances de l&apos;application</li>
      </ul>

      <h2>Cookies tiers</h2>
      <ul>
        <li><strong>Stripe</strong> : cookies de sécurité pour le traitement des paiements</li>
      </ul>

      <h2>Durée de conservation</h2>
      <ul>
        <li>Cookies de session : supprimés à la fermeture du navigateur</li>
        <li>Cookies persistants : 12 mois maximum</li>
        <li>Préférences cookies : 13 mois</li>
      </ul>

      <h2>Gestion de vos préférences</h2>
      <p>
        Vous pouvez modifier vos préférences cookies à tout moment via la bannière cookies ou depuis les
        paramètres de votre navigateur. La désactivation des cookies essentiels peut empêcher la connexion à Tradex.
      </p>
      <p>
        Pour en savoir plus sur la gestion des cookies selon votre navigateur :{" "}
        <a href="https://www.cnil.fr/fr/cookies-et-autres-traceurs/comment-se-proteger/maitriser-votre-navigateur"
          target="_blank" rel="noopener noreferrer" style={{ color: "#4ade80" }}>
          Guide CNIL
        </a>
      </p>

      <h2>Contact</h2>
      <p>
        Pour toute question sur nos cookies :{" "}
        <a href="mailto:privacy@tradex.io" style={{ color: "#4ade80" }}>privacy@tradex.io</a>
      </p>
    </article>
  )
}
