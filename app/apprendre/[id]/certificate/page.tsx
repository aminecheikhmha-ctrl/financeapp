"use client"

import { useEffect, useRef, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useParams, useRouter } from "next/navigation"
import { getCourse } from "@/lib/courses"
import { motion } from "framer-motion"
import { shareNative } from "@/lib/capacitor"

function generateVerificationCode(userId: string, courseId: string): string {
  const hash = (s: string) => s.split("").reduce((a, c) => (a * 31 + c.charCodeAt(0)) & 0xffffffff, 0)
  const n = Math.abs(hash(userId + courseId + "cert2024"))
  return n.toString(36).toUpperCase().padStart(8, "0").slice(0, 8)
}

export default function CertificatePage() {
  const { id }  = useParams()
  const router  = useRouter()
  const course  = getCourse(id as string)
  const certRef = useRef<HTMLDivElement>(null)

  const [user,       setUser]       = useState<any>(null)
  const [username,   setUsername]   = useState<string>("")
  const [completed,  setCompleted]  = useState(false)
  const [loading,    setLoading]    = useState(true)
  const [generating, setGenerating] = useState(false)
  const [completedAt, setCompletedAt] = useState<string>("")

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.push("/login"); return }
      setUser(session.user)

      const { data: profile } = await supabase
        .from("user_profiles")
        .select("username")
        .eq("id", session.user.id)
        .single()
      setUsername(profile?.username ?? session.user.email?.split("@")[0] ?? "Trader")

      if (course) {
        const { data: progress } = await supabase
          .from("user_progress")
          .select("completed, updated_at")
          .eq("user_id", session.user.id)
          .eq("course_id", course.id)
          .eq("completed", true)
        const done = (progress?.length ?? 0) >= course.chapters.length
        setCompleted(done)
        if (done && progress?.length) {
          const latest = progress.reduce((a: any, b: any) =>
            new Date(a.updated_at) > new Date(b.updated_at) ? a : b
          )
          setCompletedAt(new Date(latest.updated_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }))
        }
      }
      setLoading(false)
    })
  }, [])

  async function downloadPDF() {
    if (!certRef.current) return
    setGenerating(true)
    try {
      const { default: html2canvas } = await import("html2canvas")
      const { default: jsPDF }       = await import("jspdf")
      const canvas = await html2canvas(certRef.current, {
        scale: 3,
        backgroundColor: "#080808",
        useCORS: true,
      })
      const imgData = canvas.toDataURL("image/png")
      const pdf     = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" })
      const pw      = pdf.internal.pageSize.getWidth()
      const ph      = pdf.internal.pageSize.getHeight()
      pdf.addImage(imgData, "PNG", 0, 0, pw, ph)
      pdf.save(`certificat-${course?.id ?? "cours"}.pdf`)
    } catch (e) {
      console.error(e)
    }
    setGenerating(false)
  }

  async function handleShare() {
    const text = `🎓 J'ai complété le cours "${course?.title}" sur FinanceApp !`
    await shareNative("Mon certificat", text, window.location.href)
  }

  if (!course) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#080808" }}>
      <p style={{ color: "#555" }}>Cours introuvable.</p>
    </div>
  )

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#080808" }}>
      <div className="w-8 h-8 rounded-full border-2 border-green-400 border-t-transparent animate-spin" />
    </div>
  )

  if (!completed) return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "#080808" }}>
      <div className="max-w-md w-full text-center space-y-4">
        <div className="text-6xl">🔒</div>
        <h1 className="text-xl font-black text-white">Certificat non disponible</h1>
        <p className="text-white/40 text-sm">Complète tous les chapitres du cours pour débloquer ton certificat.</p>
        <button onClick={() => router.push(`/apprendre/${id}`)}
          className="w-full py-3 rounded-xl font-bold text-sm"
          style={{ background: "rgba(74,222,128,0.12)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.25)" }}>
          Continuer le cours →
        </button>
      </div>
    </div>
  )

  const verif = user ? generateVerificationCode(user.id, course.id) : "--------"
  const date  = completedAt || new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })

  return (
    <div className="min-h-screen py-8 px-4" style={{ background: "#080808" }}>
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Back */}
        <button onClick={() => router.push("/apprendre")}
          className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-all hover:text-white"
          style={{ color: "#555", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
          ← Académie
        </button>

        {/* Certificate preview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div ref={certRef} className="relative overflow-hidden rounded-2xl"
            style={{
              background: "linear-gradient(135deg, #0a0a0a 0%, #0d1a0d 50%, #0a0a0a 100%)",
              border: "2px solid rgba(74,222,128,0.3)",
              padding: "48px 56px",
              aspectRatio: "1.414",
            }}>

            {/* Corner decorations */}
            <div className="absolute top-4 left-4 w-12 h-12 opacity-20"
              style={{ border: "2px solid #4ade80", borderRight: "none", borderBottom: "none" }} />
            <div className="absolute top-4 right-4 w-12 h-12 opacity-20"
              style={{ border: "2px solid #4ade80", borderLeft: "none", borderBottom: "none" }} />
            <div className="absolute bottom-4 left-4 w-12 h-12 opacity-20"
              style={{ border: "2px solid #4ade80", borderRight: "none", borderTop: "none" }} />
            <div className="absolute bottom-4 right-4 w-12 h-12 opacity-20"
              style={{ border: "2px solid #4ade80", borderLeft: "none", borderTop: "none" }} />

            {/* Background glow */}
            <div className="absolute inset-0 pointer-events-none"
              style={{ background: "radial-gradient(ellipse 60% 60% at 50% 50%, rgba(74,222,128,0.04) 0%, transparent 70%)" }} />

            {/* Header */}
            <div className="relative z-10 text-center mb-8">
              <p className="text-xs font-black uppercase tracking-[0.3em] mb-2" style={{ color: "#4ade80" }}>
                FinanceApp Academy
              </p>
              <div className="h-px mx-auto w-32 mb-4" style={{ background: "linear-gradient(90deg, transparent, #4ade80, transparent)" }} />
              <h1 className="text-3xl font-black text-white uppercase tracking-wider">
                Certificat de Réussite
              </h1>
            </div>

            {/* Body */}
            <div className="relative z-10 text-center space-y-4">
              <p className="text-sm" style={{ color: "#666" }}>Décerné à</p>
              <p className="text-4xl font-black text-white" style={{ fontFamily: "serif", letterSpacing: "0.05em" }}>
                {username}
              </p>
              <div className="h-px mx-auto w-48" style={{ background: "rgba(255,255,255,0.08)" }} />
              <p className="text-sm" style={{ color: "#666" }}>
                Pour avoir complété avec succès le cours
              </p>
              <div className="inline-flex items-center gap-3 px-6 py-3 rounded-2xl mx-auto"
                style={{ background: "rgba(74,222,128,0.06)", border: "1px solid rgba(74,222,128,0.2)" }}>
                <span className="text-2xl">{course.icon}</span>
                <p className="text-lg font-black text-white">{course.title}</p>
              </div>
              <div className="flex items-center justify-center gap-6 pt-2">
                <div className="text-center">
                  <p className="text-xs" style={{ color: "#444" }}>Niveau</p>
                  <p className="text-sm font-black capitalize" style={{ color: "#a78bfa" }}>{course.level}</p>
                </div>
                <div className="w-px h-8" style={{ background: "#1a1a1a" }} />
                <div className="text-center">
                  <p className="text-xs" style={{ color: "#444" }}>Chapitres</p>
                  <p className="text-sm font-black" style={{ color: "#60a5fa" }}>{course.chapters.length}</p>
                </div>
                <div className="w-px h-8" style={{ background: "#1a1a1a" }} />
                <div className="text-center">
                  <p className="text-xs" style={{ color: "#444" }}>Durée</p>
                  <p className="text-sm font-black" style={{ color: "#facc15" }}>{course.duration}</p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="relative z-10 mt-8 flex items-end justify-between">
              <div>
                <div className="h-px w-24 mb-1" style={{ background: "#1a1a1a" }} />
                <p className="text-xs font-bold" style={{ color: "#4ade80" }}>FinanceApp</p>
                <p className="text-[10px]" style={{ color: "#333" }}>financeapp.io</p>
              </div>
              <div className="text-center">
                <p className="text-[10px]" style={{ color: "#444" }}>Complété le</p>
                <p className="text-xs font-bold" style={{ color: "#888" }}>{date}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-widest" style={{ color: "#444" }}>Code de vérification</p>
                <p className="text-xs font-black font-mono" style={{ color: "#4ade80" }}>{verif}</p>
              </div>
            </div>

          </div>
        </motion.div>

        {/* Actions */}
        <div className="flex gap-3">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={downloadPDF}
            disabled={generating}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl font-black text-sm transition-all"
            style={{ background: "rgba(74,222,128,0.15)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.3)" }}>
            {generating ? (
              <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : "⬇️"}
            {generating ? "Génération…" : "Télécharger PDF"}
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleShare}
            className="flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl font-black text-sm"
            style={{ background: "rgba(96,165,250,0.1)", color: "#60a5fa", border: "1px solid rgba(96,165,250,0.25)" }}>
            🔗 Partager
          </motion.button>
        </div>

        {/* Return to course */}
        <div className="text-center">
          <button onClick={() => router.push(`/apprendre/${id}`)}
            className="text-sm font-semibold transition-all hover:text-white"
            style={{ color: "#444" }}>
            ← Retourner au cours
          </button>
        </div>

      </div>
    </div>
  )
}
