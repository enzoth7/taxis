import test from 'node:test'
import assert from 'node:assert/strict'
import { monthlyActivity } from '../src/lib/monthlyActivity.js'

test('combina las jornadas históricas y los cierres del conductor por mes', () => {
  const archive = [
    { record_date: '2024-01-04', sales_uyu: 1000 },
    { record_date: '2024-02-02', sales_uyu: null },
    { record_date: '2023-12-31', sales_uyu: 500 },
  ]
  const reports = [
    { shift_date: '2024-01-05', reported_sales_uyu: 700 },
    { shift_date: '2024-03-02', reported_sales_uyu: 900 },
  ]
  const result = monthlyActivity(archive, reports, { start: '2024-01-01', end: '2024-02-29' })
  assert.deepEqual(result.map(item => item.month), ['2024-01', '2024-02'])
  assert.deepEqual(result.map(item => item.jornadas), [2, 1])
  assert.equal(result[0].entradas, 1700)
  assert.equal(result[0].jornadasConImporte, 2)
  assert.equal(result[1].jornadasConImporte, 0)
})
