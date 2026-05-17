import { NextResponse } from "next/server"

const INDICES = [
  { symbol: "SPY",     name: "S&P 500"           },
  { symbol: "QQQ",     name: "Nasdaq 100"         },
  { symbol: "DIA",     name: "Dow Jones"           },
  { symbol: "BTC-USD", name: "Bitcoin"             },
  { symbol: "ETH-USD", name: "Ethereum"            },
  { symbol: "GLD",     name: "Or"                  },
  { symbol: "TLT",     name: "Obligations 20 ans"  },
]

async function fetchQuote(symbol: string, name: string) {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`,
      { headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: 3600 } }
    )
    if (!res.ok) return null
    const json = await res.json()
    const meta = json?.chart?.result?.[0]?.meta
    if (!meta) return null

    const price  = meta.regularMarketPrice as number
    const prev   = (meta.previousClose ?? meta.chartPreviousClose ?? price) as number
    const change = prev ? ((price - prev) / prev) * 100 : 0
    return { symbol, name, price, change }
  } catch {
    return null
  }
}

export async function GET() {
  // Fetch all indices in parallel
  const results    = await Promise.all(INDICES.map(i => fetchQuote(i.symbol, i.name)))
  const marketData = results.filter(Boolean) as { symbol: string; name: string; price: number; change: number }[]

  const topMovers  = [...marketData].sort((a, b) => Math.abs(b.change) - Math.abs(a.change)).slice(0, 3)

  // Derive overall sentiment from SPY + QQQ + BTC
  const spyC = marketData.find(d => d.symbol === "SPY")?.change     ?? 0
  const qqqC = marketData.find(d => d.symbol === "QQQ")?.change     ?? 0
  const btcC = marketData.find(d => d.symbol === "BTC-USD")?.change ?? 0
  const avg  = (spyC + qqqC + btcC) / 3
  const sentiment = avg > 0.3 ? "bullish" : avg < -0.3 ? "bearish" : "neutral"

  const ctx = marketData
    .map(d => `${d.name} (${d.symbol}): $${d.price.toFixed(2)} (${d.change >= 0 ? "+" : ""}${d.change.toFixed(2)}%)`)
    .join("\n")

  let summary = "Briefing marché temporairement indisponible."
  try {
    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        max_tokens: 450,
        temperature: 0.3,
        messages: [
          {
            role: "system",
            content:
              "Tu es un analyste financier senior. Rédige des briefings marché précis, factuels, en français. " +
              "Style journalistique. Cite toujours les chiffres clés. Pas de formatage markdown.",
          },
          {
            role: "user",
            content:
              `Données de marché du ${new Date().toLocaleDateString("fr-FR")} :\n\n${ctx}\n\n` +
              `Rédige un briefing en 3 paragraphes courts :\n` +
              `1. Sentiment général avec les variations clés en chiffres\n` +
              `2. Points forts, secteurs qui performent, et risques principaux\n` +
              `3. Une opportunité ou un point d'attention spécifique pour aujourd'hui\n\n` +
              `Maximum 200 mots. Commence directement par le texte, sans titre ni bullet points.`,
          },
        ],
      }),
    })
    const groqJson = await groqRes.json()
    summary = groqJson.choices?.[0]?.message?.content ?? summary
  } catch {}

  return NextResponse.json({
    summary,
    sentiment,
    date: new Date().toISOString(),
    top_movers: topMovers,
    market_data: marketData,
  })
}
