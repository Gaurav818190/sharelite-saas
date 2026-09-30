begin;

create or replace function public.reserve_connected_inbox_send(
  target_inbox_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  inbox_row public.connected_inboxes%rowtype;
  today_date date := current_date;
begin
  select *
  into inbox_row
  from public.connected_inboxes
  where id = target_inbox_id
    and user_id = auth.uid()
  for update;

  if not found then
    raise exception 'Connected inbox not found';
  end if;

  if inbox_row.status <> 'active' then
    raise exception 'Connected inbox is not active';
  end if;

  if inbox_row.daily_count_date <> today_date then
    update public.connected_inboxes
    set
      daily_count_date = today_date,
      daily_sent_count = 0,
      updated_at = timezone('utc', now())
    where id = target_inbox_id
    returning * into inbox_row;
  end if;

  if inbox_row.daily_sent_count >= inbox_row.daily_send_limit then
    return jsonb_build_object(
      'allowed', false,
      'daily_limit', inbox_row.daily_send_limit,
      'daily_sent_count', inbox_row.daily_sent_count,
      'remaining', 0
    );
  end if;

  update public.connected_inboxes
  set
    daily_sent_count = daily_sent_count + 1,
    updated_at = timezone('utc', now())
  where id = target_inbox_id
  returning * into inbox_row;

  return jsonb_build_object(
    'allowed', true,
    'daily_limit', inbox_row.daily_send_limit,
    'daily_sent_count', inbox_row.daily_sent_count,
    'remaining',
      greatest(
        inbox_row.daily_send_limit - inbox_row.daily_sent_count,
        0
      )
  );
end;
$$;

create or replace function public.release_connected_inbox_send(
  target_inbox_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer;
begin
  update public.connected_inboxes
  set
    daily_sent_count = greatest(daily_sent_count - 1, 0),
    updated_at = timezone('utc', now())
  where id = target_inbox_id
    and user_id = auth.uid()
    and daily_count_date = current_date
    and daily_sent_count > 0;

  get diagnostics updated_count = row_count;

  return updated_count = 1;
end;
$$;

revoke all
on function public.reserve_connected_inbox_send(uuid)
from public;

revoke all
on function public.release_connected_inbox_send(uuid)
from public;

grant execute
on function public.reserve_connected_inbox_send(uuid)
to authenticated;

grant execute
on function public.release_connected_inbox_send(uuid)
to authenticated;

commit;