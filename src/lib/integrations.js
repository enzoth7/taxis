// El frontend jamás recibe OPENAI_API_KEY. Solo consume una API privada y autenticada.
export const OCR_ENABLED = import.meta.env.VITE_OCR_ENABLED === 'true'
export const API_BASE = import.meta.env.VITE_API_BASE_URL || ''

export async function extractTicket(file) {
  if (!OCR_ENABLED) throw new Error('La lectura con IA todavía no está configurada.')
  const body = new FormData()
  body.append('ticket', file)
  const response = await fetch(`${API_BASE}/api/tickets/extract`, {
    method: 'POST',
    credentials: 'include',
    body,
  })
  if (!response.ok) throw new Error('No se pudo analizar el ticket. Completalo manualmente.')
  const payload = await response.json()
  return payload
}
