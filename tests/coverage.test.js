import test from 'node:test'
import assert from 'node:assert/strict'
import { monthlyCoverage } from '../src/lib/coverage.js'
import { catalogFromArchive } from '../src/lib/fleetCatalog.js'

test('cobertura mensual usa dos turnos diarios y recorta el mes actual', () => {
  const shifts = [
    { record_date: '2024-01-01', mobile_number: '2', driver_name: 'Carlos' },
    { record_date: '2024-01-01', mobile_number: '2', driver_name: 'Pablo' },
    { record_date: '2024-01-02', mobile_number: '4', driver_name: 'Carlos' },
  ]
  const rows = monthlyCoverage(shifts, [{ shift_date: '2024-02-01', mobile_number: '2' }], ['2', '4'], '2024-02-10')
  assert.equal(rows[1].mobiles['2'].actual, 2)
  assert.equal(rows[1].mobiles['2'].expected, 62)
  assert.equal(rows[1].mobiles['2'].percent, 3)
  assert.equal(rows[0].mobiles['2'].expected, 20)
  assert.equal(rows[0].mobiles['2'].percent, 5)
  const catalog = catalogFromArchive(shifts)
  assert.equal(Object.keys(catalog.vehicles).length, 2)
  assert.equal(Object.keys(catalog.drivers).length, 2)
})
