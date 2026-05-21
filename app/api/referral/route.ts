import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

function makeSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)
}

function generateCode(userId: string): string {
  // 6 chars alphanumeric from userId hash
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash) + userId.charCodeAt(i)
    hash |= 0
  }
  let code = ""
  let n = Math.abs(hash)
  for (let i = 0; i < 6; i++) {
    code += chars[n % chars.length]
    n = Math.floor(n / chars.length)
  }
  return code
}

// GET /api/referral — get or create referral code for current user
export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "")
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const supabase = makeSupabase()
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Get existing code from user_profiles
  const { data: profile } = await supabase
    .from("user_profiles").select("referral_code").eq("id", user.id).single()

  let code = profile?.referral_code
  if (!code) {
    code = generateCode(user.id)
    await supabase.from("user_profiles").upsert({ id: user.id, referral_code: code }, { onConflict: "id" })
  }

  // Get referral stats
  const { data: referrals } = await supabase
    .from("referrals")
    .select("status, reward_given")
    .eq("referrer_id", user.id)

  const total = referrals?.length ?? 0
  const converted = referrals?.filter(r => r.status === "completed").length ?? 0

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://financeapp-kappa-six.vercel.app"
  return NextResponse.json({
    code,
    url: `${appUrl}/signup?ref=${code}`,
    stats: { total, converted },
  })
}
