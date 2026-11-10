const driverNames = [
  'Martín Silva', 'Joaquín Ferreira', 'Luis Méndez', 'Federico Acosta',
  'Camilo Pereyra', 'Nicolás Duarte', 'Valentín Costa', 'Santiago Ríos',
  'Fernando Medina', 'Bruno Cabrera', 'Agustín Franco', 'Emiliano Vega',
  'Simón Torres', 'Mateo Sosa', 'Pablo Navarro',
]

const previousDriverNames = {
  'Martina Silva': 'Martín Silva',
  'Lucía Méndez': 'Luis Méndez',
  'Camila Pereyra': 'Camilo Pereyra',
  'Valentina Costa': 'Valentín Costa',
  'Florencia Medina': 'Fernando Medina',
  'Agustina Franco': 'Agustín Franco',
  'Sofía Torres': 'Simón Torres',
  'Paula Navarro': 'Pablo Navarro',
}

export const VEHICLES = Array.from({ length: 5 }, (_, i) => ({
  id: `taxi-${i + 1}`,
  plate: `IAC ${111 + i}`,
  stand: 'Sin asignar',
  brand: '',
  model: '',
  year: '',
  status: 'Activo',
}))

export const DRIVERS = driverNames.map((name, i) => ({
  id: `chofer-${i + 1}`,
  name,
  assignedVehicleId: VEHICLES[i % 5].id,
  document: '',
  phone: '',
  license: '',
  status: 'Activo',
}))

export function currentVehicles(state) {
  const records = state.catalog?.vehicles || {}
  return [...VEHICLES.map(vehicle => ({ ...vehicle, ...records[vehicle.id] })), ...Object.entries(records).filter(([id]) => !VEHICLES.some(base => base.id === id)).map(([id, vehicle]) => ({ ...vehicle, id }))]
}

export function currentDrivers(state) {
  const records = state.catalog?.drivers || {}
  return [...DRIVERS.map(driver => {
    const saved = records[driver.id] || {}
    return { ...driver, ...saved, name: previousDriverNames[saved.name] || saved.name || driver.name }
  }), ...Object.entries(records).filter(([id]) => !DRIVERS.some(base => base.id === id)).map(([id, driver]) => ({ ...driver, id }))]
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
