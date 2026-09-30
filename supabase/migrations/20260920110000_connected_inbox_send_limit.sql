begin;

create or replace function public.consume_connected_inbox_send(
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
    last_sent_at = timezone('utc', now()),
    updated_at = timezone('utc', now())
  where id = target_inbox_id
  returning * into inbox_row;

  return jsonb_build_object(
    'allowed', true,
    'daily_limit', inbox_row.daily_send_limit,
    'daily_sent_count', inbox_row.daily_sent_count,
    'remaining', greatest(
      inbox_row.daily_send_limit - inbox_row.daily_sent_count,
      0
    )
  );
end;
$$;

revoke all
on function public.consume_connected_inbox_send(uuid)
from public;

grant execute
on function public.consume_connected_inbox_send(uuid)
to authenticated;

commit;