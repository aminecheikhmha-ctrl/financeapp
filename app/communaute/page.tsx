"use client"
import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Send, Sword, ChevronRight, X } from "lucide-react"

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
  for (let i = 0; i < (username || "").length; i++) h = username.charCodeAt(i) + ((h << 5) - h)
  return G[Math.abs(h) % G.length]
}

function Avatar({ username, size = 36 }: { username: string; size?: number }) {
  return (
    <div className="rounded-xl flex items-center justify-center font-black text-white flex-shrink-0"
      style={{ width: size, height: size, background: getUserGradient(username || "?"), fontSize: Math.max(10, size * 0.38) }}>
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

function postBorderColor(category: string) {
  if (category === "crypto")      return "rgba(96,165,250,0.6)"
  if (category === "analyse")     return "rgba(34,197,94,0.6)"
  if (category === "psychologie") return "rgba(167,139,250,0.6)"
  return "rgba(245,158,11,0.6)"
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CommunautePage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [token, setToken] = useState("")
  const [posts, setPosts] = useState<any[]>([])
  const [leaders, setLeaders] = useState<any[]>([])
  const [duels, setDuels] = useState<any[]>([])
  const [messages, setMessages] = useState<any[]>([])
  const [roomInput, setRoomInput] = useState("")
  const [sending, setSending] = useState(false)
  const [room, setRoom] = useState("general")
  const [forumOpen, setForumOpen] = useState(false)
  const [selectedProfile, setSelectedProfile] = useState<any>(null)
  const [creatingDuel, setCreatingDuel] = useState(false)
  const [allPosts, setAllPosts] = useState<any[]>([])
  const [forumFilter, setForumFilter] = useState("all")
  const [forumSort, setForumSort] = useState("popular")
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setToken(session?.access_token ?? "")
      loadAll(session?.access_token ?? "")
    })
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  useEffect(() => {
    const channel = supabase
      .channel(`room:${room}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public",
        table: "trading_room_messages",
        filter: `room=eq.${room}`,
      }, (p: any) => setMessages(m => [...m.slice(-49), p.new]))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [room])

  async function loadAll(tk: string) {
    const [postsRes, leadersRes, roomRes] = await Promise.allSettled([
      fetch("/api/forum/posts?sort=popular&limit=3"),
      fetch("/api/leaderboard"),
      fetch(`/api/ai/chat?room=general&limit=20`),
    ])
    if (postsRes.status === "fulfilled") { const d = await postsRes.value.json(); setPosts(d.posts?.slice(0, 3) ?? []) }
    if (leadersRes.status === "fulfilled") { const d = await leadersRes.value.json(); setLeaders(d.leaderboard?.slice(0, 3) ?? []) }
    if (roomRes.status === "fulfilled") { const d = await roomRes.value.json(); setMessages(d.messages?.slice(-20) ?? []) }
    if (tk) {
      const res = await fetch("/api/duel", { headers: { Authorization: `Bearer ${tk}` } }).catch(() => null)
      if (res?.ok) { const d = await res.json(); setDuels(d.duels?.filter((dl: any) => dl.status === "active").slice(0, 1) ?? []) }
    }
  }

  const loadAllPosts = useCallback(async () => {
    let url = `/api/forum/posts?sort=${forumSort}&limit=30`
    if (forumFilter !== "all") url += `&category=${forumFilter}`
    const res = await fetch(url).catch(() => null)
    if (res?.ok) { const d = await res.json(); setAllPosts(d.posts ?? []) }
  }, [forumSort, forumFilter])

  useEffect(() => { if (forumOpen) loadAllPosts() }, [forumOpen, loadAllPosts])

  async function sendMessage() {
    if (!roomInput.trim() || !user || sending) return
    setSending(true)
    await fetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ content: roomInput, room }),
    })
    setRoomInput("")
    setSending(false)
    const res = await fetch(`/api/ai/chat?room=${room}&limit=20`)
    const d = await res.json()
    setMessages(d.messages?.slice(-20) ?? [])
  }

  async function createDuel() {
    if (!user || !token) return
    setCreatingDuel(true)
    const res = await fetch("/api/duel", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ duration_days: 7 }),
    })
    const json = await res.json()
    if (json.duel) setDuels([json.duel])
    setCreatingDuel(false)
  }

  const hottestDuel = duels[0]
  const duelProgress = hottestDuel
    ? Math.max(10, Math.min(90, 50 + ((hottestDuel.challenger_pnl_pct ?? 0) - (hottestDuel.opponent_pnl_pct ?? 0)) * 5))
    : 50

  return (
    <div className="min-h-screen page-enter"
      style={{
        background: "var(--bg-canvas)",
        backgroundImage: "radial-gradient(ellipse 80% 40% at 50% -10%, rgba(34,197,94,0.07), transparent), radial-gradient(ellipse 50% 60% at 90% 50%, rgba(96,165,250,0.03), transparent)",
      }}>

      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <div className="px-6 pt-6 pb-4">
        <p className="text-[10px] text-white/25 uppercase tracking-widest font-bold mb-1">Communauté</p>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-3xl font-black text-white">Traders Tradex</h1>
          <div className="flex items-center gap-6">
            {[
              { label: "Posts chauds",  value: posts.length > 0 ? `${posts.length}+` : "—" },
              { label: "Duels actifs",  value: `${duels.length}` },
              { label: "Live",          value: messages.length > 0 ? "● En ligne" : "○ Vide", color: "#22c55e" },
            ].map(stat => (
              <div key={stat.label} className="text-right">
                <p className="text-sm font-black" style={{ color: stat.color ?? "rgba(255,255,255,0.8)" }}>{stat.value}</p>
                <p className="text-[9px] text-white/25">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── GRILLE PRINCIPALE ───────────────────────────────────────────── */}
      <div className="px-6 pb-6 grid gap-4"
        style={{ gridTemplateColumns: "1fr 1fr 2fr", gridTemplateRows: "auto auto" }}>

        {/* ══ WIDGET DUELS ══════════════════════════════════════════════ */}
        <div className="rounded-2xl p-5 flex flex-col relative overflow-hidden"
          style={{
            background: "linear-gradient(135deg, rgba(167,139,250,0.08), rgba(124,58,237,0.04))",
            border: "1px solid rgba(167,139,250,0.18)",
          }}>
          <div className="absolute top-0 right-0 w-24 h-24 rounded-full blur-3xl opacity-15 pointer-events-none"
            style={{ background: "#a78bfa" }} />

          <div className="relative flex-1 flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-lg">⚔️</span>
              <p className="text-sm font-black text-white">Duels</p>
              <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full ml-auto"
                style={{ background: "rgba(167,139,250,0.2)", color: "#a78bfa" }}>
                {duels.length} actif{duels.length > 1 ? "s" : ""}
              </span>
            </div>

            {/* Bouton premium */}
            <button onClick={createDuel} disabled={creatingDuel || !user}
              className="w-full py-4 rounded-2xl font-black text-base transition-all relative overflow-hidden group mb-5 disabled:opacity-50 active:scale-[0.98]"
              style={{
                background: "linear-gradient(135deg, #a78bfa 0%, #7c3aed 50%, #6d28d9 100%)",
                boxShadow: "0 8px 32px rgba(139,92,246,0.4), inset 0 1px 0 rgba(255,255,255,0.15)",
              }}>
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                style={{ background: "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.18) 50%, transparent 60%)" }} />
              <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                style={{ boxShadow: "inset 0 0 30px rgba(167,139,250,0.3)" }} />
              <span className="relative flex items-center justify-center gap-2.5 text-white">
                <span className="text-xl">⚔️</span>
                <span>{creatingDuel ? "Création..." : "Lancer un Duel"}</span>
              </span>
            </button>

            {hottestDuel ? (
              <div className="rounded-xl p-3 flex-1"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <p className="text-[9px] text-white/30 uppercase tracking-wider mb-2 font-bold">🔥 Duel en cours</p>
                <div className="flex items-center gap-2 mb-2.5">
                  <div className="flex-1 text-center">
                    <Avatar username={hottestDuel.challenger_username ?? "?"} size={28} />
                    <p className="text-[10px] font-black text-white mt-1 truncate">{hottestDuel.challenger_username}</p>
                    <p className={`text-[10px] font-black ${(hottestDuel.challenger_pnl_pct ?? 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {(hottestDuel.challenger_pnl_pct ?? 0) >= 0 ? "+" : ""}{(hottestDuel.challenger_pnl_pct ?? 0).toFixed(1)}%
                    </p>
                  </div>
                  <span className="text-white/20 text-xs font-black">VS</span>
                  <div className="flex-1 text-center">
                    <Avatar username={hottestDuel.opponent_username ?? "?"} size={28} />
                    <p className="text-[10px] font-black text-white mt-1 truncate">{hottestDuel.opponent_username ?? "???"}</p>
                    <p className={`text-[10px] font-black ${(hottestDuel.opponent_pnl_pct ?? 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {(hottestDuel.opponent_pnl_pct ?? 0) >= 0 ? "+" : ""}{(hottestDuel.opponent_pnl_pct ?? 0).toFixed(1)}%
                    </p>
                  </div>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                  <div className="h-full rounded-full transition-all duration-1000"
                    style={{ width: `${duelProgress}%`, background: "linear-gradient(90deg, #a78bfa, #22c55e)" }} />
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 py-4 rounded-xl"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.08)" }}>
                <span className="text-3xl opacity-40">⚔️</span>
                <div className="text-center">
                  <p className="text-xs font-bold text-white/40">Aucun duel actif</p>
                  <p className="text-[10px] text-white/20 mt-0.5">Sois le premier à défier la communauté</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ══ WIDGET CLASSEMENT ═════════════════════════════════════════ */}
        <div className="rounded-2xl p-5 flex flex-col relative overflow-hidden"
          style={{
            background: "linear-gradient(135deg, rgba(245,158,11,0.08), rgba(217,119,6,0.04))",
            border: "1px solid rgba(245,158,11,0.18)",
          }}>
          <div className="absolute top-0 right-0 w-24 h-24 rounded-full blur-3xl opacity-15 pointer-events-none"
            style={{ background: "#f59e0b" }} />

          <div className="relative flex-1 flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-lg">🏆</span>
              <p className="text-sm font-black text-white">Classement</p>
              <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full ml-auto"
                style={{ background: "rgba(245,158,11,0.2)", color: "#f59e0b" }}>Top 3</span>
            </div>

            {leaders.length > 0 ? (
              <div className="space-y-2 flex-1">
                {leaders.map((l, i) => (
                  <button key={l.user_id ?? i}
                    onClick={() => setSelectedProfile(l)}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all hover:scale-[1.01] text-left"
                    style={{
                      background: i === 0 ? "rgba(245,158,11,0.1)" : "rgba(255,255,255,0.03)",
                      border: `1px solid ${i === 0 ? "rgba(245,158,11,0.25)" : "rgba(255,255,255,0.06)"}`,
                    }}>
                    <span className="text-base w-5 flex-shrink-0">{["🥇","🥈","🥉"][i]}</span>
                    <Avatar username={l.username ?? "?"} size={28} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black text-white truncate">{l.username}</p>
                      <p className="text-[9px] text-white/30">{l.trades_count ?? 0} trades</p>
                    </div>
                    <p className={`text-xs font-black tabular-nums flex-shrink-0 ${(l.total_return_pct ?? 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {(l.total_return_pct ?? 0) >= 0 ? "+" : ""}{(l.total_return_pct ?? 0).toFixed(1)}%
                    </p>
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex-1 flex flex-col">
                {/* Podium silhouettes */}
                <div className="flex items-end justify-center gap-2 mb-4 px-2" style={{ height: 80 }}>
                  {[
                    { h: 50, medal: "🥈" },
                    { h: 70, medal: "🥇" },
                    { h: 40, medal: "🥉" },
                  ].map((p, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-sm opacity-20">{p.medal}</span>
                      <div className="w-8 h-8 rounded-xl opacity-10" style={{ background: "rgba(255,255,255,0.3)" }} />
                      <div className="w-full rounded-t-xl opacity-10" style={{ height: p.h, background: "rgba(255,255,255,0.15)" }} />
                    </div>
                  ))}
                </div>
                <div className="text-center">
                  <p className="text-xs text-white/30 mb-3">Classement bientôt disponible</p>
                  <button onClick={() => router.push("/dashboard")}
                    className="px-4 py-2 rounded-xl text-[11px] font-black transition-all hover:scale-[1.02]"
                    style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.25)" }}>
                    Commence à trader →
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ══ WIDGET FORUM EXPLORER ═════════════════════════════════════ */}
        <div className="rounded-2xl p-5 flex flex-col relative overflow-hidden"
          style={{
            background: "linear-gradient(135deg, rgba(96,165,250,0.06), rgba(59,130,246,0.03))",
            border: "1px solid rgba(96,165,250,0.15)",
          }}>
          <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-10 pointer-events-none"
            style={{ background: "#60a5fa" }} />

          <div className="relative flex-1 flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-lg">💬</span>
              <p className="text-sm font-black text-white">Sujets chauds</p>
              <button onClick={() => setForumOpen(true)}
                className="ml-auto flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-black transition-all hover:scale-[1.02] group"
                style={{
                  background: "linear-gradient(135deg, rgba(96,165,250,0.15), rgba(96,165,250,0.08))",
                  border: "1px solid rgba(96,165,250,0.3)",
                  color: "#60a5fa",
                  boxShadow: "0 2px 12px rgba(96,165,250,0.12)",
                }}>
                Ouvrir le Forum
                <ChevronRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>

            <div className="flex-1 space-y-2.5">
              {posts.length > 0 ? posts.map((post, i) => (
                <button key={post.id}
                  onClick={() => router.push(`/forum/${post.id}`)}
                  className="w-full flex items-start gap-3 px-4 py-3.5 rounded-xl text-left transition-all hover:bg-white/[0.04] group"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.07)",
                    borderLeft: `3px solid ${postBorderColor(post.category)}`,
                  }}>
                  <div className="flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black text-white/30"
                    style={{ background: "rgba(255,255,255,0.06)" }}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {post.symbol && (
                        <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full"
                          style={{ background: "rgba(34,197,94,0.12)", color: "#4ade80" }}>
                          ${post.symbol}
                        </span>
                      )}
                      <span className="text-[9px] text-white/25">{post.category}</span>
                    </div>
                    <p className="text-sm font-black text-white group-hover:text-blue-400 transition-colors leading-snug line-clamp-1 mb-1">
                      {post.title}
                    </p>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-white/25">❤️ {post.likes}</span>
                      <span className="text-[10px] text-white/25">💬 {post.replies_count ?? 0}</span>
                      <span className="text-[10px] text-white/20 ml-auto">{timeAgo(post.created_at)}</span>
                    </div>
                  </div>
                </button>
              )) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
                  <p className="text-3xl mb-2">💬</p>
                  <p className="text-sm text-white/30">Aucun post pour le moment</p>
                  <button onClick={() => setForumOpen(true)}
                    className="mt-3 text-xs text-blue-400 hover:text-blue-300 transition font-bold">
                    Sois le premier →
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ══ WIDGET LIVE ROOM ══════════════════════════════════════════ */}
        <div className="rounded-2xl p-5 flex flex-col col-span-2 relative overflow-hidden"
          style={{
            background: "linear-gradient(135deg, rgba(34,197,94,0.06), rgba(16,163,74,0.03))",
            border: "1px solid rgba(34,197,94,0.15)",
            minHeight: 340,
          }}>
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-64 h-32 rounded-full blur-3xl opacity-10 pointer-events-none"
            style={{ background: "#22c55e" }} />

          <div className="relative flex flex-col h-full">
            <div className="flex items-center gap-3 mb-3 flex-shrink-0 flex-wrap">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-sm font-black text-white">Live Room</span>
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {[
                  { k: "general", l: "💬 Général" },
                  { k: "signaux", l: "📡 Signaux" },
                  { k: "crypto",  l: "₿ Crypto" },
                  { k: "actions", l: "📈 Actions" },
                ].map(r => (
                  <button key={r.k} onClick={() => setRoom(r.k)}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all"
                    style={room === r.k ? {
                      background: "rgba(34,197,94,0.2)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.3)",
                    } : {
                      background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.3)", border: "1px solid rgba(255,255,255,0.06)",
                    }}>
                    {r.l}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 scrollbar-hide mb-3 pr-1" style={{ maxHeight: 200 }}>
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-6">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                    style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)" }}>
                    <span className="text-xl">📡</span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white/40">Room silencieuse</p>
                    <p className="text-xs text-white/20 mt-0.5">Sois le premier à briser le silence</p>
                  </div>
                </div>
              ) : messages.map(msg => {
                const isMe = msg.user_id === user?.id
                return (
                  <div key={msg.id} className={`flex gap-2 items-end ${isMe ? "flex-row-reverse" : ""}`}>
                    <Avatar username={msg.username ?? "?"} size={24} />
                    <div className={`max-w-[70%] flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                      {!isMe && <span className="text-[9px] text-white/30 mb-0.5 px-1">{msg.username}</span>}
                      <div className="px-3 py-2 rounded-2xl text-xs text-white/85 leading-relaxed"
                        style={{
                          background: isMe ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.07)",
                          border: `1px solid ${isMe ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.08)"}`,
                          borderBottomRightRadius: isMe ? 4 : undefined,
                          borderBottomLeftRadius: !isMe ? 4 : undefined,
                        }}>
                        {msg.content}
                      </div>
                    </div>
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </div>

            {user ? (
              <div className="flex gap-2 flex-shrink-0">
                <input value={roomInput} onChange={e => setRoomInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
                  placeholder={`Message dans #${room}...`}
                  className="flex-1 px-4 py-3 rounded-xl text-xs text-white placeholder-white/20 outline-none transition-all"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }} />
                <button onClick={sendMessage} disabled={sending || !roomInput.trim()}
                  className="w-11 h-11 rounded-xl flex items-center justify-center disabled:opacity-40 transition-all hover:scale-[1.05] active:scale-[0.95]"
                  style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)", boxShadow: "0 4px 16px rgba(34,197,94,0.35)" }}>
                  <Send size={15} className="text-black" />
                </button>
              </div>
            ) : (
              <button onClick={() => router.push("/login")}
                className="w-full py-2.5 rounded-xl text-xs font-bold text-green-400 transition"
                style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.15)" }}>
                Connecte-toi pour participer →
              </button>
            )}
          </div>
        </div>

        {/* ══ WIDGET STATS ══════════════════════════════════════════════ */}
        <div className="rounded-2xl p-5 flex flex-col"
          style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <p className="text-[10px] text-white/25 uppercase tracking-widest font-bold mb-4">📊 Stats communauté</p>
          <div className="space-y-2.5 flex-1">
            {[
              { label: "Posts chauds",   value: `${posts.length}+`,   icon: "💬", color: "#60a5fa" },
              { label: "Duels actifs",   value: `${duels.length}`,    icon: "⚔️", color: "#a78bfa" },
              { label: "Messages live",  value: `${messages.length}`, icon: "📡", color: "#22c55e" },
              { label: "Top performers", value: `${leaders.length}`,  icon: "🏆", color: "#f59e0b" },
            ].map(stat => (
              <div key={stat.label}
                className="flex items-center gap-3 px-3 py-3 rounded-xl transition-all hover:bg-white/[0.02]"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `${stat.color}15`, border: `1px solid ${stat.color}25` }}>
                  <span className="text-base">{stat.icon}</span>
                </div>
                <p className="text-xs text-white/45 flex-1">{stat.label}</p>
                <p className="text-base font-black" style={{ color: stat.color }}>{stat.value}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-white/5">
            <p className="text-[9px] text-white/20 uppercase tracking-widest mb-2 font-bold">Règles</p>
            {["Restez respectueux", "Pas de spam", "Sources pour les analyses"].map((r, i) => (
              <p key={i} className="text-[10px] text-white/25 py-0.5">✓ {r}</p>
            ))}
          </div>
        </div>
      </div>

      {/* ══ SIDE DRAWER FORUM ══════════════════════════════════════════════ */}
      <div onClick={() => setForumOpen(false)}
        className="fixed inset-0 z-40 transition-all duration-300"
        style={{
          background: "rgba(0,0,0,0.6)",
          backdropFilter: "blur(4px)",
          opacity: forumOpen ? 1 : 0,
          pointerEvents: forumOpen ? "auto" : "none",
        }} />

      <div className="fixed top-0 right-0 h-full z-50 flex flex-col transition-transform duration-300 ease-out"
        style={{
          width: 520,
          background: "linear-gradient(180deg, rgba(8,14,8,0.99) 0%, rgba(5,9,5,0.99) 100%)",
          borderLeft: "1px solid rgba(255,255,255,0.09)",
          backdropFilter: "blur(40px)",
          boxShadow: "-20px 0 60px rgba(0,0,0,0.5)",
          transform: forumOpen ? "translateX(0)" : "translateX(100%)",
        }}>
        {/* Glow vert en haut */}
        <div className="absolute top-0 left-0 right-0 h-32 pointer-events-none"
          style={{ background: "linear-gradient(180deg, rgba(34,197,94,0.04), transparent)" }} />

        <div className="flex items-center justify-between px-6 py-5 border-b flex-shrink-0 relative" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <div>
            <p className="text-lg font-black text-white">💬 Forum</p>
            <p className="text-xs text-white/30">Analyses, questions & débats</p>
          </div>
          <button onClick={() => setForumOpen(false)}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white/30 hover:text-white hover:bg-white/8 transition">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-3 border-b flex-shrink-0" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
          <div className="flex gap-2 mb-2.5 flex-wrap">
            {[{ k: "popular", l: "🔥 Populaires" }, { k: "recent", l: "🕐 Récents" }, { k: "active", l: "💬 Actifs" }].map(s => (
              <button key={s.k} onClick={() => setForumSort(s.k)}
                className="px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all"
                style={forumSort === s.k ? {
                  background: "rgba(96,165,250,0.15)", color: "#60a5fa", border: "1px solid rgba(96,165,250,0.25)",
                } : {
                  background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.35)", border: "1px solid rgba(255,255,255,0.07)",
                }}>
                {s.l}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {[
              { k: "all",      l: "Tout" },
              { k: "analyse",  l: "📊 Analyses" },
              { k: "crypto",   l: "₿ Crypto" },
              { k: "actions",  l: "📈 Actions" },
              { k: "question", l: "❓ Questions" },
            ].map(c => (
              <button key={c.k} onClick={() => setForumFilter(c.k)}
                className="px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all"
                style={forumFilter === c.k ? {
                  background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.8)", border: "1px solid rgba(255,255,255,0.15)",
                } : {
                  background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.25)", border: "1px solid rgba(255,255,255,0.06)",
                }}>
                {c.l}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2.5 scrollbar-hide">
          {allPosts.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-4xl mb-3">💬</p>
              <p className="font-black text-white mb-2">Aucun post</p>
              <p className="text-sm text-white/30">Sois le premier à publier !</p>
            </div>
          ) : allPosts.map(post => (
            <button key={post.id}
              onClick={() => { router.push(`/forum/${post.id}`); setForumOpen(false) }}
              className="w-full flex items-start gap-3 px-4 py-4 rounded-2xl text-left transition-all hover:bg-white/[0.03] group"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderLeft: `3px solid ${postBorderColor(post.category)}`,
              }}>
              <Avatar username={post.username ?? "?"} size={36} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  {post.pinned && <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-400">📌</span>}
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(96,165,250,0.1)", color: "#60a5fa" }}>
                    {post.category}
                  </span>
                  {post.symbol && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(34,197,94,0.1)", color: "#4ade80" }}>
                      ${post.symbol}
                    </span>
                  )}
                </div>
                <h3 className="text-sm font-black text-white group-hover:text-blue-400 transition-colors leading-snug mb-1 line-clamp-2">
                  {post.title}
                </h3>
                <p className="text-xs text-white/35 line-clamp-2 leading-relaxed mb-2">{post.content?.slice(0, 100)}</p>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-white/30 font-semibold">{post.username}</span>
                  <span className="text-white/15">·</span>
                  <span className="text-[10px] text-white/20">{timeAgo(post.created_at)}</span>
                  <div className="flex items-center gap-2 ml-auto">
                    <span className="text-[10px] text-white/25">❤️ {post.likes}</span>
                    <span className="text-[10px] text-white/25">💬 {post.replies_count ?? 0}</span>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>

        {user && (
          <div className="px-6 py-4 border-t flex-shrink-0" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
            <button className="w-full py-3 rounded-2xl text-sm font-black text-black transition-all hover:scale-[1.01]"
              style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)", boxShadow: "0 4px 20px rgba(34,197,94,0.3)" }}>
              ✍️ Écrire un nouveau post
            </button>
          </div>
        )}
      </div>

      {/* ══ POPUP PROFIL TRADER ════════════════════════════════════════════ */}
      {selectedProfile && (
        <>
          <div onClick={() => setSelectedProfile(null)} className="fixed inset-0 z-50"
            style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 rounded-3xl p-6 w-80"
            style={{ background: "rgba(10,16,10,0.98)", border: "1px solid rgba(245,158,11,0.25)", boxShadow: "0 20px 60px rgba(0,0,0,0.6)" }}>
            <button onClick={() => setSelectedProfile(null)}
              className="absolute top-4 right-4 text-white/30 hover:text-white transition">
              <X size={16} />
            </button>
            <div className="flex flex-col items-center text-center">
              {/* Avatar avec ring coloré */}
              <div className="p-1 rounded-2xl mb-3"
                style={{ background: getUserGradient(selectedProfile.username ?? "?") }}>
                <Avatar username={selectedProfile.username ?? "?"} size={64} />
              </div>
              <p className="text-xl font-black text-white mb-0.5">{selectedProfile.username}</p>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                <p className="text-[11px] text-white/35">Trader Tradex</p>
              </div>
              <div className="grid grid-cols-3 gap-3 w-full mb-4">
                {[
                  { label: "Portfolio",    value: `$${(selectedProfile.portfolio_value ?? 100000).toLocaleString()}` },
                  { label: "Performance", value: `${(selectedProfile.total_return_pct ?? 0) >= 0 ? "+" : ""}${(selectedProfile.total_return_pct ?? 0).toFixed(1)}%`, color: (selectedProfile.total_return_pct ?? 0) >= 0 ? "#4ade80" : "#f87171" },
                  { label: "Win Rate",    value: `${(selectedProfile.win_rate ?? 0).toFixed(0)}%` },
                ].map(stat => (
                  <div key={stat.label} className="rounded-xl p-2.5"
                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <p className="text-[9px] text-white/30 mb-1">{stat.label}</p>
                    <p className="text-sm font-black" style={{ color: stat.color ?? "rgba(255,255,255,0.85)" }}>{stat.value}</p>
                  </div>
                ))}
              </div>
              <button onClick={() => router.push(`/traders/${selectedProfile.user_id}`)}
                className="w-full py-2.5 rounded-xl text-xs font-black text-white/60 hover:text-white transition"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
                Voir le profil complet →
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
