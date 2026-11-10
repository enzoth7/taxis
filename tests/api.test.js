import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { randomUUID } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { unlink } from 'node:fs/promises'
import { createApiHandler } from '../server/api.mjs'
import { localDate } from '../src/data/catalog.js'

test('endpoints locales guardan datos y calculan ingresos', async () => {
  const storagePath = join(tmpdir(), `taxi-control-api-${randomUUID()}.json`)
  const server = http.createServer(createApiHandler({ storagePath }))
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const base = `http://127.0.0.1:${server.address().port}`

  try {
    const catalog = await (await fetch(`${base}/api/catalog`)).json()
    assert.equal(catalog.drivers.length, 22)
    assert.equal(catalog.drivers[0].name, 'Anibal Peralta')
    assert.equal(catalog.drivers[2].name, 'Bettiana')
    assert.equal(catalog.drivers[14].name, 'Milton')
    assert.equal(catalog.vehicles.length, 5)
    assert.deepEqual(catalog.vehicles.map(vehicle => vehicle.plate), ['IAC 111', 'IAC 112', 'IAC 113', 'IAC 114', 'IAC 115'])
    assert.ok(catalog.vehicles.every(vehicle => vehicle.stand === 'Sin asignar' && !('name' in vehicle) && !('code' in vehicle)))

    const state = {
      version: 2,
      tickets: [
        { id: 't1', driverId: 'real-anibal-peralta', vehicleId: 'taxi-1', date: localDate(), time: '10:00', amount: 1000, status: 'validado' },
        { id: 'foto-1', driverId: 'real-anibal-peralta', vehicleId: 'taxi-1', date: localDate(), time: '11:00', odometerStartKm: 148250, amount: null, distanceKm: null, payment: '', status: 'revision', hasPhoto: true },
      ],
      shifts: [],
      movements: [],
      settings: { commissionPct: 30 },
      catalog: {
        vehicles: {
          'taxi-1': { stand: 'Parada Centro' },
          'taxi-nuevo': { id: 'taxi-nuevo', plate: 'IAC 116', stand: 'Parada Norte', brand: 'Fiat', model: 'Cronos', year: '2024', status: 'Activo' },
        },
        drivers: {
          'chofer-nuevo': { id: 'chofer-nuevo', name: 'Andrea Prueba', document: '12345678', phone: '099123456', license: 'Profesional', assignedVehicleId: 'taxi-nuevo', status: 'Activo' },
        },
      },
    }
    const saved = await fetch(`${base}/api/state`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(state) })
    assert.equal(saved.status, 200)
    const updatedCatalog = await (await fetch(`${base}/api/catalog`)).json()
    assert.equal(updatedCatalog.vehicles[0].stand, 'Parada Centro')
    assert.equal(updatedCatalog.vehicles.length, 6)
    assert.equal(updatedCatalog.drivers.length, 23)
    assert.equal(updatedCatalog.vehicles[5].plate, 'IAC 116')
    assert.equal(updatedCatalog.drivers[22].assignedVehicleId, 'taxi-nuevo')
    const tickets = await (await fetch(`${base}/api/tickets?driverId=real-anibal-peralta`)).json()
    assert.equal(tickets.length, 2)
    assert.equal(tickets.find(ticket => ticket.id === 'foto-1').amount, null)
    assert.equal(tickets.find(ticket => ticket.id === 'foto-1').odometerStartKm, 148250)
    const income = await (await fetch(`${base}/api/drivers/real-anibal-peralta/income?days=7`)).json()
    assert.equal(income.estimatedIncome, 300)
    assert.equal(income.confirmedIncome, 300)
    assert.equal(income.trips, 2)
    assert.equal((await fetch(`${base}/api/tickets/extract`, { method: 'POST' })).status, 501)
    assert.equal((await fetch(`${base}/mcp`)).status, 501)
  } finally {
    await new Promise(resolve => server.close(resolve))
    await unlink(storagePath).catch(() => {})
  }
})
