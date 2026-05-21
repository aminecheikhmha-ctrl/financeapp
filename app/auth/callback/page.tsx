"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

/**
 * Handles Supabase email confirmation redirects.
 * Supabase appends #access_token=...&refresh_token=...&type=signup to this URL.
 * The Supabase client auto-detects the hash on load and establishes the session.
 * We then check onboarding status and redirect accordingly.
 */
export default function AuthCallback() {
  const router = useRouter()

  useEffect(() => {
    // Give Supabase client time to parse the hash and set the session
    const handle = async () => {
      // Listen for the session to be established from the URL hash
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === "SIGNED_IN" && session) {
          subscription.unsubscribe()

          // Check if onboarding completed
          const { data: profile } = await supabase
            .from("user_profiles")
            .select("onboarding_completed")
            .eq("id", session.user.id)
            .maybeSingle()

          document.cookie = "onboarding_done=1; path=/; max-age=31536000"

          if (profile?.onboarding_completed) {
            router.replace("/dashboard")
          } else {
            router.replace("/onboarding")
          }
        }
      })

      // Fallback: if already signed in (e.g. password reset), redirect immediately
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        subscription.unsubscribe()
        document.cookie = "onboarding_done=1; path=/; max-age=31536000"
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("onboarding_completed")
          .eq("id", session.user.id)
          .maybeSingle()
        if (profile?.onboarding_completed) {
          router.replace("/dashboard")
        } else {
          router.replace("/onboarding")
        }
      }
    }

    handle()
  }, [router])

  return (
    <div className="min-h-screen bg-[#080808] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-500 text-sm">Connexion en cours...</p>
      </div>
    </div>
  )
}
