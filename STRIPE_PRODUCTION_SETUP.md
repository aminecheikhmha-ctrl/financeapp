# Stripe Production Setup

## 1. Créer les produits Stripe

### Dashboard Stripe → Products → Add product

**Pro (14,99€/mois)**
- Name: TradEx Pro
- Billing: Recurring, Monthly
- Price: 14.99 EUR
- Copy the Price ID → `STRIPE_PRO_PRICE_ID`

**Premium (29,99€/mois)**
- Name: TradEx Premium
- Billing: Recurring, Monthly
- Price: 29.99 EUR
- Copy the Price ID → `STRIPE_PREMIUM_PRICE_ID`

---

## 2. Variables d'environnement (Vercel)

```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRO_PRICE_ID=price_...
STRIPE_PREMIUM_PRICE_ID=price_...
RESEND_API_KEY=re_...
CRON_SECRET=un-secret-aléatoire-long
NEXT_PUBLIC_APP_URL=https://tradex-kappa-six.vercel.app
```

---

## 3. Configurer le Webhook Stripe

Dashboard Stripe → Developers → Webhooks → Add endpoint

- **URL**: `https://tradex-kappa-six.vercel.app/api/stripe/webhook`
- **Events à écouter**:
  - `checkout.session.completed`
  - `customer.subscription.deleted`
  - `invoice.payment_failed`
- Copy the **Signing secret** → `STRIPE_WEBHOOK_SECRET`

---

## 4. Colonnes Supabase à ajouter

Exécuter dans Supabase SQL Editor :

```sql
-- Colonnes Stripe dans la table profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS plan_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS plan_ended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_failed BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS email_seq INTEGER[] DEFAULT '{}';

-- Colonne referral dans user_profiles
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS plan_started_at TIMESTAMPTZ;

-- Table referrals
CREATE TABLE IF NOT EXISTS referrals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_id UUID REFERENCES auth.users(id),
  referred_email TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- pending | completed
  reward_given BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 5. Configurer le Cron Vercel

Le fichier `vercel.json` est déjà configuré avec :
```json
"crons": [{ "path": "/api/cron/emails", "schedule": "0 9 * * *" }]
```

Vercel appellera `GET /api/cron/emails` chaque jour à 9:00 UTC avec le header :
`Authorization: Bearer $CRON_SECRET`

> Note: Les crons Vercel ne fonctionnent qu'en production (pas en preview/dev).

---

## 6. Tester en local avec Stripe CLI

```bash
# Installer Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks vers localhost
stripe listen --forward-to localhost:3000/api/stripe/webhook

# Simuler un paiement réussi
stripe trigger checkout.session.completed

# Simuler un échec de paiement
stripe trigger invoice.payment_failed
```

---

## 7. Checklist avant mise en production

- [ ] Variables d'environnement ajoutées sur Vercel
- [ ] Webhook Stripe configuré avec la bonne URL de production
- [ ] Colonnes SQL ajoutées dans Supabase
- [ ] Test d'achat avec carte Stripe test `4242 4242 4242 4242`
- [ ] Vérification email de bienvenue reçu (Resend)
- [ ] Vérification mise à jour du plan en base de données
- [ ] Test webhook `invoice.payment_failed` → email reçu
- [ ] Cron visible dans Vercel Dashboard → Settings → Cron Jobs

---

## 8. Prix et MRR estimé

| Plan | Prix | Nb clients (objectif 3 mois) | MRR |
|------|------|------------------------------|-----|
| Pro | 14,99€ | 50 | 749,50€ |
| Premium | 29,99€ | 10 | 299,90€ |
| **Total** | | **60** | **~1 050€/mois** |
