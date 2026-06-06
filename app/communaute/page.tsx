"use client"
import { useEffect, useState, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Plus, Search, Send, Sword } from "lucide-react"

type Section = "forum" | "classement" | "duels" | "room"

function getUserGradient(username: string) {
  const G = [
    "linear-gradient(135deg,#22c55e,#16a34a)",
    "linear-gradient(135deg,#60a5fa,#3b82f6)",
    "linear-gradient(135deg,#f59e0b,#d97706)",
    "linear-gradient(135deg,#a78bfa,#7c3aed)",
    "linear-gradient(135deg,#f87171,#dc2626)",
    "linear-gradient(135deg,#34d399,#059669)",
    "linear-gradient(135deg,#fb923c,#ea580c)",
    "linear-gradient(135deg,#e879f9,#a21caf)",
  ]
  let h = 0
  for (let i = 0; i < username.length; i++) h = username.charCodeAt(i) + ((h << 5) - h)
  return G[Math.abs(h) % G.length]
}

function Avatar({ username, size = 36 }: { username: string; size?: number }) {
  return (
    <div className="rounded-2xl flex items-center justify-center font-black text-white flex-shrink-0"
      style={{ width: size, height: size, background: getUserGradient(username), fontSize: Math.max(9, size * 0.38) }}>
      {(username || "?")[0].toUpperCase()}
    </div>
  )
}

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 2) return "à l'instant"
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}j`
}

const SECTION_CONFIG = {
  forum:      { icon: "💬", label: "Forum",      desc: "Analyses & débats",  color: "#60a5fa", gradient: "linear-gradient(135deg, rgba(96,165,250,0.15), rgba(96,165,250,0.05))" },
  classement: { icon: "🏆", label: "Classement", desc: "Top traders",        color: "#f59e0b", gradient: "linear-gradient(135deg, rgba(245,158,11,0.15), rgba(245,158,11,0.05))" },
  duels:      { icon: "⚔️", label: "Duels",      desc: "Compétitions live",  color: "#a78bfa", gradient: "linear-gradient(135deg, rgba(167,139,250,0.15), rgba(167,139,250,0.05))" },
  room:       { icon: "📡", label: "Live Room",  desc: "Chat temps réel",    color: "#22c55e", gradient: "linear-gradient(135deg, rgba(34,197,94,0.15), rgba(34,197,94,0.05))" },
} as const

export default function CommunautePage() {
  const router = useRouter()
  const [section, setSection] = useState<Section>("forum")
  const [user, setUser] = useState<any>(null)
  const [token, setToken] = useState("")

  // Forum
  const [posts, setPosts] = useState<any[]>([])
  const [postLoading, setPostLoading] = useState(true)
  const [catFilter, setCatFilter] = useState("all")
  const [sort, setSort] = useState("recent")
  const [search, setSearch] = useState("")
  const [showNewPost, setShowNewPost] = useState(false)
  const [newTitle, setNewTitle] = useState("")
  const [newContent, setNewContent] = useState("")
  const [submitting, setSubmitting] = useState(false)

  // Classement
  const [leaders, setLeaders] = useState<any[]>([])

  // Duels
  const [duels, setDuels] = useState<any[]>([])
  const [creating, setCreating] = useState(false)

  // Room
  const [messages, setMessages] = useState<any[]>([])
  const [roomInput, setRoomInput] = useState("")
  const [room, setRoom] = useState("general")
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setToken(session?.access_token ?? "")
    })
  }, [])

  // ── Forum ──────────────────────────────────────────────────────────────
  const fetchPosts = useCallback(async () => {
    setPostLoading(true)
    try {
      let url = `/api/forum/posts?sort=${sort}&limit=20`
      if (catFilter !== "all") url += `&category=${catFilter}`
      if (search) url += `&search=${encodeURIComponent(search)}`
      const res = await fetch(url)
      const data = await res.json()
      setPosts(data.posts ?? [])
    } catch { setPosts([]) }
    setPostLoading(false)
  }, [sort, catFilter, search])

  useEffect(() => {
    if (section === "forum") fetchPosts()
  }, [section, fetchPosts])

  async function submitPost() {
    if (!newTitle.trim() || !newContent.trim() || !user) return
    setSubmitting(true)
    await fetch("/api/forum/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ title: newTitle, content: newContent, category: catFilter === "all" ? "analyse" : catFilter }),
    })
    setNewTitle(""); setNewContent(""); setShowNewPost(false)
    await fetchPosts()
    setSubmitting(false)
  }

  // ── Classement ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (section !== "classement") return
    fetch("/api/leaderboard").then(r => r.json()).then(d => setLeaders(d.leaderboard ?? []))
  }, [section])

  // ── Duels ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (section !== "duels" || !token) return
    fetch("/api/duel", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => setDuels(d.duels ?? []))
  }, [section, token])

  async function createDuel() {
    if (!token) return
    setCreating(true)
    const res = await fetch("/api/duel", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ duration_days: 7 }),
    })
    const json = await res.json()
    if (json.duel) setDuels(d => [json.duel, ...d])
    setCreating(false)
  }

  // ── Room ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (section !== "room" || !user) return
    fetch(`/api/ai/chat?room=${room}&limit=50`)
      .then(r => r.json()).then(d => setMessages(d.messages ?? []))

    const channel = supabase
      .channel(`room:${room}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "trading_room_messages", filter: `room=eq.${room}` },
        (p: any) => setMessages(m => [...m, p.new]))
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [section, room, user])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  async function sendMessage() {
    if (!roomInput.trim() || !user || sending) return
    setSending(true)
    await fetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ content: roomInput, room }),
    })
    setRoomInput(""); setSending(false)
  }

  return (
    <div className="min-h-screen page-enter">
      <div className="max-w-5xl mx-auto px-6 py-6">

        {/* ── HEADER ─────────────────────────────────────────────── */}
        <div className="mb-6">
          <p className="text-[10px] text-white/25 uppercase tracking-widest font-bold mb-1">Communauté</p>
          <h1 className="text-3xl font-black text-white">Traders Tradex</h1>
        </div>

        {/* ── NAVIGATION 4 SECTIONS ──────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {(Object.entries(SECTION_CONFIG) as [Section, typeof SECTION_CONFIG[Section]][]).map(([key, cfg]) => {
            const isActive = section === key
            return (
              <button key={key} onClick={() => setSection(key)}
                className="relative overflow-hidden rounded-2xl p-4 text-left transition-all hover:scale-[1.02] active:scale-[0.98]"
                style={{
                  background: isActive ? cfg.gradient : "rgba(255,255,255,0.03)",
                  border: `1px solid ${isActive ? `${cfg.color}35` : "rgba(255,255,255,0.07)"}`,
                  boxShadow: isActive ? `0 0 30px ${cfg.color}15` : "none",
                }}>
                {isActive && (
                  <div className="absolute top-0 right-0 w-16 h-16 rounded-full blur-2xl opacity-30"
                    style={{ background: cfg.color }} />
                )}
                <div className="relative">
                  <span className="text-2xl mb-2 block">{cfg.icon}</span>
                  <p className="text-sm font-black text-white mb-0.5">{cfg.label}</p>
                  <p className="text-[10px]" style={{ color: isActive ? cfg.color : "rgba(255,255,255,0.3)" }}>
                    {cfg.desc}
                  </p>
                  {isActive && (
                    <div className="mt-2 w-8 h-0.5 rounded-full" style={{ background: cfg.color }} />
                  )}
                </div>
              </button>
            )
          })}
        </div>

        {/* ══════════════════════════════════════════════════════
            FORUM
        ══════════════════════════════════════════════════════ */}
        {section === "forum" && (
          <div>
            {/* Barre d'actions */}
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25" />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Rechercher une discussion..."
                  className="w-full h-9 pl-9 pr-3 rounded-xl text-xs text-white placeholder-white/20 outline-none"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }} />
              </div>
              <div className="flex rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
                {[{ k: "recent", l: "Récents" }, { k: "popular", l: "Populaires" }, { k: "active", l: "Actifs" }].map(s => (
                  <button key={s.k} onClick={() => setSort(s.k)}
                    className="px-3 py-2 text-[11px] font-bold transition-all"
                    style={sort === s.k ? { background: "rgba(255,255,255,0.08)", color: "white" } : { color: "rgba(255,255,255,0.3)" }}>
                    {s.l}
                  </button>
                ))}
              </div>
              {user && (
                <button onClick={() => setShowNewPost(p => !p)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black text-black transition-all hover:scale-[1.02]"
                  style={{ background: "#22c55e" }}>
                  <Plus size={14} />
                  Nouveau post
                </button>
              )}
            </div>

            {/* Catégories */}
            <div className="flex gap-2 flex-wrap mb-4">
              {[
                { k: "all",         l: "🌐 Tout" },
                { k: "analyse",     l: "📊 Analyses" },
                { k: "question",    l: "❓ Questions" },
                { k: "crypto",      l: "₿ Crypto" },
                { k: "actions",     l: "📈 Actions" },
                { k: "psychologie", l: "🧠 Psycho" },
                { k: "actualite",   l: "📰 Actu" },
              ].map(c => (
                <button key={c.k} onClick={() => setCatFilter(c.k)}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
                  style={catFilter === c.k ? {
                    background: "rgba(96,165,250,0.12)", color: "#60a5fa", border: "1px solid rgba(96,165,250,0.25)",
                  } : {
                    background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.35)", border: "1px solid rgba(255,255,255,0.07)",
                  }}>
                  {c.l}
                </button>
              ))}
            </div>

            {/* Formulaire nouveau post */}
            {showNewPost && user && (
              <div className="rounded-2xl p-5 mb-4"
                style={{ background: "rgba(96,165,250,0.06)", border: "1px solid rgba(96,165,250,0.2)" }}>
                <p className="text-sm font-black text-white mb-3">✍️ Nouveau post</p>
                <input value={newTitle} onChange={e => setNewTitle(e.target.value)}
                  placeholder="Titre de ta discussion..."
                  className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-white/20 outline-none mb-3"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }} />
                <textarea value={newContent} onChange={e => setNewContent(e.target.value)}
                  placeholder="Partage ton analyse, ta question ou ton opinion..."
                  rows={4}
                  className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-white/20 outline-none resize-none mb-3"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", fontFamily: "inherit" }} />
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setShowNewPost(false)}
                    className="px-4 py-2 rounded-xl text-xs text-white/40 hover:text-white transition">
                    Annuler
                  </button>
                  <button onClick={submitPost} disabled={submitting || !newTitle.trim() || !newContent.trim()}
                    className="px-5 py-2 rounded-xl text-xs font-black text-black disabled:opacity-40 transition-all hover:scale-[1.02]"
                    style={{ background: "#22c55e" }}>
                    {submitting ? "Publication..." : "Publier →"}
                  </button>
                </div>
              </div>
            )}

            {/* Posts */}
            {postLoading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="rounded-2xl p-5 animate-pulse"
                    style={{ background: "rgba(255,255,255,0.03)", height: 120 }} />
                ))}
              </div>
            ) : posts.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-4xl mb-3">💬</p>
                <p className="font-black text-white mb-2">Aucune discussion</p>
                <p className="text-sm text-white/30">Sois le premier à poster !</p>
              </div>
            ) : (
              <div className="space-y-3">
                {posts.map(post => (
                  <div key={post.id}
                    onClick={() => router.push(`/forum/${post.id}`)}
                    className="rounded-2xl p-5 cursor-pointer transition-all hover:bg-white/[0.03] group"
                    style={{
                      background: post.pinned ? "rgba(34,197,94,0.04)" : "var(--bg-surface)",
                      border: `1px solid ${post.pinned ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.06)"}`,
                    }}>
                    <div className="flex items-start gap-3 mb-3">
                      <Avatar username={post.username ?? "?"} size={40} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          {post.pinned && (
                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-400">
                              📌 ÉPINGLÉ
                            </span>
                          )}
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full"
                            style={{ background: "rgba(96,165,250,0.12)", color: "#60a5fa" }}>
                            {post.category}
                          </span>
                          {post.symbol && (
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-white/6 text-white/50">
                              ${post.symbol}
                            </span>
                          )}
                        </div>
                        <h3 className="text-base font-black text-white leading-snug group-hover:text-blue-400 transition-colors line-clamp-2 mb-1">
                          {post.title}
                        </h3>
                        <p className="text-xs text-white/35 leading-relaxed line-clamp-2">
                          {post.content?.slice(0, 150)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-3 border-t border-white/5">
                      <div className="flex items-center gap-1.5">
                        <Avatar username={post.username ?? "?"} size={18} />
                        <span className="text-[11px] text-white/40 font-semibold">{post.username}</span>
                        <span className="text-white/20">·</span>
                        <span className="text-[10px] text-white/25">{timeAgo(post.created_at)}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] text-white/30">❤️ {post.likes}</span>
                        <span className="text-[11px] text-white/30">💬 {post.replies_count}</span>
                        <span className="text-[11px] text-white/20">👁 {post.views}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            CLASSEMENT
        ══════════════════════════════════════════════════════ */}
        {section === "classement" && (
          <div>
            {leaders.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-5xl mb-4">🏆</p>
                <p className="text-lg font-black text-white mb-2">Classement bientôt disponible</p>
                <p className="text-sm text-white/35 max-w-xs mx-auto">
                  Fais tes premiers trades pour apparaître dans le classement des meilleurs traders Tradex.
                </p>
                <button onClick={() => router.push("/dashboard")}
                  className="mt-5 px-5 py-2.5 rounded-xl text-sm font-black text-black"
                  style={{ background: "#22c55e" }}>
                  Commencer à trader →
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Podium top 3 */}
                {leaders.length >= 3 && (
                  <div className="grid grid-cols-3 gap-3 mb-6">
                    {[1, 0, 2].map(idx => {
                      const l = leaders[idx]
                      if (!l) return null
                      const medals = ["🥇", "🥈", "🥉"]
                      const heights = ["h-28", "h-36", "h-24"]
                      return (
                        <div key={idx} className={`flex flex-col items-center justify-end ${heights[idx]} rounded-2xl p-4`}
                          style={{ background: "var(--bg-surface)", border: "1px solid rgba(255,255,255,0.07)" }}>
                          <span className="text-2xl mb-1">{medals[idx]}</span>
                          <Avatar username={l.username} size={32} />
                          <p className="text-xs font-black text-white mt-1 truncate max-w-full">{l.username}</p>
                          <p className={`text-xs font-black ${(l.total_return_pct ?? 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
                            {(l.total_return_pct ?? 0) >= 0 ? "+" : ""}{(l.total_return_pct ?? 0).toFixed(1)}%
                          </p>
                        </div>
                      )
                    })}
                  </div>
                )}
                {leaders.map((l, i) => (
                  <div key={l.user_id} className="flex items-center gap-4 px-5 py-4 rounded-2xl"
                    style={{ background: "var(--bg-surface)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <span className="text-lg w-8 text-center flex-shrink-0">
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                    </span>
                    <Avatar username={l.username} size={36} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-white truncate">{l.username}</p>
                      <p className="text-[10px] text-white/30">{l.trades_count} trades · Win rate {(l.win_rate ?? 0).toFixed(0)}%</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`text-base font-black ${(l.total_return_pct ?? 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {(l.total_return_pct ?? 0) >= 0 ? "+" : ""}{(l.total_return_pct ?? 0).toFixed(2)}%
                      </p>
                      <p className="text-[10px] text-white/30">${(l.portfolio_value ?? 0).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            DUELS
        ══════════════════════════════════════════════════════ */}
        {section === "duels" && (
          <div>
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-sm font-black text-white">⚔️ Défie un trader</p>
                <p className="text-xs text-white/35">Compétition de 7 jours · Meilleur P&L gagne</p>
              </div>
              {user && (
                <button onClick={createDuel} disabled={creating}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black text-white disabled:opacity-50 transition-all hover:scale-[1.02]"
                  style={{ background: "linear-gradient(135deg, #a78bfa, #7c3aed)" }}>
                  <Sword size={14} />
                  {creating ? "Création..." : "Lancer un duel"}
                </button>
              )}
            </div>
            {duels.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-4xl mb-3">⚔️</p>
                <p className="font-black text-white mb-2">Aucun duel actif</p>
                <p className="text-sm text-white/30">Lance le premier défi de la communauté !</p>
              </div>
            ) : (
              <div className="space-y-3">
                {duels.map(duel => {
                  const isActive = duel.status === "active"
                  const isFinished = duel.status === "finished"
                  const statusColor = isFinished ? "#9ca3af" : isActive ? "#4ade80" : "#f59e0b"
                  const statusLabel = isFinished ? "Terminé" : isActive ? "En cours" : "En attente"
                  return (
                    <div key={duel.id} className="rounded-2xl p-5"
                      style={{ background: "rgba(167,139,250,0.06)", border: "1px solid rgba(167,139,250,0.15)" }}>
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full"
                          style={{ background: `${statusColor}15`, color: statusColor }}>
                          {statusLabel}
                        </span>
                        <span className="text-[10px] text-white/25">
                          {duel.duration_days}j · Fin {new Date(duel.end_date).toLocaleDateString("fr-FR")}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 text-center">
                          <Avatar username={duel.challenger_username ?? "?"} size={40} />
                          <p className="text-xs font-black text-white mt-1">{duel.challenger_username}</p>
                          <p className={`text-sm font-black ${(duel.challenger_pnl_pct ?? 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
                            {(duel.challenger_pnl_pct ?? 0) >= 0 ? "+" : ""}{(duel.challenger_pnl_pct ?? 0).toFixed(2)}%
                          </p>
                        </div>
                        <div className="text-xl font-black text-white/20">VS</div>
                        <div className="flex-1 text-center">
                          {duel.opponent_username ? (
                            <>
                              <Avatar username={duel.opponent_username} size={40} />
                              <p className="text-xs font-black text-white mt-1">{duel.opponent_username}</p>
                              <p className={`text-sm font-black ${(duel.opponent_pnl_pct ?? 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
                                {(duel.opponent_pnl_pct ?? 0) >= 0 ? "+" : ""}{(duel.opponent_pnl_pct ?? 0).toFixed(2)}%
                              </p>
                            </>
                          ) : (
                            <div className="flex flex-col items-center gap-2">
                              <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-lg"
                                style={{ background: "rgba(255,255,255,0.06)", border: "1px dashed rgba(255,255,255,0.15)" }}>
                                ?
                              </div>
                              <p className="text-[10px] text-white/25">En attente</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            LIVE ROOM
        ══════════════════════════════════════════════════════ */}
        {section === "room" && (
          <div className="flex flex-col" style={{ height: "calc(100vh - 300px)" }}>
            {/* Sélection room */}
            <div className="flex gap-2 mb-4 flex-shrink-0 flex-wrap">
              {[
                { k: "general", l: "💬 Général" },
                { k: "signaux", l: "📡 Signaux" },
                { k: "crypto",  l: "₿ Crypto" },
                { k: "actions", l: "📈 Actions" },
              ].map(r => (
                <button key={r.k} onClick={() => setRoom(r.k)}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
                  style={room === r.k ? {
                    background: "rgba(34,197,94,0.12)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.25)",
                  } : {
                    background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.35)", border: "1px solid rgba(255,255,255,0.07)",
                  }}>
                  {r.l}
                </button>
              ))}
              <div className="ml-auto flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                <span className="text-[10px] text-white/25">Live</span>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-hide rounded-2xl p-4 mb-3"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
              {!user ? (
                <div className="flex flex-col items-center justify-center h-full gap-3">
                  <p className="text-3xl">🔒</p>
                  <p className="text-sm text-white/30 text-center">Connecte-toi pour accéder au Live Room</p>
                  <button onClick={() => router.push("/login")}
                    className="px-4 py-2 rounded-xl text-xs font-black text-black"
                    style={{ background: "#22c55e" }}>
                    Se connecter →
                  </button>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-2">
                  <p className="text-3xl">📡</p>
                  <p className="text-sm text-white/30">Sois le premier à parler dans #{room}</p>
                </div>
              ) : (
                messages.map(msg => (
                  <div key={msg.id} className={`flex gap-2.5 ${msg.user_id === user?.id ? "flex-row-reverse" : ""}`}>
                    <Avatar username={msg.username ?? "?"} size={30} />
                    <div className={`max-w-[75%] flex flex-col ${msg.user_id === user?.id ? "items-end" : "items-start"}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] text-white/35 font-bold">{msg.username}</span>
                        <span className="text-[9px] text-white/20">{timeAgo(msg.created_at)}</span>
                      </div>
                      <div className="px-3 py-2.5 rounded-2xl text-sm text-white/85 leading-relaxed"
                        style={{
                          background: msg.user_id === user?.id ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.06)",
                          border: `1px solid ${msg.user_id === user?.id ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.08)"}`,
                        }}>
                        {msg.content}
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            {user && (
              <div className="flex gap-2 flex-shrink-0">
                <input value={roomInput} onChange={e => setRoomInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
                  placeholder={`Message dans #${room}...`}
                  className="flex-1 px-4 py-3 rounded-xl text-sm text-white placeholder-white/20 outline-none"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }} />
                <button onClick={sendMessage} disabled={sending || !roomInput.trim()}
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-black disabled:opacity-40 transition-all hover:scale-[1.02]"
                  style={{ background: "#22c55e" }}>
                  <Send size={16} />
                </button>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
