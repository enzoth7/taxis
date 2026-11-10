import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown } from 'lucide-react'

export default function ColumnFilter({ label, value, options, open, onToggle, onChange, onClose }) {
  const trigger = useRef(null)
  const menu = useRef(null)
  const [position, setPosition] = useState(null)

  useLayoutEffect(() => {
    if (!open) return undefined
    function place() {
      const rect = trigger.current?.getBoundingClientRect()
      if (!rect) return
      const width = Math.min(280, window.innerWidth - 24)
      const below = window.innerHeight - rect.bottom - 8
      const above = rect.top - 8
      const showAbove = below < 180 && above > below
      const height = Math.min(320, Math.max(120, showAbove ? above : below))
      setPosition({
        left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
        top: showAbove ? Math.max(8, rect.top - height - 4) : rect.bottom + 4,
        width,
        maxHeight: height,
      })
    }
    function closeOutside(event) {
      if (!trigger.current?.contains(event.target) && !menu.current?.contains(event.target)) onClose()
    }
    function closeOnEscape(event) {
      if (event.key === 'Escape') { onClose(); trigger.current?.focus() }
    }
    place()
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', closeOnEscape)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      document.removeEventListener('pointerdown', closeOutside)
      document.removeEventListener('keydown', closeOnEscape)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, onClose])

  return <>
    <button ref={trigger} type="button" className={`column-filter-trigger ${value ? 'is-filtered' : ''}`} onClick={onToggle} aria-label={`Filtrar ${label}`} aria-haspopup="menu" aria-expanded={open}>
      {label}<ChevronDown size={15} strokeWidth={2}/>
    </button>
    {open && position && createPortal(<div ref={menu} className="column-filter-menu" role="menu" aria-label={`Filtrar ${label}`} style={position}>
      {[{ value: '', label: 'Todos' }, ...options.map(option => ({ value: option, label: option }))].map(option => <button key={option.value} type="button" className={`column-filter-option ${option.value === value ? 'selected' : ''}`} role="menuitemradio" aria-checked={option.value === value} onClick={() => { onChange(option.value); onClose() }}>{option.label}</button>)}
    </div>, document.body)}
  </>
}
