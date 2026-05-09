"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"

const PRO_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID
const PREMIUM_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_PREMIUM_PRICE_ID

const plans = [
  {
    name: "Free",
    price: "0€",
    period: "",
    desc: "Pour découvrir la plateforme",
    features: ["Charts basiques", "5 tickers suivis", "Forum accès limité", "Données avec délai"],
    priceId: null,
    highlight: false,
  },
  {
    name: "Pro",
    price: "19€",
    period: "/mois",
    desc: "Pour les traders sérieux",
    features: ["Charts illimités", "Tickers illimités", "Analyses IA", "Forum complet", "Alertes de prix", "Données temps réel"],
    priceId: PRO_PRICE_ID,
    highlight: true,
  },
  {
    name: "Premium",
    price: "49€",
    period: "/mois",
    desc: "Pour les pros",
    features: ["Tout Pro inclus", "Signaux exclusifs", "Preuves de trades", "Support prioritaire", "Accès API", "Analyses avancées"],
    priceId: PREMIUM_PRICE_ID,
    highlight: false,
  },
]

export default function Pricing() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
  }, [])

  async function handleCheckout(priceId: string, planName: string) {
    if (!user) {
      window.location.href = "/signup"
      return
    }
    setLoading(planName)
    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priceId, email: user.email }),
    })
    const data = await res.json()
    if (data.url) {
      window.location.href = data.url
    } else {
      alert("Erreur lors du paiement")
    }
    setLoading(null)
  }

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-5xl mx-auto">

        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold mb-4">Tarifs simples et transparents</h1>
          <p className="text-gray-400 text-xl">Commence gratuitement, upgrade quand tu es prêt.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-2xl p-8 border flex flex-col ${plan.highlight ? "bg-green-500/10 border-green-500" : "bg-gray-900 border-gray-800"}`}
            >
              {plan.highlight && (
                <div className="text-green-400 text-xs font-semibold uppercase tracking-widest mb-4">
                  ⭐ Populaire
                </div>
              )}
              <h2 className="text-2xl font-bold mb-1">{plan.name}</h2>
              <p className="text-gray-400 text-sm mb-4">{plan.desc}</p>
              <div className="mb-6">
                <span className="text-4xl font-bold">{plan.price}</span>
                <span className="text-gray-400">{plan.period}</span>
              </div>
              <ul className="space-y-3 mb-8 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-gray-300">
                    <span className="text-green-400">✓</span> {f}
                  </li>
                ))}
              </ul>
              {plan.priceId ? (
                <button
                  onClick={() => handleCheckout(plan.priceId as string, plan.name)}
                  disabled={loading === plan.name}
                  className={`w-full py-3 rounded-lg font-semibold transition disabled:opacity-50 ${plan.highlight ? "bg-green-500 hover:bg-green-600 text-white" : "border border-gray-700 hover:border-gray-500 text-white"}`}
                >
                  {loading === plan.name ? "Redirection..." : `Choisir ${plan.name}`}
                </button>
              ) : (
                <a
                  href="/signup"
                  className="w-full py-3 rounded-lg font-semibold transition border border-gray-700 hover:border-gray-500 text-white text-center block"
                >
                  Commencer gratuitement
                </a>
              )}
            </div>
          ))}
        </div>

        <p className="text-center text-gray-500 text-sm mt-12">
          Paiement sécurisé par Stripe · Annulation à tout moment · Pas d'engagement
        </p>

      </div>
    </div>
  )
}