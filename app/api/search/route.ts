import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")
  if (!q) return NextResponse.json([])

  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v1/finance/search?q=${q}&quotesCount=8&newsCount=0`,
      { headers: { "User-Agent": "Mozilla/5.0" } }
    )
    const data = await res.json()
    const results = (data?.quotes ?? [])
      .filter((r: any) => r.symbol && r.shortname)
      .map((r: any) => ({
        symbol: r.symbol,
        name: r.shortname ?? r.longname ?? r.symbol,
        exchange: r.exchange ?? "",
        type: r.quoteType ?? "",
      }))
    return NextResponse.json(results)
  } catch {
    return NextResponse.json([])
  }
}