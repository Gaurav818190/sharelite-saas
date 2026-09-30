begin;

create table if not exists public.connected_inboxes (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  provider text not null
    check (provider in ('google', 'smtp')),

  email text not null,

  display_name text,

  status text not null default 'active'
    check (status in ('active', 'paused', 'disconnected')),

  provider_account_id text,

  access_token text,
  refresh_token text,
  token_expires_at timestamptz,

  daily_send_limit integer not null default 100
    check (daily_send_limit > 0),

  daily_sent_count integer not null default 0
    check (daily_sent_count >= 0),

  daily_count_date date not null default current_date,

  last_sent_at timestamptz,

  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),

  unique (user_id, email)
);

create index if not exists connected_inboxes_user_id_idx
  on public.connected_inboxes(user_id);

create index if not exists connected_inboxes_user_status_idx
  on public.connected_inboxes(user_id, status);

create index if not exists connected_inboxes_daily_usage_idx
  on public.connected_inboxes(user_id, daily_count_date);

drop trigger if exists connected_inboxes_set_updated_at
  on public.connected_inboxes;

create trigger connected_inboxes_set_updated_at
before update on public.connected_inboxes
for each row
execute function public.set_updated_at();

alter table public.connected_inboxes enable row level security;

drop policy if exists connected_inboxes_select_own
  on public.connected_inboxes;

create policy connected_inboxes_select_own
on public.connected_inboxes
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists connected_inboxes_insert_own
  on public.connected_inboxes;

create policy connected_inboxes_insert_own
on public.connected_inboxes
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists connected_inboxes_update_own
  on public.connected_inboxes;

create policy connected_inboxes_update_own
on public.connected_inboxes
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists connected_inboxes_delete_own
  on public.connected_inboxes;

create policy connected_inboxes_delete_own
on public.connected_inboxes
for delete
to authenticated
using (user_id = auth.uid());

grant select, insert, update, delete
on public.connected_inboxes
to authenticated;

grant select, insert, update, delete
on public.connected_inboxes
to service_role;

commit;