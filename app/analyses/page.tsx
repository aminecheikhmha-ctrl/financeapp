"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"

// ── Types ──────────────────────────────────────────────────────────────────────

type MacroRegime =
  | "croissance_forte"
  | "fin_de_cycle"
  | "ralentissement"
  | "recession"
  | "reprise"

type IndicatorStatus = "low" | "normal" | "elevated" | "high"

type Indicator = {
  id: string
  label: string
  value: string
  unit: string
  status: IndicatorStatus
  statusLabels: Partial<Record<IndicatorStatus, string>>
  whatIsIt: string
  whyItMatters: string
  targetRange: string
  impact: { positive: string[]; negative: string[] }
}

type CyclePhase =
  | "accumulation"
  | "tendance_forte"
  | "surchauffe"
  | "capitulation"
  | "distribution"
  | "recovery"

type AssetFlow = {
  symbol: string
  name: string
  type: "stock" | "crypto" | "etf" | "forex" | "commodity" | "index"
  region: "us" | "eu" | "asia" | "em" | "global" | "crypto"
  sector: string
  price: number
  change_1d: number
  change_1w: number
  change_1m: number
  change_ytd: number
  change_1y: number
  volume: number
  volume_ratio: number
  market_cap?: number
  phase: CyclePhase
  phase_score: number
  flow_strength: number
  sentiment_score: number
  sparkline: number[]
  breadth: number
}

type ImpactRow = {
  asset: string
  tooltip: string
  values: Record<"reprise" | "croissance_forte" | "fin_de_cycle" | "ralentissement", string>
}

type SnapshotData = {
  spy?: { price?: number; change1d?: number; change1m?: number } | null
  vix?: { price?: number } | null
  gold?: { change1d?: number; change1m?: number } | null
  dxy?: { change1m?: number } | null
  yieldCurve?: number | null
}

// ── Constants ──────────────────────────────────────────────────────────────────

const REGIME_CONFIG: Record<MacroRegime, {
  label: string; emoji: string; color: string; bg: string; desc: string; simple: string
}> = {
  croissance_forte: {
    label: "Croissance forte", emoji: "🚀", color: "#22c55e", bg: "rgba(34,197,94,0.08)",
    desc: "L'économie tourne à plein régime",
    simple: "Tout va bien : les entreprises gagnent de l'argent, les gens ont des jobs, les marchés montent.",
  },
  fin_de_cycle: {
    label: "Fin de cycle", emoji: "🌤️", color: "#f59e0b", bg: "rgba(245,158,11,0.08)",
    desc: "Croissance mais signes d'essoufflement",
    simple: "Ça continue de monter mais c'est moins fort qu'avant. Les banques centrales commencent à freiner.",
  },
  ralentissement: {
    label: "Ralentissement", emoji: "🌧️", color: "#f97316", bg: "rgba(249,115,22,0.08)",
    desc: "L'économie perd de la vitesse",
    simple: "L'économie ralentit. Les taux d'intérêt élevés font leur effet. Les marchés sont nerveux.",
  },
  recession: {
    label: "Récession", emoji: "⛈️", color: "#ef4444", bg: "rgba(239,68,68,0.08)",
    desc: "L'économie rétrécit",
    simple: "C'est la crise. Les entreprises licencient, les gens dépensent moins, les marchés baissent.",
  },
  reprise: {
    label: "Reprise", emoji: "🌱", color: "#60a5fa", bg: "rgba(96,165,250,0.08)",
    desc: "Rebond après une période difficile",
    simple: "Les choses commencent à aller mieux. C'est souvent le meilleur moment pour investir.",
  },
}

const CYCLE_PHASES: Array<{
  key: MacroRegime; label: string; sublabel: string
  color: string; bg: string; border: string; desc: string; assets: string[]
}> = [
  {
    key: "reprise", label: "🌱 Reprise", sublabel: "Sortie de crise",
    color: "#60a5fa", bg: "rgba(96,165,250,0.1)", border: "rgba(96,165,250,0.2)",
    desc: "L'économie redémarre. Chômage commence à baisser. Meilleur moment pour investir.",
    assets: ["Actions cycliques", "Petites caps", "Immobilier"],
  },
  {
    key: "croissance_forte", label: "🚀 Expansion", sublabel: "Tout va bien",
    color: "#22c55e", bg: "rgba(34,197,94,0.1)", border: "rgba(34,197,94,0.2)",
    desc: "Croissance forte, emploi élevé, entreprises profitables. Les marchés montent.",
    assets: ["Actions tech", "Actions growth", "Crypto"],
  },
  {
    key: "fin_de_cycle", label: "🌤️ Surchauffe", sublabel: "Trop chaud",
    color: "#f59e0b", bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.2)",
    desc: "L'économie chauffe trop. Inflation monte. La banque centrale freine en montant les taux.",
    assets: ["Matières premières", "Énergie", "Or"],
  },
  {
    key: "ralentissement", label: "⛈️ Ralentissement", sublabel: "Ça refroidit",
    color: "#f97316", bg: "rgba(249,115,22,0.1)", border: "rgba(249,115,22,0.2)",
    desc: "Les taux élevés freinent l'économie. Risque de récession. Marchés nerveux.",
    assets: ["Obligations", "Or", "Secteurs défensifs"],
  },
  {
    key: "recession", label: "❄️ Récession", sublabel: "La crise",
    color: "#ef4444", bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.2)",
    desc: "L'économie rétrécit. Chômage monte. La banque centrale baisse les taux pour aider.",
    assets: ["Liquidités (cash)", "Obligations d'État", "Or"],
  },
]

const PHASE_CONFIG: Record<CyclePhase, { label: string; color: string; bg: string; desc: string }> = {
  accumulation:   { label: "Accumulation",   color: "#60a5fa", bg: "rgba(96,165,250,0.12)",  desc: "Smart money achète discrètement. Opportunité de fond." },
  tendance_forte: { label: "Tendance Forte", color: "#22c55e", bg: "rgba(34,197,94,0.12)",   desc: "Momentum haussier confirmé. Tendance en place." },
  surchauffe:     { label: "Surchauffé",     color: "#ef4444", bg: "rgba(239,68,68,0.12)",   desc: "Valorisation extrême. Danger de retournement." },
  capitulation:   { label: "Capitulation",   color: "#f97316", bg: "rgba(249,115,22,0.12)",  desc: "Vente panique. Potentiel point de fond." },
  distribution:   { label: "Distribution",   color: "#f59e0b", bg: "rgba(245,158,11,0.12)",  desc: "Smart money vend. Retournement proche." },
  recovery:       { label: "Recovery",       color: "#a78bfa", bg: "rgba(167,139,250,0.12)", desc: "Rebond après capitulation. Momentum qui revient." },
}

const CAUSAL_CHAINS = [
  {
    id: "inflation_taux", trigger: "🔥 L'inflation monte", color: "#ef4444",
    steps: [
      { icon: "🏦", title: "La banque centrale réagit",   desc: "La Fed monte ses taux pour freiner l'économie. Emprunter devient plus cher." },
      { icon: "💳", title: "Le crédit coûte plus cher",   desc: "Les crédits immobiliers, auto et entreprises augmentent. Les gens dépensent moins." },
      { icon: "🏢", title: "Les entreprises freinent",    desc: "Moins d'investissements, moins d'embauches. Les profits ralentissent." },
      { icon: "📉", title: "Les marchés réagissent",      desc: "Les actions (surtout tech) baissent. Les obligations courtes montent. L'or peut monter." },
    ],
  },
  {
    id: "recession_baisse", trigger: "❄️ Récession confirmée", color: "#60a5fa",
    steps: [
      { icon: "🏦", title: "La Fed baisse les taux",      desc: "Pour relancer l'économie, la banque centrale baisse ses taux et injecte des liquidités." },
      { icon: "💰", title: "L'argent coûte moins cher",   desc: "Emprunter devient moins cher. Les entreprises peuvent à nouveau investir." },
      { icon: "📈", title: "Les marchés anticipent",      desc: "Les marchés montent AVANT la fin de la récession. Ils anticipent toujours de 6-9 mois." },
      { icon: "🚀", title: "La reprise commence",         desc: "Emploi repart, consommation monte, économie redémarre. Nouveau cycle." },
    ],
  },
  {
    id: "dollar_fort", trigger: "💵 Le dollar devient très fort", color: "#fbbf24",
    steps: [
      { icon: "🌍", title: "Les devises étrangères s'affaiblissent", desc: "Euro, yuan, peso... tous perdent face au dollar. La dette en dollars coûte plus cher pour les pays émergents." },
      { icon: "🥇", title: "L'or et les matières premières baissent", desc: "Tout est coté en dollars. Dollar fort = matières premières plus chères pour les étrangers = moins de demande." },
      { icon: "₿", title: "Les cryptos souffrent",        desc: "Bitcoin et les cryptos sont souvent corrélés négativement au dollar. Dollar fort = crypto faible." },
      { icon: "🏭", title: "Les multinationales US souffrent", desc: "Leurs revenus à l'étranger valent moins en dollars. Leurs bénéfices baissent." },
    ],
  },
]

const SCENARIOS = [
  {
    id: "rate_hike", title: "Et si les taux montent encore +1% ?", icon: "📈", probability: "30%",
    effects: [
      { asset: "Actions tech",        impact: "negative" as const, desc: "↓ Valorisations plus faibles. Les futurs profits valent moins.",       magnitude: 3 },
      { asset: "Immobilier",          impact: "negative" as const, desc: "↓ Crédits encore plus chers. Moins d'acheteurs.",                      magnitude: 3 },
      { asset: "Obligations courtes", impact: "positive" as const, desc: "↑ Rendements plus attractifs.",                                         magnitude: 2 },
      { asset: "Banques",             impact: "positive" as const, desc: "↑ Spreads plus larges = plus de profits sur les prêts.",                magnitude: 2 },
      { asset: "Risque récession",    impact: "negative" as const, desc: "⬆️ Probabilité de récession augmente.",                                 magnitude: 3 },
    ],
  },
  {
    id: "rate_cut", title: "Et si la Fed baisse les taux ?", icon: "✂️", probability: "55%",
    effects: [
      { asset: "Actions tech",        impact: "positive" as const, desc: "↑ Valorisations remontent. Argent moins cher = plus de prise de risque.", magnitude: 3 },
      { asset: "Crypto",              impact: "positive" as const, desc: "↑ Historiquement monte fortement après les baisses de taux.",             magnitude: 3 },
      { asset: "Or",                  impact: "positive" as const, desc: "↑ Dollar faiblit, or monte.",                                              magnitude: 2 },
      { asset: "Obligations longues", impact: "positive" as const, desc: "↑ Prix monte quand les taux baissent.",                                    magnitude: 3 },
      { asset: "Dollar",              impact: "negative" as const, desc: "↓ Monnaie moins attractive pour les investisseurs étrangers.",             magnitude: 2 },
    ],
  },
  {
    id: "recession", title: "Et si une récession arrive ?", icon: "❄️", probability: "25%",
    effects: [
      { asset: "Actions",             impact: "negative" as const, desc: "↓ Chute de -20% à -50% en moyenne pendant les récessions.",  magnitude: 3 },
      { asset: "Or",                  impact: "positive" as const, desc: "↑ Valeur refuge. Monte pendant l'incertitude.",               magnitude: 2 },
      { asset: "Obligations d'État",  impact: "positive" as const, desc: "↑ La Fed baisse les taux = obligations montent.",             magnitude: 3 },
      { asset: "Crypto",              impact: "negative" as const, desc: "↓ Actif risqué qui souffre pendant les récessions.",          magnitude: 3 },
      { asset: "Cash",                impact: "positive" as const, desc: "↑ Stable. Permet d'acheter au creux.",                        magnitude: 1 },
    ],
  },
  {
    id: "inflation_spike", title: "Et si l'inflation repart à 7% ?", icon: "🔥", probability: "15%",
    effects: [
      { asset: "Matières premières",  impact: "positive" as const, desc: "↑ Pétrole, métaux, agricole = protection naturelle contre l'inflation.", magnitude: 3 },
      { asset: "Or",                  impact: "positive" as const, desc: "↑ Protection classique contre l'inflation.",                              magnitude: 3 },
      { asset: "Obligations longues", impact: "negative" as const, desc: "↓ L'inflation érode la valeur des coupons fixes.",                        magnitude: 3 },
      { asset: "Actions tech",        impact: "negative" as const, desc: "↓ La Fed redevient agressive. Taux montent à nouveau.",                   magnitude: 3 },
      { asset: "Immobilier",          impact: "positive" as const, desc: "↑ Les actifs réels protègent contre l'inflation.",                        magnitude: 2 },
    ],
  },
]

const IMPACT_ROWS: ImpactRow[] = [
  { asset: "📈 Actions croissance", tooltip: "Apple, NVIDIA, Tesla...",     values: { reprise: "⭐⭐⭐",    croissance_forte: "⭐⭐⭐⭐", fin_de_cycle: "⭐⭐",    ralentissement: "⭐"       } },
  { asset: "🏦 Actions valeur",     tooltip: "JPMorgan, Goldman Sachs...",  values: { reprise: "⭐⭐",       croissance_forte: "⭐⭐⭐",   fin_de_cycle: "⭐⭐⭐",   ralentissement: "⭐⭐"     } },
  { asset: "🥇 Or",                  tooltip: "Valeur refuge anti-inflation",values: { reprise: "⭐⭐",       croissance_forte: "⭐⭐",     fin_de_cycle: "⭐⭐⭐",   ralentissement: "⭐⭐⭐⭐" } },
  { asset: "📜 Obligations d'État", tooltip: "Dette gouvernementale",       values: { reprise: "⭐⭐",       croissance_forte: "⭐",        fin_de_cycle: "⭐⭐",    ralentissement: "⭐⭐⭐⭐" } },
  { asset: "⚡ Énergie (pétrole)",  tooltip: "ExxonMobil, TotalEnergies...",values: { reprise: "⭐⭐",       croissance_forte: "⭐⭐⭐",   fin_de_cycle: "⭐⭐⭐⭐", ralentissement: "⭐⭐"     } },
  { asset: "₿ Crypto",              tooltip: "Bitcoin, Ethereum...",        values: { reprise: "⭐⭐⭐",    croissance_forte: "⭐⭐⭐⭐", fin_de_cycle: "⭐⭐",    ralentissement: "⭐"       } },
  { asset: "💵 Cash",               tooltip: "Liquidités, fonds monétaires",values: { reprise: "⭐",         croissance_forte: "⭐",        fin_de_cycle: "⭐⭐⭐",  ralentissement: "⭐⭐⭐⭐" } },
]

const STATUS_COLORS: Record<IndicatorStatus, { color: string; bg: string; border: string }> = {
  low:      { color: "#4ade80", bg: "rgba(34,197,94,0.08)",   border: "rgba(34,197,94,0.15)"  },
  normal:   { color: "#4ade80", bg: "rgba(34,197,94,0.06)",   border: "rgba(34,197,94,0.12)"  },
  elevated: { color: "#fbbf24", bg: "rgba(251,191,36,0.08)",  border: "rgba(251,191,36,0.15)" },
  high:     { color: "#f87171", bg: "rgba(239,68,68,0.08)",   border: "rgba(239,68,68,0.15)"  },
}

const CARD_STATUS_COLORS: Record<string, { color: string; bg: string; border: string }> = {
  green:   { color: "#4ade80", bg: "rgba(34,197,94,0.08)",   border: "rgba(34,197,94,0.15)"   },
  red:     { color: "#f87171", bg: "rgba(239,68,68,0.08)",   border: "rgba(239,68,68,0.15)"   },
  orange:  { color: "#fb923c", bg: "rgba(251,146,60,0.08)",  border: "rgba(251,146,60,0.15)"  },
  yellow:  { color: "#fbbf24", bg: "rgba(251,191,36,0.08)",  border: "rgba(251,191,36,0.15)"  },
  neutral: { color: "#9ca3af", bg: "rgba(255,255,255,0.04)", border: "rgba(255,255,255,0.08)" },
}

const REGIONS = [
  { key: "all",    label: "🌍 Monde entier" },
  { key: "us",     label: "🇺🇸 États-Unis" },
  { key: "eu",     label: "🇪🇺 Europe" },
  { key: "asia",   label: "🌏 Asie" },
  { key: "em",     label: "🌐 Émergents" },
  { key: "crypto", label: "₿ Crypto" },
]

const SECTORS = [
  "Tous", "Technology", "Finance", "Healthcare", "Energy",
  "Consumer", "Industrials", "Luxury", "Automotive", "Defense",
  "Commodities", "Crypto", "ETF",
]

// ── Helpers ────────────────────────────────────────────────────────────────────

function computeMacroRegime(data: {
  spyChange1m: number; vix: number; yieldCurve: number
  unemploymentTrend: "rising" | "stable" | "falling"
}): MacroRegime {
  if (data.vix > 30 && data.spyChange1m < -10) return "recession"
  if (data.vix > 20 && data.spyChange1m < -5)  return "ralentissement"
  if (data.yieldCurve < 0 || data.vix > 18)    return "fin_de_cycle"
  if (data.spyChange1m > 5 && data.vix < 16)   return "croissance_forte"
  return "fin_de_cycle"
}

function computePhase(asset: Partial<AssetFlow>): CyclePhase {
  const change1m    = asset.change_1m    ?? 0
  const change1y    = asset.change_1y    ?? 0
  const volumeRatio = asset.volume_ratio ?? 1
  if (change1m < -15 && volumeRatio > 1.5 && change1y < -20) return "capitulation"
  if (change1m > 15  && change1y > 50    && volumeRatio > 1.3) return "surchauffe"
  if (change1m < -5  && change1y > 20    && volumeRatio > 1.2) return "distribution"
  if (Math.abs(change1m) < 5 && change1y < -10 && volumeRatio < 0.9) return "accumulation"
  if (change1m > 5  && change1y > 10) return "tendance_forte"
  if (change1m > 3  && change1y < 0)  return "recovery"
  return "tendance_forte"
}

function computeFlowStrength(change1d: number, change1w: number, volumeRatio: number): number {
  const momentum    = change1d * 0.4 + change1w * 0.6
  const volumeBoost = volumeRatio > 1.5 ? 1.3 : volumeRatio > 1.2 ? 1.1 : 1
  return Math.max(-100, Math.min(100, momentum * volumeBoost * 5))
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function AnalysesPage() {
  const router = useRouter()

  // Fed funds rate — hardcoded (no free real-time API)
  const fedRate = 5.25

  // ── Macro state ──
  const [spyData,    setSpyData]    = useState<{ price?: number; change1d?: number; change1m?: number } | null>(null)
  const [vix,        setVix]        = useState(18)
  const [goldChange, setGoldChange] = useState(0)
  const [dxyChange,  setDxyChange]  = useState(0)
  const [yieldCurve, setYieldCurve] = useState(0.3)
  const [regime,     setRegime]     = useState<MacroRegime | null>(null)
  const [aiBriefing, setAiBriefing] = useState("")
  const [loadingBriefing, setLoadingBriefing] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  // ── Screener state ──
  const [assets,        setAssets]        = useState<AssetFlow[]>([])
  const [loadingAssets, setLoadingAssets] = useState(true)
  const [region,        setRegion]        = useState("all")
  const [sector,        setSector]        = useState("Tous")

  // ── Interactive state ──
  const [expandedIndicator, setExpandedIndicator] = useState<string | null>(null)
  const [activeChain,       setActiveChain]       = useState("inflation_taux")
  const [activeStep,        setActiveStep]        = useState(0)
  const [activeScenario,    setActiveScenario]    = useState("rate_cut")

  // ── Indicators (reactive to state) ──
  const indicators = useMemo((): Indicator[] => [
    {
      id: "inflation", label: "🔥 Inflation", value: "~3.2%", unit: "CPI annuel", status: "elevated",
      statusLabels: { low: "🟢 Très basse", normal: "🟢 Normale", elevated: "🟡 Élevée", high: "🔴 Très haute" },
      whatIsIt: "L'inflation mesure combien les prix augmentent chaque année.",
      whyItMatters: "Si l'inflation est trop haute, tout coûte plus cher — ta pizza, ton abonnement Netflix, l'essence. La banque centrale monte alors les taux pour freiner.",
      targetRange: "2% = objectif sain",
      impact: { positive: ["Matières premières", "Immobilier", "Or"], negative: ["Obligations", "Actions tech", "Cash"] },
    },
    {
      id: "rates", label: "💸 Taux Fed", value: `${fedRate.toFixed(2)}%`, unit: "Taux directeur",
      status: fedRate > 4 ? "high" : fedRate > 2 ? "elevated" : "normal",
      statusLabels: { low: "🟢 Très bas", normal: "🟢 Normaux", elevated: "🟡 Élevés", high: "🔴 Très élevés" },
      whatIsIt: "C'est le taux auquel les banques empruntent de l'argent à la banque centrale.",
      whyItMatters: "Quand ce taux monte, les crédits (voiture, maison, entreprise) coûtent plus cher. Ça refroidit l'économie et fait souvent baisser les marchés.",
      targetRange: "2-2.5% = neutre",
      impact: { positive: ["Banques", "Assurances", "Dollar US"], negative: ["Actions croissance", "Immobilier", "Obligations longues"] },
    },
    {
      id: "vix", label: "😨 Peur (VIX)", value: vix.toFixed(1), unit: "Indice de volatilité",
      status: vix > 30 ? "high" : vix > 20 ? "elevated" : "normal",
      statusLabels: { low: "🟢 Très calme", normal: "🟢 Calme", elevated: "🟡 Nerveux", high: "🔴 Panique" },
      whatIsIt: "Le VIX mesure à quel point les investisseurs ont peur que le marché chute.",
      whyItMatters: "VIX élevé = les gens ont peur = le marché peut être très volatil. C'est le 'baromètre de la peur'. Quand tout le monde panique, c'est parfois le moment d'acheter (Warren Buffett).",
      targetRange: "< 15 = calme, > 25 = panique",
      impact: { positive: ["Or", "Obligations d'État", "Dollar"], negative: ["Actions", "Crypto", "Actifs risqués"] },
    },
    {
      id: "yield_curve", label: "📉 Courbe des taux", value: `${yieldCurve >= 0 ? "+" : ""}${yieldCurve.toFixed(2)}%`, unit: "10 ans - 2 ans",
      status: yieldCurve < 0 ? "high" : yieldCurve < 0.5 ? "elevated" : "normal",
      statusLabels: { low: "🟢 Normale (pentue)", normal: "🟢 Normale", elevated: "🟡 Plate", high: "🔴 Inversée ⚠️" },
      whatIsIt: "La différence entre les taux des obligations à 10 ans et à 2 ans.",
      whyItMatters: "Quand les taux courts dépassent les taux longs (courbe inversée), c'est historiquement le signe le plus fiable d'une récession dans 12-18 mois. Précision : 7/7 récessions depuis 1970.",
      targetRange: "> 0 = normal, < 0 = alerte récession",
      impact: { positive: ["Or", "Obligations courtes", "Liquidités"], negative: ["Banques", "Actions cycliques"] },
    },
    {
      id: "dollar", label: "💵 Dollar (DXY)", value: `${dxyChange >= 0 ? "+" : ""}${dxyChange.toFixed(1)}%`, unit: "Indice dollar (1M)",
      status: dxyChange > 3 ? "high" : dxyChange > 1 ? "elevated" : "normal",
      statusLabels: { low: "🟢 Faible", normal: "🟢 Stable", elevated: "🟡 Fort", high: "🔴 Très fort" },
      whatIsIt: "Mesure la force du dollar américain par rapport aux autres grandes devises.",
      whyItMatters: "Dollar fort = exportations US moins compétitives + actifs internationaux perdent en valeur. Les cryptos et l'or baissent souvent quand le dollar monte.",
      targetRange: "Stable = idéal pour les marchés",
      impact: { positive: ["Obligations US", "Secteur financier US"], negative: ["Or", "Crypto", "Marchés émergents", "Matières premières"] },
    },
    {
      id: "gold", label: "🥇 Or", value: `${goldChange >= 0 ? "+" : ""}${goldChange.toFixed(1)}% (1M)`, unit: "Valeur refuge",
      status: goldChange > 5 ? "high" : goldChange > 0 ? "elevated" : "normal",
      statusLabels: { low: "⚪ Stable", normal: "🟡 En hausse", elevated: "🟡 Fort", high: "🔴 Refuge demandé" },
      whatIsIt: "L'or est la valeur refuge ultime depuis des millénaires.",
      whyItMatters: "Quand les gens ont peur (guerre, récession, inflation), ils achètent de l'or pour protéger leur argent. La hausse de l'or = signal d'inquiétude à long terme.",
      targetRange: "Monte en cas de crise ou d'inflation",
      impact: { positive: ["Minières aurifères", "ETF GLD"], negative: ["Dollar fort"] },
    },
  ], [vix, goldChange, yieldCurve, dxyChange]) // fedRate is a stable const, no need in deps

  // ── API calls ──

  const generateBriefingAuto = useCallback(async (
    snapshotData: SnapshotData,
    currentRegime: MacroRegime
  ) => {
    setLoadingBriefing(true)
    try {
      const res = await fetch("/api/macro/briefing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spyChange: snapshotData.spy?.change1d ?? 0,
          vix:       snapshotData.vix?.price    ?? 18,
          fedRate:   5.25,
          goldChange: snapshotData.gold?.change1d ?? 0,
          regime:    currentRegime,
        }),
      })
      const json = await res.json()
      if (json.briefing) setAiBriefing(json.briefing)
    } catch {}
    setLoadingBriefing(false)
  }, [])

  const fetchSnapshot = useCallback(async () => {
    try {
      const res  = await fetch("/api/macro/snapshot")
      const data: SnapshotData & { updatedAt?: string } = await res.json()

      setSpyData(data.spy ?? null)
      setVix(data.vix?.price ?? 18)
      setGoldChange(data.gold?.change1m ?? 0)
      setDxyChange(data.dxy?.change1m ?? 0)
      setYieldCurve(data.yieldCurve ?? 0.3)
      setLastUpdate(new Date())

      const r = computeMacroRegime({
        spyChange1m:       data.spy?.change1m ?? 0,
        vix:               data.vix?.price    ?? 18,
        yieldCurve:        data.yieldCurve    ?? 0.3,
        unemploymentTrend: "stable",
      })
      setRegime(r)
      generateBriefingAuto(data, r)
    } catch {}
  }, [generateBriefingAuto])

  const loadScreener = useCallback(async () => {
    setLoadingAssets(true)
    try {
      const res  = await fetch("/api/screener")
      const data = await res.json()
      const raw  = data.assets ?? data ?? []
      const enriched: AssetFlow[] = raw.map((a: AssetFlow & { volRatio?: number; category?: string }) => ({
        symbol:          a.symbol,
        name:            a.name,
        type:            (a.category ?? a.type ?? "stock") as AssetFlow["type"],
        region:          (a.region ?? (a.symbol.includes("USD") ? "crypto" : "us")) as AssetFlow["region"],
        sector:          a.sector ?? "Other",
        price:           a.price      ?? 0,
        change_1d:       a.change_1d  ?? 0,
        change_1w:       a.change_1w  ?? 0,
        change_1m:       a.change_1m  ?? 0,
        change_ytd:      a.change_ytd ?? 0,
        change_1y:       a.change_1y  ?? 0,
        volume:          a.volume     ?? 0,
        volume_ratio:    a.volume_ratio ?? a.volRatio ?? 1,
        market_cap:      a.market_cap,
        breadth:         50,
        phase:           computePhase(a),
        phase_score:     Math.max(0, Math.min(100, 50 + (a.change_1m ?? 0) * 2)),
        flow_strength:   computeFlowStrength(a.change_1d ?? 0, a.change_1w ?? 0, a.volume_ratio ?? a.volRatio ?? 1),
        sentiment_score: Math.max(-100, Math.min(100, (a.change_1d ?? 0) * 5 + (a.change_1w ?? 0) * 2)),
        sparkline:       (a as AssetFlow).sparkline ?? Array.from({ length: 30 }, (_v, i) => 100 + Math.sin(i * 0.3) * (a.change_1m ?? 0) * 0.5),
      }))
      setAssets(enriched)
    } catch {}
    setLoadingAssets(false)
  }, [])

  useEffect(() => {
    fetchSnapshot()
    const iv = setInterval(fetchSnapshot, 10 * 60 * 1000)
    return () => clearInterval(iv)
  }, [fetchSnapshot])

  useEffect(() => { loadScreener() }, [loadScreener])

  // ── Derived ──
  const filtered = useMemo(() => {
    return assets.filter(a => {
      if (region !== "all" && a.region !== region) return false
      if (sector !== "Tous" && a.sector !== sector) return false
      return true
    }).sort((a, b) => Math.abs(b.flow_strength) - Math.abs(a.flow_strength))
  }, [assets, region, sector])

  const activeChainData   = CAUSAL_CHAINS.find(c => c.id === activeChain)!
  const activeScenarioData = SCENARIOS.find(s => s.id === activeScenario)!

  const TABLE_REGIMES = ["reprise", "croissance_forte", "fin_de_cycle", "ralentissement"] as const
  type TableRegime = typeof TABLE_REGIMES[number]

  // ── RENDER ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen page-enter" style={{ background: "var(--bg-canvas)" }}>

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 1 — Snapshot macro "L'économie en clair"
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="px-6 py-8 border-b border-white/5">
        <div className="max-w-5xl mx-auto">

          {/* Header */}
          <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
            <div>
              <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold mb-1">
                📊 Analyses Macro
              </p>
              <h1 className="text-2xl font-black text-white">L&apos;économie en clair 🌍</h1>
              <p className="text-white/40 text-sm mt-1">
                {lastUpdate
                  ? `Mis à jour ${lastUpdate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`
                  : "Chargement des données…"}
              </p>
            </div>

            {/* Régime badge */}
            {regime ? (
              <div className="flex items-center gap-3 px-5 py-3.5 rounded-2xl flex-shrink-0"
                style={{ background: REGIME_CONFIG[regime].bg, border: `1px solid ${REGIME_CONFIG[regime].color}25` }}>
                <span className="text-3xl">{REGIME_CONFIG[regime].emoji}</span>
                <div>
                  <p className="text-[10px] text-white/35 uppercase tracking-widest mb-0.5">Régime actuel</p>
                  <p className="font-black text-white">{REGIME_CONFIG[regime].label}</p>
                  <p className="text-xs text-white/50">{REGIME_CONFIG[regime].desc}</p>
                </div>
              </div>
            ) : (
              <div className="h-16 w-48 rounded-2xl animate-pulse" style={{ background: "#111" }} />
            )}
          </div>

          {/* 4 status cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {[
              {
                label: "📈 Marchés (S&P 500)",
                value:  (spyData?.change1d ?? 0) >= 0 ? "En hausse" : "En baisse",
                number: `${(spyData?.change1d ?? 0) >= 0 ? "+" : ""}${(spyData?.change1d ?? 0).toFixed(1)}%`,
                status: (spyData?.change1d ?? 0) >= 0 ? "green" : "red",
                simple: (spyData?.change1d ?? 0) >= 0
                  ? "Les investisseurs sont optimistes aujourd'hui."
                  : "Les investisseurs sont prudents aujourd'hui.",
              },
              {
                label:  "😨 Peur du marché",
                value:  vix > 25 ? "Panique" : vix > 18 ? "Nerveux" : "Calme",
                number: `VIX ${vix.toFixed(1)}`,
                status: vix > 25 ? "red" : vix > 18 ? "orange" : "green",
                simple: vix > 25
                  ? "Les traders ont peur. Attends-toi à des marchés très volatils."
                  : vix > 18 ? "Un peu d'inquiétude mais pas de panique."
                  : "Personne n'a peur. Marchés stables.",
              },
              {
                label:  "💰 Taux d'intérêt",
                value:  fedRate > 4 ? "Élevés" : fedRate > 2 ? "Normaux" : "Bas",
                number: `${fedRate.toFixed(2)}%`,
                status: fedRate > 4 ? "red" : fedRate > 2 ? "yellow" : "green",
                simple: fedRate > 4
                  ? "Emprunter est cher. Ça freine les entreprises et les marchés."
                  : "Emprunter est abordable. Ça soutient la croissance.",
              },
              {
                label:  "🏅 Or",
                value:  goldChange >= 5 ? "En forte hausse" : goldChange >= 0 ? "Stable / hausse" : "En baisse",
                number: `${goldChange >= 0 ? "+" : ""}${goldChange.toFixed(1)}% (1M)`,
                status: goldChange >= 5 ? "yellow" : "neutral",
                simple: goldChange >= 5
                  ? "L'or monte = les gens cherchent un refuge. Signe d'inquiétude."
                  : "L'or est stable. Pas de panique particulière.",
              },
            ].map(card => {
              const sc = CARD_STATUS_COLORS[card.status]
              return (
                <div key={card.label}
                  className="rounded-2xl p-4 group cursor-default transition-all hover:scale-[1.02]"
                  style={{ background: sc.bg, border: `1px solid ${sc.border}` }}>
                  <p className="text-[10px] text-white/40 font-bold mb-2">{card.label}</p>
                  <p className="text-xl font-black mb-0.5" style={{ color: sc.color }}>{card.value}</p>
                  <p className="text-[11px] text-white/40 font-mono mb-2">{card.number}</p>
                  <p className="text-[10px] text-white/30 leading-relaxed group-hover:text-white/55 transition-colors">
                    {card.simple}
                  </p>
                </div>
              )
            })}
          </div>

          {/* AI Briefing */}
          <div className="rounded-2xl p-5"
            style={{ background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.15)" }}>
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <span className="text-lg">🤖</span>
              <p className="text-sm font-black text-white">Briefing IA du jour</p>
              <span className="text-[9px] text-purple-400/60 bg-purple-500/10 border border-purple-500/15 px-2 py-0.5 rounded-full font-bold">
                Généré par Groq
              </span>
              {!aiBriefing && !loadingBriefing && regime && (
                <button
                  onClick={() => generateBriefingAuto(
                    { spy: spyData, vix: { price: vix }, gold: { change1d: goldChange } },
                    regime
                  )}
                  className="ml-auto text-[10px] font-bold text-purple-400 hover:text-purple-300 transition">
                  Générer →
                </button>
              )}
            </div>
            {loadingBriefing ? (
              <div className="space-y-2">
                {[100, 80, 60].map(w => (
                  <div key={w} className="h-3 animate-pulse rounded"
                    style={{ background: "rgba(139,92,246,0.1)", width: `${w}%` }} />
                ))}
              </div>
            ) : aiBriefing ? (
              <p className="text-sm text-white/65 leading-relaxed">{aiBriefing}</p>
            ) : (
              <p className="text-sm text-white/30 italic">
                Le briefing se génère automatiquement au chargement. Clique sur &quot;Générer&quot; si rien n&apos;apparaît.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 2 — Cycle économique
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="px-6 py-8 border-b border-white/5">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <h2 className="text-xl font-black text-white">Où en sommes-nous ?</h2>
            <span className="text-sm text-white/30">Le cycle économique</span>
          </div>
          <p className="text-white/40 text-sm mb-7">
            L&apos;économie suit toujours un cycle — comme les saisons. Savoir où tu es = savoir quoi faire.
          </p>

          {/* Cycle track */}
          <div className="relative mt-5 mb-3">
            <div className="flex items-stretch gap-0 rounded-2xl overflow-hidden">
              {CYCLE_PHASES.map((phase, i) => {
                const isCurrent = phase.key === regime
                return (
                  <div key={phase.key} className="flex-1 relative transition-all"
                    style={{
                      background: isCurrent ? phase.bg : "rgba(255,255,255,0.02)",
                      border: `1px solid ${isCurrent ? phase.border : "rgba(255,255,255,0.05)"}`,
                      borderRight: i < CYCLE_PHASES.length - 1 ? "none" : undefined,
                    }}>
                    {isCurrent && (
                      <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full text-[8px] font-black text-black whitespace-nowrap z-10"
                        style={{ background: phase.color }}>
                        📍 MAINTENANT
                      </div>
                    )}
                    <div className="p-3 md:p-4">
                      <p className={`text-xs font-black mb-0.5 ${isCurrent ? "text-white" : "text-white/35"}`}>
                        {phase.label}
                      </p>
                      <p className="text-[10px] text-white/25 mb-2">{phase.sublabel}</p>
                      {isCurrent && (
                        <>
                          <p className="text-[11px] text-white/60 leading-relaxed mb-3">{phase.desc}</p>
                          <p className="text-[9px] text-white/30 uppercase tracking-widest mb-1.5">Actifs favorisés</p>
                          <div className="flex flex-wrap gap-1">
                            {phase.assets.map(a => (
                              <span key={a} className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
                                style={{ background: `${phase.color}15`, color: phase.color }}>
                                {a}
                              </span>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="flex items-center justify-between px-4 mt-2">
              <span className="text-[10px] text-white/15">← Récession</span>
              <div className="flex-1 mx-4 h-px border-t border-dashed border-white/8" />
              <span className="text-[10px] text-white/15">Expansion →</span>
            </div>
          </div>

          {regime && (
            <div className="mt-4 p-4 rounded-xl" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
              <p className="text-xs text-white/50 leading-relaxed">
                <span className="text-white font-bold">{REGIME_CONFIG[regime].emoji} En résumé :</span>{" "}
                {REGIME_CONFIG[regime].simple}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 3 — Indicateurs clés
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="px-6 py-8 border-b border-white/5">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-xl font-black text-white mb-2">Les indicateurs clés</h2>
          <p className="text-white/40 text-sm mb-6">
            Clique sur un indicateur pour comprendre ce que ça signifie pour toi.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {indicators.map(ind => {
              const sc         = STATUS_COLORS[ind.status]
              const isExpanded = expandedIndicator === ind.id

              return (
                <div key={ind.id}
                  className="rounded-2xl overflow-hidden cursor-pointer transition-all hover:scale-[1.01]"
                  style={{ background: "#0a0a0a", border: `1px solid ${isExpanded ? sc.border : "rgba(255,255,255,0.06)"}` }}
                  onClick={() => setExpandedIndicator(isExpanded ? null : ind.id)}>
                  <div className="p-5">
                    {/* Header row */}
                    <div className="flex items-start justify-between mb-3 gap-2">
                      <p className="text-sm font-black text-white">{ind.label}</p>
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full flex-shrink-0"
                        style={{ background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>
                        {ind.statusLabels[ind.status] ?? ind.status}
                      </span>
                    </div>

                    {/* Value */}
                    <div className="flex items-baseline gap-2 mb-1">
                      <p className="text-2xl font-black tabular-nums" style={{ color: sc.color }}>{ind.value}</p>
                      <p className="text-[10px] text-white/30">{ind.unit}</p>
                    </div>
                    <p className="text-[10px] text-white/30 mb-3">{ind.targetRange}</p>

                    {/* Simple explanation always visible */}
                    <p className="text-[11px] text-white/50 leading-relaxed">{ind.whatIsIt}</p>

                    {/* Expanded content */}
                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t border-white/5 space-y-4">
                        <div>
                          <p className="text-[9px] text-white/25 uppercase tracking-widest mb-1.5">
                            💡 Pourquoi c&apos;est important pour toi ?
                          </p>
                          <p className="text-[11px] text-white/60 leading-relaxed">{ind.whyItMatters}</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-white/25 uppercase tracking-widest mb-1.5">📈 Bénéficie à</p>
                          <div className="flex flex-wrap gap-1">
                            {ind.impact.positive.map(a => (
                              <span key={a} className="text-[9px] px-1.5 py-0.5 rounded-full"
                                style={{ background: "rgba(34,197,94,0.1)", color: "#4ade80" }}>
                                ↑ {a}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="text-[9px] text-white/25 uppercase tracking-widest mb-1.5">📉 Pèse sur</p>
                          <div className="flex flex-wrap gap-1">
                            {ind.impact.negative.map(a => (
                              <span key={a} className="text-[9px] px-1.5 py-0.5 rounded-full"
                                style={{ background: "rgba(239,68,68,0.1)", color: "#f87171" }}>
                                ↓ {a}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    <p className="text-[9px] text-white/20 mt-3 text-right">
                      {isExpanded ? "▲ Moins d&apos;info" : "▼ Pourquoi c&apos;est important ?"}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 4 — Pourquoi les marchés bougent
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="px-6 py-8 border-b border-white/5">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-xl font-black text-white mb-2">Pourquoi les marchés bougent ?</h2>
          <p className="text-white/40 text-sm mb-6">
            Chaque événement macro déclenche une chaîne de réactions. Clique pour explorer.
          </p>

          {/* Scenario selector */}
          <div className="flex gap-2 flex-wrap mb-6">
            {CAUSAL_CHAINS.map(c => (
              <button key={c.id}
                onClick={() => { setActiveChain(c.id); setActiveStep(0) }}
                className="px-4 py-2.5 rounded-xl text-sm font-bold transition-all"
                style={{
                  background: activeChain === c.id ? `${c.color}15` : "rgba(255,255,255,0.04)",
                  border:     `1px solid ${activeChain === c.id ? `${c.color}30` : "rgba(255,255,255,0.07)"}`,
                  color:      activeChain === c.id ? "#fff" : "rgba(255,255,255,0.4)",
                  transform:  activeChain === c.id ? "scale(1.02)" : "scale(1)",
                }}>
                {c.trigger}
              </button>
            ))}
          </div>

          {/* Causal chain steps */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {activeChainData.steps.map((step, i) => (
              <button key={i}
                onClick={() => setActiveStep(i)}
                className="text-left rounded-2xl p-4 transition-all"
                style={{
                  background: activeStep === i ? `${activeChainData.color}10` : "rgba(255,255,255,0.02)",
                  border:     `1px solid ${activeStep === i ? `${activeChainData.color}25` : "rgba(255,255,255,0.06)"}`,
                  transform:  activeStep === i ? "scale(1.02)" : "scale(1)",
                }}>
                <div className="text-2xl mb-2">{step.icon}</div>
                <p className={`text-xs font-black mb-1.5 ${activeStep === i ? "text-white" : "text-white/50"}`}>
                  {i + 1}. {step.title}
                </p>
                <p className="text-[10px] text-white/35 leading-relaxed">{step.desc}</p>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 5 — Impact sur tes investissements
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="px-6 py-8 border-b border-white/5">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-xl font-black text-white mb-2">
            Comment positionner ton portfolio ?
          </h2>
          <p className="text-white/40 text-sm mb-1">
            Selon le régime actuel :{" "}
            {regime && (
              <span className="text-white font-bold">{REGIME_CONFIG[regime].emoji} {REGIME_CONFIG[regime].label}</span>
            )}
          </p>
          <p className="text-[11px] text-yellow-400/70 mb-6">
            ⚠️ Éducatif uniquement — données historiques, pas de conseils financiers. Tradex = paper trading.
          </p>

          {/* Performance table */}
          <div className="rounded-2xl overflow-hidden mb-4" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
            {/* Header */}
            <div className="grid border-b border-white/5 overflow-x-auto"
              style={{ background: "rgba(255,255,255,0.02)", gridTemplateColumns: "1.5fr 1fr 1fr 1fr 1fr" }}>
              <div className="px-4 py-3 text-[10px] text-white/30 font-bold uppercase tracking-wider">Actif</div>
              {TABLE_REGIMES.map(r => (
                <div key={r} className={`px-3 py-3 text-center text-[10px] font-bold ${r === regime ? "text-white" : "text-white/25"}`}>
                  {REGIME_CONFIG[r].emoji} {REGIME_CONFIG[r].label.split(" ")[0]}
                  {r === regime && <div className="text-[8px] text-green-400">← Actuel</div>}
                </div>
              ))}
            </div>

            {IMPACT_ROWS.map(row => (
              <div key={row.asset}
                className="border-t border-white/[0.04] hover:bg-white/[0.01] transition"
                style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr 1fr" }}>
                <div className="px-4 py-3">
                  <p className="text-xs font-semibold text-white/70">{row.asset}</p>
                  <p className="text-[9px] text-white/30">{row.tooltip}</p>
                </div>
                {TABLE_REGIMES.map(r => (
                  <div key={r}
                    className={`px-3 py-3 text-center text-sm ${r === regime ? "bg-white/[0.02]" : ""}`}>
                    {row.values[r as TableRegime]}
                  </div>
                ))}
              </div>
            ))}
          </div>

          <p className="text-[10px] text-white/20 text-center">
            ⭐ = Performances historiques · Plus d&apos;étoiles = meilleure performance dans ce régime · Passé ≠ futur
          </p>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 6 — Simulateur de scénarios
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="px-6 py-8 border-b border-white/5">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-xl font-black text-white mb-2">🎮 Simulateur de scénarios</h2>
          <p className="text-white/40 text-sm mb-6">
            Explore ce qui se passe historiquement dans chaque scénario. Données des 50 dernières années.
          </p>

          {/* Scenario cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {SCENARIOS.map(s => (
              <button key={s.id}
                onClick={() => setActiveScenario(s.id)}
                className="p-4 rounded-2xl text-left transition-all"
                style={{
                  background: activeScenario === s.id ? "rgba(34,197,94,0.08)" : "rgba(255,255,255,0.03)",
                  border:     `1px solid ${activeScenario === s.id ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.07)"}`,
                  transform:  activeScenario === s.id ? "scale(1.02)" : "scale(1)",
                }}>
                <span className="text-2xl block mb-2">{s.icon}</span>
                <p className={`text-[11px] font-bold leading-tight ${activeScenario === s.id ? "text-white" : "text-white/50"}`}>
                  {s.title}
                </p>
                <p className="text-[10px] text-white/30 mt-1">Proba. : {s.probability}</p>
              </button>
            ))}
          </div>

          {/* Effects table */}
          <div className="rounded-2xl overflow-hidden"
            style={{ background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="px-5 py-4 border-b border-white/5">
              <p className="text-sm font-black text-white">{activeScenarioData.icon} {activeScenarioData.title}</p>
              <p className="text-[10px] text-white/30">Proba. estimée : {activeScenarioData.probability} · Données historiques 50 ans</p>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {activeScenarioData.effects.map((effect, i) => (
                <div key={i} className="flex items-center gap-4 px-5 py-3.5">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm flex-shrink-0"
                    style={{ background: effect.impact === "positive" ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)" }}>
                    {effect.impact === "positive" ? "📈" : "📉"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white">{effect.asset}</p>
                    <p className="text-[11px] text-white/40 truncate">{effect.desc}</p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    {[1, 2, 3].map(n => (
                      <div key={n} className="w-2 h-5 rounded-full"
                        style={{
                          background: n <= effect.magnitude
                            ? effect.impact === "positive" ? "#22c55e" : "#ef4444"
                            : "rgba(255,255,255,0.06)",
                        }} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="text-[10px] text-white/20 mt-3 text-center">
            Résultats basés sur données historiques — ne constituent pas des prévisions.
          </p>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 7 — Screener Heatmap
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="px-6 py-8">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-xl font-black text-white mb-2">📊 Où va l&apos;argent en ce moment ?</h2>
          <p className="text-white/40 text-sm mb-6">
            Chaque carré = un actif. <span className="text-green-400/70">Vert</span> = l&apos;argent rentre.{" "}
            <span className="text-red-400/70">Rouge</span> = l&apos;argent sort. Grande taille = grande capitalisation.
          </p>

          {/* Filters */}
          <div className="flex flex-wrap gap-2 items-center mb-6">
            <div className="flex gap-1 flex-wrap">
              {REGIONS.map(r => (
                <button key={r.key} onClick={() => setRegion(r.key)}
                  className={`h-8 px-3 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                    region === r.key
                      ? "bg-white/10 text-white border border-white/15"
                      : "text-white/30 hover:text-white/60 border border-transparent"
                  }`}>
                  {r.label}
                </button>
              ))}
            </div>
            <div className="overflow-x-auto scrollbar-hide">
              <div className="flex gap-1">
                {SECTORS.map(s => (
                  <button key={s} onClick={() => setSector(s)}
                    className={`flex-shrink-0 h-8 px-3 rounded-lg text-[11px] font-bold transition-all ${
                      sector === s ? "bg-white/10 text-white border border-white/15" : "text-white/25 hover:text-white/50"
                    }`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={loadScreener} disabled={loadingAssets}
              className="ml-auto flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white/40 hover:text-white border border-white/8 hover:border-white/16 transition disabled:opacity-40">
              ↻ {loadingAssets ? "Chargement..." : "Actualiser"}
            </button>
          </div>

          {/* Heatmap */}
          {loadingAssets ? (
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
              {[...Array(24)].map((_, i) => (
                <div key={i} className="h-16 rounded-2xl animate-pulse" style={{ background: "#0a0a0a" }} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-white/30">Aucun actif ne correspond aux filtres</div>
          ) : (
            Object.entries(
              filtered.reduce((acc, a) => {
                const sec = a.sector ?? "Autre"
                if (!acc[sec]) acc[sec] = []
                acc[sec].push(a)
                return acc
              }, {} as Record<string, AssetFlow[]>)
            ).map(([sectorName, sectorAssets]) => (
              <div key={sectorName} className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">{sectorName}</p>
                  <div className="flex-1 h-px bg-white/5" />
                  {(() => {
                    const avg = sectorAssets.reduce((s, a) => s + a.flow_strength, 0) / sectorAssets.length
                    return (
                      <span className="text-[10px] font-bold"
                        style={{ color: avg > 10 ? "#4ade80" : avg < -10 ? "#f87171" : "#9ca3af" }}>
                        {avg > 10 ? "▲ Inflow" : avg < -10 ? "▼ Outflow" : "→ Neutre"} {Math.abs(avg).toFixed(0)}
                      </span>
                    )
                  })()}
                </div>
                <div className="flex flex-wrap gap-2">
                  {sectorAssets.map(asset => {
                    const phaseConfig = PHASE_CONFIG[asset.phase]
                    const size = Math.max(70, Math.min(150, (asset.market_cap ?? asset.volume / 1e6) / 1e9 * 8 + 70))
                    return (
                      <button key={asset.symbol}
                        onClick={() => router.push(`/dashboard?symbol=${asset.symbol}`)}
                        className="rounded-2xl p-3 transition-all hover:scale-105 text-left relative overflow-hidden"
                        style={{ background: phaseConfig.bg, border: `1px solid ${phaseConfig.color}30`, width: size, minHeight: size * 0.75 }}>
                        <p className="text-xs font-black text-white truncate">{asset.symbol.replace("-USD", "")}</p>
                        <p className={`text-[11px] font-bold ${asset.change_1d >= 0 ? "text-green-400" : "text-red-400"}`}>
                          {asset.change_1d >= 0 ? "+" : ""}{asset.change_1d.toFixed(1)}%
                        </p>
                        <p className="text-[8px] font-bold mt-1 truncate" style={{ color: phaseConfig.color }}>{phaseConfig.label}</p>
                        <div className="absolute top-2 right-2 text-[10px] text-white/50">
                          {asset.flow_strength > 15 ? "↑" : asset.flow_strength < -15 ? "↓" : "→"}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </section>

    </div>
  )
}
