alter table public.taxi_tirilla_archive_images
  add column if not exists linked_archive_row_id uuid
    references public.taxi_archive_rows(id) on delete set null;

create index if not exists taxi_tirilla_archive_images_linked_archive_row_idx
  on public.taxi_tirilla_archive_images(linked_archive_row_id)
  where linked_archive_row_id is not null;

create or replace view public.taxi_jornadas with (security_invoker = true) as
select a.id, a.owner_id, 'hoja'::text as origen, a.record_date as fecha,
       a.mobile_number as movil, a.driver_name as conductor,
       a.sales_uyu as venta_total_uyu, a.commission_uyu as comision_uyu,
       a.fiado_uyu, a.odometer_start_km as km_inicial, a.odometer_end_km as km_final,
       null::numeric as jornal_pos_uyu, null::numeric as gastos_uyu, null::numeric as total_a_pagar_uyu,
       null::numeric as total_taximetro_uyu,
       coalesce(p.storage_path, linked.storage_path, a.raw_values->>'storage_path') as foto_planilla_path,
       null::text as foto_taximetro_path,
       case when a.raw_values->>'review_status' = 'revisar' then 'revisar' else 'historico' end as estado,
       a.shift_label as horario_anotado,
       to_jsonb(a) as registro
from public.taxi_archive_rows a
left join public.taxi_tirilla_archive_images p
  on p.owner_id=a.owner_id and p.original_sha256=a.raw_values->>'original_sha256'
left join lateral (
  select i.storage_path
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
