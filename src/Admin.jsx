import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import {
  LayoutDashboard, ReceiptText, UsersRound, CarFront, List, Wallet,
  Settings2, Menu, Plus, Search,
  AlertCircle, X, Image as ImageIcon, Clock3,
  Check, ClipboardList,
} from 'lucide-react'
import { VEHICLES, DRIVERS, currentVehicles, currentDrivers, localDate } from './data/catalog.js'
import { money, number, metrics, dateRange, inDateRange, dailyRevenueRange, groupByKey, reconciliation } from './lib/core.js'
import { buildMobileRoster, mobileLabel, mobileNumberForId } from './lib/mobileRoster.js'
import { getPhoto } from './lib/photos.js'
import EditRecord from './EditRecord.jsx'
import EditIcon from './EditIcon.jsx'
import RevenueChart from './RevenueChart.jsx'
import ShiftReportsPage from './ShiftReportsPage.jsx'
import { supabase } from './lib/supabase.js'

const CatalogContext = createContext({ vehicles: VEHICLES, drivers: DRIVERS })
const EditContext = createContext(() => {})
function EditAction({ label, onClick }) { return <button type="button" className="edit-action" onClick={onClick} aria-label={`Editar ${label}`} title={`Editar ${label}`}><EditIcon/></button> }
function NewTabIcon() { return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"/><path d="M13 3h8v8"/><path d="m10 14 11-11"/></svg> }

const NAV = [
  { id: 'dashboard', label: 'Inicio', Icon: LayoutDashboard },
  { id: 'tickets', label: 'Viajes y tickets', Icon: ReceiptText },
  { id: 'reports', label: 'Planillas', Icon: ClipboardList },
  { id: 'shifts', label: 'Turnos', Icon: Clock3 },
  { id: 'drivers', label: 'Conductores', Icon: UsersRound },
  { id: 'fleet', label: 'Flota de taxis', Icon: CarFront },
  { id: 'movements', label: 'Movimientos', Icon: List },
  { id: 'payroll', label: 'Liquidaciones', Icon: Wallet },
  { id: 'settings', label: 'Configuración', Icon: Settings2 },
]

const STATUS = {
  validado: ['Validado', 'ok'],
  revision: ['A revisar', 'warning'],
  manual: ['Manual', 'neutral'],
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
function PeriodPicker({ period, month, onPeriod, onMonth }) {
  return <div className="period-picker">
    <select className="period-select" aria-label="Período" value={period} onChange={event => onPeriod(event.target.value)}>
      <option value="1">Hoy</option><option value="7">Últimos 7 días</option><option value="30">Últimos 30 días</option><option value="month">Mes</option><option value="all">Todo</option>
    </select>
    {period === 'month' && <input type="month" aria-label="Seleccionar mes" value={month} max={localDate().slice(0, 7)} onInput={event => onMonth(event.currentTarget.value)} onChange={event => onMonth(event.currentTarget.value)}/>}
  </div>
}
function VehicleLabel({ id }) { const { vehicles } = useContext(CatalogContext); const vehicle = vehicles.find(v => v.id === id); return vehicle ? mobileLabel(vehicle) : 'Sin identificar' }
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
      <div><em>Odómetro inicial</em><strong>{ticket.odometerStartKm == null ? 'Sin registrar' : `${number(ticket.odometerStartKm)} km`}</strong></div>
      <div><em>Distancia</em><strong>{ticket.distanceKm == null ? 'Por completar' : `${number(ticket.distanceKm, 1)} km`}</strong></div>
      <div><em>Forma de pago</em><strong>{ticket.payment === 'tarjeta' ? 'Tarjeta' : ticket.payment === 'transferencia' ? 'Transferencia' : ticket.payment === 'efectivo' ? 'Efectivo' : 'Por completar'}</strong></div>
    </div>
    <div className="detail-total"><em>Importe del viaje</em><strong>{ticket.amount == null ? 'Por completar' : money(ticket.amount)}</strong></div>
    {ticket.note && <div className="body-copy note-line">{ticket.note}</div>}
    <div className="modal-actions"><button className="button secondary" onClick={() => { onUpdateTicket(ticket.id, 'revision'); onClose() }}><AlertCircle size={17}/> Marcar revisión</button><button className="button primary" disabled={!canValidate} onClick={() => { onUpdateTicket(ticket.id, 'validado'); onClose() }}><Check size={17}/> Validar</button></div>
  </div></div>
}

function Dashboard({ tickets, data, range, onPage, onInspect, reports, reportsError, authSession, archiveShifts, roster }) {
  const { vehicles, drivers: catalogDrivers } = useContext(CatalogContext)
  const edit = useContext(EditContext)
  const [email, setEmail] = useState('prueba.taxis@example.com')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loggingIn, setLoggingIn] = useState(false)
  async function signIn(event) {
    event.preventDefault()
    setLoggingIn(true)
    setLoginError('')
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (error) throw error
      setPassword('')
    } catch { setLoginError('No se pudo ingresar. Revisá el correo y la contraseña.') }
    finally { setLoggingIn(false) }
  }
  const m = metrics(tickets, data.settings.commissionPct)
  const visibleReports = reports.filter(report => inDateRange(report.shift_date, range))
  const visibleArchive = archiveShifts.filter(row => inDateRange(row.record_date, range))
  const reportSales = visibleReports.reduce((sum, report) => sum + Number(report.reported_sales_uyu || 0), 0)
  const reportKm = visibleReports.reduce((sum, report) => sum + Math.max(0, Number(report.odometer_end_km || 0) - Number(report.odometer_start_km || 0)), 0)
  const reportPending = visibleReports.filter(report => report.status === 'revision')
  const archivedByDriver = historicalStats(visibleArchive)
  const archiveSales = visibleArchive.reduce((sum, row) => sum + Number(row.sales_uyu || 0), 0)
  const archiveKm = visibleArchive.reduce((sum, row) => row.odometer_start_km != null && row.odometer_end_km != null ? sum + Math.max(0, Number(row.odometer_end_km) - Number(row.odometer_start_km)) : sum, 0)
  const fleet = groupByKey(tickets, 'vehicleId')
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
  const pending = tickets.filter(t=>t.status === 'revision')
  const movements = data.movements.filter(item => inDateRange(item.date, range))
  const revenue = authSession?.user
    ? dailyRevenueRange([...visibleArchive.map(row => ({ date: row.record_date, amount: row.sales_uyu })), ...visibleReports.map(report => ({ date: report.shift_date, amount: report.reported_sales_uyu }))], range)
    : dailyRevenueRange(tickets, range)
  return <div className="dashboard-stack">
    <div className="dashboard-kpis" aria-label="Indicadores del período seleccionado">
      <div className="dashboard-kpi dashboard-kpi-primary"><div>{authSession?.user ? 'Entradas registradas' : 'Recaudación bruta'}</div><strong>{money(authSession?.user ? archiveSales + reportSales : m.gross)}</strong><small>Importes registrados</small></div>
      <div className="dashboard-kpi"><div>{authSession?.user ? 'Jornadas' : 'Viajes registrados'}</div><strong>{number(authSession?.user ? visibleArchive.length + visibleReports.length : m.trips)}</strong><small>{authSession?.user ? 'Registros del período' : 'Tickets del período'}</small></div>
      <div className="dashboard-kpi"><div>{authSession?.user ? 'Kilómetros recorridos' : 'Kilómetros de viajes'}</div><strong>{number(authSession?.user ? archiveKm + reportKm : m.km, 1)} km</strong><small>Distancia registrada</small></div>
      <div className="dashboard-kpi"><div>Para revisar</div><strong>{number(authSession?.user ? reportPending.length : m.pending)}</strong><small>{authSession?.user ? 'Jornadas pendientes' : 'Tickets pendientes'}</small></div>
    </div>
    <Panel title="Jornadas recibidas" subtitle="Cierres enviados desde la vista del conductor" action={authSession?.user && <button className="text-link" onClick={() => onPage('reports')}>Ver planillas</button>}>
      {authSession === undefined ? <div className="report-access-status">Cargando jornadas...</div>
        : !authSession ? <form className="report-access-form" onSubmit={signIn}><div>Ingresá para ver las jornadas guardadas en Supabase.</div><label>Correo<input type="email" value={email} onChange={event => setEmail(event.target.value)} required/></label><label>Contraseña<input type="password" value={password} onChange={event => setPassword(event.target.value)} required/></label><button type="submit" className="button primary" disabled={loggingIn}>{loggingIn ? 'Ingresando...' : 'Ingresar'}</button>{loginError && <div className="form-error" role="alert">{loginError}</div>}</form>
        : reportsError ? <div className="form-error" role="alert">{reportsError}</div>
        : visibleReports.length === 0 ? <Empty title="Sin jornadas en este período" text="Probá con otro período o enviá un cierre desde el celular."/>
        : <div className="table-scroller"><table className="data-table"><thead><tr><th>Fecha</th><th>Conductor</th><th>Móvil</th><th>Venta declarada</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{visibleReports.slice(0, 6).map(report => <tr key={report.id}><td>{report.shift_date}</td><td><strong>{report.driver_name || catalogDrivers.find(driver => driver.id === report.driver_id)?.name || 'Sin identificar'}</strong></td><td>{report.mobile_number || mobileNumberForId(report.vehicle_id, vehicles) || 'Sin indicar'}</td><td className="amount">{report.reported_sales_uyu == null ? 'Sin registrar' : money(Number(report.reported_sales_uyu))}</td><td><Badge kind={report.status === 'validado' ? 'ok' : 'warning'}>{report.status === 'validado' ? 'Validado' : 'A revisar'}</Badge></td><td><EditAction label={`jornada del ${report.shift_date}`} onClick={() => onPage('reports')}/></td></tr>)}</tbody></table></div>}
    </Panel>
    <div className="dashboard-grid">
      <Panel title="Recaudación diaria" subtitle={authSession?.user ? 'Entradas registradas por día' : 'Ingresos brutos registrados por día'}>
        <RevenueChart series={revenue}/>
      </Panel>
      <Panel title="Estado de la flota" subtitle="Rendimiento por vehículo" action={<button className="text-link" onClick={() => onPage('fleet')}>Ver flota</button>}>
        <div className="table-scroller"><table className="data-table"><thead><tr><th>Móvil</th><th>{authSession?.user ? 'Jornadas' : 'Viajes'}</th><th>Entradas</th><th>Acciones</th></tr></thead><tbody>{fleetRows.map(vehicle => <tr key={vehicle.id}><td><strong>{vehicle.mobileNumber || 'Sin número'}</strong></td><td>{authSession?.user ? (fleetStats[vehicle.mobileNumber]?.shifts || 0) : (fleet[vehicle.id]?.trips || 0)}</td><td className="amount">{money(authSession?.user ? (fleetStats[vehicle.mobileNumber]?.sales || 0) : (fleet[vehicle.id]?.amount || 0))}</td><td><EditAction label={`móvil ${vehicle.mobileNumber || 'sin número'}`} onClick={() => onPage('fleet')}/></td></tr>)}</tbody></table></div>
      </Panel>
    </div>
    <div className="dashboard-grid bottom-grid">
      <Panel title="Últimos tickets" subtitle="Actividad reciente de los conductores" action={<button className="text-link" onClick={() => onPage('tickets')}>Ver todos</button>}><TicketTable tickets={tickets} onInspect={onInspect} compact/></Panel>
      <Panel title="Para revisar" subtitle={authSession?.user ? 'Jornadas que requieren validación' : 'Tickets que requieren validación'} action={<Badge kind={(authSession?.user ? reportPending : pending).length ? 'warning' : 'ok'}>{(authSession?.user ? reportPending : pending).length} pendientes</Badge>}>
        {authSession?.user ? reportPending.length === 0 ? <Empty title="Sin pendientes" text="No hay jornadas por revisar en este período."/> : <div className="table-scroller"><table className="data-table"><thead><tr><th>Fecha</th><th>Conductor</th><th>Móvil</th><th>Acciones</th></tr></thead><tbody>{reportPending.slice(0, 5).map(report => <tr key={report.id}><td>{report.shift_date}</td><td>{report.driver_name || catalogDrivers.find(driver => driver.id === report.driver_id)?.name || 'Sin identificar'}</td><td>{report.mobile_number || mobileNumberForId(report.vehicle_id, vehicles) || 'Sin indicar'}</td><td><EditAction label={`jornada del ${report.shift_date}`} onClick={() => onPage('reports')}/></td></tr>)}</tbody></table></div>
          : pending.length === 0 ? <Empty title="Sin pendientes" text="No hay tickets por revisar en este período."/> : <div className="table-scroller"><table className="data-table"><thead><tr><th>Ticket</th><th>Conductor</th><th>Móvil</th><th>Importe</th><th>Acciones</th></tr></thead><tbody>{pending.slice(0,5).map(ticket => <tr key={ticket.id}><td>{ticket.ticketNumber || 'Sin número'}</td><td><DriverLabel id={ticket.driverId}/></td><td><VehicleLabel id={ticket.vehicleId}/></td><td className="amount">{ticket.amount == null ? 'Por completar' : money(ticket.amount)}</td><td><EditAction label={`ticket ${ticket.ticketNumber || ticket.id}`} onClick={() => edit('tickets', ticket)}/></td></tr>)}</tbody></table></div>}
      </Panel>
    </div>
    <div className="dashboard-grid bottom-grid">
      <Panel title="Movimientos" subtitle="Ingresos y gastos del período" action={<button className="text-link" onClick={() => onPage('movements')}>Ver movimientos</button>}>
        {movements.length === 0 ? <Empty title="Sin movimientos" text="No hay movimientos en este período."/> : <div className="table-scroller"><table className="data-table"><thead><tr><th>Fecha</th><th>Detalle</th><th>Tipo</th><th>Importe</th><th>Acciones</th></tr></thead><tbody>{movements.slice(0,5).map(item => <tr key={item.id}><td>{item.date}</td><td>{item.description}</td><td>{item.kind === 'egreso' ? 'Egreso' : 'Ingreso'}</td><td className="amount">{money(item.amount)}</td><td><EditAction label={`movimiento ${item.description}`} onClick={() => edit('movements', item)}/></td></tr>)}</tbody></table></div>}
      </Panel>
      <Panel title="Conductores" subtitle={`${catalogDrivers.length} conductores identificados`} action={<button className="text-link" onClick={() => onPage('drivers')}>Ver conductores</button>}>
        <div className="table-scroller"><table className="data-table"><thead><tr><th>Conductor</th><th>Móviles</th><th>Jornadas</th><th>Acciones</th></tr></thead><tbody>{catalogDrivers.slice(0,5).map(driver => <tr key={driver.id}><td><strong>{driver.name}</strong></td><td>{roster.mobilesForDriver(driver.name).join(', ') || '—'}</td><td>{archivedByDriver[driver.sourceName || driver.name]?.shifts || 0}</td><td><EditAction label={`conductor ${driver.name}`} onClick={() => edit('drivers', driver)}/></td></tr>)}</tbody></table></div>
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
  const [form, setForm] = useState({
    record_date: row.record_date || '', mobile_number: row.mobile_number || '',
    driver_name: row.driver_name || '', shift_label: row.shift_label || '',
    sales_uyu: row.sales_uyu ?? '', commission_uyu: row.commission_uyu ?? '',
    fiado_uyu: row.fiado_uyu ?? '', odometer_start_km: row.odometer_start_km ?? '',
    odometer_end_km: row.odometer_end_km ?? '',
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
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
    <div className="body-copy archive-source">{row.source_file_title}, {row.source_tab}, fila {row.source_row}. Conductor original: {row.driver_name_raw || 'sin identificar'}.</div>
    <a className="text-link archive-source-link" href={`https://docs.google.com/spreadsheets/d/${row.source_file_id}/edit`} target="_blank" rel="noopener noreferrer"><NewTabIcon/> Abrir hoja de origen</a>
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

function ShiftsPage({ data, archiveShifts, archiveError, authSession, onEditArchive, range }) {
  const edit = useContext(EditContext)
  const [mobile, setMobile] = useState('todos')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState(null)
  const visible = archiveShifts.filter(row => inDateRange(row.record_date, range) && (mobile === 'todos' || row.mobile_number === mobile) && (!query || (row.driver_name || row.driver_name_raw || '').toLowerCase().includes(query.toLowerCase())))
  const maxPage = Math.max(0, Math.ceil(visible.length / 40) - 1)
  const currentPage = Math.min(page, maxPage)
  const shown = visible.slice(currentPage * 40, currentPage * 40 + 40)
  const mobiles = [...new Set(archiveShifts.map(row => row.mobile_number).filter(Boolean))].sort((a, b) => Number(a) - Number(b))
  const localShifts = data.shifts.filter(shift => inDateRange(shift.startedAt?.slice(0, 10), range))
  return <>
    <Panel title="Jornadas" subtitle={`${visible.length} jornadas en el período seleccionado`}>
      {archiveError && <div className="form-error" role="alert">{archiveError}</div>}
      {!authSession ? <div className="report-empty">Ingresá desde Inicio para ver el historial.</div> : <>
        <div className="archive-filters"><select aria-label="Móvil" value={mobile} onChange={event => { setMobile(event.target.value); setPage(0) }}><option value="todos">Todos los móviles</option>{mobiles.map(value => <option key={value} value={value}>Móvil {value}</option>)}</select><input aria-label="Buscar conductor" placeholder="Buscar conductor" value={query} onChange={event => { setQuery(event.target.value); setPage(0) }}/></div>
        {visible.length === 0 ? <Empty icon={Clock3} title="Sin jornadas" text="No hay resultados con estos filtros."/> : <div className="table-scroller"><table className="data-table"><thead><tr><th>Fecha</th><th>Móvil</th><th>Conductor</th><th>Turno</th><th>Entradas</th><th>Comisión</th><th>Km inicial</th><th>Km final</th><th>Acciones</th></tr></thead><tbody>{shown.map(row => <tr key={row.id}><td>{row.record_date}</td><td>{row.mobile_number}</td><td><strong>{row.driver_name || 'Sin identificar'}</strong></td><td>{row.shift_label || '—'}</td><td className="amount">{row.sales_uyu == null ? '—' : money(Number(row.sales_uyu))}</td><td className="amount">{row.commission_uyu == null ? '—' : money(Number(row.commission_uyu))}</td><td>{row.odometer_start_km == null ? '—' : number(Number(row.odometer_start_km))}</td><td>{row.odometer_end_km == null ? '—' : number(Number(row.odometer_end_km))}</td><td><EditAction label={`jornada histórica del ${row.record_date}`} onClick={() => setSelected(row)}/></td></tr>)}</tbody></table></div>}
        <div className="archive-pagination"><em>{visible.length} jornadas, página {currentPage + 1} de {maxPage + 1}</em><button type="button" className="button secondary compact" disabled={currentPage === 0} onClick={() => setPage(value => value - 1)}>Anterior</button><button type="button" className="button secondary compact" disabled={currentPage >= maxPage} onClick={() => setPage(value => value + 1)}>Siguiente</button></div>
      </>}
    </Panel>
    {localShifts.length > 0 && <Panel title="Turnos registrados en este navegador"><div className="table-scroller"><table className="data-table"><thead><tr><th>Conductor / móvil</th><th>Inicio</th><th>Estado</th><th>Efectivo esperado</th><th>Efectivo declarado</th><th>Diferencia</th><th>Acciones</th></tr></thead><tbody>{localShifts.map(s => { const r = reconciliation(data.tickets,s);return <tr key={s.id}><td><div className="cell-main"><strong><DriverLabel id={s.driverId}/></strong><small><VehicleLabel id={s.vehicleId}/></small></div></td><td>{new Date(s.startedAt).toLocaleString('es-UY',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</td><td><Badge kind={s.status==='abierto'?'warning':'ok'}>{s.status==='abierto'?'En curso':'Cerrado'}</Badge></td><td className="amount">{money(r.expectedCash)}</td><td className="amount">{s.status==='abierto'?'—':money(r.declaredCash)}</td><td className="amount">{s.status==='abierto'?'—':money(r.difference)}</td><td><EditAction label="turno" onClick={() => edit('shifts', s)}/></td></tr> })}</tbody></table></div></Panel>}
    {selected && <ArchiveEdit key={selected.id} row={selected} onClose={() => setSelected(null)} onSave={onEditArchive}/>}
  </>
}

function DriversPage({ historical, roster }) {
  const { vehicles, drivers: catalogDrivers } = useContext(CatalogContext)
  const edit = useContext(EditContext)
  const byDriver = historicalStats(historical)
  return <section className="directory-page" aria-label="Tabla de conductores">
    <div className="directory-count">{catalogDrivers.length} conductores</div>
    <div className="table-scroller"><table className="data-table"><thead><tr><th>Conductor</th><th>Documento</th><th>Teléfono</th><th>Licencia</th><th>Móviles</th><th>Parada</th><th>Estado</th><th>Jornadas</th><th>Kilómetros</th><th>Entradas</th><th>Comisión</th><th>Acciones</th></tr></thead><tbody>{catalogDrivers.map(driver => {const result = byDriver[driver.sourceName || driver.name] || {shifts:0,sales:0,commission:0,km:0};const mobiles = roster.mobilesForDriver(driver.name);const stands = [...new Set(mobiles.map(mobile => vehicles.find(vehicle => vehicle.mobileNumber === mobile)?.stand).filter(stand => stand && stand !== 'Sin asignar'))];return <tr key={driver.id}><td><strong>{driver.name}</strong></td><td>{driver.document || '—'}</td><td>{driver.phone || '—'}</td><td>{driver.license || '—'}</td><td>{mobiles.join(', ') || '—'}</td><td>{stands.join(', ') || 'Sin asignar'}</td><td><EntityBadge status={driver.status}/></td><td>{number(result.shifts)}</td><td>{number(result.km,1)} km</td><td className="amount">{money(result.sales)}</td><td className="amount">{money(result.commission)}</td><td><EditAction label={`conductor ${driver.name}`} onClick={() => edit('drivers', driver)}/></td></tr>})}</tbody></table></div>
  </section>
}

function FleetPage({ tickets, historical, reports, roster, authSession }) {
  const { vehicles } = useContext(CatalogContext)
  const edit = useContext(EditContext)
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
  return <section className="directory-page" aria-label="Tabla de flota">
    <div className="directory-count">{fleetRows.length} móviles</div>
    <div className="table-scroller"><table className="data-table"><thead><tr><th>Móvil</th><th>Parada</th><th>Marca y modelo</th><th>Año</th><th>Estado</th><th>Conductores vinculados</th><th>Jornadas</th><th>Kilómetros</th><th>Entradas</th><th>Acciones</th></tr></thead><tbody>{fleetRows.map(vehicle => {const local = byVehicle[vehicle.id] || {trips:0,amount:0,km:0};const archived = mobileStats[vehicle.mobileNumber] || {shifts:0,amount:0,km:0};return <tr key={vehicle.id}><td><strong>{vehicle.mobileNumber || 'Sin número'}</strong></td><td>{vehicle.stand || 'Sin asignar'}</td><td>{[vehicle.brand,vehicle.model].filter(Boolean).join(' ') || '—'}</td><td>{vehicle.year || '—'}</td><td><EntityBadge status={vehicle.status}/></td><td>{roster.driversForMobile(vehicle.mobileNumber).join(', ') || '—'}</td><td>{number(authSession?.user ? archived.shifts : local.trips)}</td><td>{number(authSession?.user ? archived.km : local.km,1)} km</td><td className="amount">{money(authSession?.user ? archived.amount : local.amount)}</td><td><EditAction label={`móvil ${vehicle.mobileNumber || 'sin número'}`} onClick={() => edit('vehicles', vehicle)}/></td></tr>})}</tbody></table></div>
  </section>
}

function MovementsPage({ data, onAdd, range }) {
  const edit = useContext(EditContext)
  const { vehicles } = useContext(CatalogContext)
  const [show,setShow] = useState(false)
  const [form,setForm] = useState({date: localDate(),description:'',category:'Combustible',amount:'',kind:'egreso',vehicleId:vehicles[0]?.id || ''})
  function submit(e) {e.preventDefault();if(!form.description.trim() || Number(form.amount)<=0)return;onAdd({...form,description:form.description.trim()});setShow(false);setForm({...form,description:'',amount:''})}
  const visible = data.movements.filter(movement => inDateRange(movement.date, range))
  const sum = visible.reduce((a,m)=>a+(m.kind==='ingreso'?Number(m.amount):-Number(m.amount)),0)
  return <>
    <Panel title="Resumen de movimientos"><div className="table-scroller"><table className="data-table"><thead><tr><th>Movimientos</th><th>Saldo neto</th><th>Acciones</th></tr></thead><tbody><tr><td>{number(visible.length)}</td><td className="amount">{money(sum)}</td><td><EditAction label="movimientos" onClick={()=>document.querySelector('.movement-ledger')?.scrollIntoView({behavior:'smooth'})}/></td></tr></tbody></table></div></Panel>
    <Panel className="movement-ledger" title="Libro de movimientos" subtitle="Gastos y otros movimientos registrados" action={<button className="button primary compact" onClick={()=>setShow(true)}><Plus size={16}/> Nuevo movimiento</button>}>
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
  const [period,setPeriod] = useState('all')
  const [month,setMonth] = useState(localDate().slice(0, 7))
  const [selectedTicket,setSelectedTicket] = useState(null)
  const [editing,setEditing] = useState(null)
  const [creating,setCreating] = useState(null)
  const [navOpen,setNavOpen] = useState(false)
  const catalog = useMemo(() => ({ vehicles: currentVehicles(data), drivers: currentDrivers(data) }), [data.catalog])
  const range = dateRange(period, month, [
    ...data.tickets.map(ticket => ticket.date),
    ...data.movements.map(movement => movement.date),
    ...data.shifts.map(shift => shift.startedAt?.slice(0, 10)),
    ...reports.map(report => report.shift_date),
    ...archiveShifts.map(shift => shift.record_date),
  ])
  const tickets = data.tickets.filter(ticket => inDateRange(ticket.date, range))
  const historical = archiveShifts.filter(shift => inDateRange(shift.record_date, range))
  const visibleReports = reports.filter(report => inDateRange(report.shift_date, range))
  const roster = buildMobileRoster(archiveShifts, reports, catalog.drivers)
  const pageConfig = {
    dashboard: ['Centro de operaciones', 'Todo lo que pasa en la flota, en un solo lugar.'],
    tickets: ['Viajes y tickets', 'Registro de viajes individuales.'],
    reports: ['Planillas de jornada', 'Revisión de la planilla y el detalle del taxímetro.'],
    shifts: ['Control de turnos', 'Historial de jornadas registradas.'],
    drivers: ['Conductores', 'Nombres y cifras registrados en las hojas históricas.'],
    fleet: ['Flota de taxis', 'Seguimiento de vehículos y recaudación.'],
    movements: ['Movimientos', 'Gastos y movimientos de dinero.'],
    payroll: ['Liquidaciones', 'Estimaciones por conductor según el período.'],
    settings: ['Configuración', 'Porcentaje de liquidación.'],
  }
  const [title, description] = pageConfig[page]
  const pageAction = page === 'drivers'
    ? { label: 'Nuevo conductor', onClick: () => setCreating('drivers') }
    : page === 'fleet'
      ? { label: 'Nuevo taxi', onClick: () => setCreating('vehicles') }
      : page === 'reports'
        ? { label: 'Subir jornada', href: '/conductor' }
        : null
  const showPeriod = page !== 'settings'
  function goPage(target) {setPage(target);setNavOpen(false);window.scrollTo({top:0,behavior:'smooth'})}
  return <CatalogContext.Provider value={catalog}><EditContext.Provider value={(type, item) => setEditing({ type, item })}><div className="admin-shell">
    <aside className={`sidebar ${navOpen?'sidebar-open':''}`}>
      <div className="sidebar-brand"><div className="brand-symbol"><CarFront size={23} strokeWidth={1.8}/></div><strong>Taxi Control</strong></div>
      <nav className="sidebar-nav" aria-label="Navegación principal">{NAV.map(({id,label,Icon})=><button key={id} className={`nav-link ${page===id?'active':''}`} onClick={()=>goPage(id)}><Icon size={19} strokeWidth={1.8}/><em>{label}</em>{id==='tickets'&&data.tickets.filter(t=>t.status==='revision').length>0&&<em className="nav-dot"/>}</button>)}</nav>
      <a className="sidebar-driver-view" href="/conductor" target="_blank" rel="noopener noreferrer" aria-label="Vista conductor, abre una nueva pestaña">Vista conductor<NewTabIcon/></a>
    </aside>
    {navOpen && <button className="sidebar-scrim" onClick={()=>setNavOpen(false)} aria-label="Cerrar menú"/>}
    <div className="admin-body">
      <header className="mobile-header"><button className="mobile-menu" onClick={()=>setNavOpen(v=>!v)} aria-label="Abrir menú"><Menu size={23}/></button><strong>Taxi Control</strong></header>
      <main className="admin-main">
        <SectionTitle title={title} description={description} action={(showPeriod || pageAction) && <div className="title-actions">{showPeriod && <PeriodPicker period={period} month={month} onPeriod={setPeriod} onMonth={setMonth}/>} {pageAction && (pageAction.href ? <a className="button primary section-create" href={pageAction.href} target="_blank" rel="noopener noreferrer" aria-label={`${pageAction.label}, abre una nueva pestaña`}><NewTabIcon/> {pageAction.label}</a> : <button className="button primary section-create" onClick={pageAction.onClick}><Plus size={17}/> {pageAction.label}</button>)}</div>} />
        {page === 'dashboard' && <Dashboard tickets={tickets} data={data} range={range} reports={reports} reportsError={reportsError} authSession={authSession} archiveShifts={archiveShifts} roster={roster} onPage={goPage} onInspect={setSelectedTicket}/>}
        {page === 'tickets' && <TicketsPage tickets={tickets} onInspect={setSelectedTicket}/>}
        {page === 'reports' && <ShiftReportsPage data={data} range={range} onChanged={onRefreshReports}/>}
        {page === 'shifts' && <ShiftsPage data={data} archiveShifts={archiveShifts} archiveError={archiveError} authSession={authSession} onEditArchive={onEditArchiveShift} range={range}/>}
        {page === 'drivers' && <DriversPage historical={historical} roster={roster}/>}
        {page === 'fleet' && <FleetPage tickets={tickets} historical={historical} reports={visibleReports} roster={roster} authSession={authSession}/>}
        {page === 'movements' && <MovementsPage data={data} onAdd={onAddMovement} range={range}/>}
        {page === 'payroll' && <PayrollPage tickets={tickets} pct={data.settings.commissionPct} onSettings={()=>goPage('settings')} onTickets={()=>goPage('tickets')}/>}
        {page === 'settings' && <SettingsPage pct={data.settings.commissionPct} onUpdateSettings={onUpdateSettings}/>}
      </main>
    </div>
    {selectedTicket && <TicketDetail ticket={selectedTicket} onClose={()=>setSelectedTicket(null)} onUpdateTicket={onUpdateTicket}/>}
    {editing && <EditRecord key={`${editing.type}-${editing.item.id}`} type={editing.type} item={editing.item} data={data} onClose={()=>setEditing(null)} onSave={onEditRecord}/>}
    {creating && <EditRecord key={`new-${creating}`} mode="create" type={creating} item={creating === 'drivers' ? { name:'', document:'', phone:'', license:'', assignedVehicleId:'', status:'Sin confirmar' } : { mobileNumber:'', stand:'Sin asignar', brand:'', model:'', year:'', status:'Sin confirmar' }} data={data} onClose={()=>setCreating(null)} onSave={(type, id, patch)=>onAddCatalogRecord(type, patch)}/>}
  </div></EditContext.Provider></CatalogContext.Provider>
}
