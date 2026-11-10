import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { currentDrivers, currentVehicles } from './data/catalog.js'
import { getPhoto } from './lib/photos.js'

export default function EditRecord({ type, item, data, onClose, onSave, mode = 'edit' }) {
  const [form, setForm] = useState(item)
  const [error, setError] = useState('')
  const [photoUrl, setPhotoUrl] = useState(null)
  const vehicles = currentVehicles(data)
  const drivers = currentDrivers(data)
  const label = { tickets: 'ticket', shifts: 'turno', movements: 'movimiento', drivers: 'conductor', vehicles: 'taxi' }[type]
  const creating = mode === 'create'
  useEffect(() => {
    if (type !== 'tickets' || !item.hasPhoto) return undefined
    let url
    let active = true
    getPhoto(item.id, item.photoPath).then(photo => {
      if (!active || !photo) return
      url = URL.createObjectURL(photo)
      setPhotoUrl(url)
    }).catch(() => {})
    return () => { active = false; if (url) URL.revokeObjectURL(url) }
  }, [type, item.id, item.hasPhoto])
  function field(name, title, inputType = 'text', options = null, required = true) {
    return <label key={name}>{title}{options
      ? <select value={form[name] ?? ''} onChange={event => setForm({ ...form, [name]: event.target.value })}>{options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
      : <input required={required && name !== 'ticketNumber'} type={inputType} min={inputType === 'number' ? 0 : undefined} step={inputType === 'number' ? 'any' : undefined} value={form[name] ?? ''} onChange={event => setForm({ ...form, [name]: event.target.value })}/>}</label>
  }
  const vehicleOptions = vehicles.map(vehicle => ({ value: vehicle.id, label: vehicle.plate }))
  const driverOptions = drivers.map(driver => ({ value: driver.id, label: driver.name }))
  let fields = []
  if (type === 'vehicles') fields = [field('plate', 'Matrícula'), field('stand', 'Parada'), field('brand', 'Marca', 'text', null, false), field('model', 'Modelo', 'text', null, false), field('year', 'Año', 'number', null, false), field('status', 'Estado', 'text', [{ value: 'Activo', label: 'Activo' }, { value: 'Mantenimiento', label: 'Mantenimiento' }, { value: 'Inactivo', label: 'Inactivo' }])]
  if (type === 'drivers') fields = [field('name', 'Nombre'), field('document', 'Documento', 'text', null, false), field('phone', 'Teléfono', 'tel', null, false), field('license', 'Licencia', 'text', null, false), field('assignedVehicleId', 'Matrícula', 'text', [{ value: '', label: 'Sin asignar' }, ...vehicleOptions]), field('status', 'Estado', 'text', [{ value: 'Sin confirmar', label: 'Sin confirmar' }, { value: 'Activo', label: 'Activo' }, { value: 'Inactivo', label: 'Inactivo' }])]
  if (type === 'tickets') fields = [field('ticketNumber', 'Número de ticket'), field('driverId', 'Conductor', 'text', driverOptions), field('vehicleId', 'Matrícula', 'text', vehicleOptions), field('date', 'Fecha', 'date'), field('time', 'Hora', 'time'), field('odometerStartKm', 'Odómetro inicial (km)', 'number', null, false), field('amount', 'Importe', 'number', null, false), field('distanceKm', 'Kilómetros', 'number', null, false), field('payment', 'Pago', 'text', [{value:'',label:'Sin confirmar'}, ...['efectivo','tarjeta','transferencia'].map(value => ({value,label:value}))]), field('status', 'Estado', 'text', [{value:'revision',label:'Por revisar'},{value:'validado',label:'Validado'}]), field('note', 'Observaciones', 'text', null, false)]
  if (type === 'shifts') fields = [field('driverId', 'Conductor', 'text', driverOptions), field('vehicleId', 'Matrícula', 'text', vehicleOptions), field('kmStart', 'Odómetro inicial', 'number'), ...(item.status === 'cerrado' ? [field('kmEnd', 'Odómetro final', 'number'), field('cashDeclared', 'Efectivo declarado', 'number')] : [])]
  if (type === 'movements') fields = [field('date', 'Fecha', 'date'), field('description', 'Detalle'), field('category', 'Categoría'), field('kind', 'Tipo', 'text', [{value:'ingreso',label:'Ingreso'},{value:'egreso',label:'Egreso'}]), field('vehicleId', 'Matrícula', 'text', vehicleOptions), field('amount', 'Importe', 'number')]
  function submit(event) {
    event.preventDefault()
    setError('')
    const patch = { ...form }
    if (type === 'drivers' || type === 'vehicles') {
      for (const key of ['name', 'plate', 'stand', 'brand', 'model', 'document', 'phone', 'license']) if (typeof patch[key] === 'string') patch[key] = patch[key].trim()
    }
    for (const key of ['amount','distanceKm','odometerStartKm','kmStart','kmEnd','cashDeclared']) if (key in patch) patch[key] = patch[key] == null || patch[key] === '' ? null : Number(patch[key])
    if (type === 'shifts' && patch.kmEnd !== undefined && patch.kmEnd < patch.kmStart) return setError('El odómetro final debe ser igual o mayor al inicial.')
    if (type === 'shifts' && item.status === 'abierto' && data.shifts.some(shift => shift.id !== item.id && shift.status === 'abierto' && (shift.driverId === patch.driverId || shift.vehicleId === patch.vehicleId))) return setError('Ese conductor o taxi ya tiene un turno abierto.')
    if (type === 'vehicles' && vehicles.some(vehicle => vehicle.id !== item.id && vehicle.plate.toUpperCase() === patch.plate.trim().toUpperCase())) return setError('Ya existe esa matrícula.')
    if (type === 'tickets' && data.tickets.some(ticket => ticket.id !== item.id && ticket.ticketNumber && ticket.ticketNumber === patch.ticketNumber && ticket.vehicleId === patch.vehicleId && ticket.date === patch.date)) return setError('Ya existe un ticket con ese número, fecha y matrícula.')
    if (type === 'tickets' && patch.status === 'validado' && (patch.amount == null || patch.amount <= 0 || patch.distanceKm == null || patch.distanceKm < 0 || !patch.payment)) return setError('Completá importe, kilómetros y medio de pago antes de validar.')
    onSave(type, item.id, patch)
    onClose()
  }
  return <div className="modal-overlay" role="presentation" onMouseDown={onClose}><form className="modal edit-record-modal" role="dialog" aria-modal="true" aria-label={`${creating ? 'Nuevo' : 'Editar'} ${label}`} onMouseDown={event=>event.stopPropagation()} onSubmit={submit}>
    <div className="modal-head"><h2>{creating ? 'Nuevo' : 'Editar'} {label}</h2><button type="button" className="icon-only" onClick={onClose} aria-label="Cerrar"><X size={20}/></button></div>
    {photoUrl && <img src={photoUrl} alt="Foto del ticket para revisar" className="ticket-photo"/>}
    <div className="field-grid">{fields}</div>
    {error && <div className="form-error" role="alert">{error}</div>}
    <div className="modal-actions"><button type="button" className="button secondary" onClick={onClose}>Cancelar</button><button type="submit" className="button primary">{creating ? `Guardar ${label}` : 'Guardar cambios'}</button></div>
  </form></div>
}
