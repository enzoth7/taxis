// Se conserva una copia local para agilizar la revisión en este dispositivo.
import { downloadTicketPhoto } from './remoteTickets.js'
const DB = 'taxis-control-photos-v1'
const STORE = 'photos'

function openDB() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) return reject(new Error('IndexedDB no disponible'))
    const request = indexedDB.open(DB, 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function transaction(mode, handler) {
  const db = await openDB()
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode)
      const req = handler(tx.objectStore(STORE))
      let result
      req.onsuccess = () => { result = req.result }
      req.onerror = () => reject(req.error)
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error || new Error('No se pudo guardar la fotografía.'))
      tx.oncomplete = () => resolve(result)
    })
  } finally { db.close() }
}

export async function savePhoto(ticketId, file) {
  if (file.size > 15 * 1024 * 1024) throw new Error('La fotografía supera los 15 MB. Sacá otra foto de menor tamaño.')
  await transaction('readwrite', store => store.put(file, ticketId))
}

export async function getPhoto(ticketId, photoPath) {
  const local = await transaction('readonly', store => store.get(ticketId)).catch(() => null)
  return local || downloadTicketPhoto(photoPath)
}

export async function clearPhotos() {
  await transaction('readwrite', store => store.clear())
}
