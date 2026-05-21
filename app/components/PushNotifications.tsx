"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

export default function PushNotifications() {
  const [status, setStatus] = useState<"idle" | "granted" | "denied" | "unsupported">("idle")

  useEffect(() => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setStatus("unsupported")
      return
    }
    if (Notification.permission === "granted") setStatus("granted")
    else if (Notification.permission === "denied") setStatus("denied")
  }, [])

  async function requestPermission() {
    if (!("Notification" in window)) return
    const permission = await Notification.requestPermission()
    if (permission !== "granted") { setStatus("denied"); return }
    setStatus("granted")

    try {
      const reg = await navigator.serviceWorker.ready
      // Use VAPID public key from env (optional)
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidKey) return

      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      })

      const { data: session } = await supabase.auth.getSession()
      const token = session.session?.access_token
      if (!token) return

      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(subscription),
      })
    } catch {
      // Push subscription failed — not critical
    }
  }

  if (status === "unsupported" || status === "granted" || status === "denied") return null

  return (
    <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[150] px-4 w-full max-w-sm">
      <div className="bg-[#111] border border-white/10 rounded-2xl p-4 shadow-2xl flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center flex-shrink-0 text-xl">
          🔔
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-sm">Activer les notifications</p>
          <p className="text-gray-500 text-xs">Sois alerté des signaux forts en temps réel</p>
        </div>
        <button
          onClick={requestPermission}
          className="px-3 py-1.5 rounded-lg bg-green-500 hover:bg-green-400 text-black font-bold text-xs transition flex-shrink-0"
        >
          Activer
        </button>
      </div>
    </div>
  )
}

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i)
  return outputArray.buffer as ArrayBuffer
}
