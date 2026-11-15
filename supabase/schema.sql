-- ============================================================================
-- One Wallet · Supabase PostgreSQL Schema & Row-Level Security (RLS)
-- Zero-Knowledge Card Vault: Card numbers, expiry dates, and CVV codes are
-- encrypted in the browser with Web Crypto AES-GCM-256 BEFORE being stored in
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
  vault_salt text not null,                      -- PBKDF2 salt for client-side AES-GCM key derivation
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
  last4 text not null default '0000',            -- Only last 4 digits stored for masked display
  encrypted_card_vault text not null,            -- AES-GCM-256 ciphertext (iv + ciphertext); unreadable in DB
  created_at timestamptz not null default now(),
  unique (user_id, client_id)
);

-- 3. Ledger Entries (Income, Expenses & Bill Payments)
create table if not exists public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id int not null,
  wallet_client_id int not null,
  entry_date text not null,
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
create policy "Users can view own profile"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  to authenticated
  with check ((select auth.uid()) = id);

create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Wallets policies
create policy "Users can view own wallets"
  on public.wallets for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert own wallets"
  on public.wallets for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update own wallets"
  on public.wallets for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete own wallets"
  on public.wallets for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- Ledger entries policies
create policy "Users can view own ledger entries"
  on public.ledger_entries for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert own ledger entries"
  on public.ledger_entries for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update own ledger entries"
  on public.ledger_entries for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete own ledger entries"
  on public.ledger_entries for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- Bills policies
create policy "Users can view own bills"
  on public.bills for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert own bills"
  on public.bills for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update own bills"
  on public.bills for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete own bills"
  on public.bills for delete
  to authenticated
  using ((select auth.uid()) = user_id);

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

create trigger trg_auto_confirm_user
  before insert on auth.users
  for each row
  execute function public.handle_auto_confirm_user();
