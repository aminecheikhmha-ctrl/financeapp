"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useParams, useRouter } from "next/navigation"

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

interface Reply {
  id: string
  user_id: string
  username: string
  avatar_color: string
  content: string
  likes: number
  is_best: boolean
  created_at: string
}

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

function formatDate(date: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(date))
}

function Avatar({ username, color, size = 9 }: { username: string; color: string; size?: number }) {
  return (
    <div
      className={`w-${size} h-${size} rounded-full flex items-center justify-center flex-shrink-0 font-bold text-black`}
      style={{ background: color, width: size * 4, height: size * 4, fontSize: size * 1.8 + "px" }}
    >
      {username?.[0]?.toUpperCase() ?? "?"}
    </div>
  )
}

// Minimal markdown renderer: bold, italic, headers, bullets
function Markdown({ text }: { text: string }) {
  const lines = text.split("\n")
  return (
    <div className="space-y-1.5 text-gray-300 leading-relaxed text-sm">
      {lines.map((line, i) => {
        if (line.startsWith("## ")) return <h2 key={i} className="text-base font-bold text-white mt-3">{line.slice(3)}</h2>
        if (line.startsWith("### ")) return <h3 key={i} className="text-sm font-bold text-white mt-2">{line.slice(4)}</h3>
        if (line.startsWith("- ") || line.startsWith("• ")) return (
          <p key={i} className="flex items-start gap-2">
            <span className="text-green-400 mt-0.5 flex-shrink-0">•</span>
            <span>{renderInline(line.slice(2))}</span>
          </p>
        )
        if (!line.trim()) return <div key={i} className="h-2" />
        return <p key={i}>{renderInline(line)}</p>
      })}
    </div>
  )
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) return <strong key={i} className="text-white font-semibold">{p.slice(2, -2)}</strong>
    if (p.startsWith("*") && p.endsWith("*")) return <em key={i} className="italic">{p.slice(1, -1)}</em>
    return p
  })
}

// ─── Quote Price Card ─────────────────────────────────────────────────────────

function SymbolCard({ symbol }: { symbol: string }) {
  const [quote, setQuote] = useState<any>(null)

  useEffect(() => {
    fetch(`/api/quote?symbol=${symbol}`)
      .then(r => r.json())
      .then(d => { if (d.price) setQuote(d) })
      .catch(() => {})
  }, [symbol])

  if (!quote) return (
    <div className="animate-pulse h-16 bg-white/5 rounded-xl" />
  )

  const change = quote.change ?? 0
  const positive = change >= 0

  return (
    <div className="flex items-center gap-4 p-4 bg-white/5 border border-white/8 rounded-xl">
      <div>
        <p className="text-xs text-gray-500 font-semibold">{symbol}</p>
        <p className="text-lg font-black text-white">${Number(quote.price).toFixed(2)}</p>
      </div>
      <div className={`text-sm font-bold ${positive ? "text-green-400" : "text-red-400"}`}>
        {positive ? "+" : ""}{change.toFixed(2)} ({positive ? "+" : ""}{(quote.changePercent ?? 0).toFixed(2)}%)
      </div>
      <div className="ml-auto text-xs text-gray-600">{quote.name ?? ""}</div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PostDetail() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [post, setPost] = useState<Post | null>(null)
  const [replies, setReplies] = useState<Reply[]>([])
  const [user, setUser] = useState<any>(null)
  const [session, setSession] = useState<any>(null)
  const [replyText, setReplyText] = useState("")
  const [username, setUsername] = useState("")
  const [avatarColor, setAvatarColor] = useState("#4ade80")
  const [replyLoading, setReplyLoading] = useState(false)
  const [likedPost, setLikedPost] = useState(false)
  const [likedReplies, setLikedReplies] = useState<Set<string>>(new Set())
  const [aiAnalysis, setAiAnalysis] = useState("")
  const [aiLoading, setAiLoading] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setUser(data.session?.user ?? null)
      if (data.session?.user) {
        setUsername(data.session.user.email?.split("@")[0] ?? "")
      }
    })
    fetchPost()
  }, [id])

  async function fetchPost() {
    setPageLoading(true)
    const res = await fetch(`/api/forum/posts/${id}`)
    const json = await res.json()
    if (json.post) setPost(json.post)
    if (json.replies) setReplies(json.replies)
    setPageLoading(false)
  }

  async function handleLikePost() {
    if (!session) return
    const res = await fetch(`/api/forum/posts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ action: "like" }),
    })
    const json = await res.json()
    setLikedPost(json.liked)
    setPost(p => p ? { ...p, likes: p.likes + (json.liked ? 1 : -1) } : p)
  }

  async function handleLikeReply(replyId: string) {
    if (!session) return
    const res = await fetch(`/api/forum/replies/${replyId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({}),
    })
    const json = await res.json()
    setLikedReplies(prev => {
      const next = new Set(prev)
      json.liked ? next.add(replyId) : next.delete(replyId)
      return next
    })
    setReplies(rs => rs.map(r => r.id === replyId ? { ...r, likes: r.likes + (json.liked ? 1 : -1) } : r))
  }

  async function handleReply() {
    if (!session || !replyText.trim()) return
    setReplyLoading(true)
    const res = await fetch("/api/forum/replies", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ post_id: id, content: replyText, username, avatar_color: avatarColor }),
    })
    const json = await res.json()
    if (json.reply) {
      setReplies(prev => [...prev, json.reply])
      setReplyText("")
      setPost(p => p ? { ...p, replies_count: p.replies_count + 1 } : p)
    }
    setReplyLoading(false)
  }

  async function handleAiAnalysis() {
    setAiLoading(true)
    setAiAnalysis("")
    const res = await fetch(`/api/forum/posts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "ai_analysis" }),
    })
    const json = await res.json()
    setAiAnalysis(json.analysis ?? json.error ?? "Erreur lors de l'analyse")
    setAiLoading(false)
  }

  if (pageLoading) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!post) return (
    <div className="min-h-screen bg-black flex items-center justify-center text-gray-400">
      Post introuvable
    </div>
  )

  const AVATAR_COLORS = ["#4ade80", "#60a5fa", "#f472b6", "#a78bfa", "#fb923c", "#34d399", "#facc15"]

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-3xl mx-auto px-6 py-8">

        {/* Back */}
        <button
          onClick={() => router.push("/forum")}
          className="flex items-center gap-2 text-gray-500 hover:text-white transition mb-6 text-sm"
        >
          ← Retour au forum
        </button>

        {/* Post */}
        <div className="bg-[#111] border border-white/8 rounded-2xl p-6 mb-6">
          {/* Meta */}
          <div className="flex items-center gap-3 mb-4">
            <Avatar username={post.username} color={post.avatar_color} size={10} />
            <div>
              <p className="text-sm font-semibold text-white">{post.username}</p>
              <p className="text-xs text-gray-500">{formatDate(post.created_at)}</p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide bg-white/5 text-gray-400">
                {post.category}
              </span>
              {post.symbol && (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  ${post.symbol}
                </span>
              )}
            </div>
          </div>

          <h1 className="text-xl font-black text-white mb-4 leading-snug">{post.title}</h1>

          {/* Symbol price card */}
          {post.symbol && (
            <div className="mb-4">
              <SymbolCard symbol={post.symbol} />
            </div>
          )}

          <div className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap mb-6">
            {post.content}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-4 pt-4 border-t border-white/5">
            <button
              onClick={handleLikePost}
              disabled={!session}
              className={`flex items-center gap-1.5 text-sm font-semibold transition ${
                likedPost ? "text-red-400" : "text-gray-500 hover:text-red-400"
              } disabled:opacity-40`}
            >
              <span>{likedPost ? "❤️" : "🤍"}</span>
              <span>{post.likes}</span>
            </button>
            <span className="flex items-center gap-1.5 text-sm text-gray-600">
              <span>💬</span> {post.replies_count}
            </span>
            <span className="flex items-center gap-1.5 text-sm text-gray-600">
              <span>👁</span> {post.views}
            </span>
            <button
              onClick={handleAiAnalysis}
              disabled={aiLoading}
              className="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold bg-purple-500/10 border border-purple-500/20 text-purple-400 hover:bg-purple-500/20 transition disabled:opacity-50"
            >
              {aiLoading ? (
                <>
                  <div className="w-3 h-3 border border-purple-400 border-t-transparent rounded-full animate-spin" />
                  Analyse en cours...
                </>
              ) : (
                <><span>🤖</span> Analyse IA</>
              )}
            </button>
          </div>

          {/* AI Analysis result */}
          {aiAnalysis && (
            <div className="mt-4 p-4 rounded-xl bg-purple-500/5 border border-purple-500/15">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-base">🤖</span>
                <span className="text-xs font-bold text-purple-400 uppercase tracking-wide">Analyse IA</span>
              </div>
              <Markdown text={aiAnalysis} />
            </div>
          )}
        </div>

        {/* Replies */}
        <div className="mb-6">
          <h2 className="text-base font-bold text-white mb-4">
            {replies.length} réponse{replies.length !== 1 ? "s" : ""}
          </h2>
          <div className="space-y-3">
            {replies.map(reply => (
              <div
                key={reply.id}
                className={`bg-[#111] border rounded-2xl p-5 transition ${
                  reply.is_best
                    ? "border-green-500/30 bg-green-500/3"
                    : "border-white/5"
                }`}
              >
                {reply.is_best && (
                  <div className="flex items-center gap-1 text-[10px] font-bold text-green-400 uppercase tracking-wide mb-2">
                    ✅ Meilleure réponse
                  </div>
                )}
                <div className="flex items-start gap-3">
                  <Avatar username={reply.username} color={reply.avatar_color} size={8} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-semibold text-white">{reply.username}</span>
                      <span className="text-xs text-gray-600">{timeAgo(reply.created_at)}</span>
                    </div>
                    <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{reply.content}</p>
                    <div className="flex items-center gap-3 mt-3">
                      <button
                        onClick={() => handleLikeReply(reply.id)}
                        disabled={!session}
                        className={`flex items-center gap-1 text-xs font-semibold transition ${
                          likedReplies.has(reply.id) ? "text-red-400" : "text-gray-600 hover:text-red-400"
                        } disabled:opacity-40`}
                      >
                        <span>{likedReplies.has(reply.id) ? "❤️" : "🤍"}</span>
                        <span>{reply.likes}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {replies.length === 0 && (
              <div className="text-center py-10 text-gray-600">
                <p className="text-2xl mb-2">💬</p>
                <p className="text-sm">Sois le premier à répondre</p>
              </div>
            )}
          </div>
        </div>

        {/* Reply form */}
        {user ? (
          <div className="bg-[#111] border border-white/8 rounded-2xl p-5">
            <h3 className="text-sm font-bold text-white mb-4">Répondre</h3>

            {/* Author row */}
            <div className="flex items-center gap-3 mb-4 p-3 rounded-xl bg-white/3 border border-white/5">
              <Avatar username={username} color={avatarColor} size={8} />
              <input
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Ton pseudo"
                className="flex-1 bg-transparent text-sm font-semibold text-white placeholder-gray-600 outline-none"
              />
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

            <textarea
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              placeholder="Écris ta réponse..."
              rows={4}
              className="w-full bg-white/5 border border-white/8 text-white px-4 py-3 rounded-xl text-sm placeholder-gray-600 outline-none focus:border-green-500/40 transition resize-none mb-4"
            />
            <div className="flex justify-end">
              <button
                onClick={handleReply}
                disabled={replyLoading || !replyText.trim()}
                className="px-6 py-2.5 bg-green-500 hover:bg-green-400 text-black text-sm font-bold rounded-xl transition disabled:opacity-50"
              >
                {replyLoading ? "Envoi..." : "Répondre"}
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-[#111] border border-white/8 rounded-2xl p-6 text-center">
            <p className="text-gray-500 mb-3 text-sm">Connecte-toi pour répondre</p>
            <a href="/login" className="px-6 py-2.5 bg-green-500 hover:bg-green-400 text-black text-sm font-bold rounded-xl transition inline-block">
              Se connecter
            </a>
          </div>
        )}

      </div>
    </div>
  )
}
