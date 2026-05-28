# Fix: Google OAuth Provider Not Enabled

## Problem
Google OAuth sign-in fails because the Google provider is not enabled in the Supabase project settings.

## Steps to Fix

### 1. Supabase Dashboard
1. Go to https://supabase.com/dashboard/project/ngybxuseffhpgeiodtwa/auth/providers
2. Find **Google** in the list of providers
3. Toggle it **ON**
4. Copy the **Callback URL** shown (e.g. `https://ngybxuseffhpgeiodtwa.supabase.co/auth/v1/callback`)

### 2. Google Cloud Console
1. Go to https://console.cloud.google.com/
2. Create or select your project
3. Navigate to **APIs & Services > Credentials**
4. Click **Create Credentials > OAuth 2.0 Client ID**
5. Application type: **Web application**
6. Add to **Authorized redirect URIs**:
   - `https://ngybxuseffhpgeiodtwa.supabase.co/auth/v1/callback`
   - `http://localhost:3000/auth/callback` (for local dev)
   - `https://tradex-kappa-six.vercel.app/auth/callback` (production)
7. Copy the **Client ID** and **Client Secret**

### 3. Back in Supabase
1. Paste the Google **Client ID** and **Client Secret** into the provider settings
2. Save

### 4. Environment Variables (if needed)
No additional env vars are needed — Supabase handles Google OAuth server-side.

### 5. Code (already implemented)
The sign-in button in `app/login/page.tsx` and `app/signup/page.tsx` calls:
```ts
supabase.auth.signInWithOAuth({
  provider: "google",
  options: { redirectTo: `${window.location.origin}/auth/callback` }
})
```
This is correct. Only the Supabase dashboard configuration is missing.

## Auth Callback Route
Make sure `app/auth/callback/page.tsx` exists and handles the OAuth exchange.
Check `middleware.ts` includes `/auth/callback` in the public routes.
