import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import {
  LayoutDashboard, ReceiptText, UsersRound, CarFront, List, Wallet,
  Settings2, Menu, Plus, Search,
  AlertCircle, X, Image as ImageIcon, Clock3,
  Check, ClipboardList,
} from 'lucide-react'
import { VEHICLES, DRIVERS, currentVehicles, currentDrivers, localDate } from './data/catalog.js'
import { money, number, metrics, filterPeriod, periodStart, groupByKey, reconciliation, dailyRevenue } from './lib/core.js'
import { getPhoto } from './lib/photos.js'
import EditRecord from './EditRecord.jsx'
import EditIcon from './EditIcon.jsx'
import RevenueChart from './RevenueChart.jsx'
import ShiftReportsPage from './ShiftReportsPage.jsx'

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
function EntityBadge({ status }) {
  const label = status || 'Activo'
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
function VehicleLabel({ id }) { const { vehicles } = useContext(CatalogContext); return vehicles.find(v => v.id === id)?.plate || '—' }
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

function Dashboard({ tickets, data, period, onPage, onInspect }) {
  const { vehicles, drivers: catalogDrivers } = useContext(CatalogContext)
  const edit = useContext(EditContext)
  const m = metrics(tickets, data.settings.commissionPct)
  const fleet = groupByKey(tickets, 'vehicleId')
  const drivers = groupByKey(tickets, 'driverId')
  const pending = tickets.filter(t=>t.status === 'revision')
  const movements = data.movements.filter(item => item.date >= periodStart(Number(period)))
  const revenue = dailyRevenue(data.tickets, Number(period))
  return <div className="dashboard-stack">
    <div className="dashboard-kpis" aria-label="Indicadores del período seleccionado">
      <div className="dashboard-kpi dashboard-kpi-primary"><div>Recaudación bruta</div><strong>{money(m.gross)}</strong><small>Importes registrados</small></div>
      <div className="dashboard-kpi"><div>Viajes registrados</div><strong>{number(m.trips)}</strong><small>Tickets del período</small></div>
      <div className="dashboard-kpi"><div>Kilómetros de viajes</div><strong>{number(m.km, 1)} km</strong><small>Distancia registrada</small></div>
      <div className="dashboard-kpi"><div>Para revisar</div><strong>{number(m.pending)}</strong><small>Tickets pendientes</small></div>
    </div>
    <div className="dashboard-grid">
      <Panel title="Recaudación diaria" subtitle="Ingresos brutos registrados por día">
        <RevenueChart series={revenue}/>
      </Panel>
      <Panel title="Estado de la flota" subtitle="Rendimiento por vehículo" action={<button className="text-link" onClick={() => onPage('fleet')}>Ver flota</button>}>
        <div className="table-scroller"><table className="data-table"><thead><tr><th>Matrícula</th><th>Viajes</th><th>Recaudación</th><th>Acciones</th></tr></thead><tbody>{vehicles.map(vehicle => <tr key={vehicle.id}><td><strong>{vehicle.plate}</strong></td><td>{fleet[vehicle.id]?.trips || 0}</td><td className="amount">{money(fleet[vehicle.id]?.amount || 0)}</td><td><EditAction label={`matrícula ${vehicle.plate}`} onClick={() => edit('vehicles', vehicle)}/></td></tr>)}</tbody></table></div>
      </Panel>
    </div>
    <div className="dashboard-grid bottom-grid">
      <Panel title="Últimos tickets" subtitle="Actividad reciente de los conductores" action={<button className="text-link" onClick={() => onPage('tickets')}>Ver todos</button>}><TicketTable tickets={tickets} onInspect={onInspect} compact/></Panel>
      <Panel title="Para revisar" subtitle="Tickets que requieren validación" action={<Badge kind={pending.length ? 'warning' : 'ok'}>{pending.length} pendientes</Badge>}>
        {pending.length === 0 ? <Empty title="Sin pendientes" text="No hay tickets por revisar en este período."/> : <div className="table-scroller"><table className="data-table"><thead><tr><th>Ticket</th><th>Conductor</th><th>Matrícula</th><th>Importe</th><th>Acciones</th></tr></thead><tbody>{pending.slice(0,5).map(ticket => <tr key={ticket.id}><td>{ticket.ticketNumber || 'Sin número'}</td><td><DriverLabel id={ticket.driverId}/></td><td><VehicleLabel id={ticket.vehicleId}/></td><td className="amount">{ticket.amount == null ? 'Por completar' : money(ticket.amount)}</td><td><EditAction label={`ticket ${ticket.ticketNumber || ticket.id}`} onClick={() => edit('tickets', ticket)}/></td></tr>)}</tbody></table></div>}
      </Panel>
    </div>
    <div className="dashboard-grid bottom-grid">
      <Panel title="Movimientos" subtitle="Ingresos y gastos del período" action={<button className="text-link" onClick={() => onPage('movements')}>Ver movimientos</button>}>
        {movements.length === 0 ? <Empty title="Sin movimientos" text="No hay movimientos en este período."/> : <div className="table-scroller"><table className="data-table"><thead><tr><th>Fecha</th><th>Detalle</th><th>Tipo</th><th>Importe</th><th>Acciones</th></tr></thead><tbody>{movements.slice(0,5).map(item => <tr key={item.id}><td>{item.date}</td><td>{item.description}</td><td>{item.kind === 'egreso' ? 'Egreso' : 'Ingreso'}</td><td className="amount">{money(item.amount)}</td><td><EditAction label={`movimiento ${item.description}`} onClick={() => edit('movements', item)}/></td></tr>)}</tbody></table></div>}
      </Panel>
      <Panel title="Conductores" subtitle={`${catalogDrivers.length} conductores`} action={<button className="text-link" onClick={() => onPage('drivers')}>Ver conductores</button>}>
        <div className="table-scroller"><table className="data-table"><thead><tr><th>Conductor</th><th>Matrícula</th><th>Viajes</th><th>Acciones</th></tr></thead><tbody>{catalogDrivers.slice(0,5).map(driver => <tr key={driver.id}><td><strong>{driver.name}</strong></td><td><VehicleLabel id={driver.assignedVehicleId}/></td><td>{drivers[driver.id]?.trips || 0}</td><td><EditAction label={`conductor ${driver.name}`} onClick={() => edit('drivers', driver)}/></td></tr>)}</tbody></table></div>
      </Panel>
    </div>
  </div>
}

function TicketsPage({ tickets, onInspect }) {
  const { vehicles, drivers } = useContext(CatalogContext)
  const [query,setQuery] = useState('')
  const [status,setStatus] = useState('todos')
  const visible = tickets.filter(t => (status === 'todos' || t.status === status) && (`${t.ticketNumber} ${drivers.find(d=>d.id===t.driverId)?.name} ${vehicles.find(v=>v.id===t.vehicleId)?.plate}`).toLowerCase().includes(query.toLowerCase()))
  return <Panel title="Registro de viajes" subtitle="Búsqueda, revisión y trazabilidad de tickets" action={<button className="button secondary compact" onClick={() => downloadCSV('viajes-taxis.csv', ['Ticket','Fecha','Hora','Conductor','Matrícula','Odómetro inicial (km)','Importe (UYU)','Km del viaje','Pago','Estado'], visible.map(t=>[t.ticketNumber,t.date,t.time,drivers.find(d=>d.id===t.driverId)?.name,vehicles.find(v=>v.id===t.vehicleId)?.plate,t.odometerStartKm ?? '',t.amount,t.distanceKm,t.payment,t.status]))}>Exportar CSV</button>}>
    <div className="filter-line"><div className="search-input"><Search size={17}/><input aria-label="Buscar ticket, conductor o móvil" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar por ticket, conductor o móvil..."/></div><select value={status} onChange={e=>setStatus(e.target.value)} aria-label="Filtrar tickets"><option value="todos">Todos los estados</option><option value="validado">Validados</option><option value="revision">A revisar</option><option value="manual">Manuales</option></select></div>
    <TicketTable tickets={visible} onInspect={onInspect}/><div className="body-copy table-foot">{number(visible.length)} tickets mostrados, Fotos guardadas localmente en este navegador.</div>
  </Panel>
}

function ShiftsPage({ data }) {
  const edit = useContext(EditContext)
  return <Panel title="Cierres de turno" subtitle="Comparación del efectivo registrado y el declarado por el conductor">
    {data.shifts.length === 0 ? <Empty icon={Clock3} title="No hay turnos registrados" text="Los turnos anteriores aparecerán acá." /> : <div className="table-scroller"><table className="data-table"><thead><tr><th>Conductor / móvil</th><th>Inicio</th><th>Estado</th><th>Efectivo esperado</th><th>Efectivo declarado</th><th>Diferencia</th><th>Acciones</th></tr></thead><tbody>
      {data.shifts.map(s => { const r = reconciliation(data.tickets,s);return <tr key={s.id}><td><div className="cell-main"><strong><DriverLabel id={s.driverId}/></strong><small><VehicleLabel id={s.vehicleId}/></small></div></td><td>{new Date(s.startedAt).toLocaleString('es-UY',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</td><td><Badge kind={s.status==='abierto'?'warning':'ok'}>{s.status==='abierto'?'En curso':'Cerrado'}</Badge></td><td className="amount">{money(r.expectedCash)}</td><td className="amount">{s.status==='abierto'?'—':money(r.declaredCash)}</td><td className="amount">{s.status==='abierto'?'—':money(r.difference)}</td><td><EditAction label="turno" onClick={() => edit('shifts', s)}/></td></tr> })}
    </tbody></table></div>}
  </Panel>
}

function DriversPage({ tickets, commissionPct }) {
  const { vehicles, drivers: catalogDrivers } = useContext(CatalogContext)
  const edit = useContext(EditContext)
  const byDriver = groupByKey(tickets,'driverId')
  return <section className="directory-page" aria-label="Tabla de conductores">
    <div className="directory-count">{catalogDrivers.length} conductores</div>
    <div className="table-scroller"><table className="data-table"><thead><tr><th>Conductor</th><th>Documento</th><th>Teléfono</th><th>Licencia</th><th>Matrícula</th><th>Parada</th><th>Estado</th><th>Viajes</th><th>Kilómetros</th><th>Recaudación</th><th>Ingreso estimado</th><th>Acciones</th></tr></thead><tbody>{catalogDrivers.map(driver => {const result = byDriver[driver.id] || {trips:0,amount:0,km:0};const vehicle = vehicles.find(item => item.id === driver.assignedVehicleId);return <tr key={driver.id}><td><strong>{driver.name}</strong></td><td>{driver.document || '—'}</td><td>{driver.phone || '—'}</td><td>{driver.license || '—'}</td><td>{vehicle?.plate || '—'}</td><td>{vehicle?.stand || 'Sin asignar'}</td><td><EntityBadge status={driver.status}/></td><td>{number(result.trips)}</td><td>{number(result.km,1)} km</td><td className="amount">{money(result.amount)}</td><td className="amount">{money(result.amount * commissionPct / 100)}</td><td><EditAction label={`conductor ${driver.name}`} onClick={() => edit('drivers', driver)}/></td></tr>})}</tbody></table></div>
  </section>
}

function FleetPage({ tickets }) {
  const { vehicles, drivers } = useContext(CatalogContext)
  const edit = useContext(EditContext)
  const byVehicle = groupByKey(tickets,'vehicleId')
  return <section className="directory-page" aria-label="Tabla de flota">
    <div className="directory-count">{vehicles.length} taxis</div>
    <div className="table-scroller"><table className="data-table"><thead><tr><th>Matrícula</th><th>Parada</th><th>Marca y modelo</th><th>Año</th><th>Estado</th><th>Conductores asignados</th><th>Viajes</th><th>Kilómetros</th><th>Recaudación</th><th>Acciones</th></tr></thead><tbody>{vehicles.map(vehicle => {const result = byVehicle[vehicle.id] || {trips:0,amount:0,km:0};return <tr key={vehicle.id}><td><strong>{vehicle.plate}</strong></td><td>{vehicle.stand}</td><td>{[vehicle.brand,vehicle.model].filter(Boolean).join(' ') || '—'}</td><td>{vehicle.year || '—'}</td><td><EntityBadge status={vehicle.status}/></td><td>{drivers.filter(driver => driver.assignedVehicleId === vehicle.id).map(driver => driver.name).join(', ') || '—'}</td><td>{number(result.trips)}</td><td>{number(result.km,1)} km</td><td className="amount">{money(result.amount)}</td><td><EditAction label={`matrícula ${vehicle.plate}`} onClick={() => edit('vehicles', vehicle)}/></td></tr>})}</tbody></table></div>
  </section>
}

function MovementsPage({ data, onAdd }) {
  const edit = useContext(EditContext)
  const { vehicles } = useContext(CatalogContext)
  const [show,setShow] = useState(false)
  const [form,setForm] = useState({date: localDate(),description:'',category:'Combustible',amount:'',kind:'egreso',vehicleId:'taxi-1'})
  function submit(e) {e.preventDefault();if(!form.description.trim() || Number(form.amount)<=0)return;onAdd({...form,description:form.description.trim()});setShow(false);setForm({...form,description:'',amount:''})}
  const sum = data.movements.reduce((a,m)=>a+(m.kind==='ingreso'?Number(m.amount):-Number(m.amount)),0)
  return <>
    <Panel title="Resumen de movimientos"><div className="table-scroller"><table className="data-table"><thead><tr><th>Movimientos</th><th>Saldo neto</th><th>Acciones</th></tr></thead><tbody><tr><td>{number(data.movements.length)}</td><td className="amount">{money(sum)}</td><td><EditAction label="movimientos" onClick={()=>document.querySelector('.movement-ledger')?.scrollIntoView({behavior:'smooth'})}/></td></tr></tbody></table></div></Panel>
    <Panel className="movement-ledger" title="Libro de movimientos" subtitle="Gastos y otros movimientos registrados" action={<button className="button primary compact" onClick={()=>setShow(true)}><Plus size={16}/> Nuevo movimiento</button>}>
      {data.movements.length === 0 ? <Empty/> : <div className="table-scroller"><table className="data-table"><thead><tr><th>Detalle</th><th>Categoría</th><th>Fecha</th><th>Matrícula</th><th>Importe</th><th>Acciones</th></tr></thead><tbody>{data.movements.map(m=><tr key={m.id}><td><strong>{m.description}</strong></td><td>{m.category}</td><td>{m.date}</td><td><VehicleLabel id={m.vehicleId}/></td><td className={`amount ${m.kind==='egreso'?'negative':''}`}>{m.kind==='egreso'?'-':'+'} {money(m.amount)}</td><td><EditAction label={`movimiento ${m.description}`} onClick={() => edit('movements', m)}/></td></tr>)}</tbody></table></div>}
    </Panel>
    {show && <div className="modal-overlay" onMouseDown={()=>setShow(false)}><form className="modal modal-small" onMouseDown={e=>e.stopPropagation()} onSubmit={submit}><div className="modal-head"><div><h2>Nuevo movimiento</h2></div><button type="button" className="icon-only" onClick={()=>setShow(false)}><X size={20}/></button></div><div className="field-grid"><label>Tipo<select value={form.kind} onChange={e=>setForm({...form,kind:e.target.value})}><option value="egreso">Egreso</option><option value="ingreso">Ingreso</option></select></label><label>Categoría<select value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>{['Combustible','Mantenimiento','Peaje','Adelanto','Otros'].map(c=><option key={c}>{c}</option>)}</select></label><label>Fecha<input type="date" required value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></label><label>Matrícula<select value={form.vehicleId} onChange={e=>setForm({...form,vehicleId:e.target.value})}>{vehicles.map(v=><option value={v.id} key={v.id}>{v.plate}</option>)}</select></label><label className="field-wide">Descripción<input required placeholder="Ej.: Combustible en estación" value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></label><label className="field-wide">Importe (UYU)<input type="number" inputMode="decimal" min="0.01" step="0.01" required value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})}/></label></div><div className="modal-actions"><button type="button" className="button secondary" onClick={()=>setShow(false)}>Cancelar</button><button type="submit" className="button primary">Guardar movimiento</button></div></form></div>}
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

export default function Admin({ data, onUpdateTicket, onAddMovement, onEditRecord, onAddCatalogRecord, onUpdateSettings }) {
  const [page,setPage] = useState('dashboard')
  const [period,setPeriod] = useState('7')
  const [selectedTicket,setSelectedTicket] = useState(null)
  const [editing,setEditing] = useState(null)
  const [creating,setCreating] = useState(null)
  const [navOpen,setNavOpen] = useState(false)
  const tickets = useMemo(()=>filterPeriod(data.tickets,Number(period)),[data.tickets,period])
  const catalog = useMemo(() => ({ vehicles: currentVehicles(data), drivers: currentDrivers(data) }), [data.catalog])
  const pageConfig = {
    dashboard: ['Centro de operaciones', 'Todo lo que pasa en la flota, en un solo lugar.'],
    tickets: ['Viajes y tickets', 'Registro de viajes individuales.'],
    reports: ['Planillas de jornada', 'Revisión de la planilla y el detalle del taxímetro.'],
    shifts: ['Control de turnos', 'Historial de turnos registrados.'],
    drivers: ['Conductores', 'Actividad y rendimiento del equipo.'],
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
  const showPeriod = ['dashboard', 'tickets', 'drivers', 'fleet', 'payroll'].includes(page)
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
        <SectionTitle title={title} description={description} action={(showPeriod || pageAction) && <div className="title-actions">{showPeriod && <select className="period-select" aria-label="Período" value={period} onChange={e=>setPeriod(e.target.value)}><option value="1">Hoy</option><option value="7">Últimos 7 días</option><option value="30">Últimos 30 días</option></select>}{pageAction && (pageAction.href ? <a className="button primary section-create" href={pageAction.href} target="_blank" rel="noopener noreferrer" aria-label={`${pageAction.label}, abre una nueva pestaña`}><NewTabIcon/> {pageAction.label}</a> : <button className="button primary section-create" onClick={pageAction.onClick}><Plus size={17}/> {pageAction.label}</button>)}</div>} />
        {page === 'dashboard' && <Dashboard tickets={tickets} data={data} period={period} onPage={goPage} onInspect={setSelectedTicket}/>}
        {page === 'tickets' && <TicketsPage tickets={tickets} onInspect={setSelectedTicket}/>}
        {page === 'reports' && <ShiftReportsPage data={data}/>}
        {page === 'shifts' && <ShiftsPage data={data}/>}
        {page === 'drivers' && <DriversPage tickets={tickets} commissionPct={data.settings.commissionPct}/>}
        {page === 'fleet' && <FleetPage tickets={tickets}/>}
        {page === 'movements' && <MovementsPage data={data} onAdd={onAddMovement}/>}
        {page === 'payroll' && <PayrollPage tickets={tickets} pct={data.settings.commissionPct} onSettings={()=>goPage('settings')} onTickets={()=>goPage('tickets')}/>}
        {page === 'settings' && <SettingsPage pct={data.settings.commissionPct} onUpdateSettings={onUpdateSettings}/>}
      </main>
    </div>
    {selectedTicket && <TicketDetail ticket={selectedTicket} onClose={()=>setSelectedTicket(null)} onUpdateTicket={onUpdateTicket}/>}
    {editing && <EditRecord key={`${editing.type}-${editing.item.id}`} type={editing.type} item={editing.item} data={data} onClose={()=>setEditing(null)} onSave={onEditRecord}/>}
    {creating && <EditRecord key={`new-${creating}`} mode="create" type={creating} item={creating === 'drivers' ? { name:'', document:'', phone:'', license:'', assignedVehicleId:'', status:'Activo' } : { plate:'', stand:'Sin asignar', brand:'', model:'', year:'', status:'Activo' }} data={data} onClose={()=>setCreating(null)} onSave={(type, id, patch)=>onAddCatalogRecord(type, patch)}/>}
  </div></EditContext.Provider></CatalogContext.Provider>
}
