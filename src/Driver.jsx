import { useEffect, useRef, useState } from 'react'
import { Camera, Check, Image as ImageIcon, CarFront, X } from 'lucide-react'
import { currentDrivers, currentVehicles, localDate } from './data/catalog.js'
import { supabase } from './lib/supabase.js'

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

export default function Driver({ data, onAddShiftReport }) {
  const drivers = currentDrivers(data)
  const vehicles = currentVehicles(data)
  const [driverId, setDriverId] = useState('')
  const [vehicleId, setVehicleId] = useState('')
  const [date, setDate] = useState(() => localDate())
  const [odometerStartKm, setOdometerStartKm] = useState('')
  const [sheet, setSheet] = useState(null)
  const [meter, setMeter] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [saving, setSaving] = useState(false)
  const [session, setSession] = useState(undefined)
  const [email, setEmail] = useState('prueba.taxis@example.com')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loginSaving, setLoginSaving] = useState(false)

  useEffect(() => {
    if (!supabase) { setLoginError('El acceso no está configurado.'); setSession(null); return undefined }
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession))
    supabase.auth.getSession().then(({ data: result }) => setSession(result.session)).catch(() => setSession(null))
    return () => listener.subscription.unsubscribe()
  }, [])

  function changeDriver(id) {
    setDriverId(id)
    setVehicleId(drivers.find(driver => driver.id === id)?.assignedVehicleId || '')
    setError('')
  }

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

  async function signIn(event) {
    event.preventDefault()
    setLoginError('')
    setLoginSaving(true)
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (authError) throw authError
      setPassword('')
    } catch {
      setLoginError('No se pudo ingresar. Revisá el correo y la contraseña.')
    } finally { setLoginSaving(false) }
  }

  async function submit(event) {
    event.preventDefault()
    setError('')
    setSuccess(false)
    if (!driverId || !vehicleId) return setError('Elegí conductor y matrícula.')
    if (!date || date > localDate()) return setError('Elegí una fecha válida, hasta hoy.')
    if (odometerStartKm === '' || !Number.isFinite(Number(odometerStartKm)) || Number(odometerStartKm) < 0) return setError('Ingresá los kilómetros iniciales del taxi.')
    if (!sheet && !meter) return setError('Adjuntá la planilla, el detalle del taxímetro o ambos.')
    setSaving(true)
    try {
      await onAddShiftReport({ driverId, vehicleId, date, odometerStartKm }, { sheet, meter })
      setSheet(null)
      setMeter(null)
      setSuccess(true)
    } catch (cause) {
      setError(cause.message || 'No se pudieron enviar las fotos.')
    } finally { setSaving(false) }
  }

  return <div className="driver-screen">
    <header className="driver-top"><div className="driver-top-inner"><strong className="driver-top-logo"><CarFront size={20}/> Taxi Control</strong></div></header>
    <main className="driver-wrap driver-upload-wrap">
      {session === undefined ? <div className="body-copy">Preparando acceso...</div> : !session ?
        <form className="driver-login-form" onSubmit={signIn}>
          <h1>Ingresar</h1>
          <label className="mobile-field"><em>Correo</em><input type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="username" required/></label>
          <label className="mobile-field"><em>Contraseña</em><input type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" required/></label>
          {loginError && <div className="form-error" role="alert">{loginError}</div>}
          <button type="submit" className="button primary full-width" disabled={loginSaving}>{loginSaving ? 'Ingresando...' : 'Ingresar'}</button>
        </form> : <>
      <header className="driver-heading"><h1>Subir jornada</h1><div className="body-copy">Sacá las fotos de la planilla y del taxímetro. Si tenés una sola, también podés enviarla.</div></header>
      <form className="driver-upload-form" onSubmit={submit}>
        <div className="field-grid">
          <label className="mobile-field"><em>Conductor</em><select value={driverId} onChange={event => changeDriver(event.target.value)} required><option value="">Elegí tu nombre</option>{drivers.map(driver => <option key={driver.id} value={driver.id}>{driver.name}</option>)}</select></label>
          <label className="mobile-field"><em>Matrícula</em><select value={vehicleId} onChange={event => setVehicleId(event.target.value)} required><option value="">Elegí el taxi</option>{vehicles.map(vehicle => <option key={vehicle.id} value={vehicle.id}>{vehicle.plate}</option>)}</select></label>
          <label className="mobile-field"><em>Fecha de la jornada</em><input type="date" value={date} max={localDate()} onChange={event => setDate(event.target.value)} required/></label>
          <label className="mobile-field"><em>Odómetro inicial (km)</em><input type="number" min="0" step="1" inputMode="numeric" value={odometerStartKm} onChange={event => setOdometerStartKm(event.target.value)} placeholder="Ej.: 148250" required/></label>
        </div>
        <PhotoPicker title="Planilla de jornada" file={sheet} onChange={file => choosePhoto('sheet', file)}/>
        <PhotoPicker title="Detalle del taxímetro" file={meter} onChange={file => choosePhoto('meter', file)}/>
        {error && <div className="form-error" role="alert">{error}</div>}
        {success && <div className="form-success" role="status"><Check size={18}/><strong>Fotos enviadas para revisión.</strong></div>}
        <button type="submit" className="button primary full-width save-ticket" disabled={saving}><Check size={19}/>{saving ? 'Enviando...' : 'Enviar jornada'}</button>
      </form>
      </>}
    </main>
  </div>
}
