import { supabase } from './supabase.js'

const FIELDS = 'id,source_file_id,source_file_title,source_tab,source_row,record_date,mobile_number,driver_name,driver_name_raw,shift_label,sales_uyu,commission_uyu,fiado_uyu,odometer_start_km,odometer_end_km'

export async function listArchiveShifts() {
  if (!supabase) throw new Error('La conexión con el historial no está configurada.')
  const rows = []
  for (let start = 0; ; start += 500) {
    const { data, error } = await supabase.from('taxi_archive_rows').select(FIELDS)
      .eq('row_kind', 'shift').order('record_date', { ascending: false })
      .order('source_file_id').order('source_tab').order('source_row')
      .range(start, start + 499)
    if (error) throw new Error('No se pudo cargar el historial de jornadas.')
    rows.push(...data)
    if (data.length < 500) return rows
  }
}

export async function updateArchiveShift(id, patch) {
  if (!supabase) throw new Error('La conexión con el historial no está configurada.')
  const { data, error } = await supabase.from('taxi_archive_rows').update(patch).eq('id', id).select(FIELDS).single()
  if (error) throw new Error('No se pudo guardar la corrección.')
  return data
}
