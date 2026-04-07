-- One-time setup for retail admin editing via Supabase Auth
-- 1) In Supabase Dashboard open Authentication -> Users -> Add user
-- 2) Create this user:
--    email: compadmin@komputerra.local
--    password: 2V66htmPFf
--    confirm email: true
-- 3) Run this SQL in SQL Editor

create policy "admin full access on products"
on public.products
for all
to authenticated
using ((auth.jwt() ->> 'email') = 'compadmin@komputerra.local')
with check ((auth.jwt() ->> 'email') = 'compadmin@komputerra.local');
