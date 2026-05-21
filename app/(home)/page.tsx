"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import NewsletterSignup from "@/app/components/NewsletterSignup"

export default function Home() {
  const router = useRouter()
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) router.push("/dashboard")
      else setChecked(true)
    })
  }, [])

  if (!checked) return null
  return <Landing />
}

const TESTIMONIALS = [
  { name: "AlphaTrader92", color: "#4ade80", stars: 5, text: "J'ai appris à trader en 2 semaines grâce à l'académie. Les signaux IA sont incroyables, j'ai +18% ce mois-ci." },
  { name: "CryptoVictor", color: "#60a5fa", stars: 5, text: "Le paper trading m'a permis de tester mes stratégies sans risque. Maintenant je trade avec confiance." },
  { name: "SarahInvest", color: "#f472b6", stars: 5, text: "Les analyses IA sont d'une précision redoutable. Je ne prenais pas de positions sans FinanceApp." },
  { name: "MaxDayTrader", color: "#a78bfa", stars: 5, text: "Le screener en temps réel m'économise 2h de recherche par jour. Indispensable pour mon workflow." },
  { name: "TradingNovice", color: "#fb923c", stars: 5, text: "J'étais débutant complet. L'académie structurée m'a tout appris, du débutant au niveau avancé." },
  { name: "EliteQuant", color: "#34d399", stars: 5, text: "Le backtest est solide et les indicateurs techniques couvrent tout ce dont j'ai besoin." },
]

const FAQS = [
  { q: "Est-ce que le paper trading est gratuit ?", a: "Oui, le paper trading avec 10 000 $ fictifs est inclus dans le plan Free. Le plan Pro débloque 100 000 $ et des outils avancés." },
  { q: "Les signaux IA sont-ils fiables ?", a: "Nos signaux sont basés sur la confluence de 20+ indicateurs techniques analysés par Groq AI. Ils ont un taux de précision > 65% sur nos backtests." },
  { q: "Puis-je annuler à tout moment ?", a: "Oui, sans engagement. Tu peux annuler depuis ton profil en un clic, tu conserves les avantages jusqu'à la fin de la période payée." },
  { q: "Quels actifs sont disponibles ?", a: "Actions US (NYSE, NASDAQ), crypto (BTC, ETH et 50+ altcoins), ETFs, Forex, matières premières — soit 160+ actifs scannés en temps réel." },
  { q: "Comment fonctionnent les analyses IA ?", a: "Groq AI (LLaMA 3.3 70B) analyse chaque actif : tendance, supports/résistances, momentum, sentiment macro, et génère une recommandation achat/vente/hold." },
  { q: "Y a-t-il une version mobile ?", a: "FinanceApp est une web app responsive, parfaitement utilisable sur mobile et tablette. Une app native est prévue pour Q3 2026." },
  { q: "Les prix sont-ils en temps réel ?", a: "Oui, les prix sont mis à jour toutes les secondes pour les plans Pro et Premium. Le plan Free a un délai de 15 minutes." },
  { q: "Que contient l'académie ?", a: "15 cours complets : introduction aux marchés, analyse technique, psychologie du trader, crypto, DeFi, options, trading algorithmique et plus — avec quiz interactifs." },
]

const FEATURES = [
  { icon: "📊", title: "Graphes professionnels", desc: "Candlesticks, RSI, MACD, Bollinger Bands — des outils dignes des plateformes institutionnelles.", color: "from-blue-500/20 to-blue-600/5" },
  { icon: "🧠", title: "Analyses IA", desc: "Groq AI analyse chaque actif avec 20+ indicateurs et génère une recommandation en quelques secondes.", color: "from-purple-500/20 to-purple-600/5" },
  { icon: "📡", title: "Signaux en temps réel", desc: "Alertes buy/sell basées sur la confluence d'indicateurs. Filtrés, scorés, classifiés par force.", color: "from-green-500/20 to-green-600/5" },
  { icon: "💼", title: "Paper Trading", desc: "Entraîne-toi avec 100 000 $ fictifs. Positions réelles, TP/SL, historique de trades — zéro risque.", color: "from-yellow-500/20 to-yellow-600/5" },
  { icon: "🎓", title: "Académie Trading", desc: "15 cours du débutant au niveau avancé, avec quiz interactifs et suivi de progression par chapitre.", color: "from-orange-500/20 to-orange-600/5" },
  { icon: "🔔", title: "Alertes de prix", desc: "Notifié instantanément quand tes niveaux clés sont atteints. Configurables par actif et par seuil.", color: "from-red-500/20 to-red-600/5" },
]

const PLANS_COMPACT = [
  { name: "Free", price: "0$", color: "border-white/10", badge: null, features: ["5 actifs en watchlist", "Signaux basiques (3/j)", "Paper trading 10k$", "Cours débutant"] },
  { name: "Pro", price: "19$", color: "border-green-500/50", badge: "⭐ Populaire", features: ["Watchlist illimitée", "Signaux illimités", "Paper trading 100k$", "Académie complète", "Analyses IA illimitées", "10 alertes de prix"] },
  { name: "Premium", price: "49$", color: "border-yellow-500/40", badge: "💎 Pro", features: ["Tout Pro inclus", "Screener 160 actifs", "Backtesting avancé", "Alertes illimitées", "API access", "Coaching mensuel"] },
]

function Landing() {
  const [signals, setSignals] = useState<any[]>([])
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  useEffect(() => {
    fetch("/api/signals")
      .then(r => r.json())
      .then(d => setSignals((d?.signals ?? []).slice(0, 5)))
      .catch(() => {})
  }, [])

  return (
    <div className="min-h-screen bg-[#080808] text-white overflow-x-hidden">
      <style>{`
        @keyframes gradientShift { 0%,100%{background-position:0% 50%} 50%{background-position:100% 50%} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
        @keyframes ticker { from{transform:translateX(0)} to{transform:translateX(-50%)} }
        .anim-gradient{background-size:200% 200%;animation:gradientShift 8s ease infinite}
        .anim-fade-up{animation:fadeUp .7s ease forwards}
        .anim-ticker{animation:ticker 30s linear infinite}
      `}</style>

      {/* HERO */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-4 md:px-6 pt-20 md:pt-24 pb-16 text-center overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[450px] rounded-full opacity-25 blur-[120px] anim-gradient"
            style={{ background: "linear-gradient(135deg,#22c55e,#059669,#10b981,#16a34a)" }} />
          <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.025) 1px,transparent 1px)", backgroundSize: "44px 44px" }} />
        </div>

        <div className="anim-fade-up" style={{ animationDelay: "0ms" }}>
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-green-500/30 bg-green-500/10 text-green-400 text-xs font-bold uppercase tracking-wider mb-6">
            🚀 Nouveau — Signaux IA en temps réel
          </span>
        </div>

        <div className="anim-fade-up" style={{ animationDelay: "120ms", opacity: 0 }}>
          <h1 className="text-3xl sm:text-5xl md:text-7xl font-black leading-[1.05] mb-5 max-w-4xl">
            Tradez plus intelligemment{" "}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-green-400 via-emerald-300 to-green-500">
              avec l'IA
            </span>
          </h1>
        </div>

        <div className="anim-fade-up" style={{ animationDelay: "240ms", opacity: 0 }}>
          <p className="text-base md:text-xl text-gray-400 max-w-2xl mx-auto mb-8 leading-relaxed px-2">
            Signaux de trading en temps réel, analyses IA, graphes professionnels et académie de trading — tout en un.
          </p>
        </div>

        <div className="anim-fade-up flex flex-col sm:flex-row gap-4 justify-center mb-14" style={{ animationDelay: "360ms", opacity: 0 }}>
          <a href="/signup" className="px-8 py-3.5 rounded-xl font-black text-base bg-green-500 hover:bg-green-400 text-black transition-all shadow-xl shadow-green-500/30 hover:shadow-green-400/40 hover:scale-[1.03]">
            Commencer gratuitement →
          </a>
          <a href="#features" className="px-8 py-3.5 rounded-xl font-semibold text-base border border-white/15 hover:border-white/30 text-gray-300 hover:text-white transition-all">
            Voir les fonctionnalités
          </a>
        </div>

        <div className="anim-fade-up flex flex-wrap justify-center gap-6 md:gap-10 text-center" style={{ animationDelay: "480ms", opacity: 0 }}>
          {[["10 000+","traders actifs"],["160+","actifs scannés"],["20+","indicateurs IA"],["98%","satisfaction"]].map(([v,l]) => (
            <div key={l}>
              <div className="text-2xl font-black text-white">{v}</div>
              <div className="text-xs text-gray-500 font-medium mt-0.5">{l}</div>
            </div>
          ))}
        </div>

        {/* App mockup */}
        <div className="anim-fade-up mt-16 w-full max-w-4xl mx-auto" style={{ animationDelay: "600ms", opacity: 0 }}>
          <div className="relative rounded-2xl border border-white/10 bg-[#0d0d0d] overflow-hidden shadow-2xl shadow-black/70">
            <div className="flex items-center gap-1.5 px-4 py-3 border-b border-white/5 bg-[#111]">
              <div className="w-3 h-3 rounded-full bg-red-500/60" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
              <div className="w-3 h-3 rounded-full bg-green-500/60" />
              <span className="ml-3 text-xs text-gray-600">financeapp.io — Dashboard</span>
            </div>
            <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
              {[["AAPL","+2.4%"],["BTC","+5.1%"],["NVDA","+3.8%"],["ETH","+1.2%"]].map(([sym,chg]) => (
                <div key={sym} className="bg-[#151515] rounded-xl p-3 border border-white/5">
                  <div className="text-[10px] text-gray-500 mb-0.5">{sym}</div>
                  <div className="text-sm font-black text-green-400">{chg}</div>
                </div>
              ))}
              <div className="col-span-2 sm:col-span-3 bg-[#151515] rounded-xl border border-white/5 h-24 sm:h-32 flex items-center justify-center">
                <div className="text-gray-700 text-xs text-center">
                  <div className="text-xl sm:text-2xl mb-1">📊</div>
                  Graphe interactif
                </div>
              </div>
              <div className="col-span-2 sm:col-span-1 bg-[#151515] rounded-xl border border-white/5 h-24 sm:h-32 p-3">
                <div className="text-[10px] text-gray-500 mb-2 font-bold uppercase">Signaux IA</div>
                {[["BUY","AAPL"],["SELL","TSLA"],["BUY","BTC"]].map(([sig,sym]) => (
                  <div key={sym} className={`text-[10px] font-bold mb-1.5 flex items-center gap-1 ${sig==="BUY"?"text-green-400":"text-red-400"}`}>
                    <span className="text-[8px]">●</span> {sig} {sym}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TICKER TAPE */}
      <div className="overflow-hidden border-y border-white/5 py-3 bg-[#0a0a0a]">
        <div className="flex anim-ticker whitespace-nowrap">
          {[0,1].map(ri => (
            <span key={ri} className="flex gap-0">
              {["AAPL +2.41%","TSLA +1.83%","BTC +4.92%","NVDA +3.20%","ETH +2.14%","MSFT +0.92%","AMZN +1.55%","GOOGL +1.23%","SOL +6.44%","DOGE +8.11%"].map(t => (
                <span key={t+ri} className="text-xs font-semibold text-green-400 mx-6">● {t}</span>
              ))}
            </span>
          ))}
        </div>
      </div>

      {/* FEATURES */}
      <section id="features" className="py-16 md:py-24 px-4 md:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-xs font-bold uppercase tracking-widest text-green-400">Fonctionnalités</span>
            <h2 className="text-2xl md:text-4xl font-black text-white mt-2 mb-3">Tout ce dont un trader a besoin</h2>
            <p className="text-gray-400 text-base md:text-lg max-w-xl mx-auto">Des outils institutionnels accessibles à tous, propulsés par l'IA.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map(f => (
              <div key={f.title} className={`group bg-gradient-to-br ${f.color} border border-white/8 rounded-2xl p-6 hover:border-white/20 transition-all duration-300 hover:-translate-y-1 cursor-default`}>
                <div className="text-4xl mb-4 group-hover:scale-110 transition-transform duration-300 inline-block">{f.icon}</div>
                <h3 className="text-white font-bold text-base mb-2">{f.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="py-16 md:py-24 px-4 md:px-6 bg-[#0a0a0a]">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-xs font-bold uppercase tracking-widest text-green-400">Simple</span>
            <h2 className="text-2xl md:text-4xl font-black text-white mt-2 mb-3">Démarrez en 3 minutes</h2>
          </div>
          <div className="flex flex-col md:flex-row items-stretch gap-4">
            {[
              { n:"1", title:"Crée ton compte", desc:"Inscription gratuite en 30 secondes, aucune carte requise.", icon:"👤" },
              { n:"2", title:"Configure ta watchlist", desc:"Ajoute tes actifs favoris et personnalise tes alertes de prix.", icon:"⚙️" },
              { n:"3", title:"Trade avec l'IA", desc:"Reçois des signaux, analyse avec l'IA, practice sur le paper trading.", icon:"🚀" },
            ].map((step, i) => (
              <div key={step.n} className="flex md:flex-1 flex-col md:flex-row items-center gap-4 w-full">
                <div className="flex-1 bg-[#111] border border-white/8 rounded-2xl p-6 text-center hover:border-green-500/20 transition-all w-full">
                  <div className="w-10 h-10 rounded-full bg-green-500/15 border border-green-500/25 flex items-center justify-center text-green-400 font-black text-sm mx-auto mb-3">{step.n}</div>
                  <div className="text-3xl mb-2">{step.icon}</div>
                  <h3 className="text-white font-bold mb-1">{step.title}</h3>
                  <p className="text-gray-500 text-sm">{step.desc}</p>
                </div>
                {i < 2 && <div className="text-gray-700 text-xl font-black rotate-90 md:rotate-0 flex-shrink-0">→</div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* LIVE SCREENER */}
      <section className="py-16 md:py-24 px-4 md:px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-green-400">
              <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"/><span className="relative inline-flex rounded-full h-2 w-2 bg-green-400"/></span>
              Live
            </span>
            <h2 className="text-2xl md:text-4xl font-black text-white mt-2 mb-3">Opportunités en ce moment</h2>
            <p className="text-gray-400">Les signaux les plus forts détectés par notre IA à l'instant.</p>
          </div>
          <div className="space-y-3 mb-8">
            {signals.length > 0 ? signals.map((s: any, i: number) => (
              <div key={i} className="flex items-center gap-3 bg-[#111] border border-white/8 rounded-xl px-4 py-3 hover:border-green-500/15 transition">
                <span className="text-sm font-black text-white w-14 flex-shrink-0">{s.symbol ?? s.ticker ?? "—"}</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-lg flex-shrink-0 ${(s.signal ?? "").toLowerCase().includes("buy") || (s.signal ?? "").toLowerCase().includes("achat") ? "bg-green-500/15 text-green-400 border border-green-500/20" : "bg-red-500/15 text-red-400 border border-red-500/20"}`}>
                  {s.signal ?? "SIGNAL"}
                </span>
                <span className="text-xs text-gray-500 truncate flex-1 hidden sm:block">{s.reason ?? s.description ?? "Confluence d'indicateurs détectée"}</span>
                <span className={`text-xs font-bold flex-shrink-0 hidden sm:block ${s.strength === "strong" ? "text-green-400" : s.strength === "medium" ? "text-yellow-400" : "text-gray-600"}`}>
                  {s.strength === "strong" ? "🔥 Fort" : s.strength === "medium" ? "⚡ Moyen" : "— Faible"}
                </span>
              </div>
            )) : Array.from({length:5},(_,i) => (
              <div key={i} className="h-14 bg-[#111] border border-white/5 rounded-xl animate-pulse" />
            ))}
          </div>
          <div className="text-center">
            <a href="/signup" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-green-500/10 border border-green-500/25 text-green-400 font-semibold text-sm hover:bg-green-500/20 transition">
              Voir tous les signaux →
            </a>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="py-16 md:py-24 px-4 md:px-6 bg-[#0a0a0a]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-xs font-bold uppercase tracking-widest text-green-400">Avis traders</span>
            <h2 className="text-2xl md:text-4xl font-black text-white mt-2 mb-3">Ce que disent nos traders</h2>
            <p className="text-gray-400">Plus de 10 000 traders font confiance à FinanceApp.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {TESTIMONIALS.map(t => (
              <div key={t.name} className="bg-[#111] border border-white/5 rounded-2xl p-5 hover:border-white/10 transition-all hover:-translate-y-0.5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center font-black text-black text-sm flex-shrink-0" style={{background:t.color}}>
                    {t.name[0]}
                  </div>
                  <div>
                    <div className="text-white font-semibold text-sm">{t.name}</div>
                    <div className="text-yellow-400 text-xs tracking-wider">{"★".repeat(t.stars)}</div>
                  </div>
                </div>
                <p className="text-gray-400 text-sm leading-relaxed">"{t.text}"</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING SUMMARY */}
      <section className="py-16 md:py-24 px-4 md:px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-xs font-bold uppercase tracking-widest text-green-400">Tarifs</span>
            <h2 className="text-2xl md:text-4xl font-black text-white mt-2 mb-3">Simple et transparent</h2>
            <p className="text-gray-400">Commence gratuitement, upgrade quand tu es prêt.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PLANS_COMPACT.map(p => (
              <div key={p.name} className={`relative bg-[#111] border ${p.color} rounded-2xl p-6 flex flex-col ${p.name==="Pro"?"shadow-lg shadow-green-500/10":""}`}>
                {p.badge && (
                  <span className={`absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-black whitespace-nowrap ${p.name==="Pro"?"bg-green-500 text-black":"bg-yellow-500/20 border border-yellow-500/30 text-yellow-400"}`}>{p.badge}</span>
                )}
                <div className="mb-4 mt-2">
                  <div className="text-xl font-black text-white">{p.name}</div>
                  <div className="text-3xl font-black mt-1">{p.price}<span className="text-gray-500 text-sm font-normal">/mois</span></div>
                </div>
                <ul className="space-y-2 flex-1 mb-5">
                  {p.features.map(f => (
                    <li key={f} className="flex items-start gap-2 text-sm text-gray-300">
                      <span className="text-green-400 mt-0.5 flex-shrink-0">✓</span>{f}
                    </li>
                  ))}
                </ul>
                <a href={p.name==="Free"?"/signup":"/pricing"} className={`w-full py-2.5 rounded-xl text-sm font-bold text-center transition block ${p.name==="Pro"?"bg-green-500 hover:bg-green-400 text-black":"border border-white/15 hover:border-white/30 text-white"}`}>
                  {p.name==="Free"?"Commencer gratuitement":"Voir les détails →"}
                </a>
              </div>
            ))}
          </div>
          <p className="text-center text-gray-600 text-xs mt-8">Paiement sécurisé · Annulation à tout moment · 30j satisfait ou remboursé</p>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 md:py-24 px-4 md:px-6 bg-[#0a0a0a]">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-xs font-bold uppercase tracking-widest text-green-400">FAQ</span>
            <h2 className="text-2xl md:text-4xl font-black text-white mt-2 mb-3">Questions fréquentes</h2>
          </div>
          <div className="space-y-2">
            {FAQS.map((faq,i) => (
              <div key={i} className="border border-white/8 rounded-xl overflow-hidden">
                <button onClick={() => setOpenFaq(openFaq===i?null:i)} className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/3 transition">
                  <span className="text-white font-semibold text-sm pr-4">{faq.q}</span>
                  <span className={`text-green-400 text-xl font-light flex-shrink-0 transition-transform duration-200 ${openFaq===i?"rotate-45":""}`}>+</span>
                </button>
                {openFaq===i && (
                  <div className="px-5 pb-4 border-t border-white/5">
                    <p className="text-gray-400 text-sm leading-relaxed pt-3">{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA BAND */}
      <section className="py-16 md:py-20 px-4 md:px-6 relative overflow-hidden">
        <div className="absolute inset-0 anim-gradient opacity-10" style={{background:"linear-gradient(135deg,#22c55e,#059669,#10b981)"}} />
        <div className="max-w-3xl mx-auto text-center relative">
          <h2 className="text-2xl md:text-4xl font-black text-white mb-4">Prêt à trader plus intelligemment ?</h2>
          <p className="text-gray-300 mb-8">Rejoins 10 000+ traders qui utilisent FinanceApp au quotidien.</p>
          <a href="/signup" className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl font-black bg-white text-black hover:bg-gray-100 transition shadow-xl">
            Créer un compte gratuit →
          </a>
        </div>
      </section>

      {/* NEWSLETTER */}
      <section className="py-12 px-4 md:px-6" style={{ background: "#0a0a0a", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
        <div className="max-w-xl mx-auto">
          <NewsletterSignup source="landing-footer" />
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/5 py-10 md:py-12 px-4 md:px-6 bg-[#080808]">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center">
                  <span className="text-white font-black text-xs">F</span>
                </div>
                <span className="text-white font-black">FinanceApp</span>
              </div>
              <p className="text-gray-600 text-xs leading-relaxed max-w-[200px]">La plateforme de trading intelligente pour les traders modernes.</p>
            </div>
            {[
              {title:"Produit", links:[["Fonctionnalités","/#features"],["Signaux","/signaux"],["Académie","/apprendre"],["Blog","/blog"],["Forum","/forum"]]},
              {title:"Tarifs", links:[["Plans & Prix","/pricing"],["Free","/signup"],["Pro","/pricing"],["Premium","/pricing"]]},
              {title:"Légal", links:[["CGU","/legal/terms"],["Confidentialité","/legal/privacy"],["Cookies","/legal/cookies"],["Support","mailto:support@financeapp.io"]]},
            ].map(col => (
              <div key={col.title}>
                <h4 className="text-white font-bold text-xs mb-3 uppercase tracking-wide">{col.title}</h4>
                <ul className="space-y-2">
                  {col.links.map(([l,h]) => (
                    <li key={l}><a href={h} className="text-gray-600 hover:text-gray-300 text-xs transition">{l}</a></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="border-t border-white/5 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-gray-700 text-xs">© 2026 FinanceApp — Tous droits réservés</p>
            <div className="flex items-center gap-3">
              {[["𝕏","#"],["in","#"],["▶","#"]].map(([icon,href]) => (
                <a key={icon} href={href} className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-500 hover:text-white transition text-xs font-bold">{icon}</a>
              ))}
            </div>
          </div>
          {/* Legal links */}
          <div className="flex flex-wrap justify-center gap-4 mt-4 text-xs text-gray-700">
            <a href="/legal/privacy" className="hover:text-gray-500 transition">Confidentialité</a>
            <a href="/legal/terms" className="hover:text-gray-500 transition">CGU</a>
            <a href="/legal/cookies" className="hover:text-gray-500 transition">Cookies</a>
            <a href="mailto:support@financeapp.io" className="hover:text-gray-500 transition">Support</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
