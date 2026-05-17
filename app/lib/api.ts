// CORS headers pour toutes les routes API
export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": process.env.NEXT_PUBLIC_APP_URL || "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

// Helper pour réponses JSON avec CORS
export function jsonResponse(data: unknown, init?: ResponseInit) {
  return Response.json(data, {
    ...init,
    headers: { ...CORS_HEADERS, ...(init?.headers ?? {}) },
  })
}

// Yahoo Finance fetch avec timeout et fallback
export async function fetchYahoo(symbol: string, params = "interval=1d&range=1mo"): Promise<any> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?${params}`,
      { headers: { "User-Agent": "Mozilla/5.0" }, signal: controller.signal }
    )
    clearTimeout(timeout)
    if (!res.ok) throw new Error(`Yahoo ${res.status}`)
    return await res.json()
  } catch {
    clearTimeout(timeout)
    // Fallback to query2
    try {
      const res2 = await fetch(
        `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?${params}`,
        { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(8000) }
      )
      if (!res2.ok) return null
      return await res2.json()
    } catch {
      return null
    }
  }
}

// Groq call avec timeout 10s
export async function groqWithTimeout<T>(promise: Promise<T>, fallback: T): Promise<T> {
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error("Groq timeout")), 10000)
      ),
    ])
  } catch {
    return fallback
  }
}
