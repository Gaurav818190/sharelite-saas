create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_name text not null check (char_length(trim(customer_name)) between 1 and 200),
  customer_email text,
  rating integer not null check (rating between 1 and 5),
  title text not null check (char_length(trim(title)) between 1 and 200),
  content text not null check (char_length(trim(content)) between 1 and 5000),
  status text not null default 'published' check (status in ('draft', 'published')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists reviews_user_id_idx on public.reviews(user_id);
create index if not exists reviews_user_created_at_idx on public.reviews(user_id, created_at desc);
create index if not exists reviews_user_status_idx on public.reviews(user_id, status);

drop trigger if exists reviews_set_updated_at on public.reviews;
create trigger reviews_set_updated_at before update on public.reviews
for each row execute function public.set_updated_at();

alter table public.reviews enable row level security;

drop policy if exists reviews_select_own on public.reviews;
create policy reviews_select_own on public.reviews for select to authenticated using (user_id = auth.uid());
drop policy if exists reviews_insert_own on public.reviews;
create policy reviews_insert_own on public.reviews for insert to authenticated with check (user_id = auth.uid());
drop policy if exists reviews_update_own on public.reviews;
create policy reviews_update_own on public.reviews for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists reviews_delete_own on public.reviews;
create policy reviews_delete_own on public.reviews for delete to authenticated using (user_id = auth.uid());

-- Normal requests use the authenticated user's JWT and remain protected by RLS.
grant select, insert, update, delete on public.reviews to authenticated;
-- Trusted server-side operations such as migrations and administrative maintenance.
grant select, insert, update, delete on public.reviews to service_role;
