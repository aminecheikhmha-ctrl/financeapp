"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useParams, useRouter } from "next/navigation"

export default function SignalDetail() {
  const { id } = useParams()
  const router = useRouter()
  const [signal, setSignal] = useState<any>(null)
  const [commentaires, setCommentaires] = useState<any[]>([])
  const [user, setUser] = useState<any>(null)
  const [plan, setPlan] = useState("free")
  const [contenu, setContenu] = useState("")
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push("/login"); return }
      setUser(data.user)
      const { data: profile } = await supabase
        .from("profiles")
        .select("plan")
        .eq("email", data.user.email)
        .single()
      setPlan(profile?.plan ?? "free")
    })

    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id as string)
    const query = isUUID
      ? supabase.from("signaux").select("*").eq("id", id).single()
      : supabase.from("signaux").select("*").eq("ticker", id).order("created_at", { ascending: false }).limit(1).single()
    query.then(({ data }) => { if (data) setSignal(data) })

    supabase.from("signaux_commentaires").select("*")
      .eq("signal_id", id).order("created_at", { ascending: true })
      .then(({ data }) => { if (data) setCommentaires(data) })
  }, [])

  // Auto-generate analysis if missing
  useEffect(() => {
    if (!signal) return
    if (!signal.raisonnement || signal.raisonnement.length < 100) {
      handleGenerate()
    }
  }, [signal?.id])

  async function handleGenerate() {
    setGenerating(true)
    try {
      const res = await fetch("/api/signals/analyse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: signal.ticker, signal_id: signal.id }),
      })
      const data = await res.json()
      if (data.raisonnement) {
        setSignal((prev: any) => ({ ...prev, raisonnement: data.raisonnement }))
      }
    } catch {}
    setGenerating(false)
  }

  async function handleComment() {
    if (!contenu) return
    setLoading(true)
    await supabase.from("signaux_commentaires").insert({
      signal_id: id,
      user_email: user.email,
      contenu,
    })
    setContenu("")
    const { data } = await supabase.from("signaux_commentaires").select("*")
      .eq("signal_id", id).order("created_at", { ascending: true })
    if (data) setCommentaires(data)
    setLoading(false)
  }

  function timeAgo(date: string) {
    const diff = Date.now() - new Date(date + "Z").getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 2) return "à l'instant"
    if (mins < 60) return `il y a ${mins} min`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `il y a ${hours}h`
    return `il y a ${Math.floor(hours / 24)}j`
  }

  function formatDate(date: string) {
    return new Intl.DateTimeFormat("fr-FR", {
      day: "numeric", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }).format(new Date(date + "Z"))
  }

  function renderMarkdown(text: string) {
    return text.split("\n").map((line, i) => {
      if (line.startsWith("### ")) return <h3 key={i} className="text-white font-bold text-base mt-4 mb-1">{line.replace("### ", "")}</h3>
      if (line.startsWith("## ")) return <h2 key={i} className="text-white font-bold text-lg mt-4 mb-1">{line.replace("## ", "")}</h2>
      if (line.startsWith("- ")) return (
        <div key={i} className="flex gap-2 ml-2 my-0.5">
          <span className="text-green-400">•</span>
          <span className="text-gray-300" dangerouslySetInnerHTML={{ __html: line.replace("- ", "").replaceAll(/\*\*(.*?)\*\*/g, "<strong class='text-white'>$1</strong>") }} />
        </div>
      )
      if (line.trim() === "") return <div key={i} className="h-2" />
      return <p key={i} className="text-gray-300" dangerouslySetInnerHTML={{ __html: line.replaceAll(/\*\*(.*?)\*\*/g, "<strong class='text-white'>$1</strong>") }} />
    })
  }

  if (!signal) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <p className="text-gray-400">Chargement...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-4xl mx-auto">

        <button onClick={() => router.push("/signaux")} className="text-gray-400 hover:text-white mb-6 flex items-center gap-2 transition">
          ← Retour aux signaux
        </button>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <span className="text-3xl font-bold">{signal.ticker}</span>
              <span className={`px-4 py-1.5 rounded-full font-bold border text-sm ${
                signal.direction === "LONG"
                  ? "bg-green-500/20 text-green-400 border-green-500/30"
                  : "bg-red-500/20 text-red-400 border-red-500/30"
              }`}>
                {signal.direction === "LONG" ? "▲ LONG" : "▼ SHORT"}
              </span>
              <span className="text-gray-400 text-sm capitalize bg-gray-800 px-3 py-1 rounded-lg">
                {signal.timeframe}
              </span>
            </div>
            <div className="text-right">
              <p className={`text-2xl font-bold ${signal.score_confiance >= 80 ? "text-green-400" : "text-yellow-400"}`}>
                {signal.score_confiance}%
              </p>
              <p className="text-gray-400 text-xs">Score de confiance</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            <div className="bg-gray-800 rounded-xl p-4 text-center">
              <p className="text-gray-400 text-xs mb-1">Entrée</p>
              <p className="text-white font-bold">${signal.prix_entree}</p>
            </div>
            <div className="bg-green-500/10 rounded-xl p-4 text-center">
              <p className="text-green-400 text-xs mb-1">TP1</p>
              <p className="text-white font-bold">${signal.take_profit_1}</p>
            </div>
            <div className="bg-green-500/15 rounded-xl p-4 text-center">
              <p className="text-green-400 text-xs mb-1">TP2</p>
              <p className="text-white font-bold">${signal.take_profit_2}</p>
            </div>
            <div className="bg-green-500/20 rounded-xl p-4 text-center">
              <p className="text-green-400 text-xs mb-1">TP3</p>
              <p className="text-white font-bold">${signal.take_profit_3}</p>
            </div>
            <div className="bg-red-500/10 rounded-xl p-4 text-center">
              <p className="text-red-400 text-xs mb-1">Stop Loss</p>
              <p className="text-white font-bold">${signal.stop_loss}</p>
            </div>
          </div>

          <div className="mb-6">
            <p className="text-gray-400 text-sm font-semibold mb-3">Indicateurs déclencheurs</p>
            <div className="flex flex-wrap gap-2">
              {signal.indicateurs?.signals?.map((s: string, i: number) => (
                <span key={i} className="text-xs bg-gray-800 border border-gray-700 text-gray-300 px-3 py-1.5 rounded-lg">
                  {s}
                </span>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-gray-800 rounded-xl p-3">
              <p className="text-gray-400 text-xs mb-1">RSI(14)</p>
              <p className={`font-bold ${signal.indicateurs?.rsi < 30 ? "text-green-400" : signal.indicateurs?.rsi > 70 ? "text-red-400" : "text-white"}`}>
                {signal.indicateurs?.rsi?.toFixed(1)}
              </p>
            </div>
            <div className="bg-gray-800 rounded-xl p-3">
              <p className="text-gray-400 text-xs mb-1">MACD Histo</p>
              <p className={`font-bold ${signal.indicateurs?.macd?.histogram > 0 ? "text-green-400" : "text-red-400"}`}>
                {signal.indicateurs?.macd?.histogram?.toFixed(3)}
              </p>
            </div>
            <div className="bg-gray-800 rounded-xl p-3">
              <p className="text-gray-400 text-xs mb-1">Bollinger %</p>
              <p className="text-white font-bold">{signal.indicateurs?.bb?.position?.toFixed(1)}%</p>
            </div>
            <div className="bg-gray-800 rounded-xl p-3">
              <p className="text-gray-400 text-xs mb-1">Volume ratio</p>
              <p className={`font-bold ${signal.indicateurs?.volume_ratio > 1.5 ? "text-green-400" : "text-white"}`}>
                {signal.indicateurs?.volume_ratio?.toFixed(2)}x
              </p>
            </div>
          </div>

          <p className="text-gray-500 text-xs mt-4">{formatDate(signal.created_at)}</p>
        </div>

        {/* Confluence */}
        {signal.indicateurs?.confirmed_by?.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold">📊 Confluence — {signal.indicateurs?.confluence_count}/{signal.indicateurs?.total_indicators} indicateurs</h2>
              <span className="text-white font-black text-xl">{signal.indicateurs?.confluence_score?.toFixed(0)}%</span>
            </div>
            <div className="w-full bg-white/5 rounded-full h-2 mb-4">
              <div
                className={`h-2 rounded-full ${signal.direction === "LONG" ? "bg-gradient-to-r from-green-600 to-emerald-400" : "bg-gradient-to-r from-red-600 to-rose-400"}`}
                style={{ width: `${signal.indicateurs?.confluence_score}%` }}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {signal.indicateurs.confirmed_by.map((label: string) => (
                <span key={label} className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
                  signal.direction === "LONG"
                    ? "bg-green-500/10 text-green-400 border-green-500/20"
                    : "bg-red-500/10 text-red-400 border-red-500/20"
                }`}>{label}</span>
              ))}
            </div>
          </div>
        )}

        {/* Analyse */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 mb-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold">🤖 Analyse algorithmique</h2>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="flex items-center gap-2 bg-white/5 hover:bg-white/10 disabled:opacity-40 text-gray-300 hover:text-white border border-white/10 px-3 py-1.5 rounded-lg text-sm font-semibold transition"
            >
              {generating ? <><span className="animate-spin inline-block">⟳</span> Génération...</> : "↺ Régénérer"}
            </button>
          </div>
          {generating && !signal.raisonnement ? (
            <div className="space-y-3 animate-pulse">
              <div className="h-4 bg-white/5 rounded w-3/4" />
              <div className="h-4 bg-white/5 rounded w-full" />
              <div className="h-4 bg-white/5 rounded w-5/6" />
              <div className="h-4 bg-white/5 rounded w-2/3" />
              <div className="h-4 bg-white/5 rounded w-full" />
            </div>
          ) : signal.raisonnement ? (
            <div className="text-sm leading-relaxed">
              {renderMarkdown(signal.raisonnement)}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">Génération de l'analyse en cours…</p>
          )}
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
          <h2 className="text-xl font-bold mb-6">
            💬 Discussion ({commentaires.length})
          </h2>

          <div className="flex flex-col gap-4 mb-6">
            {commentaires.length === 0 ? (
              <p className="text-gray-400 text-sm">Sois le premier à commenter ce signal.</p>
            ) : (
              commentaires.map((c) => (
                <div key={c.id} className="bg-gray-800 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-green-400 text-sm font-semibold">{c.user_email}</span>
                    <span className="text-gray-500 text-xs">{timeAgo(c.created_at)}</span>
                  </div>
                  <p className="text-gray-300 text-sm">{c.contenu}</p>
                </div>
              ))
            )}
          </div>

          {plan !== "free" ? (
            <div>
              <textarea
                value={contenu}
                onChange={(e) => setContenu(e.target.value)}
                placeholder="Donne ton avis sur ce signal..."
                rows={3}
                className="w-full bg-gray-800 border border-gray-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:border-green-500 mb-3"
              />
              <button
                onClick={handleComment}
                disabled={loading}
                className="bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white px-6 py-3 rounded-lg font-semibold transition"
              >
                {loading ? "Envoi..." : "Commenter"}
              </button>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-gray-400 mb-3">Connecte-toi avec un plan Pro ou Premium pour commenter</p>
              <a href="/pricing" className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg font-semibold transition">
                Upgrader
              </a>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}