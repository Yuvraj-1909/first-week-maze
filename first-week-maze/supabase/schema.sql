-- Run this once in the Supabase project SQL Editor.
-- The Express API is the only component that should use the secret key.
create table if not exists public.app_state (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_state enable row level security;
