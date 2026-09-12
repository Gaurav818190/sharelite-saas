create table if not exists public.email_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  period_start date not null default (timezone('utc', now())::date),
  send_count integer not null default 0 check (send_count >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, period_start)
);

create index if not exists email_usage_user_period_idx on public.email_usage(user_id, period_start desc);

drop trigger if exists email_usage_set_updated_at on public.email_usage;
create trigger email_usage_set_updated_at before update on public.email_usage
for each row execute function public.set_updated_at();

alter table public.email_usage enable row level security;
drop policy if exists email_usage_select_own on public.email_usage;
create policy email_usage_select_own on public.email_usage
for select to authenticated using (user_id = auth.uid());

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
     and s.status in ('active', 'trialing');

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
