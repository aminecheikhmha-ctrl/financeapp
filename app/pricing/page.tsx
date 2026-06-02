"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Check, X, Zap, Shield, Star } from "lucide-react"
import TradexLogo from "@/app/components/TradexLogo"
import { useLanguage } from "@/lib/i18n/context"

type BillingPeriod = "monthly" | "annual"

const PLANS = [
  {
    key: "free" as const,
    icon: "🌱",
    color: "#9ca3af",
    monthlyPrice: 0,
    annualPrice: 0,
    ctaStyle: "secondary",
    hasBadge: false,
    stripePriceId: undefined as string | undefined,
    stripePriceIdAnnual: undefined as string | undefined,
    features: [
      { text: "3 AI signals per day", included: true },
      { text: "Dashboard with charts", included: true },
      { text: "Paper trading ($100k virtual)", included: true },
      { text: "Full beginner courses", included: true },
      { text: "Community forum", included: true },
      { text: "AI coach (5 questions/day)", included: true },
      { text: "Unlimited signals", included: false },
      { text: "160+ asset screener", included: false },
      { text: "Unlimited price alerts", included: false },
      { text: "Strategy backtesting", included: false },
      { text: "Advanced reports", included: false },
      { text: "Public API", included: false },
    ],
  },
  {
    key: "pro" as const,
    icon: "⭐",
    color: "#22c55e",
    monthlyPrice: 19,
    annualPrice: 15,
    ctaStyle: "primary",
    hasBadge: true,
    stripePriceId: process.env.NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID,
    stripePriceIdAnnual: process.env.NEXT_PUBLIC_STRIPE_PRO_ANNUAL_PRICE_ID,
    features: [
      { text: "Everything in Free included", included: true },
      { text: "Unlimited AI signals", included: true },
      { text: "160+ asset screener", included: true },
      { text: "Unlimited price alerts", included: true },
      { text: "All courses (all levels)", included: true },
      { text: "Strategy backtesting", included: true },
      { text: "Advanced reports (Sharpe, DD)", included: true },
      { text: "AI pattern scanner", included: true },
      { text: "Unlimited AI coach", included: true },
      { text: "Weekly AI report", included: true },
      { text: "Priority support", included: false },
      { text: "Public API", included: false },
    ],
  },
  {
    key: "premium" as const,
    icon: "💎",
    color: "#fbbf24",
    monthlyPrice: 49,
    annualPrice: 39,
    ctaStyle: "gold",
    hasBadge: false,
    stripePriceId: process.env.NEXT_PUBLIC_STRIPE_PREMIUM_MONTHLY_PRICE_ID,
    stripePriceIdAnnual: process.env.NEXT_PUBLIC_STRIPE_PREMIUM_ANNUAL_PRICE_ID,
    features: [
      { text: "Everything in Pro included", included: true },
      { text: "Tradex public API", included: true },
      { text: "Priority support 24h", included: true },
      { text: "Beta access to new features", included: true },
      { text: "Ultra-personalized AI report", included: true },
      { text: "Priority high-confluence signals", included: true },
      { text: "Personalized 1-on-1 onboarding", included: true },
      { text: "CSV/PDF data export", included: true },
      { text: "Third-party integrations (coming soon)", included: true },
      { text: "White-label option", included: true },
      { text: "Private training (coming soon)", included: true },
      { text: "Everything unlimited", included: true },
    ],
  },
]

const FAQS = [
  { q: "Does Tradex use real market data?", a: "Yes, all data comes from Yahoo Finance in real time. Prices, changes and volumes are updated continuously during market hours." },
  { q: "What exactly is paper trading?", a: "It's simulated trading with $100,000 virtual funds. You learn to trade without risking a single cent. Perfect for beginners or testing new strategies before applying them to real markets." },
  { q: "Are the AI signals reliable?", a: "Our signals combine 20+ technical indicators with an algorithmic confluence score. The higher the confluence (>70%), the more statistically reliable the signal. They are not guarantees, but decision-support tools." },
  { q: "Can I cancel at any time?", a: "Yes, with no commitment and no cancellation fees. You can cancel from your settings in one click. You keep access until the end of the paid period." },
  { q: "Is there a trial period?", a: "The Free plan is unlimited in time — you can use it without restriction. It gives you access to the essential features to evaluate Tradex before upgrading to Pro." },
  { q: "Is Tradex a financial advisor?", a: "No. Tradex is an educational paper trading tool. Signals and analyses are provided for informational purposes only and do not constitute investment advice. Always trade with your own judgment." },
  { q: "How does payment work?", a: "Payment is secured by Stripe, the global leader in online payment. We accept all major credit cards. No payment information is stored on our servers." },
  { q: "Is there a mobile app?", a: "Tradex is a PWA (Progressive Web App) installable on iOS and Android from the browser. A native Capacitor app is currently being submitted to the App Store and Play Store." },
]

const TESTIMONIALS = [
  { name: "Thomas M.", role: "Beginner trader", stars: 5, text: "In 2 months with Tradex, I learned more than in 1 year alone on YouTube. The real-data simulations are incredible.", avatar: "T", color: "#4ade80" },
  { name: "Sarah K.", role: "Investor", stars: 5, text: "The AI signals are stunning. The algorithmic confluence helped me identify opportunities I would never have seen on my own.", avatar: "S", color: "#60a5fa" },
  { name: "Marc D.", role: "Swing trader", stars: 5, text: "The 160-asset screener + real-time alerts completely changed how I trade. Essential for Pro users.", avatar: "M", color: "#a78bfa" },
  { name: "Julie L.", role: "Crypto trader", stars: 5, text: "The AI coach answers all my questions at any hour. It's like having an expert mentor available 24/7.", avatar: "J", color: "#f97316" },
]

const COMPARISON_ROWS = [
  { feature: "AI Signals",        free: "3/day",            pro: "Unlimited",     premium: "Unlimited + priority" },
  { feature: "Indicators",        free: "RSI, MACD, BB",    pro: "20+",           premium: "20+" },
  { feature: "Screener",          free: "Top 5 only",       pro: "160+ assets",   premium: "160+ assets" },
  { feature: "Price alerts",      free: "3 max",            pro: "Unlimited",     premium: "Unlimited" },
  { feature: "Academy courses",   free: "Beginner level",   pro: "All levels",    premium: "All levels" },
  { feature: "AI coach",          free: "5/day",            pro: "Unlimited",     premium: "Unlimited" },
  { feature: "Backtest",          free: "✗",                pro: "✓",             premium: "✓" },
  { feature: "AI scanner",        free: "✗",                pro: "✓",             premium: "✓" },
  { feature: "Public API",        free: "✗",                pro: "✗",             premium: "✓" },
  { feature: "Support",           free: "Forum",            pro: "Email",         premium: "Priority 24h" },
  { feature: "Weekly AI report",  free: "✗",                pro: "✓",             premium: "Ultra-personalized" },
]

export default function PricingPage() {
  const router = useRouter()
  const { t } = useLanguage()
  const [billing, setBilling] = useState<BillingPeriod>("monthly")
  const [loading, setLoading] = useState<string | null>(null)
  const [currentPlan, setCurrentPlan] = useState("free")
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null)
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) return
      setIsLoggedIn(true)
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("plan")
        .eq("id", data.session.user.id)
        .single()
      if (profile?.plan) setCurrentPlan(profile.plan)
    })
  }, [])

  async function handleSubscribe(plan: typeof PLANS[0]) {
    if (plan.key === "free") { router.push(isLoggedIn ? "/dashboard" : "/signup"); return }
    if (currentPlan === plan.key) return
    setLoading(plan.key)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push("/signup"); return }
      const priceId = billing === "annual" ? plan.stripePriceIdAnnual : plan.stripePriceId
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ priceId, billingPeriod: billing }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } catch (e) {
      console.error(e)
    }
    setLoading(null)
  }

  const savingsAnnual = Math.round((1 - 15 / 19) * 100)

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-canvas)" }}>

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
        <TradexLogo size={28} showText textSize="sm" />
        <div className="flex gap-3">
          {isLoggedIn ? (
            <a href="/dashboard"
              className="px-4 py-2 rounded-lg text-sm font-bold text-black transition hover:opacity-90"
              style={{ background: "#22c55e" }}>
              {t.pricing.backToDashboard}
            </a>
          ) : (
            <>
              <a href="/login" className="px-4 py-2 rounded-lg text-sm text-white/50 hover:text-white transition">
                {t.auth.loginLink}
              </a>
              <a href="/signup"
                className="px-4 py-2 rounded-lg text-sm font-bold text-black transition hover:opacity-90"
                style={{ background: "#22c55e" }}>
                {t.pricing.plans.free.cta}
              </a>
            </>
          )}
        </div>
      </div>

      {/* Hero */}
      <div className="text-center px-6 py-16 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6"
          style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}>
          <Zap size={14} className="text-green-400" />
          <span className="text-xs text-green-400 font-bold">{t.pricing.badge}</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-black text-white mb-4 leading-tight">
          <span style={{
            background: "linear-gradient(135deg, #4ade80, #22c55e)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}>
            {t.pricing.title}
          </span>
        </h1>
        <p className="text-white/50 text-lg mb-8">
          {t.pricing.subtitle}
        </p>

        {/* Billing toggle */}
        <div className="inline-flex items-center gap-4 p-1.5 rounded-2xl"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <button
            onClick={() => setBilling("monthly")}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${billing === "monthly" ? "bg-white text-black" : "text-white/50 hover:text-white"}`}>
            {t.pricing.monthly}
          </button>
          <button
            onClick={() => setBilling("annual")}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${billing === "annual" ? "bg-white text-black" : "text-white/50 hover:text-white"}`}>
            {t.pricing.annual}
            <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full"
              style={{
                background: billing === "annual" ? "#22c55e" : "rgba(34,197,94,0.2)",
                color: billing === "annual" ? "black" : "#4ade80",
              }}>
              -{savingsAnnual}%
            </span>
          </button>
        </div>
      </div>

      {/* Plan cards */}
      <div className="max-w-5xl mx-auto px-6 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLANS.map(plan => {
            const price = billing === "annual" ? plan.annualPrice : plan.monthlyPrice
            const isCurrent = currentPlan === plan.key
            const isPopular = plan.hasBadge
            const planT = t.pricing.plans[plan.key]
            const badge = plan.hasBadge ? ("badge" in planT ? planT.badge : undefined) : undefined
            return (
              <div key={plan.key}
                className={`relative rounded-3xl overflow-hidden ${isPopular ? "md:scale-[1.03] md:-mt-3" : ""}`}
                style={{
                  background: isPopular ? "rgba(34,197,94,0.05)" : "#0a0a0a",
                  border: `2px solid ${isPopular ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.08)"}`,
                  boxShadow: isPopular ? "0 0 40px rgba(34,197,94,0.1)" : "none",
                }}>
                {badge && (
                  <div className="absolute top-0 left-0 right-0 py-2 text-center text-[10px] font-black text-black uppercase tracking-widest"
                    style={{ background: "#22c55e" }}>
                    {badge}
                  </div>
                )}
                <div className={`p-7 ${badge ? "pt-10" : ""}`}>
                  <div className="flex items-center gap-2.5 mb-4">
                    <span className="text-3xl">{plan.icon}</span>
                    <div>
                      <p className="font-black text-white text-lg">{planT.name}</p>
                      <p className="text-xs text-white/40">{planT.desc}</p>
                    </div>
                  </div>
                  <div className="mb-6">
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-black text-white">{price === 0 ? "0€" : `${price}€`}</span>
                      {price > 0 && <span className="text-white/30 text-sm">{t.pricing.perMonth}</span>}
                    </div>
                    {billing === "annual" && price > 0 && (
                      <p className="text-[11px] text-white/30 mt-1">
                        {t.pricing.billedAnnually.replace("{price}", String(price * 12)).replace("{save}", String((plan.monthlyPrice - price) * 12))}
                      </p>
                    )}
                    {price === 0 && <p className="text-[11px] text-white/30 mt-1">{t.pricing.forever}</p>}
                  </div>
                  <button
                    onClick={() => handleSubscribe(plan)}
                    disabled={isCurrent || loading === plan.key}
                    className={`w-full py-3.5 rounded-2xl text-sm font-black transition-all mb-6 disabled:opacity-60 ${!isCurrent ? "hover:scale-[1.02] active:scale-[0.98]" : ""}`}
                    style={{
                      background: isCurrent ? "rgba(255,255,255,0.06)"
                        : plan.ctaStyle === "primary" ? "linear-gradient(135deg, #22c55e, #16a34a)"
                        : plan.ctaStyle === "gold" ? "linear-gradient(135deg, #fbbf24, #f59e0b)"
                        : "rgba(255,255,255,0.08)",
                      color: isCurrent ? "rgba(255,255,255,0.4)"
                        : (plan.ctaStyle === "primary" || plan.ctaStyle === "gold") ? "black"
                        : "white",
                      border: plan.ctaStyle === "secondary" ? "1px solid rgba(255,255,255,0.12)" : "none",
                    }}>
                    {loading === plan.key ? t.common.loading : isCurrent ? t.pricing.currentPlan : planT.cta}
                  </button>
                  <div className="space-y-2.5">
                    {plan.features.map((feature, i) => (
                      <div key={i} className="flex items-center gap-2.5">
                        {feature.included
                          ? <Check size={15} className="flex-shrink-0" style={{ color: plan.color }} />
                          : <X size={15} className="flex-shrink-0 text-white/15" />
                        }
                        <span className={`text-sm ${feature.included ? "text-white/70" : "text-white/25 line-through"}`}>
                          {feature.text}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Trust badges */}
        <div className="mt-8 flex flex-col md:flex-row items-center justify-center gap-6 text-center">
          {[
            { icon: <Shield size={18} className="text-green-400" />, text: t.pricing.trustBadges.moneyBack },
            { icon: <Check size={18} className="text-green-400" />, text: t.pricing.trustBadges.cancel },
            { icon: <Star size={18} className="text-green-400" />, text: t.pricing.trustBadges.secure },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-2 text-sm text-white/40">
              {item.icon}{item.text}
            </div>
          ))}
        </div>
      </div>

      {/* Comparison table */}
      <div className="border-t border-white/5 py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-black text-white text-center mb-12">{t.pricing.comparisonTitle}</h2>
          <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr]" style={{ background: "rgba(255,255,255,0.02)" }}>
              <div className="px-5 py-4 text-[10px] text-white/25 uppercase tracking-widest font-bold">Feature</div>
              {PLANS.map(plan => (
                <div key={plan.key} className="px-4 py-4 text-center">
                  <p className="text-sm font-black" style={{ color: plan.color }}>{t.pricing.plans[plan.key as keyof typeof t.pricing.plans]?.name ?? plan.key}</p>
                </div>
              ))}
            </div>
            {COMPARISON_ROWS.map((row, i) => (
              <div key={i} className="grid grid-cols-[2fr_1fr_1fr_1fr] border-t border-white/[0.04] hover:bg-white/[0.01] transition">
                <div className="px-5 py-3 text-sm text-white/50">{row.feature}</div>
                {[row.free, row.pro, row.premium].map((val, j) => (
                  <div key={j} className="px-4 py-3 text-center text-sm">
                    <span style={{
                      color: val === "✗" ? "rgba(255,255,255,0.15)"
                        : val.includes("✓") ? "#4ade80"
                        : "rgba(255,255,255,0.7)"
                    }}>{val}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Testimonials */}
      <div className="border-t border-white/5 py-16 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-black text-white text-center mb-12">{t.pricing.testimonialsTitle}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {TESTIMONIALS.map(t => (
              <div key={t.name} className="rounded-2xl p-5"
                style={{ background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="flex mb-3">
                  {[...Array(t.stars)].map((_, i) => <span key={i} className="text-yellow-400 text-sm">★</span>)}
                </div>
                <p className="text-sm text-white/55 leading-relaxed mb-4">&ldquo;{t.text}&rdquo;</p>
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black text-black"
                    style={{ background: t.color }}>
                    {t.avatar}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">{t.name}</p>
                    <p className="text-[10px] text-white/30">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* FAQ */}
      <div className="border-t border-white/5 py-16 px-6">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-black text-white text-center mb-12">{t.pricing.faqTitle}</h2>
          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <div key={i}
                className="rounded-2xl overflow-hidden cursor-pointer transition-all"
                style={{
                  background: expandedFaq === i ? "rgba(34,197,94,0.04)" : "#0a0a0a",
                  border: `1px solid ${expandedFaq === i ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.06)"}`,
                }}
                onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}>
                <div className="flex items-center justify-between px-5 py-4">
                  <p className="text-sm font-bold text-white pr-4">{faq.q}</p>
                  <span className="text-white/30 text-xl flex-shrink-0 transition-transform"
                    style={{ transform: expandedFaq === i ? "rotate(45deg)" : "rotate(0deg)" }}>+</span>
                </div>
                {expandedFaq === i && (
                  <div className="px-5 pb-4">
                    <p className="text-sm text-white/50 leading-relaxed">{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Final CTA */}
      <div className="border-t border-white/5 py-20 px-6 text-center">
        {isLoggedIn ? (
          <>
            <h2 className="text-4xl font-black text-white mb-4">
              {t.pricing.loggedInCta}
            </h2>
            <p className="text-white/40 mb-8 max-w-md mx-auto">
              {t.pricing.loggedInDesc}
            </p>
            <a href="/dashboard"
              className="inline-flex items-center gap-2 px-10 py-5 rounded-2xl text-lg font-black text-black transition-all hover:scale-[1.03]"
              style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)", boxShadow: "0 0 50px rgba(34,197,94,0.25)" }}>
              {t.pricing.backToDashboard}
            </a>
            <p className="text-xs text-white/20 mt-4">{t.pricing.trustBadges.cancel} · {t.pricing.trustBadges.secure}</p>
          </>
        ) : (
          <>
            <h2 className="text-4xl font-black text-white mb-4">
              {t.pricing.finalCta}
            </h2>
            <p className="text-white/40 mb-8 max-w-md mx-auto">
              {t.pricing.finalCtaDesc}
            </p>
            <a href="/signup"
              className="inline-flex items-center gap-2 px-10 py-5 rounded-2xl text-lg font-black text-black transition-all hover:scale-[1.03]"
              style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)", boxShadow: "0 0 50px rgba(34,197,94,0.25)" }}>
              {t.pricing.finalCtaBtn}
            </a>
            <p className="text-xs text-white/20 mt-4">{t.pricing.noCard}</p>
          </>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 px-6 text-center">
        <div className="flex items-center justify-center gap-6 flex-wrap text-xs text-white/25">
          <a href="/legal/terms" className="hover:text-white transition">Terms</a>
          <a href="/legal/privacy" className="hover:text-white transition">Privacy</a>
          <a href="/legal/cookies" className="hover:text-white transition">Cookies</a>
          <a href="/support" className="hover:text-white transition">Support</a>
          <span>© 2026 Tradex</span>
        </div>
        <p className="text-[10px] text-white/15 mt-3 max-w-lg mx-auto">
          Tradex is an educational paper trading tool. Past performance does not guarantee future results. Trading involves risk.
        </p>
      </footer>
    </div>
  )
}
