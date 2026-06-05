"use client"

import { useEffect, useState, useRef } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"

type Message = {
  id: string
  user_id: string
  username: string
  avatar_color: string
  content: string
  created_at: string
  symbol?: string
}

function getUserGradient(username: string) {
  const G = ["linear-gradient(135deg,#22c55e,#16a34a)","linear-gradient(135deg,#60a5fa,#3b82f6)","linear-gradient(135deg,#f59e0b,#d97706)","linear-gradient(135deg,#a78bfa,#7c3aed)","linear-gradient(135deg,#f87171,#dc2626)","linear-gradient(135deg,#34d399,#059669)","linear-gradient(135deg,#fb923c,#ea580c)"]
  let h = 0
  for (let i = 0; i < username.length; i++) h = username.charCodeAt(i) + ((h << 5) - h)
  return G[Math.abs(h) % G.length]
}

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return "à l'instant"
  if (m < 60) return `${m}m`
  return `${Math.floor(m/60)}h`
}

const ROOMS = [
  { key: "general",  label: "💬 Général",   desc: "Discussions générales" },
  { key: "signaux",  label: "📡 Signaux",    desc: "Alertes et signaux live" },
  { key: "crypto",   label: "₿ Crypto",      desc: "BTC, ETH, altcoins" },
  { key: "actions",  label: "📈 Actions",    desc: "Actions US/EU" },
]

export default function RoomPage() {
  const router   = useRouter()
  const [user,     setUser]     = useState<any>(null)
  const [username, setUsername] = useState("")
  const [avatarColor, setAvatarColor] = useState("#22c55e")
  const [messages, setMessages] = useState<Message[]>([])
  const [input,    setInput]    = useState("")
  const [room,     setRoom]     = useState("general")
  const [online,   setOnline]   = useState(0)
  const [sending,  setSending]  = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const channelRef = useRef<any>(null)

  useEffect(() => {
    async function init() {
      const { data: { user: u } } = await supabase.auth.getUser()
      if (!u) { router.push("/login"); return }
      setUser(u)

      const { data: profile } = await supabase.from("user_profiles").select("username,avatar_color").eq("id", u.id).single()
      setUsername(profile?.username ?? u.email?.split("@")[0] ?? "Trader")
      setAvatarColor(profile?.avatar_color ?? "#22c55e")
    }
    init()
  }, [])

  useEffect(() => {
    if (!user) return
    // Fetch initial messages
    supabase.from("trading_room_messages")
      .select("*")
      .eq("room", room)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => setMessages((data ?? []).reverse()))

    // Realtime subscription
    if (channelRef.current) supabase.removeChannel(channelRef.current)
    const channel = supabase.channel(`room:${room}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "trading_room_messages",
        filter: `room=eq.${room}`
      }, (payload) => {
        setMessages(m => [...m, payload.new as Message])
      })
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState()
        setOnline(Object.keys(state).length)
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ user_id: user.id, username, online_at: new Date().toISOString() })
        }
      })
    channelRef.current = channel

    return () => { supabase.removeChannel(channel) }
  }, [user, room])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  async function send() {
    if (!input.trim() || !user || sending) return
    setSending(true)
    const { error } = await supabase.from("trading_room_messages").insert({
      user_id: user.id,
      username,
      avatar_color: avatarColor,
      content: input.trim(),
      room,
    })
    if (!error) setInput("")
    setSending(false)
  }

  return (
    <div className="min-h-screen flex flex-col page-enter" style={{ maxHeight: "100vh" }}>

      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-white/5 flex items-center justify-between">
        <div>
          <p className="text-xs font-black text-green-400 uppercase tracking-widest">💬 Trading Room</p>
          <p className="text-[10px] text-white/25 flex items-center gap-1.5 mt-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block animate-pulse" />
            {online} trader{online > 1 ? "s" : ""} en ligne
          </p>
        </div>
        <div className="flex items-center gap-1 bg-white/5 rounded-xl p-1">
          {ROOMS.map(r => (
            <button key={r.key} onClick={() => setRoom(r.key)}
              className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all"
              style={room === r.key ? {
                background: "rgba(34,197,94,0.15)", color: "#4ade80"
              } : { color: "rgba(255,255,255,0.3)" }}>
              {r.label.split(" ")[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Room title */}
      <div className="flex-shrink-0 px-4 py-2 border-b border-white/[0.04]">
        <p className="text-sm font-black text-white">{ROOMS.find(r => r.key === room)?.label}</p>
        <p className="text-xs text-white/30">{ROOMS.find(r => r.key === room)?.desc}</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 scrollbar-hide">
        {messages.length === 0 && (
          <div className="text-center py-10">
            <p className="text-2xl mb-2">💬</p>
            <p className="text-white/30 text-sm">Sois le premier à écrire !</p>
          </div>
        )}
        {messages.map((msg, i) => {
          const isMe = msg.user_id === user?.id
          const showAvatar = i === 0 || messages[i-1].user_id !== msg.user_id
          return (
            <div key={msg.id} className={`flex gap-2 ${isMe ? "flex-row-reverse" : ""}`}>
              {!isMe && (
                <div className="flex-shrink-0 mt-0.5">
                  {showAvatar ? (
                    <div className="w-7 h-7 rounded-xl flex items-center justify-center text-xs font-black text-white"
                      style={{ background: getUserGradient(msg.username) }}>
                      {msg.username[0]?.toUpperCase()}
                    </div>
                  ) : <div className="w-7" />}
                </div>
              )}
              <div className={`max-w-[75%] ${isMe ? "items-end" : "items-start"} flex flex-col`}>
                {showAvatar && !isMe && (
                  <p className="text-[10px] text-white/30 mb-0.5 ml-0.5 font-bold">{msg.username} · {timeAgo(msg.created_at)}</p>
                )}
                <div className={`px-3 py-2 rounded-2xl text-sm ${
                  isMe
                    ? "bg-green-500 text-black rounded-tr-sm font-medium"
                    : "text-white/80 rounded-tl-sm"
                }`}
                  style={!isMe ? { background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.06)" } : {}}>
                  {msg.content}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 px-4 py-3 border-t border-white/5">
        <div className="flex gap-2 items-end"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: "8px 12px" }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder={`Message dans ${ROOMS.find(r => r.key === room)?.label}…`}
            rows={1}
            className="flex-1 bg-transparent text-sm text-white placeholder-white/20 outline-none resize-none max-h-24"
          />
          <button onClick={send} disabled={!input.trim() || sending}
            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-all hover:scale-110 disabled:opacity-30"
            style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)" }}>
            <svg width="14" height="14" fill="none" stroke="black" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </button>
        </div>
      </div>
    </div>
  )
}
