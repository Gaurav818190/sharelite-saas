-- The application uses the server-only service-role key with PostgREST while
-- forwarding each user's access token for RLS authorization. Keep these grants
-- limited to the trusted service_role and preserve table RLS policies.
grant usage on schema public to service_role;
grant select, insert, update, delete on public.leads to service_role;
grant select, insert, update, delete on public.profiles to service_role;
grant select, insert, update, delete on public.subscriptions to service_role;
grant select, insert, update, delete on public.templates to service_role;
grant select, insert, update, delete on public.campaigns to service_role;
grant select, insert, update, delete on public.ai_usage to service_role;
grant select, insert, update, delete on public.email_usage to service_role;
grant select, insert, update, delete on public.campaign_deliveries to service_role;
