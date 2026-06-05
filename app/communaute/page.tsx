"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { MessageSquare, Trophy, Swords, Radio, Plus, Search, X } from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Post {
  id: string
  user_id: string
  username: string
  avatar_color: string
  title: string
  content: string
  category: string
  symbol: string | null
  likes: number
  views: number
  replies_count: number
  pinned: boolean
  created_at: string
}

interface LeaderboardEntry {
  rank: number
  user_id: string
  username: string
  avatar_color: string
  portfolio_value: number
  total_return_pct: number
  win_rate: number
  trades_count: number
}

interface Duel {
  id: string
  challenger_username: string
  opponent_username?: string
  challenger_pnl_pct: number
  opponent_pnl_pct?: number
  duration_days: number
  end_date: string
  status: "pending" | "active" | "finished"
}

interface RoomMessage {
  id: string
  user_id: string
  username: string
  avatar_color: string
  content: string
  created_at: string
  room: string
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
  { key: "general", label: "Général", emoji: "💬" },
  { key: "signaux", label: "Signaux", emoji: "📡" },
  { key: "crypto",  label: "Crypto",  emoji: "₿"  },
  { key: "actions", label: "Actions", emoji: "📈" },
]

const TABS = [
  { key: "forum",      label: "Forum",       icon: MessageSquare },
  { key: "classement", label: "Classement",  icon: Trophy        },
  { key: "duels",      label: "Duels",       icon: Swords        },
  { key: "room",       label: "Live Room",   icon: Radio         },
]

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

function getUserGradient(username: string): string {
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
      style={{
        width: size, height: size,
        background: getUserGradient(username),
        fontSize: Math.max(10, size * 0.38),
      }}>
      {(username || "?")[0].toUpperCase()}
    </div>
  )
}

const PODIUM_ORDER = [1, 0, 2]
const MEDALS = ["🥇", "🥈", "🥉"]
const PODIUM_H = ["h-24", "h-32", "h-20"]

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CommunautePage() {
  const router  = useRouter()
  const [tab,   setTab]   = useState<"forum" | "classement" | "duels" | "room">("forum")
  const [user,  setUser]  = useState<any>(null)
  const [token, setToken] = useState("")
  const [profile, setProfile] = useState<{ username: string; avatar_color: string } | null>(null)

  // Forum
  const [posts,    setPosts]    = useState<Post[]>([])
  const [postLoad, setPostLoad] = useState(true)
  const [catFilter,setCatFilter]= useState("all")
  const [search,   setSearch]   = useState("")
  const [sort,     setSort]     = useState("recent")
  const [showNew,  setShowNew]  = useState(false)
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // New post modal state
  const [npTitle,   setNpTitle]   = useState("")
  const [npContent, setNpContent] = useState("")
  const [npCat,     setNpCat]     = useState("question")
  const [npSymbol,  setNpSymbol]  = useState("")
  const [npLoading, setNpLoading] = useState(false)
  const [npError,   setNpError]   = useState("")

  // Leaderboard
  const [leaders,   setLeaders]   = useState<LeaderboardEntry[]>([])
  const [leadLoad,  setLeadLoad]  = useState(true)

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
  const bottomRef = useRef<HTMLDivElement>(null)
  const channelRef = useRef<any>(null)

  // ── Init ────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
      if (!data.user) return
      supabase.auth.getSession().then(({ data: s }) => setToken(s.session?.access_token ?? ""))
      supabase.from("user_profiles").select("username,avatar_color").eq("id", data.user.id).single()
        .then(({ data: p }) => { if (p) setProfile(p) })
    })
  }, [])

  // ── Forum ────────────────────────────────────────────────────
  const fetchPosts = useCallback(async () => {
    setPostLoad(true)
    const params = new URLSearchParams({ category: catFilter, sort, search })
    const res = await fetch(`/api/forum/posts?${params}`)
    const json = await res.json()
    setPosts(json.posts ?? [])
    setPostLoad(false)
  }, [catFilter, sort, search])

  useEffect(() => {
    if (tab !== "forum") return
    if (searchRef.current) clearTimeout(searchRef.current)
    searchRef.current = setTimeout(fetchPosts, search ? 400 : 0)
  }, [catFilter, sort, search, tab, fetchPosts])

  async function submitPost() {
    if (!npTitle.trim() || !npContent.trim()) return
    setNpLoading(true); setNpError("")
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch("/api/forum/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({
        title: npTitle, content: npContent, category: npCat,
        symbol: npSymbol || null,
        username: profile?.username ?? user?.email?.split("@")[0] ?? "Trader",
        avatar_color: profile?.avatar_color ?? "#22c55e",
      }),
    })
    const json = await res.json()
    setNpLoading(false)
    if (json.error) { setNpError(json.error); return }
    setShowNew(false); setNpTitle(""); setNpContent(""); setNpSymbol("")
    fetchPosts()
  }

  // ── Leaderboard ──────────────────────────────────────────────
  useEffect(() => {
    if (tab !== "classement") return
    fetch("/api/leaderboard").then(r => r.json()).then(d => {
      setLeaders(d.leaderboard ?? [])
      setLeadLoad(false)
    }).catch(() => setLeadLoad(false))
  }, [tab])

  // ── Duels ────────────────────────────────────────────────────
  useEffect(() => {
    if (tab !== "duels" || !token) return
    fetch("/api/duel", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => { setDuels(d.duels ?? []); setDuelLoad(false) })
      .catch(() => setDuelLoad(false))
  }, [tab, token])

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

  // ── Room ─────────────────────────────────────────────────────
  useEffect(() => {
    if (tab !== "room" || !user) return
    supabase.from("trading_room_messages").select("*").eq("room", room)
      .order("created_at", { ascending: false }).limit(50)
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
  }, [tab, room, user])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  async function sendMessage() {
    if (!roomInput.trim() || !user || sending) return
    setSending(true)
    await supabase.from("trading_room_messages").insert({
      user_id: user.id,
      username: profile?.username ?? user.email?.split("@")[0] ?? "Trader",
      avatar_color: profile?.avatar_color ?? "#22c55e",
      content: roomInput.trim(),
      room,
    })
    setRoomInput("")
    setSending(false)
  }

  // ─── Stats header data ────────────────────────────────────────
  const stats = [
    { label: "Posts aujourd'hui",   value: posts.filter(p => Date.now() - new Date(p.created_at).getTime() < 86400000).length || "—" },
    { label: "Membres en ligne",    value: online || "—" },
    { label: "Duels actifs",        value: duels.filter(d => d.status === "active").length || "—" },
    { label: "Top trader du jour",  value: leaders[0]?.username ? `@${leaders[0].username}` : "—" },
  ]

  return (
    <div className="min-h-screen page-enter flex flex-col">

      {/* ── Hero header ─────────────────────────────────────── */}
      <div className="flex-shrink-0 px-6 pt-6 pb-0">
        <div className="max-w-6xl mx-auto">

          {/* Title row */}
          <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] mb-1" style={{ color: "var(--green-light)" }}>
                Communauté
              </p>
              <h1 className="text-[22px] font-black text-white">Traders Tradex</h1>
              <p className="text-[13px] mt-0.5" style={{ color: "var(--text-tertiary)" }}>
                Forum · Classement · Duels · Chat live
              </p>
            </div>
            {user && tab === "forum" && (
              <button onClick={() => setShowNew(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-black text-black transition-all hover:scale-[1.02]"
                style={{ background: "linear-gradient(135deg,#22c55e,#16a34a)", boxShadow: "0 4px 16px rgba(34,197,94,0.28)" }}>
                <Plus size={14} />
                Nouveau post
              </button>
            )}
            {user && tab === "duels" && (
              <button onClick={createDuel} disabled={creating}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-black transition-all hover:scale-[1.02] disabled:opacity-50"
                style={{ background: "rgba(167,139,250,0.15)", border: "1px solid rgba(167,139,250,0.3)", color: "#a78bfa" }}>
                <Swords size={14} />
                {creating ? "Création…" : "Nouveau duel"}
              </button>
            )}
          </div>

          {/* Tab bar */}
          <div className="flex gap-1 border-b" style={{ borderColor: "var(--border-faint)" }}>
            {TABS.map(t => {
              const Icon = t.icon
              const active = tab === t.key
              return (
                <button key={t.key} onClick={() => setTab(t.key as any)}
                  className="flex items-center gap-2 px-4 py-3 text-[13px] font-semibold transition-all relative"
                  style={{ color: active ? "white" : "var(--text-tertiary)" }}>
                  <Icon size={14} />
                  {t.label}
                  {active && (
                    <span className="absolute bottom-0 left-0 right-0 h-[2px] rounded-t-full"
                      style={{ background: "var(--green)" }} />
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Tab content ─────────────────────────────────────── */}
      <div className="flex-1 px-6 py-6 min-h-0">
        <div className="max-w-6xl mx-auto h-full">

          {/* ════ FORUM ════════════════════════════════════════ */}
          {tab === "forum" && (
            <div className="flex gap-5 h-full">

              {/* Left sidebar: categories */}
              <div className="hidden lg:flex flex-col w-48 flex-shrink-0 gap-0.5">
                <p className="label mb-2 px-2">Catégories</p>
                {CATEGORIES.map(cat => {
                  const count = cat.key === "all" ? posts.length : posts.filter(p => p.category === cat.key).length
                  const active = catFilter === cat.key
                  return (
                    <button key={cat.key}
                      onClick={() => setCatFilter(cat.key)}
                      className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] font-medium text-left transition-all"
                      style={active ? {
                        background: "var(--bg-selected)",
                        color: "var(--green-light)",
                        border: "1px solid var(--green-border)",
                      } : {
                        color: "var(--text-tertiary)",
                        border: "1px solid transparent",
                      }}>
                      <span>{cat.icon}</span>
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

              {/* Main: posts list */}
              <div className="flex-1 min-w-0">

                {/* Search + sort bar */}
                <div className="flex gap-2 mb-4">
                  <div className="flex-1 relative">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
                    <input value={search} onChange={e => setSearch(e.target.value)}
                      placeholder="Rechercher un post…"
                      className="w-full pl-9 pr-4 py-2.5 rounded-xl text-[13px] outline-none transition-all"
                      style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", color: "white" }}
                      onFocus={e => (e.target.style.borderColor = "var(--border-focus)")}
                      onBlur={e => (e.target.style.borderColor = "var(--border-subtle)")}
                    />
                  </div>
                  <div className="flex gap-1 rounded-xl p-1" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
                    {(["recent","popular","replies"] as const).map(k => (
                      <button key={k} onClick={() => setSort(k)}
                        className="px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all capitalize"
                        style={sort === k ? { background: "var(--bg-active)", color: "white" } : { color: "var(--text-tertiary)" }}>
                        {k === "recent" ? "Récents" : k === "popular" ? "Populaires" : "Actifs"}
                      </button>
                    ))}
                  </div>
                  {/* Mobile category chips */}
                  <div className="flex lg:hidden gap-1 overflow-x-auto scrollbar-hide">
                    {CATEGORIES.slice(0, 5).map(cat => (
                      <button key={cat.key} onClick={() => setCatFilter(cat.key)}
                        className="flex-shrink-0 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold"
                        style={catFilter === cat.key ? {
                          background: "var(--green-dim)", color: "var(--green-light)", border: "1px solid var(--green-border)"
                        } : { background: "var(--bg-surface)", color: "var(--text-tertiary)", border: "1px solid var(--border-subtle)" }}>
                        {cat.icon}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Posts */}
                {postLoad ? (
                  <div className="space-y-2">
                    {[...Array(6)].map((_, i) => <div key={i} className="h-20 skeleton rounded-2xl" />)}
                  </div>
                ) : posts.length === 0 ? (
                  <div className="text-center py-20">
                    <p className="text-3xl mb-3">💬</p>
                    <p className="text-white font-black text-[15px] mb-1">Aucun post</p>
                    <p className="text-[13px]" style={{ color: "var(--text-tertiary)" }}>Sois le premier à partager une analyse !</p>
                    {user && (
                      <button onClick={() => setShowNew(true)}
                        className="mt-4 px-5 py-2.5 rounded-xl text-[13px] font-black text-black"
                        style={{ background: "var(--green)" }}>
                        Créer le premier post →
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {posts.map(post => {
                      const cat = CATEGORIES.find(c => c.key === post.category)
                      return (
                        <div key={post.id}
                          onClick={() => router.push(`/forum/${post.id}`)}
                          className="group rounded-2xl p-4 cursor-pointer transition-all hover:-translate-y-px"
                          style={{
                            background: "var(--bg-surface)",
                            border: "1px solid var(--border-subtle)",
                          }}
                          onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--border-accent)")}
                          onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border-subtle)")}>
                          {post.pinned && (
                            <p className="text-[10px] font-black text-yellow-400 uppercase tracking-wider mb-2">📌 Épinglé</p>
                          )}
                          <div className="flex items-start gap-3">
                            <Avatar username={post.username} size={36} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <span className="text-[12px] font-semibold" style={{ color: "var(--text-secondary)" }}>{post.username}</span>
                                <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>· {timeAgo(post.created_at)}</span>
                                {cat && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-md font-bold"
                                    style={{ background: "var(--bg-active)", color: "var(--text-secondary)", border: "1px solid var(--border-subtle)" }}>
                                    {cat.icon} {cat.label}
                                  </span>
                                )}
                                {post.symbol && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-md font-black"
                                    style={{ background: "var(--blue-dim)", color: "var(--blue-light)", border: "1px solid rgba(59,130,246,0.2)" }}>
                                    ${post.symbol}
                                  </span>
                                )}
                              </div>
                              <h3 className="text-[14px] font-black text-white group-hover:text-green-400 transition-colors line-clamp-1 mb-1">
                                {post.title}
                              </h3>
                              <p className="text-[12px] line-clamp-1 mb-2" style={{ color: "var(--text-tertiary)" }}>
                                {post.content}
                              </p>
                              <div className="flex items-center gap-4 text-[11px]" style={{ color: "var(--text-muted)" }}>
                                <span>❤️ {post.likes}</span>
                                <span>💬 {post.replies_count}</span>
                                <span>👁 {post.views}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ════ CLASSEMENT ═══════════════════════════════════ */}
          {tab === "classement" && (
            <div className="max-w-2xl mx-auto">
              {leadLoad ? (
                <div className="space-y-2">{[...Array(8)].map((_, i) => <div key={i} className="h-14 skeleton rounded-2xl" />)}</div>
              ) : leaders.length < 3 ? (
                <div className="text-center py-20">
                  <p className="text-4xl mb-3">🏆</p>
                  <p className="text-white font-black text-[16px] mb-1">Classement bientôt disponible</p>
                  <p className="text-[13px]" style={{ color: "var(--text-tertiary)" }}>Plus de traders nécessaires pour débloquer le classement.</p>
                </div>
              ) : (
                <>
                  {/* Podium */}
                  <div className="flex items-end justify-center gap-5 mb-8 pt-4">
                    {PODIUM_ORDER.map(idx => {
                      const t = leaders[idx]
                      if (!t) return null
                      const isGold = idx === 0
                      return (
                        <div key={t.username} className="flex flex-col items-center gap-2">
                          <Avatar username={t.username} size={isGold ? 52 : 40} />
                          <p className="text-[12px] font-black text-white text-center max-w-[80px] truncate">{t.username}</p>
                          <p className={`text-[12px] font-black tabular-nums ${t.total_return_pct >= 0 ? "text-green-400" : "text-red-400"}`}>
                            {t.total_return_pct >= 0 ? "+" : ""}{t.total_return_pct.toFixed(1)}%
                          </p>
                          <div className={`${PODIUM_H[idx]} w-20 rounded-t-2xl flex items-center justify-center text-2xl ${
                            isGold ? "bg-yellow-500/18 border border-yellow-500/25" :
                            idx === 1 ? "bg-white/6 border border-white/12" : "bg-orange-500/10 border border-orange-500/18"
                          }`}>
                            {MEDALS[idx]}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Full table */}
                  <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border-subtle)" }}>
                    {leaders.map((e, i) => (
                      <div key={e.username}
                        className="flex items-center gap-3 px-4 py-3.5 transition-all hover:bg-white/[0.02]"
                        style={{ borderBottom: i < leaders.length - 1 ? "1px solid var(--border-faint)" : "none" }}>
                        <span className="text-[13px] font-black w-8 text-center"
                          style={{ color: i < 3 ? "var(--yellow-light)" : "var(--text-muted)" }}>
                          {i < 3 ? MEDALS[i] : `#${i + 1}`}
                        </span>
                        <Avatar username={e.username} size={34} />
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-semibold text-white truncate">{e.username}</p>
                          <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{e.trades_count} trades · {e.win_rate.toFixed(0)}% win rate</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[13px] font-black text-white tabular-nums">
                            ${e.portfolio_value.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                          </p>
                          <p className={`text-[11px] font-black tabular-nums ${e.total_return_pct >= 0 ? "text-green-400" : "text-red-400"}`}>
                            {e.total_return_pct >= 0 ? "+" : ""}{e.total_return_pct.toFixed(2)}%
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-center text-[11px] mt-3" style={{ color: "var(--text-muted)" }}>
                    Paper trading uniquement · Mis à jour en temps réel
                  </p>
                </>
              )}
            </div>
          )}

          {/* ════ DUELS ════════════════════════════════════════ */}
          {tab === "duels" && (
            <div className="max-w-2xl mx-auto space-y-5">

              {/* Create duel card */}
              {user && (
                <div className="rounded-2xl p-5"
                  style={{ background: "rgba(167,139,250,0.06)", border: "1px solid rgba(167,139,250,0.2)" }}>
                  <p className="text-[13px] font-black text-white mb-3">Créer un duel</p>
                  <div className="flex gap-2 mb-3">
                    {[3, 7, 14].map(d => (
                      <button key={d} onClick={() => setDuelDur(d)}
                        className="flex-1 py-2 rounded-xl text-[12px] font-black transition-all"
                        style={duelDur === d ? {
                          background: "rgba(167,139,250,0.18)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.35)"
                        } : {
                          background: "var(--bg-active)", color: "var(--text-tertiary)", border: "1px solid var(--border-subtle)"
                        }}>
                        {d} jours
                      </button>
                    ))}
                  </div>
                  <button onClick={createDuel} disabled={creating}
                    className="w-full py-3 rounded-2xl font-black text-[13px] transition-all hover:scale-[1.01] disabled:opacity-50"
                    style={{ background: "linear-gradient(135deg,#a78bfa,#7c3aed)", color: "white" }}>
                    {creating ? "Création…" : "🥊 Lancer le duel →"}
                  </button>
                </div>
              )}

              {/* Duels list */}
              {duelLoad ? (
                <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-24 skeleton rounded-2xl" />)}</div>
              ) : duels.length === 0 ? (
                <div className="text-center py-16">
                  <p className="text-3xl mb-2">🥊</p>
                  <p className="text-white font-black mb-1">Aucun duel en cours</p>
                  <p className="text-[13px]" style={{ color: "var(--text-tertiary)" }}>Crée un duel et défie un ami !</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {duels.map(duel => {
                    const myPnl  = duel.challenger_pnl_pct ?? 0
                    const oppPnl = duel.opponent_pnl_pct ?? 0
                    const winning = myPnl > oppPnl
                    const daysLeft = Math.max(0, Math.ceil((new Date(duel.end_date).getTime() - Date.now()) / 86400000))
                    return (
                      <div key={duel.id} className="rounded-2xl p-4"
                        style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
                        <div className="flex items-center justify-between mb-3">
                          <span className={`text-[10px] font-black px-2.5 py-1 rounded-full ${
                            duel.status === "pending" ? "bg-yellow-500/15 text-yellow-400" :
                            duel.status === "active"  ? "bg-green-500/15 text-green-400" :
                            "bg-white/8 text-white/40"
                          }`}>
                            {duel.status === "pending" ? "⏳ En attente" : duel.status === "active" ? "🔴 Live" : "✅ Terminé"}
                          </span>
                          <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                            {duel.duration_days}j · {daysLeft > 0 ? `${daysLeft}j restants` : "Terminé"}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 mb-3">
                          {[
                            { label: `Toi (${duel.challenger_username})`, pnl: myPnl, highlight: winning },
                            { label: duel.opponent_username ?? "En attente…", pnl: oppPnl, highlight: !winning && !!duel.opponent_username },
                          ].map((side, si) => (
                            <div key={si} className="rounded-xl p-3 text-center"
                              style={{
                                background: side.highlight ? "rgba(34,197,94,0.07)" : "var(--bg-active)",
                                border: `1px solid ${side.highlight ? "rgba(34,197,94,0.18)" : "var(--border-subtle)"}`,
                              }}>
                              <p className="text-[11px] mb-1 truncate" style={{ color: "var(--text-tertiary)" }}>{side.label}</p>
                              <p className={`text-[18px] font-black tabular-nums ${side.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                                {side.pnl >= 0 ? "+" : ""}{side.pnl.toFixed(2)}%
                              </p>
                            </div>
                          ))}
                        </div>
                        {duel.status === "pending" && (
                          <div className="flex gap-2">
                            <button onClick={() => {
                              navigator.clipboard.writeText(`${window.location.origin}/duel?invite=${duel.id}`)
                              setCopied(duel.id)
                              setTimeout(() => setCopied(null), 2000)
                            }}
                              className="flex-1 py-2 rounded-xl text-[12px] font-black transition-all"
                              style={copied === duel.id ? {
                                background: "var(--green-dim)", color: "var(--green-light)", border: "1px solid var(--green-border)"
                              } : {
                                background: "var(--bg-active)", color: "var(--text-secondary)", border: "1px solid var(--border-default)"
                              }}>
                              {copied === duel.id ? "✓ Lien copié" : "📋 Copier l'invitation"}
                            </button>
                            <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Je te défie sur Tradex 🥊 ! ${window.location.origin}/duel?invite=${duel.id}`)}`}
                              target="_blank" rel="noopener"
                              className="flex-1 py-2 rounded-xl text-[12px] font-black text-center"
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
            </div>
          )}

          {/* ════ ROOM ═════════════════════════════════════════ */}
          {tab === "room" && (
            <div className="max-w-2xl mx-auto flex flex-col" style={{ height: "calc(100vh - 260px)" }}>

              {/* Room selector */}
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div className="flex gap-1 p-1 rounded-xl" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
                  {ROOMS.map(r => (
                    <button key={r.key} onClick={() => setRoom(r.key)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold transition-all"
                      style={room === r.key ? {
                        background: "var(--bg-selected)", color: "var(--green-light)"
                      } : { color: "var(--text-tertiary)" }}>
                      {r.emoji} {r.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ background: "var(--green)", animation: "live-pulse 2s infinite" }} />
                  <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                    {online} en ligne
                  </span>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto scrollbar-hide space-y-3 min-h-0 py-2"
                style={{ borderRadius: "16px", background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", padding: "16px" }}>
                {messages.length === 0 && (
                  <div className="text-center py-10">
                    <p className="text-2xl mb-2">💬</p>
                    <p className="text-[13px]" style={{ color: "var(--text-tertiary)" }}>
                      Sois le premier à écrire dans {ROOMS.find(r => r.key === room)?.label} !
                    </p>
                  </div>
                )}
                {messages.map((msg, i) => {
                  const isMe = msg.user_id === user?.id
                  const showAvatar = i === 0 || messages[i - 1].user_id !== msg.user_id
                  return (
                    <div key={msg.id} className={`flex gap-2.5 ${isMe ? "flex-row-reverse" : ""}`}>
                      <div className="flex-shrink-0 mt-0.5">
                        {!isMe && showAvatar
                          ? <Avatar username={msg.username} size={28} />
                          : <div className="w-7" />}
                      </div>
                      <div className={`flex flex-col max-w-[75%] ${isMe ? "items-end" : "items-start"}`}>
                        {showAvatar && !isMe && (
                          <p className="text-[10px] font-bold mb-0.5 ml-0.5" style={{ color: "var(--text-tertiary)" }}>
                            {msg.username} · {timeAgo(msg.created_at)}
                          </p>
                        )}
                        <div className="px-3.5 py-2 rounded-2xl text-[13px] leading-snug"
                          style={isMe ? {
                            background: "linear-gradient(135deg,#22c55e,#16a34a)",
                            color: "black", fontWeight: 600,
                            borderRadius: "18px 18px 4px 18px",
                          } : {
                            background: "var(--bg-elevated)",
                            border: "1px solid var(--border-subtle)",
                            color: "var(--text-primary)",
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
              {user ? (
                <div className="flex gap-2 mt-3">
                  <input
                    value={roomInput}
                    onChange={e => setRoomInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                    placeholder={`Message dans ${ROOMS.find(r => r.key === room)?.label}…`}
                    className="flex-1 px-4 py-3 rounded-2xl text-[13px] text-white outline-none transition-all"
                    style={{
                      background: "var(--bg-surface)",
                      border: "1px solid var(--border-default)",
                    }}
                    onFocus={e => (e.target.style.borderColor = "var(--border-focus)")}
                    onBlur={e => (e.target.style.borderColor = "var(--border-default)")}
                  />
                  <button onClick={sendMessage} disabled={!roomInput.trim() || sending}
                    className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all hover:scale-110 disabled:opacity-30"
                    style={{ background: "linear-gradient(135deg,#22c55e,#16a34a)" }}>
                    <svg width="14" height="14" fill="none" stroke="black" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path d="M5 12h14M12 5l7 7-7 7"/>
                    </svg>
                  </button>
                </div>
              ) : (
                <div className="mt-3 text-center py-4 rounded-2xl" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
                  <a href="/login" className="text-[13px] font-bold" style={{ color: "var(--green-light)" }}>
                    Connecte-toi pour participer →
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── New post modal ──────────────────────────────────── */}
      {showNew && user && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}
          onClick={() => setShowNew(false)}>
          <div className="w-full max-w-lg rounded-3xl p-6 animate-scale-in"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)", boxShadow: "var(--shadow-xl)" }}
            onClick={e => e.stopPropagation()}>

            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[16px] font-black text-white">Nouveau post</h2>
              <button onClick={() => setShowNew(false)}
                className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:bg-white/8"
                style={{ color: "var(--text-tertiary)" }}>
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              <input value={npTitle} onChange={e => setNpTitle(e.target.value)}
                placeholder="Titre du post"
                className="w-full px-4 py-3 rounded-xl text-[13px] text-white outline-none transition-all"
                style={{ background: "var(--bg-active)", border: "1px solid var(--border-default)" }}
                onFocus={e => (e.target.style.borderColor = "var(--border-focus)")}
                onBlur={e => (e.target.style.borderColor = "var(--border-default)")}
              />
              <textarea value={npContent} onChange={e => setNpContent(e.target.value)}
                placeholder="Contenu…"
                rows={5}
                className="w-full px-4 py-3 rounded-xl text-[13px] text-white outline-none resize-none transition-all"
                style={{ background: "var(--bg-active)", border: "1px solid var(--border-default)" }}
                onFocus={e => (e.target.style.borderColor = "var(--border-focus)")}
                onBlur={e => (e.target.style.borderColor = "var(--border-default)")}
              />
              <div className="flex gap-2">
                <select value={npCat} onChange={e => setNpCat(e.target.value)}
                  className="flex-1 px-3 py-2.5 rounded-xl text-[13px] text-white outline-none"
                  style={{ background: "var(--bg-active)", border: "1px solid var(--border-default)" }}>
                  {CATEGORIES.filter(c => c.key !== "all").map(c => (
                    <option key={c.key} value={c.key} className="bg-[#111]">{c.icon} {c.label}</option>
                  ))}
                </select>
                <input value={npSymbol} onChange={e => setNpSymbol(e.target.value.toUpperCase())}
                  placeholder="Ticker (optionnel)"
                  className="w-36 px-3 py-2.5 rounded-xl text-[13px] text-white outline-none"
                  style={{ background: "var(--bg-active)", border: "1px solid var(--border-default)" }}
                />
              </div>
            </div>

            {npError && (
              <p className="text-[12px] text-red-400 mt-3">{npError}</p>
            )}

            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowNew(false)}
                className="px-4 py-2.5 rounded-xl text-[13px] font-semibold transition-all"
                style={{ color: "var(--text-tertiary)", background: "var(--bg-active)", border: "1px solid var(--border-default)" }}>
                Annuler
              </button>
              <button onClick={submitPost} disabled={npLoading || !npTitle.trim() || !npContent.trim()}
                className="px-5 py-2.5 rounded-xl text-[13px] font-black text-black transition-all hover:scale-[1.02] disabled:opacity-50"
                style={{ background: "linear-gradient(135deg,#22c55e,#16a34a)" }}>
                {npLoading ? "Publication…" : "Publier →"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
