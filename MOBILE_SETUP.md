# Tradex — App Mobile Setup

## Architecture
L'app mobile est une webview native (Capacitor) qui charge l'app Next.js depuis Vercel.
Pas d'export statique nécessaire — toutes les API routes fonctionnent normalement.

## Prérequis
- Node.js 18+
- Xcode 15+ (iOS) — Mac uniquement
- Android Studio (Android)
- CocoaPods : `sudo gem install cocoapods`

## Première installation

```bash
# 1. Initialise Capacitor (déjà fait si capacitor.config.ts existe)
npx cap init "Tradex" "io.tradex.app" --web-dir=out

# 2. Ajoute iOS
npx cap add ios

# 3. Ajoute Android
npx cap add android

# 4. Synchronise
npx cap sync
```

## Build iOS

```bash
npm run build:mobile      # sync capacitor
npx cap open ios          # ouvre Xcode
# Dans Xcode : sélectionne ton device/simulateur → Cmd+R
```

## Build Android

```bash
npm run build:mobile      # sync capacitor
npx cap open android      # ouvre Android Studio
# Run > Run app
```

## Développement live

```bash
# Terminal 1 : lance Next.js
npm run dev

# Terminal 2 : ouvre l'app native (charge depuis localhost:3000)
npx cap run ios --livereload --external
# ou
npx cap run android --livereload --external
```

## Publier sur l'App Store (iOS)

1. Xcode → Product → Archive
2. Distribute App → App Store Connect
3. Remplis les métadonnées sur App Store Connect
4. Submit for Review

## Publier sur le Play Store (Android)

1. Android Studio → Build → Generate Signed Bundle (AAB)
2. Upload sur Google Play Console
3. Remplis les métadonnées
4. Submit for Review

## Supabase — Tables requises

```sql
-- Tokens push natifs
CREATE TABLE IF NOT EXISTS push_tokens (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  token text NOT NULL,
  platform text DEFAULT 'native',
  updated_at timestamptz DEFAULT now()
);
```

## Variables d'environnement Vercel

Toutes les variables existantes fonctionnent — l'app native charge depuis Vercel.
Aucune variable supplémentaire requise.
