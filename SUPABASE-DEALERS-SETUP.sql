create extension if not exists pgcrypto;

create table if not exists public.dealers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  login text not null unique,
  password text not null,
  is_active boolean not null default true,
  session_token text,
  session_created_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.dealer_prices (
  id uuid primary key default gen_random_uuid(),
  dealer_id uuid not null references public.dealers(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  dealer_price integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (dealer_id, product_id)
);

create or replace view public.dealer_prices_view as
select
  dp.id,
  d.id as dealer_id,
  d.name as dealer_name,
  d.login as dealer_login,
  p.id as product_id,
  p.name as product_name,
  p.price as retail_price,
  dp.dealer_price,
  coalesce(dp.dealer_price, p.price) as effective_price
from public.dealer_prices dp
join public.dealers d on d.id = dp.dealer_id
join public.products p on p.id = dp.product_id;

alter table public.dealers enable row level security;
alter table public.dealer_prices enable row level security;

drop policy if exists "authenticated can manage dealers" on public.dealers;
create policy "authenticated can manage dealers"
on public.dealers
for all
to authenticated
using (true)
with check (true);

drop policy if exists "authenticated can manage dealer prices" on public.dealer_prices;
create policy "authenticated can manage dealer prices"
on public.dealer_prices
for all
to authenticated
using (true)
with check (true);

create or replace function public.dealer_login(p_login text, p_password text)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_dealer public.dealers;
  v_token text;
begin
  select * into v_dealer
  from public.dealers
  where login = p_login and password = p_password and is_active = true
  limit 1;

  if v_dealer.id is null then
    return null;
  end if;

  v_token := gen_random_uuid()::text;

  update public.dealers
  set session_token = v_token,
      session_created_at = now(),
      updated_at = now()
  where id = v_dealer.id;

  return jsonb_build_object(
    'id', v_dealer.id,
    'name', v_dealer.name,
    'login', v_dealer.login,
    'session_token', v_token
  );
end;
$$;

create or replace function public.dealer_session(p_session_token text)
returns jsonb
language sql
security definer
as $$
  select jsonb_build_object(
    'id', d.id,
    'name', d.name,
    'login', d.login,
    'session_token', d.session_token
  )
  from public.dealers d
  where d.session_token = p_session_token and d.is_active = true
  limit 1;
$$;

create or replace function public.dealer_logout(p_session_token text)
returns void
language sql
security definer
as $$
  update public.dealers
  set session_token = null,
      session_created_at = null,
      updated_at = now()
  where session_token = p_session_token;
$$;

create or replace function public.dealer_catalog(p_session_token text)
returns table(
  dealer_id uuid,
  product_id uuid,
  category text,
  brand text,
  model text,
  name text,
  specs text,
  description text,
  retail_price integer,
  dealer_price integer,
  warranty text,
  status text,
  eta text,
  image_url text,
  pdf_url text,
  sort_order integer
)
language sql
security definer
as $$
  select
    d.id as dealer_id,
    p.id as product_id,
    p.category,
    p.brand,
    p.model,
    p.name,
    p.specs,
    p.description,
    p.price as retail_price,
    coalesce(dp.dealer_price, p.price) as dealer_price,
    p.warranty,
    p.status,
    p.eta,
    p.image_url,
    p.pdf_url,
    p.sort_order
  from public.dealers d
  join public.products p on p.is_active = true and coalesce(p.hidden_by_admin, false) = false
  left join public.dealer_prices dp on dp.dealer_id = d.id and dp.product_id = p.id
  where d.session_token = p_session_token and d.is_active = true
  order by p.sort_order asc nulls last, p.name asc;
$$;

create or replace function public.dealer_product(p_session_token text, p_product_id uuid)
returns jsonb
language sql
security definer
as $$
  select jsonb_build_object(
    'dealer_id', d.id,
    'product_id', p.id,
    'category', p.category,
    'brand', p.brand,
    'model', p.model,
    'name', p.name,
    'specs', p.specs,
    'description', p.description,
    'retail_price', p.price,
    'dealer_price', coalesce(dp.dealer_price, p.price),
    'warranty', p.warranty,
    'status', p.status,
    'eta', p.eta,
    'image_url', p.image_url,
    'pdf_url', p.pdf_url,
    'sort_order', p.sort_order
  )
  from public.dealers d
  join public.products p on p.id = p_product_id and p.is_active = true and coalesce(p.hidden_by_admin, false) = false
  left join public.dealer_prices dp on dp.dealer_id = d.id and dp.product_id = p.id
  where d.session_token = p_session_token and d.is_active = true
  limit 1;
$$;

grant execute on function public.dealer_login(text, text) to anon, authenticated;
grant execute on function public.dealer_session(text) to anon, authenticated;
grant execute on function public.dealer_logout(text) to anon, authenticated;
grant execute on function public.dealer_catalog(text) to anon, authenticated;
grant execute on function public.dealer_product(text, uuid) to anon, authenticated;
