export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_KEY || "placeholder"
)

export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "")
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const year = parseInt(req.nextUrl.searchParams.get("year") ?? String(new Date().getFullYear()))
  const format = req.nextUrl.searchParams.get("format") ?? "json" // json or csv

  const startDate = `${year}-01-01`
  const endDate = `${year}-12-31`

  const { data: orders } = await supabase
    .from("orders")
    .select("symbol, side, price, qty, total, status, created_at")
    .eq("user_id", user.id)
    .eq("status", "filled")
    .gte("created_at", startDate)
    .lte("created_at", endDate + "T23:59:59Z")
    .order("created_at", { ascending: true })

  const safeOrders = orders ?? []

  // Match buys to sells
  type TaxLine = {
    symbol: string
    buyDate: string
    sellDate: string
    buyPrice: number
    sellPrice: number
    qty: number
    grossGain: number
    netGain: number
    termType: "court_terme" | "long_terme"
    durationDays: number
  }

  const taxLines: TaxLine[] = []
  const buyMap: Record<string, { price: number; qty: number; date: string }[]> = {}

  for (const o of safeOrders) {
    if (o.side === "buy") {
      if (!buyMap[o.symbol]) buyMap[o.symbol] = []
      buyMap[o.symbol].push({ price: o.price, qty: o.qty, date: o.created_at })
    } else if (o.side === "sell" && buyMap[o.symbol]?.length) {
      const buy = buyMap[o.symbol].shift()!
      const qty = Math.min(o.qty, buy.qty)
      const grossGain = (o.price - buy.price) * qty
      const durationDays = (new Date(o.created_at).getTime() - new Date(buy.date).getTime()) / (1000 * 60 * 60 * 24)
      taxLines.push({
        symbol: o.symbol,
        buyDate: buy.date.slice(0, 10),
        sellDate: o.created_at.slice(0, 10),
        buyPrice: buy.price,
        sellPrice: o.price,
        qty,
        grossGain: +grossGain.toFixed(2),
        netGain: +grossGain.toFixed(2), // Paper trading — no fees
        termType: durationDays >= 365 ? "long_terme" : "court_terme",
        durationDays: Math.round(durationDays),
      })
    }
  }

  const shortTerm = taxLines.filter(t => t.termType === "court_terme")
  const longTerm = taxLines.filter(t => t.termType === "long_terme")
  const totalGain = taxLines.reduce((s, t) => s + t.netGain, 0)
  const shortTermGain = shortTerm.reduce((s, t) => s + t.netGain, 0)
  const longTermGain = longTerm.reduce((s, t) => s + t.netGain, 0)

  // French tax: PFU 30% (17.2% CS + 12.8% IR) on gains
  const taxDue = Math.max(0, totalGain * 0.30)

  const summary = {
    year,
    totalGain: +totalGain.toFixed(2),
    shortTermGain: +shortTermGain.toFixed(2),
    longTermGain: +longTermGain.toFixed(2),
    estimatedTax: +taxDue.toFixed(2),
    lines: taxLines,
  }

  if (format === "csv") {
    const header = "Date vente,Symbole,Date achat,Prix achat,Prix vente,Quantité,Plus-value brute,Terme,Durée (jours)"
    const rows = taxLines.map(t =>
      `${t.sellDate},${t.symbol},${t.buyDate},${t.buyPrice},${t.sellPrice},${t.qty},${t.netGain},${t.termType === "court_terme" ? "Court terme" : "Long terme"},${t.durationDays}`
    )
    const csv = [header, ...rows].join("\n")
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="rapport-fiscal-${year}.csv"`,
      },
    })
  }

  return NextResponse.json(summary)
}
