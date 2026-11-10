import { supabase } from './supabase.js'

export async function listJornadas() {
  if (!supabase) throw new Error('La conexión con las jornadas no está configurada.')
  const rows = []
  for (let start = 0; ; start += 500) {
    const { data, error } = await supabase.from('taxi_jornadas')
      .select('id,origen,fecha,venta_total_uyu,foto_planilla_path,registro')
      .order('fecha', { ascending: false })
      .order('id')
      .range(start, start + 499)
    if (error) throw new Error('No se pudieron cargar las jornadas.')
    rows.push(...data)
    if (data.length < 500) return rows
  }
}

export function splitJornadas(rows) {
  const archiveShifts = []
  const reports = []
  for (const row of rows) {
    if (row.origen === 'hoja') {
      archiveShifts.push({ ...row.registro, archive_photo_path: row.foto_planilla_path })
    } else if (row.origen === 'conductor') {
      reports.push({ ...row.registro, reported_sales_uyu: row.venta_total_uyu })
    }
  }
  return { archiveShifts, reports }
}
