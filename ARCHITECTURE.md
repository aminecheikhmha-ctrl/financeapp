# TradEx — Architecture

## Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js (App Router) | 16.2.6 |
| UI | React | 19.2.4 |
| Styling | Tailwind CSS | v4 |
| Database / Auth | Supabase (`@supabase/supabase-js`) | 2.x |
| Payments | Stripe (`stripe`, `@stripe/stripe-js`) | 22.x / 9.x |
| AI | Groq SDK (`groq-sdk`) | 1.x |
| Email | Resend | 6.x |
| Charts | Recharts, Lightweight Charts | 3.x / 4.x |
| PDF export | jsPDF + html2canvas | 4.x / 1.x |
| Animations | canvas-confetti | 1.x |
| Analytics | Vercel Analytics + Speed Insights | 2.x |
| Language | TypeScript | 5.x |
| Linting | ESLint | 9.x |

---

## Folder Structure

```
tradex/
├── app/                        # Next.js App Router root
│   ├── (home)/                 # Landing / marketing page
│   ├── admin/                  # Admin panel (protected)
│   ├── analyses/               # Screener + market analysis page
│   ├── api/                    # All API route handlers
│   │   ├── achievements/       # Badge / achievement logic
│   │   ├── ai/                 # AI endpoints (market-regime, coach…)
│   │   ├── ai-analysis/        # AI analysis generation
│   │   ├── alerts/             # Price alert CRUD
│   │   ├── alpaca/             # Alpaca broker integration
│   │   ├── analyse/            # Per-asset analysis
│   │   ├── analytics/          # Internal analytics events
│   │   ├── auth/               # Auth helpers
│   │   ├── backtest/           # Strategy backtesting
│   │   ├── challenges/         # Weekly challenges
│   │   ├── chart/              # OHLCV chart data
│   │   ├── course-content/     # Academy lesson content
│   │   ├── cron/               # Scheduled jobs (signals, alerts, snapshot, market-summary, emails)
│   │   ├── emails/             # Transactional email triggers
│   │   ├── forum/              # Forum posts & replies
│   │   ├── leaderboard/        # Social leaderboard
│   │   ├── market-summary/     # Daily market summary
│   │   ├── price/              # Real-time price fetch (Yahoo Finance)
│   │   ├── push/               # Web push notifications
│   │   ├── quote/              # Quote endpoint
│   │   ├── referral/           # Referral system
│   │   ├── reports/            # Report generation + weekly email
│   │   ├── screener/           # Asset screener
│   │   ├── search/             # Symbol search
│   │   ├── signals/            # Trading signals
│   │   ├── signaux/            # Signals (FR alias)
│   │   ├── social/             # Follow / feed
│   │   ├── stripe/             # checkout + webhook
│   │   ├── trading/            # Paper trading orders
│   │   ├── tutoring/           # AI tutoring
│   │   └── user-profile/       # User profile CRUD
│   ├── apprendre/              # Academy (courses & quizzes)
│   ├── auth/                   # Auth callback route
│   ├── coach/                  # AI coach page
│   ├── components/             # Shared React components
│   ├── dashboard/              # Main trading dashboard
│   ├── forum/                  # Forum pages
│   ├── legal/                  # Privacy, ToS, cookies
│   ├── login/                  # Login page
│   ├── onboarding/             # Onboarding flow
│   ├── portfolio/              # Portfolio page
│   ├── preuves/                # Trade proofs / history
│   ├── pricing/                # Pricing page
│   ├── profil/                 # User profile page
│   ├── reports/                # Reports page
│   ├── signaux/                # Signals page
│   ├── signup/                 # Signup page
│   ├── social/                 # Social feed
│   ├── status/                 # Service status page (public)
│   ├── traders/                # Trader profiles
│   ├── globals.css             # Global styles
│   ├── layout.tsx              # Root layout
│   ├── loading.tsx             # Global loading UI
│   ├── error.tsx               # Global error boundary
│   ├── not-found.tsx           # 404 page
│   ├── robots.ts               # robots.txt generation
│   └── sitemap.ts              # sitemap.xml generation
├── lib/                        # Shared utilities
│   ├── supabase.ts             # Supabase client singleton
│   ├── plans.ts                # Plan definitions & feature gates
│   ├── achievements.ts         # Achievement logic
│   ├── alpaca.ts               # Alpaca SDK wrapper
│   ├── courses.ts              # Academy course data
│   ├── indicateurs.ts          # Technical indicator helpers
│   ├── resend.ts               # Email client wrapper
│   ├── ab-test.ts              # A/B testing utility
│   └── i18n/
│       └── fr.ts               # French string constants
├── public/                     # Static assets
├── ARCHITECTURE.md             # This file
├── LAUNCH.md                   # Pre-launch checklist
├── package.json
├── tsconfig.json
└── next.config.ts
```

---

## Environment Variables

| Variable | Used by | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `lib/supabase.ts` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `lib/supabase.ts` | Supabase anonymous/public key |
| `SUPABASE_SERVICE_KEY` | API routes (server-side) | Supabase service-role key (bypasses RLS) |
| `GROQ_API_KEY` | `app/api/ai/*` | Groq LLM API key |
| `STRIPE_SECRET_KEY` | `app/api/stripe/*` | Stripe server-side secret key |
| `STRIPE_WEBHOOK_SECRET` | `app/api/stripe/webhook` | Stripe webhook signing secret |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Client-side Stripe.js | Stripe publishable key |
| `RESEND_API_KEY` | `lib/resend.ts` | Resend email API key |
| `CRON_SECRET` | `app/api/cron/*` | Bearer token to authenticate cron calls |
| `NEXT_PUBLIC_APP_URL` | Emails, OG images, redirects | Canonical app URL (e.g. `https://tradex.io`) |

---

## Database Tables (Supabase)

| Table | Description |
|---|---|
| `profiles` | Basic user info (linked to `auth.users`) |
| `user_profiles` | Extended profile (bio, avatar, plan, settings) |
| `paper_accounts` | Paper trading account balances |
| `positions` | Open paper trading positions |
| `orders` | Paper trading order history |
| `alerts` | Price alerts per user |
| `signals` | Generated trading signals |
| `user_progress` | Academy lesson progress |
| `forum_posts` | Forum thread posts |
| `forum_replies` | Forum replies |
| `ai_analyses` | Cached AI analysis results |
| `chat_history` | AI coach conversation history |
| `user_achievements` | Earned badges per user |
| `social_follows` | Follow relationships between users |
| `public_trades` | Trades shared publicly on the social feed |
| `weekly_challenges` | Weekly trading challenge definitions |
| `challenge_completions` | User completions of weekly challenges |
| `performance_snapshots` | Daily portfolio snapshots (for charting) |
| `report_cache` | Cached generated reports |
| `referrals` | Referral tracking |
| `push_subscriptions` | Web push subscription objects |

All tables should have Row Level Security (RLS) enabled.

---

## API Routes

| Route | Method | Auth | Description |
|---|---|---|---|
| `/api/price` | GET | None | Fetch live price for a symbol (Yahoo Finance) |
| `/api/quote` | GET | None | Extended quote data |
| `/api/search` | GET | None | Symbol search |
| `/api/chart` | GET | None | OHLCV chart data |
| `/api/screener` | GET | Optional | Asset screener with scores |
| `/api/signals` | GET | Optional | List active trading signals |
| `/api/signaux` | GET | Optional | Signals (FR alias) |
| `/api/market-summary` | GET | None | Daily market summary |
| `/api/analyse` | GET | Auth | Per-asset deep analysis |
| `/api/ai-analysis` | POST | Auth | Generate AI analysis |
| `/api/ai/market-regime` | GET | Auth | Market regime detection (Groq) |
| `/api/tutoring` | POST | Auth | AI tutoring chat |
| `/api/user-profile` | GET/PUT | Auth | Read/update user profile |
| `/api/trading` | POST | Auth | Execute paper trade |
| `/api/alerts` | GET/POST/DELETE | Auth | Price alert management |
| `/api/achievements` | GET | Auth | User achievements |
| `/api/forum` | GET/POST | Auth | Forum posts |
| `/api/forum/[id]` | GET/POST | Auth | Forum thread + replies |
| `/api/leaderboard` | GET | Auth | Social leaderboard |
| `/api/social` | GET/POST | Auth | Follow / feed |
| `/api/referral` | GET/POST | Auth | Referral system |
| `/api/reports` | GET | Auth | Report generation |
| `/api/reports/weekly-email` | POST | Cron | Weekly report email blast |
| `/api/backtest` | POST | Auth | Strategy backtesting |
| `/api/course-content` | GET | Auth | Academy lesson content |
| `/api/challenges` | GET/POST | Auth | Weekly challenges |
| `/api/analytics` | POST | Auth | Internal analytics events |
| `/api/push` | POST | Auth | Web push subscription |
| `/api/emails/welcome` | POST | Internal | Send welcome email |
| `/api/alpaca` | GET/POST | Auth | Alpaca broker integration |
| `/api/stripe/checkout` | POST | Auth | Create Stripe checkout session |
| `/api/stripe/webhook` | POST | Stripe sig | Handle Stripe webhook events |
| `/api/auth` | GET | None | Auth callback handler |
| `/api/cron/signals` | GET | Cron | Generate new trading signals |
| `/api/cron/alerts` | GET | Cron | Check and trigger price alerts |
| `/api/cron/snapshot` | GET | Cron | Save daily portfolio snapshots |
| `/api/cron/market-summary` | GET | Cron | Generate daily market summary |
| `/api/cron/emails` | GET | Cron | Send scheduled emails |

Cron routes are protected by `Authorization: Bearer <CRON_SECRET>` header.

---

## Cron Jobs

| Endpoint | Schedule | Description |
|---|---|---|
| `/api/cron/signals` | Every 15 minutes (`*/15 * * * *`) | Generate trading signals from technical analysis |
| `/api/cron/alerts` | Every 5 minutes (`*/5 * * * *`) | Check price alerts and send notifications |
| `/api/cron/snapshot` | Daily at 22:00 UTC (`0 22 * * *`) | Save end-of-day portfolio snapshots |
| `/api/cron/market-summary` | Weekdays at 08:00 UTC (`0 8 * * 1-5`) | Generate morning market summary |
| `/api/reports/weekly-email` | Mondays at 08:00 UTC (`0 8 * * 1`) | Send weekly performance email to users |
| `/api/cron/emails` | Daily at 10:00 UTC (`0 10 * * *`) | Send scheduled/drip email campaigns |

All cron jobs are configured in `vercel.json` and authenticated via `CRON_SECRET`.

---

## Auth Flow

1. **Signup** — User submits email + password on `/signup`. A call to `supabase.auth.signUp()` creates the user in `auth.users`. Supabase sends an email confirmation (if enabled).
2. **Email confirmation** — Supabase redirects to `/auth?token=…`. The `/api/auth` route (or Supabase's built-in callback) exchanges the token for a session.
3. **Onboarding** — First-time users are redirected to `/onboarding` to complete their profile (stored in `user_profiles`).
4. **Login** — `supabase.auth.signInWithPassword()` on `/login`. On success, Supabase sets an HTTP-only cookie with the session.
5. **Session persistence** — `@supabase/supabase-js` handles token refresh automatically. Server components read the session from cookies via the service-role client or `createServerClient`.
6. **Protected routes** — API routes call `supabase.auth.getUser()` and return 401 if no valid session. Client pages use `useEffect` + `supabase.auth.getSession()` and redirect to `/login`.
7. **Plan gating** — The `lib/plans.ts` module maps plan tiers (free / pro / premium) to feature flags. Routes and components check `user_profiles.plan` before granting access.
8. **Logout** — `supabase.auth.signOut()` clears the session cookie and redirects to `/`.
