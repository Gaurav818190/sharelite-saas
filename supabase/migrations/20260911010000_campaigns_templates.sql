create table if not exists public.templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 200),
  subject text not null check (char_length(trim(subject)) between 1 and 300),
  body text not null check (char_length(trim(body)) between 1 and 20000),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (id, user_id)
);

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 200),
  description text,
  status text not null default 'draft' check (status in ('draft', 'active', 'paused', 'completed')),
  template_id uuid,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint campaigns_template_owner_fk foreign key (template_id, user_id)
    references public.templates (id, user_id)
);

create index if not exists templates_user_id_idx on public.templates(user_id);
create index if not exists templates_user_created_at_idx on public.templates(user_id, created_at desc);
create index if not exists campaigns_user_id_idx on public.campaigns(user_id);
create index if not exists campaigns_user_status_idx on public.campaigns(user_id, status);
create index if not exists campaigns_user_created_at_idx on public.campaigns(user_id, created_at desc);

 drop trigger if exists templates_set_updated_at on public.templates;
create trigger templates_set_updated_at before update on public.templates
for each row execute function public.set_updated_at();

drop trigger if exists campaigns_set_updated_at on public.campaigns;
create trigger campaigns_set_updated_at before update on public.campaigns
for each row execute function public.set_updated_at();

alter table public.templates enable row level security;
alter table public.campaigns enable row level security;

drop policy if exists templates_select_own on public.templates;
create policy templates_select_own on public.templates for select to authenticated using (user_id = auth.uid());
drop policy if exists templates_insert_own on public.templates;
create policy templates_insert_own on public.templates for insert to authenticated with check (user_id = auth.uid());
drop policy if exists templates_update_own on public.templates;
create policy templates_update_own on public.templates for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists templates_delete_own on public.templates;
create policy templates_delete_own on public.templates for delete to authenticated using (user_id = auth.uid());

drop policy if exists campaigns_select_own on public.campaigns;
create policy campaigns_select_own on public.campaigns for select to authenticated using (user_id = auth.uid());
drop policy if exists campaigns_insert_own on public.campaigns;
create policy campaigns_insert_own on public.campaigns for insert to authenticated with check (user_id = auth.uid());
drop policy if exists campaigns_update_own on public.campaigns;
create policy campaigns_update_own on public.campaigns for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists campaigns_delete_own on public.campaigns;
create policy campaigns_delete_own on public.campaigns for delete to authenticated using (user_id = auth.uid());
