import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const checks: Record<string, { status: string; latency?: number; error?: string }> = {}

  // Check Supabase
  try {
    const start = Date.now()
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    )
    const { error } = await supabase.from("profiles").select("id").limit(1)
    checks.supabase = { status: error ? "error" : "ok", latency: Date.now() - start }
    if (error) checks.supabase.error = error.message
  } catch (e: unknown) {
    checks.supabase = { status: "error", error: e instanceof Error ? e.message : "unknown" }
  }

  // Check Yahoo Finance
  try {
    const start = Date.now()
    const res = await fetch(
      "https://query1.finance.yahoo.com/v8/finance/chart/AAPL?interval=1d&range=1d",
      { signal: AbortSignal.timeout(5000) }
    )
    checks.yahoo_finance = { status: res.ok ? "ok" : "degraded", latency: Date.now() - start }
  } catch (e: unknown) {
    checks.yahoo_finance = { status: "error", error: e instanceof Error ? e.message : "timeout" }
  }

  // Check Groq key configured
  checks.groq = { status: process.env.GROQ_API_KEY ? "configured" : "missing_key" }

  const allOk = Object.values(checks).every(s => s.status === "ok" || s.status === "configured")

  return NextResponse.json(
    {
      status: allOk ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version ?? "1.0.0",
      environment: process.env.NODE_ENV,
      services: checks,
    },
    { status: allOk ? 200 : 503 }
  )
}
