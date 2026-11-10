import test from 'node:test'
import assert from 'node:assert/strict'
import { dateRange, dailyRevenueRange, inDateRange } from '../src/lib/core.js'
import { buildMobileRoster } from '../src/lib/mobileRoster.js'

test('mes y todo incluyen los registros correctos hasta hoy', () => {
  const now = new Date(2026, 10, 9)
  const dates = ['2024-01-03', '2025-11-20', '2026-11-09', '2026-11-10']
  const all = dateRange('all', '', dates, now)
  assert.deepEqual(all, { start: '2024-01-03', end: '2026-11-09' })
  assert.equal(inDateRange('2026-11-10', all), false)
  const month = dateRange('month', '2025-11', dates, now)
  assert.deepEqual(month, { start: '2025-11-01', end: '2025-11-30' })
  const series = dailyRevenueRange([{ date: '2025-11-02', amount: 100 }, { date: '2025-11-02', amount: 50 }, { date: '2025-12-01', amount: 200 }], month)
  assert.equal(series.length, 30)
  assert.equal(series[1].amount, 150)
  assert.equal(series.at(-1).amount, 0)
})

test('un móvil admite varios choferes y un chofer varios móviles', () => {
  const archive = [
    { mobile_number: '2', driver_name: 'Diego' },
    { mobile_number: '2', driver_name: 'Federico Mas' },
    { mobile_number: '13', driver_name: 'Diego' },
    { mobile_number: '13', driver_name: null },
  ]
  const roster = buildMobileRoster(archive)
  assert.deepEqual(roster.driversForMobile('2'), ['Diego', 'Federico Mas'])
  assert.deepEqual(roster.mobilesForDriver('Diego'), ['2', '13'])
})
