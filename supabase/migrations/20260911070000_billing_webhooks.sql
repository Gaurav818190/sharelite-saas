create table if not exists public.billing_events (
  event_id text primary key,
  provider text not null,
  received_at timestamptz not null default timezone('utc', now())
);

alter table public.billing_events enable row level security;

-- Billing events are written only by the trusted service-role webhook path.

create or replace function public.apply_billing_subscription_event(
  p_event_id text,
  p_provider text,
  p_customer_id text,
  p_subscription_id text,
  p_user_id uuid,
  p_plan text,
  p_status text,
  p_period_start timestamptz,
  p_period_end timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  target_user uuid;
  inserted_event integer;
begin
  if p_event_id is null or p_event_id = '' or p_provider <> 'stripe' then return false; end if;
  if p_plan not in ('free', 'premium', 'premium_pro') then return false; end if;
  if p_status not in ('active', 'trialing', 'past_due', 'canceled', 'inactive') then return false; end if;

  insert into public.billing_events(event_id, provider)
  values (p_event_id, p_provider)
  on conflict (event_id) do nothing;
  get diagnostics inserted_event = row_count;
  if inserted_event = 0 then return true; end if;

  select user_id into target_user
    from public.subscriptions
   where (p_customer_id is not null and provider_customer_id = p_customer_id)
      or (p_subscription_id is not null and provider_subscription_id = p_subscription_id)
      or (p_user_id is not null and user_id = p_user_id)
   limit 1;

  if target_user is null then target_user := p_user_id; end if;
  if target_user is null then return false; end if;

  insert into public.subscriptions(user_id, plan, status, provider_customer_id, provider_subscription_id, current_period_start, current_period_end)
  values(target_user, p_plan, p_status, p_customer_id, p_subscription_id, p_period_start, p_period_end)
  on conflict (user_id) do update set
    plan = excluded.plan,
    status = excluded.status,
    provider_customer_id = coalesce(excluded.provider_customer_id, public.subscriptions.provider_customer_id),
    provider_subscription_id = coalesce(excluded.provider_subscription_id, public.subscriptions.provider_subscription_id),
    current_period_start = excluded.current_period_start,
    current_period_end = excluded.current_period_end,
    updated_at = timezone('utc', now());
  return true;
end;
$$;

revoke all on function public.apply_billing_subscription_event(text, text, text, text, uuid, text, text, timestamptz, timestamptz) from public;
grant execute on function public.apply_billing_subscription_event(text, text, text, text, uuid, text, text, timestamptz, timestamptz) to service_role;
