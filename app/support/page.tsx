"use client"
import { useState } from "react"
import { MessageSquare, Mail, BookOpen, ChevronRight } from "lucide-react"
import TradexLogo from "@/app/components/TradexLogo"

const SUPPORT_TOPICS = [
  { icon: "🔑", title: "Connexion / Compte", desc: "Problème de login, mot de passe oublié, email de confirmation" },
  { icon: "💳", title: "Paiement / Abonnement", desc: "Facturation, annulation, remboursement" },
  { icon: "📡", title: "Signaux IA", desc: "Comment fonctionnent les signaux, confluence, indicateurs" },
  { icon: "💼", title: "Paper Trading", desc: "Ordres, positions, P&L, TP/SL" },
  { icon: "🎓", title: "Académie", desc: "Cours, quiz, certificats, progression" },
  { icon: "🐛", title: "Bug / Problème technique", desc: "Une fonctionnalité ne marche pas" },
]

const FAQ_SUPPORT = [
  {
    q: "Je n'ai pas reçu mon email de confirmation",
    a: "Vérifie tes spams. Si tu ne le trouves pas, va sur la page de connexion et clique 'Renvoyer l'email de confirmation'.",
  },
  {
    q: "Comment annuler mon abonnement ?",
    a: "Va dans Paramètres → Abonnement → Annuler. L'accès reste actif jusqu'à la fin de la période payée.",
  },
  {
    q: "Mes signaux ne s'affichent pas",
    a: "Les signaux sont recalculés toutes les heures. Si le problème persiste, rafraîchis la page ou vide le cache du navigateur.",
  },
  {
    q: "Comment réinitialiser mon portfolio ?",
    a: "Paramètres → Trading → Réinitialiser le portfolio. Cette action est irréversible.",
  },
  {
    q: "L'app est-elle disponible sur iPhone/Android ?",
    a: "Tradex est une PWA installable. Sur iPhone : ouvre dans Safari → Partager → Sur l'écran d'accueil. Sur Android : menu → Installer l'app.",
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
    <div className="min-h-screen" style={{ background: "#050505" }}>

      {/* Header */}
      <div className="border-b border-white/5 px-6 py-4 flex items-center justify-between">
        <a href="/"><TradexLogo size={28} showText textSize="sm" /></a>
        <a href="/dashboard" className="text-sm text-white/40 hover:text-white transition">← Dashboard</a>
      </div>

      {/* Hero */}
      <div className="text-center px-6 py-12">
        <h1 className="text-3xl font-black text-white mb-2">Centre d&apos;aide Tradex</h1>
        <p className="text-white/40">Comment pouvons-nous t&apos;aider ?</p>
      </div>

      <div className="max-w-4xl mx-auto px-6 pb-16">

        {/* Support channels */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
          {[
            {
              icon: <MessageSquare size={24} className="text-green-400" />,
              title: "Coach IA",
              desc: "Répond à tes questions de trading 24h/7j",
              cta: "Ouvrir le Coach",
              href: "/coach",
              color: "#22c55e",
            },
            {
              icon: <BookOpen size={24} className="text-blue-400" />,
              title: "Documentation",
              desc: "Guides et tutoriels pour chaque fonctionnalité",
              cta: "Voir les guides",
              href: "/apprendre",
              color: "#60a5fa",
            },
            {
              icon: <Mail size={24} className="text-purple-400" />,
              title: "Email support",
              desc: "Réponse sous 24h · support@tradex.io",
              cta: "Envoyer un email",
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
          <h2 className="text-xl font-black text-white mb-6">Questions fréquentes</h2>
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
          <h2 className="text-xl font-black text-white mb-6">Envoyer un message</h2>

          {sent ? (
            <div className="text-center py-8">
              <p className="text-4xl mb-3">✅</p>
              <p className="font-bold text-white mb-1">Message envoyé !</p>
              <p className="text-white/40 text-sm">Nous te répondrons sous 24h à l&apos;adresse fournie.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Topic */}
              <div>
                <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Sujet</p>
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
                <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Ton email</p>
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
                  placeholder="Décris ton problème en détail..."
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
                {sending ? "⏳ Envoi en cours..." : "📩 Envoyer"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
