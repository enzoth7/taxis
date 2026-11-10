export function money(value) {
  return `$ ${new Intl.NumberFormat('es-UY', { maximumFractionDigits: 0 }).format(Number(value) || 0)}`
}

export function number(value, decimals = 0) {
  return new Intl.NumberFormat('es-UY', { maximumFractionDigits: decimals }).format(Number(value) || 0)
}

export function normalizeTicketNumber(value) {
  return String(value ?? '').trim().replace(/\s+/g, '').toUpperCase()
}

export function isDuplicateTicket(existing, candidate) {
  const target = normalizeTicketNumber(candidate.ticketNumber)
  if (!target) return false
  return existing.some(ticket => (
    ticket.id !== candidate.id &&
    ticket.vehicleId === candidate.vehicleId &&
    ticket.date === candidate.date &&
    normalizeTicketNumber(ticket.ticketNumber) === target
  ))
}

export function periodStart(days, now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  start.setDate(start.getDate() - (days - 1))
  return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`
}

export function filterPeriod(tickets, days) {
  const since = periodStart(days)
  return tickets.filter(t => t.date >= since)
}

export function dateRange(period, month, dates = [], now = new Date()) {
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  if (period === 'all') {
    const first = dates.filter(date => /^\d{4}-\d{2}-\d{2}$/.test(date) && date <= today).sort()[0]
    return { start: first || today, end: today }
  }
  if (period === 'month' && /^\d{4}-\d{2}$/.test(month)) {
    const start = `${month}-01`
    const last = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)
    const end = `${month}-${String(last.getDate()).padStart(2, '0')}`
    return { start, end: end < today ? end : today }
  }
  return { start: periodStart(Number(period) || 7, now), end: today }
}

export function inDateRange(date, range) {
  return Boolean(date && date >= range.start && date <= range.end)
}

export function dailyRevenueRange(records, range) {
  if (range.start > range.end) return []
  const totals = new Map()
  for (const record of records) {
    const amount = Number(record.amount)
    if (inDateRange(record.date, range) && Number.isFinite(amount) && amount > 0) {
      totals.set(record.date, (totals.get(record.date) || 0) + amount)
    }
  }
  const date = new Date(`${range.start}T12:00:00`)
  const end = new Date(`${range.end}T12:00:00`)
  const series = []
  while (date <= end) {
    const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    series.push({ date: day, amount: totals.get(day) || 0 })
    date.setDate(date.getDate() + 1)
  }
  return series
}

export function dailyRevenue(tickets, days, now = new Date()) {
  const totals = new Map()
  for (const ticket of tickets) {
    const amount = Number(ticket.amount)
    if (ticket.date && Number.isFinite(amount) && amount > 0) {
      totals.set(ticket.date, (totals.get(ticket.date) || 0) + amount)
    }
  }
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  date.setDate(date.getDate() - days + 1)
  return Array.from({ length: days }, () => {
    const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    date.setDate(date.getDate() + 1)
    return { date: day, amount: totals.get(day) || 0 }
  })
}

export function metrics(tickets, commissionPct = 30) {
  const gross = tickets.reduce((total, t) => total + Number(t.amount || 0), 0)
  const km = tickets.reduce((total, t) => total + Number(t.distanceKm || 0), 0)
  return {
    gross,
    trips: tickets.length,
    km,
    estimatedCommission: Math.round(gross * (Number(commissionPct) || 0) / 100),
    pending: tickets.filter(t => t.status === 'revision').length,
  }
}

export function getShiftCash(tickets, shiftId) {
  return tickets
    .filter(t => t.shiftId === shiftId && t.payment === 'efectivo')
    .reduce((sum, t) => sum + Number(t.amount || 0), 0)
}

export function reconciliation(tickets, shift) {
  const expectedCash = getShiftCash(tickets, shift.id)
  const declaredCash = Number(shift.cashDeclared) || 0
  return { expectedCash, declaredCash, difference: declaredCash - expectedCash }
}

export function groupByKey(tickets, key) {
  return tickets.reduce((acc, ticket) => {
    const id = ticket[key]
    if (!acc[id]) acc[id] = { trips: 0, amount: 0, km: 0 }
    acc[id].trips += 1
    acc[id].amount += Number(ticket.amount || 0)
    acc[id].km += Number(ticket.distanceKm || 0)
    return acc
  }, {})
}

export function safeId() {
  if (typeof crypto === 'undefined' || !crypto.getRandomValues) throw new Error('Este navegador no permite guardar registros de forma segura.')
  if (crypto.randomUUID) return crypto.randomUUID()
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 15) | 64
  bytes[8] = (bytes[8] & 63) | 128
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export function validTicket(input) {
  const errors = []
  if (!input.driverId || !input.vehicleId) errors.push('Elegí conductor y móvil.')
  if (!input.date || !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) errors.push('Ingresá una fecha válida.')
  if (!/^\d{2}:\d{2}$/.test(input.time || '')) errors.push('Ingresá una hora válida.')
  if (!Number.isFinite(Number(input.amount)) || Number(input.amount) <= 0) errors.push('El importe debe ser mayor a cero.')
  if (!Number.isFinite(Number(input.distanceKm)) || Number(input.distanceKm) < 0 || input.distanceKm === '') errors.push('Ingresá kilómetros válidos.')
  return errors
}
