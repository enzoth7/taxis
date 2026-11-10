create table public.taxi_mobiles (
  id text primary key,
  owner_id uuid not null references auth.users(id),
  mobile_number text not null check (mobile_number ~ '^[0-9]+$'),
  plate text,
  stand text,
  brand text,
  model text,
  year integer,
  status text not null default 'Sin confirmar',
  unique (owner_id, mobile_number)
);

create table public.taxi_drivers (
  id text primary key,
  owner_id uuid not null references auth.users(id),
  name text not null,
  source_name text,
  document text,
  phone text,
  license text,
  status text not null default 'Sin confirmar',
  assigned_mobile_id text references public.taxi_mobiles(id),
  unique (owner_id, name)
);

create index taxi_mobiles_owner_idx on public.taxi_mobiles (owner_id);
create index taxi_drivers_owner_idx on public.taxi_drivers (owner_id);

alter table public.taxi_mobiles enable row level security;
alter table public.taxi_drivers enable row level security;
grant select, insert, update on public.taxi_mobiles, public.taxi_drivers to authenticated;

create policy taxi_mobiles_owner_select on public.taxi_mobiles
  for select to authenticated using (owner_id = (select auth.uid()));
create policy taxi_mobiles_owner_insert on public.taxi_mobiles
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy taxi_mobiles_owner_update on public.taxi_mobiles
  for update to authenticated using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
create policy taxi_drivers_owner_select on public.taxi_drivers
  for select to authenticated using (owner_id = (select auth.uid()));
create policy taxi_drivers_owner_insert on public.taxi_drivers
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy taxi_drivers_owner_update on public.taxi_drivers
  for update to authenticated using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

insert into public.taxi_mobiles (id, owner_id, mobile_number)
select 'movil-' || mobile_number, owner_id, mobile_number
from public.taxi_archive_rows
where row_kind = 'shift' and mobile_number ~ '^[0-9]+$'
group by owner_id, mobile_number
on conflict (id) do nothing;

insert into public.taxi_drivers (id, owner_id, name, source_name)
select 'real-' || trim(both '-' from regexp_replace(lower(driver_name), '[^a-z0-9]+', '-', 'g')),
  owner_id, driver_name, driver_name
from public.taxi_archive_rows
where row_kind = 'shift' and nullif(trim(driver_name), '') is not null
group by owner_id, driver_name
on conflict (id) do nothing;
