create table if not exists public.email_jobs (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references auth.users(id) on delete cascade,
  campaign_id uuid not null,
  delivery_id uuid not null,
  inbox_id uuid not null,

  status text not null default 'queued'
    check (status in ('queued', 'processing', 'sent', 'failed')),

  attempts integer not null default 0,
  available_at timestamptz not null default timezone('utc', now()),
  locked_at timestamptz,
  completed_at timestamptz,

  error_message text,

  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),

  constraint email_jobs_delivery_unique
    unique (delivery_id)
);

create index if not exists email_jobs_queue_idx
on public.email_jobs(status, available_at, created_at);

create index if not exists email_jobs_user_idx
on public.email_jobs(user_id, created_at desc);

create index if not exists email_jobs_campaign_idx
on public.email_jobs(campaign_id, status);

create index if not exists email_jobs_inbox_idx
on public.email_jobs(inbox_id, status);

drop trigger if exists email_jobs_set_updated_at
on public.email_jobs;

create trigger email_jobs_set_updated_at
before update on public.email_jobs
for each row
execute function public.set_updated_at();

alter table public.email_jobs enable row level security;

drop policy if exists email_jobs_select_own
on public.email_jobs;

create policy email_jobs_select_own
on public.email_jobs
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists email_jobs_insert_own
on public.email_jobs;

create policy email_jobs_insert_own
on public.email_jobs
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists email_jobs_update_own
on public.email_jobs;

create policy email_jobs_update_own
on public.email_jobs
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());


create or replace function public.claim_email_jobs(
  p_limit integer default 10
)
returns setof public.email_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with candidates as (
    select id
    from public.email_jobs
    where
      (
        status = 'queued'
        and available_at <= timezone('utc', now())
      )
      or
      (
        status = 'processing'
        and locked_at < timezone('utc', now()) - interval '10 minutes'
      )
    order by created_at
    limit greatest(1, least(p_limit, 10))
    for update skip locked
  ),
  claimed as (
    update public.email_jobs jobs
    set
      status = 'processing',
      attempts = jobs.attempts + 1,
      locked_at = timezone('utc', now()),
      updated_at = timezone('utc', now())
    from candidates
    where jobs.id = candidates.id
    returning jobs.*
  )
  select *
  from claimed;
end;
$$;

revoke all on function public.claim_email_jobs(integer)
from public;

grant execute on function public.claim_email_jobs(integer)
to service_role;