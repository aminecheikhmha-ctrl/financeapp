# Guide de déploiement — FinanceApp

## Pré-requis

- Node.js 20+
- Compte Vercel (plan Pro recommandé pour les crons)
- Projet Supabase configuré
- Clé API Groq
- Clé API Yahoo Finance (optionnelle — scraping utilisé par défaut)

---

## Variables d'environnement

Configurer dans **Vercel → Settings → Environment Variables** (pour tous les environnements).

### Supabase

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL du projet Supabase (ex: `https://xxx.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clé publique anon |
| `SUPABASE_SERVICE_KEY` | Clé service (secret — jamais exposée côté client) |

### App

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_APP_URL` | URL de production (ex: `https://financeapp.io`) |
| `CRON_SECRET` | Secret partagé pour sécuriser les routes `/api/cron/*` |

### IA

| Variable | Description |
|---|---|
| `GROQ_API_KEY` | Clé API Groq (analyses IA forum, résumés) |

### Optionnel

| Variable | Description |
|---|---|
| `ALPACA_API_KEY` | Clé Alpaca pour les graphes de prix |
| `ALPACA_API_SECRET` | Secret Alpaca |

---

## Déploiement initial

```bash
# 1. Cloner et installer
git clone <repo>
cd financeapp
npm install

# 2. Variables locales
cp .env.example .env.local
# Remplir les valeurs dans .env.local

# 3. Générer les icônes PWA
npm run generate-icons

# 4. Vérifier les types TypeScript
npx tsc --noEmit

# 5. Build de production
npm run build

# 6. Déployer sur Vercel
npx vercel --prod
```

---

## Base de données Supabase

### Tables requises

```sql
-- Profils utilisateurs
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  username TEXT,
  avatar_color TEXT DEFAULT '#4ade80',
  level TEXT,
  experience TEXT,
  goals TEXT[],
  capital TEXT,
  assets TEXT[],
  risk TEXT,
  onboarding_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Positions de trading
CREATE TABLE positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  symbol TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  avg_price NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Signaux
CREATE TABLE signals (
  symbol TEXT PRIMARY KEY,
  type TEXT,
  price NUMERIC,
  note TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Forum
CREATE TABLE forum_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT,
  symbol TEXT,
  avatar TEXT,
  username TEXT,
  views INT DEFAULT 0,
  replies_count INT DEFAULT 0,
  likes_count INT DEFAULT 0,
  ai_analysis TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE forum_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES forum_posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  content TEXT NOT NULL,
  username TEXT,
  avatar TEXT,
  likes_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE forum_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  post_id UUID,
  reply_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, post_id),
  UNIQUE(user_id, reply_id)
);

-- Alertes prix
CREATE TABLE price_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  symbol TEXT NOT NULL,
  target_price NUMERIC NOT NULL,
  direction TEXT CHECK (direction IN ('above', 'below')),
  triggered BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Résumés marché (cron)
CREATE TABLE market_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Row Level Security (RLS)

```sql
-- Activer RLS sur toutes les tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_alerts ENABLE ROW LEVEL SECURITY;

-- Politiques user_profiles
CREATE POLICY "Users can read own profile" ON user_profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON user_profiles FOR UPDATE USING (auth.uid() = id);

-- Politiques positions
CREATE POLICY "Users can manage own positions" ON positions FOR ALL USING (auth.uid() = user_id);

-- Politiques price_alerts
CREATE POLICY "Users can manage own alerts" ON price_alerts FOR ALL USING (auth.uid() = user_id);

-- Forum (lecture publique, écriture authentifiée)
ALTER TABLE forum_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read posts" ON forum_posts FOR SELECT USING (true);
CREATE POLICY "Auth users can create posts" ON forum_posts FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Anyone can read replies" ON forum_replies FOR SELECT USING (true);
CREATE POLICY "Auth users can create replies" ON forum_replies FOR INSERT WITH CHECK (auth.uid() = user_id);
```

---

## Crons Vercel

Les crons sont définis dans `vercel.json`. Ils nécessitent le **plan Pro** de Vercel.

| Route | Fréquence | Description |
|---|---|---|
| `/api/cron/signals` | Toutes les 15 min | Mise à jour des signaux de marché |
| `/api/cron/alerts` | Toutes les 5 min | Vérification des alertes prix |
| `/api/cron/market-summary` | 08h00 UTC (lun-ven) | Résumé quotidien des marchés |

**Sécurisation** : Chaque route vérifie `Authorization: Bearer <CRON_SECRET>`. Vercel envoie automatiquement ce header.

---

## PWA

Les icônes sont générées par le script Node.js :

```bash
npm run generate-icons
# Génère public/icon-192.png et public/icon-512.png
```

Le service worker (`public/sw.js`) est enregistré automatiquement via le composant `<ServiceWorker />` dans le layout racine.

---

## Checklist avant mise en production

- [ ] Variables d'environnement configurées dans Vercel
- [ ] RLS activé et politiques créées dans Supabase
- [ ] `npx tsc --noEmit` passe sans erreur
- [ ] `npm run build` réussit
- [ ] Icônes PWA générées (`public/icon-192.png`, `public/icon-512.png`)
- [ ] `og-image.png` présent dans `public/`
- [ ] DNS configuré (domaine pointant vers Vercel)
- [ ] HTTPS activé (automatique avec Vercel)
- [ ] Crons testés manuellement via `curl -H "Authorization: Bearer <CRON_SECRET>" https://financeapp.io/api/cron/signals`

---

## Commandes utiles

```bash
# Dev local
npm run dev

# Build
npm run build

# TypeScript check
npx tsc --noEmit

# Générer icônes PWA
npm run generate-icons

# Déployer
npx vercel --prod

# Logs Vercel
npx vercel logs
```
