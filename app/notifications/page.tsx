"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { TrendingUp, Bell, Award, AlertCircle, MessageSquare, CheckCheck } from "lucide-react"

type NotifType = "signal" | "order" | "achievement" | "news" | "system" | "social"

type Notification = {
  id: string
  type: NotifType
  title: string
  body: string
  read: boolean
  created_at: string
  url?: string
  data?: any
}

const TYPE_CONFIG: Record<NotifType, { icon: any; color: string; bg: string }> = {
  signal:      { icon: TrendingUp,    color: "#22c55e", bg: "rgba(34,197,94,0.10)"   },
  order:       { icon: Bell,          color: "#60a5fa", bg: "rgba(96,165,250,0.10)"  },
  achievement: { icon: Award,         color: "#fbbf24", bg: "rgba(251,191,36,0.10)"  },
  news:        { icon: AlertCircle,   color: "#f97316", bg: "rgba(249,115,22,0.10)"  },
  system:      { icon: Bell,          color: "#9ca3af", bg: "rgba(156,163,175,0.10)" },
  social:      { icon: MessageSquare, color: "#a78bfa", bg: "rgba(167,139,250,0.10)" },
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins < 1)    return "à l'instant"
  if (mins < 60)   return `il y a ${mins} min`
  if (hours < 24)  return `il y a ${hours}h`
  return `il y a ${days}j`
}

export default function NotificationsPage() {
  const router = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading]             = useState(true)
  const [filter, setFilter]               = useState<"all" | "unread">("all")

  useEffect(() => { loadNotifications() }, [])

  async function loadNotifications() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push("/login"); return }

    const { data } = await supabase
      .from("user_notifications")
      .select("*")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false })
      .limit(50)

    setNotifications(data ?? [])
    setLoading(false)
  }

  async function markAllRead() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    await supabase
      .from("user_notifications")
      .update({ read: true })
      .eq("user_id", session.user.id)
      .eq("read", false)
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  async function markRead(id: string, url?: string) {
    await supabase.from("user_notifications").update({ read: true }).eq("id", id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    if (url) router.push(url)
  }

  const filtered      = notifications.filter(n => filter === "all" || !n.read)
  const unreadCount   = notifications.filter(n => !n.read).length

  return (
    <div className="min-h-screen bg-transparent pb-20">

      {/* Header */}
      <div className="px-6 py-5 border-b border-white/5 sticky top-0 bg-transparent/95 backdrop-blur-xl z-10">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <div>
            <h1 className="text-2xl font-black text-white">Notifications</h1>
            <p className="text-white/30 text-sm mt-0.5">
              {unreadCount > 0
                ? `${unreadCount} non lue${unreadCount > 1 ? "s" : ""}`
                : "Tout est lu ✓"}
            </p>
          </div>
          {unreadCount > 0 && (
            <button onClick={markAllRead}
              className="flex items-center gap-1.5 text-xs font-bold text-green-400 hover:text-green-300 transition">
              <CheckCheck size={14} />
              Tout lire
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex gap-2 mt-4 max-w-2xl mx-auto">
          {[
            { key: "all"    as const, label: `Toutes (${notifications.length})` },
            { key: "unread" as const, label: `Non lues (${unreadCount})`        },
          ].map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filter === f.key
                  ? "bg-white/10 text-white border border-white/15"
                  : "text-white/30 hover:text-white/60"
              }`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="max-w-2xl mx-auto">
        {loading ? (
          <div className="p-6 space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-20 rounded-2xl animate-pulse bg-white/[0.04]" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24">
            <p className="text-5xl mb-4">🔔</p>
            <p className="text-white/40 font-bold text-lg">
              {filter === "unread" ? "Aucune notification non lue" : "Aucune notification"}
            </p>
            <p className="text-white/20 text-sm mt-1">
              {filter === "unread"
                ? "Tu es à jour !"
                : "Les alertes signaux, succès et messages apparaîtront ici"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {filtered.map(notif => {
              const cfg  = TYPE_CONFIG[notif.type] ?? TYPE_CONFIG.system
              const Icon = cfg.icon
              return (
                <div key={notif.id}
                  className={`flex items-start gap-4 px-6 py-4 cursor-pointer transition-colors active:bg-white/[0.03] ${
                    !notif.read ? "bg-white/[0.02] hover:bg-white/[0.04]" : "hover:bg-white/[0.02]"
                  }`}
                  onClick={() => markRead(notif.id, notif.url)}>

                  {/* Icon */}
                  <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
                    style={{ background: cfg.bg }}>
                    <Icon size={18} style={{ color: cfg.color }} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm font-bold leading-snug ${notif.read ? "text-white/60" : "text-white"}`}>
                        {notif.title}
                      </p>
                      {!notif.read && (
                        <span className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5"
                          style={{ background: cfg.color }} />
                      )}
                    </div>
                    <p className="text-xs text-white/35 mt-0.5 leading-relaxed">{notif.body}</p>
                    <p className="text-[10px] text-white/20 mt-1.5">{timeAgo(notif.created_at)}</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
