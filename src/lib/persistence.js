import { seedState } from '../data/catalog.js'
export const STORAGE_KEY = 'taxis-control-prototype-v1'

export function loadState() {
  try {
    const current = JSON.parse(window.localStorage.getItem(STORAGE_KEY))
    if (Array.isArray(current?.tickets) && Array.isArray(current.movements) && Array.isArray(current.shifts)) {
      if (current.version === 2) return current
      if (current.version === 1) {
        const initialMovementIds = new Set(['eg-1', 'eg-2', 'eg-3', 'eg-4'])
        return {
          ...current,
          version: 2,
          tickets: current.tickets.filter(ticket => ticket.source !== 'demo' && !String(ticket.id).startsWith('demo-')),
          movements: current.movements.filter(movement => !initialMovementIds.has(movement.id)),
        }
      }
    }
  } catch { /* Navegador con almacenamiento bloqueado: iniciar vacío. */ }
  return seedState()
}

export function saveState(value) {
  try {
    const serialized = JSON.stringify(value)
    if (window.localStorage.getItem(STORAGE_KEY) !== serialized) window.localStorage.setItem(STORAGE_KEY, serialized)
  }
  catch (error) { console.warn('No se pudieron guardar los datos localmente:', error) }
}

export async function loadServerState() {
  if (import.meta.env.PROD) return null
  const response = await fetch('/api/state')
  if (!response.ok) throw new Error('API local no disponible')
  return response.json()
}

export async function syncServerState(value) {
  if (import.meta.env.PROD) return
  const response = await fetch('/api/state', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(value),
  })
  if (!response.ok) throw new Error('No se pudo actualizar la API local')
}

export function resetState() {
  try { window.localStorage.removeItem(STORAGE_KEY) }
  catch { /* sin almacenamiento */ }
  return seedState()
}
