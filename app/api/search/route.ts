import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const query = searchParams.get("q")

  if (!query) return NextResponse.json([])

  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v1/finance/search?q=${query}&quotesCount=8&newsCount=0&listsCount=0`,
      { headers: { "User-Agent": "Mozilla/5.0" } }
    )
    const json = await res.json()
    const results = json.quotes
      ?.filter((q: any) => q.symbol && q.shortname)
      .map((q: any) => ({
        symbol: q.symbol,
        name: q.shortname || q.longname || q.symbol,
        type: q.typeDisp || q.quoteType,
        exchange: q.exchDisp || q.exchange,
      })) ?? []

    return NextResponse.json(results)
  } catch (e) {
    return NextResponse.json([])
  }
}