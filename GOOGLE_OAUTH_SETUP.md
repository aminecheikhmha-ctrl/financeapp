# Configurer Google OAuth

Google OAuth est déjà intégré dans le code. Il faut juste configurer les credentials.

## 1. Google Cloud Console

1. Aller sur [console.cloud.google.com](https://console.cloud.google.com)
2. Créer un projet ou sélectionner le tien
3. **APIs & Services → OAuth consent screen** → Configurer (External, ajouter ton email en test user)
4. **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**
5. Application type : **Web application**
6. Authorized redirect URIs : `https://[TON_PROJECT_ID].supabase.co/auth/v1/callback`
   - Trouve ton Project ID dans Supabase → Settings → API → Project URL

## 2. Supabase Dashboard

1. **Authentication → Providers → Google**
2. Toggle **Enable**
3. Coller le **Client ID** et **Client Secret** de Google Cloud
4. Save

## 3. Variables d'environnement

Pas de variable supplémentaire nécessaire — Supabase gère OAuth côté serveur.

## 4. Test

Le bouton "Continuer avec Google" dans `/login` et `/signup` fonctionne automatiquement.
