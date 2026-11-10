import { useEffect, useRef, useState } from 'react'
import { Camera, CalendarDays, Check, Image as ImageIcon, CarFront, X } from 'lucide-react'

function localDateTime(date = new Date()) {
  const pad = value => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}
function readableDateTime(value) {
  return value ? new Date(`${value}:00`).toLocaleString('es-UY', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) : 'Elegí fecha y hora'
}

const emptyAmounts = { sales: '', commission: '', jornalPos: '', fiado: '', totalToPay: '', expenses: '0' }

function PhotoPicker({ title, file, onChange }) {
  const camera = useRef(null)
  const gallery = useRef(null)
  const [preview, setPreview] = useState(null)
  useEffect(() => {
    if (!file) { setPreview(null); return undefined }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])
  return <div className="shift-photo-picker">
    <strong>{title}</strong>
    <div className={`upload-zone ${file ? 'upload-zone-full' : ''}`}>
      {preview ? <><img src={preview} alt={`${title} seleccionada`} className="upload-preview"/><button type="button" className="photo-remove" onClick={() => onChange(null)} aria-label={`Quitar ${title.toLowerCase()}`}><X size={16}/> Quitar foto</button></>
        : <><Camera size={27} strokeWidth={1.7}/><em>Foto completa y legible</em></>}
      <div className="upload-actions"><button type="button" className="button primary" onClick={() => camera.current?.click()}><Camera size={17}/> Cámara</button><button type="button" className="button secondary" onClick={() => gallery.current?.click()}><ImageIcon size={17}/> Galería</button></div>
    </div>
    <input ref={camera} type="file" accept="image/*" capture="environment" className="visually-hidden" aria-label={`Sacar foto de ${title.toLowerCase()}`} onChange={event => { onChange(event.target.files?.[0] || null); event.target.value = '' }}/>
    <input ref={gallery} type="file" accept="image/*" className="visually-hidden" aria-label={`Elegir foto de ${title.toLowerCase()}`} onChange={event => { onChange(event.target.files?.[0] || null); event.target.value = '' }}/>
  </div>
}

export default function Driver({ onAddShiftReport }) {
  const [driverName, setDriverName] = useState(() => localStorage.getItem('taxi-control-driver-name') || '')
  const [mobileNumber, setMobileNumber] = useState(() => localStorage.getItem('taxi-control-mobile-number') || '')
  const [startedAt, setStartedAt] = useState('')
  const [endedAt, setEndedAt] = useState(() => localDateTime())
  const [odometerStartKm, setOdometerStartKm] = useState('')
  const [odometerEndKm, setOdometerEndKm] = useState('')
  const [amounts, setAmounts] = useState(emptyAmounts)
  const [jornalPosKind, setJornalPosKind] = useState('jornal')
  const [expenseNote, setExpenseNote] = useState('')
  const [sheet, setSheet] = useState(null)
  const [meter, setMeter] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [saving, setSaving] = useState(false)

  function setAmount(name, value) { setAmounts(previous => ({ ...previous, [name]: value })) }

  function choosePhoto(kind, selected) {
    if (selected && (!selected.type.startsWith('image/') || selected.size > 15 * 1024 * 1024)) {
      setError('Elegí una imagen de hasta 15 MB.')
      return
    }
    if (kind === 'sheet') setSheet(selected)
    else setMeter(selected)
    setError('')
    setSuccess(false)
  }

  async function submit(event) {
    event.preventDefault()
    setError('')
    setSuccess(false)
    if (!driverName.trim()) return setError('Escribí el nombre del conductor.')
    if (!/^\d{1,6}$/.test(mobileNumber.trim())) return setError('Ingresá el número del móvil.')
    const start = new Date(startedAt)
    const end = new Date(endedAt)
    if (!startedAt || !endedAt || !Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) return setError('Revisá el inicio y el fin del turno.')
    if (end.getTime() > Date.now() + 5 * 60 * 1000) return setError('El fin del turno no puede ser una fecha futura.')
    if (odometerStartKm === '' || odometerEndKm === '' || !Number.isFinite(Number(odometerStartKm)) || !Number.isFinite(Number(odometerEndKm)) || Number(odometerStartKm) < 0 || Number(odometerEndKm) < Number(odometerStartKm)) return setError('Revisá los kilómetros iniciales y finales.')
    if (Object.values(amounts).some(value => value === '' || !Number.isFinite(Number(value)) || Number(value) < 0)) return setError('Completá los importes con valores válidos. Si no hubo gastos, poné 0.')
    if (!sheet && !meter) return setError('Adjuntá la planilla, el detalle del taxímetro o ambos.')
    setSaving(true)
    try {
      await onAddShiftReport({
        driverName: driverName.trim(), mobileNumber: mobileNumber.trim(),
        date: startedAt.slice(0, 10), startedAt: start.toISOString(), endedAt: end.toISOString(),
        odometerStartKm: Number(odometerStartKm), odometerEndKm: Number(odometerEndKm),
        sales: Number(amounts.sales), commission: Number(amounts.commission),
        jornalPosKind, jornalPos: Number(amounts.jornalPos), fiado: Number(amounts.fiado),
        totalToPay: Number(amounts.totalToPay), expenses: Number(amounts.expenses),
        expenseNote: expenseNote.trim(),
      }, { sheet, meter })
      try {
        localStorage.setItem('taxi-control-driver-name', driverName.trim())
        localStorage.setItem('taxi-control-mobile-number', mobileNumber.trim())
      } catch { /* El envío ya quedó registrado. */ }
      setSheet(null)
      setMeter(null)
      setStartedAt('')
      setEndedAt(localDateTime())
      setOdometerStartKm('')
      setOdometerEndKm('')
      setAmounts(emptyAmounts)
      setExpenseNote('')
      setSuccess(true)
    } catch (cause) {
      setError(cause.message || 'No se pudieron enviar las fotos.')
    } finally { setSaving(false) }
  }

  return <div className="driver-screen">
    <header className="driver-top"><div className="driver-top-inner"><strong className="driver-top-logo"><CarFront size={20}/> Taxi Control</strong></div></header>
    <main className="driver-wrap driver-upload-wrap">
      <header className="driver-heading"><h1>Cerrar jornada</h1><div className="body-copy">Completá los importes y adjuntá la planilla y el taxímetro. Si tenés una sola foto, también podés enviarla.</div></header>
      <form className="driver-upload-form" onSubmit={submit}>
        <div className="field-grid">
          <label className="mobile-field"><em>Nombre del conductor</em><input type="text" maxLength="120" autoComplete="name" value={driverName} onChange={event => setDriverName(event.target.value)} required/></label>
          <label className="mobile-field"><em>Número del móvil</em><input type="text" inputMode="numeric" pattern="[0-9]{1,6}" maxLength="6" value={mobileNumber} onChange={event => setMobileNumber(event.target.value)} placeholder="Ej.: 13" required/></label>
          <label className="mobile-field"><em>Inicio del turno</em><div className="date-input-shell"><input type="datetime-local" value={startedAt} onChange={event => setStartedAt(event.target.value)} required/><strong aria-hidden="true">{readableDateTime(startedAt)}</strong><CalendarDays aria-hidden="true" size={18}/></div></label>
          <label className="mobile-field"><em>Fin del turno</em><div className="date-input-shell"><input type="datetime-local" value={endedAt} onChange={event => setEndedAt(event.target.value)} required/><strong aria-hidden="true">{readableDateTime(endedAt)}</strong><CalendarDays aria-hidden="true" size={18}/></div></label>
          <label className="mobile-field"><em>Odómetro inicial (km)</em><input type="number" min="0" step="1" inputMode="numeric" value={odometerStartKm} onChange={event => setOdometerStartKm(event.target.value)} required/></label>
          <label className="mobile-field"><em>Odómetro final (km)</em><input type="number" min="0" step="1" inputMode="numeric" value={odometerEndKm} onChange={event => setOdometerEndKm(event.target.value)} required/></label>
        </div>
        <h2 className="driver-form-section">Importes del cierre</h2>
        <div className="field-grid">
          <label className="mobile-field"><em>Venta total (UYU)</em><input type="number" min="0" step="0.01" inputMode="decimal" value={amounts.sales} onChange={event => setAmount('sales', event.target.value)} required/></label>
          <label className="mobile-field"><em>Comisión (UYU)</em><input type="number" min="0" step="0.01" inputMode="decimal" value={amounts.commission} onChange={event => setAmount('commission', event.target.value)} required/></label>
          <label className="mobile-field"><em>Concepto</em><select value={jornalPosKind} onChange={event => setJornalPosKind(event.target.value)}><option value="jornal">Jornal</option><option value="pos">POS</option></select></label>
          <label className="mobile-field"><em>Jornal o POS (UYU)</em><input type="number" min="0" step="0.01" inputMode="decimal" value={amounts.jornalPos} onChange={event => setAmount('jornalPos', event.target.value)} required/></label>
          <label className="mobile-field"><em>Fiado (UYU)</em><input type="number" min="0" step="0.01" inputMode="decimal" value={amounts.fiado} onChange={event => setAmount('fiado', event.target.value)} required/></label>
          <label className="mobile-field"><em>Total a pagar (UYU)</em><input type="number" min="0" step="0.01" inputMode="decimal" value={amounts.totalToPay} onChange={event => setAmount('totalToPay', event.target.value)} required/></label>
          <label className="mobile-field"><em>Gastos del turno (UYU)</em><input type="number" min="0" step="0.01" inputMode="decimal" value={amounts.expenses} onChange={event => setAmount('expenses', event.target.value)} required/></label>
          <label className="mobile-field"><em>Detalle de gastos, si hubo</em><input type="text" maxLength="250" value={expenseNote} onChange={event => setExpenseNote(event.target.value)}/></label>
        </div>
        <h2 className="driver-form-section">Comprobantes</h2>
        <PhotoPicker title="Planilla de jornada" file={sheet} onChange={file => choosePhoto('sheet', file)}/>
        <PhotoPicker title="Detalle del taxímetro" file={meter} onChange={file => choosePhoto('meter', file)}/>
        {error && <div className="form-error" role="alert">{error}</div>}
        {success && <div className="form-success" role="status"><Check size={18}/><strong>Jornada enviada para revisión.</strong></div>}
        <button type="submit" className="button primary full-width save-ticket" disabled={saving}><Check size={19}/>{saving ? 'Enviando...' : 'Enviar cierre'}</button>
      </form>
    </main>
  </div>
}
