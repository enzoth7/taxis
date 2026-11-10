import { useLayoutEffect, useRef, useState } from 'react'
import { money } from './lib/core.js'

const plot = { left: 77, right: 23, top: 20, bottom: 48 }

function shortDate(date, showYear = false) {
  return new Date(`${date}T12:00:00`).toLocaleDateString('es-UY', { day: 'numeric', month: 'short', year: showYear ? 'numeric' : undefined })
}
function fullDate(date) {
  return new Date(`${date}T12:00:00`).toLocaleDateString('es-UY', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function RevenueChart({ series, showPoints }) {
  const chartRef = useRef(null)
  const [width, setWidth] = useState(900)
  const [hoverIndex, setHoverIndex] = useState(null)
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
    : [...new Set([0, .25, .5, .75, 1].map(fraction => Math.round((series.length - 1) * fraction)))]
  const ticks = highest > 0 ? [1, 0.5, 0] : [0]
  const spansYears = series[0]?.date.slice(0, 4) !== series.at(-1)?.date.slice(0, 4)
  const hovered = hoverIndex == null ? null : series[hoverIndex]
  function showAtPointer(event) {
    const bounds = event.currentTarget.ownerSVGElement.getBoundingClientRect()
    const coordinate = (event.clientX - bounds.left) * width / bounds.width
    const fraction = Math.max(0, Math.min(1, (coordinate - plot.left) / plotWidth))
    setHoverIndex(Math.round(fraction * (series.length - 1)))
  }

  if (series.length === 0) return <div className="revenue-chart-empty">No hay fechas en el período seleccionado.</div>
  return <div className="revenue-chart-frame">
    <div className="revenue-chart-stage" ref={chartRef}>
      <svg className="revenue-line-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Recaudación diaria del ${fullDate(series[0].date)} al ${fullDate(series.at(-1).date)}, total: ${money(series.reduce((sum, day) => sum + day.amount, 0))}`}>
        {ticks.map(fraction => {
          const position = y(axisMax * fraction)
          return <g key={fraction}>
            <line className="revenue-grid-line" x1={plot.left} x2={plot.left + plotWidth} y1={position} y2={position}/>
            <text className="revenue-axis-label" x={plot.left - 13} y={position + 4} textAnchor="end">{money(axisMax * fraction)}</text>
          </g>
        })}
        <polyline key={points} className={showPoints ? 'revenue-chart-line' : 'revenue-chart-line revenue-chart-line-overview'} points={line} pathLength="1"/>
        {showPoints && series.map((day, index) => <circle key={day.date} className="revenue-chart-point" cx={x(index)} cy={y(day.amount)} r={series.length > 7 ? 3 : 5}>
          <title>{`${shortDate(day.date)}: ${money(day.amount)}`}</title>
        </circle>)}
        {labelIndexes.map(index => <text key={series[index].date} className="revenue-axis-label revenue-date-label" x={x(index)} y={height - 14} textAnchor={spansYears && index === series.length - 1 ? 'end' : 'middle'}>{shortDate(series[index].date, spansYears)}</text>)}
        {hovered && <g className="revenue-hover-marker" aria-hidden="true"><line x1={x(hoverIndex)} x2={x(hoverIndex)} y1={plot.top} y2={plot.top + plotHeight}/><circle cx={x(hoverIndex)} cy={y(hovered.amount)} r="6"/></g>}
        <rect className="revenue-hover-area" x={plot.left} y={plot.top} width={plotWidth} height={plotHeight} onPointerMove={showAtPointer} onPointerDown={showAtPointer} onPointerLeave={event => { if (event.pointerType !== 'touch') setHoverIndex(null) }}/>
      </svg>
      {hovered && <div className="revenue-tooltip" style={{ left: Math.max(4, Math.min(width - 184, x(hoverIndex) - 88)), top: y(hovered.amount) < 82 ? y(hovered.amount) + 16 : y(hovered.amount) - 68 }}><strong>{fullDate(hovered.date)}</strong><em>{money(hovered.amount)}</em></div>}
    </div>
    {highest === 0 && <div className="revenue-chart-empty">Todavía no hay recaudación registrada en este período.</div>}
  </div>
}
