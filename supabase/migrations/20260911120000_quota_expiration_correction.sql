-- Corrective, forward-only quota migration.
--
-- This migration intentionally does not alter usage tables, subscription rows,
-- counters, or historical migration files. It reasserts both quota RPCs so AI
-- and email enforcement use the same UTC period and subscription-expiration
-- semantics. An expired active/trialing subscription falls back to the free
-- plan limit because it is excluded from the plan-limit lookup.

create or replace function public.consume_ai_generation()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  current_period date := timezone('utc', now())::date;
  allowed integer;
  changed integer;
begin
  if current_user_id is null then return false; end if;

  select case s.plan
    when 'premium_pro' then 1000
    when 'premium' then 100
    else 5
  end
    into allowed
    from public.subscriptions s
   where s.user_id = current_user_id
     and s.status in ('active', 'trialing')
     and (s.current_period_end is null or s.current_period_end > now());

  if allowed is null then allowed := 5; end if;

  insert into public.ai_usage (user_id, period_start, generation_count)
  values (current_user_id, current_period, 1)
  on conflict (user_id, period_start) do update
    set generation_count = public.ai_usage.generation_count + 1,
        updated_at = timezone('utc', now())
  where public.ai_usage.generation_count < allowed;

  get diagnostics changed = row_count;
  return changed > 0;
end;
$$;

revoke all on function public.consume_ai_generation() from public;
grant execute on function public.consume_ai_generation() to authenticated;

create or replace function public.consume_email_send()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  current_period date := timezone('utc', now())::date;
  allowed integer;
  changed integer;
begin
  if current_user_id is null then return false; end if;

  select case s.plan
    when 'premium_pro' then 25000
    when 'premium' then 5000
    else 25
  end
    into allowed
    from public.subscriptions s
   where s.user_id = current_user_id
     and s.status in ('active', 'trialing')
     and (s.current_period_end is null or s.current_period_end > now());

  -- No qualifying subscription, including an expired active/trialing period,
  -- receives the free-plan allowance.
  if allowed is null then allowed := 25; end if;

  insert into public.email_usage (user_id, period_start, send_count)
  values (current_user_id, current_period, 1)
  on conflict (user_id, period_start) do update
    set send_count = public.email_usage.send_count + 1,
        updated_at = timezone('utc', now())
  where public.email_usage.send_count < allowed;

  get diagnostics changed = row_count;
  return changed > 0;
end;
$$;

revoke all on function public.consume_email_send() from public;
grant execute on function public.consume_email_send() to authenticated;
