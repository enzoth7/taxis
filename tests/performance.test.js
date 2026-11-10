import test from 'node:test'
import assert from 'node:assert/strict'
import { performanceByMobileMonth } from '../src/lib/performance.js'

test('compara móviles por mes y calcula importes por km solo con jornadas comparables', () => {
  const archive = [
    { record_date: '2025-01-02', mobile_number: '2', sales_uyu: 1000, odometer_start_km: 100, odometer_end_km: 110 },
    { record_date: '2025-01-03', mobile_number: '02', sales_uyu: 2000, odometer_start_km: null, odometer_end_km: null },
    { record_date: '2025-03-01', mobile_number: '2', sales_uyu: null, odometer_start_km: 120, odometer_end_km: 140 },
    { record_date: '2025-01-04', mobile_number: '4', sales_uyu: 900, odometer_start_km: 20, odometer_end_km: 30 },
  ]
  const reports = [
    { shift_date: '2025-01-05', mobile_number: '2', reported_sales_uyu: 600, odometer_start_km: 110, odometer_end_km: 120 },
  ]
  const rows = performanceByMobileMonth(archive, reports, { start: '2025-01-01', end: '2025-03-31' }, '2025-04-10')
  assert.deepEqual(rows.map(row => `${row.month}:${row.mobile}`), ['2025-03:2', '2025-01:2', '2025-01:4'])
  const january = rows[1]
  assert.equal(january.jornadas, 3)
  assert.equal(january.entradas, 3600)
  assert.equal(january.jornadasConImporte, 3)
  assert.equal(january.jornadasConKm, 2)
  assert.equal(january.entradasPorJornada, 1200)
  assert.equal(january.entradasPorKm, 80)
  assert.equal(rows[0].entradasPorJornada, null)
})

test('recorta el mes actual y no atribuye actividad futura', () => {
  const archive = [
    { record_date: '2026-11-02', mobile_number: '13', sales_uyu: 100 },
    { record_date: '2026-11-12', mobile_number: '13', sales_uyu: 500 },
  ]
  const rows = performanceByMobileMonth(archive, [], { start: '2026-11-01', end: '2026-11-30' }, '2026-11-10')
  assert.equal(rows.length, 1)
  assert.equal(rows[0].jornadas, 1)
})
