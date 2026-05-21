-- ── price_alerts ──────────────────────────────────────────────────────────────
create table if not exists price_alerts (
  id           uuid default gen_random_uuid() primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  symbol       text not null,
  condition    text not null check (condition in ('above','below','tp_executed','sl_executed')),
  price        numeric not null,
  triggered    boolean default false,
  triggered_at timestamp,
  created_at   timestamp default now()
);
create index if not exists price_alerts_user_idx on price_alerts(user_id);
create index if not exists price_alerts_triggered_idx on price_alerts(triggered);
alter table price_alerts enable row level security;
drop policy if exists "users manage own alerts" on price_alerts;
create policy "users manage own alerts" on price_alerts
  for all using (auth.uid() = user_id);
-- Service key bypasses RLS automatically

-- ── blog_posts ────────────────────────────────────────────────────────────────
create table if not exists blog_posts (
  id           uuid default gen_random_uuid() primary key,
  slug         text unique not null,
  title        text not null,
  excerpt      text not null,
  content      text not null,
  category     text not null,
  tags         text[],
  reading_time integer default 5,
  published    boolean default true,
  featured     boolean default false,
  created_at   timestamp default now(),
  updated_at   timestamp default now()
);
create index if not exists blog_posts_slug_idx on blog_posts(slug);
create index if not exists blog_posts_category_idx on blog_posts(category);
create index if not exists blog_posts_published_idx on blog_posts(published);
alter table blog_posts enable row level security;
drop policy if exists "anyone reads published posts" on blog_posts;
create policy "anyone reads published posts" on blog_posts
  for select using (published = true);
drop policy if exists "service manages posts" on blog_posts;
create policy "service manages posts" on blog_posts
  for all using (true);

-- ── newsletter_subscribers ────────────────────────────────────────────────────
create table if not exists newsletter_subscribers (
  id             uuid default gen_random_uuid() primary key,
  email          text unique not null,
  source         text default 'blog',
  subscribed_at  timestamp default now()
);
alter table newsletter_subscribers enable row level security;
drop policy if exists "service manages subscribers" on newsletter_subscribers;
create policy "service manages subscribers" on newsletter_subscribers
  for all using (true);
