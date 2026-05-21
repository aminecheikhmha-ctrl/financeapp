import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export async function GET() {
  const { data: trades } = await supabase
    .from("public_trades")
    .select("id, user_id, symbol, side, pnl_pct, created_at, user_profiles(username)")
    .order("created_at", { ascending: false })
    .limit(30)

  const formatted = (trades ?? []).map((t: any) => ({
    id: t.id,
    username:
      (Array.isArray(t.user_profiles)
        ? t.user_profiles[0]?.username
        : t.user_profiles?.username) ?? t.user_id,
    symbol: t.symbol,
    side: t.side,
    pnl_pct: t.pnl_pct ?? null,
    shared_at: t.created_at,
  }))

  return NextResponse.json({ trades: formatted })
}
