const legacyDriverId = id => /^chofer-(?:[1-9]|1[0-5])$/.test(id)
const legacyVehicleId = id => /^taxi-[1-5]$/.test(id)
export const driverId = name => `real-${name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`
export const VEHICLES = []
export const DRIVERS = []

export function currentVehicles(state) {
  const records = state.catalog?.vehicles || {}
  return Object.entries(records).filter(([id]) => !legacyVehicleId(id))
    .map(([id, vehicle]) => ({ ...vehicle, id, mobileNumber: String(vehicle.mobileNumber || '') }))
    .sort((a, b) => Number(a.mobileNumber) - Number(b.mobileNumber))
}

export function currentDrivers(state) {
  const records = state.catalog?.drivers || {}
  return Object.entries(records).filter(([id]) => !legacyDriverId(id))
    .map(([id, driver]) => ({ ...driver, id }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
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
