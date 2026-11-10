const driverNames = [
  'Anibal Peralta', 'Antonella', 'Bettiana', 'Cardozo', 'Carlos Coito',
  'Curbelo', 'Diego', 'Eduardo', 'Federico', 'Federico Mas', 'Fernando',
  'J. Rodriguez', 'Juan De Agustini', 'Marcelo', 'Milton', 'Pablo',
  'Sant Angelo', 'Santana', 'Sarago', 'W Volpe', 'Yanel', 'Zanoniani',
]

const legacyDriverId = id => /^chofer-(?:[1-9]|1[0-5])$/.test(id)
const legacyVehicleId = id => /^taxi-[1-5]$/.test(id)
const driverId = name => `real-${name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`

export const VEHICLES = ['2', '4', '12', '13'].map(mobileNumber => ({
  id: `movil-${mobileNumber}`,
  mobileNumber,
  stand: 'Sin asignar',
  brand: '',
  model: '',
  year: '',
  status: 'Sin confirmar',
}))

export const DRIVERS = driverNames.map(name => ({
  id: driverId(name),
  name,
  sourceName: name,
  assignedVehicleId: '',
  document: '',
  phone: '',
  license: '',
  status: 'Sin confirmar',
}))

export function currentVehicles(state) {
  const records = state.catalog?.vehicles || {}
  return [
    ...VEHICLES.map(vehicle => ({ ...vehicle, ...records[vehicle.id], mobileNumber: vehicle.mobileNumber })),
    ...Object.entries(records)
      .filter(([id]) => !legacyVehicleId(id) && !VEHICLES.some(base => base.id === id))
      .map(([id, vehicle]) => ({ ...vehicle, id, mobileNumber: vehicle.mobileNumber || '' })),
  ]
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
