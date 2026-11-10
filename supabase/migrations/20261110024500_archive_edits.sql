-- Las correcciones editan solo campos interpretados; la fila original permanece intacta.
grant update (
  record_date, mobile_number, driver_name, shift_label,
  sales_uyu, commission_uyu, fiado_uyu,
  odometer_start_km, odometer_end_km
) on public.taxi_archive_rows to authenticated;

create policy taxi_archive_owner_edits on public.taxi_archive_rows
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
