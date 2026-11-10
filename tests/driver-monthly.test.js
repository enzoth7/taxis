import test from 'node:test'
import assert from 'node:assert/strict'
import { driverMonthlySummary, mobileMonthlySummary } from '../src/lib/driverMonthly.js'

test('resume jornadas, entradas y kilómetros por mes', () => {
  const rows = [
    { record_date: '2025-01-10', driver_name: 'Sarago', sales_uyu: 1000, odometer_start_km: 100, odometer_end_km: 140 },
    { record_date: '2025-01-11', driver_name: 'Sarago', sales_uyu: 700, odometer_start_km: 140, odometer_end_km: 170 },
    { record_date: '2025-02-01', driver_name: 'Sarago', sales_uyu: 800, odometer_start_km: 170, odometer_end_km: 200 },
    { record_date: '2025-02-02', driver_name: 'Otro', sales_uyu: 9000 },
  ]
  const months = driverMonthlySummary(rows, { name: 'Roberto Sarago', sourceName: 'Sarago' })
  assert.deepEqual(months.map(row => row.month), ['2025-02', '2025-01'])
  assert.equal(months[0].jornadas, 1)
  assert.equal(months[1].jornadas, 2)
  assert.equal(months[1].entradas, 1700)
  assert.equal(months[1].km, 70)
})

test('resume un móvil por mes con jornadas históricas y cierres enviados', () => {
  const rows = [
    { record_date: '2025-01-10', mobile_number: '2', sales_uyu: 1000, odometer_start_km: 100, odometer_end_km: 140 },
    { shift_date: '2025-01-11', mobile_number: '02', reported_sales_uyu: 700, odometer_start_km: 140, odometer_end_km: 170 },
    { record_date: '2025-02-01', mobile_number: '2', sales_uyu: null, odometer_start_km: null, odometer_end_km: null },
    { record_date: '2025-01-12', mobile_number: '13', sales_uyu: 9000 },
    { record_date: '2025-01-13', mobile_number: '', sales_uyu: 8000 },
  ]
  const months = mobileMonthlySummary(rows, '2')
  assert.deepEqual(months.map(row => row.month), ['2025-02', '2025-01'])
  assert.equal(months[0].jornadas, 1)
  assert.equal(months[0].entradasConDato, 0)
  assert.equal(months[0].kmConDato, 0)
  assert.equal(months[1].jornadas, 2)
  assert.equal(months[1].entradas, 1700)
  assert.equal(months[1].km, 70)
})
