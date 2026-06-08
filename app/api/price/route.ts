import { NextRequest, NextResponse } from "next/server"
import { getUniversalQuote } from "@/lib/marketData"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol")
  if (!symbol) return NextResponse.json({ error: "Symbol requis" }, { status: 400 })
  const quote = await getUniversalQuote(symbol)
  if (!quote) return NextResponse.json({ error: "No data" }, { status: 404 })
  return NextResponse.json({ price: quote.price, change: quote.change })
}
