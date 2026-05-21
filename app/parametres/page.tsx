"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Settings, User, Bell, Shield, LogOut, ChevronLeft } from "lucide-react"
import { cn } from "@/lib/utils"

// ─── Types ─────────────────────────────────────────────────────────────────────
type UserProfile = {
  id: string
  username?: string
  avatar_color?: string
  level?: string
  risk_tolerance?: "faible" | "modéré" | "élevé"
  notifications_email?: boolean
  notifications_push?: boolean
}

const AVATAR_COLORS = [
  "#4ade80", "#60a5fa", "#f472b6", "#a78bfa",
  "#fb923c", "#34d399", "#facc15", "#f87171",
]

// ─── Referral section ──────────────────────────────────────────────────────────
function ReferralSection() {
  const [ref, setRef] = useState<{ code: string; url: string; stats: { total: number; converted: number } } | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const token = data.session?.access_token
      if (!token) return
      fetch("/api/referral", { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(setRef)
        .catch(() => {})
    })
  }, [])

  if (!ref) return <div className="text-white/30 text-xs">Chargement...</div>

  function copy() {
    navigator.clipboard.writeText(ref!.url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 rounded-xl px-3 py-2.5 text-green-400 font-mono text-sm truncate" style={{ background: "var(--bg-canvas)", border: "1px solid var(--border-default)" }}>
          {ref.url}
        </div>
        <button onClick={copy} className="btn btn-primary h-10 px-4 text-xs flex-shrink-0">
          {copied ? "✓ Copié" : "Copier"}
        </button>
      </div>
      <div className="flex gap-6">
        <div>
          <p className="text-xl font-black text-white">{ref.stats.total}</p>
          <p className="text-white/30 text-xs">Parrainés</p>
        </div>
        <div>
          <p className="text-xl font-black text-green-400">{ref.stats.converted}</p>
          <p className="text-white/30 text-xs">Convertis</p>
        </div>
      </div>
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────
export default function ParametresPage() {
  const router = useRouter()

  const [user, setUser]         = useState<any>(null)
  const [profile, setProfile]   = useState<UserProfile | null>(null)
  const [loading, setLoading]   = useState(true)

  // Editable state
  const [editUsername, setEditUsername] = useState("")
  const [editColor, setEditColor]       = useState("#4ade80")
  const [editRisk, setEditRisk]         = useState<"faible" | "modéré" | "élevé" | "">("")
  const [notifEmail, setNotifEmail]     = useState(false)
  const [notifPush, setNotifPush]       = useState(false)
  const [saving, setSaving]             = useState(false)
  const [saveMsg, setSaveMsg]           = useState("")

  async function getToken() {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token
  }

  useEffect(() => {
    async function load() {
      const { data: { user: u } } = await supabase.auth.getUser()
      if (!u) { router.push("/login"); return }
      setUser(u)
      const token = await getToken()
      if (!token) { setLoading(false); return }
      try {
        const res = await fetch("/api/user-profile", { headers: { Authorization: `Bearer ${token}` } })
        const json = await res.json()
        const p: UserProfile | null = json.profile
        setProfile(p)
        if (p) {
          setEditUsername(p.username ?? "")
          setEditColor(p.avatar_color ?? "#4ade80")
          setEditRisk(p.risk_tolerance ?? "")
          setNotifEmail(p.notifications_email ?? false)
          setNotifPush(p.notifications_push ?? false)
        }
      } catch {}
      setLoading(false)
    }
    load()
  }, [])

  async function handleSave() {
    setSaving(true)
    setSaveMsg("")
    const token = await getToken()
    if (!token) { setSaving(false); return }
    try {
      const res = await fetch("/api/user-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          username: editUsername,
          avatar_color: editColor,
          risk_tolerance: editRisk || undefined,
          notifications_email: notifEmail,
          notifications_push: notifPush,
        }),
      })
      const json = await res.json()
      if (json.profile) {
        setProfile(json.profile)
        setSaveMsg("✅ Modifications sauvegardées")
      } else {
        setSaveMsg("❌ Erreur lors de la sauvegarde")
      }
    } catch {
      setSaveMsg("❌ Erreur réseau")
    }
    setSaving(false)
    setTimeout(() => setSaveMsg(""), 3000)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    document.cookie = "onboarding_done=; path=/; max-age=0"
    router.push("/")
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-canvas)" }}>
        <div className="w-6 h-6 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const initial = (profile?.username ?? user?.email ?? "?")[0]?.toUpperCase()

  return (
    <div className="min-h-screen pb-16 page-enter" style={{ background: "var(--bg-canvas)" }}>
      <div className="max-w-xl mx-auto px-4 pt-6">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.back()}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white/40 hover:text-white hover:bg-white/6 transition"
          >
            <ChevronLeft size={18} />
          </button>
          <div>
            <h1 className="text-[18px] font-bold text-white tracking-tight">Paramètres</h1>
            <p className="text-[12px] text-white/30">{user?.email}</p>
          </div>
        </div>

        <div className="space-y-4">

          {/* ── Profil ───────────────────────────────────────────────────── */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <User size={13} className="text-white/30" />
              <span className="text-[11px] font-semibold text-white/30 uppercase tracking-widest">Profil</span>
            </div>
            <div className="rounded-2xl p-5 space-y-5" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>

              {/* Avatar preview + colors */}
              <div className="flex items-center gap-4">
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-black text-black flex-shrink-0"
                  style={{ backgroundColor: editColor }}
                >
                  {initial}
                </div>
                <div className="flex flex-wrap gap-2">
                  {AVATAR_COLORS.map(color => (
                    <button
                      key={color}
                      onClick={() => setEditColor(color)}
                      className={cn(
                        "w-8 h-8 rounded-full transition-all",
                        editColor === color
                          ? "scale-125 ring-2 ring-white ring-offset-2 ring-offset-[#0c0c0c]"
                          : "hover:scale-110"
                      )}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              {/* Username */}
              <div>
                <label className="block text-[12px] text-white/40 mb-1.5 font-medium">Pseudo</label>
                <input
                  type="text"
                  value={editUsername}
                  onChange={e => setEditUsername(e.target.value)}
                  className="input"
                  maxLength={30}
                  placeholder="Ton pseudo…"
                />
              </div>
            </div>
          </section>

          {/* ── Profil de risque ─────────────────────────────────────────── */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Shield size={13} className="text-white/30" />
              <span className="text-[11px] font-semibold text-white/30 uppercase tracking-widest">Profil de risque</span>
            </div>
            <div className="rounded-2xl p-5" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { icon: "🛡️", label: "Prudent",   value: "faible" as const },
                  { icon: "⚖️", label: "Modéré",    value: "modéré" as const },
                  { icon: "🔥", label: "Agressif",  value: "élevé"  as const },
                ].map(r => (
                  <button
                    key={r.value}
                    onClick={() => setEditRisk(r.value)}
                    className={cn(
                      "p-3 rounded-xl border text-center transition-all",
                      editRisk === r.value
                        ? "border-green-500/50 bg-green-500/8"
                        : "border-white/8 bg-white/3 hover:border-white/15"
                    )}
                  >
                    <div className="text-xl mb-1">{r.icon}</div>
                    <div className="text-white text-xs font-semibold">{r.label}</div>
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* ── Notifications ────────────────────────────────────────────── */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Bell size={13} className="text-white/30" />
              <span className="text-[11px] font-semibold text-white/30 uppercase tracking-widest">Notifications</span>
            </div>
            <div className="rounded-2xl divide-y divide-white/[0.04]" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
              {[
                { label: "Notifications email", desc: "Alertes et rapports hebdomadaires", value: notifEmail, set: setNotifEmail },
                { label: "Notifications push",  desc: "Signaux et alertes de prix",        value: notifPush,  set: setNotifPush  },
              ].map(n => (
                <div key={n.label} className="flex items-center justify-between px-5 py-4">
                  <div>
                    <p className="text-[14px] font-medium text-white">{n.label}</p>
                    <p className="text-[12px] text-white/30 mt-0.5">{n.desc}</p>
                  </div>
                  <button
                    onClick={() => n.set(!n.value)}
                    className={cn(
                      "w-11 h-6 rounded-full transition-all relative flex-shrink-0",
                      n.value ? "bg-green-500" : "bg-white/10"
                    )}
                  >
                    <div className={cn(
                      "w-4 h-4 bg-white rounded-full absolute top-1 transition-all",
                      n.value ? "left-6" : "left-1"
                    )} />
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* ── Thème ────────────────────────────────────────────────────── */}
          <div className="rounded-2xl px-5 py-4 flex items-center justify-between" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
            <div>
              <p className="text-[14px] font-medium text-white">Thème</p>
              <p className="text-[12px] text-white/30 mt-0.5">Mode d'affichage</p>
            </div>
            <span className="text-[12px] px-3 py-1.5 rounded-lg font-medium text-white/40" style={{ background: "var(--bg-active)", border: "1px solid var(--border-default)" }}>
              🌙 Dark
            </span>
          </div>

          {/* ── Sauvegarde ───────────────────────────────────────────────── */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn btn-primary w-full h-11 text-sm rounded-xl disabled:opacity-40"
          >
            {saving ? "Sauvegarde…" : "Sauvegarder les modifications"}
          </button>
          {saveMsg && (
            <p className={cn("text-center text-sm font-medium", saveMsg.startsWith("✅") ? "text-green-400" : "text-red-400")}>
              {saveMsg}
            </p>
          )}

          {/* ── Parrainage ───────────────────────────────────────────────── */}
          <section>
            <div className="rounded-2xl p-5" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
              <h3 className="text-[14px] font-semibold text-white mb-1">Parrainage 🎁</h3>
              <p className="text-[12px] text-white/30 mb-4">Gagne 1 mois Pro gratuit pour chaque ami qui devient payant</p>
              <ReferralSection />
            </div>
          </section>

          {/* ── Déconnexion ──────────────────────────────────────────────── */}
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-red-400 hover:bg-red-500/8 transition font-semibold text-sm"
            style={{ border: "1px solid rgba(239,68,68,0.2)" }}
          >
            <LogOut size={15} />
            Se déconnecter
          </button>

        </div>
      </div>
    </div>
  )
}
