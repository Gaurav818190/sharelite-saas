-- ShareLite: final pricing plan limits
-- Forward-only migration. Do not edit old migrations.

begin;

-- 1. Allow final plan names.
alter table public.subscriptions
  drop constraint if exists subscriptions_plan_check;

alter table public.subscriptions
  add constraint subscriptions_plan_check
  check (
    plan in (
      'free',
      'starter',
      'pro',
      'business',
      'enterprise'
    )
  );

-- 2. Final AI generation limits.
create or replace function public.consume_ai_generation()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  active_plan text;
  allowed_generations integer := 0;
  used_generations integer := 0;
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
      public.ai_usage.generation_count + 1;

  select generation_count
  into used_generations
  from public.ai_usage
  where user_id = current_user_id
    and period_start = date_trunc('month', current_date)::date;

  if used_generations > allowed_generations then
    update public.ai_usage
    set generation_count = generation_count - 1
    where user_id = current_user_id
      and period_start = date_trunc('month', current_date)::date;

    return false;
  end if;

  return true;
end;
$$;

-- 3. Final monthly email sending limits.
create or replace function public.consume_email_send()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  active_plan text;
  allowed_emails integer := 0;
  used_emails integer := 0;
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

  allowed_emails := case active_plan
    when 'free' then 250
    when 'starter' then 500
    when 'pro' then 7500
    when 'business' then 25000
    when 'enterprise' then 50000
    else 0
  end;

  if allowed_emails <= 0 then
    return false;
  end if;

  insert into public.email_usage (
    user_id,
    period_start,
    send_count
  )
  values (
    current_user_id,
    date_trunc('month', current_date)::date,
    1
  )
  on conflict (user_id, period_start)
  do update set
    send_count =
      public.email_usage.send_count + 1;

  select send_count
  into used_emails
  from public.email_usage
  where user_id = current_user_id
    and period_start = date_trunc('month', current_date)::date;

  if used_emails > allowed_emails then
    update public.email_usage
    set send_count = send_count - 1
    where user_id = current_user_id
      and period_start = date_trunc('month', current_date)::date;

    return false;
  end if;

  return true;
end;
$$;

commit;