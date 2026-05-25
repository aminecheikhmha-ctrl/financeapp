type LogLevel = "info" | "warn" | "error" | "debug"

interface LogEntry {
  level: LogLevel
  message: string
  data?: Record<string, any>
  userId?: string
  route?: string
  duration?: number
}

// Dynamic Sentry — optional, only active after @sentry/nextjs is installed
function captureToSentry(message: string, data?: Record<string, any>, userId?: string) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Sentry = require("@sentry/nextjs")
    Sentry.captureMessage(message, {
      level: "error",
      extra: data,
      user: userId ? { id: userId } : undefined,
    })
  } catch {}
}

export function log(entry: LogEntry) {
  const timestamp = new Date().toISOString()
  const prefix = { info: "ℹ️", warn: "⚠️", error: "🔴", debug: "🔵" }[entry.level]

  if (entry.level === "error") {
    console.error(`${prefix} [${timestamp}]`, entry.message, entry.data ?? "")
    captureToSentry(entry.message, entry.data, entry.userId)
  } else if (entry.level === "warn") {
    console.warn(`${prefix} [${timestamp}]`, entry.message, entry.data ?? "")
  } else if (process.env.NODE_ENV !== "production" || entry.level === "info") {
    console.log(`${prefix} [${timestamp}]`, entry.message, entry.data ?? "")
  }

  return { timestamp, level: entry.level, message: entry.message, ...entry.data, userId: entry.userId, route: entry.route, duration: entry.duration }
}

export function createTimer() {
  const start = Date.now()
  return { end: () => Date.now() - start }
}

export function withLogging(
  handler: (req: Request) => Promise<Response>,
  routeName: string
) {
  return async (req: Request) => {
    const timer = createTimer()
    const url   = new URL(req.url)

    try {
      const response = await handler(req)
      const duration = timer.end()

      if (duration > 3000) {
        log({ level: "warn", message: "Slow route detected", route: routeName, duration, data: { url: url.pathname, status: response.status } })
      }

      return response
    } catch (error: any) {
      const duration = timer.end()
      log({ level: "error", message: `Route error: ${routeName}`, route: routeName, duration, data: { url: url.pathname, error: error.message, stack: error.stack?.slice(0, 200) } })
      throw error
    }
  }
}
