import test from 'node:test'
import assert from 'node:assert/strict'
import { driverIncome } from '../src/lib/income.js'

test('ingreso del conductor separa viajes confirmados y pendientes', () => {
  const state = {
    settings: { commissionPct: 30 },
    tickets: [
      { id: 'a', driverId: 'chofer-1', date: '2026-11-09', time: '10:00', amount: 1000, status: 'validado' },
      { id: 'b', driverId: 'chofer-1', date: '2026-11-08', time: '11:00', amount: 500, status: 'revision' },
      { id: 'c', driverId: 'chofer-2', date: '2026-11-09', time: '12:00', amount: 900, status: 'validado' },
      { id: 'd', driverId: 'chofer-1', date: '2026-10-01', time: '12:00', amount: 400, status: 'validado' },
    ],
  }
  const report = driverIncome(state, 'chofer-1', 7, new Date('2026-11-09T12:00:00'))
  assert.equal(report.trips, 2)
  assert.equal(report.gross, 1500)
  assert.equal(report.estimatedIncome, 450)
  assert.equal(report.confirmedIncome, 300)
  assert.equal(report.pendingIncome, 150)
  assert.deepEqual(report.tickets.map(ticket => ticket.id), ['a', 'b'])
})
