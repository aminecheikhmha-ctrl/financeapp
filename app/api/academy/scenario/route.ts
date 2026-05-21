import { NextRequest, NextResponse } from "next/server"

const SCENARIOS = {
  aapl_rsi_oversold_2024: {
    symbol: "AAPL",
    context:
      "Nous sommes en janvier 2024. AAPL a chuté de 8% en 3 jours. Le RSI est à 28, indiquant une zone de survente.",
    question: "Le RSI est à 28 — que fais-tu ?",
    correct: "buy",
    explanation:
      "Avec un RSI à 28 (zone de survente < 30) sur un actif de qualité comme AAPL, c'est souvent un bon point d'entrée. Le prix a rebondi de +15% dans les 30 jours suivants.",
    freeze_context: { rsi: 28, trend: "bearish", support: true, ma50_above: false },
    result_30d: "+14.8%",
    result_7d: "+6.2%",
  },
  btc_breakout_2024: {
    symbol: "BTC-USD",
    context:
      "Mars 2024. Bitcoin vient de casser la résistance des $52,000 avec un volume x2.5 la normale.",
    question: "Bitcoin casse une résistance clé avec du volume — que fais-tu ?",
    correct: "buy",
    explanation:
      "Le breakout avec volume élevé est un signal fort. BTC a continué sa hausse jusqu'à $73,000 (+40%) dans les semaines suivantes.",
    freeze_context: { rsi: 62, trend: "bullish", breakout: true, volume_spike: true },
    result_30d: "+38.5%",
    result_7d: "+12.1%",
  },
  nvda_overbought_2024: {
    symbol: "NVDA",
    context:
      "Février 2024 post-earnings. NVDA a bondi de +28% en 3 jours. RSI à 87, Williams %R à -5.",
    question: "RSI à 87 après un rally de +28% — que fais-tu ?",
    correct: "sell",
    explanation:
      "Un RSI à 87 indique une zone de surachat extrême. NVDA a corrigé de -18% dans les 3 semaines suivantes avant de repartir à la hausse.",
    freeze_context: { rsi: 87, trend: "bullish", overbought: true, post_earnings: true },
    result_30d: "+8.2%",
    result_7d: "-12.4%",
  },
  tsla_macd_cross_2023: {
    symbol: "TSLA",
    context:
      "Décembre 2023. TSLA montre un croisement MACD haussier + croisement EMA9/21 sur fond de volume croissant.",
    question: "Double signal haussier (MACD + EMA cross) — que fais-tu ?",
    correct: "buy",
    explanation:
      "La confluence de signaux (MACD + EMA) est un setup puissant. TSLA a progressé de +22% dans le mois suivant.",
    freeze_context: {
      rsi: 52,
      trend: "neutral_turning_bullish",
      macd_cross: true,
      ema_cross: true,
    },
    result_30d: "+21.7%",
    result_7d: "+9.3%",
  },
  spy_double_top_2024: {
    symbol: "SPY",
    context:
      "Avril 2024. Le SPY forme un double top avec un volume décroissant sur le second sommet.",
    question: "Double top avec volume faible sur le 2e sommet — que fais-tu ?",
    correct: "sell",
    explanation:
      "Le double top est une figure de retournement baissière. Le volume décroissant confirme l'épuisement acheteur. SPY a corrigé de -5.5% dans les semaines suivantes.",
    freeze_context: { rsi: 68, trend: "bullish", double_top: true, volume_declining: true },
    result_30d: "-4.9%",
    result_7d: "-2.1%",
  },
} as const

type ScenarioId = keyof typeof SCENARIOS
const ALL_IDS = Object.keys(SCENARIOS) as ScenarioId[]

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const id = searchParams.get("id")
  const live = searchParams.get("live") === "true"
  const liveSymbol = searchParams.get("symbol")

  // Live mode notice
  if (live && liveSymbol) {
    return NextResponse.json({
      live: true,
      symbol: liveSymbol,
      notice:
        "Mode live activé. Les données réelles seront utilisées depuis /api/trading/chart et /api/quote.",
      scenarios: ALL_IDS.filter(
        (sid) => SCENARIOS[sid].symbol.toUpperCase() === liveSymbol.toUpperCase()
      ).map((sid) => ({ id: sid, ...SCENARIOS[sid] })),
    })
  }

  // Return all scenarios
  if (!id) {
    return NextResponse.json(
      ALL_IDS.map((sid) => ({
        id: sid,
        symbol: SCENARIOS[sid].symbol,
        context: SCENARIOS[sid].context,
        question: SCENARIOS[sid].question,
      }))
    )
  }

  const scenario = SCENARIOS[id as ScenarioId]
  if (!scenario) {
    return NextResponse.json(
      {
        error: `Scénario "${id}" introuvable. IDs disponibles: ${ALL_IDS.join(", ")}`,
      },
      { status: 404 }
    )
  }

  return NextResponse.json({ id, ...scenario })
}
