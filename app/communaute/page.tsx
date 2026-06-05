"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Plus, Search, X } from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Post {
  id: string; user_id: string; username: string; avatar_color: string
  title: string; content: string; category: string; symbol: string | null
  likes: number; views: number; replies_count: number; pinned: boolean; created_at: string
}
interface LeaderboardEntry {
  rank: number; user_id: string; username: string; avatar_color: string
  portfolio_value: number; total_return_pct: number; win_rate: number; trades_count: number
}
interface Duel {
  id: string; challenger_username: string; opponent_username?: string
  challenger_pnl_pct: number; opponent_pnl_pct?: number
  duration_days: number; end_date: string; status: "pending" | "active" | "finished"
}
interface RoomMessage {
  id: string; user_id: string; username: string; avatar_color: string
  content: string; created_at: string; room: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { key: "all",         label: "Tout",       icon: "🌐" },
  { key: "analyse",     label: "Analyses",   icon: "📊" },
  { key: "question",    label: "Questions",  icon: "❓" },
  { key: "crypto",      label: "Crypto",     icon: "₿"  },
  { key: "actions",     label: "Actions",    icon: "📈" },
  { key: "psychologie", label: "Psycho",     icon: "🧠" },
  { key: "actualite",   label: "Actu",       icon: "📰" },
]

const ROOMS = [
  { key: "general", label: "Général",  emoji: "💬" },
  { key: "signaux", label: "Signaux",  emoji: "📡" },
  { key: "crypto",  label: "Crypto",   emoji: "₿"  },
  { key: "actions", label: "Actions",  emoji: "📈" },
]

const PODIUM_ORDER = [1, 0, 2]
const MEDALS = ["🥇", "🥈", "🥉"]

// ─── Utils ────────────────────────────────────────────────────────────────────

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 2) return "à l'instant"
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}j`
}

function getUserGradient(username: string) {
  const G = [
    "linear-gradient(135deg,#22c55e,#16a34a)","linear-gradient(135deg,#60a5fa,#3b82f6)",
    "linear-gradient(135deg,#f59e0b,#d97706)","linear-gradient(135deg,#a78bfa,#7c3aed)",
    "linear-gradient(135deg,#f87171,#dc2626)","linear-gradient(135deg,#34d399,#059669)",
    "linear-gradient(135deg,#fb923c,#ea580c)","linear-gradient(135deg,#e879f9,#a21caf)",
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

// ─── Section nav cards ────────────────────────────────────────────────────────

type Section = "forum" | "classement" | "duels" | "room"

const SECTION_META: Record<Section, {
  emoji: string; label: string; description: string
  color: string; bg: string; glow: string; border: string
}> = {
  forum:      { emoji: "💬", label: "Forum",      description: "Analyses & débats", color: "#60a5fa", bg: "rgba(96,165,250,0.07)",  glow: "rgba(96,165,250,0.15)",  border: "rgba(96,165,250,0.25)" },
  classement: { emoji: "🏆", label: "Classement", description: "Top traders",       color: "#fbbf24", bg: "rgba(251,191,36,0.07)",  glow: "rgba(251,191,36,0.15)",  border: "rgba(251,191,36,0.25)" },
  duels:      { emoji: "🥊", label: "Duels",      description: "Compétitions live", color: "#a78bfa", bg: "rgba(167,139,250,0.07)", glow: "rgba(167,139,250,0.15)", border: "rgba(167,139,250,0.25)" },
  room:       { emoji: "📡", label: "Live Room",  description: "Chat temps réel",   color: "#4ade80", bg: "rgba(34,197,94,0.07)",   glow: "rgba(34,197,94,0.15)",   border: "rgba(34,197,94,0.25)" },
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CommunautePage() {
  const router = useRouter()
  const [section, setSection] = useState<Section>("forum")
  const [user,    setUser]    = useState<any>(null)
  const [token,   setToken]   = useState("")
  const [profile, setProfile] = useState<{ username: string; avatar_color: string } | null>(null)

  // Forum
  const [posts,     setPosts]     = useState<Post[]>([])
  const [postLoad,  setPostLoad]  = useState(true)
  const [catFilter, setCatFilter] = useState("all")
  const [search,    setSearch]    = useState("")
  const [sort,      setSort]      = useState("recent")
  const [showNew,   setShowNew]   = useState(false)
  const [npTitle,   setNpTitle]   = useState("")
  const [npContent, setNpContent] = useState("")
  const [npCat,     setNpCat]     = useState("question")
  const [npSymbol,  setNpSymbol]  = useState("")
  const [npLoading, setNpLoading] = useState(false)
  const [npError,   setNpError]   = useState("")
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Leaderboard
  const [leaders,  setLeaders]  = useState<LeaderboardEntry[]>([])
  const [leadLoad, setLeadLoad] = useState(true)

  // Duels
  const [duels,    setDuels]    = useState<Duel[]>([])
  const [duelLoad, setDuelLoad] = useState(true)
  const [duelDur,  setDuelDur]  = useState(7)
  const [creating, setCreating] = useState(false)
  const [copied,   setCopied]   = useState<string | null>(null)

  // Room
  const [messages,  setMessages]  = useState<RoomMessage[]>([])
  const [roomInput, setRoomInput] = useState("")
  const [room,      setRoom]      = useState("general")
  const [online,    setOnline]    = useState(0)
  const [sending,   setSending]   = useState(false)
  const bottomRef  = useRef<HTMLDivElement>(null)
  const channelRef = useRef<any>(null)

  // Live stats for section cards
  const postsToday = posts.filter(p => Date.now() - new Date(p.created_at).getTime() < 86400000).length
  const activeduels = duels.filter(d => d.status === "active").length

  // ── Init ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
      if (!data.user) return
      supabase.auth.getSession().then(({ data: s }) => setToken(s.session?.access_token ?? ""))
      supabase.from("user_profiles").select("username,avatar_color").eq("id", data.user.id).single()
        .then(({ data: p }) => { if (p) setProfile(p) })
    })
  }, [])

  // ── Forum fetch ───────────────────────────────────────────────────────────────
  const fetchPosts = useCallback(async () => {
    setPostLoad(true)
    const res = await fetch(`/api/forum/posts?${new URLSearchParams({ category: catFilter, sort, search })}`)
    const json = await res.json()
    setPosts(json.posts ?? [])
    setPostLoad(false)
  }, [catFilter, sort, search])

  useEffect(() => {
    if (section !== "forum") return
    if (searchRef.current) clearTimeout(searchRef.current)
    searchRef.current = setTimeout(fetchPosts, search ? 400 : 0)
  }, [catFilter, sort, search, section, fetchPosts])

  async function submitPost() {
    if (!npTitle.trim() || !npContent.trim()) return
    setNpLoading(true); setNpError("")
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch("/api/forum/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ title: npTitle, content: npContent, category: npCat, symbol: npSymbol || null,
        username: profile?.username ?? user?.email?.split("@")[0] ?? "Trader",
        avatar_color: profile?.avatar_color ?? "#22c55e" }),
    })
    const json = await res.json()
    setNpLoading(false)
    if (json.error) { setNpError(json.error); return }
    setShowNew(false); setNpTitle(""); setNpContent(""); setNpSymbol("")
    fetchPosts()
  }

  // ── Leaderboard ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (section !== "classement") return
    fetch("/api/leaderboard").then(r => r.json())
      .then(d => { setLeaders(d.leaderboard ?? []); setLeadLoad(false) })
      .catch(() => setLeadLoad(false))
  }, [section])

  // ── Duels ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (section !== "duels" || !token) return
    fetch("/api/duel", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => { setDuels(d.duels ?? []); setDuelLoad(false) })
      .catch(() => setDuelLoad(false))
  }, [section, token])

  async function createDuel() {
    if (!token) return
    setCreating(true)
    const res = await fetch("/api/duel", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ duration_days: duelDur }),
    })
    const json = await res.json()
    if (json.duel) setDuels(d => [json.duel, ...d])
    setCreating(false)
  }

  // ── Room ──────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (section !== "room" || !user) return
    supabase.from("trading_room_messages").select("*").eq("room", room)
      .order("created_at", { ascending: false }).limit(60)
      .then(({ data }) => setMessages((data ?? []).reverse()))
    if (channelRef.current) supabase.removeChannel(channelRef.current)
    const ch = supabase.channel(`room:${room}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "trading_room_messages", filter: `room=eq.${room}` },
        p => setMessages(m => [...m, p.new as RoomMessage]))
      .on("presence", { event: "sync" }, () => setOnline(Object.keys(ch.presenceState()).length))
      .subscribe(async s => {
        if (s === "SUBSCRIBED") await ch.track({ user_id: user.id, username: profile?.username ?? "Trader" })
      })
    channelRef.current = ch
    return () => { supabase.removeChannel(ch) }
  }, [section, room, user])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }) }, [messages])

  async function sendMessage() {
    if (!roomInput.trim() || !user || sending) return
    setSending(true)
    await supabase.from("trading_room_messages").insert({
      user_id: user.id, username: profile?.username ?? "Trader",
      avatar_color: profile?.avatar_color ?? "#22c55e", content: roomInput.trim(), room,
    })
    setRoomInput(""); setSending(false)
  }

  const meta = SECTION_META[section]

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col page-enter" style={{ background: "transparent" }}>

      {/* ══════════════════════════════════════════════════════════════
          HERO — Page header with live community pulse
      ══════════════════════════════════════════════════════════════ */}
      <div className="px-6 pt-7 pb-5 flex-shrink-0">
        <div className="max-w-5xl mx-auto">

          {/* Title */}
          <div className="mb-6">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] mb-1" style={{ color: "var(--green-light)" }}>
              Communauté
            </p>
            <h1 className="text-[26px] font-black text-white leading-tight">Traders Tradex</h1>
          </div>

          {/* ── Section Cards — the "navigation" ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {(["forum","classement","duels","room"] as Section[]).map(key => {
              const m   = SECTION_META[key]
              const active = section === key

              // Live stat per section
              const stat = key === "forum"      ? `${postsToday > 0 ? postsToday + " posts today" : "Partage une analyse"}`
                         : key === "classement" ? `${leaders[0]?.username ? "#1 " + leaders[0].username : "Voir le podium"}`
                         : key === "duels"      ? `${activeduels > 0 ? activeduels + " duel" + (activeduels > 1 ? "s" : "") + " actif" + (activeduels > 1 ? "s" : "") : "Lance un défi"}`
                         :                        `${online > 0 ? online + " en ligne" : "Rejoins la room"}`

              return (
                <button key={key} onClick={() => setSection(key)}
                  className="relative text-left rounded-2xl p-4 transition-all duration-200 group overflow-hidden"
                  style={{
                    background: active ? m.bg : "var(--bg-surface)",
                    border: `1px solid ${active ? m.border : "var(--border-subtle)"}`,
                    boxShadow: active ? `0 0 32px ${m.glow}, 0 4px 16px rgba(0,0,0,0.3)` : "none",
                    transform: active ? "translateY(-1px)" : "none",
                  }}
                  onMouseEnter={e => {
                    if (!active) {
                      e.currentTarget.style.borderColor = m.border
                      e.currentTarget.style.background = m.bg
                    }
                  }}
                  onMouseLeave={e => {
                    if (!active) {
                      e.currentTarget.style.borderColor = "var(--border-subtle)"
                      e.currentTarget.style.background = "var(--bg-surface)"
                    }
                  }}>

                  {/* Glow orb */}
                  {active && (
                    <div className="absolute top-0 right-0 w-20 h-20 rounded-full blur-2xl opacity-30 pointer-events-none"
                      style={{ background: m.color }} />
                  )}

                  <div className="relative">
                    {/* Icon */}
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg mb-3 transition-all"
                      style={{
                        background: active ? `${m.color}20` : "var(--bg-active)",
                        border: `1px solid ${active ? `${m.color}30` : "var(--border-subtle)"}`,
                      }}>
                      {m.emoji}
                    </div>

                    {/* Label */}
                    <p className="text-[14px] font-black leading-none mb-1.5"
                      style={{ color: active ? m.color : "var(--text-primary)" }}>
                      {m.label}
                    </p>

                    {/* Description */}
                    <p className="text-[11px] mb-2" style={{ color: "var(--text-muted)" }}>
                      {m.description}
                    </p>

                    {/* Live stat */}
                    <p className="text-[11px] font-bold truncate" style={{ color: active ? m.color : "var(--text-tertiary)" }}>
                      {stat}
                    </p>

                    {/* Active indicator dot */}
                    {active && (
                      <div className="absolute top-0 right-0 w-2 h-2 rounded-full"
                        style={{ background: m.color, boxShadow: `0 0 6px ${m.color}` }} />
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          CONTENT AREA
      ══════════════════════════════════════════════════════════════ */}
      <div className="flex-1 px-6 pb-8 min-h-0">
        <div className="max-w-5xl mx-auto">

          {/* Section context bar */}
          <div className="flex items-center justify-between mb-5 pt-1">
            <div className="flex items-center gap-2.5">
              <div className="w-1.5 h-5 rounded-full" style={{ background: meta.color }} />
              <p className="text-[14px] font-black text-white">{meta.label}</p>
              <p className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>— {meta.description}</p>
            </div>

            {/* Section CTA */}
            {section === "forum" && user && (
              <button onClick={() => setShowNew(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-black text-black transition-all hover:scale-[1.02]"
                style={{ background: `linear-gradient(135deg, ${meta.color}, #3b82f6)`, boxShadow: `0 4px 16px ${meta.glow}` }}>
                <Plus size={13} />
                Nouveau post
              </button>
            )}
            {section === "duels" && user && (
              <button onClick={createDuel} disabled={creating}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-black transition-all hover:scale-[1.02] disabled:opacity-50"
                style={{ background: meta.bg, border: `1px solid ${meta.border}`, color: meta.color }}>
                🥊 {creating ? "Création…" : "Nouveau duel"}
              </button>
            )}
          </div>

          {/* ══════ FORUM ════════════════════════════════════ */}
          {section === "forum" && (
            <div className="flex gap-5">

              {/* Categories sidebar */}
              <div className="hidden lg:flex flex-col w-44 flex-shrink-0 gap-0.5">
                {CATEGORIES.map(cat => {
                  const count  = cat.key === "all" ? posts.length : posts.filter(p => p.category === cat.key).length
                  const active = catFilter === cat.key
                  return (
                    <button key={cat.key} onClick={() => setCatFilter(cat.key)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-[12px] font-medium text-left transition-all"
                      style={active ? {
                        background: "rgba(96,165,250,0.10)",
                        color: "#60a5fa",
                        border: "1px solid rgba(96,165,250,0.22)",
                      } : {
                        color: "var(--text-tertiary)",
                        border: "1px solid transparent",
                      }}>
                      <span className="text-sm">{cat.icon}</span>
                      <span className="flex-1">{cat.label}</span>
                      {count > 0 && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                          style={{ background: "var(--bg-active)", color: "var(--text-muted)" }}>
                          {count}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Posts */}
              <div className="flex-1 min-w-0">

                {/* Search + sort */}
                <div className="flex gap-2 mb-4">
                  <div className="flex-1 relative">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-muted)" }} />
                    <input value={search} onChange={e => setSearch(e.target.value)}
                      placeholder="Rechercher…"
                      className="w-full pl-9 pr-4 py-2.5 rounded-xl text-[13px] outline-none"
                      style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", color: "white" }}
                      onFocus={e => (e.target.style.borderColor = "rgba(96,165,250,0.5)")}
                      onBlur={e => (e.target.style.borderColor = "var(--border-subtle)")}
                    />
                  </div>
                  <div className="flex rounded-xl overflow-hidden" style={{ border: "1px solid var(--border-subtle)" }}>
                    {(["recent","popular","replies"] as const).map(k => (
                      <button key={k} onClick={() => setSort(k)}
                        className="px-3 py-2.5 text-[11px] font-bold transition-all"
                        style={sort === k ? { background: "var(--bg-active)", color: "white" } : { background: "var(--bg-surface)", color: "var(--text-muted)" }}>
                        {k === "recent" ? "Récents" : k === "popular" ? "Populaires" : "Actifs"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Post list */}
                {postLoad ? (
                  <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-[88px] skeleton rounded-2xl" />)}</div>
                ) : posts.length === 0 ? (
                  <div className="text-center py-20 rounded-2xl" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
                    <p className="text-3xl mb-3">💬</p>
                    <p className="text-[15px] font-black text-white mb-1">Aucun post trouvé</p>
                    <p className="text-[12px] mb-4" style={{ color: "var(--text-tertiary)" }}>Sois le premier à partager une analyse !</p>
                    {user && <button onClick={() => setShowNew(true)} className="px-5 py-2.5 rounded-xl text-[12px] font-black text-black" style={{ background: "#22c55e" }}>Créer →</button>}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {posts.map(post => {
                      const cat = CATEGORIES.find(c => c.key === post.category)
                      return (
                        <article key={post.id} onClick={() => router.push(`/forum/${post.id}`)}
                          className="group rounded-2xl p-4 cursor-pointer transition-all hover:-translate-y-px"
                          style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}
                          onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(96,165,250,0.28)")}
                          onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border-subtle)")}>
                          {post.pinned && <p className="text-[10px] font-black text-yellow-400 uppercase tracking-wider mb-2">📌 Épinglé</p>}
                          <div className="flex items-start gap-3">
                            <Avatar username={post.username} size={34} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <span className="text-[12px] font-semibold" style={{ color: "var(--text-secondary)" }}>{post.username}</span>
                                <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>· {timeAgo(post.created_at)}</span>
                                {cat && <span className="text-[10px] px-1.5 py-0.5 rounded-md font-bold" style={{ background: "var(--bg-active)", color: "var(--text-secondary)", border: "1px solid var(--border-subtle)" }}>{cat.icon} {cat.label}</span>}
                                {post.symbol && <span className="text-[10px] px-1.5 py-0.5 rounded-md font-black" style={{ background: "var(--blue-dim)", color: "var(--blue-light)", border: "1px solid rgba(59,130,246,0.2)" }}>${post.symbol}</span>}
                              </div>
                              <h3 className="text-[14px] font-black text-white group-hover:text-blue-400 transition-colors line-clamp-1 mb-1 leading-snug">{post.title}</h3>
                              <p className="text-[12px] line-clamp-1 mb-2" style={{ color: "var(--text-tertiary)" }}>{post.content}</p>
                              <div className="flex items-center gap-4 text-[11px]" style={{ color: "var(--text-muted)" }}>
                                <span>❤️ {post.likes}</span><span>💬 {post.replies_count}</span><span>👁 {post.views}</span>
                              </div>
                            </div>
                          </div>
                        </article>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══════ CLASSEMENT ════════════════════════════════ */}
          {section === "classement" && (
            <div className="max-w-xl mx-auto">
              {leadLoad ? (
                <div className="space-y-2">{[...Array(8)].map((_, i) => <div key={i} className="h-14 skeleton rounded-2xl" />)}</div>
              ) : leaders.length < 3 ? (
                <div className="text-center py-20 rounded-2xl" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
                  <p className="text-4xl mb-3">🏆</p>
                  <p className="text-[15px] font-black text-white mb-1">Classement bientôt disponible</p>
                  <p className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>Plus de traders nécessaires pour débloquer le classement.</p>
                </div>
              ) : (
                <>
                  {/* Podium */}
                  <div className="flex items-end justify-center gap-6 mb-8 pt-4 pb-2">
                    {PODIUM_ORDER.map((idx, podiumPos) => {
                      const t = leaders[idx]; if (!t) return null
                      const isGold = idx === 0
                      const heights = [96, 128, 80]
                      return (
                        <div key={t.username} className="flex flex-col items-center gap-2">
                          <Avatar username={t.username} size={isGold ? 48 : 38} />
                          <p className="text-[12px] font-black text-white text-center max-w-[80px] truncate">{t.username}</p>
                          <p className={`text-[12px] font-black tabular-nums ${t.total_return_pct >= 0 ? "text-green-400" : "text-red-400"}`}>
                            {t.total_return_pct >= 0 ? "+" : ""}{t.total_return_pct.toFixed(1)}%
                          </p>
                          <div className="w-20 rounded-t-2xl flex items-center justify-center text-xl"
                            style={{
                              height: heights[podiumPos],
                              background: idx === 0 ? "rgba(251,191,36,0.12)" : idx === 1 ? "rgba(255,255,255,0.05)" : "rgba(234,88,12,0.10)",
                              border: `1px solid ${idx === 0 ? "rgba(251,191,36,0.25)" : idx === 1 ? "rgba(255,255,255,0.10)" : "rgba(234,88,12,0.18)"}`,
                            }}>
                            {MEDALS[idx]}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Table */}
                  <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border-subtle)" }}>
                    {leaders.map((e, i) => (
                      <div key={e.username}
                        className="flex items-center gap-3 px-4 py-3.5 transition-all hover:bg-white/[0.02]"
                        style={{ borderBottom: i < leaders.length - 1 ? "1px solid var(--border-faint)" : "none", background: i === 0 ? "rgba(251,191,36,0.03)" : "transparent" }}>
                        <span className="text-[13px] font-black w-8 text-center" style={{ color: i < 3 ? "#fbbf24" : "var(--text-muted)" }}>
                          {i < 3 ? MEDALS[i] : `#${i + 1}`}
                        </span>
                        <Avatar username={e.username} size={32} />
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-semibold text-white truncate">{e.username}</p>
                          <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{e.trades_count} trades · {e.win_rate.toFixed(0)}% win</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[13px] font-black text-white tabular-nums">${e.portfolio_value.toLocaleString("en-US", { maximumFractionDigits: 0 })}</p>
                          <p className={`text-[11px] font-black tabular-nums ${e.total_return_pct >= 0 ? "text-green-400" : "text-red-400"}`}>
                            {e.total_return_pct >= 0 ? "+" : ""}{e.total_return_pct.toFixed(2)}%
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ══════ DUELS ══════════════════════════════════════ */}
          {section === "duels" && (
            <div className="max-w-xl mx-auto space-y-4">

              {/* Create card */}
              {user && (
                <div className="rounded-2xl p-5" style={{ background: "rgba(167,139,250,0.06)", border: "1px solid rgba(167,139,250,0.2)" }}>
                  <p className="text-[13px] font-black text-white mb-3">Créer un nouveau duel</p>
                  <div className="flex gap-2 mb-3">
                    {[3, 7, 14].map(d => (
                      <button key={d} onClick={() => setDuelDur(d)}
                        className="flex-1 py-2 rounded-xl text-[12px] font-black transition-all"
                        style={duelDur === d ? {
                          background: "rgba(167,139,250,0.18)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.35)"
                        } : { background: "var(--bg-active)", color: "var(--text-tertiary)", border: "1px solid var(--border-subtle)" }}>
                        {d} jours
                      </button>
                    ))}
                  </div>
                  <button onClick={createDuel} disabled={creating}
                    className="w-full py-3 rounded-2xl font-black text-[13px] text-white transition-all hover:scale-[1.01] disabled:opacity-50"
                    style={{ background: "linear-gradient(135deg,#a78bfa,#7c3aed)", boxShadow: "0 4px 20px rgba(167,139,250,0.25)" }}>
                    {creating ? "Création…" : "🥊 Lancer le duel →"}
                  </button>
                </div>
              )}

              {/* Duels list */}
              {duelLoad ? (
                <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-24 skeleton rounded-2xl" />)}</div>
              ) : duels.length === 0 ? (
                <div className="text-center py-16 rounded-2xl" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
                  <p className="text-3xl mb-2">🥊</p>
                  <p className="text-[15px] font-black text-white mb-1">Aucun duel en cours</p>
                  <p className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>Crée un duel et défie un ami !</p>
                </div>
              ) : duels.map(duel => {
                const myPnl = duel.challenger_pnl_pct ?? 0
                const oppPnl = duel.opponent_pnl_pct ?? 0
                const winning = myPnl > oppPnl
                const daysLeft = Math.max(0, Math.ceil((new Date(duel.end_date).getTime() - Date.now()) / 86400000))
                return (
                  <div key={duel.id} className="rounded-2xl p-4"
                    style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
                    <div className="flex items-center justify-between mb-3">
                      <span className={`text-[10px] font-black px-2.5 py-1 rounded-full ${
                        duel.status === "pending" ? "bg-yellow-500/15 text-yellow-400" :
                        duel.status === "active"  ? "bg-green-500/15 text-green-400" : "bg-white/8 text-white/40"
                      }`}>
                        {duel.status === "pending" ? "⏳ En attente" : duel.status === "active" ? "🔴 Live" : "✅ Terminé"}
                      </span>
                      <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{duel.duration_days}j · {daysLeft > 0 ? `${daysLeft}j restants` : "Terminé"}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      {[
                        { label: duel.challenger_username, pnl: myPnl,  h: winning },
                        { label: duel.opponent_username ?? "En attente…", pnl: oppPnl, h: !winning && !!duel.opponent_username },
                      ].map((side, si) => (
                        <div key={si} className="rounded-xl p-3 text-center"
                          style={{ background: side.h ? "rgba(34,197,94,0.07)" : "var(--bg-active)", border: `1px solid ${side.h ? "rgba(34,197,94,0.18)" : "var(--border-subtle)"}` }}>
                          <p className="text-[11px] mb-1 truncate" style={{ color: "var(--text-tertiary)" }}>{side.label}</p>
                          <p className={`text-[18px] font-black tabular-nums ${side.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                            {side.pnl >= 0 ? "+" : ""}{side.pnl.toFixed(2)}%
                          </p>
                        </div>
                      ))}
                    </div>
                    {duel.status === "pending" && (
                      <div className="flex gap-2">
                        <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/duel?invite=${duel.id}`); setCopied(duel.id); setTimeout(() => setCopied(null), 2000) }}
                          className="flex-1 py-2 rounded-xl text-[12px] font-black transition-all"
                          style={copied === duel.id ? { background: "var(--green-dim)", color: "var(--green-light)", border: "1px solid var(--green-border)" } : { background: "var(--bg-active)", color: "var(--text-secondary)", border: "1px solid var(--border-default)" }}>
                          {copied === duel.id ? "✓ Copié" : "📋 Copier l'invitation"}
                        </button>
                        <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Je te défie sur Tradex 🥊 ! ${window.location.origin}/duel?invite=${duel.id}`)}`} target="_blank" rel="noopener"
                          className="flex-1 py-2 rounded-xl text-[12px] font-black text-center transition-all"
                          style={{ background: "rgba(29,161,242,0.1)", border: "1px solid rgba(29,161,242,0.25)", color: "#1da1f2" }}>
                          𝕏 Défier
                        </a>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* ══════ ROOM ═══════════════════════════════════════ */}
          {section === "room" && (
            <div className="max-w-2xl mx-auto flex flex-col" style={{ height: "calc(100vh - 340px)", minHeight: 400 }}>

              {/* Room selector */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex gap-1 p-1 rounded-xl" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
                  {ROOMS.map(r => (
                    <button key={r.key} onClick={() => setRoom(r.key)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold transition-all"
                      style={room === r.key ? { background: "rgba(34,197,94,0.10)", color: "var(--green-light)" } : { color: "var(--text-tertiary)" }}>
                      {r.emoji} {r.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ background: "var(--green)", animation: "live-pulse 2s infinite" }} />
                  <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>{online} en ligne</span>
                </div>
              </div>

              {/* Messages area */}
              <div className="flex-1 overflow-y-auto scrollbar-hide space-y-3 min-h-0 rounded-2xl p-4"
                style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
                {messages.length === 0 && (
                  <div className="text-center py-10">
                    <p className="text-2xl mb-2">{ROOMS.find(r => r.key === room)?.emoji}</p>
                    <p className="text-[13px]" style={{ color: "var(--text-tertiary)" }}>Sois le premier à écrire dans {ROOMS.find(r => r.key === room)?.label} !</p>
                  </div>
                )}
                {messages.map((msg, i) => {
                  const isMe = msg.user_id === user?.id
                  const showAvatar = i === 0 || messages[i - 1].user_id !== msg.user_id
                  return (
                    <div key={msg.id} className={`flex gap-2.5 ${isMe ? "flex-row-reverse" : ""}`}>
                      <div className="flex-shrink-0 mt-0.5">
                        {!isMe && showAvatar ? <Avatar username={msg.username} size={26} /> : <div className="w-[26px]" />}
                      </div>
                      <div className={`flex flex-col max-w-[75%] ${isMe ? "items-end" : "items-start"}`}>
                        {showAvatar && !isMe && (
                          <p className="text-[10px] font-bold mb-0.5" style={{ color: "var(--text-muted)" }}>{msg.username} · {timeAgo(msg.created_at)}</p>
                        )}
                        <div className="px-3.5 py-2.5 text-[13px] leading-snug"
                          style={isMe ? {
                            background: "linear-gradient(135deg,#22c55e,#16a34a)", color: "black", fontWeight: 600,
                            borderRadius: "18px 18px 4px 18px",
                          } : {
                            background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)",
                            borderRadius: "18px 18px 18px 4px",
                          }}>
                          {msg.content}
                        </div>
                      </div>
                    </div>
                  )
                })}
                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <div className="mt-3">
                {user ? (
                  <div className="flex gap-2">
                    <input value={roomInput} onChange={e => setRoomInput(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                      placeholder={`Message dans ${ROOMS.find(r => r.key === room)?.label}…`}
                      className="flex-1 px-4 py-3 rounded-2xl text-[13px] text-white outline-none"
                      style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
                      onFocus={e => (e.target.style.borderColor = "var(--border-focus)")}
                      onBlur={e => (e.target.style.borderColor = "var(--border-default)")}
                    />
                    <button onClick={sendMessage} disabled={!roomInput.trim() || sending}
                      className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all hover:scale-110 disabled:opacity-30"
                      style={{ background: "linear-gradient(135deg,#22c55e,#16a34a)" }}>
                      <svg width="14" height="14" fill="none" stroke="black" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-3.5 rounded-2xl" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
                    <a href="/login" className="text-[13px] font-bold" style={{ color: "var(--green-light)" }}>Connecte-toi pour participer →</a>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          NEW POST MODAL
      ══════════════════════════════════════════════════════════════ */}
      {showNew && user && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(10px)" }}
          onClick={() => setShowNew(false)}>
          <div className="w-full max-w-lg rounded-3xl p-6 animate-scale-in"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)", boxShadow: "var(--shadow-xl)" }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[16px] font-black text-white">Nouveau post</h2>
              <button onClick={() => setShowNew(false)} className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:bg-white/8" style={{ color: "var(--text-tertiary)" }}>
                <X size={16} />
              </button>
            </div>
            <div className="space-y-3">
              <input value={npTitle} onChange={e => setNpTitle(e.target.value)} placeholder="Titre du post"
                className="w-full px-4 py-3 rounded-xl text-[13px] text-white outline-none"
                style={{ background: "var(--bg-active)", border: "1px solid var(--border-default)" }}
                onFocus={e => (e.target.style.borderColor = "var(--border-focus)")}
                onBlur={e => (e.target.style.borderColor = "var(--border-default)")}
              />
              <textarea value={npContent} onChange={e => setNpContent(e.target.value)} placeholder="Contenu…" rows={5}
                className="w-full px-4 py-3 rounded-xl text-[13px] text-white outline-none resize-none"
                style={{ background: "var(--bg-active)", border: "1px solid var(--border-default)" }}
                onFocus={e => (e.target.style.borderColor = "var(--border-focus)")}
                onBlur={e => (e.target.style.borderColor = "var(--border-default)")}
              />
              <div className="flex gap-2">
                <select value={npCat} onChange={e => setNpCat(e.target.value)}
                  className="flex-1 px-3 py-2.5 rounded-xl text-[13px] text-white outline-none"
                  style={{ background: "var(--bg-active)", border: "1px solid var(--border-default)" }}>
                  {CATEGORIES.filter(c => c.key !== "all").map(c => <option key={c.key} value={c.key} className="bg-[#111]">{c.icon} {c.label}</option>)}
                </select>
                <input value={npSymbol} onChange={e => setNpSymbol(e.target.value.toUpperCase())} placeholder="Ticker (optionnel)"
                  className="w-36 px-3 py-2.5 rounded-xl text-[13px] text-white outline-none"
                  style={{ background: "var(--bg-active)", border: "1px solid var(--border-default)" }}
                />
              </div>
            </div>
            {npError && <p className="text-[12px] text-red-400 mt-3">{npError}</p>}
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowNew(false)}
                className="px-4 py-2.5 rounded-xl text-[13px] font-semibold"
                style={{ background: "var(--bg-active)", color: "var(--text-tertiary)", border: "1px solid var(--border-default)" }}>
                Annuler
              </button>
              <button onClick={submitPost} disabled={npLoading || !npTitle.trim() || !npContent.trim()}
                className="px-5 py-2.5 rounded-xl text-[13px] font-black text-black transition-all hover:scale-[1.02] disabled:opacity-50"
                style={{ background: "linear-gradient(135deg,#60a5fa,#3b82f6)" }}>
                {npLoading ? "Publication…" : "Publier →"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
