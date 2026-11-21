-- WeChat website login + cross-device profile storage.
-- Only Supabase Edge Functions using the service role key may access these tables.
-- Run this migration once in the Supabase SQL editor, or via `supabase db push`.

create extension if not exists pgcrypto;

create table if not exists public.wechat_accounts (
  id uuid primary key default gen_random_uuid(),
  openid text not null unique,
  unionid text,
  wechat_nickname text,
  wechat_avatar text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_login_at timestamptz not null default now()
);

create index if not exists wechat_accounts_unionid_idx
  on public.wechat_accounts (unionid)
  where unionid is not null;

create table if not exists public.wechat_oauth_states (
  id uuid primary key default gen_random_uuid(),
  state_hash text not null unique,
  redirect_to text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);

create index if not exists wechat_oauth_states_expires_idx
  on public.wechat_oauth_states (expires_at);

create table if not exists public.wechat_sessions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.wechat_accounts (id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);

create index if not exists wechat_sessions_account_idx
  on public.wechat_sessions (account_id);
create index if not exists wechat_sessions_expires_idx
  on public.wechat_sessions (expires_at);

create table if not exists public.player_profiles (
  account_id uuid primary key references public.wechat_accounts (id) on delete cascade,
  version integer not null default 1 check (version > 0),
  profile jsonb not null default '{}'::jsonb
    check (pg_column_size(profile) <= 262144),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.wechat_accounts enable row level security;
alter table public.wechat_oauth_states enable row level security;
alter table public.wechat_sessions enable row level security;
alter table public.player_profiles enable row level security;

-- No anon/authenticated policies: the Edge Functions are the only entry point.
revoke all on public.wechat_accounts from anon, authenticated;
revoke all on public.wechat_oauth_states from anon, authenticated;
revoke all on public.wechat_sessions from anon, authenticated;
revoke all on public.player_profiles from anon, authenticated;

grant all on public.wechat_accounts to service_role;
grant all on public.wechat_oauth_states to service_role;
grant all on public.wechat_sessions to service_role;
grant all on public.player_profiles to service_role;

comment on table public.wechat_accounts is
  'WeChat Open Platform identity. AppSecret is never stored here.';
comment on table public.wechat_oauth_states is
  'Short-lived, single-use OAuth state rows. Only SHA-256 hashes are stored.';
comment on table public.wechat_sessions is
  'Opaque 30-day sessions. Only SHA-256 token hashes are stored.';
comment on table public.player_profiles is
  'Synced nickname, avatar, achievements and stats. version is an optimistic lock.';
