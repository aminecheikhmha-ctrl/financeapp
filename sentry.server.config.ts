// @ts-nocheck
// Install @sentry/nextjs first: npm install @sentry/nextjs

import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  beforeSend(event: any) {
    if (event.level === "fatal" || event.level === "error") {
      console.error("[Sentry]", event.exception?.values?.[0]?.value)
    }
    return event
  },
})
