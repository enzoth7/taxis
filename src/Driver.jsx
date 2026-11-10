import { useEffect, useRef, useState } from 'react'
import { Camera, Check, FileImage, Image as ImageIcon, CarFront, X } from 'lucide-react'
import { currentDrivers, currentVehicles, localDate } from './data/catalog.js'
import { supabase } from './lib/supabase.js'

function currentTime(date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

export default function Driver({ data, onAddTicket }) {
  const drivers = currentDrivers(data)
  const vehicles = currentVehicles(data)
  const [driverId, setDriverId] = useState('')
  const [vehicleId, setVehicleId] = useState('')
  const [date, setDate] = useState(() => localDate())
  const [odometerStartKm, setOdometerStartKm] = useState('')
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [saving, setSaving] = useState(false)
  const [session, setSession] = useState(undefined)
  const [email, setEmail] = useState('prueba.taxis@example.com')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loginSaving, setLoginSaving] = useState(false)
  const cameraInput = useRef(null)
  const galleryInput = useRef(null)

  useEffect(() => {
    if (!supabase) { setLoginError('El acceso no está configurado.'); setSession(null); return undefined }
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession))
    supabase.auth.getSession().then(({ data: result }) => setSession(result.session)).catch(() => setSession(null))
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!file) { setPreview(null); return undefined }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  function changeDriver(id) {
    const assignedVehicleId = drivers.find(driver => driver.id === id)?.assignedVehicleId || ''
    setDriverId(id)
    setVehicleId(assignedVehicleId)
    setOdometerStartKm(previousOdometer(id, assignedVehicleId, date))
    setError('')
    setSuccess(false)
  }

  function previousOdometer(selectedDriverId, selectedVehicleId, selectedDate) {
    return data.tickets.find(ticket => ticket.driverId === selectedDriverId && ticket.vehicleId === selectedVehicleId && ticket.date === selectedDate && ticket.odometerStartKm != null)?.odometerStartKm ?? ''
  }

  function choosePhoto(selected) {
    if (!selected) return
    if (!selected.type.startsWith('image/')) return setError('Seleccioná una imagen del ticket.')
    if (selected.size > 15 * 1024 * 1024) return setError('La foto debe pesar menos de 15 MB.')
    setFile(selected)
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
    } finally {
      setLoginSaving(false)
    }
  }

  async function submit(event) {
    event.preventDefault()
    setError('')
    setSuccess(false)
    if (!driverId || !vehicleId) return setError('Elegí conductor y matrícula.')
    if (!date || date > localDate()) return setError('Elegí una fecha válida, hasta hoy.')
    if (odometerStartKm === '' || !Number.isFinite(Number(odometerStartKm)) || Number(odometerStartKm) < 0) return setError('Ingresá los kilómetros iniciales del taxi.')
    if (!file) return setError('Sacá una foto o elegila de la galería.')
    const now = new Date()
    setSaving(true)
    try {
      await onAddTicket({
        driverId,
        vehicleId,
        date,
        time: currentTime(now),
        odometerStartKm: Number(odometerStartKm),
        ticketNumber: '',
        amount: null,
        distanceKm: null,
        payment: '',
        note: '',
      }, file)
      setFile(null)
      setSuccess(true)
    } catch (cause) {
      setError(cause.message || 'No se pudo enviar la foto.')
    } finally {
      setSaving(false)
    }
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
      <header className="driver-heading"><h1>Subir ticket</h1><div className="body-copy">Sacá una foto del comprobante y enviala.</div></header>
      <form className="driver-upload-form" onSubmit={submit}>
        <div className="field-grid">
          <label className="mobile-field"><em>Conductor</em><select value={driverId} onChange={event => changeDriver(event.target.value)} required><option value="">Elegí tu nombre</option>{drivers.map(driver => <option key={driver.id} value={driver.id}>{driver.name}</option>)}</select></label>
          <label className="mobile-field"><em>Matrícula</em><select value={vehicleId} onChange={event => { setVehicleId(event.target.value); setOdometerStartKm(previousOdometer(driverId, event.target.value, date)) }} required><option value="">Elegí el taxi</option>{vehicles.map(vehicle => <option key={vehicle.id} value={vehicle.id}>{vehicle.plate}</option>)}</select></label>
          <label className="mobile-field"><em>Fecha</em><input type="date" value={date} max={localDate()} onChange={event => { setDate(event.target.value); setOdometerStartKm(previousOdometer(driverId, vehicleId, event.target.value)) }} required/></label>
          <label className="mobile-field"><em>Odómetro inicial (km)</em><input type="number" min="0" step="1" inputMode="numeric" value={odometerStartKm} onChange={event => setOdometerStartKm(event.target.value)} placeholder="Ej.: 148250" required/></label>
        </div>
        <input ref={cameraInput} type="file" accept="image/*" capture="environment" onChange={event => { choosePhoto(event.target.files?.[0]); event.target.value = '' }} className="visually-hidden" aria-label="Tomar fotografía del ticket" />
        <input ref={galleryInput} type="file" accept="image/*" onChange={event => { choosePhoto(event.target.files?.[0]); event.target.value = '' }} className="visually-hidden" aria-label="Seleccionar fotografía de la galería" />
        <div className={`upload-zone ${file ? 'upload-zone-full' : ''}`}>
          {preview ? <><img src={preview} alt="Foto del ticket seleccionada" className="upload-preview"/><div className="photo-file-label"><FileImage size={16}/><em>{file.name}</em><button type="button" onClick={() => setFile(null)} aria-label="Quitar foto"><X size={17}/></button></div></>
            : <><em className="camera-bubble"><Camera size={30} strokeWidth={1.6}/></em><strong>Fotografía del ticket</strong><em>Asegurate de que se vea completo.</em></>}
          <div className="upload-actions"><button type="button" className="button primary" onClick={() => cameraInput.current?.click()}><Camera size={17}/>{file ? 'Sacar otra' : 'Abrir cámara'}</button><button type="button" className="button secondary" onClick={() => galleryInput.current?.click()}><ImageIcon size={17}/> Galería</button></div>
        </div>
        {error && <div className="form-error" role="alert">{error}</div>}
        {success && <div className="form-success" role="status"><Check size={18}/><strong>Foto enviada para revisión.</strong></div>}
        <button type="submit" className="button primary full-width save-ticket" disabled={saving}><Check size={19}/>{saving ? 'Enviando foto...' : 'Enviar foto'}</button>
      </form>
      </>}
    </main>
  </div>
}
