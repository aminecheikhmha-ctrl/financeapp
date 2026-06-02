"use client"

import FAQItem from "@/app/components/FAQItem"
import { useLanguage } from "@/lib/i18n/context"
import LanguagePicker from "@/app/components/LanguagePicker"

export default function HomePage() {
  const { t } = useLanguage()
  return (
    <main style={{ background: "#050505", minHeight: "100vh" }}>
      {/* SECTION 1 — HERO */}
      <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden px-6 pt-24 pb-20">
        {/* Background */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 80% 60% at 50% 40%, rgba(34,197,94,0.08) 0%, transparent 70%)" }} />
          <div className="absolute inset-0 opacity-[0.025]" style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }} />
        </div>

        {/* Hero content */}
        <div className="relative max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-8"
            style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400" />
            </span>
            <span className="text-xs text-green-400 font-bold">🚀 NEW — AI Signals with algorithmic confluence</span>
          </div>

          {/* Title */}
          <h1 className="text-5xl md:text-7xl font-black text-white tracking-tight leading-[1.05] mb-6">
            Trade smarter<br/>not harder
            <span className="block mt-2" style={{
              background: "linear-gradient(135deg, #4ade80, #22c55e, #86efac)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}>
              with AI
            </span>
          </h1>

          <p className="text-lg md:text-xl max-w-2xl mx-auto leading-relaxed mb-10" style={{ color: "rgba(255,255,255,0.4)" }}>
            Real-time trading signals · AI analysis · Professional charts · Interactive academy.
            <strong style={{ color: "rgba(255,255,255,0.7)" }}> Everything you need to trade like a pro.</strong>
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-16">
            <a href="/signup" className="group relative flex items-center gap-2.5 px-8 py-4 rounded-2xl text-base font-black text-black transition-all hover:scale-[1.03] active:scale-[0.98]"
              style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)", boxShadow: "0 0 40px rgba(34,197,94,0.3), 0 4px 20px rgba(0,0,0,0.3)" }}>
              {t.home.heroCta}
            </a>
            <a href="/dashboard" className="flex items-center gap-2.5 px-8 py-4 rounded-2xl text-base font-bold transition-all hover:bg-white/5"
              style={{ color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.10)" }}>
              {t.home.heroLogin} <span className="text-green-400 text-xs font-black ml-1">DEMO</span>
            </a>
            <LanguagePicker variant="flags" />
          </div>

          {/* Social proof */}
          <div className="flex items-center justify-center gap-6 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2">
                {(["#4ade80","#60a5fa","#f97316","#a78bfa","#f87171"] as const).map((color, i) => (
                  <div key={i} className="w-8 h-8 rounded-full border-2 flex items-center justify-center text-[11px] font-black text-black"
                    style={{ background: color, borderColor: "#050505", zIndex: 5 - i }}>
                    {["T","S","M","A","L"][i]}
                  </div>
                ))}
              </div>
              <div>
                <div className="flex">{[...Array(5)].map((_, i) => <span key={i} className="text-yellow-400 text-xs">★</span>)}</div>
                <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.3)" }}>+10,000 active traders</p>
              </div>
            </div>
            <div className="hidden sm:block h-8 w-px" style={{ background: "rgba(255,255,255,0.1)" }} />
            {[
              { value: "160+", label: "assets scanned" },
              { value: "20+", label: "AI indicators" },
              { value: "98%", label: "satisfaction" },
            ].map(stat => (
              <div key={stat.label} className="text-center">
                <p className="text-sm font-black text-white">{stat.value}</p>
                <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Dashboard mockup */}
        <div className="relative mt-20 max-w-5xl mx-auto w-full">
          <div className="rounded-2xl overflow-hidden" style={{
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 40px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)",
          }}>
            {/* Browser chrome */}
            <div className="flex items-center gap-2 px-4 py-3" style={{ background: "#0a0a0a", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full" style={{ background: "rgba(239,68,68,0.6)" }} />
                <div className="w-3 h-3 rounded-full" style={{ background: "rgba(234,179,8,0.6)" }} />
                <div className="w-3 h-3 rounded-full" style={{ background: "rgba(34,197,94,0.6)" }} />
              </div>
              <div className="flex-1 flex justify-center">
                <div className="px-4 py-1 rounded-lg text-[11px] font-mono" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.2)" }}>
                  tradex.io/dashboard
                </div>
              </div>
            </div>
            {/* Dashboard preview */}
            <div className="h-80 flex" style={{ background: "#080808" }}>
              <div className="w-12 flex flex-col gap-2 p-2 pt-4" style={{ borderRight: "1px solid rgba(255,255,255,0.05)" }}>
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-6 rounded-lg" style={{ background: i === 0 ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.04)" }} />
                ))}
              </div>
              <div className="flex-1 p-4 flex flex-col gap-3">
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { v: "$189.25", c: "#4ade80", l: "AAPL" },
                    { v: "+2.4%", c: "#4ade80", l: "Variation" },
                    { v: "$100,000", c: "#60a5fa", l: "Cash" },
                    { v: "82%", c: "#fbbf24", l: "Confluence" },
                  ].map(s => (
                    <div key={s.l} className="rounded-xl p-2" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                      <p className="text-[8px] mb-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>{s.l}</p>
                      <p className="text-sm font-black" style={{ color: s.c }}>{s.v}</p>
                    </div>
                  ))}
                </div>
                <div className="flex-1 rounded-xl overflow-hidden" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <svg viewBox="0 0 400 150" className="w-full h-full opacity-60" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22c55e" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path d="M0,120 L40,105 L80,90 L120,95 L160,70 L200,55 L240,42 L280,30 L320,22 L360,15 L400,8" fill="none" stroke="#22c55e" strokeWidth="2" />
                    <path d="M0,120 L40,105 L80,90 L120,95 L160,70 L200,55 L240,42 L280,30 L320,22 L360,15 L400,8 L400,150 L0,150 Z" fill="url(#chartGrad)" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-2/3 h-12 blur-2xl rounded-full" style={{ background: "rgba(34,197,94,0.12)" }} />
        </div>
      </section>

      {/* SECTION 2 — Features */}
      <section className="py-24 px-6" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs text-green-400 font-black uppercase tracking-widest mb-3">All in one</p>
            <h2 className="text-4xl md:text-5xl font-black text-white tracking-tight">
              The most complete<br/>trading platform
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: "📡", title: "Real-time AI signals", desc: "20+ indicators analyzed simultaneously across 160 assets. Algorithmic confluence to filter false signals.", color: "#22c55e", href: "/signaux" },
              { icon: "📊", title: "Professional charts", desc: "Candlesticks, RSI, MACD, Bollinger, EMA. Full-screen mode with AI signals overlaid.", color: "#60a5fa", href: "/dashboard" },
              { icon: "🎓", title: "Interactive academy", desc: "15 courses with real-data simulations, gamified quizzes, personal AI tutor and certificates.", color: "#a78bfa", href: "/apprendre" },
              { icon: "💼", title: "Paper Trading", desc: "$100,000 virtual funds to practice without risk. Automatic TP/SL, trade history, real-time P&L.", color: "#fbbf24", href: "/portfolio" },
              { icon: "🔍", title: "160+ asset screener", desc: "Scan stocks, crypto, ETFs and commodities with AI scoring. Find the best opportunities in seconds.", color: "#f97316", href: "/analyses" },
              { icon: "📰", title: "News & AI Sentiment", desc: "Real-time financial news with sentiment analysis. Fear & Greed Index and economic calendar.", color: "#ec4899", href: "/news" },
            ].map(feature => (
              <a key={feature.title} href={feature.href} className="group rounded-2xl p-6 transition-all hover:scale-[1.02]"
                style={{ background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl mb-4 transition-transform group-hover:scale-110"
                  style={{ background: `${feature.color}12`, border: `1px solid ${feature.color}20` }}>
                  {feature.icon}
                </div>
                <h3 className="text-base font-black text-white mb-2 group-hover:text-green-400 transition-colors">{feature.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.4)" }}>{feature.desc}</p>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 3 — Steps */}
      <section className="py-24 px-6" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs text-green-400 font-black uppercase tracking-widest mb-3">Simple & fast</p>
            <h2 className="text-4xl font-black text-white">Get started in 3 minutes</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { step: "01", icon: "✍️", title: "Create your free account", desc: "Sign up in 30 seconds. No credit card required. You get $100,000 virtual funds immediately." },
              { step: "02", icon: "📡", title: "Check the AI signals", desc: "Our algorithm scans 160+ assets continuously. Get alerts on the best opportunities." },
              { step: "03", icon: "💹", title: "Trade and learn", desc: "Practice with our paper trading, follow the academy, and become a profitable trader." },
            ].map((step, i) => (
              <div key={i} className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl text-3xl mb-4"
                  style={{ background: "linear-gradient(135deg, rgba(34,197,94,0.1), rgba(34,197,94,0.05))", border: "1px solid rgba(34,197,94,0.2)" }}>
                  {step.icon}
                </div>
                <div className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: "rgba(34,197,94,0.5)" }}>{step.step}</div>
                <h3 className="text-base font-black text-white mb-2">{step.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.4)" }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 4 — Pricing */}
      <section className="py-24 px-6" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-xs text-green-400 font-black uppercase tracking-widest mb-3">Transparent pricing</p>
          <h2 className="text-4xl font-black text-white mb-4">Start for free</h2>
          <p className="mb-12" style={{ color: "rgba(255,255,255,0.4)" }}>Upgrade when you're ready. Cancel anytime.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              { name: "Free", price: "€0", period: "forever", color: "#6b7280", features: ["5 assets in watchlist", "3 AI signals / day", "Paper trading $10,000", "Beginner courses", "Community forum"], cta: "Start for free", href: "/signup", highlight: false },
              { name: "Pro ⭐", price: "€19", period: "/month", color: "#22c55e", features: ["Unlimited AI signals", "Paper trading $100,000", "10 price alerts", "Full academy (15 courses)", "Pro charts + 20 indicators", "Priority support"], cta: "Go Pro", href: "/pricing", highlight: true },
              { name: "Premium 💎", price: "€49", period: "/month", color: "#fbbf24", features: ["Everything in Pro", "160-asset screener real-time", "Unlimited price alerts", "API access", "1h coaching / month", "Priority support 7/7"], cta: "Go Premium", href: "/pricing", highlight: false },
            ].map(plan => (
              <div key={plan.name} className={`rounded-2xl p-6 relative ${plan.highlight ? "scale-105" : ""}`}
                style={{
                  background: plan.highlight ? "rgba(34,197,94,0.06)" : "#0a0a0a",
                  border: `1px solid ${plan.highlight ? "rgba(34,197,94,0.25)" : "rgba(255,255,255,0.06)"}`,
                  boxShadow: plan.highlight ? "0 0 40px rgba(34,197,94,0.08)" : "none",
                }}>
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[10px] font-black text-black" style={{ background: "#22c55e" }}>
                    LE PLUS POPULAIRE
                  </div>
                )}
                <p className="text-sm font-bold mb-1" style={{ color: plan.color }}>{plan.name}</p>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-3xl font-black text-white">{plan.price}</span>
                  <span className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>{plan.period}</span>
                </div>
                <div className="h-px my-4" style={{ background: "rgba(255,255,255,0.06)" }} />
                <div className="space-y-2 mb-6">
                  {plan.features.map(f => (
                    <div key={f} className="flex items-center gap-2 text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>
                      <span style={{ color: plan.color }}>✓</span>{f}
                    </div>
                  ))}
                </div>
                <a href={plan.href} className="block w-full py-3 rounded-xl text-sm font-black text-center transition-all hover:scale-[1.02]"
                  style={{
                    background: plan.highlight ? "#22c55e" : "rgba(255,255,255,0.06)",
                    color: plan.highlight ? "black" : "white",
                    border: plan.highlight ? "none" : "1px solid rgba(255,255,255,0.08)",
                  }}>
                  {plan.cta}
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 5 — Témoignages */}
      <section className="py-24 px-6" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs text-green-400 font-black uppercase tracking-widest mb-3">Testimonials</p>
            <h2 className="text-4xl font-black text-white">{t.home.testimonialsTitle}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              { name: "Thomas M.", role: "Beginner trader", text: "The AI signals helped me understand technical analysis by practicing on real data. The academy is exceptional.", stars: 5 },
              { name: "Sarah K.", role: "Active investor", text: "The screener is incredible. I find opportunities I never noticed before. The value for money is unbeatable.", stars: 5 },
              { name: "Marc D.", role: "Intermediate trader", text: "I use Tradex every day. The price alerts and confluence signals have really helped me improve my trades.", stars: 5 },
              { name: "Amina B.", role: "Finance student", text: "Perfect for learning. The AI tutor answers all my questions and the simulations are very realistic.", stars: 5 },
              { name: "Pierre L.", role: "Day trader", text: "The charts are TradingView-level but integrated with AI signals. A game changer for my daily workflow.", stars: 5 },
              { name: "Julie R.", role: "Long-term investor", text: "I started on the free plan and upgraded quickly. The macro analyses and economic calendar are perfect for my strategy.", stars: 5 },
            ].map((t, i) => (
              <div key={i} className="rounded-2xl p-5" style={{ background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="flex mb-3">{[...Array(t.stars)].map((_, j) => <span key={j} className="text-yellow-400 text-sm">★</span>)}</div>
                <p className="text-sm leading-relaxed mb-4" style={{ color: "rgba(255,255,255,0.6)" }}>"{t.text}"</p>
                <div>
                  <p className="text-sm font-bold text-white">{t.name}</p>
                  <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 6 — FAQ */}
      <section className="py-24 px-6" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <div className="max-w-2xl mx-auto">
          <h2 className="text-4xl font-black text-white text-center mb-12">{t.home.faqTitle}</h2>
          <div className="space-y-3">
            {[
              { q: "Does Tradex use real market data?", a: "Yes, all data comes from Yahoo Finance in real time. Prices, changes and volumes are updated continuously." },
              { q: "What exactly is paper trading?", a: "It's simulated trading with $100,000 virtual funds. You learn to trade without risking a single cent. Perfect for beginners or testing new strategies." },
              { q: "Are the AI signals reliable?", a: "Our signals combine 20+ technical indicators with an algorithmic confluence score. The higher the confluence, the more reliable the signal." },
              { q: "I'm a beginner — is this for me?", a: "Absolutely! The interactive academy with 15 courses, real-data simulations and a personal AI tutor takes you from zero to active trader." },
              { q: "Can I cancel my subscription at any time?", a: "Yes, with no commitment. You can cancel from your profile in one click. No questions asked." },
            ].map((faq, i) => (
              <FAQItem key={i} question={faq.q} answer={faq.a} />
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 7 — CTA final */}
      <section className="py-24 px-6 text-center" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <div className="max-w-xl mx-auto">
          <div className="w-16 h-16 rounded-3xl mx-auto mb-6 flex items-center justify-center text-3xl"
            style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)" }}>
            🚀
          </div>
          <h2 className="text-4xl font-black text-white mb-4">{t.home.finalCta}</h2>
          <p className="mb-8" style={{ color: "rgba(255,255,255,0.4)" }}>{t.home.finalCtaDesc}</p>
          <a href="/signup" className="inline-flex items-center gap-2 px-10 py-5 rounded-2xl text-lg font-black text-black transition-all hover:scale-[1.03] active:scale-[0.98]"
            style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)", boxShadow: "0 0 60px rgba(34,197,94,0.3)" }}>
            {t.home.heroCta}
          </a>
          <p className="text-xs mt-4" style={{ color: "rgba(255,255,255,0.2)" }}>
            {t.home.footerRisk}
          </p>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }} className="py-12 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm" style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)", color: "black", boxShadow: "0 0 12px rgba(34,197,94,0.3)" }}>T</div>
                <span className="font-bold text-white">Tradex</span>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.3)" }}>Smart trading with AI. Signals, analysis and academy for all traders.</p>
            </div>
            {[
              { title: "Product", links: [{ label: "Dashboard", href: "/dashboard" }, { label: "Signals", href: "/signaux" }, { label: "Analysis", href: "/analyses" }, { label: "Academy", href: "/apprendre" }, { label: "Blog", href: "/blog" }] },
              { title: "Account", links: [{ label: "Sign up", href: "/signup" }, { label: "Log in", href: "/login" }, { label: "Pricing", href: "/pricing" }] },
              { title: "Legal", links: [{ label: "Privacy", href: "/legal/privacy" }, { label: "Terms", href: "/legal/terms" }, { label: "Legal notice", href: "/legal/mentions" }] },
            ].map(col => (
              <div key={col.title}>
                <p className="text-[10px] uppercase tracking-widest font-bold mb-3" style={{ color: "rgba(255,255,255,0.25)" }}>{col.title}</p>
                <div className="space-y-2">
                  {col.links.map(link => (
                    <a key={link.label} href={link.href} className="block text-sm transition-colors hover:text-white" style={{ color: "rgba(255,255,255,0.4)" }}>{link.label}</a>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between flex-wrap gap-4" style={{ borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "1.5rem" }}>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>© 2026 Tradex. All rights reserved.</p>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.15)" }}>⚠️ Trading involves risk. Tradex is an educational tool, not a financial advisor.</p>
          </div>
        </div>
      </footer>
    </main>
  )
}
