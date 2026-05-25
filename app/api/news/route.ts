import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"

export type NewsArticle = {
  title: string
  source: string
  url: string
  published_at: string
  reddit_score?: number
  reddit_comments?: number
  tickers?: string[]
  ai_summary?: string
  breaking?: boolean
  sentiment_score?: number
  category?: "crypto" | "macro" | "earnings" | "reddit" | "general"
}

// ── In-memory cache (10 min) ──────────────────────────────────────────────────
const cache = new Map<string, { data: { articles: NewsArticle[]; last_updated: string }; ts: number }>()
const CACHE_TTL = 10 * 60 * 1000

// ── Name → Ticker mapping ─────────────────────────────────────────────────────
const NAME_TO_TICKER: Record<string, string> = {
  "Apple": "AAPL", "Microsoft": "MSFT", "NVIDIA": "NVDA", "Tesla": "TSLA",
  "Amazon": "AMZN", "Meta": "META", "Alphabet": "GOOGL", "Google": "GOOGL",
  "Bitcoin": "BTC-USD", "Ethereum": "ETH-USD", "Solana": "SOL-USD",
  "Federal Reserve": "TLT", "Fed ": "TLT", "inflation": "GLD",
  "JPMorgan": "JPM", "Berkshire": "BRK-B", "Visa": "V", "Mastercard": "MA",
  "Salesforce": "CRM", "Netflix": "NFLX", "Disney": "DIS", "Uber": "UBER",
  "Airbnb": "ABNB", "Palantir": "PLTR", "AMD": "AMD", "Intel": "INTC",
  "Qualcomm": "QCOM", "Broadcom": "AVGO", "Bank of America": "BAC",
  "Goldman": "GS", "Morgan Stanley": "MS", "Citigroup": "C", "Wells Fargo": "WFC",
  "ExxonMobil": "XOM", "Chevron": "CVX", "ConocoPhillips": "COP",
  "Pfizer": "PFE", "Moderna": "MRNA", "Johnson": "JNJ", "UnitedHealth": "UNH",
  "Walmart": "WMT", "Target": "TGT", "Home Depot": "HD", "Nike": "NKE",
  "Starbucks": "SBUX", "McDonald": "MCD", "Coca-Cola": "KO", "PepsiCo": "PEP",
  "S&P 500": "SPY", "Nasdaq": "QQQ", "Dow Jones": "DIA", "VIX": "^VIX",
  "gold": "GLD", "oil": "USO", "bonds": "TLT", "dollar": "DXY",
  "Ripple": "XRP-USD", "Dogecoin": "DOGE-USD", "Cardano": "ADA-USD",
}

const TICKER_BLOCKLIST = new Set([
  "A", "I", "IT", "AT", "BY", "OR", "NO", "US", "UK", "EU", "OF", "IN", "IS",
  "BE", "DO", "SO", "TO", "UP", "AI", "AR", "AS", "IF", "ON", "PM", "AM", "TV",
  "IP", "PR", "VP", "Q1", "Q2", "Q3", "Q4", "CEO", "CFO", "GDP", "IPO", "ETF",
  "OTC", "SEC", "FDA", "FTC",
])

const BREAKING_KEYWORDS = [
  "crash", "bankrupt", "bankruptcy", "halt", "emergency", "SEC charges",
  "FDA approval", "merger", "acquisition", "earnings beat", "earnings miss",
  "rate hike", "rate cut", "recession", "default", "investigation", "layoffs", "collapse",
]

function extractTickers(text: string): string[] {
  const found = new Set<string>()
  for (const [name, ticker] of Object.entries(NAME_TO_TICKER)) {
    if (text.includes(name)) found.add(ticker)
  }
  const matches = text.match(/\b[A-Z]{2,5}\b/g) ?? []
  for (const m of matches) {
    if (!TICKER_BLOCKLIST.has(m)) found.add(m)
  }
  return [...found].slice(0, 5)
}

function detectBreaking(title: string): boolean {
  const lc = title.toLowerCase()
  return BREAKING_KEYWORDS.some(kw => lc.includes(kw.toLowerCase()))
}

function detectCategory(article: NewsArticle): "crypto" | "macro" | "earnings" | "reddit" | "general" {
  if (article.source.includes("Reddit")) return "reddit"
  const lc = article.title.toLowerCase()
  if (lc.includes("bitcoin") || lc.includes("crypto") || lc.includes("ethereum") || lc.includes("btc")) return "crypto"
  if (lc.includes("fed") || lc.includes("inflation") || lc.includes("gdp") || lc.includes("rate") || lc.includes("treasury")) return "macro"
  if (lc.includes("earning") || lc.includes("eps") || lc.includes("revenue") || lc.includes("quarter")) return "earnings"
  return "general"
}

// ── Yahoo Finance RSS ─────────────────────────────────────────────────────────
async function fetchYahooRSS(symbol: string): Promise<NewsArticle[]> {
  const clean = symbol.replace("-USD", "").replace("-", "")
  const url = `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${clean}&region=US&lang=en-US`
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(6000),
    })
    if (!res.ok) return []
    const xml = await res.text()
    const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? []
    return items.slice(0, 10).map(item => {
      const title = (item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) ?? item.match(/<title>(.*?)<\/title>/))?.[1] ?? ""
      const link  = (item.match(/<link>(.*?)<\/link>/))?.[1] ?? ""
      const pubDate = (item.match(/<pubDate>(.*?)<\/pubDate>/))?.[1] ?? ""
      return {
        title: title.trim(),
        source: "Yahoo Finance",
        url: link.trim(),
        published_at: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
      }
    }).filter(a => a.title.length > 5)
  } catch {
    return []
  }
}

// ── Reuters RSS ───────────────────────────────────────────────────────────────
async function fetchReutersRSS(): Promise<NewsArticle[]> {
  try {
    const res = await fetch(
      "https://feeds.reuters.com/reuters/businessNews",
      { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(5000) }
    )
    if (!res.ok) return []
    const xml = await res.text()
    const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? []
    return items.slice(0, 5).map(item => {
      const title = (item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) ?? item.match(/<title>(.*?)<\/title>/))?.[1] ?? ""
      const link  = (item.match(/<link>(.*?)<\/link>/))?.[1] ?? ""
      const pubDate = (item.match(/<pubDate>(.*?)<\/pubDate>/))?.[1] ?? ""
      return {
        title: title.trim(),
        source: "Reuters",
        url: link.trim(),
        published_at: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
      }
    }).filter(a => a.title.length > 5)
  } catch {
    return []
  }
}

// ── MarketWatch RSS ───────────────────────────────────────────────────────────
async function fetchMarketWatchRSS(): Promise<NewsArticle[]> {
  try {
    const res = await fetch(
      "https://feeds.content.dowjones.io/public/rss/mw_topstories",
      { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(5000) }
    )
    if (!res.ok) return []
    const xml = await res.text()
    const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? []
    return items.slice(0, 5).map(item => {
      const title = (item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) ?? item.match(/<title>(.*?)<\/title>/))?.[1] ?? ""
      const link  = (item.match(/<link>(.*?)<\/link>/))?.[1] ?? ""
      const pubDate = (item.match(/<pubDate>(.*?)<\/pubDate>/))?.[1] ?? ""
      return {
        title: title.trim(),
        source: "MarketWatch",
        url: link.trim(),
        published_at: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
      }
    }).filter(a => a.title.length > 5)
  } catch {
    return []
  }
}

// ── CNBC RSS ──────────────────────────────────────────────────────────────────
async function fetchCNBCRSS(): Promise<NewsArticle[]> {
  try {
    const res = await fetch(
      "https://www.cnbc.com/id/10000664/device/rss/rss.html",
      { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(5000) }
    )
    if (!res.ok) return []
    const xml = await res.text()
    const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? []
    return items.slice(0, 5).map(item => {
      const title = (item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) ?? item.match(/<title>(.*?)<\/title>/))?.[1] ?? ""
      const link  = (item.match(/<link>(.*?)<\/link>/))?.[1] ?? ""
      const pubDate = (item.match(/<pubDate>(.*?)<\/pubDate>/))?.[1] ?? ""
      return {
        title: title.trim(),
        source: "CNBC",
        url: link.trim(),
        published_at: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
      }
    }).filter(a => a.title.length > 5)
  } catch {
    return []
  }
}

// ── Finnhub (optional — requires FINNHUB_API_KEY) ─────────────────────────────
async function fetchFinnhub(symbol: string): Promise<NewsArticle[]> {
  const key = process.env.FINNHUB_API_KEY
  if (!key) return []
  const clean = symbol.replace("-USD", "")
  const from  = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  const to    = new Date().toISOString().split("T")[0]
  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/company-news?symbol=${clean}&from=${from}&to=${to}&token=${key}`,
      { signal: AbortSignal.timeout(5000) }
    )
    if (!res.ok) return []
    const data = await res.json()
    return (Array.isArray(data) ? data : []).slice(0, 8).map((item: { headline?: string; url?: string; datetime?: number }) => ({
      title: item.headline ?? "",
      source: "Finnhub",
      url: item.url ?? "",
      published_at: item.datetime ? new Date(item.datetime * 1000).toISOString() : new Date().toISOString(),
    })).filter((a: NewsArticle) => a.title.length > 5)
  } catch {
    return []
  }
}

// ── Reddit ────────────────────────────────────────────────────────────────────
const REDDIT_SUBS = ["wallstreetbets", "investing", "stocks", "CryptoCurrency"]

async function fetchReddit(symbol: string): Promise<NewsArticle[]> {
  const clean  = symbol.replace("-USD", "").toUpperCase()
  const results: NewsArticle[] = []

  for (const sub of REDDIT_SUBS.slice(0, 2)) {
    try {
      const res = await fetch(
        `https://www.reddit.com/r/${sub}/search.json?q=${encodeURIComponent(clean)}&sort=hot&limit=10&t=week&restrict_sr=1`,
        {
          headers: { "User-Agent": "TradEx/1.0" },
          signal: AbortSignal.timeout(5000),
        }
      )
      if (!res.ok) continue
      const data = await res.json()
      const posts = data?.data?.children ?? []
      for (const post of posts) {
        const p = post.data
        const titleLower = (p.title ?? "").toLowerCase()
        if (!titleLower.includes(clean.toLowerCase())) continue
        results.push({
          title: p.title ?? "",
          source: `Reddit r/${sub}`,
          url: `https://reddit.com${p.permalink}`,
          published_at: new Date((p.created_utc ?? Date.now() / 1000) * 1000).toISOString(),
          reddit_score: p.score ?? 0,
          reddit_comments: p.num_comments ?? 0,
        })
      }
    } catch {
      continue
    }
  }
  return results.slice(0, 8)
}

// ── Deduplicate by similar title ──────────────────────────────────────────────
function deduplicate(articles: NewsArticle[]): NewsArticle[] {
  const seen = new Set<string>()
  return articles.filter(a => {
    if (!a.title) return false
    const key = a.title.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 40)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// ── AI Summaries via Groq ─────────────────────────────────────────────────────
async function enrichWithAISummaries(articles: NewsArticle[]): Promise<void> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey || articles.length === 0) return
  try {
    const { default: Groq } = await import("groq-sdk")
    const groq = new Groq({ apiKey })
    const top5 = articles.slice(0, 5)
    const titleList = top5.map((a, i) => `${i}. ${a.title}`).join("\n")
    const chat = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      max_tokens: 300,
      temperature: 0.2,
      messages: [
        {
          role: "user",
          content: `Pour chaque titre de news financière (numéroté), génère un résumé en français de 8 mots maximum. Retourne UNIQUEMENT ce JSON (pas de markdown, pas de backticks) :\n[{"i":0,"s":"résumé"},...]\nTitres:\n${titleList}`,
        },
      ],
    })
    const text = chat.choices[0]?.message?.content?.trim() ?? ""
    const jsonStr = text.replace(/^```json?\s*/i, "").replace(/```\s*$/i, "").trim()
    const summaries: Array<{ i: number; s: string }> = JSON.parse(jsonStr)
    if (Array.isArray(summaries)) {
      for (const { i, s } of summaries) {
        if (articles[i]) articles[i].ai_summary = s
      }
    }
  } catch {
    // silently skip
  }
}

// ── Route ─────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const symbol = new URL(req.url).searchParams.get("symbol") ?? "AAPL"
  const limit  = parseInt(new URL(req.url).searchParams.get("limit") ?? "20")

  const cached = cache.get(symbol)
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json(cached.data)
  }

  // Support for general news (no specific symbol)
  if (symbol === "general") {
    const cachedGeneral = cache.get("general")
    if (cachedGeneral && Date.now() - cachedGeneral.ts < CACHE_TTL) {
      return NextResponse.json(cachedGeneral.data)
    }
    const [reuters, marketwatch, cnbc] = await Promise.all([
      fetchReutersRSS(), fetchMarketWatchRSS(), fetchCNBCRSS(),
    ])
    let generalAll = deduplicate([...reuters, ...marketwatch, ...cnbc])
      .sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime())
      .slice(0, limit)
    generalAll = generalAll.map(article => ({
      ...article,
      tickers: extractTickers(article.title),
      breaking: detectBreaking(article.title),
      category: detectCategory(article),
    }))
    await enrichWithAISummaries(generalAll)
    const generalResult = { articles: generalAll, last_updated: new Date().toISOString() }
    cache.set("general", { data: generalResult, ts: Date.now() })
    return NextResponse.json(generalResult)
  }

  const [yahoo, finnhub, reddit, reuters, marketwatch, cnbc] = await Promise.all([
    fetchYahooRSS(symbol),
    fetchFinnhub(symbol),
    fetchReddit(symbol),
    fetchReutersRSS(),
    fetchMarketWatchRSS(),
    fetchCNBCRSS(),
  ])

  // Combine; for non-symbol sources, filter by symbol presence if not "general"
  const generalNews = [...reuters, ...marketwatch, ...cnbc].filter(a => {
    if (symbol === "SPY" || symbol === "QQQ") return true
    const lc = a.title.toLowerCase()
    const symLower = symbol.replace("-USD", "").toLowerCase()
    return lc.includes(symLower)
  })

  let all = deduplicate([...yahoo, ...finnhub, ...reddit, ...generalNews])
    .sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime())
    .slice(0, limit)

  // Enrich with tickers, breaking, category
  all = all.map(article => ({
    ...article,
    tickers: extractTickers(article.title),
    breaking: detectBreaking(article.title),
    category: detectCategory(article),
  }))

  // AI summaries for first 5
  await enrichWithAISummaries(all)

  const result = { articles: all, last_updated: new Date().toISOString() }
  cache.set(symbol, { data: result, ts: Date.now() })
  return NextResponse.json(result)
}
