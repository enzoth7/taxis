import { useEffect, useState } from 'react'
import { Check, X } from 'lucide-react'
import EditIcon from './EditIcon.jsx'
import { currentDrivers, currentVehicles } from './data/catalog.js'
import { money } from './lib/core.js'
import { supabase } from './lib/supabase.js'
import { downloadShiftPhoto, listShiftReports, updateShiftReport } from './lib/shiftReports.js'

function amount(value) { return value == null ? 'Sin registrar' : money(Number(value)) }
function difference(report) {
  if (report.sheet_total_uyu == null || report.meter_total_uyu == null || report.sheet_total_uyu === '' || report.meter_total_uyu === '') return null
  return Number(report.sheet_total_uyu) - Number(report.meter_total_uyu)
}
function fieldValue(value) { return value ?? '' }

function ReviewForm({ report, data, onClose, onSaved }) {
  const [form, setForm] = useState({
    driver_id: report.driver_id,
    vehicle_id: report.vehicle_id,
    shift_date: report.shift_date,
    mobile_number: fieldValue(report.mobile_number),
    odometer_start_km: fieldValue(report.odometer_start_km),
    odometer_end_km: fieldValue(report.odometer_end_km),
    sheet_trip_count: fieldValue(report.sheet_trip_count),
    meter_trip_count: fieldValue(report.meter_trip_count),
    sheet_total_uyu: fieldValue(report.sheet_total_uyu),
    meter_total_uyu: fieldValue(report.meter_total_uyu),
    sheet_trip_lines: fieldValue(report.sheet_trip_lines),
    meter_trip_lines: fieldValue(report.meter_trip_lines),
    review_notes: fieldValue(report.review_notes),
    status: report.status,
  })
  const [photos, setPhotos] = useState({ sheet: null, meter: null })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const drivers = currentDrivers(data)
  const vehicles = currentVehicles(data)
  useEffect(() => {
    let active = true
    const urls = []
    async function load() {
      for (const [kind, path] of [['sheet', report.sheet_photo_path], ['meter', report.meter_photo_path]]) {
        if (!path) continue
        try {
          const blob = await downloadShiftPhoto(path)
          if (!active) break
          const url = URL.createObjectURL(blob)
          urls.push(url)
          setPhotos(previous => ({ ...previous, [kind]: url }))
        } catch { if (active) setError('No se pudo abrir una de las fotografías.') }
      }
    }
    load()
    return () => { active = false; urls.forEach(url => URL.revokeObjectURL(url)) }
  }, [report.id, report.sheet_photo_path, report.meter_photo_path])

  function input(name, label, type = 'text') {
    return <label key={name}>{label}<input type={type} min={type === 'number' ? '0' : undefined} step={type === 'number' ? 'any' : undefined} value={form[name]} onChange={event => setForm(previous => ({ ...previous, [name]: event.target.value }))}/></label>
  }
  async function save(event) {
    event.preventDefault()
    setError('')
    const numbers = ['odometer_start_km', 'odometer_end_km', 'sheet_trip_count', 'meter_trip_count', 'sheet_total_uyu', 'meter_total_uyu']
    const patch = { ...form }
    if (!patch.driver_id || !patch.vehicle_id || !patch.shift_date) return setError('Completá conductor, matrícula y fecha.')
    for (const name of numbers) patch[name] = patch[name] === '' ? null : Number(patch[name])
    if (patch.odometer_start_km != null && patch.odometer_end_km != null && patch.odometer_end_km < patch.odometer_start_km) return setError('El odómetro final debe ser mayor o igual al inicial.')
    if (['sheet_trip_count', 'meter_trip_count'].some(name => patch[name] != null && !Number.isInteger(patch[name]))) return setError('La cantidad de viajes debe ser un número entero.')
    if (patch.status === 'validado' && patch.sheet_total_uyu == null && patch.meter_total_uyu == null) return setError('Registrá al menos un total antes de validar.')
    patch.reviewed_at = patch.status === 'validado' ? new Date().toISOString() : null
    setSaving(true)
    try { await onSaved(report.id, patch); onClose() }
    catch (cause) { setError(cause.message || 'No se pudo guardar.') }
    finally { setSaving(false) }
  }

  const previewDifference = difference(form)
  return <div className="modal-overlay" role="presentation" onMouseDown={onClose}><form className="modal shift-review-modal" role="dialog" aria-modal="true" aria-label="Revisar jornada" onMouseDown={event => event.stopPropagation()} onSubmit={save}>
    <header className="modal-head"><h2>Revisar jornada</h2><button type="button" className="icon-only" onClick={onClose} aria-label="Cerrar"><X size={20}/></button></header>
    <div className="shift-review-identification"><strong>{drivers.find(driver => driver.id === report.driver_id)?.name || report.driver_id}</strong><em>{vehicles.find(vehicle => vehicle.id === report.vehicle_id)?.plate || report.vehicle_id}</em><em>{report.shift_date}</em></div>
    <div className="shift-review-photos">
      {report.sheet_photo_path && <div><strong>Planilla de jornada</strong>{photos.sheet ? <a href={photos.sheet} target="_blank" rel="noopener noreferrer" aria-label="Abrir planilla completa"><img src={photos.sheet} alt="Planilla de jornada"/></a> : <em>Cargando foto...</em>}</div>}
      {report.meter_photo_path && <div><strong>Detalle del taxímetro</strong>{photos.meter ? <a href={photos.meter} target="_blank" rel="noopener noreferrer" aria-label="Abrir detalle completo"><img src={photos.meter} alt="Detalle del taxímetro"/></a> : <em>Cargando foto...</em>}</div>}
    </div>
    <div className="shift-review-fields">
      <label>Conductor<select value={form.driver_id} onChange={event => setForm(previous => ({ ...previous, driver_id: event.target.value }))}>{drivers.map(driver => <option key={driver.id} value={driver.id}>{driver.name}</option>)}</select></label>
      <label>Matrícula<select value={form.vehicle_id} onChange={event => setForm(previous => ({ ...previous, vehicle_id: event.target.value }))}>{vehicles.map(vehicle => <option key={vehicle.id} value={vehicle.id}>{vehicle.plate}</option>)}</select></label>
      <label>Fecha de la jornada<input type="date" value={form.shift_date} onChange={event => setForm(previous => ({ ...previous, shift_date: event.target.value }))} required/></label>
      {input('mobile_number', 'Número de móvil')}
      {input('odometer_start_km', 'Odómetro inicial (km)', 'number')}
      {input('odometer_end_km', 'Odómetro final (km)', 'number')}
      {input('sheet_trip_count', 'Viajes en planilla', 'number')}
      {input('meter_trip_count', 'Viajes en taxímetro', 'number')}
      {input('sheet_total_uyu', 'Total en planilla (UYU)', 'number')}
      {input('meter_total_uyu', 'Total en taxímetro (UYU)', 'number')}
      <label>Estado<select value={form.status} onChange={event => setForm(previous => ({ ...previous, status: event.target.value }))}><option value="revision">A revisar</option><option value="validado">Validado</option></select></label>
      <label className="field-wide">Viajes anotados en planilla<textarea rows="3" value={form.sheet_trip_lines} onChange={event => setForm(previous => ({ ...previous, sheet_trip_lines: event.target.value }))}/></label>
      <label className="field-wide">Viajes impresos por taxímetro<textarea rows="3" value={form.meter_trip_lines} onChange={event => setForm(previous => ({ ...previous, meter_trip_lines: event.target.value }))}/></label>
      <label className="field-wide">Observaciones de revisión<textarea rows="2" value={form.review_notes} onChange={event => setForm(previous => ({ ...previous, review_notes: event.target.value }))}/></label>
    </div>
    {previewDifference != null && <div className="shift-review-difference">Diferencia entre planilla y taxímetro: <strong>{money(previewDifference)}</strong></div>}
    {error && <div className="form-error" role="alert">{error}</div>}
    <div className="modal-actions"><button type="button" className="button secondary" onClick={onClose}>Cancelar</button><button type="submit" className="button primary" disabled={saving}><Check size={17}/>{saving ? 'Guardando...' : 'Guardar revisión'}</button></div>
  </form></div>
}

export default function ShiftReportsPage({ data }) {
  const [session, setSession] = useState(undefined)
  const [reports, setReports] = useState([])
  const [selected, setSelected] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('prueba.taxis@example.com')
  const [password, setPassword] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  useEffect(() => {
    if (!supabase) { setSession(null); return undefined }
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    supabase.auth.getSession().then(({ data: result }) => setSession(result.session)).catch(() => setSession(null))
    return () => listener.subscription.unsubscribe()
  }, [])
  useEffect(() => {
    if (!session) return undefined
    let active = true
    setLoading(true)
    listShiftReports().then(items => { if (active) { setReports(items); setError('') } })
      .catch(cause => { if (active) setError(cause.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [session])

  async function signIn(event) {
    event.preventDefault()
    setError('')
    const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (authError) setError('No se pudo ingresar. Revisá el correo y la contraseña.')
    else setPassword('')
  }
  async function save(id, patch) {
    const updated = await updateShiftReport(id, patch)
    setReports(previous => previous.map(report => report.id === id ? updated : report))
  }
  async function refresh() {
    setRefreshing(true)
    try { setReports(await listShiftReports()); setError('') }
    catch (cause) { setError(cause.message) }
    finally { setRefreshing(false) }
  }
  const drivers = currentDrivers(data)
  const vehicles = currentVehicles(data)
  if (session === undefined) return <div className="body-copy">Cargando jornadas...</div>
  if (!session) return <form className="report-login" onSubmit={signIn}><h2>Ingresar para revisar jornadas</h2><label>Correo<input type="email" value={email} onChange={event => setEmail(event.target.value)} required/></label><label>Contraseña<input type="password" value={password} onChange={event => setPassword(event.target.value)} required/></label>{error && <div className="form-error" role="alert">{error}</div>}<button className="button primary" type="submit">Ingresar</button></form>
  return <>
    {error && <div className="form-error" role="alert">{error}</div>}
    <button type="button" className="text-link report-refresh" onClick={refresh} disabled={refreshing}>{refreshing ? 'Actualizando...' : 'Actualizar jornadas'}</button>
    {loading ? <div className="body-copy">Cargando jornadas...</div> : reports.length === 0 ? <div className="report-empty">Todavía no se enviaron jornadas.</div> : <div className="table-scroller report-table"><table className="data-table"><thead><tr><th>Fecha</th><th>Conductor</th><th>Matrícula</th><th>Fotos</th><th>Planilla</th><th>Taxímetro</th><th>Diferencia</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{reports.map(report => <tr key={report.id}>
      <td>{report.shift_date}</td><td><strong>{drivers.find(driver => driver.id === report.driver_id)?.name || report.driver_id}</strong></td><td>{vehicles.find(vehicle => vehicle.id === report.vehicle_id)?.plate || report.vehicle_id}</td>
      <td>{[report.sheet_photo_path && 'Planilla', report.meter_photo_path && 'Taxímetro'].filter(Boolean).join(', ')}</td><td className="amount">{amount(report.sheet_total_uyu)}</td><td className="amount">{amount(report.meter_total_uyu)}</td><td className="amount">{difference(report) == null ? 'Sin comparar' : money(difference(report))}</td>
      <td><em className={`badge badge-${report.status === 'validado' ? 'ok' : 'warning'}`}>{report.status === 'validado' ? 'Validado' : 'A revisar'}</em></td><td><button type="button" className="edit-action" onClick={() => setSelected(report)} aria-label={`Revisar jornada del ${report.shift_date}`} title="Revisar jornada"><EditIcon/></button></td>
    </tr>)}</tbody></table></div>}
    {selected && <ReviewForm key={selected.id} report={selected} data={data} onClose={() => setSelected(null)} onSaved={save}/>}
  </>
}
