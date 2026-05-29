import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"

// ─── Types ─────────────────────────────────────────────────────────────────────

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
  is_breaking?: boolean
  sentiment_score?: number
  category?: "crypto" | "macro" | "earnings" | "reddit" | "general"
  theme?: string
  description?: string
}

// ─── In-memory cache (10 min) ──────────────────────────────────────────────────

const cache = new Map<string, { data: { articles: NewsArticle[]; last_updated: string }; ts: number }>()
const CACHE_TTL = 10 * 60 * 1000

// ─── RSS Source list ───────────────────────────────────────────────────────────

type RSSSource = { url: string; source: string; symbol?: string }

const GENERAL_SOURCES: RSSSource[] = [
  // Finance
  { url: "https://feeds.reuters.com/reuters/businessNews",                         source: "Reuters" },
  { url: "https://www.marketwatch.com/rss/topstories",                             source: "MarketWatch" },
  { url: "https://www.cnbc.com/id/10000664/device/rss/rss.html",                   source: "CNBC" },
  { url: "https://www.cnbc.com/id/19854910/device/rss/rss.html",                   source: "CNBC Markets" },
  { url: "https://www.cnbc.com/id/100727362/device/rss/rss.html",                  source: "CNBC Tech" },
  { url: "https://feeds.a.dj.com/rss/RSSMarketsMain.xml",                          source: "WSJ Markets" },
  { url: "https://feeds.content.dowjones.io/public/rss/mw_topstories",             source: "MarketWatch" },
  { url: "https://feeds.finance.yahoo.com/rss/2.0/headline?region=US&lang=en-US", source: "Yahoo Finance" },
  { url: "https://finance.yahoo.com/news/rssindex",                                source: "Yahoo Finance News" },

  // Crypto
  { url: "https://cointelegraph.com/rss",         source: "CoinTelegraph" },
  { url: "https://coindesk.com/feed",              source: "CoinDesk" },
  { url: "https://decrypt.co/feed",               source: "Decrypt" },
  { url: "https://beincrypto.com/feed/",          source: "BeInCrypto" },

  // Tech & IA
  { url: "https://feeds.feedburner.com/TechCrunch",  source: "TechCrunch" },
  { url: "https://www.theverge.com/rss/index.xml",   source: "The Verge" },

  // Macro
  { url: "https://www.economist.com/finance-and-economics/rss.xml", source: "The Economist" },
]

// Yahoo Finance per-symbol feeds
const SYMBOL_FEEDS = [
  "AAPL","NVDA","TSLA","MSFT","GOOGL","AMZN","META","JPM","V","MA",
  "AMD","NFLX","COIN","PLTR","SPY","QQQ","GLD","USO","BTC-USD","ETH-USD",
]

// ─── Theme detection ───────────────────────────────────────────────────────────

const THEME_KEYWORDS: Record<string, string[]> = {
  crypto:      ["bitcoin","ethereum","crypto","blockchain","defi","nft","btc","eth","solana","binance","coinbase","web3","altcoin","xrp","ripple"],
  macro:       ["fed","federal reserve","inflation","cpi","rate","ecb","recession","gdp","fomc","treasury","yields","powell","lagarde","nfp","unemployment"],
  tech:        ["ai","artificial intelligence","nvidia","openai","chatgpt","apple","microsoft","google","meta","semiconductor","chip","chatbot","llm"],
  energy:      ["oil","crude","opec","natural gas","energy","petroleum","lng","renewable","solar","wind","bp","shell","exxon"],
  commodities: ["gold","silver","copper","wheat","corn","commodity","futures","lithium","nickel"],
  earnings:    ["earnings","revenue","profit","eps","guidance","quarter","results","beat","miss","outlook","forecast"],
  geopolitique:["war","conflict","sanctions","tariff","trade","china","russia","ukraine","middle east","geopolitical","nato","israel","iran"],
  ipo:         ["ipo","merger","acquisition","deal","takeover","listing","spac","buyout","m&a"],
  forex:       ["dollar","euro","yen","sterling","currency","exchange rate","dxy","forex","pound","cad"],
  regulation:  ["sec","regulation","compliance","fine","lawsuit","investigation","cftc","fdic","dodd","ftc","antitrust"],
  dividends:   ["dividend","yield","payout","shareholder","buyback","distribution"],
  reddit:      ["reddit","wallstreetbets","wsb","short squeeze","meme stock","retail trader"],
  stocks:      ["s&p","nasdaq","dow","equity","wall street","market","shares","stock market","rally","correction"],
}

function detectTheme(title: string, description = ""): string {
  const text = (title + " " + description).toLowerCase()
  for (const [theme, keywords] of Object.entries(THEME_KEYWORDS)) {
    if (keywords.some(kw => text.includes(kw))) return theme
  }
  return "stocks"
}

// ─── Company → Ticker mapping ──────────────────────────────────────────────────

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
  "ExxonMobil": "XOM", "Chevron": "CVX", "OpenAI": "MSFT", "ChatGPT": "MSFT",
  "Pfizer": "PFE", "Johnson": "JNJ", "UnitedHealth": "UNH",
  "Walmart": "WMT", "Target": "TGT", "Home Depot": "HD", "Nike": "NKE",
  "McDonald": "MCD", "Coca-Cola": "KO", "PepsiCo": "PEP",
  "S&P 500": "SPY", "Nasdaq": "QQQ", "Dow Jones": "DIA", "VIX": "^VIX",
  "gold": "GLD", "oil": "USO", "bonds": "TLT", "dollar": "DXY",
  "Coinbase": "COIN", "Ripple": "XRP-USD", "Dogecoin": "DOGE-USD",
  "Blackrock": "BLK", "Shopify": "SHOP", "Cloudflare": "NET",
}

const TICKER_BLOCKLIST = new Set([
  "A","I","IT","AT","BY","OR","NO","US","UK","EU","OF","IN","IS",
  "BE","DO","SO","TO","UP","AI","AR","AS","IF","ON","PM","AM","TV",
  "IP","PR","VP","Q1","Q2","Q3","Q4","CEO","CFO","GDP","IPO","ETF","OTC","SEC","FDA","FTC",
])

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

// ─── Breaking detection ────────────────────────────────────────────────────────

const BREAKING_KEYWORDS = [
  "crash","bankrupt","bankruptcy","halt","emergency","SEC charges","FDA approval",
  "merger","acquisition","earnings beat","earnings miss","rate hike","rate cut",
  "recession","default","investigation","layoffs","collapse","breaking","urgent",
  "just in","alert","developing","war","attack","ban","sanction",
]

function detectBreaking(title: string): boolean {
  const lc = title.toLowerCase()
  return BREAKING_KEYWORDS.some(kw => lc.includes(kw.toLowerCase()))
}

// ─── Sentiment scoring ─────────────────────────────────────────────────────────

const POS_WORDS = ["surge","rally","gain","beat","record","high","growth","bull","profit","strong","soar","jump","boost","outperform","upgrade","breakout","buy","rise"]
const NEG_WORDS = ["fall","drop","miss","crash","bear","loss","weak","decline","cut","plunge","slump","downgrade","warning","investigation","layoffs","bankrupt","collapse","sell"]

function computeSentiment(title: string): number {
  const t = title.toLowerCase()
  let score = 0
  POS_WORDS.forEach(w => { if (t.includes(w)) score += 15 })
  NEG_WORDS.forEach(w => { if (t.includes(w)) score -= 15 })
  return Math.max(-100, Math.min(100, score))
}

// ─── Importance scoring ────────────────────────────────────────────────────────

const PREMIUM_SOURCES = ["reuters","bloomberg","cnbc","wsj","ft","marketwatch","financial times","economist","seeking alpha"]
const BREAKING_SCORE_WORDS = [
  "breaking","just in","urgent","crash","surge","record","emergency","fed","rate cut",
  "rate hike","ban","sec","fda","merger","acquisition","earnings beat","earnings miss","bankruptcy",
]

function scoreArticle(article: NewsArticle): number {
  let score = 0
  const title    = (article.title ?? "").toLowerCase()
  const hoursOld = (Date.now() - new Date(article.published_at).getTime()) / 3_600_000

  score += Math.max(0, 100 - hoursOld * 8)
  BREAKING_SCORE_WORDS.forEach(w => { if (title.includes(w)) score += 20 })
  if (PREMIUM_SOURCES.some(s => (article.source ?? "").toLowerCase().includes(s))) score += 25
  if (Math.abs(article.sentiment_score ?? 0) > 50) score += 15
  if (article.is_breaking) score += 40

  return Math.max(0, score)
}

// ─── RSS parser ────────────────────────────────────────────────────────────────

function parseRSSXML(xml: string, source: string, symbol?: string): NewsArticle[] {
  const items = xml.match(/<item[\s\S]*?<\/item>/gi) ?? []
  return items.slice(0, 8).map(item => {
    const cdata = (tag: string) =>
      item.match(new RegExp(`<${tag}><\\!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, "i"))?.[1] ?? ""
    const plain = (tag: string) =>
      item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"))?.[1] ?? ""

    const title = (cdata("title") || plain("title"))
      .trim()
      .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/<[^>]+>/g, "")

    const link = (plain("link") || plain("guid")).trim()

    const pubDateRaw = plain("pubDate") || plain("published") || plain("updated")
    const published_at = pubDateRaw ? new Date(pubDateRaw).toISOString() : new Date().toISOString()

    const description = (cdata("description") || plain("description"))
      .replace(/<[^>]+>/g, "").trim().slice(0, 200)

    return {
      title,
      description,
      source: source.replace("Yahoo:", "Yahoo Finance"),
      url: link,
      published_at,
      ...(symbol ? { tickers: [symbol] } : {}),
    } as NewsArticle
  }).filter(a => a.title.length > 12 && a.url.length > 8)
}

async function fetchRSSSource(src: RSSSource): Promise<NewsArticle[]> {
  try {
    const res = await fetch(src.url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Tradex/1.0)",
        "Accept": "application/rss+xml, application/xml, text/xml, */*",
      },
      signal: AbortSignal.timeout(4000),
    })
    if (!res.ok) return []
    return parseRSSXML(await res.text(), src.source, src.symbol)
  } catch {
    return []
  }
}

// ─── Deduplicate ───────────────────────────────────────────────────────────────

function deduplicate(articles: NewsArticle[]): NewsArticle[] {
  const seen = new Set<string>()
  return articles.filter(a => {
    if (!a.title) return false
    const key = a.title.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 45)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// ─── Enrich articles ───────────────────────────────────────────────────────────

function enrichArticle(article: NewsArticle): NewsArticle {
  const tickers = article.tickers?.length ? article.tickers : extractTickers(article.title)
  const is_breaking = detectBreaking(article.title)
  const sentiment_score = computeSentiment(article.title)
  const theme = detectTheme(article.title, article.description ?? "")
  const category = (
    theme === "crypto" ? "crypto" :
    theme === "macro"  ? "macro"  :
    theme === "earnings" ? "earnings" : "general"
  ) as NewsArticle["category"]

  return { ...article, tickers, is_breaking, breaking: is_breaking, sentiment_score, theme, category }
}

// ─── AI summaries via Groq ─────────────────────────────────────────────────────

async function enrichWithAISummaries(articles: NewsArticle[]): Promise<void> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey || articles.length === 0) return
  try {
    const { default: Groq } = await import("groq-sdk")
    const groq = new Groq({ apiKey })
    const top = articles.slice(0, 15)
    const list = top.map((a, i) => `${i}. ${a.title}`).join("\n")
    const chat = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      max_tokens: 600,
      temperature: 0.15,
      messages: [{
        role: "user",
        content: `Pour chaque titre de news financière, génère un résumé en français de 8 mots max.\nRetourne UNIQUEMENT ce JSON (pas de markdown) : [{"i":0,"s":"résumé"},...]\nTitres:\n${list}`,
      }],
    })
    const text = chat.choices[0]?.message?.content?.trim() ?? ""
    const json = text.replace(/^```json?\s*/i, "").replace(/```\s*$/i, "").trim()
    const summaries: { i: number; s: string }[] = JSON.parse(json)
    if (Array.isArray(summaries)) {
      for (const { i, s } of summaries) {
        if (articles[i]) articles[i].ai_summary = s
      }
    }
  } catch {}
}

// ─── Route ─────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const params   = new URL(req.url).searchParams
  const symbol   = params.get("symbol") ?? "AAPL"
  const limit    = Math.min(200, parseInt(params.get("limit") ?? "100"))

  // Cache hit
  const cacheKey = `news_${symbol}`
  const hit = cache.get(cacheKey)
  if (hit && Date.now() - hit.ts < CACHE_TTL) {
    return NextResponse.json(hit.data)
  }

  // ── General news (all sources) ────────────────────────────────────────────────
  if (symbol === "general") {
    // Fetch all general + symbol-specific in parallel batches
    const symbolSources: RSSSource[] = SYMBOL_FEEDS.map(sym => ({
      url: `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(sym)}&region=US&lang=en-US`,
      source: "Yahoo Finance",
      symbol: sym,
    }))

    const allSources = [...GENERAL_SOURCES, ...symbolSources]
    const BATCH = 10
    const rawArticles: NewsArticle[] = []

    for (let i = 0; i < allSources.length; i += BATCH) {
      const batch = allSources.slice(i, i + BATCH)
      const results = await Promise.allSettled(batch.map(fetchRSSSource))
      for (const r of results) {
        if (r.status === "fulfilled") rawArticles.push(...r.value)
      }
    }

    const deduped  = deduplicate(rawArticles)
    const enriched = deduped.map(enrichArticle)
    enriched.sort((a, b) => scoreArticle(b) - scoreArticle(a))
    const final = enriched.slice(0, limit)

    await enrichWithAISummaries(final)

    const data = { articles: final, last_updated: new Date().toISOString() }
    cache.set(cacheKey, { data, ts: Date.now() })
    return NextResponse.json(data)
  }

  // ── Symbol-specific news ──────────────────────────────────────────────────────
  const clean = symbol.replace("-USD", "")
  const symbolSources: RSSSource[] = [
    { url: `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(symbol)}&region=US&lang=en-US`, source: "Yahoo Finance" },
    ...GENERAL_SOURCES.slice(0, 6),
  ]

  const rawArticles: NewsArticle[] = []
  const results = await Promise.allSettled(symbolSources.map(fetchRSSSource))
  for (const r of results) {
    if (r.status === "fulfilled") rawArticles.push(...r.value)
  }

  // Optionally try Finnhub if key set
  const finnhubKey = process.env.FINNHUB_API_KEY
  if (finnhubKey) {
    try {
      const from = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10)
      const to   = new Date().toISOString().slice(0, 10)
      const res  = await fetch(
        `https://finnhub.io/api/v1/company-news?symbol=${clean}&from=${from}&to=${to}&token=${finnhubKey}`,
        { signal: AbortSignal.timeout(5000) }
      )
      if (res.ok) {
        const data = await res.json()
        ;(Array.isArray(data) ? data : []).slice(0, 8).forEach((item: { headline?: string; url?: string; datetime?: number }) => {
          if (item.headline && item.url) {
            rawArticles.push({
              title: item.headline,
              source: "Finnhub",
              url: item.url,
              published_at: item.datetime ? new Date(item.datetime * 1000).toISOString() : new Date().toISOString(),
            })
          }
        })
      }
    } catch {}
  }

  // Filter general sources by symbol mention
  const filtered = rawArticles.filter(a => {
    if (symbol === "SPY" || symbol === "QQQ" || symbol === "GLD") return true
    const lc = a.title.toLowerCase()
    return lc.includes(clean.toLowerCase())
  })

  const deduped  = deduplicate(filtered.length >= 5 ? filtered : rawArticles)
  const enriched = deduped.map(enrichArticle)
  enriched.sort((a, b) => scoreArticle(b) - scoreArticle(a))
  const final = enriched.slice(0, limit)

  await enrichWithAISummaries(final)

  const data = { articles: final, last_updated: new Date().toISOString() }
  cache.set(cacheKey, { data, ts: Date.now() })
  return NextResponse.json(data)
}
