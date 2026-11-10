import { money, number } from './lib/core.js'

function monthLabel(month) {
  return new Date(`${month}-01T12:00:00`).toLocaleDateString('es-UY', { month: 'short', year: 'numeric' })
}

export default function MonthlyActivityChart({ months }) {
  if (!months.length) return <div className="monthly-activity-empty">No hay jornadas en el período seleccionado.</div>
  const maximum = Math.max(...months.map(item => item.jornadas))
  return <div className="monthly-activity-chart" aria-label="Jornadas y entradas por mes">
    {months.map(item => <div className="monthly-activity-row" key={item.month}>
      <strong>{monthLabel(item.month)}</strong>
      <div className="monthly-activity-track" role="img" aria-label={`${number(item.jornadas)} jornadas en ${monthLabel(item.month)}`}><div style={{ width: `${item.jornadas / maximum * 100}%` }}/></div>
      <strong>{number(item.jornadas)}</strong>
      <em>{item.jornadasConImporte ? money(item.entradas) : 'Sin importe'}</em>
    </div>)}
  </div>
}
