import { NextResponse } from "next/server"

export async function GET() {
  try {
    const res = await fetch(
      "https://query1.finance.yahoo.com/v8/finance/chart/AAPL?interval=1d&range=5d",
      { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" }
    )
    const text = await res.text()
    return NextResponse.json({ status: res.status, ok: res.ok, body: text.slice(0, 500) })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 })
  }
}
