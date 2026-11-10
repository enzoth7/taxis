-- Filas históricas de las hojas de Google Drive, separadas de los cierres con fotos.
-- Los valores y textos originales permiten revisar cualquier interpretación.
create table public.taxi_archive_rows (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  source_file_id text not null,
  source_file_title text not null,
  source_tab text not null,
  source_row integer not null check (source_row > 0),
  row_kind text not null check (row_kind in ('shift', 'monthly_total', 'control_day', 'control_month')),
  record_date date,
  mobile_number text,
  driver_name text,
  driver_name_raw text,
  shift_label text,
  sales_uyu numeric(14, 2),
  commission_uyu numeric(14, 2),
  fiado_uyu numeric(14, 2),
  odometer_start_km numeric(12, 1),
  odometer_end_km numeric(12, 1),
  raw_values jsonb not null,
  raw_display jsonb not null,
  imported_at timestamptz not null default now(),
  unique (source_file_id, source_tab, source_row)
);

create index taxi_archive_rows_owner_date_idx
  on public.taxi_archive_rows (owner_id, row_kind, record_date desc);
create index taxi_archive_rows_driver_idx
  on public.taxi_archive_rows (owner_id, driver_name, record_date desc)
  where row_kind = 'shift';

alter table public.taxi_archive_rows enable row level security;
grant select on public.taxi_archive_rows to authenticated;
create policy taxi_archive_owner_reads on public.taxi_archive_rows
  for select to authenticated using (owner_id = (select auth.uid()));
