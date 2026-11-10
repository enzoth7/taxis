const driverNames = [
  'Anibal Peralta', 'Antonella', 'Bettiana', 'Cardozo', 'Carlos Coito',
  'Curbelo', 'Diego', 'Eduardo', 'Federico', 'Federico Mas', 'Fernando',
  'J. Rodriguez', 'Juan De Agustini', 'Marcelo', 'Milton', 'Pablo',
  'Sant Angelo', 'Santana', 'Sarago', 'W Volpe', 'Yanel', 'Zanoniani',
]

const legacyDriverId = id => /^chofer-(?:[1-9]|1[0-5])$/.test(id)
const driverId = name => `real-${name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`

export const VEHICLES = Array.from({ length: 5 }, (_, i) => ({
  id: `taxi-${i + 1}`,
  plate: `IAC ${111 + i}`,
  stand: 'Sin asignar',
  brand: '',
  model: '',
  year: '',
  status: 'Activo',
}))

export const DRIVERS = driverNames.map(name => ({
  id: driverId(name),
  name,
  assignedVehicleId: '',
  document: '',
  phone: '',
  license: '',
  status: 'Sin confirmar',
}))

export function currentVehicles(state) {
  const records = state.catalog?.vehicles || {}
  return [...VEHICLES.map(vehicle => ({ ...vehicle, ...records[vehicle.id] })), ...Object.entries(records).filter(([id]) => !VEHICLES.some(base => base.id === id)).map(([id, vehicle]) => ({ ...vehicle, id }))]
}

export function currentDrivers(state) {
  const records = state.catalog?.drivers || {}
  return [...DRIVERS.map(driver => {
    const saved = records[driver.id] || {}
    return { ...driver, ...saved, name: saved.name || driver.name }
  }), ...Object.entries(records).filter(([id]) => !legacyDriverId(id) && !DRIVERS.some(base => base.id === id)).map(([id, driver]) => ({ ...driver, id }))]
}

export function localDate(date = new Date()) {
  const d = new Date(date)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function daysBefore(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return localDate(d)
}

export function seedState() {
  return {
    version: 2,
    tickets: [],
    shifts: [],
    movements: [],
    settings: { commissionPct: 30 },
    catalog: { drivers: {}, vehicles: {} },
  }
}
