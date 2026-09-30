-- ShareLite: final pricing alignment
-- Forward-only migration.
-- Do not edit previous migrations.

begin;

-- ============================================================
-- 1. Replace the legacy plan constraint
-- ============================================================

alter table public.subscriptions
  drop constraint if exists subscriptions_plan_check;

-- ============================================================
-- 2. Migrate legacy plan names and normalize existing trials
--
-- Legacy:
-- starter      -> pro
-- premium      -> pro
-- premium_pro  -> business
--
-- Existing trialing accounts receive a 12-day trial measured
-- from their original trial start, not from migration time.
-- ============================================================

update public.subscriptions as s
set
  plan = case
    when s.status = 'trialing' then
      case
        when coalesce(
          s.current_period_start,
          s.created_at
        ) + interval '12 days' > timezone('utc', now())
        then 'pro'
        else 'free'
      end

    when s.plan = 'starter' then 'pro'
    when s.plan = 'premium' then 'pro'
    when s.plan = 'premium_pro' then 'business'
    else s.plan
  end,

  status = case
    when s.status = 'trialing' then
      case
        when coalesce(
          s.current_period_start,
          s.created_at
        ) + interval '12 days' > timezone('utc', now())
        then 'trialing'
        else 'active'
      end
    else s.status
  end,

  current_period_start = case
    when s.status = 'trialing'
      then coalesce(
        s.current_period_start,
        s.created_at
      )
    else s.current_period_start
  end,

  current_period_end = case
    when s.status = 'trialing'
      and coalesce(
        s.current_period_start,
        s.created_at
      ) + interval '12 days' > timezone('utc', now())
      then coalesce(
        s.current_period_start,
        s.created_at
      ) + interval '12 days'

    when s.status = 'trialing'
      then null

    else s.current_period_end
  end,

  updated_at = timezone('utc', now());

-- ============================================================
-- 3. Final allowed plans
-- ============================================================

alter table public.subscriptions
  add constraint subscriptions_plan_check
  check (
    plan in (
      'free',
      'pro',
      'business',
      'scale',
      'enterprise',
      'yearly_unlimited',
      'ultimate_growth'
    )
  );

-- ============================================================
-- 4. New accounts start with a 12-day Pro trial
-- ============================================================

create or replace function public.handle_new_subscription()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.subscriptions (
    user_id,
    plan,
    status,
    current_period_start,
    current_period_end
  )
  values (
    new.id,
    'pro',
    'trialing',
    coalesce(new.created_at, timezone('utc', now())),
    coalesce(new.created_at, timezone('utc', now()))
      + interval '12 days'
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

-- ============================================================
-- 5. Final internal AI generation guards
--
-- These are internal platform safeguards.
-- Public pricing does not advertise AI generation credits.
-- ============================================================

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
    when 'pro' then 500
    when 'business' then 2000
    when 'scale' then 5000
    when 'enterprise' then 10000
    when 'yearly_unlimited' then 10000
    when 'ultimate_growth' then 10000
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
    and period_start =
      date_trunc('month', current_date)::date;

  if used_generations > allowed_generations then
    update public.ai_usage
    set generation_count = generation_count - 1
    where user_id = current_user_id
      and period_start =
        date_trunc('month', current_date)::date;

    return false;
  end if;

  return true;
end;
$$;

-- ============================================================
-- 6. Final monthly email-send limits
--
-- ShareLite platform allowance:
--
-- Pro             1,500 / month
-- Business        3,000 / month
-- Scale           4,500 / month
-- Enterprise      6,000 / month
-- Yearly Unlimited 20,000 / month
-- Ultimate Growth  25,000 / month
--
-- Adding inboxes must not bypass these limits.
-- ============================================================

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
    when 'pro' then 1500
    when 'business' then 3000
    when 'scale' then 4500
    when 'enterprise' then 6000
    when 'yearly_unlimited' then 20000
    when 'ultimate_growth' then 25000
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
    and period_start =
      date_trunc('month', current_date)::date;

  if used_emails > allowed_emails then
    update public.email_usage
    set send_count = send_count - 1
    where user_id = current_user_id
      and period_start =
        date_trunc('month', current_date)::date;

    return false;
  end if;

  return true;
end;
$$;

commit;