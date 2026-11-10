import { localDate } from '../data/catalog.js'

export function monthlyCoverage(shifts, reports, mobiles, today = localDate()) {
  const dates = [...shifts.map(row => row.record_date), ...reports.map(row => row.shift_date)]
    .filter(date => /^\d{4}-\d{2}-\d{2}$/.test(date) && date <= today).sort()
  if (!dates.length) return []
  const counts = new Map()
  for (const row of [...shifts.map(item => ({ date: item.record_date, mobile: item.mobile_number })), ...reports.map(item => ({ date: item.shift_date, mobile: item.mobile_number }))]) {
    if (!row.date || row.date > today || !mobiles.includes(String(row.mobile))) continue
    const key = `${row.date.slice(0, 7)}:${row.mobile}`
    counts.set(key, (counts.get(key) || 0) + 1)
  }
  const months = []
  let [year, month] = dates[0].slice(0, 7).split('-').map(Number)
  const [endYear, endMonth] = today.slice(0, 7).split('-').map(Number)
  while (year < endYear || (year === endYear && month <= endMonth)) {
    const key = `${year}-${String(month).padStart(2, '0')}`
    const days = year === endYear && month === endMonth ? Number(today.slice(8, 10)) : new Date(year, month, 0).getDate()
    const expected = days * 2
    months.push({ key, year, month, expected,
      mobiles: Object.fromEntries(mobiles.map(mobile => {
        const actual = counts.get(`${key}:${mobile}`) || 0
        return [mobile, { actual, expected, percent: Math.min(100, Math.round(actual / expected * 100)) }]
      })) })
    month += 1
    if (month === 13) { month = 1; year += 1 }
  }
  return months.reverse()
}
