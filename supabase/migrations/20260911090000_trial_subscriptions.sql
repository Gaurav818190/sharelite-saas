-- Give every new account a persisted trial window. The dashboard countdown reads
-- these server-side timestamps, so it remains accurate across devices and reloads.
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
    'premium',
    'trialing',
    coalesce(new.created_at, timezone('utc', now())),
    coalesce(new.created_at, timezone('utc', now())) + interval '14 days'
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

-- Backfill subscriptions created before the trial trigger existed. Expired
-- windows are explicitly converted to the normal free plan.
update public.subscriptions s
set
  plan = case when coalesce(u.created_at, s.created_at) + interval '14 days' > timezone('utc', now()) then 'premium' else 'free' end,
  status = case when coalesce(u.created_at, s.created_at) + interval '14 days' > timezone('utc', now()) then 'trialing' else 'active' end,
  current_period_start = coalesce(s.current_period_start, u.created_at, s.created_at),
  current_period_end = coalesce(s.current_period_end, coalesce(u.created_at, s.created_at) + interval '14 days'),
  updated_at = timezone('utc', now())
from auth.users u
where s.user_id = u.id
  and s.current_period_end is null;
