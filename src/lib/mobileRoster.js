export function mobileLabel(vehicle) {
  return vehicle?.mobileNumber ? `Móvil ${vehicle.mobileNumber}` : 'Sin número'
}

export function mobileNumberForId(id, vehicles) {
  return vehicles.find(vehicle => vehicle.id === id)?.mobileNumber || (String(id || '').startsWith('movil-') ? String(id).slice(6) : '')
}

export function buildMobileRoster(archiveShifts = [], reports = [], drivers = []) {
  const byMobile = new Map()
  const byDriver = new Map()
  const displayName = new Map(drivers.map(driver => [driver.sourceName || driver.name, driver.name]))
  const add = (mobileNumber, driverName) => {
    const mobile = String(mobileNumber || '').trim()
    const source = String(driverName || '').trim()
    const driver = displayName.get(source) || source
    if (!/^\d+$/.test(mobile) || !driver) return
    if (!byMobile.has(mobile)) byMobile.set(mobile, new Set())
    if (!byDriver.has(driver)) byDriver.set(driver, new Set())
    byMobile.get(mobile).add(driver)
    byDriver.get(driver).add(mobile)
  }
  archiveShifts.forEach(row => add(row.mobile_number, row.driver_name))
  reports.forEach(report => add(report.mobile_number, report.driver_name))
  drivers.forEach(driver => add(driver.assignedVehicleId?.startsWith('movil-') ? driver.assignedVehicleId.slice(6) : '', driver.name))
  return {
    driversForMobile: mobile => [...(byMobile.get(String(mobile)) || [])].sort((a, b) => a.localeCompare(b, 'es')),
    mobilesForDriver: driver => [...(byDriver.get(String(driver)) || [])].sort((a, b) => Number(a) - Number(b)),
  }
}
