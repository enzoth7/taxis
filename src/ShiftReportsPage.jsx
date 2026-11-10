import { useEffect, useState } from 'react'
import { Check, Eye, X } from 'lucide-react'
import EditIcon from './EditIcon.jsx'
import { currentDrivers, currentVehicles } from './data/catalog.js'
import { inDateRange, money, number } from './lib/core.js'
import { mobileNumberForId } from './lib/mobileRoster.js'
import { downloadShiftPhoto, updateShiftReport } from './lib/shiftReports.js'
import { orientedPhotoBlob, photoRotation } from './lib/photoOrientation.js'
import ColumnFilter from './ColumnFilter.jsx'

const FILTER_COLUMNS = [
  { key: 'date', label: 'Fecha' },
  { key: 'driver', label: 'Conductor' },
  { key: 'mobile', label: 'Móvil' },
  { key: 'declared', label: 'Venta declarada' },
  { key: 'photo', label: 'Foto' },
  { key: 'amount', label: 'Importe' },
  { key: 'km', label: 'Km recorridos' },
  { key: 'status', label: 'Estado' },
]

function amount(value) { return value == null ? 'Sin registrar' : money(Number(value)) }
function difference(report) {
  if (report.sheet_total_uyu == null || report.meter_total_uyu == null || report.sheet_total_uyu === '' || report.meter_total_uyu === '') return null
  return Number(report.sheet_total_uyu) - Number(report.meter_total_uyu)
}
function kilometersTraveled(row) {
  if (row.odometer_start_km == null || row.odometer_end_km == null || row.odometer_start_km === '' || row.odometer_end_km === '') return 'Sin registrar'
  const start = Number(row.odometer_start_km)
  const end = Number(row.odometer_end_km)
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 'A revisar'
  return `${number(end - start, 1)} km`
}
export function photoStatus(row, sources) {
  if (!sources.length) return { label: 'Sin imagen', kind: 'orange' }
  const review = row.source_kind === 'hoja' ? row.raw_values?.review_status : row.status
  const photoType = row.raw_values?.photo_type || row.foto_datos_extraidos?.photo_type
  const unreadablePhoto = row.foto_alertas?.some?.(flag => ['imagen_ilegible', 'foto_ilegible'].includes(flag))
  if (review === 'ilegible' || photoType === 'ilegible' || unreadablePhoto) return { label: 'Imagen ilegible', kind: 'danger' }
  if (['validado', 'lista', 'revisado'].includes(review)) return { label: 'Revisado', kind: 'ok' }
  return { label: 'A revisar', kind: 'warning' }
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
    driver_name: fieldValue(report.driver_name || currentDrivers(data).find(driver => driver.id === report.driver_id)?.name || ''),
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
    if (!patch.driver_name.trim() || !/^\d+$/.test(patch.mobile_number.trim()) || !patch.shift_date) return setError('Completá conductor, móvil y fecha.')
    patch.vehicle_id = `movil-${patch.mobile_number.trim()}`
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
      {report.meter_photo_path && <div><strong>Comprobante de viajes</strong>{photos.meter ? <a href={photos.meter} target="_blank" rel="noopener noreferrer" aria-label="Abrir comprobante completo"><img src={photos.meter} alt="Comprobante de viajes"/></a> : <em>Cargando foto...</em>}</div>}
    </div>
    <div className="shift-review-fields">
      {input('driver_name', 'Conductor')}
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
      {input('meter_trip_count', 'Viajes del comprobante', 'number')}
      {input('sheet_total_uyu', 'Total en planilla (UYU)', 'number')}
      {input('meter_total_uyu', 'Total del comprobante (UYU)', 'number')}
      <label>Estado<select value={form.status} onChange={event => setForm(previous => ({ ...previous, status: event.target.value }))}><option value="revision">A revisar</option><option value="validado">Validado</option></select></label>
      <label className="field-wide">Viajes anotados en planilla<textarea rows="3" value={form.sheet_trip_lines} onChange={event => setForm(previous => ({ ...previous, sheet_trip_lines: event.target.value }))}/></label>
      <label className="field-wide">Viajes del comprobante<textarea rows="3" value={form.meter_trip_lines} onChange={event => setForm(previous => ({ ...previous, meter_trip_lines: event.target.value }))}/></label>
      <label className="field-wide">Observaciones de revisión<textarea rows="2" value={form.review_notes} onChange={event => setForm(previous => ({ ...previous, review_notes: event.target.value }))}/></label>
    </div>
    {previewDifference != null && <div className="shift-review-difference">Diferencia entre planilla y comprobante: <strong>{money(previewDifference)}</strong></div>}
    {error && <div className="form-error" role="alert">{error}</div>}
    <div className="modal-actions"><button type="button" className="button secondary" onClick={onClose}>Cancelar</button><button type="submit" className="button primary" disabled={saving}><Check size={17}/>{saving ? 'Guardando...' : 'Guardar revisión'}</button></div>
  </form></div>
}

export function PhotoViewer({ sources, onClose }) {
  const [photos, setPhotos] = useState([])
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    const urls = []
    Promise.all(sources.map(async source => {
      const blob = await downloadShiftPhoto(source.path)
      const display = await orientedPhotoBlob(blob, source.rotationDegrees || 0)
      const url = URL.createObjectURL(display)
      if (!active) { URL.revokeObjectURL(url); return null }
      urls.push(url)
      return { ...source, url }
    })).then(items => { if (active) setPhotos(items.filter(Boolean)) })
      .catch(() => { if (active) setError('No se pudieron abrir las fotos de esta jornada.') })
    return () => { active = false; urls.forEach(url => URL.revokeObjectURL(url)) }
  }, [sources])
  return <div className="modal-overlay" role="presentation" onMouseDown={onClose}><div className="modal shift-photo-modal" role="dialog" aria-modal="true" aria-label="Fotos de la jornada" onMouseDown={event => event.stopPropagation()}>
    <header className="modal-head"><h2>Fotos de la jornada</h2><button type="button" className="icon-only" onClick={onClose} aria-label="Cerrar"><X size={20}/></button></header>
    {error && <div className="form-error" role="alert">{error}</div>}
    {!error && !photos.length && <div className="body-copy">Cargando fotos...</div>}
    <div className={`shift-review-photos ${photos.length === 1 ? 'single-photo' : ''}`}>{photos.map(photo => <div key={photo.path}><strong>{photo.label}</strong><a href={photo.url} target="_blank" rel="noopener noreferrer" aria-label={`Abrir ${photo.label} completa`}><img src={photo.url} alt={photo.label}/></a></div>)}</div>
  </div></div>
}

export default function ShiftReportsPage({ data, range, reports = [], archiveShifts = [], authSession, archiveError = '', reportsError = '', onChanged, onInspectArchive }) {
  const [selected, setSelected] = useState(null)
  const [photoSources, setPhotoSources] = useState(null)
  const [filters, setFilters] = useState({})
  const [openFilter, setOpenFilter] = useState(null)
  const [page, setPage] = useState(0)

  async function save(id, patch) {
    await updateShiftReport(id, patch)
    await onChanged?.()
  }
  const drivers = currentDrivers(data)
  const vehicles = currentVehicles(data)
  const visibleReports = reports.filter(report => inDateRange(report.shift_date, range)).map(report => ({ ...report, source_kind: 'conductor', record_date: report.shift_date }))
  const visibleArchive = archiveShifts.filter(row => inDateRange(row.record_date, range)).map(row => ({ ...row, source_kind: 'hoja' }))
  const entries = [...visibleReports, ...visibleArchive].sort((a, b) => b.record_date.localeCompare(a.record_date) || String(b.id).localeCompare(String(a.id)))
  const tableRows = entries.map(row => {
    const historical = row.source_kind === 'hoja'
    const sources = historical
      ? row.archive_photo_path ? [{ label: 'Planilla histórica', path: row.archive_photo_path, rotationDegrees: photoRotation(row) }] : []
      : [{ label: 'Planilla de jornada', path: row.sheet_photo_path }, { label: 'Comprobante de viajes', path: row.meter_photo_path }].filter(source => source.path)
    const declared = historical ? row.sales_uyu : row.reported_sales_uyu
    const sheetAmount = historical ? row.sales_uyu : row.sheet_total_uyu
    const driverName = row.driver_name || drivers.find(driver => driver.id === row.driver_id)?.name
    const missing = { driver: !driverName, declared: declared == null, amount: sheetAmount == null }
    const state = photoStatus(row, sources)
    return { row, sources, state, missing, values: {
      date: row.record_date,
      driver: driverName || 'Sin identificar',
      mobile: row.mobile_number || mobileNumberForId(row.vehicle_id, vehicles) || 'Sin indicar',
      declared: amount(declared),
      photo: sources.length ? 'Con foto' : 'Sin foto',
      amount: amount(sheetAmount),
      km: kilometersTraveled(row),
      status: state.label,
    } }
  })
  const optionsByColumn = Object.fromEntries(FILTER_COLUMNS.map(({ key }) => [key, [...new Set(tableRows.map(item => item.values[key]))].sort((a, b) => String(a).localeCompare(String(b), 'es', { numeric: true }))]))
  const filteredRows = tableRows.filter(item => FILTER_COLUMNS.every(({ key }) => !filters[key] || item.values[key] === filters[key]))
  useEffect(() => setPage(0), [range.start, range.end, entries.length])
  const pageSize = 50
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize))
  const currentPage = Math.min(page, pageCount - 1)
  const shown = filteredRows.slice(currentPage * pageSize, (currentPage + 1) * pageSize)
  if (authSession === undefined) return <div className="body-copy">Cargando jornadas...</div>
  return <>
    {(archiveError || reportsError) && <div className="form-error" role="alert">{archiveError || reportsError}</div>}
    {entries.length === 0 ? <div className="report-empty">No hay jornadas en este período.</div> : <div className="table-scroller report-table"><table className="data-table mobile-card-table filter-card-table planillas-table"><thead><tr>{FILTER_COLUMNS.map(({ key, label }) => <th key={key}><ColumnFilter label={label} value={filters[key] || ''} options={optionsByColumn[key]} open={openFilter === key} onToggle={() => setOpenFilter(current => current === key ? null : key)} onClose={() => setOpenFilter(null)} onChange={value => { setFilters(current => ({ ...current, [key]: value })); setPage(0) }}/></th>)}<th>Acciones</th></tr></thead><tbody>{shown.map(({ row, sources, state, missing, values }) => {
      const historical = row.source_kind === 'hoja'
      return <tr key={`${row.source_kind}-${row.id}`}>
        <td data-label="Fecha">{values.date}</td><td data-label="Conductor"><strong className={missing.driver ? 'missing-value' : undefined}>{values.driver}</strong></td><td data-label="Móvil">{values.mobile}</td><td data-label="Venta declarada" className={`amount ${missing.declared ? 'missing-value' : ''}`}>{values.declared}</td>
        <td data-label="Foto"><em className={`badge badge-${sources.length ? 'ok' : 'danger'}`}>{values.photo}</em></td><td data-label="Importe" className={`amount ${missing.amount ? 'missing-value' : ''}`}>{values.amount}</td><td data-label="Km recorridos" className={values.km === 'Sin registrar' || values.km === 'A revisar' ? 'missing-value' : undefined}>{values.km}</td>
        <td data-label="Estado"><em className={`badge badge-${state.kind}`}>{state.label}</em></td>
        <td data-label="Acciones" className="report-actions">{sources.length > 0 && <button type="button" className="edit-action" onClick={() => setPhotoSources(sources)} aria-label={`Ver fotos de la jornada del ${row.record_date}`} title="Ver fotos"><Eye size={21} strokeWidth={1.8}/></button>}{authSession?.user && <button type="button" className="edit-action" onClick={() => historical ? onInspectArchive?.(row) : setSelected(row)} aria-label={`Editar jornada del ${row.record_date}`} title="Editar jornada"><EditIcon/></button>}</td>
      </tr>
    })}</tbody></table></div>}
    {entries.length > 0 && filteredRows.length === 0 && <div className="report-empty">No hay jornadas con estos filtros.</div>}
    {filteredRows.length > pageSize && <div className="report-pages"><button type="button" className="button secondary compact" disabled={currentPage === 0} onClick={() => setPage(value => value - 1)}>Anterior</button><div>Página {currentPage + 1} de {pageCount}</div><button type="button" className="button secondary compact" disabled={currentPage >= pageCount - 1} onClick={() => setPage(value => value + 1)}>Siguiente</button></div>}
    {selected && <ReviewForm key={selected.id} report={selected} data={data} onClose={() => setSelected(null)} onSaved={save}/>}
    {photoSources && <PhotoViewer sources={photoSources} onClose={() => setPhotoSources(null)}/>}
  </>
}
