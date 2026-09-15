begin;

-- Trial already used hai ya nahi, uska permanent record.
alter table public.subscriptions
add column if not exists trial_used boolean
not null default false;

-- Existing users ko dobara trial na mile.
update public.subscriptions
set trial_used = true
where trial_used = false;

-- New users ke liye one-time trial.
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
    trial_used,
    current_period_start,
    current_period_end
  )
  values (
    new.id,
    'starter',
    'trialing',
    true,
    timezone('utc', now()),
    timezone('utc', now()) + interval '5 days'
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

commit;