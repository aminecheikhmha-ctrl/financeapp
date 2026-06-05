"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense } from "react"

type Duel = {
  id: string
  challenger_username: string
  opponent_username?: string
  challenger_pnl_pct: number
  opponent_pnl_pct?: number
  duration_days: number
  start_date: string
  end_date: string
  status: "pending" | "active" | "finished"
  winner?: string
}

function DuelContent() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const [user,    setUser]    = useState<any>(null)
  const [duels,   setDuels]   = useState<Duel[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [duration, setDuration] = useState(7)
  const [token,   setToken]   = useState("")
  const [copied,  setCopied]  = useState<string | null>(null)

  const inviteCode = searchParams.get("invite")

  useEffect(() => {
    async function init() {
      const { data: { user: u } } = await supabase.auth.getUser()
      if (!u) { router.push("/login"); return }
      setUser(u)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return
      setToken(session.access_token)
      // Load duels
      const res = await fetch("/api/duel", { headers: { Authorization: `Bearer ${session.access_token}` } })
      const json = await res.json()
      setDuels(json.duels ?? [])
      setLoading(false)
      // Auto-join if invite param
      if (inviteCode) {
        await fetch("/api/duel/join", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ invite_code: inviteCode }),
        })
        router.replace("/duel")
      }
    }
    init()
  }, [])

  async function createDuel() {
    setCreating(true)
    const res = await fetch("/api/duel", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ duration_days: duration }),
    })
    const json = await res.json()
    if (json.duel) setDuels(d => [json.duel, ...d])
    setCreating(false)
  }

  function copyInvite(duelId: string) {
    const url = `${window.location.origin}/duel?invite=${duelId}`
    navigator.clipboard.writeText(url)
    setCopied(duelId)
    setTimeout(() => setCopied(null), 2000)
  }

  const tweetDuel = (duelId: string) => encodeURIComponent(
    `Je te défie sur Tradex 🥊 — duel de paper trading ${duration}j !\nClique pour rejoindre : ${window.location.origin}/duel?invite=${duelId}\n#Trading #Tradex #Duel`
  )

  return (
    <div className="min-h-screen page-enter">
      <div className="max-w-2xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="mb-8 text-center">
          <div className="w-16 h-16 rounded-3xl mx-auto mb-4 flex items-center justify-center text-3xl"
            style={{ background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.2)" }}>
            🥊
          </div>
          <p className="text-xs font-black text-purple-400 uppercase tracking-widest mb-1">Duels de trading</p>
          <h1 className="text-3xl font-black text-white mb-2">Défie tes amis</h1>
          <p className="text-white/40 text-sm max-w-sm mx-auto">
            Compétition paper trading sur 3, 7 ou 14 jours. Qui performe le mieux ?
          </p>
        </div>

        {/* Create duel */}
        <div className="rounded-2xl p-5 mb-6" style={{ background: "var(--bg-surface)", border: "1px solid rgba(167,139,250,0.2)" }}>
          <p className="text-sm font-black text-white mb-4">Créer un nouveau duel</p>

          <div className="mb-4">
            <p className="text-xs text-white/30 uppercase tracking-widest mb-2">Durée</p>
            <div className="flex gap-2">
              {[3, 7, 14].map(d => (
                <button key={d} onClick={() => setDuration(d)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-black transition-all"
                  style={duration === d ? {
                    background: "rgba(167,139,250,0.15)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.3)"
                  } : {
                    background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.08)"
                  }}>
                  {d} jours
                </button>
              ))}
            </div>
          </div>

          <button onClick={createDuel} disabled={creating}
            className="w-full py-3.5 rounded-2xl font-black text-sm transition-all hover:scale-[1.01] disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, #a78bfa, #7c3aed)", color: "white" }}>
            {creating ? "Création…" : "🥊 Créer le duel →"}
          </button>
        </div>

        {/* Active duels */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => <div key={i} className="h-24 rounded-2xl animate-pulse" style={{ background: "rgba(255,255,255,0.04)" }} />)}
          </div>
        ) : duels.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-3xl mb-2">🥊</p>
            <p className="text-white font-black mb-1">Aucun duel en cours</p>
            <p className="text-white/30 text-sm">Crée un duel et défie un ami !</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs font-black text-white/25 uppercase tracking-widest">Mes duels</p>
            {duels.map(duel => {
              const myPnl  = duel.challenger_pnl_pct ?? 0
              const oppPnl = duel.opponent_pnl_pct ?? 0
              const winning = myPnl > oppPnl
              const endDate = new Date(duel.end_date)
              const daysLeft = Math.max(0, Math.ceil((endDate.getTime() - Date.now()) / 86400000))

              return (
                <div key={duel.id} className="rounded-2xl p-4"
                  style={{ background: "var(--bg-surface)", border: "1px solid var(--border-dim)" }}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-black ${
                        duel.status === "pending" ? "bg-yellow-500/15 text-yellow-400" :
                        duel.status === "active"  ? "bg-green-500/15 text-green-400" :
                        "bg-white/10 text-white/40"
                      }`}>
                        {duel.status === "pending" ? "⏳ En attente" : duel.status === "active" ? "🔴 Live" : "✅ Terminé"}
                      </span>
                      <span className="text-xs text-white/30">{duel.duration_days}j</span>
                    </div>
                    {duel.status !== "finished" && <span className="text-xs text-white/25">{daysLeft}j restants</span>}
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="rounded-xl p-3 text-center"
                      style={{ background: winning ? "rgba(34,197,94,0.08)" : "rgba(255,255,255,0.03)", border: winning ? "1px solid rgba(34,197,94,0.2)" : "1px solid rgba(255,255,255,0.06)" }}>
                      <p className="text-xs text-white/30 mb-1">Toi ({duel.challenger_username})</p>
                      <p className={`text-xl font-black tabular-nums ${myPnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {myPnl >= 0 ? "+" : ""}{myPnl.toFixed(2)}%
                      </p>
                    </div>
                    <div className="rounded-xl p-3 text-center"
                      style={{ background: !winning && duel.opponent_username ? "rgba(34,197,94,0.08)" : "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                      <p className="text-xs text-white/30 mb-1">{duel.opponent_username ?? "En attente…"}</p>
                      {duel.opponent_username ? (
                        <p className={`text-xl font-black tabular-nums ${oppPnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                          {oppPnl >= 0 ? "+" : ""}{oppPnl.toFixed(2)}%
                        </p>
                      ) : (
                        <p className="text-white/20 text-sm">—</p>
                      )}
                    </div>
                  </div>

                  {duel.status === "pending" && (
                    <div className="flex gap-2">
                      <button onClick={() => copyInvite(duel.id)}
                        className="flex-1 py-2 rounded-xl text-xs font-black transition-all hover:scale-[1.01]"
                        style={{ background: copied === duel.id ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.06)", color: copied === duel.id ? "#4ade80" : "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.1)" }}>
                        {copied === duel.id ? "✓ Lien copié" : "📋 Copier le lien"}
                      </button>
                      <a href={`https://twitter.com/intent/tweet?text=${tweetDuel(duel.id)}`} target="_blank" rel="noopener"
                        className="flex-1 py-2 rounded-xl text-xs font-black text-center transition-all hover:scale-[1.01]"
                        style={{ background: "rgba(29,161,242,0.1)", border: "1px solid rgba(29,161,242,0.25)", color: "#1da1f2" }}>
                        𝕏 Défier sur X
                      </a>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default function DuelPage() {
  return <Suspense fallback={null}><DuelContent /></Suspense>
}
