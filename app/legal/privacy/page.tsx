import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Politique de Confidentialité — Tradex",
  description: "Comment Tradex collecte et utilise vos données personnelles",
}

export default function PrivacyPage() {
  return (
    <article className="article-content">
      <h1 style={{ fontSize: "2rem", fontWeight: 900, color: "white", marginBottom: "0.5rem" }}>
        Politique de Confidentialité
      </h1>
      <p style={{ color: "rgba(255,255,255,0.3)", fontSize: "13px", marginBottom: "2rem" }}>
        Dernière mise à jour : mai 2026
      </p>

      <h2>1. Données collectées</h2>
      <p>Tradex collecte les données suivantes :</p>
      <ul>
        <li><strong>Données d&apos;inscription :</strong> email, pseudo, date d&apos;inscription</li>
        <li><strong>Données de profil :</strong> niveau de trading, objectifs, préférences d&apos;actifs</li>
        <li><strong>Données d&apos;utilisation :</strong> pages visitées, fonctionnalités utilisées, trades fictifs</li>
        <li><strong>Données techniques :</strong> adresse IP, navigateur, système d&apos;exploitation</li>
        <li><strong>Données de paiement :</strong> gérées exclusivement par Stripe — nous ne stockons aucune donnée bancaire</li>
      </ul>

      <h2>2. Utilisation des données</h2>
      <p>Vos données sont utilisées pour :</p>
      <ul>
        <li>Fournir et améliorer le service Tradex</li>
        <li>Personnaliser votre expérience (niveau, recommandations IA)</li>
        <li>Envoyer des communications liées au service (notifications, rapports hebdomadaires)</li>
        <li>Analyser l&apos;utilisation pour améliorer nos algorithmes</li>
        <li>Assurer la sécurité et prévenir les fraudes</li>
      </ul>

      <h2>3. Base légale (RGPD)</h2>
      <ul>
        <li><strong>Exécution du contrat :</strong> pour fournir le service auquel vous vous êtes inscrit</li>
        <li><strong>Intérêt légitime :</strong> pour améliorer nos services et assurer la sécurité</li>
        <li><strong>Consentement :</strong> pour les communications marketing (révocable à tout moment)</li>
        <li><strong>Obligation légale :</strong> conservation des données de facturation (10 ans)</li>
      </ul>

      <h2>4. Partage des données</h2>
      <p>Nous ne vendons jamais vos données. Nous les partageons uniquement avec :</p>
      <ul>
        <li><strong>Supabase :</strong> base de données (serveurs EU — Frankfurt)</li>
        <li><strong>Stripe :</strong> paiements sécurisés</li>
        <li><strong>Resend :</strong> envoi d&apos;emails transactionnels</li>
        <li><strong>Vercel :</strong> hébergement de l&apos;application</li>
        <li><strong>Groq :</strong> traitement IA (données anonymisées, non stockées)</li>
      </ul>

      <h2>5. Vos droits RGPD</h2>
      <p>Vous avez le droit de :</p>
      <ul>
        <li>Accéder à vos données personnelles</li>
        <li>Rectifier des données inexactes</li>
        <li>Supprimer vos données (&quot;droit à l&apos;oubli&quot;)</li>
        <li>Exporter vos données (portabilité)</li>
        <li>Vous opposer au traitement à des fins marketing</li>
        <li>Retirer votre consentement à tout moment</li>
      </ul>
      <p>Pour exercer ces droits : <a href="mailto:privacy@tradex.io" style={{ color: "#4ade80" }}>privacy@tradex.io</a></p>
      <p>
        Vous avez également le droit de déposer une plainte auprès de la{" "}
        <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer" style={{ color: "#4ade80" }}>CNIL</a>.
      </p>

      <h2>6. Conservation des données</h2>
      <ul>
        <li>Données de compte : durée de vie du compte + 3 ans après suppression</li>
        <li>Données de trading simulé : durée de vie du compte</li>
        <li>Logs techniques : 90 jours</li>
        <li>Données de facturation : 10 ans (obligation légale)</li>
      </ul>

      <h2>7. Sécurité</h2>
      <p>
        Nous mettons en œuvre des mesures techniques appropriées : chiffrement TLS, accès role-based (RLS Supabase),
        authentification sécurisée, sauvegardes régulières. Les mots de passe sont hachés et jamais stockés en clair.
      </p>

      <h2>8. Cookies</h2>
      <p>
        Nous utilisons des cookies essentiels au fonctionnement du service et des cookies analytiques (avec votre consentement).
        Consultez notre <a href="/legal/cookies" style={{ color: "#4ade80" }}>Politique de cookies</a>.
      </p>

      <h2>9. Contact DPO</h2>
      <p>
        Délégué à la Protection des Données :{" "}
        <a href="mailto:privacy@tradex.io" style={{ color: "#4ade80" }}>privacy@tradex.io</a>
      </p>
    </article>
  )
}
