function summarizeMonths(rows, matches) {
  const months = new Map()
  for (const row of rows) {
    const date = row.record_date || row.shift_date
    if (!matches(row) || !/^\d{4}-\d{2}-\d{2}$/.test(date || '')) continue
    const month = date.slice(0, 7)
    const item = months.get(month) || { month, jornadas: 0, entradas: 0, entradasConDato: 0, km: 0, kmConDato: 0 }
    item.jornadas += 1
    const sales = row.sales_uyu ?? row.reported_sales_uyu
    if (sales != null && sales !== '' && Number.isFinite(Number(sales))) {
      item.entradas += Number(sales)
      item.entradasConDato += 1
    }
    const start = row.odometer_start_km
    const end = row.odometer_end_km
    if (start != null && end != null && start !== '' && end !== '' && Number.isFinite(Number(start)) && Number.isFinite(Number(end)) && Number(end) >= Number(start)) {
      item.km += Number(end) - Number(start)
      item.kmConDato += 1
    }
    months.set(month, item)
  }
  return [...months.values()].sort((a, b) => b.month.localeCompare(a.month))
}

export function driverMonthlySummary(rows, driver) {
  const names = new Set([driver.name, driver.sourceName].filter(Boolean))
  return summarizeMonths(rows, row => names.has(row.driver_name))
}

export function mobileMonthlySummary(rows, mobileNumber) {
  const target = String(mobileNumber ?? '').trim()
  if (!/^\d+$/.test(target)) return []
  return summarizeMonths(rows, row => /^\d+$/.test(String(row.mobile_number ?? '').trim()) && Number(row.mobile_number) === Number(target))
}
