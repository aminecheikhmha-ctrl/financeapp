# TradEx — Trading IA

> Plateforme de trading intelligent avec l'IA — signaux temps réel, paper trading, académie interactive.

**Live** : https://tradex-kappa-six.vercel.app

## Stack

| Couche | Technologie |
|--------|------------|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS v4 |
| Backend | API Routes Next.js (60+ routes) |
| Base de données | Supabase (PostgreSQL + Auth + RLS) |
| IA | Groq (`llama-3.3-70b-versatile`) |
| Data marché | Yahoo Finance API (gratuit) |
| Paiements | Stripe |
| Emails | Resend |
| Mobile | Capacitor 8 (iOS + Android) |
| PWA | Service Worker, Web Push Notifications |
| Analytics | Vercel Analytics + Speed Insights |

## Démarrage rapide

```bash
git clone https://github.com/aminecheikhmha-ctrl/financeapp.git
cd financeapp
cp .env.example .env.local
# Remplis les variables dans .env.local
npm install
npm run dev
```

## Scripts

```bash
npm run dev           # Dev local (http://localhost:3000)
npm run build         # Build production
npm run build:mobile  # Sync Capacitor (iOS/Android)
npm run ios           # Ouvre Xcode
npm run android       # Ouvre Android Studio
npm run lint          # ESLint
```

## Architecture

```
app/
├── (home)/          Landing page marketing
├── dashboard/       Graphes TradingView + paper trading
├── signaux/         Signaux IA live (confluence, TP/SL)
├── analyses/        Terminal : Screener · Heatmap · Scanner IA · Backtest
├── portfolio/       Positions + P&L + statistiques
├── apprendre/       Académie + flashcards + glossaire
├── news/            Actualités + sentiment IA
├── forum/           Communauté (posts + replies)
├── social/          Social trading + leaderboard
├── coach/           Coach IA (Groq chat)
├── blog/            Blog SEO généré par IA
├── profil/          Profil + achievements + streaks
├── admin/           Dashboard admin
├── offline/         Page hors ligne (PWA)
└── api/             60+ routes API
    ├── screener/    Screening algorithmique Yahoo Finance
    ├── signals/     Signaux techniques temps réel
    ├── backtest/    Backtesting de stratégies
    ├── coach/       Endpoint Groq coaching
    ├── health/      Health check services
    └── ...
```

## Variables d'environnement

Voir [`.env.example`](.env.example) pour la liste complète.

Variables **obligatoires** :
- `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` + `SUPABASE_SERVICE_KEY`
- `GROQ_API_KEY`
- `CRON_SECRET`

## Déploiement Vercel

```bash
vercel deploy --prod
```

Secrets GitHub à configurer (pour les GitHub Actions) :
- `APP_URL` — URL de production
- `CRON_SECRET` — même valeur que dans les env Vercel

## PWA

L'app est une PWA complète :
- Service Worker avec stratégies de cache (static/dynamic/API)
- Web Push Notifications
- Banner d'installation automatique
- Mode hors ligne (`/offline`)
- Background sync des ordres

## Mobile (Capacitor)

```bash
npm run build:mobile   # Compile Next.js + sync Capacitor
npm run ios            # Ouvre dans Xcode → Archive → TestFlight
npm run android        # Ouvre dans Android Studio → Generate APK/AAB
```
