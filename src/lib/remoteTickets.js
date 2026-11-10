import { safeId } from './core.js'
import { supabase } from './supabase.js'

const BUCKET = 'taxi-tickets'
const EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
}

export async function uploadTicketPhoto(values, file) {
  if (!EXTENSIONS[file.type] || file.size < 1 || file.size > 15 * 1024 * 1024) {
    throw new Error('Elegí una foto JPG, PNG, WEBP o HEIC de hasta 15 MB.')
  }
  if (!supabase) throw new Error('La carga de fotos no está configurada.')
  const { data: auth, error: authError } = await supabase.auth.getUser()
  if (authError || !auth.user) throw new Error('Ingresá con el usuario de prueba para subir la foto.')

  const id = safeId()
  const photoPath = `${auth.user.id}/${values.driverId}/${values.date}/${id}.${EXTENSIONS[file.type]}`
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(photoPath, file, {
    cacheControl: '3600', contentType: file.type, upsert: false,
  })
  if (uploadError) throw new Error('No se pudo subir la foto. Revisá la conexión e intentá de nuevo.')

  const { error: recordError } = await supabase.from('taxi_ticket_uploads').insert({
    id,
    owner_id: auth.user.id,
    driver_id: values.driverId,
    vehicle_id: values.vehicleId,
    ticket_date: values.date,
    odometer_start_km: Number(values.odometerStartKm),
    photo_path: photoPath,
    mime_type: file.type,
    size_bytes: file.size,
  })
  if (recordError) {
    await supabase.storage.from(BUCKET).remove([photoPath])
    throw new Error('La foto subió, pero no se pudo registrar. Intentá de nuevo.')
  }
  return { id, photoPath, ownerId: auth.user.id }
}

export async function downloadTicketPhoto(photoPath) {
  if (!supabase || !photoPath) return null
  const { data, error } = await supabase.storage.from(BUCKET).download(photoPath)
  return error ? null : data
}
