import type { Metadata } from "next"

export const metadata: Metadata = { title: "Mentions Légales — Tradex" }

export default function MentionsPage() {
  return (
    <article className="article-content">
      <h1 style={{ fontSize: "2rem", fontWeight: 900, color: "white", marginBottom: "2rem" }}>
        Mentions Légales
      </h1>

      <h2>Éditeur du site</h2>
      <p>
        <strong>Tradex SAS</strong><br />
        Capital social : [à compléter]€<br />
        RCS : [à compléter]<br />
        SIRET : [à compléter]<br />
        Siège social : France<br />
        Email : <a href="mailto:contact@tradex.io" style={{ color: "#4ade80" }}>contact@tradex.io</a>
      </p>

      <h2>Directeur de la publication</h2>
      <p>[Nom du fondateur à compléter]</p>

      <h2>Hébergement</h2>
      <p>
        <strong>Vercel Inc.</strong><br />
        340 Pine Street, Suite 701<br />
        San Francisco, CA 94104, USA<br />
        <a href="https://vercel.com" target="_blank" rel="noopener noreferrer" style={{ color: "#4ade80" }}>vercel.com</a>
      </p>

      <h2>Base de données</h2>
      <p>
        <strong>Supabase Inc.</strong> — Serveurs hébergés en Europe (Frankfurt)<br />
        <a href="https://supabase.com" target="_blank" rel="noopener noreferrer" style={{ color: "#4ade80" }}>supabase.com</a>
      </p>

      <h2>Avertissement</h2>
      <p>
        Tradex est un outil éducatif de simulation de trading. Il ne constitue pas un conseil en investissement
        au sens de la Directive MIF2. Les signaux et analyses fournis sont à titre informatif uniquement.
        Investir comporte des risques de perte en capital.
      </p>

      <h2>Propriété intellectuelle</h2>
      <p>
        L&apos;ensemble du contenu de Tradex est protégé par le droit d&apos;auteur.
        Toute reproduction, même partielle, est interdite sans autorisation écrite.
      </p>

      <h2>Cookies et données personnelles</h2>
      <p>
        Voir notre <a href="/legal/privacy" style={{ color: "#4ade80" }}>Politique de confidentialité</a> et
        notre <a href="/legal/cookies" style={{ color: "#4ade80" }}>Politique de cookies</a> pour plus d&apos;informations
        sur le traitement de vos données personnelles.
      </p>

      <h2>Contact</h2>
      <p>
        Pour toute question relative au site :{" "}
        <a href="mailto:contact@tradex.io" style={{ color: "#4ade80" }}>contact@tradex.io</a>
      </p>
    </article>
  )
}
