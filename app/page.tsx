"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"

export default function Home() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
      setLoading(false)
      if (data.user) router.push("/dashboard")
    })
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-gray-400">Chargement...</div>
      </div>
    )
  }

  return (
    <div className="bg-black text-white">

      {/* Hero */}
      <section className="min-h-screen flex flex-col items-center justify-center text-center px-6">
        <div className="inline-block bg-green-500/10 border border-green-500/30 text-green-400 text-sm px-4 py-1 rounded-full mb-6">
          Analyses en temps réel
        </div>
        <h1 className="text-6xl font-bold mb-6 max-w-3xl leading-tight">
          Investis mieux avec la data et l'IA
        </h1>
        <p className="text-gray-400 text-xl mb-10 max-w-xl">
          Charts en temps réel, analyses automatiques, signaux de trading et une communauté active.
        </p>
        <div className="flex gap-4">
          <a href="/signup" className="bg-green-500 hover:bg-green-600 text-white px-8 py-4 rounded-lg font-semibold text-lg transition">
            Commencer gratuitement
          </a>
          <a href="/pricing" className="border border-gray-700 hover:border-gray-500 text-white px-8 py-4 rounded-lg font-semibold text-lg transition">
            Voir les plans
          </a>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-6 border-t border-gray-800">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-4">Tout ce dont tu as besoin</h2>
          <p className="text-gray-400 text-center mb-16 text-lg">Une seule plateforme pour analyser, suivre et décider.</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: "📈", title: "Charts temps réel", desc: "Actions, crypto, forex. Graphes interactifs avec indicateurs techniques." },
              { icon: "🤖", title: "Analyses IA", desc: "Notre IA analyse chaque ticker et te donne un résumé clair en secondes." },
              { icon: "✅", title: "Preuves de trades", desc: "Section dédiée aux preuves horodatées. Transparence totale sur les performances." },
              { icon: "💬", title: "Forum communauté", desc: "Échange avec d'autres traders, partage tes analyses, pose tes questions." },
              { icon: "🔔", title: "Alertes de prix", desc: "Reçois une notification quand un actif atteint ton prix cible." },
              { icon: "🔒", title: "Contenu premium", desc: "Accès exclusif aux signaux et analyses détaillées pour les membres Pro." },
            ].map((item) => (
              <div key={item.title} className="bg-gray-900 border border-gray-800 rounded-2xl p-8 hover:border-green-500/50 transition">
                <div className="text-4xl mb-4">{item.icon}</div>
                <h3 className="text-xl font-semibold mb-3">{item.title}</h3>
                <p className="text-gray-400">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing preview */}
      <section className="py-24 px-6 border-t border-gray-800">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-4">Des plans pour tous</h2>
          <p className="text-gray-400 text-lg mb-16">Commence gratuitement, upgrade quand tu es prêt.</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { name: "Free", price: "0€", desc: "Pour découvrir", features: ["Charts basiques", "5 tickers", "Forum accès limité"] },
              { name: "Pro", price: "19€/mois", desc: "Pour les sérieux", features: ["Charts illimités", "Analyses IA", "Forum complet", "Alertes prix"], highlight: true },
              { name: "Premium", price: "49€/mois", desc: "Pour les pros", features: ["Tout Pro inclus", "Signaux exclusifs", "Preuves de trades", "Support prioritaire"] },
            ].map((plan) => (
              <div key={plan.name} className={`rounded-2xl p-8 border ${plan.highlight ? "bg-green-500/10 border-green-500" : "bg-gray-900 border-gray-800"}`}>
                <h3 className="text-xl font-bold mb-1">{plan.name}</h3>
                <p className="text-gray-400 text-sm mb-4">{plan.desc}</p>
                <p className="text-3xl font-bold mb-6">{plan.price}</p>
                <ul className="text-gray-400 text-sm space-y-2 mb-8">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <span className="text-green-400">✓</span> {f}
                    </li>
                  ))}
                </ul>
                <a href="/signup" className={`block w-full text-center py-3 rounded-lg font-semibold transition ${plan.highlight ? "bg-green-500 hover:bg-green-600 text-white" : "border border-gray-700 hover:border-gray-500 text-white"}`}>
                  Commencer
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 border-t border-gray-800 text-center">
        <h2 className="text-4xl font-bold mb-4">Prêt à passer au niveau supérieur ?</h2>
        <p className="text-gray-400 text-lg mb-10">Rejoins des milliers de traders qui utilisent FinanceApp.</p>
        <a href="/signup" className="bg-green-500 hover:bg-green-600 text-white px-10 py-4 rounded-lg font-semibold text-lg transition">
          Créer un compte gratuit
        </a>
      </section>

    </div>
  )
}