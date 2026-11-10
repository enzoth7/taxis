-- Una jornada puede tener una planilla, un detalle de taxímetro o ambos.
-- Las cifras de cada fuente se conservan por separado para revisar diferencias.
create table public.taxi_shift_reports (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  driver_id text not null,
  vehicle_id text not null,
  shift_date date not null,
  mobile_number text,
  odometer_start_km numeric(10, 1) check (odometer_start_km >= 0),
  odometer_end_km numeric(10, 1) check (odometer_end_km >= 0),
  sheet_photo_path text unique,
  meter_photo_path text unique,
  sheet_trip_count integer check (sheet_trip_count >= 0),
  meter_trip_count integer check (meter_trip_count >= 0),
  sheet_total_uyu numeric(12, 2) check (sheet_total_uyu >= 0),
  meter_total_uyu numeric(12, 2) check (meter_total_uyu >= 0),
  sheet_trip_lines text,
  meter_trip_lines text,
  review_notes text,
  status text not null default 'revision' check (status in ('revision', 'validado')),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint shift_report_has_photo check (sheet_photo_path is not null or meter_photo_path is not null),
  constraint shift_report_odometer_order check (odometer_end_km is null or odometer_start_km is null or odometer_end_km >= odometer_start_km),
  constraint shift_report_sheet_path check (
    sheet_photo_path is null or sheet_photo_path like owner_id::text || '/' || driver_id || '/' || shift_date::text || '/' || id::text || '/sheet.%'
  ),
  constraint shift_report_meter_path check (
    meter_photo_path is null or meter_photo_path like owner_id::text || '/' || driver_id || '/' || shift_date::text || '/' || id::text || '/meter.%'
  )
);

create index taxi_shift_reports_day_driver_idx
  on public.taxi_shift_reports (shift_date desc, driver_id, created_at desc);

alter table public.taxi_shift_reports enable row level security;
grant select, insert, update on public.taxi_shift_reports to authenticated;

create policy "shift_report_owner_reads" on public.taxi_shift_reports
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "shift_report_owner_uploads" on public.taxi_shift_reports
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "shift_report_owner_reviews" on public.taxi_shift_reports
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
