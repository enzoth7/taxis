# Taxi Control

Aplicación de Vite y React para enviar fotos de jornadas y administrar viajes y movimientos de una flota de cinco taxis. El catálogo incluye quince conductores con nombres ficticios. La interfaz usa blanco, azul profundo y tablas con columnas.

## Iniciar

Requiere Node.js 20.19 o superior.

Creá un `.env` local con `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` del proyecto Taxis en Supabase. El archivo queda excluido de Git. La clave publicable puede usarse en el navegador; nunca coloques una clave privada en variables `VITE_`.

```bash
npm install
npm run dev
```

Abrí `http://127.0.0.1:5173`. El servidor de desarrollo incluye la API local. También se puede iniciar la API por separado con `npm run api` en `http://127.0.0.1:8787`.

Para probar la carga desde un celular conectado a la misma red, generá la aplicación y levantá la vista previa en la red local:

```bash
npm run build
npm run preview -- --host 0.0.0.0 --port 4173
```

En el celular abrí `http://IP-DE-ESTA-COMPUTADORA:4173/conductor`. La vista previa no publica la API local. Mantené la computadora encendida mientras probás. No expongas ese puerto a Internet.

```bash
npm test
npm run build
```

## Pantallas

- Panel administrativo: Inicio, viajes y tickets, planillas de jornada, turnos, conductores, flota, movimientos, liquidaciones y configuración.
- Vista del conductor: selección de nombre, matrícula y fecha, registro del odómetro inicial y envío de la planilla de jornada, el detalle impreso del taxímetro o ambos. La fecha se completa con la de hoy. No muestra importes, ingresos, turnos ni otras secciones administrativas.
- En Planillas se ven las fotos enviadas desde otro dispositivo al ingresar con el mismo usuario. La revisión permite cargar número de móvil, odómetro final, cantidad de viajes, recaudación de cada fuente y observaciones. Cuando hay dos totales se muestra su diferencia.
- Las tablas incluyen acciones para editar tickets, turnos, movimientos, conductores y matrículas. Los totales calculados llevan a sus registros o a la configuración del porcentaje.
- Los quince conductores se asignan inicialmente a cinco taxis. Sus nombres masculinos son ficticios. Las matrículas de muestra van de `IAC 111` a `IAC 115`; las paradas quedan sin asignar hasta contar con datos reales. No hay viajes precargados.

## API local

La API se monta en Vite y también funciona con `npm run api`. Guarda el estado en `server/data/state.json`, archivo excluido del control de versiones.

| Método | Ruta | Uso |
| --- | --- | --- |
| GET | `/api/health` | Estado de la API local |
| GET | `/api/catalog` | Conductores y taxis |
| GET | `/api/state` | Estado completo |
| PUT | `/api/state` | Guarda tickets, turnos, movimientos y porcentaje |
| GET | `/api/tickets` | Tickets, con filtros opcionales |
| GET | `/api/shifts` | Turnos, con filtros opcionales |
| GET | `/api/movements` | Movimientos, con filtros opcionales |
| GET | `/api/drivers/:id/income?days=7` | Ingresos del conductor, para 1, 7 o 30 días |
| POST | `/api/tickets/extract` | Reservado para lectura de fotos, responde 501 |
| GET | `/mcp` | Reservado para MCP, responde 501 |

Los listados aceptan `driverId`, `vehicleId`, `from` y `to` como parámetros de consulta. En el servidor de desarrollo, la interfaz conserva los registros en `localStorage` y los sincroniza con la API local. En la vista previa del celular, los datos de la interfaz quedan en ese navegador y no se sincronizan con la API local.

## Jornadas y fotos en Supabase

La vista del conductor pide ingresar con un usuario de Supabase Auth. Guarda una o dos fotos por jornada en el bucket privado `taxi-tickets` con ruta `usuario/conductor/fecha/jornada/tipo-de-foto` y registra sus datos en `public.taxi_shift_reports`. Las políticas de la tabla y del bucket permiten leer y subir archivos al propietario de la sesión. La tabla anterior `public.taxi_ticket_uploads` se conserva para los tickets individuales existentes.

La URL y la clave publicable están en `.env`, excluido del control de versiones. No hay clave de servicio en la aplicación. La selección de conductor atribuye el archivo, pero no verifica quién usa el dispositivo. El usuario de prueba comparte acceso a sus propias fotos entre el celular y la computadora cuando se inicia sesión en ambos.

La aplicación envía las fotografías a Supabase Storage e inserta una fila en `/rest/v1/taxi_shift_reports`. La pestaña Planillas consulta la misma tabla y permite editar los datos revisados. Actualmente el usuario de prueba es compartido: cualquiera con esas credenciales puede abrir el panel y revisar las fotos. Para uso real hacen falta cuentas individuales y permisos separados para conductores y administradores.

## Alcance actual

La API local escucha solo en `127.0.0.1`. Cualquier proceso local con acceso al puerto puede consultar y reemplazar su estado, por lo que no se debe publicar como servidor accesible desde una red. El panel sigue teniendo secciones que guardan datos localmente; solo las planillas y sus fotos se sincronizan mediante Supabase.

Los ingresos y liquidaciones son estimaciones calculadas con el porcentaje configurado sobre los tickets individuales registrados. Las planillas revisadas todavía no alimentan esos indicadores. El OCR con OpenAI y el MCP para ChatGPT tienen rutas reservadas, pero no están configurados ni ejecutan llamadas externas. Una tarea programada de ChatGPT Plus no tiene acceso automático a las imágenes privadas de este proyecto. Por ahora, para transcribir una jornada en ChatGPT, adjuntá las fotos en el chat, verificá los campos dudosos y cargá los datos en Planillas. Las claves de servicios futuros deben quedar en un backend privado, nunca en variables `VITE_` ni en el navegador. Ver [contratos de integración](server/CONTRATOS.md).
