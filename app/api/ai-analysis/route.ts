import { NextRequest, NextResponse } from "next/server"

// ── Fetch 3-month daily bars and compute key indicators ───────────────────────

async function fetchIndicators(symbol: string) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=3mo`
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: 300 } })
    if (!res.ok) return null
    const json = await res.json()
    const result = json?.chart?.result?.[0]
    if (!result) return null

    const q       = result.indicators?.quote?.[0] ?? {}
    const closes:  number[] = (q.close  ?? []).filter(Boolean)
    const highs:   number[] = (q.high   ?? []).filter((v: unknown) => v != null)
    const lows:    number[] = (q.low    ?? []).filter((v: unknown) => v != null)
    const volumes: number[] = q.volume  ?? []
    if (closes.length < 20) return null

    // RSI
    const period = 14
    let gains = 0, losses = 0
    for (let i = closes.length - period; i < closes.length; i++) {
      const d = closes[i] - closes[i - 1]
      d > 0 ? gains += d : losses -= d
    }
    const ag = gains / period, al = losses / period
    const rsi = al === 0 ? 100 : 100 - 100 / (1 + ag / al)

    // EMA helper
    const ema = (v: number[], p: number) => {
      if (v.length < p) return v[v.length - 1]
      const k = 2 / (p + 1)
      let e = v.slice(0, p).reduce((a, b) => a + b, 0) / p
      for (let i = p; i < v.length; i++) e = v[i] * k + e * (1 - k)
      return e
    }

    // MACD
    const ema12 = ema(closes, 12), ema26 = ema(closes, 26)
    const macdLine = ema12 - ema26
    const macdPrev = ema(closes.slice(0, -1), 12) - ema(closes.slice(0, -1), 26)
    const macdSignalVal = macdLine * 0.2 + macdPrev * 0.8  // simplified signal approx
    const macdHist = macdLine - macdSignalVal

    // Stochastic
    const hh = Math.max(...highs.slice(-14))
    const ll = Math.min(...lows.slice(-14))
    const stochK = hh === ll ? 50 : ((closes[closes.length - 1] - ll) / (hh - ll)) * 100

    // ATR
    const trs = closes.slice(-15).map((c, i, arr) =>
      i === 0 ? (highs.slice(-15)[i] || c) - (lows.slice(-15)[i] || c)
              : Math.max(
                  (highs.slice(-15)[i] || c) - (lows.slice(-15)[i] || c),
                  Math.abs((highs.slice(-15)[i] || c) - arr[i - 1]),
                  Math.abs((lows.slice(-15)[i]  || c) - arr[i - 1])
                )
    )
    const atr = trs.slice(-14).reduce((a, b) => a + b, 0) / 14

    // BB
    const ma20 = closes.slice(-20).reduce((a, b) => a + b, 0) / 20
    const variance = closes.slice(-20).reduce((a, c) => a + (c - ma20) ** 2, 0) / 20
    const std = Math.sqrt(variance)
    const bbPos = ((closes[closes.length - 1] - (ma20 - 2 * std)) / (4 * std) * 100).toFixed(1)

    // Williams %R
    const wr = hh === ll ? -50 : ((hh - closes[closes.length - 1]) / (hh - ll)) * -100

    // OBV trend
    let obv = 0
    const obvHistory: number[] = [0]
    for (let i = 1; i < closes.length; i++) {
      obv += closes[i] > closes[i - 1] ? volumes[i] : closes[i] < closes[i - 1] ? -volumes[i] : 0
      obvHistory.push(obv)
    }
    const obvTrend = obv > obvHistory[Math.max(0, obvHistory.length - 10)] ? "haussier" : "baissier"

    // Divergence detection (5-day window)
    const recentCloses = closes.slice(-5)
    const priceDir = recentCloses[4] > recentCloses[0] ? "hausse" : "baisse"
    const rsiHistory = closes.slice(-20).map((_, idx, arr) => {
      if (idx < 14) return 50
      let g = 0, l = 0
      for (let j = idx - 13; j <= idx; j++) { const d = arr[j] - arr[j - 1]; d > 0 ? g += d : l -= d }
      return l === 0 ? 100 : 100 - 100 / (1 + g / 14 / (l / 14))
    })
    const rsiDir = rsiHistory[rsiHistory.length - 1] > rsiHistory[rsiHistory.length - 5] ? "hausse" : "baisse"
    const divergence = priceDir !== rsiDir
      ? `⚠️ ${priceDir === "hausse" ? "Divergence BAISSIÈRE (prix en hausse, RSI en baisse)" : "Divergence HAUSSIÈRE (prix en baisse, RSI en hausse)"}`
      : "Aucune divergence prix/RSI détectée"

    // Confluence count
    const confirmations: string[] = []
    if (rsi < 35)                       confirmations.push("RSI survendu")
    if (rsi > 65)                       confirmations.push("RSI suracheté")
    if (macdHist > 0 && macdLine > 0)   confirmations.push("MACD haussier")
    if (macdHist < 0 && macdLine < 0)   confirmations.push("MACD baissier")
    if (stochK < 20)                    confirmations.push("Stochastique survendu")
    if (stochK > 80)                    confirmations.push("Stochastique suracheté")
    if (obvTrend === "haussier")        confirmations.push("OBV haussier")

    return {
      rsi: rsi.toFixed(1),
      macd: { line: macdLine.toFixed(4), signal: macdSignalVal.toFixed(4), hist: macdHist.toFixed(4) },
      stochK: stochK.toFixed(1),
      atr: atr.toFixed(3),
      bbPos,
      wr: wr.toFixed(1),
      obvTrend,
      divergence,
      confirmations,
    }
  } catch {
    return null
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { symbol, name, price, change, high, low, marketCap, volume } = body

  const ind = await fetchIndicators(symbol)

  const technicalBlock = ind
    ? `
Indicateurs techniques (données temps réel) :
• RSI(14)          : ${ind.rsi}  ${Number(ind.rsi) > 70 ? "→ SURACHETÉ" : Number(ind.rsi) < 30 ? "→ SURVENDU" : "→ zone neutre"}
• MACD ligne/signal: ${ind.macd.line} / ${ind.macd.signal}  (histogramme ${Number(ind.macd.hist) > 0 ? "positif → tendance haussière" : "négatif → tendance baissière"})
• Stochastique %K  : ${ind.stochK}  ${Number(ind.stochK) > 80 ? "→ suracheté" : Number(ind.stochK) < 20 ? "→ survendu" : ""}
• Williams %R      : ${ind.wr}  ${Number(ind.wr) > -20 ? "→ suracheté" : Number(ind.wr) < -80 ? "→ survendu" : ""}
• Bollinger Position: ${ind.bbPos}%  (0%=support, 100%=résistance)
• ATR(14)          : ${ind.atr}  (volatilité)
• OBV tendance     : ${ind.obvTrend}
• Divergence       : ${ind.divergence}
• Signaux alignés  : ${ind.confirmations.join(", ") || "aucun signal fort"}`
    : "Indicateurs techniques : indisponibles — base l'analyse sur les données prix ci-dessus."

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        max_tokens: 1200,
        messages: [
          {
            role: "system",
            content:
              "Tu es un analyste financier quantitatif expert. Tu réponds toujours en français, " +
              "avec des valeurs précises des indicateurs. Tu identifies les divergences et la confluence des signaux. " +
              "Tu structures ton analyse en sections claires.",
          },
          {
            role: "user",
            content: `Analyse complète de ${name} (${symbol}) :

Données de marché :
• Prix actuel   : $${price}
• Variation J   : ${change}%
• Haut / Bas    : $${high} / $${low}
• Market Cap    : ${marketCap ?? "N/A"}
• Volume        : ${volume ?? "N/A"}
${technicalBlock}

Rédige une analyse structurée en 4 sections précises :

**1. Contexte technique**
Décris la tendance actuelle en citant explicitement RSI (${ind?.rsi ?? "N/A"}), MACD (${ind?.macd.hist ?? "N/A"}), position Bollinger (${ind?.bbPos ?? "N/A"}%). Mentionne si le prix est en zone de surachat/survente.

**2. Signaux et confluence**
Liste les signaux actifs (cite les valeurs exactes des indicateurs). Mentionne la divergence éventuelle : ${ind?.divergence ?? "non analysée"}. Un signal est fort si 3+ indicateurs confirment.

**3. Niveaux clés et risques**
Donne des niveaux de prix précis basés sur ATR (${ind?.atr ?? "N/A"}) : support, résistance, stop-loss suggéré. Mentionne les risques macro si pertinents.

**4. Verdict avec probabilité**
Conclure avec ACHETER / ATTENDRE / ÉVITER et une probabilité de réussite estimée (ex: 65% de chance de hausse à court terme). Justifie en 1-2 phrases avec les indicateurs dominants.`,
          },
        ],
      }),
    })

    const data = await res.json()
    const text = data.choices?.[0]?.message?.content ?? "Analyse indisponible."
    return NextResponse.json({ analysis: text })
  } catch {
    return NextResponse.json({ error: "Erreur API Groq" }, { status: 500 })
  }
}
