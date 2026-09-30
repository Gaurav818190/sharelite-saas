-- Add real provider delivery outcomes to campaign deliveries.
-- Existing migration is intentionally left unchanged.

alter table public.campaign_deliveries
  drop constraint if exists campaign_deliveries_status_check;

alter table public.campaign_deliveries
  add constraint campaign_deliveries_status_check
  check (
    status in (
      'pending',
      'sending',
      'accepted',
      'delivered',
      'bounced',
      'failed'
    )
  );

alter table public.campaign_deliveries
  add column if not exists delivered_at timestamptz;

alter table public.campaign_deliveries
  add column if not exists bounced_at timestamptz;

alter table public.campaign_deliveries
  add column if not exists provider_event_id text;

create index if not exists campaign_deliveries_provider_message_idx
  on public.campaign_deliveries(provider_message_id);

create unique index if not exists campaign_deliveries_provider_event_idx
  on public.campaign_deliveries(provider_event_id)
  where provider_event_id is not null;