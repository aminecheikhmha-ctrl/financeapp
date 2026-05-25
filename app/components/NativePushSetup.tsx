"use client"

import { useEffect } from "react"
import { isNative } from "@/lib/capacitor"
import { supabase } from "@/lib/supabase"

// Requires Supabase table:
// CREATE TABLE IF NOT EXISTS push_tokens (
//   id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
//   user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
//   token text NOT NULL,
//   platform text DEFAULT 'native',
//   updated_at timestamptz DEFAULT now()
// );

export default function NativePushSetup() {
  useEffect(() => {
    if (!isNative()) return
    setupPush()
  }, [])

  async function setupPush() {
    try {
      const { PushNotifications } = await import("@capacitor/push-notifications")

      const perm = await PushNotifications.requestPermissions()
      if (perm.receive !== "granted") return

      await PushNotifications.register()

      PushNotifications.addListener("registration", async (token) => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        await supabase.from("push_tokens").upsert(
          { user_id: user.id, token: token.value, platform: "native", updated_at: new Date().toISOString() },
          { onConflict: "user_id" }
        )
      })

      PushNotifications.addListener("pushNotificationReceived", (notification) => {
        console.log("Push reçu:", notification.title)
      })

      PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
        const url = action.notification.data?.url
        if (url) window.location.href = url
      })
    } catch (e) {
      console.error("NativePushSetup error:", e)
    }
  }

  return null
}
