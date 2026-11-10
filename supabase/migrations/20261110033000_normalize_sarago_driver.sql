-- El nombre original de la planilla permanece en driver_name_raw.
update public.taxi_archive_rows
set driver_name = 'Roberto Sarago'
where lower(btrim(driver_name)) = 'sarago';

create or replace view public.taxi_jornadas with (security_invoker = true) as
select a.id, a.owner_id, 'hoja'::text as origen, a.record_date as fecha,
       a.mobile_number as movil,
       case when lower(btrim(a.driver_name)) = 'sarago' then 'Roberto Sarago' else a.driver_name end as conductor,
       a.sales_uyu as venta_total_uyu, a.commission_uyu as comision_uyu,
       a.fiado_uyu, a.odometer_start_km as km_inicial, a.odometer_end_km as km_final,
       null::numeric as jornal_pos_uyu, null::numeric as gastos_uyu, null::numeric as total_a_pagar_uyu,
       null::numeric as total_taximetro_uyu,
       coalesce(p.storage_path, a.raw_values->>'storage_path') as foto_planilla_path,
       null::text as foto_taximetro_path,
       case when a.raw_values->>'review_status' = 'revisar' then 'revisar' else 'historico' end as estado,
       a.shift_label as horario_anotado,
       to_jsonb(a) || jsonb_build_object('driver_name',
         case when lower(btrim(a.driver_name)) = 'sarago' then 'Roberto Sarago' else a.driver_name end) as registro
from public.taxi_archive_rows a
left join public.taxi_tirilla_archive_images p
  on p.owner_id=a.owner_id and p.original_sha256=a.raw_values->>'original_sha256'
where a.row_kind='shift'
union all
select r.id, r.owner_id, 'conductor'::text as origen, r.shift_date as fecha,
       r.mobile_number as movil,
       case when lower(btrim(r.driver_name)) = 'sarago' then 'Roberto Sarago' else r.driver_name end as conductor,
       coalesce(r.reported_sales_uyu, r.sheet_total_uyu, r.meter_total_uyu) as venta_total_uyu,
       r.reported_commission_uyu as comision_uyu, r.reported_fiado_uyu as fiado_uyu,
       r.odometer_start_km as km_inicial, r.odometer_end_km as km_final,
       r.reported_jornal_pos_uyu as jornal_pos_uyu, r.reported_expenses_uyu as gastos_uyu,
       r.reported_total_to_pay_uyu as total_a_pagar_uyu, r.meter_total_uyu as total_taximetro_uyu,
       r.sheet_photo_path as foto_planilla_path, r.meter_photo_path as foto_taximetro_path,
       r.status as estado, null::text as horario_anotado,
       to_jsonb(r) || jsonb_build_object('driver_name',
         case when lower(btrim(r.driver_name)) = 'sarago' then 'Roberto Sarago' else r.driver_name end) as registro
from public.taxi_shift_reports r
union all
select p.id, p.owner_id, 'foto_pendiente'::text, p.record_date,
       p.mobile_number,
       case when lower(btrim(p.driver_name)) = 'sarago' then 'Roberto Sarago' else p.driver_name end,
       p.sheet_total_uyu, p.commission_uyu,
       p.fiado_uyu, p.odometer_start_km, p.odometer_end_km,
       p.jornal_pos_uyu, p.expenses_uyu, p.total_to_pay_uyu, p.meter_total_uyu,
       p.storage_path, null::text, p.review_status, null::text,
       to_jsonb(p) || jsonb_build_object('driver_name',
         case when lower(btrim(p.driver_name)) = 'sarago' then 'Roberto Sarago' else p.driver_name end)
from public.taxi_tirilla_archive_images p
where not exists (
  select 1 from public.taxi_archive_rows a
  where a.owner_id=p.owner_id and a.raw_values->>'original_sha256'=p.original_sha256
);

revoke all on public.taxi_jornadas from anon;
grant select on public.taxi_jornadas to authenticated;
