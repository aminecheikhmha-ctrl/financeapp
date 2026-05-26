"use client"

import { useRef, useState } from "react"
import { supabase } from "@/lib/supabase"

interface AvatarUploadProps {
  currentUrl?: string | null
  avatarColor?: string
  initial?: string
  levelColor?: string
  levelIcon?: string
  size?: "sm" | "md" | "lg"
  onUploaded?: (url: string) => void
  onRemoved?: () => void
}

const SIZES = {
  sm:  { outer: "w-7 h-7",  text: "text-xs",  badge: "hidden" },
  md:  { outer: "w-12 h-12", text: "text-lg",  badge: "w-5 h-5 text-[10px]" },
  lg:  { outer: "w-20 h-20", text: "text-3xl", badge: "w-7 h-7 text-sm" },
}

export default function AvatarUpload({
  currentUrl,
  avatarColor = "#4ade80",
  initial = "?",
  levelColor = "#4ade80",
  levelIcon = "⭐",
  size = "lg",
  onUploaded,
  onRemoved,
}: AvatarUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview]   = useState<string | null>(currentUrl ?? null)
  const [uploading, setUploading] = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [showMenu, setShowMenu]   = useState(false)

  const sz = SIZES[size]

  async function handleFile(file: File) {
    setError(null)
    const MAX = 2 * 1024 * 1024
    if (file.size > MAX) { setError("Fichier trop volumineux (max 2 Mo)"); return }
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"]
    if (!allowed.includes(file.type)) { setError("Format invalide (JPEG, PNG, WebP)"); return }

    // Local preview
    const objectUrl = URL.createObjectURL(file)
    setPreview(objectUrl)
    setUploading(true)
    setShowMenu(false)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error("Non authentifié")

      const form = new FormData()
      form.append("avatar", file)

      const res = await fetch("/api/user-profile/avatar", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: form,
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Erreur upload")

      setPreview(json.avatar_url)
      onUploaded?.(json.avatar_url)
    } catch (e: any) {
      setError(e.message)
      setPreview(currentUrl ?? null)
    } finally {
      setUploading(false)
    }
  }

  async function handleRemove() {
    setShowMenu(false)
    setUploading(true)
    setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error("Non authentifié")

      await fetch("/api/user-profile/avatar", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      })

      setPreview(null)
      onRemoved?.()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="relative flex-shrink-0">
      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = "" }}
      />

      {/* Avatar circle — clickable */}
      <button
        type="button"
        onClick={() => size !== "sm" && setShowMenu(v => !v)}
        className={`relative ${sz.outer} rounded-full overflow-hidden focus:outline-none group`}
        style={{ boxShadow: `0 0 20px ${levelColor}40` }}
        aria-label="Modifier la photo de profil"
        disabled={uploading || size === "sm"}
      >
        {preview ? (
          <img
            src={preview}
            alt="Avatar"
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            className={`w-full h-full flex items-center justify-center ${sz.text} font-black text-black`}
            style={{ backgroundColor: avatarColor }}
          >
            {initial}
          </div>
        )}

        {/* Overlay on hover */}
        {size !== "sm" && !uploading && (
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
          </div>
        )}

        {/* Spinner overlay */}
        {uploading && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </button>

      {/* Level badge */}
      {size !== "sm" && (
        <div
          className={`absolute -bottom-1 -right-1 ${sz.badge} rounded-full border-2 border-[#111] flex items-center justify-center`}
          style={{ background: `${levelColor}20`, borderColor: `${levelColor}60` }}
        >
          {levelIcon}
        </div>
      )}

      {/* Context menu */}
      {showMenu && size !== "sm" && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
          <div
            className="absolute left-full ml-3 top-0 z-50 bg-[#1a1a1a] border border-white/10 rounded-xl overflow-hidden shadow-xl min-w-[180px]"
            style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}
          >
            <button
              onClick={() => { setShowMenu(false); inputRef.current?.click() }}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white/80 hover:bg-white/5 hover:text-white transition text-left"
            >
              <span className="text-base">📷</span>
              {preview ? "Changer la photo" : "Ajouter une photo"}
            </button>
            {preview && (
              <button
                onClick={handleRemove}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 transition text-left border-t border-white/5"
              >
                <span className="text-base">🗑️</span>
                Supprimer la photo
              </button>
            )}
          </div>
        </>
      )}

      {/* Error toast */}
      {error && (
        <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 whitespace-nowrap z-50 bg-red-500/90 text-white text-xs px-3 py-1.5 rounded-lg">
          {error}
        </div>
      )}
    </div>
  )
}
