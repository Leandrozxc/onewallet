-- ============================================================================
-- One Wallet · Supabase PostgreSQL Schema, RLS & Transactional Sync RPC
-- Zero-Knowledge Card Vault: Card numbers, expiry dates, and CVV codes are
-- encrypted in the browser with Web Crypto AES-256-GCM BEFORE being stored in
-- `wallets.encrypted_card_vault`. Plaintext card details never touch Postgres.
-- ============================================================================

create extension if not exists "pgcrypto";

-- 1. User Profiles & Payday Preferences
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default 'One Wallet User',
  email text not null,
  payday_mode text not null default 'bimonthly', -- 'bimonthly' (15th & 30th), 'monthly-15', 'monthly-30', 'custom'
  custom_payday date,
  vault_salt text not null,                      -- Versioned PBKDF2 salt ('v3:<hex>') for client-side AES-GCM key derivation
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Wallets & Client-Encrypted Card Vault
create table if not exists public.wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id int not null,
  name text not null,
  balance numeric(12,2) not null default 0,
  style text not null default 'gcash',
  last4 text not null default '0000',            -- Only last 4 digits (or '0000' when cardless) stored for masked display
  encrypted_card_vault text not null,            -- AES-256-GCM ciphertext (iv + ciphertext + authTag); unreadable in DB
  created_at timestamptz not null default now(),
  unique (user_id, client_id)
);

-- 3. Ledger Entries (Income, Expenses, Adjustments & Bill Payments)
create table if not exists public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id int not null,
  wallet_client_id int not null,
  entry_date text not null,                      -- Full ISO date 'YYYY-MM-DD'
  merchant text not null,
  category text not null default 'Others',
  amount numeric(12,2) not null,                 -- Negative for outflow, positive for inflow
  created_at timestamptz not null default now(),
  unique (user_id, client_id)
);

-- 4. Quarantined Bills (Set aside before payday)
create table if not exists public.bills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id int not null,
  name text not null,
  amount numeric(12,2) not null,
  due_label text not null default 'Before payday',
  created_at timestamptz not null default now(),
  unique (user_id, client_id)
);

-- Foreign key indexes for RLS and user_id queries
create index if not exists idx_wallets_user_id on public.wallets(user_id);
create index if not exists idx_ledger_entries_user_id on public.ledger_entries(user_id);
create index if not exists idx_bills_user_id on public.bills(user_id);

-- Grant table permissions to authenticated role for PostgREST API access
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.wallets to authenticated;
grant select, insert, update, delete on public.ledger_entries to authenticated;
grant select, insert, update, delete on public.bills to authenticated;

-- ============================================================================
-- Row-Level Security (RLS) — Strict Per-User Isolation
-- ============================================================================
alter table public.profiles enable row level security;
alter table public.wallets enable row level security;
alter table public.ledger_entries enable row level security;
alter table public.bills enable row level security;

-- Profiles policies
drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles for insert
  to authenticated
  with check ((select auth.uid()) = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Wallets policies
drop policy if exists "Users can view own wallets" on public.wallets;
create policy "Users can view own wallets"
  on public.wallets for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own wallets" on public.wallets;
create policy "Users can insert own wallets"
  on public.wallets for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own wallets" on public.wallets;
create policy "Users can update own wallets"
  on public.wallets for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own wallets" on public.wallets;
create policy "Users can delete own wallets"
  on public.wallets for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- Ledger entries policies
drop policy if exists "Users can view own ledger entries" on public.ledger_entries;
create policy "Users can view own ledger entries"
  on public.ledger_entries for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own ledger entries" on public.ledger_entries;
create policy "Users can insert own ledger entries"
  on public.ledger_entries for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own ledger entries" on public.ledger_entries;
create policy "Users can update own ledger entries"
  on public.ledger_entries for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own ledger entries" on public.ledger_entries;
create policy "Users can delete own ledger entries"
  on public.ledger_entries for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- Bills policies
drop policy if exists "Users can view own bills" on public.bills;
create policy "Users can view own bills"
  on public.bills for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own bills" on public.bills;
create policy "Users can insert own bills"
  on public.bills for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own bills" on public.bills;
create policy "Users can update own bills"
  on public.bills for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own bills" on public.bills;
create policy "Users can delete own bills"
  on public.bills for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- ============================================================================
-- Atomic Workspace Sync RPC (SECURITY INVOKER — runs under caller's RLS!)
-- Ensures profile, wallets, ledger_entries, and bills are upserted and pruned
-- inside a single ACID database transaction so failed requests never wipe rows.
-- ============================================================================
create or replace function public.sync_user_workspace(
  p_full_name text,
  p_email text,
  p_payday_mode text,
  p_custom_payday date,
  p_vault_salt text,
  p_wallets jsonb default '[]'::jsonb,
  p_entries jsonb default '[]'::jsonb,
  p_bills jsonb default '[]'::jsonb
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  insert into public.profiles (id, full_name, email, payday_mode, custom_payday, vault_salt, updated_at)
  values (
    v_uid,
    coalesce(nullif(trim(p_full_name), ''), 'One Wallet User'),
    p_email,
    coalesce(nullif(trim(p_payday_mode), ''), 'bimonthly'),
    p_custom_payday,
    p_vault_salt,
    now()
  )
  on conflict (id) do update set
    full_name = excluded.full_name,
    email = excluded.email,
    payday_mode = excluded.payday_mode,
    custom_payday = excluded.custom_payday,
    vault_salt = excluded.vault_salt,
    updated_at = now();

  -- Upsert wallets & prune removed client_ids atomically
  insert into public.wallets (user_id, client_id, name, balance, style, last4, encrypted_card_vault)
  select
    v_uid,
    (w->>'client_id')::int,
    w->>'name',
    (w->>'balance')::numeric(12,2),
    coalesce(w->>'style', 'gcash'),
    coalesce(w->>'last4', '0000'),
    w->>'encrypted_card_vault'
  from jsonb_array_elements(coalesce(p_wallets, '[]'::jsonb)) as w
  on conflict (user_id, client_id) do update set
    name = excluded.name,
    balance = excluded.balance,
    style = excluded.style,
    last4 = excluded.last4,
    encrypted_card_vault = excluded.encrypted_card_vault;

  delete from public.wallets
  where user_id = v_uid
    and client_id not in (
      select (w->>'client_id')::int from jsonb_array_elements(coalesce(p_wallets, '[]'::jsonb)) as w
    );

  -- Upsert ledger entries & prune removed client_ids atomically
  insert into public.ledger_entries (user_id, client_id, wallet_client_id, entry_date, merchant, category, amount)
  select
    v_uid,
    (e->>'client_id')::int,
    (e->>'wallet_client_id')::int,
    e->>'entry_date',
    e->>'merchant',
    coalesce(e->>'category', 'Others'),
    (e->>'amount')::numeric(12,2)
  from jsonb_array_elements(coalesce(p_entries, '[]'::jsonb)) as e
  on conflict (user_id, client_id) do update set
    wallet_client_id = excluded.wallet_client_id,
    entry_date = excluded.entry_date,
    merchant = excluded.merchant,
    category = excluded.category,
    amount = excluded.amount;

  delete from public.ledger_entries
  where user_id = v_uid
    and client_id not in (
      select (e->>'client_id')::int from jsonb_array_elements(coalesce(p_entries, '[]'::jsonb)) as e
    );

  -- Upsert bills & prune removed client_ids atomically
  insert into public.bills (user_id, client_id, name, amount, due_label)
  select
    v_uid,
    (b->>'client_id')::int,
    b->>'name',
    (b->>'amount')::numeric(12,2),
    coalesce(b->>'due_label', 'Before payday')
  from jsonb_array_elements(coalesce(p_bills, '[]'::jsonb)) as b
  on conflict (user_id, client_id) do update set
    name = excluded.name,
    amount = excluded.amount,
    due_label = excluded.due_label;

  delete from public.bills
  where user_id = v_uid
    and client_id not in (
      select (b->>'client_id')::int from jsonb_array_elements(coalesce(p_bills, '[]'::jsonb)) as b
    );
end;
$$;

grant execute on function public.sync_user_workspace(text, text, text, date, text, jsonb, jsonb, jsonb) to authenticated;
revoke execute on function public.sync_user_workspace(text, text, text, date, text, jsonb, jsonb, jsonb) from public, anon;

-- Auto-confirm email on signup for instant passbook vault provisioning
create or replace function public.handle_auto_confirm_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email_confirmed_at is null then
    new.email_confirmed_at := now();
  end if;
  return new;
end;
$$;

revoke execute on function public.handle_auto_confirm_user() from public, anon, authenticated;

drop trigger if exists trg_auto_confirm_user on auth.users;
create trigger trg_auto_confirm_user
  before insert on auth.users
  for each row
  execute function public.handle_auto_confirm_user();
