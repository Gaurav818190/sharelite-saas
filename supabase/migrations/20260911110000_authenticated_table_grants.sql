-- PostgREST requests from the application carry the user's access token, so
-- Supabase evaluates them as the authenticated role. RLS remains the isolation
-- boundary; these grants only make the existing user-scoped policies reachable.
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.leads to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.subscriptions to authenticated;
grant select, insert, update, delete on public.templates to authenticated;
grant select, insert, update, delete on public.campaigns to authenticated;
grant select, insert, update, delete on public.ai_usage to authenticated;
grant select, insert, update, delete on public.email_usage to authenticated;
grant select, insert, update, delete on public.campaign_deliveries to authenticated;
