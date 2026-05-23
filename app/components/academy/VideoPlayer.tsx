"use client"
import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"

interface Props {
  url: string
  title: string
  courseId?: string
  chapterId?: number
  onWatched?: () => void
}

function Skeleton({ h = "h-4", w = "w-full" }: { h?: string; w?: string }) {
  return <div className={`${h} ${w} rounded-lg animate-pulse`} style={{ background: "#151515" }} />
}

export default function VideoPlayer({ url, title, courseId, chapterId, onWatched }: Props) {
  const [playing,        setPlaying]        = useState(false)
  const [watched,        setWatched]        = useState(false)
  const [summary,        setSummary]        = useState<string[]>([])
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [summaryVisible, setSummaryVisible] = useState(false)
  const watchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const videoId = url.includes("/embed/")
    ? url.split("/embed/")[1]?.split("?")[0]
    : url.includes("youtu.be/")
    ? url.split("youtu.be/")[1]?.split("?")[0]
    : url.includes("v=")
    ? new URLSearchParams(url.split("?")[1]).get("v") ?? ""
    : ""

  const thumb = videoId
    ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
    : null

  // Auto-mark watched after 30s of playing
  useEffect(() => {
    if (!playing || watched) return
    watchTimerRef.current = setTimeout(() => setWatched(true), 30_000)
    return () => {
      if (watchTimerRef.current) clearTimeout(watchTimerRef.current)
    }
  }, [playing, watched])

  // Fetch AI summary when video starts
  useEffect(() => {
    if (!playing || summary.length > 0 || !courseId || !chapterId) return
    setLoadingSummary(true)
    fetch(`/api/course-content?course_id=${courseId}&chapter_id=${chapterId}&type=summary`)
      .then(r => r.json())
      .then(d => {
        if (d.summary && Array.isArray(d.summary)) {
          setSummary(d.summary)
        } else if (d.content) {
          // Extract bullet points from markdown content
          const bullets = d.content
            .split("\n")
            .filter((l: string) => l.startsWith("- ") || l.startsWith("• "))
            .slice(0, 5)
            .map((l: string) => l.replace(/^[-•]\s+/, "").replace(/\*\*/g, ""))
          setSummary(bullets.length > 0 ? bullets : [
            "Regardez la vidéo pour les concepts clés.",
            "Prenez des notes sur les points importants.",
          ])
        }
      })
      .catch(() => {
        setSummary(["Résumé non disponible. Prenez des notes pendant la vidéo."])
      })
      .finally(() => setLoadingSummary(false))
  }, [playing, courseId, chapterId, summary.length])

  const handleWatched = () => {
    setWatched(true)
    onWatched?.()
  }

  const embedSrc = videoId
    ? `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`
    : url

  return (
    <div className="space-y-4">
      {/* Video container */}
      <div className="relative w-full rounded-2xl overflow-hidden"
        style={{ paddingBottom: "56.25%", background: "#000" }}>
        {!playing ? (
          // Thumbnail with play overlay
          <div className="absolute inset-0 cursor-pointer group" onClick={() => setPlaying(true)}>
            {thumb ? (
              <img src={thumb} alt={title}
                className="absolute inset-0 w-full h-full object-cover transition-all duration-500 group-hover:scale-105"
                style={{ filter: "brightness(0.55)" }} />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center"
                style={{ background: "linear-gradient(135deg,#0d0d0d,#1a1a2e)" }}>
                <span className="text-6xl">📹</span>
              </div>
            )}
            {/* Dark overlay gradient */}
            <div className="absolute inset-0"
              style={{ background: "linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 50%)" }} />
            {/* Play button */}
            <motion.div
              className="absolute inset-0 flex items-center justify-center"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}>
              <div className="w-20 h-20 rounded-full flex items-center justify-center shadow-2xl transition-all group-hover:shadow-red-500/30"
                style={{ background: "rgba(239,68,68,0.95)", backdropFilter: "blur(8px)" }}>
                <svg viewBox="0 0 24 24" fill="white" className="w-8 h-8 ml-1.5">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </motion.div>
            {/* Title overlay */}
            <div className="absolute bottom-4 left-4 right-4">
              <p className="text-white font-black text-lg leading-snug drop-shadow-lg">{title}</p>
              <p className="text-white/60 text-xs mt-1">▶ Cliquer pour lancer</p>
            </div>
          </div>
        ) : (
          <iframe
            src={embedSrc}
            className="absolute inset-0 w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title={title}
          />
        )}
      </div>

      {/* Notes banner */}
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs"
        style={{ background: "rgba(96,165,250,0.06)", border: "1px solid rgba(96,165,250,0.15)" }}>
        <span>📝</span>
        <span style={{ color: "#60a5fa" }}>Vidéo en anglais — active les sous-titres FR via le bouton <strong>CC</strong> sur YouTube</span>
      </motion.div>

      {/* AI Summary */}
      {playing && (
        <div className="rounded-2xl overflow-hidden" style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>
          <button
            onClick={() => setSummaryVisible(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 transition-colors hover:bg-white/[0.02]">
            <div className="flex items-center gap-2">
              <span className="text-sm">🤖</span>
              <span className="text-sm font-black text-white">Résumé IA — 5 points clés</span>
              {loadingSummary && (
                <div className="w-3 h-3 rounded-full border border-green-400 border-t-transparent animate-spin" />
              )}
            </div>
            <span className="text-white/30 text-xs">{summaryVisible ? "▲" : "▼"}</span>
          </button>

          <AnimatePresence>
            {summaryVisible && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                style={{ overflow: "hidden" }}>
                <div className="px-4 pb-4 space-y-2 border-t" style={{ borderColor: "#1a1a1a" }}>
                  {loadingSummary ? (
                    <div className="space-y-2 pt-3">
                      {[...Array(5)].map((_, i) => (
                        <Skeleton key={i} h="h-4" w={i % 2 === 0 ? "w-full" : "w-4/5"} />
                      ))}
                    </div>
                  ) : summary.length > 0 ? (
                    <ul className="pt-3 space-y-2">
                      {summary.map((point, i) => (
                        <motion.li key={i}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.06 }}
                          className="flex items-start gap-2.5 text-sm"
                          style={{ color: "#bbb" }}>
                          <span className="mt-0.5 flex-shrink-0 text-green-400 font-black">{i + 1}.</span>
                          <span>{point}</span>
                        </motion.li>
                      ))}
                    </ul>
                  ) : (
                    <p className="pt-3 text-sm text-white/30">Résumé en cours de génération…</p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Watch confirm button */}
      {playing && !watched && (
        <motion.button
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 2 }}
          onClick={handleWatched}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          className="w-full py-4 rounded-xl font-black text-sm transition-all"
          style={{ background: "rgba(74,222,128,0.15)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.3)" }}>
          ✅ J'ai regardé — Continuer →
        </motion.button>
      )}

      {watched && (
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="flex items-center gap-3 px-4 py-3 rounded-xl"
          style={{ background: "rgba(74,222,128,0.06)", border: "1px solid rgba(74,222,128,0.2)" }}>
          <span className="text-green-400 text-lg">✅</span>
          <p className="text-sm font-bold text-green-400">Vidéo complétée !</p>
        </motion.div>
      )}
    </div>
  )
}
