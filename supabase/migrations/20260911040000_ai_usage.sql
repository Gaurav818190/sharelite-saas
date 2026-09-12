alter table public.leads
  add column if not exists validation_status text not null default 'unknown'
    check (validation_status in ('unknown', 'valid', 'invalid', 'risky', 'disposable', 'error')),
  add column if not exists validation_reason text,
  add column if not exists validated_at timestamptz;

create index if not exists leads_user_validation_status_idx
  on public.leads(user_id, validation_status);

create index if not exists leads_user_validated_at_idx
  on public.leads(user_id, validated_at desc);
