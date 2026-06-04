import { Metadata } from "next"

export const metadata: Metadata = { title: "Tradex Widget" }
export const dynamic = "force-dynamic"

async function getQuote(symbol: string) {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`,
      { next: { revalidate: 60 }, headers: { "User-Agent": "Mozilla/5.0" } }
    )
    const json = await res.json()
    const r = json?.chart?.result?.[0]
    if (!r) return null
    const price = r.meta?.regularMarketPrice ?? 0
    const prev  = r.meta?.chartPreviousClose ?? price
    const change = prev ? ((price - prev) / prev) * 100 : 0
    return { price, change, name: r.meta?.longName ?? symbol }
  } catch { return null }
}

export default async function WidgetPage({ params }: { params: { symbol: string } }) {
  const symbol = params.symbol.toUpperCase()
  const data   = await getQuote(symbol)
  const up     = (data?.change ?? 0) >= 0

  return (
    <html lang="fr">
      <head>
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <style>{`
          * { margin:0; padding:0; box-sizing:border-box; font-family: system-ui, sans-serif; }
          body { background: #080e09; color: white; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
          .widget { padding: 16px 20px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.08); background: linear-gradient(135deg, #0a140a, #060c06); min-width: 200px; }
          .symbol { font-size: 11px; font-weight: 800; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 4px; }
          .name { font-size: 10px; color: rgba(255,255,255,0.25); margin-bottom: 10px; }
          .price { font-size: 28px; font-weight: 900; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
          .change { font-size: 13px; font-weight: 800; margin-top: 4px; font-variant-numeric: tabular-nums; }
          .green { color: #4ade80; }
          .red { color: #f87171; }
          .dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #22c55e; margin-right: 6px; animation: pulse 2s infinite; }
          @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
          .footer { font-size: 9px; color: rgba(255,255,255,0.15); margin-top: 10px; display: flex; align-items: center; justify-content: space-between; }
          .logo { font-size: 9px; font-weight: 900; color: #22c55e; }
        `}</style>
      </head>
      <body>
        <div className="widget">
          <div className="symbol"><span className="dot" />{symbol}</div>
          {data?.name && <div className="name">{data.name}</div>}
          {data ? (
            <>
              <div className={`price ${up ? "green" : "red"}`}>
                ${data.price < 1 ? data.price.toFixed(4) : data.price.toFixed(2)}
              </div>
              <div className={`change ${up ? "green" : "red"}`}>
                {up ? "▲ +" : "▼ "}{Math.abs(data.change).toFixed(2)}%
              </div>
            </>
          ) : (
            <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 14 }}>—</div>
          )}
          <div className="footer">
            <span>Yahoo Finance · Live</span>
            <a href="https://tradex-kappa-six.vercel.app" target="_blank" rel="noopener" style={{ textDecoration: "none" }}>
              <span className="logo">Tradex ↗</span>
            </a>
          </div>
        </div>
      </body>
    </html>
  )
}
