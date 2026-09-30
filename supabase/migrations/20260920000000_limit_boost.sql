-- ShareLite: one-month Limit Boost
-- Forward-only migration. Do not edit old migrations.

begin;

create table if not exists public.limit_boosts (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  period_start date not null,

  original_period_end timestamptz not null,
  boosted_period_end timestamptz not null,

  status text not null default 'active'
    check (status in ('active', 'expired', 'canceled')),

  created_at timestamptz not null default now(),

  unique (user_id, period_start)
);

alter table public.limit_boosts enable row level security;

create policy "Users can view their own limit boosts"
on public.limit_boosts
for select
to authenticated
using (auth.uid() = user_id);

create index if not exists limit_boosts_user_period_idx
on public.limit_boosts (user_id, period_start);

commit;