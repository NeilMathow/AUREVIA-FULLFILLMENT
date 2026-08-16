-- Run this in the Supabase SQL Editor for your project.

create extension if not exists "pgcrypto";

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  person text not null,
  address text,
  carrier text,
  tracking text,
  notes text,
  items jsonb not null default '[]'::jsonb, -- [{ peptide: string, units: string }]
  status text not null default 'pending' check (status in ('pending', 'processing', 'shipped', 'cancelled')),
  created_at timestamptz not null default now()
);

-- Keep an index for common filtering
create index if not exists orders_status_idx on orders (status);
create index if not exists orders_created_at_idx on orders (created_at desc);

-- Row Level Security
alter table orders enable row level security;

-- Simple internal-tool policy: anyone with the anon key can read/write.
-- Tighten this later (e.g. require auth) if this ever leaves your internal team.
create policy "Allow all access to orders"
  on orders
  for all
  using (true)
  with check (true);

-- Enable realtime so coworkers see new/updated orders live without refreshing
alter publication supabase_realtime add table orders;
