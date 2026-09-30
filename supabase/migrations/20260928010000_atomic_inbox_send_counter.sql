create or replace function public.increment_inbox_send_count(
  p_inbox_id uuid
)
returns public.connected_inboxes
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_inbox public.connected_inboxes;
begin
  update public.connected_inboxes
  set
    daily_sent_count =
      case
        when daily_count_date = timezone('utc', now())::date
          then coalesce(daily_sent_count, 0) + 1
        else 1
      end,
    daily_count_date = timezone('utc', now())::date,
    last_sent_at = timezone('utc', now()),
    updated_at = timezone('utc', now())
  where id = p_inbox_id
  returning * into updated_inbox;

  if updated_inbox.id is null then
    raise exception 'Connected inbox not found.';
  end if;

  return updated_inbox;
end;
$$;

revoke all on function public.increment_inbox_send_count(uuid)
from public;

grant execute on function public.increment_inbox_send_count(uuid)
to service_role;