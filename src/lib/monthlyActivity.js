import { inDateRange } from './core.js'

export function monthlyActivity(archiveShifts, reports, range, limit = 6) {
  const months = new Map()
  const add = (date, amount) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !inDateRange(date, range)) return
    const month = date.slice(0, 7)
    const item = months.get(month) || { month, jornadas: 0, entradas: 0, jornadasConImporte: 0 }
    item.jornadas += 1
    if (amount != null && amount !== '' && Number.isFinite(Number(amount))) {
      item.entradas += Number(amount)
      item.jornadasConImporte += 1
    }
    months.set(month, item)
  }
  for (const row of archiveShifts) add(row.record_date, row.sales_uyu)
  for (const report of reports) add(report.shift_date, report.reported_sales_uyu)
  return [...months.values()].sort((a, b) => a.month.localeCompare(b.month)).slice(-limit)
}
