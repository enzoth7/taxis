create or replace view public.taxi_jornadas with (security_invoker = true) as
select a.id, a.owner_id, 'hoja'::text as origen, a.record_date as fecha,
       a.mobile_number as movil, a.driver_name as conductor,
       a.sales_uyu as venta_total_uyu,
       coalesce(a.commission_uyu, p.commission_uyu, linked.commission_uyu) as comision_uyu,
       coalesce(a.fiado_uyu, p.fiado_uyu, linked.fiado_uyu) as fiado_uyu,
       coalesce(a.odometer_start_km, p.odometer_start_km, linked.odometer_start_km) as km_inicial,
       coalesce(a.odometer_end_km, p.odometer_end_km, linked.odometer_end_km) as km_final,
       coalesce(p.jornal_pos_uyu, linked.jornal_pos_uyu) as jornal_pos_uyu,
       coalesce(p.expenses_uyu, linked.expenses_uyu) as gastos_uyu,
       coalesce(p.total_to_pay_uyu, linked.total_to_pay_uyu) as total_a_pagar_uyu,
       coalesce(p.meter_total_uyu, linked.meter_total_uyu) as total_taximetro_uyu,
       coalesce(p.storage_path, linked.storage_path, a.raw_values->>'storage_path') as foto_planilla_path,
       null::text as foto_taximetro_path,
       case when a.raw_values->>'review_status' = 'revisar' then 'revisar' else 'historico' end as estado,
       a.shift_label as horario_anotado,
       to_jsonb(a) || jsonb_build_object(
         'foto_venta_total_uyu', coalesce(p.sheet_total_uyu, linked.sheet_total_uyu),
         'foto_datos_extraidos', coalesce(p.extracted_data, linked.extracted_data),
         'foto_alertas', coalesce(p.review_flags, linked.review_flags)
       ) as registro
from public.taxi_archive_rows a
left join public.taxi_tirilla_archive_images p
  on p.owner_id=a.owner_id and p.original_sha256=a.raw_values->>'original_sha256'
left join lateral (
  select i.storage_path, i.extracted_data, i.review_flags, i.sheet_total_uyu,
         i.commission_uyu, i.fiado_uyu, i.odometer_start_km, i.odometer_end_km,
         i.jornal_pos_uyu, i.expenses_uyu, i.total_to_pay_uyu, i.meter_total_uyu
  from public.taxi_tirilla_archive_images i
  where i.owner_id=a.owner_id and i.linked_archive_row_id=a.id and i.photo_type='planilla'
  order by i.created_at, i.id
  limit 1
) linked on true
where a.row_kind='shift'
union all
select r.id, r.owner_id, 'conductor'::text as origen, r.shift_date as fecha,
       r.mobile_number as movil, r.driver_name as conductor,
       coalesce(r.reported_sales_uyu, r.sheet_total_uyu, r.meter_total_uyu) as venta_total_uyu,
       r.reported_commission_uyu as comision_uyu, r.reported_fiado_uyu as fiado_uyu,
       r.odometer_start_km as km_inicial, r.odometer_end_km as km_final,
       r.reported_jornal_pos_uyu as jornal_pos_uyu, r.reported_expenses_uyu as gastos_uyu,
       r.reported_total_to_pay_uyu as total_a_pagar_uyu, r.meter_total_uyu as total_taximetro_uyu,
       r.sheet_photo_path as foto_planilla_path, r.meter_photo_path as foto_taximetro_path,
       r.status as estado, null::text as horario_anotado,
       to_jsonb(r) as registro
from public.taxi_shift_reports r
union all
select p.id, p.owner_id, 'foto_pendiente'::text, p.record_date,
       p.mobile_number, p.driver_name, p.sheet_total_uyu, p.commission_uyu,
       p.fiado_uyu, p.odometer_start_km, p.odometer_end_km,
       p.jornal_pos_uyu, p.expenses_uyu, p.total_to_pay_uyu, p.meter_total_uyu,
       p.storage_path, null::text, p.review_status, null::text, to_jsonb(p)
from public.taxi_tirilla_archive_images p
where p.linked_archive_row_id is null
  and not exists (
    select 1 from public.taxi_archive_rows a
    where a.owner_id=p.owner_id and a.raw_values->>'original_sha256'=p.original_sha256
  );

revoke all on public.taxi_jornadas from anon;
grant select on public.taxi_jornadas to authenticated;
