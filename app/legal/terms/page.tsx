import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Conditions Générales d'Utilisation — Tradex",
  description: "CGU de la plateforme Tradex",
}

export default function TermsPage() {
  return (
    <article className="article-content">
      <h1 style={{ fontSize: "2rem", fontWeight: 900, color: "white", marginBottom: "0.5rem" }}>
        Conditions Générales d&apos;Utilisation
      </h1>
      <p style={{ color: "rgba(255,255,255,0.3)", fontSize: "13px", marginBottom: "2rem" }}>
        Dernière mise à jour : mai 2026
      </p>

      <h2>1. Présentation du service</h2>
      <p>
        Tradex est une plateforme éducative de paper trading (trading fictif) et d&apos;analyse des marchés financiers.
        Tradex ne fournit pas de conseils d&apos;investissement et n&apos;est pas un service d&apos;investissement réglementé.
        Tout le trading effectué sur Tradex est simulé avec de l&apos;argent fictif.
      </p>

      <h2>2. Inscription et compte</h2>
      <p>
        Pour utiliser Tradex, vous devez créer un compte avec une adresse email valide.
        Vous êtes responsable de la sécurité de votre compte et de votre mot de passe.
        Vous devez avoir au moins 18 ans pour utiliser le service.
        Tradex se réserve le droit de supprimer tout compte qui violerait les présentes CGU.
      </p>

      <h2>3. Nature du service — Paper Trading</h2>
      <p>
        <strong>Important :</strong> Tradex est exclusivement un outil éducatif de paper trading.
        Aucune transaction financière réelle n&apos;est effectuée. Les $100 000 de capital fictif sont des tokens virtuels
        sans valeur monétaire réelle. Les performances passées dans Tradex ne préjugent pas de performances
        futures sur des marchés réels.
      </p>

      <h2>4. Données de marché</h2>
      <p>
        Les données de marché sont fournies à titre indicatif via des services tiers (Yahoo Finance).
        Tradex ne garantit pas l&apos;exactitude, l&apos;exhaustivité ou la ponctualité des données.
        Ces données ne doivent pas être utilisées comme seule base pour des décisions d&apos;investissement réelles.
      </p>

      <h2>5. Signaux IA — Avertissement</h2>
      <p>
        Les signaux générés par l&apos;IA de Tradex sont des outils d&apos;aide à la décision éducatifs.
        Ils ne constituent pas des conseils d&apos;investissement. Toute utilisation de ces signaux sur
        des marchés réels est faite sous l&apos;entière responsabilité de l&apos;utilisateur.
        Tradex décline toute responsabilité pour les pertes financières découlant d&apos;une telle utilisation.
      </p>

      <h2>6. Abonnements et paiements</h2>
      <p>
        Les abonnements payants sont facturés mensuellement ou annuellement selon le choix de l&apos;utilisateur.
        Tout abonnement peut être annulé à tout moment depuis les paramètres du compte.
        En cas d&apos;annulation, l&apos;accès reste disponible jusqu&apos;à la fin de la période payée.{" "}
        <strong>Politique de remboursement :</strong> 30 jours après toute nouvelle souscription, remboursement intégral sur demande.
      </p>

      <h2>7. Propriété intellectuelle</h2>
      <p>
        L&apos;ensemble du contenu de Tradex (algorithmes, textes, graphiques, code, marque) est protégé par le droit
        d&apos;auteur et appartient à Tradex SAS. Toute reproduction non autorisée est interdite.
      </p>

      <h2>8. Limitation de responsabilité</h2>
      <p>
        Tradex ne peut être tenu responsable des pertes financières résultant de l&apos;utilisation de ses
        outils, signaux ou analyses sur des marchés réels. Le service est fourni &quot;en l&apos;état&quot; sans garantie
        de performance ou de disponibilité continue.
      </p>

      <h2>9. Modifications des CGU</h2>
      <p>
        Tradex se réserve le droit de modifier les présentes CGU. Les utilisateurs seront informés
        par email de toute modification substantielle.
      </p>

      <h2>10. Droit applicable</h2>
      <p>
        Les présentes CGU sont soumises au droit français. Tout litige relèvera de la compétence
        exclusive des tribunaux français.
      </p>

      <h2>11. Contact</h2>
      <p>
        Pour toute question : <a href="mailto:legal@tradex.io" style={{ color: "#4ade80" }}>legal@tradex.io</a>
      </p>
    </article>
  )
}
