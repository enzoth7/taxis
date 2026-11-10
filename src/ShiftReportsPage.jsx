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
function localDateTime(value) {
  if (!value) return ''
  const date = new Date(value)
  const pad = part => String(part).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function ReviewForm({ report, data, onClose, onSaved }) {
  const [form, setForm] = useState({
    driver_name: fieldValue(report.driver_name || currentDrivers(data).find(driver => driver.id === report.driver_id)?.name || report.driver_id),
    vehicle_id: report.vehicle_id,
    shift_date: report.shift_date,
    mobile_number: fieldValue(report.mobile_number),
    started_at: localDateTime(report.started_at),
    ended_at: localDateTime(report.ended_at),
    odometer_start_km: fieldValue(report.odometer_start_km),
    odometer_end_km: fieldValue(report.odometer_end_km),
    reported_sales_uyu: fieldValue(report.reported_sales_uyu),
    reported_commission_uyu: fieldValue(report.reported_commission_uyu),
    reported_jornal_pos_kind: fieldValue(report.reported_jornal_pos_kind || 'jornal'),
    reported_jornal_pos_uyu: fieldValue(report.reported_jornal_pos_uyu),
    reported_fiado_uyu: fieldValue(report.reported_fiado_uyu),
    reported_total_to_pay_uyu: fieldValue(report.reported_total_to_pay_uyu),
    reported_expenses_uyu: fieldValue(report.reported_expenses_uyu),
    reported_expenses_note: fieldValue(report.reported_expenses_note),
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
    const numbers = ['odometer_start_km', 'odometer_end_km', 'sheet_trip_count', 'meter_trip_count', 'sheet_total_uyu', 'meter_total_uyu', 'reported_sales_uyu', 'reported_commission_uyu', 'reported_jornal_pos_uyu', 'reported_fiado_uyu', 'reported_total_to_pay_uyu', 'reported_expenses_uyu']
    const patch = { ...form }
    if (!patch.driver_name.trim() || !patch.mobile_number.trim() || !patch.shift_date) return setError('Completá conductor, móvil y fecha.')
    for (const name of ['started_at', 'ended_at']) patch[name] = patch[name] ? new Date(patch[name]).toISOString() : null
    if (patch.started_at && patch.ended_at && patch.ended_at <= patch.started_at) return setError('El fin del turno debe ser posterior al inicio.')
    for (const name of numbers) patch[name] = patch[name] === '' ? null : Number(patch[name])
    if (numbers.some(name => patch[name] != null && (!Number.isFinite(patch[name]) || patch[name] < 0))) return setError('Revisá los importes y kilómetros.')
    if (patch.odometer_start_km != null && patch.odometer_end_km != null && patch.odometer_end_km < patch.odometer_start_km) return setError('El odómetro final debe ser mayor o igual al inicial.')
    if (['sheet_trip_count', 'meter_trip_count'].some(name => patch[name] != null && !Number.isInteger(patch[name]))) return setError('La cantidad de viajes debe ser un número entero.')
    if (patch.status === 'validado' && patch.sheet_total_uyu == null && patch.meter_total_uyu == null && patch.reported_sales_uyu == null) return setError('Registrá al menos un total antes de validar.')
    patch.reviewed_at = patch.status === 'validado' ? new Date().toISOString() : null
    setSaving(true)
    try { await onSaved(report.id, patch); onClose() }
    catch (cause) { setError(cause.message || 'No se pudo guardar.') }
    finally { setSaving(false) }
  }

  const previewDifference = difference(form)
  return <div className="modal-overlay" role="presentation" onMouseDown={onClose}><form className="modal shift-review-modal" role="dialog" aria-modal="true" aria-label="Revisar jornada" onMouseDown={event => event.stopPropagation()} onSubmit={save}>
    <header className="modal-head"><h2>Revisar jornada</h2><button type="button" className="icon-only" onClick={onClose} aria-label="Cerrar"><X size={20}/></button></header>
    <div className="shift-review-identification"><strong>{form.driver_name}</strong><em>Móvil {form.mobile_number || 'sin número'}</em><em>{report.shift_date}</em></div>
    <div className="shift-review-photos">
      {report.sheet_photo_path && <div><strong>Planilla de jornada</strong>{photos.sheet ? <a href={photos.sheet} target="_blank" rel="noopener noreferrer" aria-label="Abrir planilla completa"><img src={photos.sheet} alt="Planilla de jornada"/></a> : <em>Cargando foto...</em>}</div>}
      {report.meter_photo_path && <div><strong>Detalle del taxímetro</strong>{photos.meter ? <a href={photos.meter} target="_blank" rel="noopener noreferrer" aria-label="Abrir detalle completo"><img src={photos.meter} alt="Detalle del taxímetro"/></a> : <em>Cargando foto...</em>}</div>}
    </div>
    <div className="shift-review-fields">
      {input('driver_name', 'Conductor')}
      <label>Matrícula<select value={vehicles.some(vehicle => vehicle.id === form.vehicle_id) ? form.vehicle_id : ''} onChange={event => setForm(previous => ({ ...previous, vehicle_id: event.target.value || `movil-${form.mobile_number}` }))}><option value="">Sin indicar</option>{vehicles.map(vehicle => <option key={vehicle.id} value={vehicle.id}>{vehicle.plate}</option>)}</select></label>
      <label>Fecha de la jornada<input type="date" value={form.shift_date} onChange={event => setForm(previous => ({ ...previous, shift_date: event.target.value }))} required/></label>
      {input('mobile_number', 'Número de móvil')}
      {input('started_at', 'Inicio del turno', 'datetime-local')}
      {input('ended_at', 'Fin del turno', 'datetime-local')}
      {input('odometer_start_km', 'Odómetro inicial (km)', 'number')}
      {input('odometer_end_km', 'Odómetro final (km)', 'number')}
      {input('reported_sales_uyu', 'Venta declarada (UYU)', 'number')}
      {input('reported_commission_uyu', 'Comisión declarada (UYU)', 'number')}
      <label>Concepto<select value={form.reported_jornal_pos_kind} onChange={event => setForm(previous => ({ ...previous, reported_jornal_pos_kind: event.target.value }))}><option value="jornal">Jornal</option><option value="pos">POS</option></select></label>
      {input('reported_jornal_pos_uyu', 'Jornal o POS (UYU)', 'number')}
      {input('reported_fiado_uyu', 'Fiado (UYU)', 'number')}
      {input('reported_total_to_pay_uyu', 'Total a pagar (UYU)', 'number')}
      {input('reported_expenses_uyu', 'Gastos (UYU)', 'number')}
      {input('reported_expenses_note', 'Detalle de gastos')}
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

export default function ShiftReportsPage({ data, onChanged }) {
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
    onChanged?.()
  }
  async function refresh() {
    setRefreshing(true)
    try { setReports(await listShiftReports()); onChanged?.(); setError('') }
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
    {loading ? <div className="body-copy">Cargando jornadas...</div> : reports.length === 0 ? <div className="report-empty">Todavía no se enviaron jornadas.</div> : <div className="table-scroller report-table"><table className="data-table"><thead><tr><th>Fecha</th><th>Conductor</th><th>Móvil</th><th>Venta declarada</th><th>Fotos</th><th>Planilla</th><th>Taxímetro</th><th>Diferencia</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{reports.map(report => <tr key={report.id}>
      <td>{report.shift_date}</td><td><strong>{report.driver_name || drivers.find(driver => driver.id === report.driver_id)?.name || report.driver_id}</strong></td><td>{report.mobile_number || vehicles.find(vehicle => vehicle.id === report.vehicle_id)?.plate || report.vehicle_id}</td><td className="amount">{amount(report.reported_sales_uyu)}</td>
      <td>{[report.sheet_photo_path && 'Planilla', report.meter_photo_path && 'Taxímetro'].filter(Boolean).join(', ')}</td><td className="amount">{amount(report.sheet_total_uyu)}</td><td className="amount">{amount(report.meter_total_uyu)}</td><td className="amount">{difference(report) == null ? 'Sin comparar' : money(difference(report))}</td>
      <td><em className={`badge badge-${report.status === 'validado' ? 'ok' : 'warning'}`}>{report.status === 'validado' ? 'Validado' : 'A revisar'}</em></td><td><button type="button" className="edit-action" onClick={() => setSelected(report)} aria-label={`Revisar jornada del ${report.shift_date}`} title="Revisar jornada"><EditIcon/></button></td>
    </tr>)}</tbody></table></div>}
    {selected && <ReviewForm key={selected.id} report={selected} data={data} onClose={() => setSelected(null)} onSaved={save}/>}
  </>
}
