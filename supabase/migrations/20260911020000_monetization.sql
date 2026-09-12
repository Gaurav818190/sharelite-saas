create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'premium', 'premium_pro')),
  status text not null default 'active' check (status in ('active', 'trialing', 'past_due', 'canceled', 'inactive')),
  provider_customer_id text,
  provider_subscription_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists subscriptions_user_id_idx on public.subscriptions(user_id);
create index if not exists subscriptions_plan_status_idx on public.subscriptions(plan, status);

 drop trigger if exists subscriptions_set_updated_at on public.subscriptions;
create trigger subscriptions_set_updated_at
before update on public.subscriptions
for each row execute function public.set_updated_at();

create or replace function public.handle_new_subscription()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.subscriptions (user_id, plan, status)
  values (new.id, 'free', 'active')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_subscription() from public;
grant execute on function public.handle_new_subscription() to supabase_auth_admin;

drop trigger if exists on_auth_user_subscription_created on auth.users;
create trigger on_auth_user_subscription_created
after insert on auth.users
for each row execute function public.handle_new_subscription();

alter table public.subscriptions enable row level security;

drop policy if exists subscriptions_select_own on public.subscriptions;
create policy subscriptions_select_own on public.subscriptions
for select to authenticated using (user_id = auth.uid());

-- Subscription mutations are reserved for trusted server-side provider/webhook work.
-- Ordinary authenticated clients receive read-only access to their own subscription.

insert into public.subscriptions (user_id, plan, status)
select id, 'free', 'active' from auth.users
on conflict (user_id) do nothing;
