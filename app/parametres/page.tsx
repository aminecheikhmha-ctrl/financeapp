"use client"

import { useState, useEffect, useRef, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { haptic } from "@/lib/capacitor"
import { useLanguage } from "@/lib/i18n/context"
import { useTheme } from "@/lib/theme"
import LanguagePicker from "@/app/components/LanguagePicker"
import {
  Bell, Shield, Palette, CreditCard, LogOut,
  User, ChevronRight, Zap, Code2, Gift, Sun, Moon,
} from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

type AppSettings = {
  notifications_push:    boolean
  notifications_email:   boolean
  notifications_signals: boolean
  notifications_news:    boolean
  sound_enabled:         boolean
  compact_mode:          boolean
  default_symbol:        string
  risk_per_trade:        number
  show_pnl_public:       boolean
}

const DEFAULTS: AppSettings = {
  notifications_push:    true,
  notifications_email:   true,
  notifications_signals: true,
  notifications_news:    false,
  sound_enabled:         true,
  compact_mode:          false,
  default_symbol:        "AAPL",
  risk_per_trade:        2,
  show_pnl_public:       false,
}

const AVATAR_COLORS = [
  "#4ade80","#60a5fa","#f472b6","#a78bfa",
  "#fb923c","#34d399","#facc15","#f87171",
  "#38bdf8","#e879f9","#a3e635","#fb7185",
]

// ─── Nav sections ────────────────────────────────────────────────────────────

const SECTIONS = [
  { id: "profile",       icon: User,        emoji: "👤", label: "Profil" },
  { id: "appearance",    icon: Palette,     emoji: "🎨", label: "Apparence" },
  { id: "notifications", icon: Bell,        emoji: "🔔", label: "Notifications" },
  { id: "trading",       icon: Zap,         emoji: "⚡", label: "Trading" },
  { id: "privacy",       icon: Shield,      emoji: "🔒", label: "Confidentialité" },
  { id: "billing",       icon: CreditCard,  emoji: "💎", label: "Abonnement" },
  { id: "tools",         icon: Code2,       emoji: "🔧", label: "Outils" },
]

// ─── Sub-components ──────────────────────────────────────────────────────────

function Toggle({ value, onChange, disabled = false }: {
  value: boolean; onChange: (v: boolean) => void; disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!value)}
      disabled={disabled}
      className="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full transition-all duration-200 disabled:opacity-40"
      style={{
        background: value
          ? "linear-gradient(135deg, #22c55e, #16a34a)"
          : "rgba(255,255,255,0.10)",
        boxShadow: value ? "0 2px 8px rgba(34,197,94,0.30)" : "none",
      }}>
      <span
        className="inline-block h-[18px] w-[18px] transform rounded-full bg-white shadow-sm transition-transform duration-200 mt-[3px]"
        style={{ transform: `translateX(${value ? 22 : 3}px)` }}
      />
    </button>
  )
}

function SettingRow({ label, desc, children, saved }: {
  label: string; desc?: string; children: ReactNode; saved?: boolean
}) {
  return (
    <div className="flex items-center justify-between py-4 border-b last:border-0"
      style={{ borderColor: "var(--border-faint)" }}>
      <div className="flex-1 mr-5 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-[13px] font-semibold text-white">{label}</p>
          {saved && (
            <span className="text-[10px] text-green-400 font-bold animate-fade-in">✓ Sauvegardé</span>
          )}
        </div>
        {desc && <p className="text-[11px] mt-0.5" style={{ color: "var(--text-tertiary)" }}>{desc}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  )
}

function SectionCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl overflow-hidden mb-3 ${className}`}
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-subtle)",
      }}>
      <div className="px-5">{children}</div>
    </div>
  )
}

function SectionTitle({ emoji, label, id }: { emoji: string; label: string; id: string }) {
  return (
    <div id={id} className="flex items-center gap-2.5 mb-4 pt-2">
      <span className="text-lg">{emoji}</span>
      <h2 className="text-[16px] font-black text-white">{label}</h2>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ParametresPage() {
  const router = useRouter()
  const { t }  = useLanguage()
  const { theme, toggle: toggleTheme } = useTheme()

  const [user,         setUser]         = useState<any>(null)
  const [plan,         setPlan]         = useState("free")
  const [settings,     setSettings]     = useState<AppSettings>(DEFAULTS)
  const [saved,        setSaved]        = useState<string | null>(null)
  const [activeSection,setActiveSection]= useState("profile")
  const [deleteConfirm,setDeleteConfirm]= useState(false)
  const [ready,        setReady]        = useState(false)

  // Profile editing
  const [editUsername, setEditUsername] = useState("")
  const [editColor,    setEditColor]    = useState("#4ade80")
  const [savingProfile,setSavingProfile]= useState(false)
  const [profileMsg,   setProfileMsg]   = useState("")

  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push("/login"); return }
      setUser(session.user)

      const [profileRes, planRes] = await Promise.allSettled([
        supabase.from("user_profiles").select("username,avatar_color,settings").eq("id", session.user.id).single(),
        supabase.from("profiles").select("plan").eq("id", session.user.id).single(),
      ])

      if (profileRes.status === "fulfilled" && profileRes.value.data) {
        const p = profileRes.value.data
        setEditUsername(p.username ?? session.user.email?.split("@")[0] ?? "")
        setEditColor(p.avatar_color ?? "#4ade80")
        if (p.settings) {
          setSettings({ ...DEFAULTS, ...p.settings })
        }
      }
      if (planRes.status === "fulfilled" && planRes.value.data?.plan) {
        setPlan(planRes.value.data.plan)
      }
      setReady(true)
    }
    load()
  }, [])

  // Scroll spy
  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveSection(entry.target.id)
        }
      },
      { root: el, threshold: 0.3 }
    )
    SECTIONS.forEach(s => {
      const target = document.getElementById(s.id)
      if (target) observer.observe(target)
    })
    return () => observer.disconnect()
  }, [ready])

  async function updateSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    haptic("light")
    const next = { ...settings, [key]: value }
    setSettings(next)
    setSaved(key)
    if (key === "compact_mode") {
      if (value) document.body.classList.add("compact")
      else document.body.classList.remove("compact")
    }
    await supabase.from("user_profiles").update({ settings: next }).eq("id", user?.id)
    setTimeout(() => setSaved(null), 1800)
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
    setProfileMsg("Sauvegardé ✓")
    setSavingProfile(false)
    setTimeout(() => setProfileMsg(""), 2500)
  }

  async function handleLogout() {
    haptic("medium")
    await supabase.auth.signOut()
    router.push("/login")
  }

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })
    setActiveSection(id)
  }

  // Skeleton pendant le chargement
  if (!ready) return (
    <div className="min-h-screen page-enter">
      <div className="max-w-4xl mx-auto px-6 py-6">
        <div className="h-8 w-40 skeleton mb-6 rounded-xl" />
        <div className="flex gap-6">
          <div className="hidden md:block w-48 flex-shrink-0 space-y-2">
            {[...Array(7)].map((_, i) => <div key={i} className="h-10 skeleton rounded-xl" />)}
          </div>
          <div className="flex-1 space-y-3">
            {[...Array(5)].map((_, i) => <div key={i} className="h-20 skeleton rounded-2xl" />)}
          </div>
        </div>
      </div>
    </div>
  )

  const initial = (editUsername || user?.email || "?")[0]?.toUpperCase()

  return (
    <div className="min-h-screen page-enter text-white">
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-6">

        {/* ── Page header ─────────────────────────────────────── */}
        <div className="mb-8">
          <p className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-1">Paramètres</p>
          <h1 className="text-[22px] font-black text-white">Mon compte</h1>
          <p className="text-[13px] mt-0.5" style={{ color: "var(--text-tertiary)" }}>{user?.email}</p>
        </div>

        <div className="flex gap-6">

          {/* ── Left nav ──────────────────────────────────────── */}
          <nav className="hidden md:flex flex-col w-48 flex-shrink-0 gap-0.5 sticky top-20 self-start">
            {SECTIONS.map(s => (
              <button key={s.id}
                onClick={() => scrollTo(s.id)}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] font-medium text-left transition-all"
                style={activeSection === s.id ? {
                  background: "var(--bg-selected)",
                  color: "var(--green-light)",
                  border: "1px solid var(--green-border)",
                } : {
                  color: "var(--text-tertiary)",
                  border: "1px solid transparent",
                }}>
                <span className="text-sm">{s.emoji}</span>
                {s.label}
              </button>
            ))}
            <div className="mt-2 pt-2" style={{ borderTop: "1px solid var(--border-faint)" }}>
              <button onClick={handleLogout}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] font-medium w-full transition-all"
                style={{ color: "var(--red-light)", opacity: 0.6 }}
                onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
                onMouseLeave={e => (e.currentTarget.style.opacity = "0.6")}>
                <LogOut size={14} />
                Déconnexion
              </button>
            </div>
          </nav>

          {/* ── Content ───────────────────────────────────────── */}
          <div ref={contentRef} className="flex-1 min-w-0 space-y-10 overflow-y-auto">

            {/* ── PROFIL ──────────────────────────────────────── */}
            <section>
              <SectionTitle id="profile" emoji="👤" label="Profil" />

              {/* Avatar + Username */}
              <div className="rounded-2xl p-5 mb-3" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
                <div className="flex items-center gap-4 mb-5">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black text-black flex-shrink-0 ring-2"
                    style={{ background: editColor, ringColor: editColor }}>
                    {initial}
                  </div>
                  <div>
                    <p className="text-[15px] font-black text-white">{editUsername || user?.email?.split("@")[0]}</p>
                    <p className="text-[11px] mt-0.5" style={{ color: "var(--text-tertiary)" }}>{user?.email}</p>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full"
                        style={{
                          background: plan === "premium" ? "rgba(251,191,36,0.15)" : plan === "pro" ? "var(--green-dim)" : "var(--bg-active)",
                          color: plan === "premium" ? "#fbbf24" : plan === "pro" ? "var(--green-light)" : "var(--text-secondary)",
                          border: `1px solid ${plan === "premium" ? "rgba(251,191,36,0.25)" : plan === "pro" ? "var(--green-border)" : "var(--border-default)"}`,
                        }}>
                        {plan === "free" ? "Free" : plan === "pro" ? "Pro ⭐" : "Premium 💎"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Username input */}
                <div className="mb-4">
                  <label className="text-[11px] font-bold uppercase tracking-widest block mb-1.5" style={{ color: "var(--text-tertiary)" }}>
                    Pseudo
                  </label>
                  <input
                    value={editUsername}
                    onChange={e => setEditUsername(e.target.value)}
                    maxLength={20}
                    placeholder="Ton pseudo"
                    className="w-full px-3 py-2.5 rounded-xl text-[13px] text-white outline-none transition-all"
                    style={{
                      background: "var(--bg-active)",
                      border: "1px solid var(--border-default)",
                    }}
                    onFocus={e => (e.target.style.borderColor = "var(--border-focus)")}
                    onBlur={e => (e.target.style.borderColor = "var(--border-default)")}
                  />
                </div>

                {/* Color picker */}
                <div className="mb-5">
                  <label className="text-[11px] font-bold uppercase tracking-widest block mb-2" style={{ color: "var(--text-tertiary)" }}>
                    Couleur d'avatar
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {AVATAR_COLORS.map(c => (
                      <button key={c} onClick={() => setEditColor(c)}
                        className="w-8 h-8 rounded-full transition-all hover:scale-110"
                        style={{
                          background: c,
                          transform: editColor === c ? "scale(1.2)" : "scale(1)",
                          outline: editColor === c ? `3px solid white` : "none",
                          outlineOffset: "2px",
                        }} />
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button onClick={saveProfile} disabled={savingProfile}
                    className="px-5 py-2.5 rounded-xl text-[13px] font-black text-black transition-all hover:scale-[1.01] disabled:opacity-50"
                    style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)" }}>
                    {savingProfile ? "Sauvegarde…" : "Sauvegarder"}
                  </button>
                  {profileMsg && (
                    <span className="text-[12px] text-green-400 font-bold animate-fade-in">{profileMsg}</span>
                  )}
                </div>
              </div>

              {/* Account info */}
              <SectionCard>
                {[
                  { label: "Email",           value: user?.email },
                  { label: "Compte créé le",  value: user?.created_at ? new Date(user.created_at).toLocaleDateString("fr-FR") : "—" },
                  { label: "Connexion via",   value: user?.app_metadata?.provider ?? "email" },
                ].map(item => (
                  <SettingRow key={item.label} label={item.label}>
                    <span className="text-[13px] font-semibold" style={{ color: "var(--text-secondary)" }}>{item.value}</span>
                  </SettingRow>
                ))}
              </SectionCard>
            </section>

            {/* ── APPARENCE ───────────────────────────────────── */}
            <section>
              <SectionTitle id="appearance" emoji="🎨" label="Apparence" />
              <SectionCard>
                <SettingRow label="Thème" desc="Clair ou sombre selon ta préférence">
                  <button onClick={toggleTheme}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] font-bold transition-all hover:scale-[1.02]"
                    style={{
                      background: "var(--bg-active)",
                      border: "1px solid var(--border-default)",
                      color: "var(--text-secondary)",
                    }}>
                    {theme === "dark" ? <Moon size={13} /> : <Sun size={13} />}
                    {theme === "dark" ? "Mode sombre" : "Mode clair"}
                  </button>
                </SettingRow>
                <SettingRow label="Langue">
                  <LanguagePicker />
                </SettingRow>
                <SettingRow label="Mode compact" desc="Interface plus dense" saved={saved === "compact_mode"}>
                  <Toggle value={settings.compact_mode} onChange={v => updateSetting("compact_mode", v)} />
                </SettingRow>
              </SectionCard>
            </section>

            {/* ── NOTIFICATIONS ───────────────────────────────── */}
            <section>
              <SectionTitle id="notifications" emoji="🔔" label="Notifications" />
              <SectionCard>
                <SettingRow label="Notifications push" desc="Alertes sur navigateur et mobile" saved={saved === "notifications_push"}>
                  <Toggle value={settings.notifications_push} onChange={v => updateSetting("notifications_push", v)} />
                </SettingRow>
                <SettingRow label="Emails marketing" desc="Nouveautés et mises à jour Tradex" saved={saved === "notifications_email"}>
                  <Toggle value={settings.notifications_email} onChange={v => updateSetting("notifications_email", v)} />
                </SettingRow>
                <SettingRow label="Alertes signaux IA" desc="Notifié quand un STRONG BUY est détecté" saved={saved === "notifications_signals"}>
                  <Toggle value={settings.notifications_signals} onChange={v => updateSetting("notifications_signals", v)} />
                </SettingRow>
                <SettingRow label="Actualités importantes" desc="Événements macro impactant ton portfolio" saved={saved === "notifications_news"}>
                  <Toggle value={settings.notifications_news} onChange={v => updateSetting("notifications_news", v)} />
                </SettingRow>
                <SettingRow label="Sons" desc="Feedback sonore pour les actions" saved={saved === "sound_enabled"}>
                  <Toggle value={settings.sound_enabled} onChange={v => updateSetting("sound_enabled", v)} />
                </SettingRow>
              </SectionCard>
            </section>

            {/* ── TRADING ─────────────────────────────────────── */}
            <section>
              <SectionTitle id="trading" emoji="⚡" label="Trading" />
              <SectionCard>
                <SettingRow label="Actif par défaut" desc="Actif affiché à l'ouverture du dashboard">
                  <input
                    value={settings.default_symbol}
                    onChange={e => updateSetting("default_symbol", e.target.value.toUpperCase())}
                    maxLength={8}
                    className="w-20 h-8 text-center text-[12px] font-bold rounded-xl outline-none text-white transition-all"
                    style={{
                      background: "var(--bg-active)",
                      border: "1px solid var(--border-default)",
                    }}
                    onFocus={e => (e.target.style.borderColor = "var(--border-focus)")}
                    onBlur={e => (e.target.style.borderColor = "var(--border-default)")}
                  />
                </SettingRow>
                <SettingRow
                  label={`Risque par trade : ${settings.risk_per_trade}%`}
                  desc="Pourcentage du capital à risquer par défaut"
                  saved={saved === "risk_per_trade"}>
                  <div className="flex items-center gap-3">
                    <input type="range" min={0.5} max={10} step={0.5}
                      value={settings.risk_per_trade}
                      onChange={e => updateSetting("risk_per_trade", Number(e.target.value))}
                      className="w-28"
                      style={{ accentColor: "var(--green)" }} />
                    <span className="text-[12px] font-black w-8 tabular-nums" style={{ color: "var(--green-light)" }}>
                      {settings.risk_per_trade}%
                    </span>
                  </div>
                </SettingRow>
              </SectionCard>

              {/* Reset portfolio */}
              <div className="rounded-2xl p-5"
                style={{ background: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.12)" }}>
                <p className="text-[13px] font-black text-white mb-1">🔄 Remettre le portfolio à zéro</p>
                <p className="text-[11px] mb-3" style={{ color: "var(--text-tertiary)" }}>
                  Réinitialise ton capital virtuel à $100,000 et efface tous tes ordres. Irréversible.
                </p>
                <button
                  onClick={() => {
                    if (!confirm("Remettre le portfolio à $100,000 ? Tous tes ordres seront supprimés.")) return
                    supabase.from("trading_accounts").update({ cash: 100000 }).eq("user_id", user.id)
                    supabase.from("orders").delete().eq("user_id", user.id)
                  }}
                  className="px-4 py-2 rounded-xl text-[12px] font-bold transition-all hover:scale-[1.01]"
                  style={{
                    background: "rgba(239,68,68,0.08)",
                    border: "1px solid rgba(239,68,68,0.22)",
                    color: "var(--red-light)",
                  }}>
                  Reset → $100,000
                </button>
              </div>
            </section>

            {/* ── CONFIDENTIALITÉ ─────────────────────────────── */}
            <section>
              <SectionTitle id="privacy" emoji="🔒" label="Confidentialité & Sécurité" />
              <SectionCard>
                <SettingRow
                  label="Afficher mon P&L publiquement"
                  desc="Visible dans le classement et les profils publics"
                  saved={saved === "show_pnl_public"}>
                  <Toggle value={settings.show_pnl_public} onChange={v => updateSetting("show_pnl_public", v)} />
                </SettingRow>
              </SectionCard>

              <SectionCard>
                <SettingRow label="Changer de mot de passe">
                  <button
                    onClick={async () => {
                      await supabase.auth.resetPasswordForEmail(user?.email, {
                        redirectTo: `${window.location.origin}/reset-password`,
                      })
                      alert("Email envoyé ! Vérifie ta boîte mail.")
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-bold transition-all hover:scale-[1.02]"
                    style={{
                      background: "var(--bg-active)",
                      border: "1px solid var(--border-default)",
                      color: "var(--text-secondary)",
                    }}>
                    📧 Envoyer le lien
                  </button>
                </SettingRow>
                <SettingRow label="Télécharger mes données">
                  <button
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-bold transition-all hover:scale-[1.02]"
                    style={{
                      background: "var(--bg-active)",
                      border: "1px solid var(--border-default)",
                      color: "var(--text-secondary)",
                    }}>
                    <ChevronRight size={13} />
                    Exporter
                  </button>
                </SettingRow>
              </SectionCard>

              {/* Danger zone */}
              <div className="rounded-2xl p-5" style={{ background: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.12)" }}>
                <p className="text-[11px] font-black uppercase tracking-widest mb-3" style={{ color: "rgba(239,68,68,0.5)" }}>
                  Zone de danger
                </p>
                {!deleteConfirm ? (
                  <button onClick={() => setDeleteConfirm(true)}
                    className="text-[13px] font-semibold transition-all"
                    style={{ color: "rgba(239,68,68,0.55)" }}
                    onMouseEnter={e => (e.currentTarget.style.color = "var(--red-light)")}
                    onMouseLeave={e => (e.currentTarget.style.color = "rgba(239,68,68,0.55)")}>
                    Supprimer mon compte →
                  </button>
                ) : (
                  <div className="animate-fade-in">
                    <p className="text-[13px] font-black text-white mb-1">⚠️ Confirmer la suppression</p>
                    <p className="text-[11px] mb-3" style={{ color: "var(--text-tertiary)" }}>
                      Action irréversible. Toutes tes données seront définitivement supprimées.
                    </p>
                    <div className="flex gap-2">
                      <button onClick={() => setDeleteConfirm(false)}
                        className="flex-1 py-2 rounded-xl text-[12px] font-semibold transition-all"
                        style={{ background: "var(--bg-active)", color: "var(--text-secondary)", border: "1px solid var(--border-default)" }}>
                        Annuler
                      </button>
                      <button onClick={() => alert("Contacte support@tradex.io pour supprimer ton compte.")}
                        className="flex-1 py-2 rounded-xl text-[12px] font-bold transition-all"
                        style={{ background: "rgba(239,68,68,0.12)", color: "var(--red-light)", border: "1px solid rgba(239,68,68,0.25)" }}>
                        Supprimer le compte
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* ── ABONNEMENT ──────────────────────────────────── */}
            <section>
              <SectionTitle id="billing" emoji="💎" label="Abonnement" />

              {/* Current plan card */}
              <div className="rounded-2xl p-5 mb-3"
                style={{
                  background: plan !== "free" ? "rgba(34,197,94,0.06)" : "var(--bg-surface)",
                  border: `1px solid ${plan !== "free" ? "var(--green-border)" : "var(--border-subtle)"}`,
                  boxShadow: plan !== "free" ? "0 0 32px var(--green-glow)" : "none",
                }}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[15px] font-black text-white">
                      {plan === "free" ? "Plan Gratuit" : plan === "pro" ? "Plan Pro ⭐" : "Plan Premium 💎"}
                    </p>
                    <p className="text-[12px] mt-1" style={{ color: "var(--text-tertiary)" }}>
                      {plan === "free"
                        ? "3 signaux/jour · Cours débutant · Paper trading"
                        : plan === "pro"
                          ? "Signaux illimités · 160+ actifs · Alertes · Tous les cours"
                          : "Tout Pro + API publique · Rapport IA hebdo · Support prioritaire"}
                    </p>
                  </div>
                  {plan === "free" && (
                    <button onClick={() => router.push("/pricing")}
                      className="flex-shrink-0 px-4 py-2.5 rounded-xl text-[12px] font-black text-black transition-all hover:scale-[1.02]"
                      style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)" }}>
                      Passer à Pro →
                    </button>
                  )}
                </div>
                {plan !== "free" && (
                  <div className="flex gap-2 mt-4">
                    <button className="px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all hover:scale-[1.01]"
                      style={{ background: "var(--bg-active)", border: "1px solid var(--border-default)", color: "var(--text-secondary)" }}>
                      Gérer l'abonnement
                    </button>
                    <button className="px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all hover:scale-[1.01]"
                      style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)", color: "rgba(239,68,68,0.7)" }}>
                      Annuler
                    </button>
                  </div>
                )}
              </div>

              {/* Plan comparison (free users) */}
              {plan === "free" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    {
                      name: "Pro ⭐",
                      price: "19€",
                      period: "/mois",
                      color: "#22c55e",
                      bg: "rgba(34,197,94,0.05)",
                      border: "rgba(34,197,94,0.18)",
                      features: ["Signaux illimités", "160+ actifs screener", "Alertes illimitées", "Tous les cours", "Backtest & Replay"],
                    },
                    {
                      name: "Premium 💎",
                      price: "49€",
                      period: "/mois",
                      color: "#fbbf24",
                      bg: "rgba(251,191,36,0.05)",
                      border: "rgba(251,191,36,0.18)",
                      features: ["Tout Pro inclus", "API publique", "Rapport IA hebdo", "Support prioritaire 24h", "Onboarding dédié"],
                    },
                  ].map(p => (
                    <div key={p.name} className="rounded-2xl p-4"
                      style={{ background: p.bg, border: `1px solid ${p.border}` }}>
                      <div className="flex items-baseline justify-between mb-3">
                        <div>
                          <p className="text-[13px] font-black" style={{ color: p.color }}>{p.name}</p>
                          <div className="flex items-baseline gap-0.5 mt-0.5">
                            <span className="text-[22px] font-black text-white">{p.price}</span>
                            <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>{p.period}</span>
                          </div>
                        </div>
                        <button onClick={() => router.push("/pricing")}
                          className="px-3 py-1.5 rounded-xl text-[11px] font-black transition-all hover:scale-[1.02]"
                          style={{ background: `${p.color}18`, color: p.color, border: `1px solid ${p.color}28` }}>
                          Choisir →
                        </button>
                      </div>
                      <div className="space-y-1.5">
                        {p.features.map(f => (
                          <div key={f} className="flex items-center gap-2 text-[11px]" style={{ color: "var(--text-secondary)" }}>
                            <span style={{ color: p.color }}>✓</span> {f}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* ── OUTILS ──────────────────────────────────────── */}
            <section>
              <SectionTitle id="tools" emoji="🔧" label="Outils avancés" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {[
                  { href: "/api-docs",  icon: "🔌", title: "API Publique",       desc: "Intègre les signaux dans tes outils",      color: "#60a5fa", bg: "rgba(96,165,250,0.06)",   border: "rgba(96,165,250,0.18)" },
                  { href: "/widget",    icon: "🧩", title: "Widget embarquable", desc: "Ajoute Tradex sur ton site ou blog",         color: "#a78bfa", bg: "rgba(167,139,250,0.06)", border: "rgba(167,139,250,0.18)" },
                  { href: "/referral",  icon: "🎁", title: "Parrainage",         desc: "Invite tes amis, gagne 1 mois Pro",          color: "#4ade80", bg: "rgba(34,197,94,0.06)",   border: "rgba(34,197,94,0.18)" },
                  { href: "/brief",     icon: "☀️", title: "Tradex Brief",       desc: "Briefing marché chaque matin à 7h",          color: "#fbbf24", bg: "rgba(251,191,36,0.06)",  border: "rgba(251,191,36,0.18)" },
                  { href: "/duel",      icon: "🥊", title: "Duels de trading",   desc: "Défie tes amis sur des compétitions",        color: "#f87171", bg: "rgba(239,68,68,0.06)",   border: "rgba(239,68,68,0.18)" },
                  { href: "/backtest",  icon: "📈", title: "Backtesting",        desc: "Teste tes stratégies sur données réelles",   color: "#34d399", bg: "rgba(52,211,153,0.06)",  border: "rgba(52,211,153,0.18)" },
                ].map(item => (
                  <a key={item.href} href={item.href}
                    className="flex items-center gap-3 px-4 py-4 rounded-2xl transition-all hover:scale-[1.01] hover:brightness-110 group"
                    style={{ background: item.bg, border: `1px solid ${item.border}` }}>
                    <span className="text-xl flex-shrink-0">{item.icon}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-black" style={{ color: item.color }}>{item.title}</p>
                      <p className="text-[11px] mt-0.5" style={{ color: "var(--text-tertiary)" }}>{item.desc}</p>
                    </div>
                    <ChevronRight size={14} className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: item.color }} />
                  </a>
                ))}
              </div>
            </section>

            {/* ── Bottom padding ─── */}
            <div className="h-12" />

          </div>
        </div>
      </div>
    </div>
  )
}
