# Configuration Email Supabase

## 1. Template email de confirmation signup

Aller dans : **Supabase Dashboard → Authentication → Email Templates → Confirm signup**

Remplacer le contenu HTML par :

```html
<h2 style="font-family:Inter,sans-serif;color:white">Confirme ton compte FinanceApp 🚀</h2>
<p style="color:#888">Tu es à un clic de commencer à trader avec l'IA.</p>
<a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#22c55e;color:black;font-weight:bold;padding:12px 24px;border-radius:12px;text-decoration:none;margin:20px 0">
  ✅ Confirmer mon compte
</a>
<p style="color:#555;font-size:12px">Ce lien expire dans 24h. Si tu n'as pas créé de compte, ignore cet email.</p>
```

## 2. Redirect URLs

Aller dans : **Authentication → URL Configuration → Redirect URLs**

Ajouter :
- `https://financeapp-kappa-six.vercel.app/auth/callback`
- `http://localhost:3000/auth/callback`
- `http://localhost:3001/auth/callback`
- `http://localhost:3002/auth/callback`

## 3. Table price_alerts (si pas créée)

Exécuter dans **SQL Editor** :

```sql
create table if not exists price_alerts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  symbol text not null,
  condition text not null check (condition in ('above', 'below', 'tp_executed', 'sl_executed')),
  price numeric not null,
  triggered boolean default false,
  created_at timestamp default now()
);

alter table price_alerts enable row level security;

create policy "Users manage own alerts" on price_alerts
  for all using (auth.uid() = user_id);
```

## 4. Table signals_cache (si pas créée)

```sql
create table if not exists signals_cache (
  id uuid default gen_random_uuid() primary key,
  signals jsonb not null,
  stats jsonb,
  created_at timestamp default now()
);
```

## 5. SMTP personnalisé avec Resend (recommandé)

- Créer un compte sur resend.com
- Aller dans **Supabase → Settings → Auth → SMTP Settings**
- SMTP Host: `smtp.resend.com`
- Port: `465`
- User: `resend`
- Password: `[RESEND_API_KEY]`
- Sender: `noreply@tondomaine.com`
