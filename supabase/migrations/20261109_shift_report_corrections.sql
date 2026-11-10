-- La fecha y el conductor pueden corregirse al revisar la foto.
-- El archivo sigue atado al usuario y al identificador de la jornada.
alter table public.taxi_shift_reports
  drop constraint shift_report_sheet_path,
  drop constraint shift_report_meter_path;

alter table public.taxi_shift_reports
  add constraint shift_report_sheet_path check (
    sheet_photo_path is null or (
      split_part(sheet_photo_path, '/', 1) = owner_id::text and
      split_part(sheet_photo_path, '/', 4) = id::text and
      split_part(sheet_photo_path, '/', 5) like 'sheet.%'
    )
  ),
  add constraint shift_report_meter_path check (
    meter_photo_path is null or (
      split_part(meter_photo_path, '/', 1) = owner_id::text and
      split_part(meter_photo_path, '/', 4) = id::text and
      split_part(meter_photo_path, '/', 5) like 'meter.%'
    )
  );
