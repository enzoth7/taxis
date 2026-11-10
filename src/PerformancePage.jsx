import { useState } from 'react'
import { money, number } from './lib/core.js'
import { performanceByMobileMonth } from './lib/performance.js'

function monthLabel(month) {
  return new Date(`${month}-01T12:00:00`).toLocaleDateString('es-UY', { month: 'long' })
}

function moneyPerKm(value) {
  return value == null ? '—' : `$ ${new Intl.NumberFormat('es-UY', { maximumFractionDigits: 1 }).format(value)}`
}

export default function PerformancePage({ shifts, reports, range, authSession, reportsError, onPage }) {
  const [selectedMobile, setSelectedMobile] = useState('all')
  const rows = performanceByMobileMonth(shifts, reports, range)
  const mobiles = [...new Set(rows.map(row => row.mobile))].sort((a, b) => Number(a) - Number(b))
  const mobile = mobiles.includes(selectedMobile) ? selectedMobile : 'all'
  const visible = mobile === 'all' ? rows : rows.filter(row => row.mobile === mobile)
  const years = [...new Set(visible.map(row => row.month.slice(0, 4)))]
  if (authSession === undefined) return <div className="report-access-status">Cargando jornadas...</div>
  if (reportsError) return <div className="form-error" role="alert">{reportsError}</div>
  return <section className="performance-page" aria-label="Rendimiento por móvil y mes">
    <label className="performance-mobile-filter">Móvil<select value={mobile} onChange={event => setSelectedMobile(event.target.value)} aria-label="Seleccionar móvil"><option value="all">Todos los móviles</option>{mobiles.map(value => <option key={value} value={value}>Móvil {value}</option>)}</select></label>
    {visible.length === 0 ? <div className="performance-message">No hay jornadas de móviles identificados en el período seleccionado.</div>
      : years.map(year => <section className="performance-year" key={year} aria-labelledby={`performance-year-${year}`}>
        <h2 id={`performance-year-${year}`}>{year}</h2>
        <div className="table-scroller"><table className="data-table performance-table"><thead><tr>
          <th>Mes</th><th>Móvil</th><th>Jornadas</th><th>Entradas</th><th>Entradas por jornada</th><th>Km recorridos</th><th>Entradas por km</th>
        </tr></thead><tbody>{visible.filter(row => row.month.startsWith(year)).map(row => <tr key={`${row.month}-${row.mobile}`}>
          <td data-label="Mes"><strong>{monthLabel(row.month)}</strong></td>
          <td data-label="Móvil"><strong>Móvil {row.mobile}</strong></td>
          <td data-label="Jornadas">{number(row.jornadas)}</td>
          <td data-label="Entradas" className="amount">{row.jornadasConImporte ? money(row.entradas) : '—'}</td>
          <td data-label="Entradas por jornada" className="amount">{row.entradasPorJornada == null ? '—' : money(row.entradasPorJornada)}</td>
          <td data-label="Km recorridos">{row.jornadasConKm ? `${number(row.km, 1)} km` : '—'}</td>
          <td data-label="Entradas por km" className="amount">{moneyPerKm(row.entradasPorKm)}</td>
        </tr>)}</tbody></table></div>
      </section>)}
  </section>
}
