-- ShareLite: global AI generation budget
-- Forward-only migration. Do not edit old migrations.

begin;

-- One global counter for the whole ShareLite application.
create table if not exists public.ai_global_usage (
  id integer primary key check (id = 1),
  generation_count integer not null default 0
    check (generation_count >= 0),
  generation_limit integer not null default 20000
    check (generation_limit > 0),
  updated_at timestamptz not null default now()
);

-- Ensure the single global budget row exists.
insert into public.ai_global_usage (
  id,
  generation_count,
  generation_limit
)
values (
  1,
  0,
  20000
)
on conflict (id)
do update set
  generation_limit = 20000,
  updated_at = now();

-- Keep the global counter hidden from normal authenticated users.
alter table public.ai_global_usage enable row level security;

revoke all on table public.ai_global_usage from public;
revoke all on table public.ai_global_usage from anon;
revoke all on table public.ai_global_usage from authenticated;

grant select, insert, update, delete
on public.ai_global_usage
to service_role;

-- Atomically consume:
-- 1) the user's plan allowance
-- 2) the global ShareLite allowance
create or replace function public.consume_ai_generation()
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_user_id uuid := auth.uid();
  active_plan text;
  allowed_generations integer := 0;
  global_used integer := 0;
  global_limit integer := 20000;
  changed_rows integer := 0;
begin
  if current_user_id is null then
    return false;
  end if;

  select s.plan
  into active_plan
  from public.subscriptions s
  where s.user_id = current_user_id
    and s.status in ('active', 'trialing')
    and (
      s.current_period_end is null
      or s.current_period_end > now()
    )
  limit 1;

  allowed_generations := case active_plan
    when 'free' then 10
    when 'starter' then 100
    when 'pro' then 500
    when 'business' then 2000
    when 'enterprise' then 10000
    else 0
  end;

  if allowed_generations <= 0 then
    return false;
  end if;

  -- Lock the global row so concurrent users cannot exceed 20,000.
  select generation_count, generation_limit
  into global_used, global_limit
  from public.ai_global_usage
  where id = 1
  for update;

  if not found then
    insert into public.ai_global_usage (
      id,
      generation_count,
      generation_limit
    )
    values (1, 0, 20000);

    select generation_count, generation_limit
    into global_used, global_limit
    from public.ai_global_usage
    where id = 1
    for update;
  end if;

  if global_used >= global_limit then
    return false;
  end if;

  -- Consume the user's monthly plan quota.
  insert into public.ai_usage (
    user_id,
    period_start,
    generation_count
  )
  values (
    current_user_id,
    date_trunc('month', current_date)::date,
    1
  )
  on conflict (user_id, period_start)
  do update set
    generation_count =
      public.ai_usage.generation_count + 1
  where public.ai_usage.generation_count < allowed_generations;

  get diagnostics changed_rows = row_count;

  -- User quota was already exhausted.
  if changed_rows <> 1 then
    return false;
  end if;

  -- Consume one unit from the global 20,000 budget.
  update public.ai_global_usage
  set generation_count = generation_count + 1,
      updated_at = now()
  where id = 1;

  return true;
end;
$$;

-- Refund one reserved generation when the provider fails.
create or replace function public.release_ai_generation()
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_user_id uuid := auth.uid();
  period_start_date date :=
    date_trunc('month', current_date)::date;
  user_used integer := 0;
  global_used integer := 0;
begin
  if current_user_id is null then
    return false;
  end if;

  -- Same lock order as consume_ai_generation()
  -- to avoid concurrent counter inconsistencies.
  select generation_count
  into global_used
  from public.ai_global_usage
  where id = 1
  for update;

  select generation_count
  into user_used
  from public.ai_usage
  where user_id = current_user_id
    and period_start = period_start_date
  for update;

  if user_used is null or user_used <= 0 then
    return false;
  end if;

  if global_used is null or global_used <= 0 then
    return false;
  end if;

  update public.ai_usage
  set generation_count = generation_count - 1
  where user_id = current_user_id
    and period_start = period_start_date
    and generation_count > 0;

  update public.ai_global_usage
  set generation_count = generation_count - 1,
      updated_at = now()
  where id = 1
    and generation_count > 0;

  return true;
end;
$$;

revoke all on function public.consume_ai_generation()
from public;

grant execute on function public.consume_ai_generation()
to authenticated;

revoke all on function public.release_ai_generation()
from public;

grant execute on function public.release_ai_generation()
to authenticated;

commit;