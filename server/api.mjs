import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DRIVERS, currentDrivers, currentVehicles, seedState } from '../src/data/catalog.js'
import { driverIncome } from '../src/lib/income.js'

const defaultStoragePath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data', 'state.json')
const maxBodyBytes = 2 * 1024 * 1024

function sendJson(response, status, body) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  })
  response.end(JSON.stringify(body))
}

function validState(value) {
  return value?.version === 2 &&
    Array.isArray(value.tickets) &&
    Array.isArray(value.shifts) &&
    Array.isArray(value.movements) &&
    Number.isFinite(Number(value.settings?.commissionPct)) &&
    Number(value.settings.commissionPct) >= 0 &&
    Number(value.settings.commissionPct) <= 100
}

async function parseJson(request) {
  if (!String(request.headers['content-type'] || '').startsWith('application/json')) {
    return { error: 'Se requiere Content-Type: application/json.', status: 415 }
  }
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > maxBodyBytes) return { error: 'El cuerpo supera 2 MB.', status: 413 }
    chunks.push(chunk)
  }
  try { return { value: JSON.parse(Buffer.concat(chunks).toString('utf8')) } }
  catch { return { error: 'El JSON no es válido.', status: 400 } }
}

function filterRows(rows, query, dateField) {
  const driverId = query.get('driverId')
  const vehicleId = query.get('vehicleId')
  const from = query.get('from')
  const to = query.get('to')
  return rows.filter(row => {
    const date = String(row[dateField] || '').slice(0, 10)
    return (!driverId || row.driverId === driverId) &&
      (!vehicleId || row.vehicleId === vehicleId) &&
      (!from || date >= from) &&
      (!to || date <= to)
  })
}

export function createApiHandler({ storagePath = defaultStoragePath } = {}) {
  let statePromise
  let writes = Promise.resolve()

  async function getState() {
    if (!statePromise) {
      statePromise = readFile(storagePath, 'utf8')
        .then(text => JSON.parse(text))
        .then(state => validState(state) ? state : seedState())
        .catch(error => {
          if (error.code === 'ENOENT') return seedState()
          throw error
        })
    }
    return statePromise
  }

  async function setState(state) {
    const operation = writes.then(async () => {
      await mkdir(path.dirname(storagePath), { recursive: true })
      const tempPath = `${storagePath}.tmp`
      await writeFile(tempPath, JSON.stringify(state), 'utf8')
      await rename(tempPath, storagePath)
      statePromise = Promise.resolve(state)
    })
    writes = operation.catch(() => {})
    await operation
  }

  return async function apiHandler(request, response) {
    try {
      const url = new URL(request.url || '/', 'http://127.0.0.1')
      const route = url.pathname
      const method = request.method || 'GET'

      if (method === 'GET' && route === '/api/health') {
        return sendJson(response, 200, { status: 'ok', storage: 'local-file', openai: 'not-configured', mcp: 'not-configured' })
      }
      if (method === 'GET' && route === '/api/catalog') {
        const state = await getState()
        return sendJson(response, 200, { drivers: currentDrivers(state), vehicles: currentVehicles(state) })
      }
      if (method === 'GET' && route === '/api/state') {
        return sendJson(response, 200, await getState())
      }
      if (method === 'PUT' && route === '/api/state') {
        const origin = request.headers.origin
        if (origin && new URL(origin).host !== request.headers.host) {
          return sendJson(response, 403, { error: 'Origen no permitido.' })
        }
        const parsed = await parseJson(request)
        if (parsed.error) return sendJson(response, parsed.status, { error: parsed.error })
        if (!validState(parsed.value)) return sendJson(response, 400, { error: 'Estado inválido.' })
        await setState(parsed.value)
        return sendJson(response, 200, { saved: true })
      }

      const state = await getState()
      if (method === 'GET' && route === '/api/tickets') {
        return sendJson(response, 200, filterRows(state.tickets, url.searchParams, 'date'))
      }
      if (method === 'GET' && route === '/api/shifts') {
        return sendJson(response, 200, filterRows(state.shifts, url.searchParams, 'startedAt'))
      }
      if (method === 'GET' && route === '/api/movements') {
        return sendJson(response, 200, filterRows(state.movements, url.searchParams, 'date'))
      }
      const incomeMatch = route.match(/^\/api\/drivers\/([^/]+)\/income$/)
      if (method === 'GET' && incomeMatch) {
        const driverId = decodeURIComponent(incomeMatch[1])
        if (!DRIVERS.some(driver => driver.id === driverId)) return sendJson(response, 404, { error: 'Conductor no encontrado.' })
        const days = Number(url.searchParams.get('days') || 7)
        if (![1, 7, 30].includes(days)) return sendJson(response, 400, { error: 'El período debe ser 1, 7 o 30 días.' })
        return sendJson(response, 200, driverIncome(state, driverId, days))
      }
      if (method === 'POST' && route === '/api/tickets/extract') {
        return sendJson(response, 501, { error: 'La lectura automática todavía no está configurada.' })
      }
      if (route === '/mcp') {
        return sendJson(response, 501, { error: 'MCP todavía no está implementado ni autenticado.' })
      }
      return sendJson(response, 404, { error: 'Ruta no encontrada.' })
    } catch (error) {
      return sendJson(response, 500, { error: 'Error del servidor local.' })
    }
  }
}
