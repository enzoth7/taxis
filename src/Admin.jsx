import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import {
  LayoutDashboard, ReceiptText, UsersRound, CarFront, List, Wallet,
  BarChart3, CalendarDays, Menu, Plus, Search,
  AlertCircle, Eye, X, Image as ImageIcon, Clock3,
  Check, ClipboardList,
} from 'lucide-react'
import { VEHICLES, DRIVERS, currentVehicles, currentDrivers, localDate } from './data/catalog.js'
import { money, number, metrics, recordedMonthBounds, monthRange, inDateRange, dailyRevenueRange, groupByKey } from './lib/core.js'
import { buildMobileRoster, mobileLabel, mobileNumberForId } from './lib/mobileRoster.js'
import { getPhoto } from './lib/photos.js'
import EditRecord from './EditRecord.jsx'
import EditIcon from './EditIcon.jsx'
import RevenueChart from './RevenueChart.jsx'
import ShiftReportsPage, { PhotoViewer } from './ShiftReportsPage.jsx'
import CalendarPage from './CalendarPage.jsx'
import PerformancePage from './PerformancePage.jsx'
import MonthlyActivityChart from './MonthlyActivityChart.jsx'
import ColumnFilter from './ColumnFilter.jsx'
import { downloadShiftPhoto } from './lib/shiftReports.js'
import { orientedPhotoBlob, photoRotation } from './lib/photoOrientation.js'
import { driverMonthlySummary, mobileMonthlySummary } from './lib/driverMonthly.js'
import { monthlyActivity } from './lib/monthlyActivity.js'

const CatalogContext = createContext({ vehicles: VEHICLES, drivers: DRIVERS })
const EditContext = createContext(() => {})
const CanEditContext = createContext(false)
function EditAction({ label, onClick }) { const canEdit = useContext(CanEditContext); return <button type="button" className="edit-action" onClick={onClick} disabled={!canEdit} aria-label={`Editar ${label}`} title={canEdit ? `Editar ${label}` : 'Edición reservada al administrador'}><EditIcon/></button> }
function MissingValue({ children }) { return <em className="missing-value">{children}</em> }
function NewTabIcon() { return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"/><path d="M13 3h8v8"/><path d="m10 14 11-11"/></svg> }

const NAV = [
  { id: 'dashboard', label: 'Inicio', Icon: LayoutDashboard },
  { id: 'reports', label: 'Planillas', Icon: ClipboardList },
  { id: 'shifts', label: 'Turnos', Icon: Clock3 },
  { id: 'drivers', label: 'Conductores', Icon: UsersRound },
  { id: 'fleet', label: 'Flota de taxis', Icon: CarFront },
  { id: 'movements', label: 'Movimientos', Icon: List },
  { id: 'calendar', label: 'Calendario', Icon: CalendarDays },
  { id: 'performance', label: 'Rendimiento', Icon: BarChart3 },
]

const STATUS = {
  validado: ['Validado', 'ok'],
  revision: ['A revisar', 'warning'],
  manual: ['Manual', 'neutral'],
}

const SHIFT_FILTER_COLUMNS = [
  { key: 'date', label: 'Fecha' },
  { key: 'mobile', label: 'Móvil' },
  { key: 'driver', label: 'Conductor' },
  { key: 'shift', label: 'Turno' },
  { key: 'sales', label: 'Entradas' },
  { key: 'commission', label: 'Comisión' },
  { key: 'odometerStart', label: 'Km inicial' },
  { key: 'odometerEnd', label: 'Km final' },
]
const DRIVER_FILTER_COLUMNS = [
  { key: 'driver', label: 'Conductor' },
  { key: 'document', label: 'Documento' },
  { key: 'phone', label: 'Teléfono' },
  { key: 'license', label: 'Licencia' },
  { key: 'mobiles', label: 'Móviles' },
  { key: 'stand', label: 'Parada' },
  { key: 'status', label: 'Estado' },
  { key: 'shifts', label: 'Jornadas' },
  { key: 'km', label: 'Kilómetros' },
  { key: 'sales', label: 'Entradas' },
  { key: 'commission', label: 'Comisión' },
]

function columnOptions(rows, columns) {
  return Object.fromEntries(columns.map(({ key }) => [key, [...new Set(rows.flatMap(row => {
    const value = row.filterValues?.[key] ?? row.values[key]
    return Array.isArray(value) ? value : [value]
  }))].sort((a, b) => String(a).localeCompare(String(b), 'es', { numeric: true }))]))
}
function matchesColumnFilters(row, filters, columns) {
  return columns.every(({ key }) => {
    if (!filters[key]) return true
    const value = row.filterValues?.[key] ?? row.values[key]
    return Array.isArray(value) ? value.includes(filters[key]) : value === filters[key]
  })
}
function FilteredHeader({ columns, filters, openFilter, setOpenFilter, setFilters, options, onChange }) {
  return <thead><tr>{columns.map(({ key, label }) => <th key={key}><ColumnFilter label={label} value={filters[key] || ''} options={options[key]} open={openFilter === key} onToggle={() => setOpenFilter(current => current === key ? null : key)} onClose={() => setOpenFilter(null)} onChange={value => { setFilters(current => ({ ...current, [key]: value })); onChange?.() }}/></th>)}<th>Acciones</th></tr></thead>
}

function Badge({ kind = 'neutral', children }) { return <em className={`badge badge-${kind}`}>{children}</em> }
function TicketBadge({ status }) { const [label, kind] = STATUS[status] || ['Manual', 'neutral']; return <Badge kind={kind}>{label}</Badge> }
function historicalStats(rows) {
  return rows.reduce((totals, row) => {
    if (!row.driver_name) return totals
    const item = totals[row.driver_name] ||= { shifts: 0, sales: 0, commission: 0, km: 0 }
    item.shifts += 1
    item.sales += Number(row.sales_uyu || 0)
    item.commission += Number(row.commission_uyu || 0)
    const start = Number(row.odometer_start_km)
    const end = Number(row.odometer_end_km)
    if (row.odometer_start_km != null && row.odometer_end_km != null && end >= start) item.km += end - start
    return totals
  }, {})
}
function EntityBadge({ status }) {
  const label = status || 'Sin confirmar'
  const kind = label === 'Activo' ? 'ok' : label === 'Inactivo' ? 'danger' : label === 'Mantenimiento' ? 'warning' : 'neutral'
  return <Badge kind={kind}>{label}</Badge>
}
function Panel({ title, subtitle, action, children, className = '' }) {
  return <section className={`panel ${className}`}>
    {(title || action) && <header className="panel-heading"><h2>{title}</h2>{subtitle && <div className="body-copy">{subtitle}</div>}{action}</header>}
    {children}
  </section>
}
function SectionTitle({ title, description, action }) {
  return <div className="section-title"><div><h1>{title}</h1><div className="body-copy">{description}</div></div>{action}</div>
}
function PeriodPicker({ fromMonth, toMonth, onFromMonth, onToMonth }) {
  const latestMonth = localDate().slice(0, 7)
  return <div className="period-picker" role="group" aria-label="Filtrar por meses">
    <label>Desde<input type="month" value={fromMonth} max={latestMonth} onChange={event => onFromMonth(event.target.value)}/></label>
    <label>Hasta<input type="month" value={toMonth} max={latestMonth} onChange={event => onToMonth(event.target.value)}/></label>
  </div>
}
function VehicleLabel({ id }) { const { vehicles } = useContext(CatalogContext); const vehicle = vehicles.find(v => v.id === id); return vehicle ? mobileLabel(vehicle) : <MissingValue>Sin identificar</MissingValue> }
function DriverLabel({ id }) { const { drivers } = useContext(CatalogContext); return drivers.find(d => d.id === id)?.name || '—' }
function Empty({ icon: Icon = ReceiptText, title = 'Sin registros', text = 'Todavía no hay datos para mostrar.' }) {
  return <div className="empty"><Icon size={25} /><strong>{title}</strong><div className="body-copy">{text}</div></div>
}
function currencyCSV(value) { return value == null ? '' : String(value).replaceAll(';', ',').replaceAll('"', '""') }
function downloadCSV(name, headers, rows) {
  const contents = '\uFEFF' + [headers, ...rows].map(row => row.map(v => `"${currencyCSV(v)}"`).join(';')).join('\r\n')
  const url = URL.createObjectURL(new Blob([contents], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url; a.download = name; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

function TicketTable({ tickets, onInspect, compact = false }) {
  const edit = useContext(EditContext)
  const ordered = [...tickets].sort((a,b) => `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`))
  if (!tickets.length) return <Empty />
  return <div className="table-scroller"><table className="data-table"><thead><tr><th>Ticket</th><th>Conductor / móvil</th><th>Fecha</th><th>Importe</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>
    {ordered.slice(0, compact ? 6 : 200).map(t => <tr key={t.id}>
      <td><button className="ticket-link" onClick={() => onInspect(t)}>{t.ticketNumber || `#${t.id.slice(0,7)}`}</button></td>
      <td><div className="cell-main"><strong><DriverLabel id={t.driverId}/></strong><small><VehicleLabel id={t.vehicleId}/></small></div></td>
      <td><div className="cell-main"><em>{new Date(`${t.date}T12:00:00`).toLocaleDateString('es-UY', { day:'2-digit', month:'short' })}</em><small>{t.time}</small></div></td>
      <td className="amount">{t.amount == null ? 'Por completar' : money(t.amount)}</td><td><TicketBadge status={t.status}/></td><td><EditAction label={`ticket ${t.ticketNumber || t.id}`} onClick={() => edit('tickets', t)}/></td>
    </tr>)}
  </tbody></table></div>
}

function TicketDetail({ ticket, onClose, onUpdateTicket }) {
  const [photoUrl, setPhotoUrl] = useState(null)
  const canValidate = ticket?.amount != null && Number(ticket.amount) > 0 && ticket?.distanceKm != null && Number(ticket.distanceKm) >= 0 && Boolean(ticket?.payment)
  useEffect(() => {
    let active = true
    setPhotoUrl(null)
    let current = null
    if (ticket?.hasPhoto) getPhoto(ticket.id, ticket.photoPath).then(blob => {
      if (!active || !blob) return
      current = URL.createObjectURL(blob)
      setPhotoUrl(current)
    }).catch(() => {})
    return () => { active = false; if (current) URL.revokeObjectURL(current) }
  }, [ticket])
  if (!ticket) return null
  return <div className="modal-overlay" onMouseDown={onClose} role="presentation"><div className="modal" role="dialog" aria-modal="true" aria-label="Detalle de ticket" onMouseDown={e=>e.stopPropagation()}>
    <div className="modal-head"><div><h2>Ticket {ticket.ticketNumber || 'sin número'}</h2></div><button className="icon-only" onClick={onClose} aria-label="Cerrar"><X size={20}/></button></div>
    {photoUrl ? <img src={photoUrl} alt="Foto del comprobante adjuntado" className="ticket-photo" /> : <div className="photo-missing"><ImageIcon size={26}/><em>{ticket.hasPhoto ? 'No se pudo abrir la fotografía' : 'Sin fotografía adjunta'}</em></div>}
    <div className="detail-pairs">
      <div><em>Conductor</em><strong><DriverLabel id={ticket.driverId}/></strong></div>
      <div><em>Vehículo</em><strong><VehicleLabel id={ticket.vehicleId}/></strong></div>
      <div><em>Fecha y hora</em><strong>{ticket.date}, {ticket.time}</strong></div>
      <div><em>Odómetro inicial</em><strong>{ticket.odometerStartKm == null ? <MissingValue>Sin registrar</MissingValue> : `${number(ticket.odometerStartKm)} km`}</strong></div>
      <div><em>Distancia</em><strong>{ticket.distanceKm == null ? 'Por completar' : `${number(ticket.distanceKm, 1)} km`}</strong></div>
      <div><em>Forma de pago</em><strong>{ticket.payment === 'tarjeta' ? 'Tarjeta' : ticket.payment === 'transferencia' ? 'Transferencia' : ticket.payment === 'efectivo' ? 'Efectivo' : 'Por completar'}</strong></div>
    </div>
    <div className="detail-total"><em>Importe del viaje</em><strong>{ticket.amount == null ? 'Por completar' : money(ticket.amount)}</strong></div>
    {ticket.note && <div className="body-copy note-line">{ticket.note}</div>}
    <div className="modal-actions"><button className="button secondary" onClick={() => { onUpdateTicket(ticket.id, 'revision'); onClose() }}><AlertCircle size={17}/> Marcar revisión</button><button className="button primary" disabled={!canValidate} onClick={() => { onUpdateTicket(ticket.id, 'validado'); onClose() }}><Check size={17}/> Validar</button></div>
  </div></div>
}

function Dashboard({ range, onPage, reports, reportsError, authSession, archiveShifts }) {
  const { vehicles } = useContext(CatalogContext)
  const visibleReports = reports.filter(report => inDateRange(report.shift_date, range))
  const visibleArchive = archiveShifts.filter(row => inDateRange(row.record_date, range))
  const reportSales = visibleReports.reduce((sum, report) => sum + Number(report.reported_sales_uyu || 0), 0)
  const reportKm = visibleReports.reduce((sum, report) => report.odometer_start_km != null && report.odometer_end_km != null ? sum + Math.max(0, Number(report.odometer_end_km) - Number(report.odometer_start_km)) : sum, 0)
  const archiveSales = visibleArchive.reduce((sum, row) => sum + Number(row.sales_uyu || 0), 0)
  const archiveKm = visibleArchive.reduce((sum, row) => row.odometer_start_km != null && row.odometer_end_km != null ? sum + Math.max(0, Number(row.odometer_end_km) - Number(row.odometer_start_km)) : sum, 0)
  const activity = monthlyActivity(visibleArchive, visibleReports, range)
  const shiftsWithAmount = [...visibleArchive.map(row => row.sales_uyu), ...visibleReports.map(report => report.reported_sales_uyu)]
    .filter(value => value != null && value !== '' && Number.isFinite(Number(value))).length
  const fleetStats = {}
  for (const row of visibleArchive) {
    if (!/^\d+$/.test(row.mobile_number || '')) continue
    const item = fleetStats[row.mobile_number] ||= { shifts: 0, sales: 0 }
    item.shifts += 1; item.sales += Number(row.sales_uyu || 0)
  }
  for (const report of visibleReports) {
    if (!/^\d+$/.test(report.mobile_number || '')) continue
    const item = fleetStats[report.mobile_number] ||= { shifts: 0, sales: 0 }
    item.shifts += 1; item.sales += Number(report.reported_sales_uyu || 0)
  }
  const fleetRows = [...vehicles, ...Object.keys(fleetStats).filter(mobile => !vehicles.some(vehicle => vehicle.mobileNumber === mobile)).map(mobileNumber => ({ id: `movil-${mobileNumber}`, mobileNumber }))]
  const revenue = dailyRevenueRange([...visibleArchive.map(row => ({ date: row.record_date, amount: row.sales_uyu })), ...visibleReports.map(report => ({ date: report.shift_date, amount: report.reported_sales_uyu }))], range)
  const recentJornadas = [...visibleArchive.map(row => ({ id: row.id, date: row.record_date, driver: row.driver_name, mobile: row.mobile_number, sales: row.sales_uyu, kind: 'hoja' })), ...visibleReports.map(report => ({ id: report.id, date: report.shift_date, driver: report.driver_name, mobile: report.mobile_number, sales: report.reported_sales_uyu, kind: 'conductor' }))]
    .sort((a, b) => b.date.localeCompare(a.date) || String(b.id).localeCompare(String(a.id))).slice(0, 6)
  if (authSession === undefined) return <div className="report-access-status">Cargando jornadas...</div>
  if (reportsError) return <div className="form-error" role="alert">{reportsError}</div>
  return <div className="dashboard-stack">
    <div className="dashboard-kpis" aria-label="Indicadores del período seleccionado">
      <div className="dashboard-kpi dashboard-kpi-primary"><div>Entradas registradas</div><strong>{money(archiveSales + reportSales)}</strong><small>Importes del período</small></div>
      <div className="dashboard-kpi"><div>Jornadas</div><strong>{number(visibleArchive.length + visibleReports.length)}</strong><small>Registros del período</small></div>
      <div className="dashboard-kpi"><div>Kilómetros recorridos</div><strong>{number(archiveKm + reportKm, 1)} km</strong><small>Distancia registrada</small></div>
      <div className="dashboard-kpi"><div>Entrada media por jornada</div><strong>{shiftsWithAmount ? money((archiveSales + reportSales) / shiftsWithAmount) : '—'}</strong><small>Jornadas con importe registrado</small></div>
    </div>
    <div className="dashboard-grid">
      <Panel title="Recaudación diaria" subtitle="Entradas registradas por día">
      <RevenueChart key={`${range.start}-${range.end}`} series={revenue} showPoints={revenue.length <= 31}/>
      </Panel>
      <Panel title="Estado de la flota" subtitle="Rendimiento por vehículo" action={<button className="text-link" onClick={() => onPage('fleet')}>Ver flota</button>}>
        <div className="table-scroller"><table className="data-table mobile-card-table dashboard-fleet-table"><thead><tr><th>Móvil</th><th>Matrícula</th><th>Jornadas</th><th>Entradas</th><th>Acciones</th></tr></thead><tbody>{fleetRows.map(vehicle => <tr key={vehicle.id}><td data-label="Móvil"><strong>{vehicle.mobileNumber ? `Móvil ${vehicle.mobileNumber}` : 'Sin número'}</strong></td><td data-label="Matrícula">{vehicle.plate || '—'}</td><td data-label="Jornadas">{fleetStats[vehicle.mobileNumber]?.shifts || 0}</td><td data-label="Entradas" className="amount">{money(fleetStats[vehicle.mobileNumber]?.sales || 0)}</td><td data-label="Acciones"><EditAction label={`móvil ${vehicle.mobileNumber || 'sin número'}`} onClick={() => onPage('fleet')}/></td></tr>)}</tbody></table></div>
      </Panel>
    </div>
    <div className="dashboard-grid bottom-grid">
      <Panel title="Últimas jornadas" subtitle="Registros recientes" action={<button className="text-link" onClick={() => onPage('reports')}>Ver planillas</button>}>{recentJornadas.length === 0 ? <Empty title="Sin jornadas" text="Todavía no hay registros en este período."/> : <div className="table-scroller"><table className="data-table mobile-card-table dashboard-recent-table"><thead><tr><th>Fecha</th><th>Origen</th><th>Conductor</th><th>Móvil</th><th>Entradas</th></tr></thead><tbody>{recentJornadas.map(row => <tr key={`${row.kind}-${row.id}`}><td data-label="Fecha">{row.date}</td><td data-label="Origen">{row.kind === 'hoja' ? 'Histórica' : 'Conductor'}</td><td data-label="Conductor">{row.driver || <MissingValue>Sin identificar</MissingValue>}</td><td data-label="Móvil">{row.mobile || 'Sin indicar'}</td><td data-label="Entradas" className="amount">{row.sales == null ? <MissingValue>Sin registrar</MissingValue> : money(Number(row.sales))}</td></tr>)}</tbody></table></div>}</Panel>
      <Panel title="Actividad mensual" subtitle="Últimos seis meses con jornadas del período">
        <MonthlyActivityChart months={activity}/>
      </Panel>
    </div>
  </div>
}

function TicketsPage({ tickets, onInspect }) {
  const { vehicles, drivers } = useContext(CatalogContext)
  const [query,setQuery] = useState('')
  const [status,setStatus] = useState('todos')
  const visible = tickets.filter(t => (status === 'todos' || t.status === status) && (`${t.ticketNumber} ${drivers.find(d=>d.id===t.driverId)?.name} ${mobileNumberForId(t.vehicleId, vehicles)}`).toLowerCase().includes(query.toLowerCase()))
  return <Panel title="Registro de viajes" subtitle="Búsqueda, revisión y trazabilidad de tickets" action={<button className="button secondary compact" onClick={() => downloadCSV('viajes-taxis.csv', ['Ticket','Fecha','Hora','Conductor','Móvil','Odómetro inicial (km)','Importe (UYU)','Km del viaje','Pago','Estado'], visible.map(t=>[t.ticketNumber,t.date,t.time,drivers.find(d=>d.id===t.driverId)?.name,mobileNumberForId(t.vehicleId, vehicles),t.odometerStartKm ?? '',t.amount,t.distanceKm,t.payment,t.status]))}>Exportar CSV</button>}>
    <div className="filter-line"><div className="search-input"><Search size={17}/><input aria-label="Buscar ticket, conductor o móvil" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar por ticket, conductor o móvil..."/></div><select value={status} onChange={e=>setStatus(e.target.value)} aria-label="Filtrar tickets"><option value="todos">Todos los estados</option><option value="validado">Validados</option><option value="revision">A revisar</option><option value="manual">Manuales</option></select></div>
    <TicketTable tickets={visible} onInspect={onInspect}/><div className="body-copy table-foot">{number(visible.length)} tickets mostrados, Fotos guardadas localmente en este navegador.</div>
  </Panel>
}

function ArchiveEdit({ row, onClose, onSave }) {
  const [photoUrl, setPhotoUrl] = useState(null)
  const [form, setForm] = useState({
    record_date: row.record_date || '', mobile_number: row.mobile_number || '',
    driver_name: row.driver_name || '', shift_label: row.shift_label || '',
    sales_uyu: row.sales_uyu ?? '', commission_uyu: row.commission_uyu ?? '',
    fiado_uyu: row.fiado_uyu ?? '', odometer_start_km: row.odometer_start_km ?? '',
    odometer_end_km: row.odometer_end_km ?? '',
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    if (!row.archive_photo_path) return undefined
    let active = true
    let url = null
    downloadShiftPhoto(row.archive_photo_path).then(blob => orientedPhotoBlob(blob, photoRotation(row))).then(blob => {
      if (!active || !blob) return
      url = URL.createObjectURL(blob)
      setPhotoUrl(url)
    }).catch(() => { if (active) setError('No se pudo abrir la foto de la planilla.') })
    return () => { active = false; if (url) URL.revokeObjectURL(url) }
  }, [row.archive_photo_path, row.foto_datos_extraidos, row.extracted_data])
  function field(name, title, type = 'text') {
    return <label key={name}>{title}<input type={type} step={type === 'number' ? 'any' : undefined} value={form[name]} onChange={event => setForm(previous => ({ ...previous, [name]: event.target.value }))}/></label>
  }
  async function submit(event) {
    event.preventDefault()
    setError('')
    const patch = { ...form, driver_name: form.driver_name.trim() || null, mobile_number: form.mobile_number.trim() || null, shift_label: form.shift_label.trim() || null }
    if (!patch.record_date) return setError('Elegí una fecha.')
    if (!/^\d+$/.test(patch.mobile_number || '')) return setError('Ingresá un número de móvil válido.')
    for (const key of ['sales_uyu', 'commission_uyu', 'fiado_uyu', 'odometer_start_km', 'odometer_end_km']) {
      patch[key] = form[key] === '' ? null : Number(form[key])
      if (patch[key] != null && !Number.isFinite(patch[key])) return setError('Revisá los importes y kilómetros.')
    }
    setSaving(true)
    try { await onSave(row.id, patch); onClose() }
    catch (cause) { setError(cause.message || 'No se pudo guardar.') }
    finally { setSaving(false) }
  }
  return <div className="modal-overlay" role="presentation" onMouseDown={onClose}><form className="modal shift-review-modal" role="dialog" aria-modal="true" aria-label="Editar jornada histórica" onMouseDown={event => event.stopPropagation()} onSubmit={submit}>
    <header className="modal-head"><h2>Editar jornada histórica</h2><button type="button" className="icon-only" onClick={onClose} aria-label="Cerrar"><X size={20}/></button></header>
    <div className="body-copy archive-source">{row.source_file_title}, {row.source_tab}, fila {row.source_row}. Conductor original: {row.driver_name_raw || <MissingValue>sin identificar</MissingValue>}.</div>
    {row.archive_photo_path
      ? photoUrl && <a className="text-link archive-source-link" href={photoUrl} target="_blank" rel="noopener noreferrer"><NewTabIcon/> Abrir planilla</a>
      : <a className="text-link archive-source-link" href={`https://docs.google.com/spreadsheets/d/${row.source_file_id}/edit`} target="_blank" rel="noopener noreferrer"><NewTabIcon/> Abrir hoja de origen</a>}
    <div className="shift-review-fields">
      {field('record_date', 'Fecha', 'date')}{field('mobile_number', 'Número del móvil')}
      {field('driver_name', 'Conductor')}{field('shift_label', 'Horario anotado')}
      {field('sales_uyu', 'Entradas (UYU)', 'number')}{field('commission_uyu', 'Comisión (UYU)', 'number')}
      {field('fiado_uyu', 'Fiado (UYU)', 'number')}{field('odometer_start_km', 'Km inicial', 'number')}
      {field('odometer_end_km', 'Km final', 'number')}
    </div>
    {error && <div className="form-error" role="alert">{error}</div>}
    <div className="modal-actions"><button type="button" className="button secondary" onClick={onClose}>Cancelar</button><button type="submit" className="button primary" disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button></div>
  </form></div>
}

function ShiftsPage({ archiveShifts, reports, archiveError, authSession, onEditArchive, onPage, range }) {
  const [filters, setFilters] = useState({})
  const [openFilter, setOpenFilter] = useState(null)
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState(null)
  const [photoSources, setPhotoSources] = useState(null)
  const jornadas = [
    ...archiveShifts.map(row => ({ ...row, source_kind: 'hoja' })),
    ...reports.map(row => ({
      ...row, source_kind: 'conductor', record_date: row.shift_date,
      sales_uyu: row.reported_sales_uyu, commission_uyu: row.reported_commission_uyu,
      shift_label: [row.started_at, row.ended_at].filter(Boolean).map(value => value.slice(11, 16)).join(' a '),
    })),
  ]
  const periodRows = jornadas.filter(row => inDateRange(row.record_date, range)).map(row => ({ row, values: {
    date: row.record_date,
    mobile: row.mobile_number || 'Sin indicar',
    driver: row.driver_name || 'Sin identificar',
    shift: row.shift_label || '—',
    sales: row.sales_uyu == null ? '—' : money(Number(row.sales_uyu)),
    commission: row.commission_uyu == null ? '—' : money(Number(row.commission_uyu)),
    odometerStart: row.odometer_start_km == null ? '—' : number(Number(row.odometer_start_km)),
    odometerEnd: row.odometer_end_km == null ? '—' : number(Number(row.odometer_end_km)),
  } })).sort((a, b) => b.row.record_date.localeCompare(a.row.record_date))
  const options = columnOptions(periodRows, SHIFT_FILTER_COLUMNS)
  const visible = periodRows.filter(item => matchesColumnFilters(item, filters, SHIFT_FILTER_COLUMNS))
  const maxPage = Math.max(0, Math.ceil(visible.length / 40) - 1)
  const currentPage = Math.min(page, maxPage)
  const shown = visible.slice(currentPage * 40, currentPage * 40 + 40)
  return <>
    <Panel title="Jornadas" subtitle={`${visible.length} jornadas en el período seleccionado`}>
      {archiveError && <div className="form-error" role="alert">{archiveError}</div>}
      <>
        {periodRows.length === 0 ? <Empty icon={Clock3} title="Sin jornadas" text="No hay jornadas en este período."/> : <div className="table-scroller"><table className="data-table mobile-card-table filter-card-table shifts-table"><FilteredHeader columns={SHIFT_FILTER_COLUMNS} filters={filters} openFilter={openFilter} setOpenFilter={setOpenFilter} setFilters={setFilters} options={options} onChange={() => setPage(0)}/><tbody>{shown.map(({ row, values }) => {
          const sources = row.source_kind === 'hoja'
            ? row.archive_photo_path ? [{ label: 'Planilla histórica', path: row.archive_photo_path, rotationDegrees: photoRotation(row) }] : []
            : [{ label: 'Planilla de jornada', path: row.sheet_photo_path }, { label: 'Detalle del taxímetro', path: row.meter_photo_path }].filter(source => source.path)
          return <tr key={`${row.source_kind}-${row.id}`}><td data-label="Fecha">{values.date}</td><td data-label="Móvil">{values.mobile}</td><td data-label="Conductor"><strong>{row.driver_name || <MissingValue>Sin identificar</MissingValue>}</strong></td><td data-label="Turno">{values.shift}</td><td data-label="Entradas" className="amount">{values.sales}</td><td data-label="Comisión" className="amount">{values.commission}</td><td data-label="Km inicial">{values.odometerStart}</td><td data-label="Km final">{values.odometerEnd}</td><td data-label="Acciones" className="report-actions">{sources.length > 0 && <button type="button" className="edit-action" onClick={() => setPhotoSources(sources)} aria-label={`Ver fotos de la jornada del ${row.record_date}`} title="Ver fotos"><Eye size={21} strokeWidth={1.8}/></button>}<EditAction label={`jornada del ${row.record_date}`} onClick={() => row.source_kind === 'conductor' ? onPage('reports') : setSelected(row)}/></td></tr>
        })}{visible.length === 0 && <tr><td colSpan={SHIFT_FILTER_COLUMNS.length + 1}>No hay jornadas con estos filtros.</td></tr>}</tbody></table></div>}
        <div className="archive-pagination"><em>{visible.length} jornadas, página {currentPage + 1} de {maxPage + 1}</em><button type="button" className="button secondary compact" disabled={currentPage === 0} onClick={() => setPage(value => value - 1)}>Anterior</button><button type="button" className="button secondary compact" disabled={currentPage >= maxPage} onClick={() => setPage(value => value + 1)}>Siguiente</button></div>
      </>
    </Panel>
    {selected && <ArchiveEdit key={selected.id} row={selected} onClose={() => setSelected(null)} onSave={onEditArchive}/>}
    {photoSources && <PhotoViewer sources={photoSources} onClose={() => setPhotoSources(null)}/>}
  </>
}

function MonthlySummaryDialog({ title, months, emptyMessage, onClose }) {
  useEffect(() => {
    const closeOnEscape = event => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])
  const monthLabel = month => new Date(`${month}-01T12:00:00`).toLocaleDateString('es-UY', { month: 'long', year: 'numeric' })
  return <div className="modal-overlay" role="presentation" onMouseDown={onClose}><div className="modal driver-summary-modal" role="dialog" aria-modal="true" aria-label={`Resumen mensual de ${title}`} onMouseDown={event => event.stopPropagation()}>
    <header className="modal-head"><h2>{title}</h2><button type="button" className="icon-only" onClick={onClose} aria-label="Cerrar" autoFocus><X size={20}/></button></header>
    <h3>Resumen por mes</h3>
    {months.length ? <div className="table-scroller"><table className="data-table"><thead><tr><th>Mes</th><th>Jornadas</th><th>Entradas</th><th>Km recorridos</th></tr></thead><tbody>{months.map(item => <tr key={item.month}>
      <td data-label="Mes"><strong>{monthLabel(item.month)}</strong></td><td data-label="Jornadas">{number(item.jornadas)}</td><td data-label="Entradas">{item.entradasConDato ? money(item.entradas) : 'Sin registrar'}</td><td data-label="Km recorridos">{item.kmConDato ? `${number(item.km, 1)} km` : 'Sin registrar'}</td>
    </tr>)}</tbody></table></div> : <div className="report-empty">{emptyMessage}</div>}
  </div></div>
}

function DriversPage({ historical, roster }) {
  const { vehicles, drivers: catalogDrivers } = useContext(CatalogContext)
  const edit = useContext(EditContext)
  const [filters, setFilters] = useState({})
  const [openFilter, setOpenFilter] = useState(null)
  const [selectedDriver, setSelectedDriver] = useState(null)
  const byDriver = historicalStats(historical)
  const rows = catalogDrivers.map(driver => {
    const result = byDriver[driver.sourceName || driver.name] || { shifts: 0, sales: 0, commission: 0, km: 0 }
    const mobiles = roster.mobilesForDriver(driver.name)
    const stands = [...new Set(mobiles.map(mobile => vehicles.find(vehicle => vehicle.mobileNumber === mobile)?.stand).filter(stand => stand && stand !== 'Sin asignar'))]
    return { driver, filterValues: { mobiles: mobiles.length ? mobiles : ['—'], stand: stands.length ? stands : ['Sin asignar'] }, values: {
      driver: driver.name,
      document: driver.document || '—',
      phone: driver.phone || '—',
      license: driver.license || '—',
      mobiles: mobiles.join(', ') || '—',
      stand: stands.join(', ') || 'Sin asignar',
      status: driver.status || 'Sin confirmar',
      shifts: number(result.shifts),
      km: `${number(result.km, 1)} km`,
      sales: money(result.sales),
      commission: money(result.commission),
    } }
  })
  const options = columnOptions(rows, DRIVER_FILTER_COLUMNS)
  const visible = rows.filter(item => matchesColumnFilters(item, filters, DRIVER_FILTER_COLUMNS))
  return <><section className="directory-page drivers-directory" aria-label="Tabla de conductores">
    <div className="directory-count">{catalogDrivers.length} conductores</div>
    <div className="table-scroller"><table className="data-table"><FilteredHeader columns={DRIVER_FILTER_COLUMNS} filters={filters} openFilter={openFilter} setOpenFilter={setOpenFilter} setFilters={setFilters} options={options}/><tbody>{visible.map(({ driver, values }) => <tr key={driver.id}><td data-label="Conductor"><button type="button" className="driver-name-link" onClick={() => setSelectedDriver(driver)} aria-label={`Ver resumen mensual de ${driver.name}`}>{values.driver}</button></td><td data-label="Documento">{values.document}</td><td data-label="Teléfono">{values.phone}</td><td data-label="Licencia">{values.license}</td><td data-label="Móviles">{values.mobiles}</td><td data-label="Parada">{values.stand}</td><td data-label="Estado"><EntityBadge status={driver.status}/></td><td data-label="Jornadas">{values.shifts}</td><td data-label="Kilómetros">{values.km}</td><td data-label="Entradas" className="amount">{values.sales}</td><td data-label="Comisión" className="amount">{values.commission}</td><td data-label="Acciones"><EditAction label={`conductor ${driver.name}`} onClick={() => edit('drivers', driver)}/></td></tr>)}{visible.length === 0 && <tr><td colSpan={DRIVER_FILTER_COLUMNS.length + 1}>No hay conductores con estos filtros.</td></tr>}</tbody></table></div>
  </section>
  {selectedDriver && <MonthlySummaryDialog title={selectedDriver.name} months={driverMonthlySummary(historical, selectedDriver)} emptyMessage="No hay jornadas de este conductor en el período seleccionado." onClose={() => setSelectedDriver(null)}/>}
  </>
}

function FleetPage({ tickets, historical, reports, roster, authSession }) {
  const { vehicles } = useContext(CatalogContext)
  const edit = useContext(EditContext)
  const [selectedMobile, setSelectedMobile] = useState(null)
  const byVehicle = groupByKey(tickets,'vehicleId')
  const mobileStats = {}
  for (const row of historical) {
    if (!/^\d+$/.test(row.mobile_number || '')) continue
    const item = mobileStats[row.mobile_number] ||= { shifts: 0, amount: 0, km: 0 }
    item.shifts += 1; item.amount += Number(row.sales_uyu || 0)
    if (row.odometer_start_km != null && row.odometer_end_km != null) item.km += Math.max(0, Number(row.odometer_end_km) - Number(row.odometer_start_km))
  }
  for (const report of reports) {
    if (!/^\d+$/.test(report.mobile_number || '')) continue
    const item = mobileStats[report.mobile_number] ||= { shifts: 0, amount: 0, km: 0 }
    item.shifts += 1; item.amount += Number(report.reported_sales_uyu || 0)
    if (report.odometer_start_km != null && report.odometer_end_km != null) item.km += Math.max(0, Number(report.odometer_end_km) - Number(report.odometer_start_km))
  }
  const fleetRows = [...vehicles, ...Object.keys(mobileStats).filter(mobile => !vehicles.some(vehicle => vehicle.mobileNumber === mobile)).map(mobileNumber => ({ id: `movil-${mobileNumber}`, mobileNumber, stand: 'Sin asignar', status: 'Sin confirmar' }))]
  return <><section className="directory-page fleet-directory" aria-label="Tabla de flota">
    <div className="directory-count">{fleetRows.length} móviles</div>
    <div className="table-scroller"><table className="data-table mobile-card-table fleet-table"><thead><tr><th>Móvil</th><th>Matrícula</th><th>Parada</th><th>Marca y modelo</th><th>Año</th><th>Estado</th><th>Conductores vinculados</th><th>Jornadas</th><th>Kilómetros</th><th>Entradas</th><th>Acciones</th></tr></thead><tbody>{fleetRows.map(vehicle => {const archived = mobileStats[vehicle.mobileNumber] || {shifts:0,amount:0,km:0};return <tr key={vehicle.id}><td data-label="Móvil">{vehicle.mobileNumber ? <button type="button" className="driver-name-link" onClick={() => setSelectedMobile(vehicle.mobileNumber)} aria-label={`Ver resumen mensual del móvil ${vehicle.mobileNumber}`}>Móvil {vehicle.mobileNumber}</button> : <strong>Sin número</strong>}</td><td data-label="Matrícula">{vehicle.plate || '—'}</td><td data-label="Parada">{vehicle.stand || 'Sin asignar'}</td><td data-label="Marca y modelo">{[vehicle.brand,vehicle.model].filter(Boolean).join(' ') || '—'}</td><td data-label="Año">{vehicle.year || '—'}</td><td data-label="Estado"><EntityBadge status={vehicle.status}/></td><td data-label="Conductores vinculados">{roster.driversForMobile(vehicle.mobileNumber).join(', ') || '—'}</td><td data-label="Jornadas">{number(archived.shifts)}</td><td data-label="Kilómetros">{number(archived.km,1)} km</td><td data-label="Entradas" className="amount">{money(archived.amount)}</td><td data-label="Acciones"><EditAction label={`móvil ${vehicle.mobileNumber || 'sin número'}`} onClick={() => edit('vehicles', vehicle)}/></td></tr>})}</tbody></table></div>
  </section>
  {selectedMobile && <MonthlySummaryDialog title={`Móvil ${selectedMobile}`} months={mobileMonthlySummary([...historical, ...reports], selectedMobile)} emptyMessage="No hay jornadas de este móvil en el período seleccionado." onClose={() => setSelectedMobile(null)}/>}
  </>
}

function MovementsPage({ data, onAdd, range }) {
  const edit = useContext(EditContext)
  const canEdit = useContext(CanEditContext)
  const { vehicles } = useContext(CatalogContext)
  const [show,setShow] = useState(false)
  const [form,setForm] = useState({date: localDate(),description:'',category:'Combustible',amount:'',kind:'egreso',vehicleId:vehicles[0]?.id || ''})
  function submit(e) {e.preventDefault();if(!form.description.trim() || Number(form.amount)<=0)return;onAdd({...form,description:form.description.trim()});setShow(false);setForm({...form,description:'',amount:''})}
  const visible = data.movements.filter(movement => inDateRange(movement.date, range))
  const sum = visible.reduce((a,m)=>a+(m.kind==='ingreso'?Number(m.amount):-Number(m.amount)),0)
  return <>
    <Panel title="Resumen de movimientos"><div className="table-scroller"><table className="data-table"><thead><tr><th>Movimientos</th><th>Saldo neto</th><th>Acciones</th></tr></thead><tbody><tr><td>{number(visible.length)}</td><td className="amount">{money(sum)}</td><td><EditAction label="movimientos" onClick={()=>document.querySelector('.movement-ledger')?.scrollIntoView({behavior:'smooth'})}/></td></tr></tbody></table></div></Panel>
    <Panel className="movement-ledger" title="Libro de movimientos" subtitle="Gastos y otros movimientos registrados" action={canEdit && <button className="button primary compact" onClick={()=>setShow(true)}><Plus size={16}/> Nuevo movimiento</button>}>
      {visible.length === 0 ? <Empty/> : <div className="table-scroller"><table className="data-table"><thead><tr><th>Detalle</th><th>Categoría</th><th>Fecha</th><th>Móvil</th><th>Importe</th><th>Acciones</th></tr></thead><tbody>{visible.map(m=><tr key={m.id}><td><strong>{m.description}</strong></td><td>{m.category}</td><td>{m.date}</td><td><VehicleLabel id={m.vehicleId}/></td><td className={`amount ${m.kind==='egreso'?'negative':''}`}>{m.kind==='egreso'?'-':'+'} {money(m.amount)}</td><td><EditAction label={`movimiento ${m.description}`} onClick={() => edit('movements', m)}/></td></tr>)}</tbody></table></div>}
    </Panel>
    {show && <div className="modal-overlay" onMouseDown={()=>setShow(false)}><form className="modal modal-small" onMouseDown={e=>e.stopPropagation()} onSubmit={submit}><div className="modal-head"><div><h2>Nuevo movimiento</h2></div><button type="button" className="icon-only" onClick={()=>setShow(false)}><X size={20}/></button></div><div className="field-grid"><label>Tipo<select value={form.kind} onChange={e=>setForm({...form,kind:e.target.value})}><option value="egreso">Egreso</option><option value="ingreso">Ingreso</option></select></label><label>Categoría<select value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>{['Combustible','Mantenimiento','Peaje','Adelanto','Otros'].map(c=><option key={c}>{c}</option>)}</select></label><label>Fecha<input type="date" required value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></label><label>Móvil<select value={form.vehicleId} onChange={e=>setForm({...form,vehicleId:e.target.value})}>{vehicles.filter(vehicle => vehicle.mobileNumber).map(v=><option value={v.id} key={v.id}>{mobileLabel(v)}</option>)}</select></label><label className="field-wide">Descripción<input required placeholder="Ej.: Combustible en estación" value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></label><label className="field-wide">Importe (UYU)<input type="number" inputMode="decimal" min="0.01" step="0.01" required value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})}/></label></div><div className="modal-actions"><button type="button" className="button secondary" onClick={()=>setShow(false)}>Cancelar</button><button type="submit" className="button primary">Guardar movimiento</button></div></form></div>}
  </>
}

function PayrollPage({ tickets, pct, onSettings, onTickets }) {
  const { drivers } = useContext(CatalogContext)
  const byDriver = groupByKey(tickets,'driverId')
  const totals = metrics(tickets,pct)
  return <>
    <Panel title="Resumen de liquidaciones"><div className="table-scroller"><table className="data-table"><thead><tr><th>Recaudación registrada</th><th>Porcentaje</th><th>Total estimado para conductores</th><th>Acciones</th></tr></thead><tbody><tr><td className="amount">{money(totals.gross)}</td><td>{pct}%</td><td className="amount">{money(totals.estimatedCommission)}</td><td><EditAction label="porcentaje" onClick={onSettings}/></td></tr></tbody></table></div></Panel>
    <Panel title="Estimación por conductor" subtitle={`Porcentaje configurable: ${pct}% de recaudación registrada`}>
      <div className="table-scroller"><table className="data-table"><thead><tr><th>Conductor</th><th>Viajes</th><th>Recaudación</th><th>Porcentaje</th><th>Estimado</th><th>Acciones</th></tr></thead><tbody>{drivers.map(d=>{const m=byDriver[d.id]||{trips:0,amount:0};return <tr key={d.id}><td><strong>{d.name}</strong></td><td>{m.trips}</td><td>{money(m.amount)}</td><td>{pct}%</td><td className="amount">{money(m.amount*pct/100)}</td><td><EditAction label={`viajes de ${d.name}`} onClick={onTickets}/></td></tr>})}</tbody></table></div>
    </Panel>
  </>
}

function SettingsPage({ pct, onUpdateSettings }) {
  const [rate,setRate] = useState(String(pct))
  useEffect(()=>setRate(String(pct)),[pct])
  return <form className="settings-rate-form" onSubmit={event => { event.preventDefault(); onUpdateSettings({ commissionPct: Math.min(100, Math.max(0, Number(rate))) }) }}>
    <label htmlFor="commission-rate">Porcentaje de liquidación (%)</label>
    <input id="commission-rate" type="number" min="0" max="100" step="0.5" required value={rate} onChange={event => setRate(event.target.value)}/>
    <button type="submit" className="button primary"><Check size={16}/> Guardar</button>
  </form>
}

export default function Admin({ data, reports = [], reportsError = '', archiveShifts = [], archiveError = '', authSession, onRefreshReports, onEditArchiveShift, onUpdateTicket, onAddMovement, onEditRecord, onAddCatalogRecord, onUpdateSettings }) {
  const [page,setPage] = useState('dashboard')
  const [selectedFromMonth, setSelectedFromMonth] = useState(null)
  const [selectedToMonth, setSelectedToMonth] = useState(null)
  const [selectedTicket,setSelectedTicket] = useState(null)
  const [selectedArchive,setSelectedArchive] = useState(null)
  const [editing,setEditing] = useState(null)
  const [creating,setCreating] = useState(null)
  const [navOpen,setNavOpen] = useState(false)
  useEffect(() => {
    if (!navOpen) return undefined
    const previousOverflow = document.body.style.overflow
    const closeOnEscape = event => { if (event.key === 'Escape') setNavOpen(false) }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', closeOnEscape)
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener('keydown', closeOnEscape) }
  }, [navOpen])
  const catalog = useMemo(() => ({ vehicles: currentVehicles(data), drivers: currentDrivers(data) }), [data.catalog])
  const recordedMonths = recordedMonthBounds([
    ...data.tickets.map(ticket => ticket.date),
    ...data.movements.map(movement => movement.date),
    ...data.shifts.map(shift => shift.startedAt?.slice(0, 10)),
    ...reports.map(report => report.shift_date),
    ...archiveShifts.map(shift => shift.record_date),
  ])
  const fromMonth = selectedFromMonth ?? recordedMonths.first
  const toMonth = selectedToMonth ?? recordedMonths.last
  const range = monthRange(fromMonth, toMonth)
  function changeFromMonth(value) {
    if (!value) return
    setSelectedFromMonth(value)
    if (value > toMonth) setSelectedToMonth(value)
  }
  function changeToMonth(value) {
    if (!value) return
    setSelectedToMonth(value)
    if (value < fromMonth) setSelectedFromMonth(value)
  }
  const tickets = data.tickets.filter(ticket => inDateRange(ticket.date, range))
  const historical = archiveShifts.filter(shift => inDateRange(shift.record_date, range))
  const visibleReports = reports.filter(report => inDateRange(report.shift_date, range))
  const roster = buildMobileRoster(archiveShifts, reports, catalog.drivers)
  const pageConfig = {
    dashboard: ['Centro de operaciones', 'Todo lo que pasa en la flota, en un solo lugar.'],
    reports: ['Planillas de jornada', 'Control de importes y fotografías de jornada.'],
    shifts: ['Control de turnos', 'Historial de jornadas registradas.'],
    drivers: ['Conductores', 'Nombres y cifras registrados en las hojas históricas.'],
    fleet: ['Flota de taxis', 'Seguimiento de vehículos y recaudación.'],
    movements: ['Movimientos', 'Gastos y movimientos de dinero.'],
    calendar: ['Calendario de jornadas', 'Cobertura mensual por móvil.'],
    performance: ['Rendimiento por móvil', 'Comparación mensual de actividad, entradas y kilómetros.'],
  }
  const [title, description] = pageConfig[page]
  const pageAction = page === 'drivers' && authSession?.user
    ? { label: 'Nuevo conductor', onClick: () => setCreating('drivers') }
    : page === 'fleet' && authSession?.user
      ? { label: 'Nuevo taxi', onClick: () => setCreating('vehicles') }
      : page === 'reports'
        ? { label: 'Subir jornada', href: '/conductor' }
        : null
  const showPeriod = page !== 'calendar'
  function goPage(target) {setPage(target);setNavOpen(false);window.scrollTo({top:0,behavior:'smooth'})}
  return <CatalogContext.Provider value={catalog}><CanEditContext.Provider value={Boolean(authSession?.user)}><EditContext.Provider value={(type, item) => setEditing({ type, item })}><div className="admin-shell">
    <aside className={`sidebar ${navOpen?'sidebar-open':''}`}>
      <div className="sidebar-brand"><div className="brand-symbol"><CarFront size={23} strokeWidth={1.8}/></div><strong>Taxi Control</strong></div>
      <nav id="taxi-main-nav" className="sidebar-nav" aria-label="Navegación principal">{NAV.map(({id,label,Icon})=><button key={id} className={`nav-link ${page===id?'active':''}`} onClick={()=>goPage(id)}><Icon size={19} strokeWidth={1.8}/><em>{label}</em></button>)}</nav>
      <a className="sidebar-driver-view" href="/conductor" target="_blank" rel="noopener noreferrer" aria-label="Vista conductor, abre una nueva pestaña">Vista conductor<NewTabIcon/></a>
    </aside>
    {navOpen && <button className="sidebar-scrim" onClick={()=>setNavOpen(false)} aria-label="Cerrar menú"/>}
    <div className="admin-body">
      <header className="mobile-header"><button className="mobile-menu" onClick={()=>setNavOpen(v=>!v)} aria-label={navOpen ? 'Cerrar menú' : 'Abrir menú'} aria-expanded={navOpen} aria-controls="taxi-main-nav"><Menu size={23}/></button><strong>Taxi Control</strong></header>
      <main className="admin-main">
        <SectionTitle title={title} description={description} action={(showPeriod || pageAction) && <div className="title-actions">{showPeriod && <PeriodPicker fromMonth={fromMonth} toMonth={toMonth} onFromMonth={changeFromMonth} onToMonth={changeToMonth}/>} {pageAction && (pageAction.href ? <a className="button primary section-create" href={pageAction.href} target="_blank" rel="noopener noreferrer" aria-label={`${pageAction.label}, abre una nueva pestaña`}><NewTabIcon/> {pageAction.label}</a> : <button className="button primary section-create" onClick={pageAction.onClick}><Plus size={17}/> {pageAction.label}</button>)}</div>} />
        {page === 'dashboard' && <Dashboard range={range} reports={reports} reportsError={reportsError} authSession={authSession} archiveShifts={archiveShifts} onPage={goPage}/>}
        {page === 'reports' && <ShiftReportsPage data={data} range={range} reports={reports} archiveShifts={archiveShifts} authSession={authSession} archiveError={archiveError} reportsError={reportsError} onChanged={onRefreshReports} onInspectArchive={setSelectedArchive}/>}
        {page === 'shifts' && <ShiftsPage archiveShifts={archiveShifts} reports={reports} archiveError={archiveError} authSession={authSession} onEditArchive={onEditArchiveShift} onPage={goPage} range={range}/>}
        {page === 'drivers' && <DriversPage historical={[...historical, ...visibleReports.map(report => ({ record_date: report.shift_date, driver_name: report.driver_name, sales_uyu: report.reported_sales_uyu, commission_uyu: report.reported_commission_uyu, odometer_start_km: report.odometer_start_km, odometer_end_km: report.odometer_end_km }))]} roster={roster}/>}
        {page === 'fleet' && <FleetPage tickets={tickets} historical={historical} reports={visibleReports} roster={roster} authSession={authSession}/>}
        {page === 'movements' && <MovementsPage data={data} onAdd={onAddMovement} range={range}/>}
        {page === 'calendar' && <CalendarPage shifts={archiveShifts} reports={reports} vehicles={catalog.vehicles}/>}
        {page === 'performance' && <PerformancePage shifts={archiveShifts} reports={reports} range={range} authSession={authSession} reportsError={reportsError} onPage={goPage}/>}
      </main>
    </div>
    {selectedTicket && <TicketDetail ticket={selectedTicket} onClose={()=>setSelectedTicket(null)} onUpdateTicket={onUpdateTicket}/>}
    {selectedArchive && <ArchiveEdit key={selectedArchive.id} row={selectedArchive} onClose={()=>setSelectedArchive(null)} onSave={onEditArchiveShift}/>}
    {editing && <EditRecord key={`${editing.type}-${editing.item.id}`} type={editing.type} item={editing.item} data={data} onClose={()=>setEditing(null)} onSave={onEditRecord}/>}
    {creating && <EditRecord key={`new-${creating}`} mode="create" type={creating} item={creating === 'drivers' ? { name:'', document:'', phone:'', license:'', assignedVehicleId:'', status:'Sin confirmar' } : { mobileNumber:'', plate:'', stand:'Sin asignar', brand:'', model:'', year:'', status:'Sin confirmar' }} data={data} onClose={()=>setCreating(null)} onSave={(type, id, patch)=>onAddCatalogRecord(type, patch)}/>}
  </div></EditContext.Provider></CanEditContext.Provider></CatalogContext.Provider>
}
