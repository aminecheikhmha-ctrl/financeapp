# FinanceApp — Production Checklist

## ✅ Technique
- [ ] `npm run build` → 0 erreur TypeScript
- [ ] `npm run lint` → 0 warning
- [ ] Bundle size < 500kb (vérifier avec `ANALYZE=1 npm run build`)
- [ ] Sentry configuré et testé (voir SENTRY_SETUP.md)
- [ ] Rate limiting actif sur toutes les routes API
- [ ] Variables d'environnement toutes configurées sur Vercel
- [ ] GitHub Actions actifs (crons + weekly-report)

## ✅ Auth & Sécurité
- [ ] Confirmation email configurée dans Supabase
- [ ] Google OAuth configuré
- [ ] RLS activé sur toutes les tables Supabase
- [ ] Headers de sécurité actifs (X-Frame-Options, X-XSS-Protection, etc.)
- [ ] Mot de passe oublié fonctionnel

## ✅ Produit
- [ ] Mode démo fonctionnel (visiteurs non connectés)
- [ ] Signaux IA chargent < 3 secondes
- [ ] Paper trading fonctionnel (achat, vente, TP/SL)
- [ ] Alertes de prix fonctionnelles
- [ ] Académie — progression sauvegardée
- [ ] Watchlist — persistence localStorage
- [ ] Compare — graphe base 100 fonctionnel
- [ ] Notifications push testées

## ✅ Business
- [ ] Stripe en mode LIVE (pas test)
- [ ] Webhook Stripe configuré et testé
- [ ] Emails Resend configurés (bienvenue, upgrade, rapport hebdo)
- [ ] Rapport hebdomadaire cron actif (Lundi 7h UTC)
- [ ] Admin dashboard accessible

## ✅ SEO & Marketing
- [ ] Sitemap.xml accessible
- [ ] Robots.txt configuré
- [ ] Meta tags sur toutes les pages publiques
- [ ] OG images générées dynamiquement
- [ ] Google Search Console configuré
- [ ] Domaine custom configuré

## ✅ Mobile
- [ ] PWA installable sur iOS/Android
- [ ] Bottom nav fonctionne correctement
- [ ] Touch targets minimum 44px
- [ ] Pas de zoom sur les inputs iOS
- [ ] Safe area respectée (iPhone notch)

## ✅ Performance
- [ ] First Contentful Paint < 2s
- [ ] Lighthouse score > 85
- [ ] Images optimisées (WebP/AVIF)
- [ ] Lazy loading sur les composants lourds
- [ ] API responses cachées correctement

## ✅ Monitoring
- [ ] /status page accessible
- [ ] Sentry recevant les erreurs
- [ ] Logger actif sur les routes critiques
- [ ] Logs structurés en production
