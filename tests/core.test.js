import test from 'node:test'
import assert from 'node:assert/strict'
import { isDuplicateTicket, metrics, reconciliation, validTicket, normalizeTicketNumber, dailyRevenue } from '../src/lib/core.js'

test('mismo número, taxi y fecha detecta duplicado', () => {
  const existing = [{ id: '1', ticketNumber: ' ab 003 ', date: '2026-11-09', vehicleId: 'taxi-1' }]
  assert.equal(isDuplicateTicket(existing, { ticketNumber: 'AB003', date: '2026-11-09', vehicleId: 'taxi-1' }), true)
  assert.equal(isDuplicateTicket(existing, { ticketNumber: 'AB003', date: '2026-11-09', vehicleId: 'taxi-2' }), false)
  assert.equal(normalizeTicketNumber(' a b 9 '), 'AB9')
})

test('totales y comisión configurada', () => {
  const result = metrics([{amount: 850, distanceKm: 4.5, status: 'revision'}, {amount: 350, distanceKm: 2.5, status: 'validado'}], 30)
  assert.deepEqual(result, { gross: 1200, trips: 2, km: 7, estimatedCommission: 360, pending: 1 })
})

test('gráfico diario respeta el período y suma los importes por fecha', () => {
  const today = new Date(2026, 10, 9)
  const tickets = [
    { date: '2026-11-08', amount: 850 },
    { date: '2026-11-08', amount: 350 },
    { date: '2026-11-09', amount: null },
    { date: '2026-10-31', amount: 999 },
  ]
  assert.deepEqual(dailyRevenue(tickets, 1, today), [{ date: '2026-11-09', amount: 0 }])
  const week = dailyRevenue(tickets, 7, today)
  assert.equal(week.length, 7)
  assert.equal(week[0].date, '2026-11-03')
  assert.equal(week[5].amount, 1200)
  assert.equal(week[6].amount, 0)
  const month = dailyRevenue(tickets, 30, today)
  assert.equal(month.length, 30)
  assert.equal(month.find(day => day.date === '2026-10-31').amount, 999)
})

test('conciliación de efectivo excluye tarjeta', () => {
  const trips = [{shiftId:'s',payment:'efectivo',amount:500}, {shiftId:'s',payment:'tarjeta',amount:300}]
  assert.deepEqual(reconciliation(trips, {id:'s',cashDeclared:490}), { expectedCash:500, declaredCash:490, difference:-10 })
})

test('validaciones evitan montos no válidos', () => {
  const baseline = {driverId:'d',vehicleId:'v',date:'2026-11-09',time:'09:30',amount:850,distanceKm:5}
  assert.equal(validTicket(baseline).length, 0)
  assert.ok(validTicket({...baseline,amount:0}).length > 0)
  assert.ok(validTicket({...baseline,distanceKm:-1}).length > 0)
})
