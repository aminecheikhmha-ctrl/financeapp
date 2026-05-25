// @ts-nocheck
// Install @sentry/nextjs first: npm install @sentry/nextjs
// Then run: npx @sentry/wizard@latest -i nextjs

import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  replaysSessionSampleRate: 0.05,
  replaysOnErrorSampleRate: 1.0,
  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
  beforeSend(event: any) {
    if (event.exception?.values?.[0]?.type === "ChunkLoadError") return null
    return event
  },
  ignoreErrors: [
    "ResizeObserver loop limit exceeded",
    "Non-Error exception captured",
    "ChunkLoadError",
  ],
})
