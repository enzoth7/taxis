import { useEffect, useState } from 'react'
import Admin from './Admin.jsx'
import Driver from './Driver.jsx'
import { STORAGE_KEY, loadState, saveState, loadServerState, syncServerState } from './lib/persistence.js'
import { savePhoto } from './lib/photos.js'
import { uploadTicketPhoto } from './lib/remoteTickets.js'
import { uploadShiftReport } from './lib/shiftReports.js'
import { supabase } from './lib/supabase.js'
import { updateArchiveShift } from './lib/archive.js'
import { listJornadas, splitJornadas } from './lib/jornadas.js'
import { isDuplicateTicket, safeId } from './lib/core.js'
import { catalogFromArchive, listFleetCatalog, saveFleetRecord } from './lib/fleetCatalog.js'

export default function App() {
  const [data, setData] = useState(loadState)
  const isDriverPage = window.location.pathname.replace(/\/$/, '') === '/conductor'
  const [notice, setNotice] = useState('')
  const [serverReady, setServerReady] = useState(false)
  const [authSession, setAuthSession] = useState(undefined)
  const [remoteReports, setRemoteReports] = useState([])
  const [reportsError, setReportsError] = useState('')
  const [archiveShifts, setArchiveShifts] = useState([])
  const [archiveError, setArchiveError] = useState('')
  const [remoteCatalog, setRemoteCatalog] = useState(null)

  async function refreshJornadas() {
    try {
      const result = splitJornadas(await listJornadas())
      setRemoteReports(result.reports)
      setArchiveShifts(result.archiveShifts)
      setReportsError('')
      setArchiveError('')
    } catch (error) {
      const message = error.message || 'No se pudieron cargar las jornadas.'
      setReportsError(message)
      setArchiveError(message)
    }
  }
  async function refreshFleetCatalog() {
    try { setRemoteCatalog(await listFleetCatalog()) }
    catch { setRemoteCatalog(null) }
  }

  useEffect(() => {
    if (!supabase) { setAuthSession(null); return undefined }
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setAuthSession(session))
    supabase.auth.getSession().then(({ data: result }) => setAuthSession(result.session)).catch(() => setAuthSession(null))
    return () => listener.subscription.unsubscribe()
  }, [])
  useEffect(() => {
    if (authSession?.user) { refreshJornadas(); refreshFleetCatalog() }
    else { setRemoteReports([]); setArchiveShifts([]); setRemoteCatalog(null) }
  }, [authSession?.user?.id])
  useEffect(() => {
    if (!authSession?.user) return undefined
    const refreshOnFocus = () => { refreshJornadas(); refreshFleetCatalog() }
    window.addEventListener('focus', refreshOnFocus)
    return () => window.removeEventListener('focus', refreshOnFocus)
  }, [authSession?.user?.id])

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

  async function addShiftReport(values, photos) {
    const report = await uploadShiftReport(values, photos)
    await refreshJornadas()
    toast('Jornada recibida para revisión.')
    return report
  }

  function updateTicket(id, status) {
    setData(previous => ({ ...previous, tickets: previous.tickets.map(t => t.id === id ? { ...t, status } : t) }))
    toast(status === 'validado' ? 'Ticket validado.' : 'Ticket marcado para revisión.')
  }

  async function editArchiveShift(id, patch) {
    await updateArchiveShift(id, patch)
    await refreshJornadas()
    toast('Jornada histórica actualizada.')
  }

  function addMovement(input) {
    setData(previous => ({ ...previous, movements: [{ ...input, id: safeId(), amount: Number(input.amount) }, ...previous.movements] }))
    toast('Movimiento registrado.')
  }

  function updateSettings(patch) {
    setData(previous => ({ ...previous, settings: { ...previous.settings, ...patch } }))
    toast('Configuración actualizada.')
  }

  async function editRecord(type, id, patch) {
    if (type === 'drivers' || type === 'vehicles') {
      if (remoteCatalog) {
        await saveFleetRecord(type, id, patch, authSession?.user?.id)
        await refreshFleetCatalog()
      } else setData(previous => ({ ...previous, catalog: { ...previous.catalog, [type]: { ...previous.catalog?.[type], [id]: { ...previous.catalog?.[type]?.[id], ...patch } } } }))
    } else {
      setData(previous => ({ ...previous, [type]: previous[type].map(item => item.id === id ? { ...item, ...patch } : item) }))
    }
    toast('Cambios guardados.')
  }

  async function addCatalogRecord(type, patch) {
    const id = type === 'vehicles' ? `movil-${patch.mobileNumber}` : `chofer-${safeId()}`
    if (remoteCatalog) {
      await saveFleetRecord(type, id, patch, authSession?.user?.id)
      await refreshFleetCatalog()
    } else setData(previous => ({ ...previous, catalog: { ...previous.catalog, [type]: { ...previous.catalog?.[type], [id]: { ...patch, id } } } }))
    toast(type === 'drivers' ? 'Conductor agregado.' : 'Taxi agregado.')
  }

  const archiveCatalog = catalogFromArchive(archiveShifts)
  const visibleData = { ...data, catalog: remoteCatalog || {
    vehicles: { ...archiveCatalog.vehicles, ...data.catalog?.vehicles },
    drivers: { ...archiveCatalog.drivers, ...data.catalog?.drivers },
  } }
  return <>
    {isDriverPage
      ? <Driver data={visibleData} onAddShiftReport={addShiftReport} />
      : <Admin data={visibleData} reports={remoteReports} reportsError={reportsError} archiveShifts={archiveShifts} archiveError={archiveError} authSession={authSession} onRefreshReports={refreshJornadas} onEditArchiveShift={editArchiveShift} onUpdateTicket={updateTicket} onAddMovement={addMovement} onEditRecord={editRecord} onAddCatalogRecord={addCatalogRecord} onUpdateSettings={updateSettings} onToast={toast} />}
    {notice && <div className="toast" role="status" aria-live="polite">{notice}</div>}
  </>
}
