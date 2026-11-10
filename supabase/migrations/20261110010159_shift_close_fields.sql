-- Campos declarados por el conductor al cerrar el turno.
-- Se dejan anulables para conservar jornadas cargadas antes de este formulario.
alter table public.taxi_shift_reports
  add column driver_name text,
  add column started_at timestamptz,
  add column ended_at timestamptz,
  add column reported_sales_uyu numeric(12, 2) check (reported_sales_uyu >= 0),
  add column reported_commission_uyu numeric(12, 2) check (reported_commission_uyu >= 0),
  add column reported_jornal_pos_kind text check (reported_jornal_pos_kind in ('jornal', 'pos')),
  add column reported_jornal_pos_uyu numeric(12, 2) check (reported_jornal_pos_uyu >= 0),
  add column reported_fiado_uyu numeric(12, 2) check (reported_fiado_uyu >= 0),
  add column reported_total_to_pay_uyu numeric(12, 2) check (reported_total_to_pay_uyu >= 0),
  add column reported_expenses_uyu numeric(12, 2) check (reported_expenses_uyu >= 0),
  add column reported_expenses_note text,
  add constraint taxi_shift_report_time_order check (
    started_at is null or ended_at is null or ended_at > started_at
  );

create index taxi_shift_reports_mobile_day_idx
  on public.taxi_shift_reports (mobile_number, shift_date desc);
