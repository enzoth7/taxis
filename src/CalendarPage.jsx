import { monthlyCoverage } from './lib/coverage.js'

const monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

export default function CalendarPage({ shifts, reports, vehicles }) {
  const mobiles = vehicles.map(vehicle => vehicle.mobileNumber).filter(Boolean)
  const months = monthlyCoverage(shifts, reports, mobiles)
  const years = [...new Set(months.map(row => row.year))]
  return <section className="coverage-page">
    <div className="coverage-note">Dos turnos previstos por móvil y por día. El mes actual se calcula hasta hoy. Cada celda muestra jornadas registradas sobre jornadas previstas.</div>
    {months.length === 0 ? <div className="body-copy">Todavía no hay jornadas para calcular la cobertura.</div>
      : years.map(year => <section className="coverage-year" key={year} aria-labelledby={`coverage-year-${year}`}>
        <h2 id={`coverage-year-${year}`}>{year}</h2>
        <div className="table-scroller"><table className="data-table coverage-table mobile-card-table"><thead><tr><th>Mes</th>{mobiles.map(mobile => <th key={mobile}>Móvil {mobile}</th>)}</tr></thead><tbody>{months.filter(row => row.year === year).map(row => <tr key={row.key}><td data-label="Mes">{monthNames[row.month - 1]}</td>{mobiles.map(mobile => { const cell = row.mobiles[mobile]; return <td key={mobile} data-label={`Móvil ${mobile}`}><strong className={`coverage-value ${cell.percent >= 100 ? 'coverage-full' : cell.actual ? 'coverage-partial' : 'coverage-empty'}`}>{cell.percent}%</strong><small>{cell.actual} de {cell.expected}</small></td> })}</tr>)}</tbody></table></div>
      </section>)}
  </section>
}
