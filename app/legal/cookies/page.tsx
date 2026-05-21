"use client"

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h2 className="text-white font-bold text-lg mb-3">{title}</h2>
      <div className="text-gray-400 text-sm leading-relaxed space-y-3">{children}</div>
    </div>
  )
}

export default function CookiesPage() {
  function resetConsent() {
    localStorage.removeItem("cookie_consent")
    window.location.reload()
  }

  return (
    <div className="min-h-screen bg-[#080808] text-white pb-20">
      <div className="max-w-3xl mx-auto px-4 pt-8 md:pt-12">
        <div className="mb-8">
          <h1 className="text-3xl font-black text-white mb-2">Politique de cookies</h1>
          <p className="text-gray-500 text-sm">Dernière mise à jour : 18 mai 2026</p>
        </div>

        <Section title="Qu'est-ce qu'un cookie ?">
          <p>Un cookie est un petit fichier texte déposé sur votre navigateur lors de la visite d&apos;un site. Il permet de mémoriser des informations entre les visites.</p>
        </Section>

        <Section title="Cookies que nous utilisons">
          <div className="space-y-4">
            {[
              { type: "Essentiels", color: "green", required: true, desc: "Nécessaires au fonctionnement du service. Ne peuvent pas être désactivés.", examples: "Session d'authentification (Supabase), préférences de l'interface, panier d'abonnement" },
              { type: "Analytiques", color: "blue", required: false, desc: "Nous permettent de comprendre comment les utilisateurs interagissent avec l'app.", examples: "Vercel Analytics — données anonymisées, pas de tracking cross-site" },
              { type: "Performance", color: "purple", required: false, desc: "Mesurent les performances de l'app pour l'optimiser.", examples: "Vercel Speed Insights — temps de chargement des pages" },
            ].map(cookie => (
              <div key={cookie.type} className="bg-[#0f0f0f] border border-white/8 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    cookie.color === "green" ? "bg-green-500/15 text-green-400" :
                    cookie.color === "blue" ? "bg-blue-500/15 text-blue-400" :
                    "bg-purple-500/15 text-purple-400"
                  }`}>{cookie.type}</span>
                  {cookie.required && <span className="text-xs text-gray-600">Obligatoire</span>}
                </div>
                <p className="text-gray-300 text-sm mb-1">{cookie.desc}</p>
                <p className="text-gray-600 text-xs">Ex : {cookie.examples}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Gérer vos préférences">
          <p>Vous pouvez modifier vos préférences cookies à tout moment en cliquant sur le bouton ci-dessous ou dans les paramètres de votre navigateur.</p>
          <div className="mt-3">
            <button
              onClick={resetConsent}
              className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white hover:bg-white/10 transition"
            >
              Modifier mes préférences
            </button>
          </div>
        </Section>

        <Section title="Durée de conservation">
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Cookies de session : supprimés à la fermeture du navigateur</li>
            <li>Cookies persistants : 12 mois maximum</li>
            <li>Préférences cookies : 13 mois</li>
          </ul>
        </Section>

        <div className="flex gap-3 mt-8 flex-wrap">
          <a href="/legal/privacy" className="text-green-400 text-sm hover:underline">Confidentialité →</a>
          <a href="/legal/terms" className="text-green-400 text-sm hover:underline">CGU →</a>
        </div>
      </div>
    </div>
  )
}
