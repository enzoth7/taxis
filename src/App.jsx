import { useEffect, useState } from 'react'
import Admin from './Admin.jsx'
import Driver from './Driver.jsx'
import { STORAGE_KEY, loadState, saveState, loadServerState, syncServerState } from './lib/persistence.js'
import { savePhoto } from './lib/photos.js'
import { uploadTicketPhoto } from './lib/remoteTickets.js'
import { isDuplicateTicket, safeId } from './lib/core.js'

export default function App() {
  const [data, setData] = useState(loadState)
  const isDriverPage = window.location.pathname.replace(/\/$/, '') === '/conductor'
  const [notice, setNotice] = useState('')
  const [serverReady, setServerReady] = useState(false)

  useEffect(() => { saveState(data) }, [data])
  useEffect(() => {
    const receiveChanges = event => {
      if (event.key === STORAGE_KEY) setData(loadState())
    }
    window.addEventListener('storage', receiveChanges)
    return () => window.removeEventListener('storage', receiveChanges)
  }, [])
  useEffect(() => {
    let active = true
    loadServerState()
      .then(remote => {
        if (!active || remote?.version !== 2) return
        setData(previous => {
          const hasLocalRecords = previous.tickets.length || previous.shifts.length || previous.movements.length || Object.keys(previous.catalog?.drivers || {}).length || Object.keys(previous.catalog?.vehicles || {}).length
          return hasLocalRecords ? previous : remote
        })
      })
      .catch(() => {})
      .finally(() => { if (active) setServerReady(true) })
    return () => { active = false }
  }, [])
  useEffect(() => {
    if (!serverReady) return undefined
    const timer = setTimeout(() => {
      syncServerState(data).catch(() => console.warn('La API local no pudo guardar los cambios.'))
    }, 200)
    return () => clearTimeout(timer)
  }, [data, serverReady])
  useEffect(() => {
    if (!notice) return undefined
    const timer = setTimeout(() => setNotice(''), 4300)
    return () => clearTimeout(timer)
  }, [notice])

  function toast(message) { setNotice(message) }

  async function addTicket(values, photo) {
    if (!photo) throw new Error('Adjuntá una fotografía del ticket.')
    if (isDuplicateTicket(data.tickets, values)) throw new Error('Ya existe un ticket con ese número, fecha y móvil.')
    const remote = await uploadTicketPhoto(values, photo)
    await savePhoto(remote.id, photo).catch(() => {})
    const ticket = { ...values, ...remote, ticketNumber: (values.ticketNumber || '').trim(), amount: values.amount == null || values.amount === '' ? null : Number(values.amount), distanceKm: values.distanceKm == null || values.distanceKm === '' ? null : Number(values.distanceKm), createdAt: new Date().toISOString(), hasPhoto: true, source: 'foto', status: 'revision' }
    setData(previous => ({ ...previous, tickets: [ticket, ...previous.tickets] }))
    toast('Foto recibida. Pendiente de revisión.')
    return ticket
  }

  function updateTicket(id, status) {
    setData(previous => ({ ...previous, tickets: previous.tickets.map(t => t.id === id ? { ...t, status } : t) }))
    toast(status === 'validado' ? 'Ticket validado.' : 'Ticket marcado para revisión.')
  }

  function addMovement(input) {
    setData(previous => ({ ...previous, movements: [{ ...input, id: safeId(), amount: Number(input.amount) }, ...previous.movements] }))
    toast('Movimiento registrado.')
  }

  function updateSettings(patch) {
    setData(previous => ({ ...previous, settings: { ...previous.settings, ...patch } }))
    toast('Configuración actualizada.')
  }

  function editRecord(type, id, patch) {
    if (type === 'drivers' || type === 'vehicles') {
      setData(previous => ({ ...previous, catalog: { ...previous.catalog, [type]: { ...previous.catalog?.[type], [id]: { ...previous.catalog?.[type]?.[id], ...patch } } } }))
    } else {
      setData(previous => ({ ...previous, [type]: previous[type].map(item => item.id === id ? { ...item, ...patch } : item) }))
    }
    toast('Cambios guardados.')
  }

  function addCatalogRecord(type, patch) {
    const id = `${type === 'drivers' ? 'chofer' : 'taxi'}-${safeId()}`
    setData(previous => ({ ...previous, catalog: { ...previous.catalog, [type]: { ...previous.catalog?.[type], [id]: { ...patch, id } } } }))
    toast(type === 'drivers' ? 'Conductor agregado.' : 'Taxi agregado.')
  }

  return <>
    {isDriverPage
      ? <Driver data={data} onAddTicket={addTicket} />
      : <Admin data={data} onUpdateTicket={updateTicket} onAddMovement={addMovement} onEditRecord={editRecord} onAddCatalogRecord={addCatalogRecord} onUpdateSettings={updateSettings} onToast={toast} />}
    {notice && <div className="toast" role="status" aria-live="polite">{notice}</div>}
  </>
}
