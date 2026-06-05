import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const dynamic = "force-dynamic"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS })
}

export async function GET(req: NextRequest) {
  // API key auth
  const apiKey = req.headers.get("x-api-key") || req.nextUrl.searchParams.get("api_key")
  
  if (!apiKey) {
    return NextResponse.json({
      error: "API key required",
      docs: "Pass your API key via header X-Api-Key or query param ?api_key=",
      get_key: "https://tradex-kappa-six.vercel.app/parametres",
    }, { status: 401, headers: CORS })
  }

  // Validate API key against Supabase
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
    process.env.SUPABASE_SERVICE_KEY || "placeholder"
  )
  const { data: keyData } = await supabase
    .from("api_keys")
    .select("user_id, plan, calls_today")
    .eq("key", apiKey)
    .single()

  // If no key table, allow demo access with rate limit note
  const limit  = req.nextUrl.searchParams.get("limit") ? parseInt(req.nextUrl.searchParams.get("limit")!) : 10
  const symbol = req.nextUrl.searchParams.get("symbol")

  // Fetch from internal screener
  const screenerUrl = new URL("/api/screener", req.nextUrl.origin)
  if (limit) screenerUrl.searchParams.set("limit", String(Math.min(limit, 50)))
  const res  = await fetch(screenerUrl.toString())
  const data = await res.json()

  let assets = data.assets ?? []
  if (symbol) assets = assets.filter((a: any) => a.symbol === symbol.toUpperCase())

  return NextResponse.json({
    success:   true,
    version:   "1.0",
    timestamp: new Date().toISOString(),
    count:     assets.length,
    signals:   assets.map((a: any) => ({
      symbol:     a.symbol,
      name:       a.name,
      category:   a.category,
      price:      a.price,
      change_24h: a.change,
      signal:     a.signal,
      confluence: a.confluence,
      score:      a.score,
      tp:         a.tp ?? null,
      sl:         a.sl ?? null,
    })),
    rate_limit: { plan: keyData?.plan ?? "free", remaining: 100 - (keyData?.calls_today ?? 0) },
    docs: "https://tradex-kappa-six.vercel.app/api-docs",
  }, { headers: CORS })
}
