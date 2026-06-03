"use client"

import { useEffect, useRef, useState } from "react"

type Alert = {
  id: string
  symbol: string
  condition: string
  price: number
  triggered: boolean
  created_at: string
}

type Toast = {
  id: string
  message: string
  color: string
}

const UP   = "#4ade80"
const DOWN = "#f87171"
const WARN = "#facc15"

function conditionLabel(condition: string, price: number) {
  if (condition === "tp_executed")
    return { icon: "✅", text: `TP exécuté @ $${price.toFixed(2)}`, color: UP }
  if (condition === "sl_executed")
    return { icon: "⛔", text: `SL exécuté @ $${price.toFixed(2)}`, color: DOWN }
  if (condition === "above")
    return { icon: "▲", text: `$${price.toFixed(2)}`, color: UP }
  return { icon: "▼", text: `$${price.toFixed(2)}`, color: DOWN }
}

export default function AlertsPanel({
  symbol,
  currentPrice,
  token,
}: {
  symbol: string
  currentPrice?: number | null
  token?: string | null
}) {
  const [alerts, setAlerts]     = useState<Alert[]>([])
  const [toasts, setToasts]     = useState<Toast[]>([])
  const [condition, setCondition] = useState<"above" | "below">("above")
  const [priceInput, setPriceInput] = useState("")
  const [creating, setCreating] = useState(false)
  const [errMsg, setErrMsg]     = useState<string | null>(null)
  const notifiedRef = useRef<Set<string>>(new Set())
  const mountedRef  = useRef(true)

  // ── Notification helpers ────────────────────────────────────────────────
  function pushToast(message: string, color: string) {
    const id = Math.random().toString(36).slice(2)
    setToasts(prev => [...prev, { id, message, color }])
    setTimeout(() => {
      if (mountedRef.current) setToasts(prev => prev.filter(t => t.id !== id))
    }, 6000)
  }

  function browserNotify(title: string, body: string) {
    if (typeof window === "undefined") return
    if (!("Notification" in window)) return
    if (Notification.permission !== "granted") return
    try { new Notification(title, { body, icon: "/favicon.ico" }) } catch {}
  }

  // ── Load & poll alerts ──────────────────────────────────────────────────
  async function loadAlerts() {
    if (!token) return
    try {
      const res  = await fetch("/api/alerts", { headers: { Authorization: `Bearer ${token}` } })
      const data: Alert[] = await res.json()
      if (!Array.isArray(data) || !mountedRef.current) return

      // Detect newly triggered alerts and notify
      for (const alert of data) {
        if (!alert.triggered) continue
        if (notifiedRef.current.has(alert.id)) continue
        notifiedRef.current.add(alert.id)

        const label =
          alert.condition === "tp_executed"
            ? `✅ Take Profit exécuté · ${alert.symbol} @ $${alert.price.toFixed(2)}`
            : alert.condition === "sl_executed"
            ? `⛔ Stop Loss exécuté · ${alert.symbol} @ $${alert.price.toFixed(2)}`
            : `🔔 ${alert.symbol} ${alert.condition === "above" ? "au-dessus de" : "en-dessous de"} $${alert.price.toFixed(2)}`

        const color =
          alert.condition === "tp_executed" ? UP
          : alert.condition === "sl_executed" ? DOWN
          : WARN

        pushToast(label, color)
        browserNotify("Tradex · Alerte", label)
      }

      setAlerts(data)
    } catch {}
  }

  // ── Create alert ────────────────────────────────────────────────────────
  async function createAlert() {
    if (!token || !priceInput) return
    const priceVal = parseFloat(priceInput)
    if (isNaN(priceVal) || priceVal <= 0) { setErrMsg("Prix invalide"); return }
    setCreating(true)
    setErrMsg(null)

    // Request permission the first time user creates an alert
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      await Notification.requestPermission()
    }

    try {
      const res = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ symbol, condition, price: priceVal }),
      })
      const json = await res.json()
      if (res.ok && !json.error) {
        setPriceInput("")
        pushToast(`✅ Alerte créée · ${symbol} ${condition === "above" ? "▲" : "▼"} $${priceVal.toFixed(2)}`, UP)
        // Optimistic update: add immediately then reload
        setAlerts(prev => [{ id: json.id, symbol, condition, price: priceVal, triggered: false, created_at: new Date().toISOString() }, ...prev])
        await loadAlerts()
      } else {
        const msg = json.error ?? "Erreur lors de la création de l'alerte"
        setErrMsg(msg)
        pushToast(`❌ ${msg}`, DOWN)
        console.error("[AlertsPanel] createAlert error:", json)
      }
    } catch (e) {
      const msg = "Erreur réseau — réessaie"
      setErrMsg(msg)
      pushToast(`❌ ${msg}`, DOWN)
      console.error("[AlertsPanel] createAlert exception:", e)
    }
    setCreating(false)
  }

  // ── Delete alert ────────────────────────────────────────────────────────
  async function deleteAlert(id: string) {
    if (!token) return
    await fetch("/api/alerts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id }),
    })
    setAlerts(prev => prev.filter(a => a.id !== id))
    notifiedRef.current.delete(id)
  }

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    if (!token) return
    loadAlerts()
    const id = setInterval(loadAlerts, 30_000)
    return () => clearInterval(id)
  }, [token])

  // Pre-fill price input when current price changes (only if empty)
  useEffect(() => {
    if (currentPrice && !priceInput) setPriceInput(currentPrice.toFixed(2))
  }, [currentPrice])

  const symbolAlerts  = alerts.filter(a => a.symbol === symbol && !a.triggered)
  const triggeredHere = alerts.filter(a => a.symbol === symbol && a.triggered).slice(0, 4)
  const totalActive   = alerts.filter(a => !a.triggered).length

  return (
    <>
      {/* ── Toast notifications (fixed, outside panel) ─────────────────── */}
      {toasts.length > 0 && (
        <div className="fixed bottom-5 right-5 z-[200] flex flex-col gap-2 pointer-events-none">
          {toasts.map(t => (
            <div
              key={t.id}
              className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-white shadow-2xl"
              style={{ background: "#111", border: `1px solid ${t.color}40`, maxWidth: 340 }}
            >
              <span style={{ color: t.color, flexShrink: 0 }}>●</span>
              {t.message}
            </div>
          ))}
        </div>
      )}

      {/* ── Panel ─────────────────────────────────────────────────────── */}
      <div className="px-4 py-3 border-b border-white/[0.05]">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <p className="text-[9px] text-gray-600 uppercase tracking-widest">Alertes prix</p>
          {totalActive > 0 && (
            <span
              className="min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center text-[9px] font-black text-white"
              style={{ background: DOWN }}
            >
              {totalActive > 9 ? "9+" : totalActive}
            </span>
          )}
        </div>

        {/* Condition toggle */}
        <div className="flex gap-1 mb-2">
          <button
            onClick={() => setCondition("above")}
            className="flex-1 py-1.5 rounded-lg text-[10px] font-bold transition"
            style={{
              background: condition === "above" ? "rgba(74,222,128,0.15)" : "rgba(255,255,255,0.03)",
              color: condition === "above" ? UP : "#555",
              border: `1px solid ${condition === "above" ? "rgba(74,222,128,0.3)" : "rgba(255,255,255,0.06)"}`,
            }}
          >
            ▲ Au-dessus
          </button>
          <button
            onClick={() => setCondition("below")}
            className="flex-1 py-1.5 rounded-lg text-[10px] font-bold transition"
            style={{
              background: condition === "below" ? "rgba(248,113,113,0.15)" : "rgba(255,255,255,0.03)",
              color: condition === "below" ? DOWN : "#555",
              border: `1px solid ${condition === "below" ? "rgba(248,113,113,0.3)" : "rgba(255,255,255,0.06)"}`,
            }}
          >
            ▼ En-dessous
          </button>
        </div>

        {/* Price input + add */}
        <div className="flex gap-1.5 mb-1.5">
          <input
            type="number"
            value={priceInput}
            onChange={e => setPriceInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && createAlert()}
            placeholder="Prix $"
            className="flex-1 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none min-w-0"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
          />
          <button
            onClick={createAlert}
            disabled={creating || !priceInput}
            className="px-3 py-1.5 rounded-lg text-white text-xs font-bold transition disabled:opacity-40"
            style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            {creating ? "…" : "+ Ajouter"}
          </button>
        </div>

        {/* Error message */}
        {errMsg && (
          <p className="text-[10px] text-red-400 mb-1.5 px-1">{errMsg}</p>
        )}

        {/* Quick % shortcuts */}
        {currentPrice && (
          <div className="flex gap-1 mb-3">
            {[-5, -2, 2, 5].map(pct => (
              <button
                key={pct}
                onClick={() => {
                  setPriceInput((currentPrice * (1 + pct / 100)).toFixed(2))
                  setCondition(pct > 0 ? "above" : "below")
                }}
                className="flex-1 py-0.5 rounded text-[9px] font-semibold transition"
                style={{
                  background: pct > 0 ? "rgba(74,222,128,0.08)" : "rgba(248,113,113,0.08)",
                  color: pct > 0 ? UP : DOWN,
                }}
              >
                {pct > 0 ? "+" : ""}{pct}%
              </button>
            ))}
          </div>
        )}

        {/* Active alerts for this symbol */}
        {symbolAlerts.length > 0 ? (
          <div className="space-y-1">
            {symbolAlerts.map(a => {
              const { icon, text, color } = conditionLabel(a.condition, a.price)
              return (
                <div
                  key={a.id}
                  className="flex items-center justify-between px-3 py-3 rounded-xl mb-2 transition-all hover:bg-white/[0.03]"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
                >
                  <div>
                    <p className="text-xs font-bold text-white">{a.symbol}</p>
                    <p className="text-[10px] text-white/40 mt-0.5">{a.condition === "above" ? "Au-dessus de" : "En-dessous de"} ${a.price.toFixed(2)}</p>
                  </div>
                  <button
                    onClick={() => deleteAlert(a.id)}
                    className="text-white/20 hover:text-red-400 transition text-xs"
                  >✕</button>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-[10px] text-center py-0.5" style={{ color: "#2a2a2a" }}>
            Aucune alerte active sur {symbol.replace("-USD", "")}
          </p>
        )}

        {/* Triggered alerts */}
        {triggeredHere.length > 0 && (
          <div className="mt-2 space-y-1">
            {triggeredHere.map(a => {
              const { icon, text, color } = conditionLabel(a.condition, a.price)
              return (
                <div
                  key={a.id}
                  className="flex items-center justify-between px-2.5 py-1.5 rounded-lg"
                  style={{ background: "rgba(250,204,21,0.05)", border: "1px solid rgba(250,204,21,0.12)" }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span style={{ color: WARN, fontSize: 10 }}>🔔</span>
                    <span className="text-[10px] font-semibold truncate" style={{ color }}>
                      {icon} {text}
                    </span>
                  </div>
                  <button
                    onClick={() => deleteAlert(a.id)}
                    className="flex-shrink-0 text-gray-700 hover:text-red-400 text-xs transition leading-none ml-2"
                  >×</button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
