import { safeId } from './core.js'
import { supabase } from './supabase.js'

const BUCKET = 'taxi-tickets'
const EXTENSIONS = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
  'image/heic': 'heic', 'image/heif': 'heif',
}

function checkPhoto(file) {
  if (!file) return
  if (!EXTENSIONS[file.type] || file.size < 1 || file.size > 15 * 1024 * 1024) {
    throw new Error('Elegí una foto JPG, PNG, WEBP o HEIC de hasta 15 MB.')
  }
}

export async function uploadShiftReport(values, photos) {
  const { sheet, meter } = photos
  if (!sheet && !meter) throw new Error('Adjuntá al menos una de las dos fotos.')
  checkPhoto(sheet)
  checkPhoto(meter)
  if (!supabase) throw new Error('La carga de fotos no está configurada.')
  const { data: auth, error: authError } = await supabase.auth.getUser()
  if (authError || !auth.user) throw new Error('Ingresá para enviar las fotos.')

  const id = safeId()
  const prefix = `${auth.user.id}/${values.driverId}/${values.date}/${id}`
  const uploaded = []
  try {
    for (const [kind, file] of [['sheet', sheet], ['meter', meter]]) {
      if (!file) continue
      const path = `${prefix}/${kind}.${EXTENSIONS[file.type]}`
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
        cacheControl: '3600', contentType: file.type, upsert: false,
      })
      if (error) throw new Error(`No se pudo subir la foto de ${kind === 'sheet' ? 'la planilla' : 'el taxímetro'}. Intentá de nuevo.`)
      uploaded.push(path)
    }
    const { data, error } = await supabase.from('taxi_shift_reports').insert({
      id, owner_id: auth.user.id, driver_id: values.driverId, vehicle_id: values.vehicleId,
      shift_date: values.date,
      odometer_start_km: values.odometerStartKm === '' ? null : Number(values.odometerStartKm),
      sheet_photo_path: uploaded.find(path => path.includes('/sheet.')) || null,
      meter_photo_path: uploaded.find(path => path.includes('/meter.')) || null,
    }).select().single()
    if (error) throw new Error('Las fotos subieron, pero no se pudo registrar la jornada. Intentá de nuevo.')
    return data
  } catch (error) {
    if (uploaded.length) await supabase.storage.from(BUCKET).remove(uploaded)
    throw error
  }
}

export async function listShiftReports() {
  if (!supabase) throw new Error('La conexión no está configurada.')
  const { data, error } = await supabase.from('taxi_shift_reports')
    .select('*').order('shift_date', { ascending: false }).order('created_at', { ascending: false }).limit(200)
  if (error) throw new Error('No se pudieron cargar las jornadas.')
  return data
}

export async function updateShiftReport(id, patch) {
  if (!supabase) throw new Error('La conexión no está configurada.')
  const { data, error } = await supabase.from('taxi_shift_reports').update(patch).eq('id', id).select().single()
  if (error) throw new Error('No se pudo guardar la revisión.')
  return data
}

export async function downloadShiftPhoto(path) {
  if (!supabase || !path) return null
  const { data, error } = await supabase.storage.from(BUCKET).download(path)
  if (error) throw new Error('No se pudo abrir la fotografía.')
  return data
}
