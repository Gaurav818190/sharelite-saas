-- Composite ownership constraints prevent a delivery from mixing records owned by different users.
-- The templates composite key already exists in the campaigns/templates migration and is
-- referenced by campaigns_template_owner_fk, so it must not be dropped or recreated here.
alter table public.leads drop constraint if exists leads_id_user_id_key;
alter table public.leads add constraint leads_id_user_id_key unique (id, user_id);
alter table public.campaigns drop constraint if exists campaigns_id_user_id_key;
alter table public.campaigns add constraint campaigns_id_user_id_key unique (id, user_id);

create table if not exists public.campaign_deliveries (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'sending', 'accepted', 'failed')),
  provider_message_id text,
  error_code text,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (campaign_id, lead_id),
  constraint campaign_deliveries_campaign_owner_fk foreign key (campaign_id, user_id) references public.campaigns(id, user_id),
  constraint campaign_deliveries_lead_owner_fk foreign key (lead_id, user_id) references public.leads(id, user_id)
);

create index if not exists campaign_deliveries_user_idx on public.campaign_deliveries(user_id, created_at desc);
create index if not exists campaign_deliveries_campaign_status_idx on public.campaign_deliveries(campaign_id, status);

drop trigger if exists campaign_deliveries_set_updated_at on public.campaign_deliveries;
create trigger campaign_deliveries_set_updated_at before update on public.campaign_deliveries
for each row execute function public.set_updated_at();

alter table public.campaign_deliveries enable row level security;
drop policy if exists campaign_deliveries_select_own on public.campaign_deliveries;
create policy campaign_deliveries_select_own on public.campaign_deliveries
for select to authenticated using (user_id = auth.uid());
drop policy if exists campaign_deliveries_insert_own on public.campaign_deliveries;
create policy campaign_deliveries_insert_own on public.campaign_deliveries
for insert to authenticated with check (user_id = auth.uid());
drop policy if exists campaign_deliveries_update_own on public.campaign_deliveries;
create policy campaign_deliveries_update_own on public.campaign_deliveries
for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
