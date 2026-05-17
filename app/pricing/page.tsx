"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"

const PRO_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID
const PREMIUM_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_PREMIUM_PRICE_ID

const PRICING_FAQS = [
  { q: "Puis-je changer de plan à tout moment ?", a: "Oui, tu peux upgrader ou downgrader à tout moment. La différence est calculée au prorata." },
  { q: "Comment fonctionne la garantie 30 jours ?", a: "Si tu n'es pas satisfait dans les 30 premiers jours, on te rembourse intégralement, sans question." },
  { q: "Y a-t-il un engagement minimum ?", a: "Non, aucun engagement. Tu peux annuler à tout moment depuis ton profil. Tu gardes les avantages jusqu'à la fin de ta période." },
  { q: "Le plan annuel est-il auto-renouvelable ?", a: "Oui, les plans annuels se renouvellent automatiquement. Tu recevras un email de rappel 7 jours avant le renouvellement." },
  { q: "Puis-je obtenir une facture pour ma comptabilité ?", a: "Oui, toutes les factures sont disponibles dans l'espace client Stripe et peuvent être téléchargées en PDF." },
]

const COMPARISON_ROWS = [
  { feature: "Actifs en watchlist",       free: "5",           pro: "Illimité",     premium: "Illimité" },
  { feature: "Mises à jour des prix",     free: "Délai 15min", pro: "Temps réel",   premium: "Temps réel" },
  { feature: "Graphes techniques",        free: "Basiques",    pro: "Pro complets", premium: "Pro complets" },
  { feature: "Indicateurs",              free: "3",           pro: "20+",          premium: "20+" },
  { feature: "Signaux IA",               free: "3/jour",      pro: "Illimités",    premium: "Illimités" },
  { feature: "Analyses IA",              free: "1/jour",      pro: "Illimitées",   premium: "Illimitées" },
  { feature: "Paper trading capital",    free: "10 000 $",    pro: "100 000 $",    premium: "100 000 $" },
  { feature: "Alertes de prix",          free: "—",           pro: "10",           premium: "Illimitées" },
  { feature: "Académie",                 free: "Débutant",    pro: "Complète",     premium: "Complète" },
  { feature: "Screener",                 free: "—",           pro: "—",            premium: "160 actifs" },
  { feature: "Backtesting",              free: "—",           pro: "Basique",      premium: "Avancé" },
  { feature: "API access",               free: "—",           pro: "—",            premium: "✓" },
  { feature: "Signaux SMS",              free: "—",           pro: "—",            premium: "✓" },
  { feature: "Coaching mensuel",         free: "—",           pro: "—",            premium: "1h/mois" },
  { feature: "Accès bêta features",      free: "—",           pro: "—",            premium: "✓" },
  { feature: "Support",                  free: "Email",       pro: "Prioritaire",  premium: "Prioritaire" },
]

export default function Pricing() {
  const [user, setUser] = useState<any>(null)
  const [annual, setAnnual] = useState(false)
  const [loading, setLoading] = useState<string | null>(null)
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
  }, [])

  async function handleCheckout(priceId: string, planName: string) {
    if (!user) { window.location.href = "/signup"; return }
    setLoading(planName)
    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priceId, email: user.email }),
    })
    const data = await res.json()
    if (data.url) window.location.href = data.url
    else alert("Erreur lors du paiement")
    setLoading(null)
  }

  const plans = [
    {
      name: "Free",
      monthlyPrice: 0,
      annualPrice: 0,
      color: "border-white/10",
      badge: null,
      badgeBg: "",
      priceId: null,
      desc: "Pour découvrir la plateforme",
      features: [
        "5 actifs en watchlist",
        "Prix avec délai de 15 min",
        "Graphes basiques",
        "3 signaux IA / jour",
        "1 analyse IA / jour",
        "Paper trading 10 000 $",
        "Cours débutant seulement",
        "Support email",
      ],
    },
    {
      name: "Pro",
      monthlyPrice: 19,
      annualPrice: 15,
      color: "border-green-500/40",
      badge: "⭐ Le plus populaire",
      badgeBg: "bg-green-500 text-black",
      priceId: PRO_PRICE_ID,
      desc: "Pour les traders sérieux",
      features: [
        "Watchlist illimitée",
        "Prix en temps réel",
        "Graphes pro + 20+ indicateurs",
        "Signaux IA illimités",
        "Analyses IA illimitées",
        "Paper trading 100 000 $",
        "10 alertes de prix",
        "Académie complète (15 cours)",
        "Backtesting basique",
        "Support prioritaire",
      ],
    },
    {
      name: "Premium",
      monthlyPrice: 49,
      annualPrice: 39,
      color: "border-yellow-500/30",
      badge: "💎 Pour les pros",
      badgeBg: "bg-yellow-500/20 border border-yellow-500/30 text-yellow-300",
      priceId: PREMIUM_PRICE_ID,
      desc: "Pour les traders professionnels",
      features: [
        "Tout ce qui est dans Pro",
        "Screener 160 actifs temps réel",
        "Alertes de prix illimitées",
        "Backtesting avancé",
        "API access",
        "Signaux SMS",
        "1h de coaching mensuel",
        "Accès bêta features",
        "Support prioritaire 7j/7",
      ],
    },
  ]

  return (
    <div className="min-h-screen bg-[#080808] text-white pb-24">

      {/* Header */}
      <div className="pt-24 pb-12 px-6 text-center">
        <span className="text-xs font-bold uppercase tracking-widest text-green-400">Tarifs</span>
        <h1 className="text-5xl font-black text-white mt-2 mb-3">Choisissez votre plan</h1>
        <p className="text-gray-400 text-lg mb-8">Commence gratuitement, upgrade quand tu es prêt.</p>

        {/* Toggle mensuel/annuel */}
        <div className="inline-flex items-center gap-3 bg-[#111] border border-white/8 rounded-xl p-1">
          <button
            onClick={() => setAnnual(false)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${!annual ? "bg-white/10 text-white" : "text-gray-500 hover:text-gray-300"}`}
          >
            Mensuel
          </button>
          <button
            onClick={() => setAnnual(true)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${annual ? "bg-white/10 text-white" : "text-gray-500 hover:text-gray-300"}`}
          >
            Annuel
            <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-green-500/20 text-green-400">-20%</span>
          </button>
        </div>
      </div>

      {/* Plans */}
      <div className="max-w-5xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          {plans.map(plan => {
            const price = annual ? plan.annualPrice : plan.monthlyPrice
            const isHighlight = plan.name === "Pro"
            return (
              <div key={plan.name} className={`relative flex flex-col bg-[#111] border ${plan.color} rounded-2xl p-6 ${isHighlight ? "shadow-xl shadow-green-500/10" : ""}`}>
                {plan.badge && (
                  <span className={`absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-black whitespace-nowrap ${plan.badgeBg}`}>
                    {plan.badge}
                  </span>
                )}
                <div className="mt-2 mb-5">
                  <h2 className="text-xl font-black text-white mb-1">{plan.name}</h2>
                  <p className="text-gray-500 text-xs mb-4">{plan.desc}</p>
                  <div className="flex items-end gap-1">
                    <span className="text-4xl font-black text-white">{price === 0 ? "Gratuit" : `${price}$`}</span>
                    {price > 0 && <span className="text-gray-500 text-sm mb-1">{annual ? "/mois, facturé annuellement" : "/mois"}</span>}
                  </div>
                  {annual && price > 0 && (
                    <p className="text-xs text-green-400 mt-1">Économise {((plan.monthlyPrice - plan.annualPrice) * 12)}$ par an</p>
                  )}
                </div>
                <ul className="space-y-2.5 flex-1 mb-6">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-start gap-2 text-sm text-gray-300">
                      <span className="text-green-400 flex-shrink-0 mt-0.5">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                {plan.priceId ? (
                  <button
                    onClick={() => handleCheckout(plan.priceId as string, plan.name)}
                    disabled={loading === plan.name}
                    className={`w-full py-3 rounded-xl font-bold text-sm transition disabled:opacity-50 ${
                      isHighlight
                        ? "bg-green-500 hover:bg-green-400 text-black shadow-lg shadow-green-500/25"
                        : "border border-white/15 hover:border-white/30 text-white"
                    }`}
                  >
                    {loading === plan.name ? "Redirection..." : `Choisir ${plan.name}`}
                  </button>
                ) : (
                  <a href="/signup" className="w-full py-3 rounded-xl font-bold text-sm border border-white/15 hover:border-white/30 text-white text-center block transition">
                    Commencer gratuitement
                  </a>
                )}
              </div>
            )
          })}
        </div>

        {/* Comparison table */}
        <div className="mb-16">
          <h2 className="text-2xl font-black text-white mb-6 text-center">Comparaison complète</h2>
          <div className="bg-[#111] border border-white/8 rounded-2xl overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-4 px-5 py-3 border-b border-white/8 bg-[#0d0d0d]">
              <span className="text-xs font-bold uppercase tracking-wide text-gray-600">Fonctionnalité</span>
              {["Free","Pro","Premium"].map(p => (
                <span key={p} className={`text-xs font-black text-center uppercase tracking-wide ${p==="Pro"?"text-green-400":p==="Premium"?"text-yellow-400":"text-gray-500"}`}>{p}</span>
              ))}
            </div>
            {COMPARISON_ROWS.map((row, i) => (
              <div key={row.feature} className={`grid grid-cols-4 px-5 py-3 ${i%2===0?"":"bg-white/[0.015]"} hover:bg-white/5 transition`}>
                <span className="text-sm text-gray-400 font-medium">{row.feature}</span>
                {[row.free, row.pro, row.premium].map((val, j) => (
                  <span key={j} className={`text-xs text-center font-semibold ${
                    val === "—" ? "text-gray-700" :
                    val === "✓" ? "text-green-400" :
                    j === 1 ? "text-green-300" :
                    j === 2 ? "text-yellow-300" :
                    "text-gray-400"
                  }`}>{val}</span>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Guarantee */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-16">
          {[
            { icon: "🛡️", title: "30 jours satisfait", desc: "ou remboursé intégralement, sans condition" },
            { icon: "⚡", title: "Annulation facile", desc: "en un clic depuis ton profil, sans engagement" },
            { icon: "💬", title: "Support 7j/7", desc: "une équipe disponible pour t'aider à tout moment" },
          ].map(g => (
            <div key={g.title} className="bg-[#111] border border-white/8 rounded-2xl p-5 text-center hover:border-white/15 transition">
              <div className="text-3xl mb-3">{g.icon}</div>
              <div className="text-white font-bold text-sm mb-1">{g.title}</div>
              <div className="text-gray-500 text-xs">{g.desc}</div>
            </div>
          ))}
        </div>

        {/* FAQ */}
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-black text-white mb-6 text-center">Questions sur la facturation</h2>
          <div className="space-y-2">
            {PRICING_FAQS.map((faq, i) => (
              <div key={i} className="border border-white/8 rounded-xl overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/3 transition"
                >
                  <span className="text-white font-semibold text-sm pr-4">{faq.q}</span>
                  <span className={`text-green-400 text-xl font-light flex-shrink-0 transition-transform duration-200 ${openFaq === i ? "rotate-45" : ""}`}>+</span>
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-4 border-t border-white/5">
                    <p className="text-gray-400 text-sm leading-relaxed pt-3">{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
