create table if not exists public.taxi_tirilla_archive_images (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  batch text not null,
  original_filename text not null,
  original_sha256 text not null unique check (original_sha256 ~ '^[0-9a-f]{64}$'),
  webp_sha256 text not null unique check (webp_sha256 ~ '^[0-9a-f]{64}$'),
  storage_path text not null unique,
  webp_size_bytes integer not null check (webp_size_bytes > 0 and webp_size_bytes <= 15728640),
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  photo_type text not null default 'sin_clasificar'
    check (photo_type in ('sin_clasificar', 'planilla', 'taximetro', 'otro', 'ilegible')),
  record_date date,
  mobile_number text,
  driver_name text,
  start_time time,
  end_time time,
  odometer_start_km numeric,
  odometer_end_km numeric,
  sheet_total_uyu numeric,
  meter_total_uyu numeric,
  sheet_trip_count integer,
  meter_trip_count integer,
  commission_uyu numeric,
  jornal_pos_uyu numeric,
  fiado_uyu numeric,
  expenses_uyu numeric,
  fuel_uyu numeric,
  total_to_pay_uyu numeric,
  extracted_data jsonb not null default '{}'::jsonb,
  review_flags jsonb not null default '[]'::jsonb,
  review_status text not null default 'pendiente'
    check (review_status in ('pendiente', 'revisar', 'lista', 'ilegible')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists taxi_tirilla_archive_images_batch_date_idx
  on public.taxi_tirilla_archive_images(batch, record_date, mobile_number);
create index if not exists taxi_tirilla_archive_images_owner_idx
  on public.taxi_tirilla_archive_images(owner_id, batch, record_date);

alter table public.taxi_tirilla_archive_images enable row level security;
grant select on public.taxi_tirilla_archive_images to authenticated;
drop policy if exists tirilla_archive_owner_reads on public.taxi_tirilla_archive_images;
create policy tirilla_archive_owner_reads on public.taxi_tirilla_archive_images
  for select to authenticated
  using (owner_id = (select auth.uid()));
