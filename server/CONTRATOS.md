# Contratos e integraciones

La API local de `server/api.mjs` implementa lectura de catálogo, tickets, turnos, movimientos e ingresos, además de escritura del estado completo en un archivo JSON local. Sus rutas se documentan en `README.md`. Este servidor no incorpora autenticación ni permisos y escucha solo en `127.0.0.1`.

## API de lectura de tickets (OpenAI)

El navegador envía `multipart/form-data` a un backend **autenticado** en `POST /api/tickets/extract`, campo `ticket` (imagen). El backend valida el conductor/turno, archivo y tamaño; almacena el comprobante de forma privada; envía la imagen a OpenAI desde un entorno con `OPENAI_API_KEY` en secretos de servidor y exige JSON estructurado.

**Respuesta orientativa:**

```json
{
  "fields": {
    "date": "2026-11-09",
    "time": "14:35",
    "ticketNumber": "001258",
    "amount": 850,
    "distanceKm": 4.2
  },
  "requiresReview": true,
  "warnings": ["El número de ticket está borroso"]
}
```

Reglas: nunca asumir que una extracción es correcta; comprobar importes, unidad, fecha, número, vehículo, posibles duplicados y coherencia de kilómetros; registrar la foto original y auditoría de correcciones. Si la foto es ilegible, exigir confirmación manual. El cálculo salarial no debe depender de datos no validados.

El archivo `src/lib/integrations.js` contiene el adaptador de frontend. `VITE_OCR_ENABLED` debe permanecer en `false` hasta desplegar el backend real y autenticado. **No** usar `VITE_OPENAI_API_KEY`.

## Servidor MCP para ChatGPT

Previsto para una futura versión administrada por servidor, con HTTP accesible y OAuth/autenticación adecuada. Ejemplos de herramientas **solo lectura**:

- `resumen_operativo({ desde, hasta, vehiculo_id? })`
- `viajes_por_conductor({ desde, hasta, conductor_id? })`
- `diferencias_de_caja({ desde, hasta })`
- `liquidaciones_estimadas({ desde, hasta })`

La API futura debe aplicar permisos (administrador vs conductor), límites de consulta y registros de auditoría. No exponer datos financieros de otros conductores a usuarios sin permisos. `GET /mcp` responde 501 intencionalmente: **no es un MCP funcional ni hay conexión con ChatGPT**.

## Esquema de datos para un backend futuro

- `vehicles(id, plate, stand, status)`
- `drivers(id, full_name, auth_user_id, active)`
- `shifts(id, driver_id, vehicle_id, started_at, ended_at, km_start, km_end, cash_declared, status)`
- `tickets(id, shift_id, driver_id, vehicle_id, ticket_number, date, time, amount, distance_km, payment_method, review_status, image_path, source, created_at)`
- `movements(id, vehicle_id, shift_id, kind, category, description, amount, date)`
- `payroll_rules(id, driver_id, effective_from, calculation_method, rate)`
- `audit_log(id, actor_id, entity, entity_id, action, before_json, after_json, created_at)`

Importante: en producción, los uploads de fotos y los datos deben estar en almacenamiento privado con controles de acceso por fila/rol, no en el almacenamiento local del navegador. Un registro de viaje no equivale a recaudación entregada. La liquidación laboral requiere definición de reglas, anticipos, aportes, horas y excepciones.
