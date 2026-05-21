import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Politique de confidentialité",
  description: "Politique de confidentialité et traitement des données personnelles de FinanceApp",
}

const LAST_UPDATED = "18 mai 2026"
const CONTACT_EMAIL = "privacy@financeapp.io"
const COMPANY = "FinanceApp SAS"

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h2 className="text-white font-bold text-lg mb-3">{title}</h2>
      <div className="text-gray-400 text-sm leading-relaxed space-y-3">{children}</div>
    </div>
  )
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#080808] text-white pb-20">
      <div className="max-w-3xl mx-auto px-4 pt-8 md:pt-12">
        <div className="mb-8">
          <h1 className="text-3xl font-black text-white mb-2">Politique de confidentialité</h1>
          <p className="text-gray-500 text-sm">Dernière mise à jour : {LAST_UPDATED}</p>
        </div>

        <div className="bg-[#0f0f0f] border border-white/8 rounded-2xl p-6 mb-8">
          <p className="text-gray-300 text-sm leading-relaxed">
            {COMPANY} (&quot;FinanceApp&quot;, &quot;nous&quot;, &quot;notre&quot;) s&apos;engage à protéger votre vie privée.
            Cette politique explique comment nous collectons, utilisons et protégeons vos données personnelles
            conformément au Règlement Général sur la Protection des Données (RGPD).
          </p>
        </div>

        <Section title="1. Responsable du traitement">
          <p>{COMPANY}, société par actions simplifiée. Pour toute question : <a href={`mailto:${CONTACT_EMAIL}`} className="text-green-400 hover:underline">{CONTACT_EMAIL}</a></p>
        </Section>

        <Section title="2. Données collectées">
          <p>Nous collectons les données suivantes :</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li><strong className="text-white">Données de compte :</strong> adresse email, nom d&apos;utilisateur, mot de passe haché</li>
            <li><strong className="text-white">Données de profil :</strong> niveau de trading déclaré, actifs préférés, tolérance au risque</li>
            <li><strong className="text-white">Données d&apos;utilisation :</strong> historique de navigation dans l&apos;app, trades paper effectués, cours consultés</li>
            <li><strong className="text-white">Données techniques :</strong> adresse IP, navigateur, système d&apos;exploitation, cookies de session</li>
            <li><strong className="text-white">Données de paiement :</strong> gérées directement par Stripe — nous ne stockons aucune donnée bancaire</li>
          </ul>
          <p className="mt-2">⚠️ FinanceApp est une plateforme de <strong className="text-white">paper trading uniquement</strong>. Aucun argent réel n&apos;est investi ou géré.</p>
        </Section>

        <Section title="3. Finalités du traitement">
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Fourniture du service (compte, trading simulé, analyses IA)</li>
            <li>Amélioration de l&apos;expérience utilisateur et personnalisation</li>
            <li>Envoi d&apos;emails transactionnels et de rapports hebdomadaires (avec consentement)</li>
            <li>Sécurité et prévention de la fraude</li>
            <li>Obligations légales et comptables</li>
            <li>Analyse agrégée et anonymisée des performances de la plateforme</li>
          </ul>
        </Section>

        <Section title="4. Base légale du traitement">
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li><strong className="text-white">Exécution du contrat :</strong> pour fournir le service auquel vous vous êtes inscrit</li>
            <li><strong className="text-white">Consentement :</strong> pour les communications marketing et cookies analytiques</li>
            <li><strong className="text-white">Intérêt légitime :</strong> pour la sécurité du service et l&apos;amélioration du produit</li>
            <li><strong className="text-white">Obligation légale :</strong> conservation des données de facturation</li>
          </ul>
        </Section>

        <Section title="5. Partage des données">
          <p>Nous partageons vos données uniquement avec :</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li><strong className="text-white">Supabase</strong> — hébergement de la base de données (EU/US)</li>
            <li><strong className="text-white">Vercel</strong> — hébergement de l&apos;application (US)</li>
            <li><strong className="text-white">Stripe</strong> — paiements (EU/US)</li>
            <li><strong className="text-white">Resend</strong> — envoi d&apos;emails transactionnels</li>
            <li><strong className="text-white">Groq</strong> — analyse IA (données anonymisées)</li>
          </ul>
          <p>Nous ne vendons jamais vos données personnelles à des tiers.</p>
        </Section>

        <Section title="6. Vos droits (RGPD)">
          <p>Conformément au RGPD, vous disposez des droits suivants :</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li><strong className="text-white">Droit d&apos;accès :</strong> obtenir une copie de vos données</li>
            <li><strong className="text-white">Droit de rectification :</strong> corriger des données inexactes</li>
            <li><strong className="text-white">Droit à l&apos;effacement :</strong> demander la suppression de votre compte et données</li>
            <li><strong className="text-white">Droit à la portabilité :</strong> recevoir vos données dans un format structuré</li>
            <li><strong className="text-white">Droit d&apos;opposition :</strong> vous opposer au traitement à des fins marketing</li>
            <li><strong className="text-white">Droit à la limitation :</strong> suspendre temporairement le traitement</li>
          </ul>
          <p>Pour exercer ces droits : <a href={`mailto:${CONTACT_EMAIL}`} className="text-green-400 hover:underline">{CONTACT_EMAIL}</a></p>
          <p>Vous avez également le droit de déposer une plainte auprès de la <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer" className="text-green-400 hover:underline">CNIL</a>.</p>
        </Section>

        <Section title="7. Conservation des données">
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Données de compte : durée de vie du compte + 3 ans après fermeture</li>
            <li>Données de trading simulé : durée de vie du compte</li>
            <li>Logs techniques : 90 jours</li>
            <li>Données de facturation : 10 ans (obligation légale)</li>
          </ul>
        </Section>

        <Section title="8. Sécurité">
          <p>Nous mettons en œuvre des mesures techniques et organisationnelles appropriées : chiffrement TLS, accès role-based (RLS Supabase), authentification sécurisée, sauvegardes régulières.</p>
        </Section>

        <Section title="9. Cookies">
          <p>Nous utilisons des cookies essentiels au fonctionnement du service et des cookies analytiques (avec votre consentement). Consultez notre <a href="/legal/cookies" className="text-green-400 hover:underline">Politique cookies</a>.</p>
        </Section>

        <Section title="10. Contact">
          <p>Pour toute question relative à la protection de vos données :<br/>
          Email : <a href={`mailto:${CONTACT_EMAIL}`} className="text-green-400 hover:underline">{CONTACT_EMAIL}</a><br/>
          {COMPANY}</p>
        </Section>

        <div className="flex gap-3 mt-8 flex-wrap">
          <a href="/legal/terms" className="text-green-400 text-sm hover:underline">CGU →</a>
          <a href="/legal/cookies" className="text-green-400 text-sm hover:underline">Cookies →</a>
        </div>
      </div>
    </div>
  )
}
