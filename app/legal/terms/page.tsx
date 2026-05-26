import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Conditions Générales d'Utilisation",
  description: "CGU de Tradex — plateforme de paper trading éducative",
}

const LAST_UPDATED = "18 mai 2026"

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h2 className="text-white font-bold text-lg mb-3">{title}</h2>
      <div className="text-gray-400 text-sm leading-relaxed space-y-3">{children}</div>
    </div>
  )
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#080808] text-white pb-20">
      <div className="max-w-3xl mx-auto px-4 pt-8 md:pt-12">
        <div className="mb-8">
          <h1 className="text-3xl font-black text-white mb-2">Conditions Générales d&apos;Utilisation</h1>
          <p className="text-gray-500 text-sm">Dernière mise à jour : {LAST_UPDATED}</p>
        </div>

        <div className="bg-amber-500/8 border border-amber-500/20 rounded-2xl p-5 mb-8">
          <p className="text-amber-300 text-sm font-semibold mb-1">⚠️ Important — Paper Trading uniquement</p>
          <p className="text-amber-200/70 text-sm">Tradex est une plateforme d&apos;éducation financière utilisant exclusivement du capital virtuel. Aucun ordre réel n&apos;est passé sur les marchés financiers. Les performances passées ne préjugent pas des résultats futurs.</p>
        </div>

        <Section title="1. Objet">
          <p>Les présentes CGU régissent l&apos;utilisation de Tradex, plateforme éducative de simulation de trading accessible sur tradex-kappa-six.vercel.app et ses sous-domaines.</p>
        </Section>

        <Section title="2. Acceptation des conditions">
          <p>En créant un compte ou en utilisant Tradex, vous acceptez les présentes CGU dans leur intégralité. Si vous n&apos;acceptez pas ces conditions, vous ne devez pas utiliser le service.</p>
        </Section>

        <Section title="3. Description du service">
          <p>Tradex est une plateforme éducative proposant :</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Du paper trading (simulation avec capital virtuel de 100 000 $)</li>
            <li>Des signaux de trading générés par intelligence artificielle (à titre éducatif)</li>
            <li>Des analyses de marché et screener d&apos;actifs</li>
            <li>Une académie de trading avec cours et quiz</li>
            <li>Un forum communautaire</li>
            <li>Des rapports de performance simulée</li>
          </ul>
          <p className="font-semibold text-white">Ce service ne constitue PAS un conseil en investissement, une gestion de portefeuille, ni une activité réglementée au sens de l&apos;AMF ou de la MiFID II.</p>
        </Section>

        <Section title="4. Création de compte">
          <p>Pour accéder au service, vous devez :</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Avoir au moins 18 ans</li>
            <li>Fournir une adresse email valide</li>
            <li>Choisir un mot de passe sécurisé</li>
            <li>Accepter les présentes CGU et la politique de confidentialité</li>
          </ul>
          <p>Un seul compte par personne est autorisé.</p>
        </Section>

        <Section title="5. Plans et abonnements">
          <p>Tradex propose plusieurs niveaux d&apos;accès :</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li><strong className="text-white">Plan Free :</strong> accès limité gratuit sans limite de durée</li>
            <li><strong className="text-white">Plan Pro :</strong> abonnement mensuel avec accès étendu</li>
            <li><strong className="text-white">Plan Premium :</strong> abonnement mensuel avec accès complet</li>
          </ul>
          <p>Les abonnements sont facturés via Stripe. Vous pouvez résilier à tout moment depuis votre profil. Aucun remboursement partiel n&apos;est accordé pour le mois en cours.</p>
        </Section>

        <Section title="6. Utilisation acceptable">
          <p>Il est interdit de :</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Utiliser le service à des fins illégales ou frauduleuses</li>
            <li>Tenter de contourner les mesures de sécurité</li>
            <li>Publier du contenu offensant, trompeur ou diffamatoire sur le forum</li>
            <li>Manipuler les classements ou badges de manière artificielle</li>
            <li>Revendre ou redistribuer l&apos;accès au service</li>
            <li>Scraper ou automatiser l&apos;accès aux données sans autorisation</li>
          </ul>
        </Section>

        <Section title="7. Propriété intellectuelle">
          <p>L&apos;ensemble du contenu de Tradex (code, design, cours, signaux, analyses) est la propriété exclusive de Tradex SAS et protégé par les lois sur la propriété intellectuelle. Toute reproduction sans autorisation est interdite.</p>
        </Section>

        <Section title="8. Disclaimer — Pas de conseil financier">
          <p>Tradex fournit des informations à titre éducatif uniquement. Les signaux, analyses et scores générés par l&apos;IA ne constituent pas des conseils en investissement. Toute décision d&apos;investissement réel doit être prise avec l&apos;aide d&apos;un professionnel agréé AMF.</p>
          <p>Tradex ne peut être tenu responsable des pertes financières résultant d&apos;une utilisation des informations fournies sur des marchés réels.</p>
        </Section>

        <Section title="9. Limitation de responsabilité">
          <p>Tradex s&apos;efforce de maintenir un service disponible 24h/24 mais ne garantit pas l&apos;absence d&apos;interruptions. La responsabilité de Tradex est limitée au montant des abonnements payés au cours des 12 derniers mois.</p>
        </Section>

        <Section title="10. Résiliation">
          <p>Vous pouvez fermer votre compte à tout moment depuis les paramètres de votre profil. Tradex se réserve le droit de suspendre ou supprimer un compte en cas de violation des présentes CGU.</p>
        </Section>

        <Section title="11. Modification des CGU">
          <p>Nous pouvons modifier les présentes CGU à tout moment. Vous serez notifié par email des modifications importantes. La poursuite de l&apos;utilisation du service après modification vaut acceptation.</p>
        </Section>

        <Section title="12. Droit applicable">
          <p>Les présentes CGU sont soumises au droit français. Tout litige sera soumis à la compétence des tribunaux de Paris.</p>
        </Section>

        <div className="flex gap-3 mt-8 flex-wrap">
          <a href="/legal/privacy" className="text-green-400 text-sm hover:underline">Confidentialité →</a>
          <a href="/legal/cookies" className="text-green-400 text-sm hover:underline">Cookies →</a>
        </div>
      </div>
    </div>
  )
}
