import { useLayoutEffect, useRef, useState } from 'react'
import { money } from './lib/core.js'

const plot = { left: 77, right: 23, top: 20, bottom: 48 }

function shortDate(date) {
  return new Date(`${date}T12:00:00`).toLocaleDateString('es-UY', { day: 'numeric', month: 'short' })
}

export default function RevenueChart({ series }) {
  const chartRef = useRef(null)
  const [width, setWidth] = useState(900)
  useLayoutEffect(() => {
    const node = chartRef.current
    if (!node) return undefined
    const update = () => setWidth(Math.max(320, Math.round(node.clientWidth)))
    update()
    if (typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(update)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  const height = width < 600 ? 220 : 280
  const plotWidth = width - plot.left - plot.right
  const plotHeight = height - plot.top - plot.bottom
  const highest = Math.max(0, ...series.map(day => day.amount))
  const axisMax = highest > 0 ? Math.ceil(highest / 4) * 4 : 1
  const x = index => series.length === 1 ? plot.left + plotWidth / 2 : plot.left + (index / (series.length - 1)) * plotWidth
  const y = amount => plot.top + plotHeight - (amount / axisMax) * plotHeight
  const points = series.map((day, index) => `${x(index)},${y(day.amount)}`).join(' ')
  const line = series.length === 1 ? `${plot.left},${y(series[0].amount)} ${plot.left + plotWidth},${y(series[0].amount)}` : points
  const labelIndexes = width < 600 && series.length > 2
    ? [0, Math.floor((series.length - 1) / 2), series.length - 1]
    : series.length <= 7
    ? series.map((_, index) => index)
    : [0, 7, 14, 21, series.length - 1]
  const ticks = highest > 0 ? [1, 0.5, 0] : [0]

  return <div className="revenue-chart-frame">
    <div className="revenue-chart-stage" ref={chartRef}>
      <svg className="revenue-line-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Recaudación diaria del período: ${series.map(day => `${shortDate(day.date)}, ${money(day.amount)}`).join('; ')}`}>
        {ticks.map(fraction => {
          const position = y(axisMax * fraction)
          return <g key={fraction}>
            <line className="revenue-grid-line" x1={plot.left} x2={plot.left + plotWidth} y1={position} y2={position}/>
            <text className="revenue-axis-label" x={plot.left - 13} y={position + 4} textAnchor="end">{money(axisMax * fraction)}</text>
          </g>
        })}
        <polyline key={points} className="revenue-chart-line" points={line} pathLength="1"/>
        {series.map((day, index) => <circle key={day.date} className="revenue-chart-point" cx={x(index)} cy={y(day.amount)} r={series.length > 7 ? 3 : 5}>
          <title>{shortDate(day.date)}: {money(day.amount)}</title>
        </circle>)}
        {labelIndexes.map(index => <text key={series[index].date} className="revenue-axis-label revenue-date-label" x={x(index)} y={height - 14} textAnchor="middle">{shortDate(series[index].date)}</text>)}
      </svg>
    </div>
    {highest === 0 && <div className="revenue-chart-empty">Todavía no hay recaudación registrada en este período.</div>}
  </div>
}
