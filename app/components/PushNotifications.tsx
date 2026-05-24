"use client"
import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"

export default function PushNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>("default")
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    if (typeof window !== "undefined" && "Notification" in window) {
      setPermission(Notification.permission)
    }
    const d = sessionStorage.getItem("push-dismissed")
    if (d) setDismissed(true)
  }, [])

  async function subscribe() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return
    setLoading(true)
    try {
      const perm = await Notification.requestPermission()
      setPermission(perm)
      if (perm !== "granted") { setLoading(false); return }

      const reg = await navigator.serviceWorker.ready
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidKey) { setLoading(false); return }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      })

      const { data: { session } } = await supabase.auth.getSession()
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub, userId: session?.user?.id }),
      })
      setSubscribed(true)
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  function dismiss() {
    sessionStorage.setItem("push-dismissed", "1")
    setDismissed(true)
  }

  if (!mounted) return null
  if (dismissed || permission === "denied" || (permission === "granted" && subscribed)) return null
  if (typeof window === "undefined" || !("Notification" in window)) return null

  return (
    <div className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-40 max-w-sm animate-slide-up">
      <div className="rounded-2xl p-4 shadow-2xl"
        style={{
          background: "#0d0d0d",
          border: "1px solid rgba(34,197,94,0.2)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(34,197,94,0.05)",
        }}>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
            style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.15)" }}>
            🔔
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white mb-0.5">Alertes de signaux</p>
            <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.4)" }}>
              Reçois une notification instantanée quand un signal fort est détecté.
            </p>
          </div>
          <button onClick={dismiss} className="text-white/20 hover:text-white/50 transition text-xl leading-none flex-shrink-0 mt-0.5">×</button>
        </div>
        <div className="flex gap-2 mt-3">
          <button onClick={dismiss}
            className="flex-1 py-2 rounded-xl text-xs font-semibold transition"
            style={{ color: "rgba(255,255,255,0.3)", border: "1px solid rgba(255,255,255,0.08)" }}>
            Plus tard
          </button>
          <button onClick={subscribe} disabled={loading}
            className="flex-1 py-2 rounded-xl text-xs font-black text-black transition-all hover:opacity-90 disabled:opacity-50"
            style={{ background: "#22c55e" }}>
            {loading ? "..." : "Activer 🔔"}
          </button>
        </div>
      </div>
    </div>
  )
}

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i)
  return outputArray.buffer as ArrayBuffer
}
