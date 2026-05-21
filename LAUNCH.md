# FinanceApp — Launch Checklist

## Technique

- [ ] `npm run build` — zéro erreur TypeScript
- [ ] Zéro `console.log` / `console.error` de debug en production
- [ ] Bundle size < 500KB (vérifié via Vercel analytics)
- [ ] First Contentful Paint < 2s
- [ ] Toutes les env vars configurées sur Vercel :
  - [ ] `NEXT_PUBLIC_SUPABASE_URL`
  - [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - [ ] `SUPABASE_SERVICE_KEY`
  - [ ] `GROQ_API_KEY`
  - [ ] `STRIPE_SECRET_KEY`
  - [ ] `STRIPE_WEBHOOK_SECRET`
  - [ ] `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
  - [ ] `RESEND_API_KEY`
  - [ ] `CRON_SECRET`
  - [ ] `NEXT_PUBLIC_APP_URL`

## Supabase

- [ ] RLS actives sur TOUTES les tables
- [ ] Email confirmation désactivée ou redirect configuré
- [ ] Site URL configurée (pas localhost)
- [ ] Redirect URLs autorisées
- [ ] Backups activés
- [ ] Tables créées : profiles, user_profiles, paper_accounts, positions, orders, alerts, signals, user_progress, forum_posts, forum_replies, ai_analyses, chat_history, user_achievements, social_follows, public_trades, weekly_challenges, challenge_completions, performance_snapshots, report_cache, referrals, push_subscriptions

## Stripe

- [ ] Passer en mode Production (dashboard.stripe.com)
- [ ] Products & prices créés en mode production
- [ ] Webhook endpoint configuré : `https://votre-domaine.com/api/stripe/webhook`
- [ ] Webhook secret configuré dans les env vars
- [ ] Test de paiement complet effectué

## Emails (Resend)

- [ ] Domaine d'envoi vérifié (DNS MX/SPF/DKIM)
- [ ] From address : `hello@financeapp.io`
- [ ] Test email de bienvenue envoyé
- [ ] Test alerte prix envoyée

## Cron Jobs (Vercel Cron)

Configurer dans `vercel.json` :
```json
{
  "crons": [
    { "path": "/api/cron/signals", "schedule": "*/15 * * * *" },
    { "path": "/api/cron/alerts", "schedule": "*/5 * * * *" },
    { "path": "/api/cron/snapshot", "schedule": "0 22 * * *" },
    { "path": "/api/cron/market-summary", "schedule": "0 8 * * 1-5" },
    { "path": "/api/reports/weekly-email", "schedule": "0 8 * * 1" },
    { "path": "/api/cron/emails", "schedule": "0 10 * * *" }
  ]
}
```

- [ ] Variable `CRON_SECRET` configurée
- [ ] Tous les endpoints testés manuellement avec le bon header Authorization

## Domaine et SSL

- [ ] Domaine custom configuré sur Vercel
- [ ] SSL/TLS actif (automatique avec Vercel)
- [ ] Redirections www → apex (ou inverse) configurées
- [ ] DNS propagé (vérifier avec [dnschecker.org](https://dnschecker.org))

## Analytics et Monitoring

- [ ] Vercel Analytics actif (déjà dans le code)
- [ ] Vercel Speed Insights actif (déjà dans le code)
- [ ] Page de statut accessible : `/status`

## Produit — Flux critiques testés

- [ ] Signup → Email (auto-confirm) → Onboarding → Dashboard
- [ ] Login → Dashboard → Watchlist ajout
- [ ] Dashboard → Buy → Portfolio mis à jour
- [ ] Dashboard → Alerte créée → Déclenchée → Email reçu
- [ ] Signaux → Signal → Trader depuis signal
- [ ] Analyses → Screener → Actif sélectionné
- [ ] Apprendre → Cours → Quiz → Badge débloqué
- [ ] Forum → Post créé → Réponse ajoutée
- [ ] Coach IA → Analyse basée sur trades réels
- [ ] Rapports → PDF exporté → CSV téléchargé
- [ ] Social → Follow trader → Feed mis à jour
- [ ] Pricing → Stripe → Plan mis à jour en DB

## SEO et Légal

- [ ] Meta tags et OG images sur toutes les pages importantes
- [ ] robots.txt configuré (déjà présent)
- [ ] sitemap.xml généré (déjà présent)
- [ ] Politique de confidentialité publiée : `/legal/privacy`
- [ ] CGU publiées : `/legal/terms`
- [ ] Politique cookies publiée : `/legal/cookies`
- [ ] Banner cookie RGPD actif
- [ ] Disclaimer "paper trading uniquement" visible

## Business

- [ ] Support email actif : support@financeapp.io
- [ ] Politique de remboursement rédigée
- [ ] Plans et pricing corrects

## Marketing Launch

- [ ] Landing page optimisée et relue
- [ ] Post de lancement Product Hunt rédigé
- [ ] Screenshots et vidéo démo prêtes
- [ ] Tweet/post de lancement rédigé

---

*Généré automatiquement le 18 mai 2026*
