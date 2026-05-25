"use client"
import { useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Download, Share2, Copy, Check } from "lucide-react"
import { shareNative, copyToClipboard } from "@/lib/capacitor"

type Props = {
  order: {
    id: string
    symbol: string
    name: string
    qty: number
    price: number
    side: string
    total: number
    created_at: string
  }
  onClose: () => void
}

export default function ShareTradeCard({ order, onClose }: Props) {
  const cardRef  = useRef<HTMLDivElement>(null)
  const [copied, setCopied]   = useState(false)
  const [sharing, setSharing] = useState(false)
  const isBuy = order.side === "buy"
  const date  = new Date(order.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })

  async function handleDownload() {
    try {
      const { default: html2canvas } = await import("html2canvas")
      if (!cardRef.current) return
      const canvas = await html2canvas(cardRef.current, { backgroundColor: null, scale: 2 })
      const link = document.createElement("a")
      link.download = `trade-${order.symbol}-${order.id.slice(0, 8)}.png`
      link.href = canvas.toDataURL("image/png")
      link.click()
    } catch {}
  }

  async function handleShare() {
    setSharing(true)
    try {
      const { default: html2canvas } = await import("html2canvas")
      if (!cardRef.current) return
      const canvas = await html2canvas(cardRef.current, { backgroundColor: null, scale: 2 })
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/png"))
      if (!blob) return
      const file = new File([blob], `trade-${order.symbol}.png`, { type: "image/png" })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `Mon trade ${order.symbol}` })
      } else {
        await shareNative(
          `Mon trade ${order.symbol}`,
          `🚀 ${isBuy ? "J'ai acheté" : "J'ai vendu"} ${order.qty} ${order.symbol} à $${order.price.toFixed(2)} sur FinanceApp`,
          ""
        )
      }
    } catch {}
    setSharing(false)
  }

  async function handleCopyLink() {
    const text = `🚀 ${isBuy ? "Achat" : "Vente"} ${order.qty} ${order.symbol} · $${order.total.toFixed(2)} · ${date}`
    await copyToClipboard(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.92 }}
          transition={{ duration: 0.18 }}
          className="w-full max-w-sm space-y-4"
          onClick={e => e.stopPropagation()}
        >
          {/* Card to capture */}
          <div ref={cardRef} className="rounded-3xl p-6 relative overflow-hidden"
            style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #111 100%)", border: "1px solid rgba(255,255,255,0.1)" }}>

            {/* Background glow */}
            <div className="absolute inset-0 pointer-events-none"
              style={{
                background: isBuy
                  ? "radial-gradient(circle at 80% 20%, rgba(34,197,94,0.12) 0%, transparent 60%)"
                  : "radial-gradient(circle at 80% 20%, rgba(239,68,68,0.12) 0%, transparent 60%)",
              }} />

            {/* Branding */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center">
                  <span className="text-white font-black text-[9px]">F</span>
                </div>
                <span className="text-xs font-bold text-white/50">FinanceApp</span>
              </div>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={isBuy
                  ? { background: "rgba(34,197,94,0.15)", color: "#22c55e" }
                  : { background: "rgba(239,68,68,0.15)", color: "#ef4444" }}>
                {isBuy ? "ACHAT" : "VENTE"}
              </span>
            </div>

            {/* Symbol */}
            <div className="mb-4">
              <p className="text-4xl font-black text-white">{order.symbol.replace("-USD", "")}</p>
              <p className="text-sm text-white/40 mt-0.5 truncate">{order.name}</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              {[
                { label: "Quantité", value: String(order.qty) },
                { label: "Prix / part", value: `$${order.price.toFixed(2)}` },
                { label: "Total", value: `$${order.total.toFixed(2)}` },
              ].map(s => (
                <div key={s.label} className="rounded-xl p-2.5"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <p className="text-[9px] uppercase tracking-widest font-bold mb-1" style={{ color: "rgba(255,255,255,0.3)" }}>{s.label}</p>
                  <p className="text-sm font-black text-white tabular-nums">{s.value}</p>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between">
              <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.25)" }}>{date}</p>
              <p className="text-[10px] font-bold" style={{ color: "rgba(255,255,255,0.2)" }}>Paper Trading</p>
            </div>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-3 gap-2">
            <button onClick={handleDownload}
              className="flex flex-col items-center gap-1.5 py-3 rounded-2xl text-xs font-bold text-white transition"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <Download size={18} />
              Télécharger
            </button>
            <button onClick={handleShare} disabled={sharing}
              className="flex flex-col items-center gap-1.5 py-3 rounded-2xl text-xs font-bold transition"
              style={{ background: "rgba(96,165,250,0.1)", border: "1px solid rgba(96,165,250,0.2)", color: "#60a5fa" }}>
              <Share2 size={18} />
              {sharing ? "..." : "Partager"}
            </button>
            <button onClick={handleCopyLink}
              className="flex flex-col items-center gap-1.5 py-3 rounded-2xl text-xs font-bold transition"
              style={{ background: copied ? "rgba(34,197,94,0.1)" : "rgba(255,255,255,0.06)", border: `1px solid ${copied ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.1)"}`, color: copied ? "#22c55e" : "rgba(255,255,255,0.6)" }}>
              {copied ? <Check size={18} /> : <Copy size={18} />}
              {copied ? "Copié !" : "Copier"}
            </button>
          </div>

          <button onClick={onClose}
            className="w-full py-3 rounded-2xl text-sm font-bold text-white/40 hover:text-white transition"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            Fermer
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
