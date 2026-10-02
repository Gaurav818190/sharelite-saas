alter table public.leads
  add column if not exists country_code text,
  add column if not exists country_name text;

alter table public.leads
  drop constraint if exists leads_country_code_format;

alter table public.leads
  add constraint leads_country_code_format
  check (
    country_code is null
    or country_code ~ '^[A-Z]{2}$'
  );

create index if not exists leads_user_country_created_at_idx
  on public.leads(user_id, country_code, created_at desc);