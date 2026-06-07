"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"

type ReferralData = {
  code: string
  referrals: { email: string; created_at: string; plan: string }[]
  rewards_earned: number
  pending_rewards: number
}

export default function ReferralPage() {
  const router  = useRouter()
  const [data,    setData]    = useState<ReferralData | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied,  setCopied]  = useState(false)
  const [token,   setToken]   = useState("")

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/login"); return }
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return
      setToken(session.access_token)
      const res = await fetch("/api/referral", {
        headers: { Authorization: `Bearer ${session.access_token}` }
      })
      const json = await res.json()
      setData({
        code: json.code ?? "TRADEX",
        referrals: json.referrals ?? [],
        rewards_earned: json.rewards_earned ?? 0,
        pending_rewards: json.pending_rewards ?? 0,
      })
      setLoading(false)
    }
    init()
  }, [])

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://tradex-kappa-six.vercel.app"
  const referralLink = `${baseUrl}/signup?ref=${data?.code}`

  function copyLink() {
    navigator.clipboard.writeText(referralLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const tweetText = encodeURIComponent(
    `Je trade sur Tradex — signaux IA, paper trading et académie complète gratuitement 🚀\n\nRejoint avec mon lien et on gagne tous les deux 1 mois Pro :\n${referralLink}\n\n#Trading #Tradex #FinancePersonnelle`
  )

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-green-400/30 border-t-green-400 rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen page-enter">
      <div className="max-w-2xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-3xl mx-auto mb-4 flex items-center justify-center text-3xl"
            style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)" }}>
            🎁
          </div>
          <p className="text-xs font-black text-green-400 uppercase tracking-widest mb-2">Programme de parrainage</p>
          <h1 className="text-3xl font-black text-white mb-2">Invite et gagne</h1>
          <p className="text-white/40 text-sm max-w-sm mx-auto">
            Invite un ami → vous obtenez <strong className="text-green-400">tous les deux 1 mois Pro offert</strong> dès qu'il crée un compte.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: "Amis invités", value: String(data?.referrals.length ?? 0), color: "#4ade80" },
            { label: "Mois gagnés", value: String(data?.rewards_earned ?? 0), color: "#fbbf24" },
            { label: "En attente", value: String(data?.pending_rewards ?? 0), color: "#60a5fa" },
          ].map(s => (
            <div key={s.label} className="rounded-2xl p-4 text-center"
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border-dim)" }}>
              <p className="text-2xl font-black tabular-nums" style={{ color: s.color }}>{s.value}</p>
              <p className="text-xs text-white/30 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Referral link */}
        <div className="rounded-2xl p-5 mb-4" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-dim)" }}>
          <p className="text-xs font-bold text-white/30 uppercase tracking-widest mb-3">Ton lien de parrainage</p>
          <div className="flex gap-2 mb-3">
            <div className="flex-1 px-3 py-2.5 rounded-xl text-sm font-mono text-green-400 truncate"
              style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.2)" }}>
              {referralLink}
            </div>
            <button onClick={copyLink}
              className="px-4 py-2.5 rounded-xl text-xs font-black transition-all hover:scale-[1.02]"
              style={{ background: copied ? "rgba(34,197,94,0.2)" : "rgba(34,197,94,0.12)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.25)" }}>
              {copied ? "✓ Copié" : "Copier"}
            </button>
          </div>

          <div className="flex items-center gap-2 mb-3">
            <div className="h-px flex-1" style={{ background: "rgba(255,255,255,0.06)" }} />
            <span className="text-xs text-white/20">ou partager sur</span>
            <div className="h-px flex-1" style={{ background: "rgba(255,255,255,0.06)" }} />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <a href={`https://twitter.com/intent/tweet?text=${tweetText}`} target="_blank" rel="noopener"
              className="py-2.5 rounded-xl text-xs font-black text-center transition-all hover:scale-[1.02]"
              style={{ background: "rgba(29,161,242,0.1)", border: "1px solid rgba(29,161,242,0.25)", color: "#1da1f2" }}>
              𝕏 Twitter
            </a>
            <a href={`https://wa.me/?text=${encodeURIComponent(`Rejoins Tradex avec mon lien et on gagne 1 mois Pro offert ! ${referralLink}`)}`} target="_blank" rel="noopener"
              className="py-2.5 rounded-xl text-xs font-black text-center transition-all hover:scale-[1.02]"
              style={{ background: "rgba(37,211,102,0.1)", border: "1px solid rgba(37,211,102,0.25)", color: "#25d366" }}>
              WhatsApp
            </a>
            <a href={`https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent("Rejoins Tradex ! Signaux IA gratuits 🚀")}`} target="_blank" rel="noopener"
              className="py-2.5 rounded-xl text-xs font-black text-center transition-all hover:scale-[1.02]"
              style={{ background: "rgba(0,136,204,0.1)", border: "1px solid rgba(0,136,204,0.25)", color: "#0088cc" }}>
              Telegram
            </a>
          </div>
        </div>

        {/* Code seul */}
        <div className="rounded-2xl p-4 mb-6 text-center" style={{ background: "rgba(34,197,94,0.05)", border: "1px solid rgba(34,197,94,0.15)" }}>
          <p className="text-xs text-white/30 mb-1">Ton code parrainage</p>
          <p className="text-3xl font-black tracking-[0.2em] text-green-400">{data?.code}</p>
        </div>

        {/* Comment ça marche */}
        <div className="rounded-2xl p-5 mb-6" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-dim)" }}>
          <p className="text-xs font-black text-white/30 uppercase tracking-widest mb-4">Comment ça marche</p>
          <div className="space-y-3">
            {[
              { step: "1", text: "Partage ton lien ou ton code avec un ami", icon: "🔗" },
              { step: "2", text: "Il crée son compte Tradex gratuitement", icon: "✍️" },
              { step: "3", text: "Vous obtenez tous les deux 1 mois Pro offert", icon: "🎁" },
            ].map(s => (
              <div key={s.step} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-xl flex items-center justify-center text-xs font-black flex-shrink-0"
                  style={{ background: "rgba(34,197,94,0.12)", color: "#4ade80" }}>{s.step}</div>
                <span className="text-sm">{s.icon}</span>
                <p className="text-sm text-white/60">{s.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Referrals list */}
        {(data?.referrals.length ?? 0) > 0 && (
          <div className="rounded-2xl p-5" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-dim)" }}>
            <p className="text-xs font-black text-white/30 uppercase tracking-widest mb-3">Amis parrainés</p>
            <div className="space-y-2">
              {data!.referrals.map((r, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black text-black"
                      style={{ background: "#22c55e" }}>
                      {r.email[0].toUpperCase()}
                    </div>
                    <p className="text-sm text-white/60">{r.email.split("@")[0]}…</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-green-400">{r.plan === "free" ? "Inscrit" : "Pro"}</p>
                    <p className="text-[10px] text-white/25">{new Date(r.created_at).toLocaleDateString("fr-FR")}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
