import { driverId } from '../data/catalog.js'
import { supabase } from './supabase.js'

export function catalogFromArchive(shifts) {
  const vehicles = {}
  const drivers = {}
  for (const row of shifts) {
    const mobile = String(row.mobile_number || '').trim()
    const name = String(row.driver_name || '').trim()
    if (/^\d+$/.test(mobile)) {
      const id = `movil-${mobile}`
      vehicles[id] ||= { id, mobileNumber: mobile, plate: '', stand: 'Sin asignar', status: 'Sin confirmar' }
    }
    if (name) {
      const id = driverId(name)
      drivers[id] ||= { id, name, sourceName: name, assignedVehicleId: '', status: 'Sin confirmar' }
    }
  }
  return { vehicles, drivers }
}

export async function listFleetCatalog() {
  if (!supabase) throw new Error('Supabase no está configurado.')
  const [mobiles, drivers] = await Promise.all([
    supabase.from('taxi_mobiles').select('*').order('mobile_number'),
    supabase.from('taxi_drivers').select('*').order('name'),
  ])
  if (mobiles.error || drivers.error) throw new Error('No se pudo cargar el catálogo de flota.')
  return {
    vehicles: Object.fromEntries(mobiles.data.map(row => [row.id, {
      id: row.id, mobileNumber: row.mobile_number, plate: row.plate || '', stand: row.stand || 'Sin asignar',
      brand: row.brand || '', model: row.model || '', year: row.year || '', status: row.status,
    }])),
    drivers: Object.fromEntries(drivers.data.map(row => [row.id, {
      id: row.id, name: row.name, sourceName: row.source_name || row.name,
      document: row.document || '', phone: row.phone || '', license: row.license || '',
      status: row.status, assignedVehicleId: row.assigned_mobile_id || '',
    }])),
  }
}

export async function saveFleetRecord(type, id, value, userId) {
  if (!supabase || !userId) throw new Error('Ingresá para guardar en la flota.')
  const table = type === 'vehicles' ? 'taxi_mobiles' : 'taxi_drivers'
  const row = type === 'vehicles'
    ? { id, owner_id: userId, mobile_number: value.mobileNumber, plate: value.plate || null,
        stand: value.stand || null, brand: value.brand || null, model: value.model || null,
        year: value.year ? Number(value.year) : null, status: value.status || 'Sin confirmar' }
    : { id, owner_id: userId, name: value.name, source_name: value.sourceName || value.name,
        document: value.document || null, phone: value.phone || null, license: value.license || null,
        assigned_mobile_id: value.assignedVehicleId || null, status: value.status || 'Sin confirmar' }
  const { error } = await supabase.from(table).upsert(row, { onConflict: 'id' })
  if (error) throw new Error('No se pudo guardar en Supabase.')
}
