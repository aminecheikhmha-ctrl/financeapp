"use client"

import { useState, useEffect, ReactNode } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { haptic } from "@/lib/capacitor"
import {
  Bell, Shield, Palette, Globe, CreditCard, LogOut,
  ChevronRight, Settings, User,
} from "lucide-react"
import { useLanguage } from "@/lib/i18n/context"
import LanguagePicker from "@/app/components/LanguagePicker"

// ─── Types ────────────────────────────────────────────────────────────────────

type AppSettings = {
  notifications_push:    boolean
  notifications_email:   boolean
  notifications_signals: boolean
  notifications_news:    boolean
  language:              "fr" | "en"
  sound_enabled:         boolean
  compact_mode:          boolean
  default_symbol:        string
  risk_per_trade:        number
  show_pnl_public:       boolean
}

const DEFAULT_SETTINGS: AppSettings = {
  notifications_push:    true,
  notifications_email:   true,
  notifications_signals: true,
  notifications_news:    false,
  language:              "fr",
  sound_enabled:         true,
  compact_mode:          false,
  default_symbol:        "AAPL",
  risk_per_trade:        2,
  show_pnl_public:       false,
}

type Section = "notifications" | "trading" | "privacy" | "appearance" | "account" | "billing"


// ─── Sub-components ───────────────────────────────────────────────────────────

function Toggle({ value, onChange, disabled = false }: {
  value: boolean; onChange: (v: boolean) => void; disabled?: boolean
}) {
  return (
    <button type="button"
      onClick={() => !disabled && onChange(!value)}
      disabled={disabled}
      className="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 disabled:opacity-40 focus:outline-none"
      style={{ background: value ? "#22c55e" : "rgba(255,255,255,0.10)" }}>
      <span className="inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200 mt-0.5"
        style={{ transform: `translateX(${value ? 24 : 2}px)` }} />
    </button>
  )
}

function SettingRow({ label, desc, children, saved = false }: {
  label: string; desc?: string; children: ReactNode; saved?: boolean
}) {
  return (
    <div className="flex items-center justify-between py-4 border-b border-white/[0.04] last:border-0">
      <div className="flex-1 mr-4">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-white">{label}</p>
          {saved && <span className="text-[10px] text-green-400 font-bold animate-pulse">✓</span>}
        </div>
        {desc && <p className="text-[11px] text-white/30 mt-0.5">{desc}</p>}
      </div>
      {children}
    </div>
  )
}

function Card({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl overflow-hidden mb-4"
      style={{ background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="px-5">{children}</div>
    </div>
  )
}

// ─── Referral section (preserved) ────────────────────────────────────────────
function ReferralSection() {
  const [ref, setRef] = useState<{ code: string; url: string; stats: { total: number; converted: number } } | null>(null)
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const token = data.session?.access_token
      if (!token) return
      fetch("/api/referral", { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json()).then(setRef).catch(() => {})
    })
  }, [])
  if (!ref) return <p className="text-white/25 text-xs">Chargement...</p>
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 rounded-xl px-3 py-2.5 text-green-400 font-mono text-sm truncate"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
          {ref.url}
        </div>
        <button onClick={() => { navigator.clipboard.writeText(ref.url); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
          className="h-10 px-4 text-xs font-black text-black rounded-xl flex-shrink-0 transition"
          style={{ background: "#22c55e" }}>
          {copied ? "✓ Copié" : "Copier"}
        </button>
      </div>
      <div className="flex gap-6">
        <div><p className="text-xl font-black text-white">{ref.stats.total}</p><p className="text-white/30 text-xs">Parrainés</p></div>
        <div><p className="text-xl font-black text-green-400">{ref.stats.converted}</p><p className="text-white/30 text-xs">Convertis</p></div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ParametresPage() {
  const router = useRouter()
  const { t } = useLanguage()

  const SECTIONS = [
    { key: "notifications" as Section, label: t.settings.tabs.notifications, icon: Bell       },
    { key: "trading"       as Section, label: t.settings.tabs.preferences,   icon: CreditCard },
    { key: "privacy"       as Section, label: t.settings.tabs.security,      icon: Shield     },
    { key: "appearance"    as Section, label: t.settings.tabs.profile,       icon: Palette    },
    { key: "account"       as Section, label: t.settings.username,           icon: User       },
    { key: "billing"       as Section, label: t.settings.tabs.subscription,  icon: CreditCard },
  ]

  const [user, setUser]         = useState<any>(null)
  const [plan, setPlan]         = useState("free")
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [saved, setSaved]       = useState<string | null>(null)
  const [activeSection, setActiveSection] = useState<Section>("notifications")
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [loading, setLoading]   = useState(true)

  // Avatar / username (preserved from old page)
  const [editUsername,  setEditUsername]  = useState("")
  const [editColor,     setEditColor]     = useState("#4ade80")
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileMsg,    setProfileMsg]    = useState("")

  const AVATAR_COLORS = ["#4ade80","#60a5fa","#f472b6","#a78bfa","#fb923c","#34d399","#facc15","#f87171"]

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push("/login"); return }
      setUser(session.user)

      const [profileRes, planRes] = await Promise.allSettled([
        supabase.from("user_profiles").select("username, avatar_color, settings").eq("id", session.user.id).single(),
        supabase.from("profiles").select("plan").eq("id", session.user.id).single(),
      ])

      if (profileRes.status === "fulfilled" && profileRes.value.data) {
        const p = profileRes.value.data
        setEditUsername(p.username ?? "")
        setEditColor(p.avatar_color ?? "#4ade80")
        if (p.settings) {
          const merged = { ...DEFAULT_SETTINGS, ...p.settings }
          setSettings(merged)
          // Apply compact mode on load
          if (merged.compact_mode) document.body.classList.add("compact-mode")
          else document.body.classList.remove("compact-mode")
        }
      }
      if (planRes.status === "fulfilled" && planRes.value.data?.plan) {
        setPlan(planRes.value.data.plan)
      }
      setLoading(false)
    }
    load()
  }, [])

  async function updateSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    haptic("light")
    const next = { ...settings, [key]: value }
    setSettings(next)
    setSaved(key)
    // Apply compact mode immediately to body
    if (key === "compact_mode") {
      if (value) document.body.classList.add("compact-mode")
      else document.body.classList.remove("compact-mode")
    }
    await supabase.from("user_profiles")
      .update({ settings: next })
      .eq("id", user?.id)
    setTimeout(() => setSaved(null), 1200)
  }

  async function saveProfile() {
    setSavingProfile(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    await fetch("/api/user-profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ username: editUsername, avatar_color: editColor }),
    })
    setProfileMsg("✅ Sauvegardé")
    setSavingProfile(false)
    setTimeout(() => setProfileMsg(""), 2500)
  }

  async function handleLogout() {
    haptic("medium")
    await supabase.auth.signOut()
    router.push("/login")
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#050505]">
        <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white pb-20">

      {/* Header */}
      <div className="px-6 py-5 border-b border-white/5">
        <h1 className="text-2xl font-black text-white">{t.settings.title}</h1>
        <p className="text-white/30 text-sm mt-0.5">{user?.email}</p>
      </div>

      {/* Layout */}
      <div className="flex max-w-4xl mx-auto">

        {/* Sidebar nav */}
        <nav className="hidden md:block w-52 flex-shrink-0 border-r border-white/5 p-4 space-y-1 sticky top-0 h-screen overflow-y-auto">
          {SECTIONS.map(s => {
            const Icon = s.icon
            return (
              <button key={s.key} onClick={() => setActiveSection(s.key)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all text-left ${
                  activeSection === s.key
                    ? "bg-white/8 text-white border border-white/10"
                    : "text-white/40 hover:text-white/70 hover:bg-white/4"
                }`}>
                <Icon size={15} />
                {s.label}
              </button>
            )
          })}
          <div className="pt-4 border-t border-white/5 mt-4">
            <button onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition-all">
              <LogOut size={15} />
              {t.nav.logout}
            </button>
          </div>
        </nav>

        {/* Mobile section tabs */}
        <div className="md:hidden w-full border-b border-white/5 overflow-x-auto">
          <div className="flex px-4 py-2 gap-1 min-w-max">
            {SECTIONS.map(s => (
              <button key={s.key} onClick={() => setActiveSection(s.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition ${
                  activeSection === s.key ? "bg-white/10 text-white" : "text-white/35"
                }`}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 px-4 md:px-8 py-6 min-w-0">

          {/* ── NOTIFICATIONS ── */}
          {activeSection === "notifications" && (
            <div>
              <h2 className="text-base font-black text-white mb-5">🔔 {t.settings.tabs.notifications}</h2>
              <Card>
                <SettingRow label={t.settings.notifications.signals} saved={saved === "notifications_push"}>
                  <Toggle value={settings.notifications_push} onChange={v => updateSetting("notifications_push", v)} />
                </SettingRow>
                <SettingRow label={t.settings.notifications.weekly} saved={saved === "notifications_email"}>
                  <Toggle value={settings.notifications_email} onChange={v => updateSetting("notifications_email", v)} />
                </SettingRow>
                <SettingRow label={t.settings.notifications.signals} saved={saved === "notifications_signals"}>
                  <Toggle value={settings.notifications_signals} onChange={v => updateSetting("notifications_signals", v)} />
                </SettingRow>
                <SettingRow label={t.settings.notifications.news} saved={saved === "notifications_news"}>
                  <Toggle value={settings.notifications_news} onChange={v => updateSetting("notifications_news", v)} />
                </SettingRow>
                <SettingRow label={t.common.refresh} saved={saved === "sound_enabled"}>
                  <Toggle value={settings.sound_enabled} onChange={v => updateSetting("sound_enabled", v)} />
                </SettingRow>
              </Card>
            </div>
          )}

          {/* ── TRADING ── */}
          {activeSection === "trading" && (
            <div>
              <h2 className="text-base font-black text-white mb-5">💼 {t.settings.tabs.preferences}</h2>
              <Card>
                <SettingRow label="Actif par défaut" desc="Actif affiché à l'ouverture du dashboard">
                  <input value={settings.default_symbol}
                    onChange={e => updateSetting("default_symbol", e.target.value.toUpperCase())}
                    className="w-20 h-8 text-center text-xs font-bold rounded-lg outline-none text-white"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)" }}
                    maxLength={8} />
                </SettingRow>
                <SettingRow label={`Risque par trade : ${settings.risk_per_trade}%`} desc="Pourcentage du capital risqué par défaut">
                  <div className="flex items-center gap-2">
                    <input type="range" min={0.5} max={10} step={0.5}
                      value={settings.risk_per_trade}
                      onChange={e => updateSetting("risk_per_trade", Number(e.target.value))}
                      className="w-24" style={{ accentColor: "#22c55e" }} />
                    <span className="text-xs font-bold text-green-400 w-8">{settings.risk_per_trade}%</span>
                  </div>
                </SettingRow>
                <SettingRow label="Mode compact" desc="Interface plus dense avec moins d'espacement" saved={saved === "compact_mode"}>
                  <Toggle value={settings.compact_mode} onChange={v => updateSetting("compact_mode", v)} />
                </SettingRow>
              </Card>

              <div className="rounded-2xl p-5"
                style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.12)" }}>
                <p className="text-sm font-black text-white mb-1">🔄 Réinitialiser le portfolio</p>
                <p className="text-xs text-white/40 mb-3">Remet ton capital fictif à $100 000 et supprime tous les ordres. Irréversible.</p>
                <button onClick={() => {
                  if (!confirm("Réinitialiser ton portfolio à $100 000 ? Tous tes ordres seront supprimés.")) return
                  supabase.from("trading_accounts").update({ cash: 100000 }).eq("user_id", user.id)
                  supabase.from("orders").delete().eq("user_id", user.id)
                }}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-red-400 border border-red-500/20 hover:bg-red-500/10 transition">
                  Réinitialiser → $100 000
                </button>
              </div>
            </div>
          )}

          {/* ── PRIVACY ── */}
          {activeSection === "privacy" && (
            <div>
              <h2 className="text-base font-black text-white mb-5">🔒 {t.settings.tabs.security}</h2>
              <Card>
                <SettingRow label="Afficher mon P&L publiquement" desc="Visible dans le classement social" saved={saved === "show_pnl_public"}>
                  <Toggle value={settings.show_pnl_public} onChange={v => updateSetting("show_pnl_public", v)} />
                </SettingRow>
              </Card>

              <div className="rounded-2xl p-5 mb-4"
                style={{ background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.06)" }}>
                <p className="text-[10px] text-white/25 uppercase tracking-widest font-bold mb-3">Données personnelles</p>
                <div className="space-y-0">
                  <button className="flex items-center justify-between w-full py-3 text-sm text-white/50 hover:text-white transition border-b border-white/[0.04]">
                    <span>Télécharger mes données</span>
                    <ChevronRight size={14} />
                  </button>
                  <button onClick={() => setDeleteConfirm(true)}
                    className="flex items-center justify-between w-full py-3 text-sm text-red-400/60 hover:text-red-400 transition">
                    <span>Supprimer mon compte</span>
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>

              {deleteConfirm && (
                <div className="rounded-2xl p-5"
                  style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.20)" }}>
                  <p className="text-sm font-black text-white mb-2">⚠️ Supprimer mon compte</p>
                  <p className="text-xs text-white/50 mb-4">Cette action est irréversible. Toutes tes données seront supprimées définitivement.</p>
                  <div className="flex gap-2">
                    <button onClick={() => setDeleteConfirm(false)}
                      className="flex-1 py-2 rounded-lg text-xs font-semibold text-white/40 border border-white/10">{t.common.cancel}</button>
                    <button onClick={() => alert("Contacte support@tradex.io pour supprimer ton compte.")}
                      className="flex-1 py-2 rounded-lg text-xs font-bold text-white bg-red-500/20 border border-red-500/30">
                      {t.settings.security.deleteAccount}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── APPEARANCE ── */}
          {activeSection === "appearance" && (
            <div>
              <h2 className="text-base font-black text-white mb-5">🎨 {t.settings.tabs.profile}</h2>

              {/* Username + Avatar color */}
              <div className="rounded-2xl p-5 mb-4"
                style={{ background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.06)" }}>
                <p className="text-[10px] text-white/25 uppercase tracking-widest font-bold mb-4">{t.settings.tabs.profile}</p>
                <div className="mb-4">
                  <label className="text-xs text-white/40 mb-1.5 block">{t.settings.username}</label>
                  <input value={editUsername} onChange={e => setEditUsername(e.target.value)}
                    maxLength={20}
                    className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none"
                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)" }} />
                </div>
                <div className="mb-4">
                  <label className="text-xs text-white/40 mb-2 block">{t.settings.avatar}</label>
                  <div className="flex gap-2 flex-wrap">
                    {AVATAR_COLORS.map(c => (
                      <button key={c} onClick={() => setEditColor(c)}
                        className="w-8 h-8 rounded-full border-2 transition-transform hover:scale-110"
                        style={{
                          background: c,
                          borderColor: editColor === c ? "white" : "transparent",
                          transform: editColor === c ? "scale(1.15)" : "scale(1)",
                        }} />
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={saveProfile} disabled={savingProfile}
                    className="px-4 py-2 rounded-xl text-xs font-black text-black transition"
                    style={{ background: "#22c55e" }}>
                    {savingProfile ? "..." : t.settings.saveProfile}
                  </button>
                  {profileMsg && <span className="text-xs text-green-400 font-bold">{profileMsg}</span>}
                </div>
              </div>

              <Card>
                <SettingRow label={t.settings.language}>
                  <LanguagePicker />
                </SettingRow>
              </Card>
            </div>
          )}

          {/* ── ACCOUNT ── */}
          {activeSection === "account" && (
            <div>
              <h2 className="text-base font-black text-white mb-5">👤 {t.settings.tabs.profile}</h2>

              <div className="rounded-2xl overflow-hidden mb-4"
                style={{ background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="px-5 divide-y divide-white/[0.04]">
                  {[
                    { label: "Email",          value: user?.email },
                    { label: "Compte créé",    value: user?.created_at ? new Date(user.created_at).toLocaleDateString("fr-FR") : "—" },
                    { label: "Plan actuel",    value: plan.charAt(0).toUpperCase() + plan.slice(1) },
                    { label: "Connexion via",  value: user?.app_metadata?.provider ?? "email" },
                  ].map(item => (
                    <div key={item.label} className="flex justify-between items-center py-4">
                      <span className="text-sm text-white/40">{item.label}</span>
                      <span className="text-sm font-semibold text-white">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Password reset */}
              <div className="rounded-2xl p-5 mb-4"
                style={{ background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.06)" }}>
                <p className="text-sm font-black text-white mb-3">{t.settings.security.changePassword}</p>
                <button onClick={async () => {
                  const { error } = await supabase.auth.resetPasswordForEmail(user?.email, {
                    redirectTo: `${window.location.origin}/reset-password`
                  })
                  if (!error) alert("Email envoyé ! Vérifie ta boîte mail.")
                }}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white/50 hover:text-white border border-white/10 hover:border-white/20 transition">
                  📧 Envoyer le lien de réinitialisation
                </button>
              </div>

              {/* Parrainage */}
              <div className="rounded-2xl p-5"
                style={{ background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.06)" }}>
                <p className="text-sm font-black text-white mb-3">🎁 Parrainage</p>
                <ReferralSection />
              </div>
            </div>
          )}

          {/* ── BILLING ── */}
          {activeSection === "billing" && (
            <div>
              <h2 className="text-base font-black text-white mb-5">💎 {t.settings.tabs.subscription}</h2>

              {/* Current plan */}
              <div className="rounded-2xl p-5 mb-4"
                style={{
                  background: plan !== "free" ? "rgba(34,197,94,0.06)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${plan !== "free" ? "rgba(34,197,94,0.20)" : "rgba(255,255,255,0.08)"}`,
                }}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-black text-white">
                      Plan {plan === "free" ? "Gratuit" : plan === "pro" ? "Pro ⭐" : "Premium 💎"}
                    </p>
                    <p className="text-xs text-white/40 mt-0.5">
                      {plan === "free"
                        ? "3 signaux/jour · Cours débutant"
                        : plan === "pro"
                          ? "Signaux illimités · Screener · Alertes"
                          : "Tout Pro + API + Support prioritaire"}
                    </p>
                  </div>
                  {plan === "free" && (
                    <button onClick={() => router.push("/pricing")}
                      className="px-4 py-2 rounded-xl text-xs font-black text-black transition hover:scale-[1.02]"
                      style={{ background: "#22c55e" }}>
                      {t.settings.subscription.upgrade} →
                    </button>
                  )}
                </div>
                {plan !== "free" && (
                  <div className="flex gap-2 mt-4">
                    <button className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white/40 border border-white/10 hover:text-white transition">
                      {t.settings.subscription.manageBilling}
                    </button>
                    <button className="px-3 py-1.5 rounded-lg text-xs font-semibold text-red-400/60 border border-red-500/15 hover:text-red-400 hover:bg-red-500/10 transition">
                      {t.settings.subscription.cancel}
                    </button>
                  </div>
                )}
              </div>

              {/* Plans comparison (free only) */}
              {plan === "free" && (
                <div className="space-y-3">
                  {[
                    { name: "Pro ⭐", price: "19€/mois", color: "#22c55e",
                      features: ["Signaux illimités", "Screener 160+ actifs", "Alertes illimitées", "Tous les cours", "Backtest"] },
                    { name: "Premium 💎", price: "49€/mois", color: "#fbbf24",
                      features: ["Tout Pro inclus", "API publique", "Rapport IA hebdo", "Support prioritaire"] },
                  ].map(p => (
                    <div key={p.name} className="rounded-2xl p-4"
                      style={{ background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.06)" }}>
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="text-sm font-black" style={{ color: p.color }}>{p.name}</p>
                          <p className="text-lg font-black text-white">{p.price}</p>
                        </div>
                        <button onClick={() => router.push("/pricing")}
                          className="px-4 py-2 rounded-xl text-xs font-black transition hover:scale-[1.02]"
                          style={{ background: `${p.color}15`, color: p.color, border: `1px solid ${p.color}25` }}>
                          Choisir →
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {p.features.map(f => (
                          <span key={f} className="text-[10px] text-white/50 px-2 py-0.5 rounded-full"
                            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                            ✓ {f}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
