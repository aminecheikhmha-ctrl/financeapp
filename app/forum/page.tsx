"use client"

import { useEffect, useState, useRef } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"

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

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { key: "all",        label: "Tout",           icon: "🌐" },
  { key: "analyse",    label: "Analyses",        icon: "📊" },
  { key: "question",   label: "Questions",       icon: "❓" },
  { key: "crypto",     label: "Crypto",          icon: "₿" },
  { key: "actions",    label: "Actions",         icon: "📈" },
  { key: "forex",      label: "Forex",           icon: "💱" },
  { key: "psychologie",label: "Psychologie",     icon: "🧠" },
  { key: "actualite",  label: "Actualités",      icon: "📰" },
]

const SORT_OPTIONS = [
  { key: "recent",  label: "Récents" },
  { key: "popular", label: "Populaires" },
  { key: "replies", label: "Actifs" },
]

const AVATAR_COLORS = ["#4ade80", "#60a5fa", "#f472b6", "#a78bfa", "#fb923c", "#34d399", "#facc15"]

// ─── Utils ────────────────────────────────────────────────────────────────────

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 2) return "à l'instant"
  if (mins < 60) return `il y a ${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `il y a ${hours}h`
  return `il y a ${Math.floor(hours / 24)}j`
}

function Avatar({ username, color, size = 8 }: { username: string; color: string; size?: number }) {
  return (
    <div
      className={`w-${size} h-${size} rounded-full flex items-center justify-center flex-shrink-0 font-bold text-black`}
      style={{ background: color, fontSize: size * 1.5 + "px" }}
    >
      {username?.[0]?.toUpperCase() ?? "?"}
    </div>
  )
}

function CategoryBadge({ category }: { category: string }) {
  const cat = CATEGORIES.find(c => c.key === category)
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide bg-white/5 text-gray-400">
      {cat?.icon} {cat?.label ?? category}
    </span>
  )
}

// ─── Post Card ────────────────────────────────────────────────────────────────

function PostCard({ post, onClick }: { post: Post; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="group bg-[#111] border border-white/5 rounded-2xl p-5 hover:border-green-500/20 hover:bg-[#141414] cursor-pointer transition-all"
    >
      {post.pinned && (
        <div className="flex items-center gap-1 text-[10px] font-bold text-yellow-400 uppercase tracking-wide mb-2">
          📌 Épinglé
        </div>
      )}
      <div className="flex items-start gap-3">
        <a href={`/traders/${post.username}`}>
          <Avatar username={post.username} color={post.avatar_color} size={9} />
        </a>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <a href={`/traders/${post.username}`} className="text-xs font-semibold text-gray-400 hover:text-green-400 transition">{post.username}</a>
            <span className="text-gray-600 text-xs">·</span>
            <span className="text-xs text-gray-600">{timeAgo(post.created_at)}</span>
            <CategoryBadge category={post.category} />
            {post.symbol && (
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                ${post.symbol}
              </span>
            )}
          </div>
          <h3 className="text-sm font-semibold text-white group-hover:text-green-400 transition-colors line-clamp-2 mb-2">
            {post.title}
          </h3>
          <p className="text-xs text-gray-500 line-clamp-2 mb-3">{post.content}</p>
          <div className="flex items-center gap-4 text-xs text-gray-600">
            <span className="flex items-center gap-1">
              <span>❤️</span> {post.likes}
            </span>
            <span className="flex items-center gap-1">
              <span>💬</span> {post.replies_count}
            </span>
            <span className="flex items-center gap-1">
              <span>👁</span> {post.views}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── New Post Modal ───────────────────────────────────────────────────────────

function NewPostModal({
  user,
  onClose,
  onCreated,
}: {
  user: any
  onClose: () => void
  onCreated: () => void
}) {
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [category, setCategory] = useState("question")
  const [symbol, setSymbol] = useState("")
  const [username, setUsername] = useState(user?.email?.split("@")[0] ?? "")
  const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[0])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [moderated, setModerated] = useState(false)

  async function handleSubmit() {
    if (!title.trim() || !content.trim()) { setError("Titre et contenu requis"); return }
    setLoading(true)
    setError("")
    setModerated(false)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch("/api/forum/posts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ title, content, category, symbol: symbol || null, username, avatar_color: avatarColor }),
    })
    const json = await res.json()
    setLoading(false)
    if (json.error) {
      setError(json.error)
      setModerated(json.moderated === true || json.banned === true)
      return
    }
    onCreated()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-0 sm:p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-[#111] border border-white/10 rounded-t-2xl sm:rounded-2xl w-full max-w-[95vw] sm:max-w-lg p-5 sm:p-6 shadow-2xl mx-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-white">Nouveau post</h2>
          <button onClick={onClose} className="text-gray-600 hover:text-white transition text-xl leading-none">×</button>
        </div>

        {/* Author row */}
        <div className="flex items-center gap-3 mb-5 p-3 rounded-xl bg-white/3 border border-white/5">
          <Avatar username={username} color={avatarColor} size={9} />
          <div className="flex-1 min-w-0">
            <input
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Ton pseudo"
              className="w-full bg-transparent text-sm font-semibold text-white placeholder-gray-600 outline-none"
            />
          </div>
          <div className="flex gap-1.5">
            {AVATAR_COLORS.map(c => (
              <button
                key={c}
                onClick={() => setAvatarColor(c)}
                className={`w-4 h-4 rounded-full transition-transform ${avatarColor === c ? "scale-125 ring-2 ring-white/40" : ""}`}
                style={{ background: c }}
              />
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Titre du post"
            className="w-full bg-white/5 border border-white/8 text-white px-4 py-3 rounded-xl text-sm placeholder-gray-600 outline-none focus:border-green-500/50 transition"
          />
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="Partage ton analyse, ta question, ton idée..."
            rows={5}
            className="w-full bg-white/5 border border-white/8 text-white px-4 py-3 rounded-xl text-sm placeholder-gray-600 outline-none focus:border-green-500/50 transition resize-none"
          />
          <div className="flex gap-2 flex-wrap">
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="flex-1 min-w-[120px] bg-white/5 border border-white/8 text-white px-3 py-2.5 rounded-xl text-sm outline-none focus:border-green-500/50 transition"
            >
              {CATEGORIES.filter(c => c.key !== "all").map(c => (
                <option key={c.key} value={c.key} className="bg-[#111]">{c.icon} {c.label}</option>
              ))}
            </select>
            <input
              value={symbol}
              onChange={e => setSymbol(e.target.value.toUpperCase())}
              placeholder="Ticker (ex: AAPL)"
              className="w-full sm:w-36 bg-white/5 border border-white/8 text-white px-3 py-2.5 rounded-xl text-sm placeholder-gray-600 outline-none focus:border-green-500/50 transition"
            />
          </div>
        </div>

        {error && (
          moderated ? (
            <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl mt-3"
              style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
              <span className="text-base flex-shrink-0">🚫</span>
              <div>
                <p className="text-sm font-bold text-red-400">Post refusé par la modération</p>
                <p className="text-xs text-red-400/70 mt-0.5">{error}</p>
              </div>
            </div>
          ) : (
            <p className="text-red-400 text-xs mt-3">{error}</p>
          )
        )}

        <div className="flex justify-end gap-3 mt-5">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm text-gray-400 hover:text-white transition"
          >
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-6 py-2 rounded-xl text-sm font-semibold bg-green-500 hover:bg-green-400 text-black transition disabled:opacity-50"
          >
            {loading ? "Publication..." : "Publier"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Leaderboard Tab ──────────────────────────────────────────────────────────

function LeaderboardTab() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/leaderboard")
      .then(r => r.json())
      .then(d => { setEntries(d.leaderboard ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const top3 = entries.slice(0, 3)
  const rest = entries.slice(3)

  const PODIUM_ORDER = [1, 0, 2] // silver, gold, bronze order for display

  return (
    <div className="space-y-8">
      {/* Podium */}
      {top3.length >= 3 && (
        <div className="flex items-end justify-center gap-4 pt-6 pb-2">
          {PODIUM_ORDER.map((idx) => {
            const e = top3[idx]
            if (!e) return null
            const heights = ["h-28", "h-36", "h-24"]
            const medals = ["🥈", "🥇", "🥉"]
            const isGold = idx === 0
            return (
              <div key={e.user_id} className="flex flex-col items-center gap-2">
                <Avatar username={e.username} color={e.avatar_color} size={isGold ? 12 : 10} />
                <p className="text-xs font-bold text-white">{e.username}</p>
                <p className={`text-xs font-black ${e.total_return_pct >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {e.total_return_pct >= 0 ? "+" : ""}{e.total_return_pct.toFixed(1)}%
                </p>
                <div className={`${heights[idx]} w-20 rounded-t-xl flex items-center justify-center text-2xl ${
                  isGold ? "bg-yellow-500/20 border border-yellow-500/30" :
                  idx === 1 ? "bg-gray-400/10 border border-gray-400/20" :
                  "bg-orange-600/10 border border-orange-600/20"
                }`}>
                  {medals[idx]}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Table */}
      <div className="bg-[#111] border border-white/5 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
        <div className="grid grid-cols-[40px_1fr_110px_100px_70px] gap-0 px-4 py-3 border-b border-white/5 min-w-[420px]">
          {["#", "Trader", "Portfolio", "Perf.", "Win%"].map(h => (
            <span key={h} className="text-[11px] font-bold uppercase tracking-wide text-gray-600">{h}</span>
          ))}
        </div>
        {entries.map((e, i) => (
          <div
            key={e.user_id}
            className="grid grid-cols-[40px_1fr_110px_100px_70px] gap-0 px-4 py-3.5 border-b border-white/3 hover:bg-white/2 transition items-center min-w-[420px]"
          >
            <span className="text-sm font-bold text-gray-500">#{i + 1}</span>
            <div className="flex items-center gap-2 min-w-0">
              <Avatar username={e.username} color={e.avatar_color} size={7} />
              <span className="text-sm font-semibold text-white truncate">{e.username}</span>
            </div>
            <span className="text-sm font-semibold text-white">
              {e.portfolio_value.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} $
            </span>
            <span className={`text-sm font-black ${e.total_return_pct >= 0 ? "text-green-400" : "text-red-400"}`}>
              {e.total_return_pct >= 0 ? "+" : ""}{e.total_return_pct.toFixed(2)}%
            </span>
            <span className="text-sm text-gray-400">{e.win_rate.toFixed(0)}%</span>
          </div>
        ))}
        {entries.length === 0 && (
          <div className="text-center py-16 text-gray-600">
            <p className="text-3xl mb-3">🏆</p>
            <p>Aucun trader classé pour le moment</p>
          </div>
        )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Forum() {
  const router = useRouter()
  const [tab, setTab] = useState<"forum" | "leaderboard">("forum")
  const [user, setUser] = useState<any>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState("all")
  const [sort, setSort] = useState("recent")
  const [search, setSearch] = useState("")
  const [showModal, setShowModal] = useState(false)
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
  }, [])

  useEffect(() => {
    if (tab !== "forum") return
    if (searchRef.current) clearTimeout(searchRef.current)
    searchRef.current = setTimeout(fetchPosts, search ? 400 : 0)
    return () => { if (searchRef.current) clearTimeout(searchRef.current) }
  }, [category, sort, search, tab])

  async function fetchPosts() {
    setLoading(true)
    const params = new URLSearchParams({ category, sort, search })
    const res = await fetch(`/api/forum/posts?${params}`)
    const json = await res.json()
    setPosts(json.posts ?? [])
    setLoading(false)
  }

  return (
    <div className="min-h-screen text-white overflow-x-hidden page-enter" style={{ background: "var(--bg-canvas)" }}>
      <div className="flex">

        {/* Left sidebar */}
        <aside className="hidden lg:flex flex-col w-56 flex-shrink-0 sticky top-0 h-screen pt-8 px-4 border-r border-white/5">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-600 mb-4 px-2">Catégories</h2>
          <nav className="space-y-0.5">
            {CATEGORIES.map(cat => (
              <button
                key={cat.key}
                onClick={() => { setCategory(cat.key); setTab("forum") }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all ${
                  tab === "forum" && category === cat.key
                    ? "bg-green-500/15 text-green-400"
                    : "text-gray-500 hover:text-white hover:bg-white/5"
                }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
              </button>
            ))}
          </nav>

          <div className="mt-6 pt-4 border-t border-white/5 space-y-0.5">
            <button
              onClick={() => setTab("leaderboard")}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all ${
                tab === "leaderboard"
                  ? "bg-yellow-500/15 text-yellow-400"
                  : "text-gray-500 hover:text-white hover:bg-white/5"
              }`}
            >
              <span>🏆</span>
              <span>Leaderboard</span>
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 px-4 md:px-6 py-6 md:py-8 min-w-0 max-w-3xl">

          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-xl md:text-2xl font-black text-white">
                {tab === "leaderboard" ? "🏆 Leaderboard" : "💬 Forum"}
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">
                {tab === "leaderboard"
                  ? "Les meilleurs traders de la communauté"
                  : "Analyses, questions et idées de trading"}
              </p>
            </div>
            {tab === "forum" && (
              user ? (
                <button
                  onClick={() => setShowModal(true)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-green-500 hover:bg-green-400 text-black text-sm font-bold rounded-xl transition"
                >
                  ✏️ Nouveau post
                </button>
              ) : (
                <a href="/login" className="px-4 py-2.5 bg-green-500/10 border border-green-500/30 text-green-400 text-sm font-semibold rounded-xl hover:bg-green-500/20 transition">
                  Connexion
                </a>
              )
            )}
          </div>

          {/* Mobile tabs */}
          <div className="flex lg:hidden gap-2 mb-4">
            <button
              onClick={() => setTab("forum")}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold transition ${tab === "forum" ? "bg-green-500/15 text-green-400" : "text-gray-500 bg-white/5"}`}
            >
              💬 Forum
            </button>
            <button
              onClick={() => setTab("leaderboard")}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold transition ${tab === "leaderboard" ? "bg-yellow-500/15 text-yellow-400" : "text-gray-500 bg-white/5"}`}
            >
              🏆 Leaderboard
            </button>
          </div>

          {tab === "leaderboard" ? (
            <LeaderboardTab />
          ) : (
            <>
              {/* Filters */}
              <div className="flex gap-2 mb-5 flex-wrap">
                <div className="flex-1 min-w-0 relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 text-sm">🔍</span>
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Rechercher..."
                    className="w-full pl-9 pr-4 py-2.5 bg-white/5 border border-white/8 text-white text-sm rounded-xl placeholder-gray-600 outline-none focus:border-green-500/40 transition"
                  />
                </div>
                <div className="flex gap-1">
                  {SORT_OPTIONS.map(s => (
                    <button
                      key={s.key}
                      onClick={() => setSort(s.key)}
                      className={`flex-shrink-0 whitespace-nowrap px-2.5 py-2 rounded-xl text-xs font-semibold transition ${
                        sort === s.key
                          ? "bg-green-500/15 text-green-400 border border-green-500/20"
                          : "text-gray-500 bg-white/5 hover:text-white"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mobile category pills */}
              <div className="flex lg:hidden gap-2 overflow-x-auto pb-2 mb-4 no-scrollbar">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat.key}
                    onClick={() => setCategory(cat.key)}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                      category === cat.key
                        ? "bg-green-500/20 text-green-400 border border-green-500/30"
                        : "text-gray-500 bg-white/5"
                    }`}
                  >
                    {cat.icon} {cat.label}
                  </button>
                ))}
              </div>

              {/* Posts */}
              {loading ? (
                <div className="flex items-center justify-center py-24">
                  <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : posts.length === 0 ? (
                <div className="text-center py-16">
                  <div className="text-5xl mb-4">💬</div>
                  <h3 className="text-white font-bold text-lg mb-2">Le forum est vide</h3>
                  <p className="text-gray-500 text-sm mb-6">Sois le premier à partager une analyse ou poser une question !</p>
                  <button
                    onClick={() => setShowModal(true)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-500 hover:bg-green-400 text-black font-bold text-sm rounded-xl transition"
                  >
                    Créer le premier post →
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {posts.map(post => (
                    <PostCard
                      key={post.id}
                      post={post}
                      onClick={() => router.push(`/forum/${post.id}`)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {showModal && user && (
        <NewPostModal
          user={user}
          onClose={() => setShowModal(false)}
          onCreated={fetchPosts}
        />
      )}
    </div>
  )
}
