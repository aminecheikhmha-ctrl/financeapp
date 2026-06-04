"use client"

import FAQItem from "@/app/components/FAQItem"
import { useLanguage } from "@/lib/i18n/context"
import LanguagePicker from "@/app/components/LanguagePicker"

export default function HomePage() {
  const { t } = useLanguage()
  return (
    <main className="min-h-screen" style={{ background: "transparent" }}>

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden px-6 pt-24 pb-20">

        {/* Background layers */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Main radial glow */}
          <div className="absolute inset-0" style={{
            background: "radial-gradient(ellipse 90% 70% at 50% 0%, rgba(34,197,94,0.18) 0%, transparent 65%)"
          }} />
          {/* Secondary side glow */}
          <div className="absolute inset-0" style={{
            background: "radial-gradient(ellipse 50% 50% at 100% 50%, rgba(34,197,94,0.06) 0%, transparent 60%)"
          }} />
          {/* Grid lines */}
          <div className="absolute inset-0 opacity-[0.028]" style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
          }} />
        </div>

        <div className="relative max-w-4xl mx-auto text-center fade-up">

          {/* Live badge */}
          <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full mb-8"
            style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.22)" }}>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400" />
            </span>
            <span className="text-xs text-green-400 font-bold tracking-wide">AI Signals — 160+ assets scanned in real time</span>
          </div>

          {/* Headline */}
          <h1 className="text-5xl md:text-[72px] font-black text-white tracking-tight leading-[1.04] mb-6"
            style={{ letterSpacing: "-0.03em" }}>
            Trade smarter,<br />
            <span style={{
              background: "linear-gradient(135deg, #4ade80 0%, #22c55e 50%, #86efac 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}>
              not harder.
            </span>
          </h1>

          <p className="text-lg md:text-xl max-w-2xl mx-auto leading-relaxed mb-10"
            style={{ color: "rgba(255,255,255,0.42)", lineHeight: 1.7 }}>
            Real-time AI signals · Professional charts · Paper trading · Interactive academy.
            <br />
            <strong style={{ color: "rgba(255,255,255,0.72)" }}>Everything to become a profitable trader. Free.</strong>
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-16">
            <a href="/signup"
              className="btn-primary glow-cta flex items-center gap-2.5 px-8 py-4 rounded-2xl text-base font-black text-black">
              {t.home.heroCta}
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </a>
            <a href="/dashboard"
              className="flex items-center gap-2.5 px-8 py-4 rounded-2xl text-base font-bold transition-all hover:bg-white/5 active:scale-[0.98]"
              style={{ color: "rgba(255,255,255,0.65)", border: "1px solid rgba(255,255,255,0.09)" }}>
              Live demo
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full"
                style={{ background: "rgba(34,197,94,0.12)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.2)" }}>
                FREE
              </span>
            </a>
            <LanguagePicker variant="flags" />
          </div>

          {/* Social proof */}
          <div className="flex items-center justify-center gap-6 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="flex -space-x-2">
                {(["#4ade80","#60a5fa","#f97316","#a78bfa","#f87171"] as const).map((color, i) => (
                  <div key={i} className="w-8 h-8 rounded-full border-2 flex items-center justify-center text-[10px] font-black text-black"
                    style={{ background: color, borderColor: "var(--bg-canvas)", zIndex: 5 - i }}>
                    {["T","S","M","A","L"][i]}
                  </div>
                ))}
              </div>
              <div>
                <div className="flex">{[...Array(5)].map((_, i) => <span key={i} className="text-yellow-400 text-xs">★</span>)}</div>
                <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.28)" }}>Trusted by traders worldwide</p>
              </div>
            </div>
            <div className="hidden sm:block h-8 w-px" style={{ background: "rgba(255,255,255,0.08)" }} />
            {[
              { value: "160+", label: "assets scanned" },
              { value: "20+",  label: "AI indicators"  },
              { value: "100K", label: "virtual funds"  },
            ].map(stat => (
              <div key={stat.label} className="text-center">
                <p className="text-sm font-black" style={{ color: "#4ade80" }}>{stat.value}</p>
                <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.28)" }}>{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Dashboard preview */}
        <div className="relative mt-20 max-w-5xl mx-auto w-full fade-up-1">
          <div className="rounded-2xl overflow-hidden" style={{
            border: "1px solid rgba(255,255,255,0.07)",
            boxShadow: "0 60px 120px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04), 0 0 80px rgba(34,197,94,0.06)",
          }}>
            {/* Browser chrome */}
            <div className="flex items-center gap-2 px-4 py-3"
              style={{ background: "var(--bg-surface)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full" style={{ background: "rgba(239,68,68,0.55)" }} />
                <div className="w-3 h-3 rounded-full" style={{ background: "rgba(234,179,8,0.55)" }} />
                <div className="w-3 h-3 rounded-full" style={{ background: "rgba(34,197,94,0.55)" }} />
              </div>
              <div className="flex-1 flex justify-center">
                <div className="px-4 py-1 rounded-md text-[10px] font-mono"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.18)" }}>
                  tradex.io/dashboard
                </div>
              </div>
            </div>
            {/* Dashboard preview content */}
            <div className="h-80 flex" style={{ background: "transparent" }}>
              <div className="w-12 flex flex-col gap-2 p-2 pt-4" style={{ borderRight: "1px solid rgba(255,255,255,0.04)" }}>
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-6 rounded-lg" style={{ background: i === 0 ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.03)" }} />
                ))}
              </div>
              <div className="flex-1 p-4 flex flex-col gap-3">
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { v: "$189.25", c: "#4ade80",  l: "AAPL" },
                    { v: "+2.4%",   c: "#4ade80",  l: "Today" },
                    { v: "$100,000",c: "#60a5fa",  l: "Cash" },
                    { v: "82%",     c: "#fbbf24",  l: "AI score" },
                  ].map(s => (
                    <div key={s.l} className="rounded-xl p-2"
                      style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)" }}>
                      <p className="text-[8px] mb-0.5" style={{ color: "rgba(255,255,255,0.25)" }}>{s.l}</p>
                      <p className="text-sm font-black" style={{ color: s.c }}>{s.v}</p>
                    </div>
                  ))}
                </div>
                <div className="flex-1 rounded-xl overflow-hidden"
                  style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.04)" }}>
                  <svg viewBox="0 0 400 150" className="w-full h-full opacity-70" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22c55e" stopOpacity="0.35" />
                        <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path d="M0,120 L40,105 L80,90 L120,95 L160,70 L200,55 L240,42 L280,30 L320,22 L360,15 L400,8"
                      fill="none" stroke="#22c55e" strokeWidth="2" />
                    <path d="M0,120 L40,105 L80,90 L120,95 L160,70 L200,55 L240,42 L280,30 L320,22 L360,15 L400,8 L400,150 L0,150 Z"
                      fill="url(#chartGrad)" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
          {/* Glow under */}
          <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-1/2 h-10 blur-3xl rounded-full"
            style={{ background: "rgba(34,197,94,0.15)" }} />
        </div>
      </section>

      {/* ── FEATURES ─────────────────────────────────────────────────────── */}
      <section className="py-28 px-6" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-[11px] text-green-400 font-black uppercase tracking-[0.14em] mb-4">All in one platform</p>
            <h2 className="text-4xl md:text-5xl font-black text-white tracking-tight mb-4"
              style={{ letterSpacing: "-0.02em" }}>
              The most complete<br />trading platform
            </h2>
            <p className="text-base max-w-xl mx-auto" style={{ color: "rgba(255,255,255,0.38)" }}>
              Everything you need to learn, practice and trade — in one place.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { icon: "📡", title: "Real-time AI signals", desc: "20+ indicators analyzed simultaneously across 160 assets. Algorithmic confluence to filter noise.", color: "#22c55e", href: "/signaux" },
              { icon: "📊", title: "Professional charts", desc: "Candlesticks, RSI, MACD, Bollinger, EMA. Full-screen mode with AI signals overlaid in real time.", color: "#60a5fa", href: "/dashboard" },
              { icon: "🎓", title: "Interactive academy", desc: "15 structured courses, gamified quizzes, real-data simulations and a personal AI tutor.", color: "#a78bfa", href: "/apprendre" },
              { icon: "💼", title: "Paper Trading", desc: "$100,000 virtual funds. Practice without risk with automatic TP/SL and real-time P&L.", color: "#fbbf24", href: "/portfolio" },
              { icon: "🔍", title: "160+ asset screener", desc: "Stocks, crypto, ETFs and commodities with AI scoring. Find opportunities in seconds.", color: "#f97316", href: "/analyses" },
              { icon: "📰", title: "News & AI Sentiment", desc: "Real-time financial news with sentiment analysis. Fear & Greed Index and economic calendar.", color: "#ec4899", href: "/news" },
            ].map((feature, i) => (
              <a key={feature.title} href={feature.href}
                className="group card-premium rounded-2xl p-6 block"
                style={{ animationDelay: `${i * 0.06}s` }}>
                <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl mb-4 transition-transform duration-300 group-hover:scale-110"
                  style={{ background: `${feature.color}10`, border: `1px solid ${feature.color}22` }}>
                  {feature.icon}
                </div>
                <h3 className="text-sm font-black text-white mb-2 transition-colors duration-200 group-hover:text-green-400"
                  style={{ letterSpacing: "-0.01em" }}>
                  {feature.title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.38)", lineHeight: 1.65 }}>
                  {feature.desc}
                </p>
                <div className="mt-4 text-[11px] font-bold transition-colors duration-200"
                  style={{ color: feature.color, opacity: 0.6 }}>
                  Learn more →
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────────────────── */}
      <section className="py-28 px-6" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-[11px] text-green-400 font-black uppercase tracking-[0.14em] mb-4">Simple & fast</p>
            <h2 className="text-4xl font-black text-white" style={{ letterSpacing: "-0.02em" }}>
              Start in 3 minutes
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {[
              { step: "01", icon: "✍️", title: "Create your free account", desc: "Sign up in 30 seconds. No credit card. $100,000 virtual funds unlocked immediately." },
              { step: "02", icon: "📡", title: "Explore AI signals",        desc: "Our algorithm scans 160+ assets continuously. Get alerts on the best opportunities." },
              { step: "03", icon: "💹", title: "Trade and progress",        desc: "Practice paper trading, follow the academy, and track your progress in real time." },
            ].map((step, i) => (
              <div key={i} className="text-center fade-up" style={{ animationDelay: `${i * 0.1}s` }}>
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl text-2xl mb-4"
                  style={{ background: "linear-gradient(135deg, rgba(34,197,94,0.1), rgba(34,197,94,0.04))", border: "1px solid rgba(34,197,94,0.18)" }}>
                  {step.icon}
                </div>
                <div className="text-[10px] font-black uppercase tracking-[0.14em] mb-2" style={{ color: "rgba(34,197,94,0.5)" }}>
                  Step {step.step}
                </div>
                <h3 className="text-sm font-black text-white mb-2">{step.title}</h3>
                <p className="text-sm" style={{ color: "rgba(255,255,255,0.38)", lineHeight: 1.65 }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ──────────────────────────────────────────────────────── */}
      <section className="py-28 px-6" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-[11px] text-green-400 font-black uppercase tracking-[0.14em] mb-4">Transparent pricing</p>
          <h2 className="text-4xl font-black text-white mb-3" style={{ letterSpacing: "-0.02em" }}>Start for free</h2>
          <p className="mb-14 text-base" style={{ color: "rgba(255,255,255,0.38)" }}>Upgrade when you're ready. Cancel anytime.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { name: "Free", price: "€0", period: "forever", color: "#6b7280",
                features: ["3 AI signals / day", "Paper trading $100k", "Beginner courses", "Community forum", "AI Coach (5 q/day)"],
                cta: "Start for free", href: "/signup", highlight: false },
              { name: "Pro ⭐", price: "€19", period: "/month", color: "#22c55e",
                features: ["Unlimited AI signals", "160+ asset screener", "All courses (all levels)", "Unlimited alerts", "Backtest + AI scanner"],
                cta: "Go Pro", href: "/pricing", highlight: true, badge: "MOST POPULAR" },
              { name: "Premium 💎", price: "€49", period: "/month", color: "#fbbf24",
                features: ["Everything in Pro", "Public API", "Priority support 24h", "1-on-1 onboarding", "Ultra-personalized AI report"],
                cta: "Go Premium", href: "/pricing", highlight: false },
            ].map((plan, i) => (
              <div key={plan.name}
                className={`rounded-2xl p-6 relative ${plan.highlight ? "md:-mt-3 md:scale-[1.03]" : ""}`}
                style={{
                  background: plan.highlight ? "rgba(34,197,94,0.05)" : "var(--bg-surface)",
                  border: `1px solid ${plan.highlight ? "rgba(34,197,94,0.28)" : "rgba(255,255,255,0.07)"}`,
                  boxShadow: plan.highlight ? "0 0 60px rgba(34,197,94,0.10), 0 20px 40px rgba(0,0,0,0.3)" : "none",
                }}>
                {plan.highlight && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[9px] font-black text-black uppercase tracking-wider"
                    style={{ background: "#22c55e" }}>
                    {(plan as any).badge}
                  </div>
                )}
                <p className="text-sm font-bold mb-1" style={{ color: plan.color }}>{plan.name}</p>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-3xl font-black text-white">{plan.price}</span>
                  <span className="text-sm" style={{ color: "rgba(255,255,255,0.28)" }}>{plan.period}</span>
                </div>
                <div className="h-px my-4" style={{ background: "rgba(255,255,255,0.06)" }} />
                <div className="space-y-2 mb-6">
                  {plan.features.map(f => (
                    <div key={f} className="flex items-center gap-2 text-sm" style={{ color: "rgba(255,255,255,0.58)" }}>
                      <span className="text-xs" style={{ color: plan.color }}>✓</span>{f}
                    </div>
                  ))}
                </div>
                <a href={plan.href} className="block w-full py-3 rounded-xl text-sm font-black text-center transition-all hover:scale-[1.02] active:scale-[0.98]"
                  style={{
                    background: plan.highlight ? "linear-gradient(135deg, #22c55e, #16a34a)" : "rgba(255,255,255,0.05)",
                    color: plan.highlight ? "black" : "rgba(255,255,255,0.75)",
                    border: plan.highlight ? "none" : "1px solid rgba(255,255,255,0.07)",
                    boxShadow: plan.highlight ? "0 4px 20px rgba(34,197,94,0.3)" : "none",
                  }}>
                  {plan.cta}
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ─────────────────────────────────────────────────── */}
      <section className="py-28 px-6" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-[11px] text-green-400 font-black uppercase tracking-[0.14em] mb-4">Testimonials</p>
            <h2 className="text-4xl font-black text-white" style={{ letterSpacing: "-0.02em" }}>{t.home.testimonialsTitle}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { name: "Thomas M.", role: "Beginner trader",      text: "The AI signals helped me understand technical analysis by practising on real data. The academy is exceptional.", stars: 5 },
              { name: "Sarah K.",  role: "Active investor",      text: "The screener is incredible. I find opportunities I never noticed before. The value for money is unbeatable.", stars: 5 },
              { name: "Marc D.",   role: "Intermediate trader",  text: "I use Tradex every day. The price alerts and confluence signals have really improved my trades.", stars: 5 },
              { name: "Amina B.", role: "Finance student",       text: "Perfect for learning. The AI tutor answers all my questions and the simulations are very realistic.", stars: 5 },
              { name: "Pierre L.", role: "Day trader",           text: "Charts at TradingView level but integrated with AI signals. A game changer for my daily workflow.", stars: 5 },
              { name: "Julie R.",  role: "Long-term investor",   text: "The macro analyses and economic calendar are perfect for my strategy. Highly recommend the Pro plan.", stars: 5 },
            ].map((item, i) => (
              <div key={i} className="card-premium rounded-2xl p-5">
                <div className="flex mb-3">
                  {[...Array(item.stars)].map((_, j) => <span key={j} className="text-yellow-400 text-xs">★</span>)}
                </div>
                <p className="text-sm leading-relaxed mb-4" style={{ color: "rgba(255,255,255,0.55)", lineHeight: 1.65 }}>
                  &ldquo;{item.text}&rdquo;
                </p>
                <div>
                  <p className="text-sm font-bold text-white">{item.name}</p>
                  <p className="text-xs" style={{ color: "rgba(255,255,255,0.28)" }}>{item.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <section className="py-28 px-6" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <div className="max-w-2xl mx-auto">
          <h2 className="text-4xl font-black text-white text-center mb-12" style={{ letterSpacing: "-0.02em" }}>
            {t.home.faqTitle}
          </h2>
          <div className="space-y-2.5">
            {[
              { q: "Does Tradex use real market data?", a: "Yes, all data comes from Yahoo Finance in real time. Prices, changes and volumes are updated continuously during market hours." },
              { q: "What exactly is paper trading?",   a: "It's simulated trading with $100,000 virtual funds. You learn to trade without risking a single cent — perfect for beginners." },
              { q: "Are the AI signals reliable?",     a: "Our signals combine 20+ technical indicators with an algorithmic confluence score. The higher the score (>70%), the more statistically reliable the signal. They are decision-support tools, not guarantees." },
              { q: "I'm a beginner — is this for me?", a: "Absolutely! The interactive academy with 15 courses, real-data simulations and a personal AI tutor takes you from zero to active trader." },
              { q: "Can I cancel my subscription?",   a: "Yes, anytime with no commitment. Cancel from your settings in one click. You keep access until the end of the paid period." },
            ].map((faq, i) => (
              <FAQItem key={i} question={faq.q} answer={faq.a} />
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ────────────────────────────────────────────────────── */}
      <section className="py-28 px-6 text-center relative overflow-hidden"
        style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 60% 80% at 50% 100%, rgba(34,197,94,0.10) 0%, transparent 70%)" }} />
        <div className="relative max-w-xl mx-auto">
          <div className="w-16 h-16 rounded-3xl mx-auto mb-6 flex items-center justify-center text-3xl"
            style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.18)", boxShadow: "0 0 30px rgba(34,197,94,0.15)" }}>
            🚀
          </div>
          <h2 className="text-4xl md:text-5xl font-black text-white mb-4" style={{ letterSpacing: "-0.02em" }}>
            {t.home.finalCta}
          </h2>
          <p className="mb-8 text-base" style={{ color: "rgba(255,255,255,0.38)" }}>{t.home.finalCtaDesc}</p>
          <a href="/signup"
            className="btn-primary glow-cta inline-flex items-center gap-2.5 px-10 py-5 rounded-2xl text-lg font-black text-black">
            {t.home.heroCta}
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </a>
          <p className="text-[11px] mt-5" style={{ color: "rgba(255,255,255,0.18)" }}>
            ✓ No credit card &nbsp;·&nbsp; ✓ No commitment &nbsp;·&nbsp; ✓ $100k virtual funds
          </p>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────────── */}
      <footer style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }} className="py-14 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm"
                  style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)", color: "black", boxShadow: "0 0 16px rgba(34,197,94,0.3)" }}>
                  T
                </div>
                <span className="font-bold text-white">Tradex</span>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.28)", lineHeight: 1.7 }}>
                Smart trading with AI. Signals, analysis and academy for all traders.
              </p>
            </div>
            {[
              { title: "Product", links: [{ label: "Dashboard", href: "/dashboard" }, { label: "Signals", href: "/signaux" }, { label: "Analysis", href: "/analyses" }, { label: "Academy", href: "/apprendre" }, { label: "Blog", href: "/blog" }] },
              { title: "Account", links: [{ label: "Sign up", href: "/signup" }, { label: "Log in", href: "/login" }, { label: "Pricing", href: "/pricing" }] },
              { title: "Legal",   links: [{ label: "Privacy", href: "/legal/privacy" }, { label: "Terms", href: "/legal/terms" }, { label: "Legal notice", href: "/legal/mentions" }] },
            ].map(col => (
              <div key={col.title}>
                <p className="text-[10px] uppercase tracking-[0.12em] font-bold mb-3" style={{ color: "rgba(255,255,255,0.2)" }}>{col.title}</p>
                <div className="space-y-2.5">
                  {col.links.map(link => (
                    <a key={link.label} href={link.href}
                      className="block text-sm transition-colors hover:text-white"
                      style={{ color: "rgba(255,255,255,0.38)" }}>
                      {link.label}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between flex-wrap gap-4"
            style={{ borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "1.5rem" }}>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.18)" }}>© 2026 Tradex. All rights reserved.</p>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.12)" }}>⚠️ Tradex is an educational tool. Trading involves risk.</p>
          </div>
        </div>
      </footer>

    </main>
  )
}
