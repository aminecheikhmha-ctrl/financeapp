"use client"
import { useState } from "react"
import { MessageSquare, Mail, BookOpen, ChevronRight } from "lucide-react"
import TradexLogo from "@/app/components/TradexLogo"

const SUPPORT_TOPICS = [
  { icon: "🔑", title: "Login / Account", desc: "Login issue, forgotten password, confirmation email" },
  { icon: "💳", title: "Payment / Subscription", desc: "Billing, cancellation, refund" },
  { icon: "📡", title: "AI Signals", desc: "How signals work, confluence, indicators" },
  { icon: "💼", title: "Paper Trading", desc: "Orders, positions, P&L, TP/SL" },
  { icon: "🎓", title: "Academy", desc: "Courses, quizzes, certificates, progress" },
  { icon: "🐛", title: "Bug / Technical issue", desc: "A feature is not working" },
]

const FAQ_SUPPORT = [
  {
    q: "I didn't receive my confirmation email",
    a: "Check your spam folder. If you can't find it, go to the login page and click 'Resend confirmation email'.",
  },
  {
    q: "How do I cancel my subscription?",
    a: "Go to Settings → Subscription → Cancel. Access remains active until the end of the paid period.",
  },
  {
    q: "My signals are not showing",
    a: "Signals are recalculated every hour. If the issue persists, refresh the page or clear your browser cache.",
  },
  {
    q: "How do I reset my portfolio?",
    a: "Settings → Trading → Reset portfolio. This action is irreversible.",
  },
  {
    q: "Is the app available on iPhone/Android?",
    a: "Tradex is an installable PWA. On iPhone: open in Safari → Share → Add to Home Screen. On Android: menu → Install app.",
  },
]

export default function SupportPage() {
  const [selectedTopic, setSelectedTopic] = useState("")
  const [message, setMessage] = useState("")
  const [email, setEmail] = useState("")
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null)

  async function sendSupport() {
    if (!message || !email) return
    setSending(true)
    try {
      await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: selectedTopic, message, email }),
      })
      setSent(true)
    } catch (e) {
      console.error(e)
    }
    setSending(false)
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-canvas)" }}>

      {/* Header */}
      <div className="border-b border-white/5 px-6 py-4 flex items-center justify-between">
        <a href="/"><TradexLogo size={28} showText textSize="sm" /></a>
        <a href="/dashboard" className="text-sm text-white/40 hover:text-white transition">← Dashboard</a>
      </div>

      {/* Hero */}
      <div className="text-center px-6 py-12">
        <h1 className="text-3xl font-black text-white mb-2">Tradex Help Center</h1>
        <p className="text-white/40">How can we help you?</p>
      </div>

      <div className="max-w-4xl mx-auto px-6 pb-16">

        {/* Support channels */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
          {[
            {
              icon: <MessageSquare size={24} className="text-green-400" />,
              title: "AI Coach",
              desc: "Answers your trading questions 24/7",
              cta: "Open Coach",
              href: "/coach",
              color: "#22c55e",
            },
            {
              icon: <BookOpen size={24} className="text-blue-400" />,
              title: "Documentation",
              desc: "Guides and tutorials for every feature",
              cta: "View guides",
              href: "/apprendre",
              color: "#60a5fa",
            },
            {
              icon: <Mail size={24} className="text-purple-400" />,
              title: "Email support",
              desc: "Response within 24h · support@tradex.io",
              cta: "Send an email",
              href: "mailto:support@tradex.io",
              color: "#a78bfa",
            },
          ].map(channel => (
            <a key={channel.title} href={channel.href}
              className="rounded-2xl p-5 transition-all"
              style={{ background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="mb-3">{channel.icon}</div>
              <h3 className="font-black text-white mb-1">{channel.title}</h3>
              <p className="text-xs text-white/40 mb-3">{channel.desc}</p>
              <span className="text-xs font-bold" style={{ color: channel.color }}>
                {channel.cta} →
              </span>
            </a>
          ))}
        </div>

        {/* FAQ */}
        <div className="mb-12">
          <h2 className="text-xl font-black text-white mb-6">Frequently asked questions</h2>
          <div className="space-y-2">
            {FAQ_SUPPORT.map((faq, i) => (
              <div key={i}
                className="rounded-2xl cursor-pointer transition-all"
                style={{
                  background: expandedFaq === i ? "rgba(34,197,94,0.04)" : "#0a0a0a",
                  border: `1px solid ${expandedFaq === i ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.06)"}`,
                }}
                onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}>
                <div className="flex items-center justify-between px-5 py-4">
                  <p className="text-sm font-bold text-white">{faq.q}</p>
                  <ChevronRight size={16} className="text-white/30 flex-shrink-0 transition-transform"
                    style={{ transform: expandedFaq === i ? "rotate(90deg)" : "rotate(0deg)" }} />
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

        {/* Contact form */}
        <div className="rounded-2xl p-6" style={{ background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.06)" }}>
          <h2 className="text-xl font-black text-white mb-6">Send a message</h2>

          {sent ? (
            <div className="text-center py-8">
              <p className="text-4xl mb-3">✅</p>
              <p className="font-bold text-white mb-1">Message sent!</p>
              <p className="text-white/40 text-sm">We&apos;ll reply within 24h to the address provided.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Topic */}
              <div>
                <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Subject</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {SUPPORT_TOPICS.map(topic => (
                    <button key={topic.title}
                      onClick={() => setSelectedTopic(topic.title)}
                      className="flex items-center gap-2 p-2.5 rounded-xl text-left transition-all"
                      style={{
                        background: selectedTopic === topic.title ? "rgba(34,197,94,0.08)" : "rgba(255,255,255,0.03)",
                        border: `1px solid ${selectedTopic === topic.title ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.06)"}`,
                      }}>
                      <span className="text-lg flex-shrink-0">{topic.icon}</span>
                      <span className="text-xs font-semibold text-white/60">{topic.title}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Email */}
              <div>
                <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Your email</p>
                <input
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  type="email"
                  placeholder="ton@email.com"
                  className="input w-full"
                />
              </div>

              {/* Message */}
              <div>
                <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Message</p>
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="Describe your issue in detail..."
                  rows={5}
                  className="w-full px-3 py-2.5 rounded-xl text-sm text-white placeholder-white/20 outline-none resize-none"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.10)",
                    fontFamily: "inherit",
                  }}
                />
              </div>

              <button
                onClick={sendSupport}
                disabled={!message || !email || sending}
                className="w-full py-3 rounded-xl font-black text-sm text-black disabled:opacity-40 transition-all hover:scale-[1.01]"
                style={{ background: "#22c55e" }}>
                {sending ? "⏳ Sending..." : "📩 Send"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
