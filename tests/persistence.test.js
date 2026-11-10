import test from 'node:test'
import assert from 'node:assert/strict'
import { loadState } from '../src/lib/persistence.js'

test('la actualización retira registros precargados y conserva los cargados', () => {
  const previousWindow = globalThis.window
  const stored = {
    version: 1,
    tickets: [
      { id: 'demo-0-0', source: 'demo', amount: 850 },
      { id: 'ticket-propio', source: 'manual', amount: 700 },
    ],
    movements: [
      { id: 'eg-1', amount: 120 },
      { id: 'movimiento-propio', amount: 90 },
    ],
    shifts: [{ id: 'turno-propio', status: 'cerrado' }],
    settings: { commissionPct: 35 },
  }

  try {
    globalThis.window = { localStorage: { getItem: () => JSON.stringify(stored) } }
    const updated = loadState()
    assert.equal(updated.version, 2)
    assert.deepEqual(updated.tickets.map(ticket => ticket.id), ['ticket-propio'])
    assert.deepEqual(updated.movements.map(movement => movement.id), ['movimiento-propio'])
    assert.deepEqual(updated.shifts, stored.shifts)
    assert.deepEqual(updated.settings, stored.settings)
  } finally {
    if (previousWindow === undefined) delete globalThis.window
    else globalThis.window = previousWindow
  }
})
