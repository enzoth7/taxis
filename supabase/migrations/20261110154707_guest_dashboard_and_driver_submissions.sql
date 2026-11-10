-- Acceso temporal sin credenciales al mismo historial de Taxi Control.
-- La lectura publica se limita a los registros de este proyecto.
grant select on public.taxi_archive_rows,
                public.taxi_tirilla_archive_images,
                public.taxi_shift_reports,
                public.taxi_mobiles,
                public.taxi_drivers
to anon;

create policy taxi_public_archive_reads on public.taxi_archive_rows
  for select to anon
  using (owner_id = '8c016996-aba5-416c-b0d0-e7f573b6b2d7'::uuid);

create policy taxi_public_tirilla_reads on public.taxi_tirilla_archive_images
  for select to anon
  using (owner_id = '8c016996-aba5-416c-b0d0-e7f573b6b2d7'::uuid);

create policy taxi_public_report_reads on public.taxi_shift_reports
  for select to anon
  using (owner_id = '8c016996-aba5-416c-b0d0-e7f573b6b2d7'::uuid);

create policy taxi_public_mobile_reads on public.taxi_mobiles
  for select to anon
  using (owner_id = '8c016996-aba5-416c-b0d0-e7f573b6b2d7'::uuid);

create policy taxi_public_driver_reads on public.taxi_drivers
  for select to anon
  using (owner_id = '8c016996-aba5-416c-b0d0-e7f573b6b2d7'::uuid);

grant select on public.taxi_jornadas to anon;

-- Solo se admiten cierres nuevos pendientes de revision.
grant insert on public.taxi_shift_reports to anon;
create policy taxi_public_report_submits on public.taxi_shift_reports
  for insert to anon
  with check (
    owner_id = '8c016996-aba5-416c-b0d0-e7f573b6b2d7'::uuid
    and driver_id ~ '^public-real-[a-z0-9-]{1,60}$'
    and length(trim(driver_name)) between 1 and 120
    and mobile_number ~ '^[0-9]{1,6}$'
    and shift_date = (started_at at time zone 'America/Montevideo')::date
    and ended_at > started_at
    and status = 'revision'
    and reviewed_at is null
    and review_notes is null
    and sheet_trip_count is null
    and meter_trip_count is null
    and sheet_total_uyu is null
    and meter_total_uyu is null
    and sheet_trip_lines is null
    and meter_trip_lines is null
  );

-- Las fotos historicas se pueden abrir, pero el bucket sigue privado.
-- El permiso de lectura solo cubre descargas, no el listado de archivos.
create policy taxi_public_photo_downloads on storage.objects
  for select to anon
  using (
    bucket_id = 'taxi-tickets'
    and (storage.foldername(name))[1] = '8c016996-aba5-416c-b0d0-e7f573b6b2d7'
    and storage.allow_any_operation(array['object.get_authenticated_info', 'object.get_authenticated'])
  );

-- Las cargas publicas solo pueden crear fotos de nuevas jornadas.
create policy taxi_public_photo_uploads on storage.objects
  for insert to anon
  with check (
    bucket_id = 'taxi-tickets'
    and name ~ '^8c016996-aba5-416c-b0d0-e7f573b6b2d7/public-real-[a-z0-9-]{1,60}/[0-9]{4}-[0-9]{2}-[0-9]{2}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/(sheet|meter)\.(jpg|png|webp|heic|heif)$'
  );
