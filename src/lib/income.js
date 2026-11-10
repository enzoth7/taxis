import { localDate } from '../data/catalog.js'
import { periodStart } from './core.js'

export function driverIncome(state, driverId, days = 7, now = new Date()) {
  const periodDays = [1, 7, 30].includes(Number(days)) ? Number(days) : 7
  const from = periodStart(periodDays, now)
  const to = localDate(now)
  const rate = Math.min(100, Math.max(0, Number(state.settings?.commissionPct) || 0))
  const tickets = state.tickets
    .filter(ticket => ticket.driverId === driverId && ticket.date >= from && ticket.date <= to)
    .sort((a, b) => `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`))
  const gross = tickets.reduce((sum, ticket) => sum + Number(ticket.amount || 0), 0)
  const confirmedGross = tickets
    .filter(ticket => ticket.status === 'validado')
    .reduce((sum, ticket) => sum + Number(ticket.amount || 0), 0)
  const pendingGross = gross - confirmedGross
  const estimatedIncome = Math.round(gross * rate / 100)
  const confirmedIncome = Math.round(confirmedGross * rate / 100)

  return {
    driverId,
    days: periodDays,
    from,
    to,
    rate,
    trips: tickets.length,
    gross,
    confirmedGross,
    pendingGross,
    estimatedIncome,
    confirmedIncome,
    pendingIncome: estimatedIncome - confirmedIncome,
    tickets,
  }
}
