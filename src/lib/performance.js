import { localDate } from '../data/catalog.js'

function validMobile(value) {
  const mobile = String(value ?? '').trim()
  return /^\d+$/.test(mobile) ? String(Number(mobile)) : null
}

function validAmount(value) {
  if (value == null || value === '') return null
  const amount = Number(value)
  return Number.isFinite(amount) && amount >= 0 ? amount : null
}

function validDistance(start, end) {
  if (start == null || end == null || start === '' || end === '') return null
  const first = Number(start)
  const last = Number(end)
  return Number.isFinite(first) && Number.isFinite(last) && first >= 0 && last >= first ? last - first : null
}

export function performanceByMobileMonth(archiveShifts, reports, range, today = localDate()) {
  const observations = [
    ...archiveShifts.map(row => ({ date: row.record_date, mobile: row.mobile_number, amount: row.sales_uyu, start: row.odometer_start_km, end: row.odometer_end_km })),
    ...reports.map(row => ({ date: row.shift_date, mobile: row.mobile_number, amount: row.reported_sales_uyu, start: row.odometer_start_km, end: row.odometer_end_km })),
  ]
  const values = new Map()
  for (const row of observations) {
    const mobile = validMobile(row.mobile)
    if (!mobile || !/^\d{4}-\d{2}-\d{2}$/.test(row.date || '') || row.date > today || row.date < range.start || row.date > range.end) continue
    const month = row.date.slice(0, 7)
    const key = `${month}:${mobile}`
    const item = values.get(key) || { month, mobile, jornadas: 0, entradas: 0, jornadasConImporte: 0, km: 0, jornadasConKm: 0, entradasConKm: 0, kmConImporte: 0, jornadasComparables: 0 }
    item.jornadas += 1
    const amount = validAmount(row.amount)
    const distance = validDistance(row.start, row.end)
    if (amount != null) { item.entradas += amount; item.jornadasConImporte += 1 }
    if (distance != null) { item.km += distance; item.jornadasConKm += 1 }
    if (amount != null && distance != null) {
      item.entradasConKm += amount
      item.kmConImporte += distance
      item.jornadasComparables += 1
    }
    values.set(key, item)
  }
  return [...values.values()].map(item => ({ ...item,
    entradasPorJornada: item.jornadasConImporte ? item.entradas / item.jornadasConImporte : null,
    entradasPorKm: item.kmConImporte > 0 ? item.entradasConKm / item.kmConImporte : null,
  })).sort((a, b) => b.month.localeCompare(a.month) || Number(a.mobile) - Number(b.mobile))
}
