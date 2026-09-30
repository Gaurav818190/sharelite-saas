-- ShareLite: Limit Boost activation
-- Forward-only migration. Do not edit old migrations.

begin;

create or replace function public.grant_limit_boost(
  target_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_subscription public.subscriptions%rowtype;
  original_end timestamptz;
  boosted_end timestamptz;
begin
  if target_user_id is null then
    return false;
  end if;

  /*
    A Limit Boost does not change the user's plan or limits.
    It only extends the current plan period by one calendar month.
  */
  select *
  into current_subscription
  from public.subscriptions
  where user_id = target_user_id
    and status in ('active', 'trialing')
  order by updated_at desc
  limit 1
  for update;

  if not found then
    return false;
  end if;

  /*
    Do not allow another boost while one is already active.
  */
  if exists (
    select 1
    from public.limit_boosts
    where user_id = target_user_id
      and status = 'active'
      and boosted_period_end > now()
  ) then
    return false;
  end if;

  original_end :=
    coalesce(
      current_subscription.current_period_end,
      now()
    );

  boosted_end :=
    original_end + interval '1 month';

  /*
    Extend the existing subscription period.
    Plan, status, features and limits remain unchanged.
  */
  update public.subscriptions
  set current_period_end = boosted_end,
      updated_at = now()
  where id = current_subscription.id;

  /*
    Store exactly what was extended so the boost can be
    audited and shown to the user.
  */
  insert into public.limit_boosts (
    user_id,
    period_start,
    original_period_end,
    boosted_period_end,
    status
  )
  values (
    target_user_id,
    coalesce(
      current_subscription.current_period_start::date,
      current_date
    ),
    original_end,
    boosted_end,
    'active'
  );

  return true;
end;
$$;

revoke all on function public.grant_limit_boost(uuid)
from public;

revoke all on function public.grant_limit_boost(uuid)
from anon;

revoke all on function public.grant_limit_boost(uuid)
from authenticated;

grant execute on function public.grant_limit_boost(uuid)
to service_role;


create or replace function public.expire_limit_boosts()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  affected_rows integer;
begin
  update public.limit_boosts
  set status = 'expired'
  where status = 'active'
    and boosted_period_end <= now();

  get diagnostics affected_rows = row_count;

  return affected_rows;
end;
$$;

revoke all on function public.expire_limit_boosts()
from public;

revoke all on function public.expire_limit_boosts()
from anon;

revoke all on function public.expire_limit_boosts()
from authenticated;

grant execute on function public.expire_limit_boosts()
to service_role;

commit;