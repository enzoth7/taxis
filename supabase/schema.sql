-- Fotos privadas, organizadas por usuario, conductor y fecha.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'taxi-tickets', 'taxi-tickets', false, 15728640,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do nothing;

create table public.taxi_ticket_uploads (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  driver_id text not null,
  vehicle_id text not null,
  ticket_date date not null,
  odometer_start_km numeric(10, 1) not null check (odometer_start_km >= 0),
  photo_path text not null unique,
  mime_type text not null,
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 15728640),
  status text not null default 'revision' check (status in ('revision', 'validado')),
  ticket_number text,
  amount_uyu numeric(12, 2) check (amount_uyu > 0),
  distance_km numeric(10, 2) check (distance_km >= 0),
  payment_method text check (payment_method in ('efectivo', 'tarjeta', 'transferencia')),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint taxi_ticket_path_matches_record check (
    split_part(photo_path, '/', 1) = owner_id::text and
    split_part(photo_path, '/', 2) = driver_id and
    split_part(photo_path, '/', 3) = ticket_date::text
  )
);

create index taxi_ticket_uploads_day_driver_idx
  on public.taxi_ticket_uploads (ticket_date desc, driver_id, created_at desc);

alter table public.taxi_ticket_uploads enable row level security;
grant select, insert on public.taxi_ticket_uploads to authenticated;

create policy "ticket_owner_reads" on public.taxi_ticket_uploads
  for select to authenticated
  using (owner_id = (select auth.uid()));

create policy "ticket_owner_uploads" on public.taxi_ticket_uploads
  for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy "ticket_photo_owner_uploads" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'taxi-tickets' and
    (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "ticket_photo_owner_reads" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'taxi-tickets' and
    (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "ticket_photo_owner_removes_orphans" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'taxi-tickets' and
    (storage.foldername(name))[1] = (select auth.uid())::text
  );
