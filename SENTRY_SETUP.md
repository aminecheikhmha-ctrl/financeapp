# Setup Sentry pour TradEx

## 1. Installer le package
```bash
npm install @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

## 2. Créer un compte Sentry
- Va sur sentry.io
- Crée un projet "Next.js"
- Copie le DSN

## 3. Variables d'environnement Vercel
```
NEXT_PUBLIC_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
SENTRY_AUTH_TOKEN=xxx  # Dans Sentry → Settings → Auth Tokens
SENTRY_ORG=ton-org
SENTRY_PROJECT=tradex
```

## 4. Déployer
- Ajoute les env vars dans Vercel Dashboard
- Redéploie → les erreurs apparaîtront dans Sentry

## 5. Tester
```ts
// Dans n'importe quelle page temporairement :
throw new Error("Test Sentry")
```
