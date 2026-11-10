# Taxi Control

Aplicación de Vite y React para enviar cierres de jornada con fotos y consultar la actividad de una flota. El panel reúne jornadas históricas y cierres nuevos, con un diseño adaptable a escritorio y celular.

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

- Panel administrativo: Inicio, Planillas, Turnos, Conductores, Flota de taxis, Movimientos, Calendario y Rendimiento.
- Vista del conductor: nombre, número de móvil, inicio y fin del turno, odómetros inicial y final, venta total, comisión, jornal o POS, fiado, total a pagar y gastos. Envía la planilla de jornada, el detalle impreso del taxímetro o ambos. No muestra indicadores ni secciones administrativas.
- En Inicio se ven las jornadas enviadas y sus indicadores sin iniciar sesión. La pestaña Planillas permite revisar los importes declarados, las dos fotos y los importes transcritos de cada fuente. Cuando hay dos totales se muestra su diferencia.
- Las tablas permiten consultar fotos sin iniciar sesión. Las acciones de edición quedan disponibles solo si ya existe una sesión de administrador. En celular, los registros se presentan por campos.
- Conductores y móviles se leen de tablas de Supabase. Mientras esas tablas no estén disponibles, el panel deriva el directorio de las jornadas históricas. La matrícula es opcional y queda vacía hasta que se cargue una real. Un móvil puede figurar con varios conductores y un conductor con varios móviles, según sus jornadas.
- El calendario muestra jornadas registradas por móvil y mes. La base es de dos turnos por día según la planilla histórica; el mes en curso cuenta solo los días transcurridos.
- El filtro de período permite elegir los meses Desde y Hasta. Inicialmente abarca desde el primer registro hasta el último mes con datos. Los formularios de carga siguen pidiendo una fecha y hora exactas.

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

La vista del conductor abre directamente el formulario, sin correo ni contraseña. Guarda una o dos fotos por jornada en el bucket privado `taxi-tickets` y registra sus datos en `public.taxi_shift_reports`. Los envíos sin sesión se guardan bajo el mismo propietario del historial y quedan pendientes de revisión. La tabla anterior `public.taxi_ticket_uploads` se conserva para los tickets individuales existentes.

La URL y la clave publicable están en `.env`, excluido del control de versiones. En Vercel, las variables de producción `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` ya están configuradas. No hay clave de servicio en la aplicación. El nombre ingresado atribuye el archivo, pero no verifica quién usa el dispositivo.

La aplicación envía las fotografías a Supabase Storage e inserta una fila en `/rest/v1/taxi_shift_reports`. Las secciones del panel que calculan jornadas consultan `public.taxi_jornadas`, una vista única que reúne las hojas históricas y los cierres enviados por conductores. La migración `guest_dashboard_and_driver_submissions` permite ver el mismo historial y sus fotos con la clave publicable, y subir cierres nuevos sin iniciar sesión. Los visitantes no pueden corregir ni validar las jornadas. Cualquier persona con el enlace puede consultar los datos y enviar fotos mientras este acceso esté activo. Para uso real hacen falta cuentas individuales y permisos separados para conductores y administradores.

## Archivo histórico de Drive

Se importaron hojas de móviles y controles de tirillas desde la [carpeta compartida](https://drive.google.com/drive/folders/1VggPwMTQWcR_q3Xa_UoMRLe8K1kCEBMy). Las jornadas importadas conservan archivo, pestaña, número de fila y valores originales. La importación usa una clave única por archivo, pestaña y fila para evitar duplicados al repetirla.

La pantalla Turnos permite filtrar jornadas por mes, móvil y conductor, y corregir los campos interpretados sin modificar la fila original. Conductores y Flota muestran las vinculaciones y cifras según las jornadas registradas. Los nombres parciales o ilegibles permanecen sin asignar hasta que se puedan verificar.

Las hojas históricas y las planillas fotográficas se consultan juntas mediante `public.taxi_jornadas`. Los cierres enviados desde el celular conservan sus fotos y campos en la tabla de origen.

## Tirillas fotográficas de 2023

La carpeta local `Tirillas` contenía 290 JPG. Se eliminaron 136 copias idénticas verificadas por SHA-256 y se conservaron 154 originales. Las 154 copias WebP están en `Tirillas_webp_2023` y en el bucket privado `taxi-tickets`, bajo la ruta del usuario `archive/2023`. La tabla `public.taxi_tirilla_archive_images` guarda una fila por foto, sus huellas, campos transcritos y alertas de revisión. La carga es repetible por huella y las fotos y los manifiestos locales están excluidos de Git.

Todas las fotos de este lote son planillas. Se pudieron leer 146 fechas, 153 números de móvil y 151 ventas. Ocho fechas quedaron vacías; no se asignaron nombres ni cifras por inferencia. Las 154 lecturas conservan el estado `revisar` y sus alertas. Las 146 planillas con fecha y móvil legibles también están en `taxi_archive_rows`, con la referencia a la foto y el estado de revisión en `raw_values`, para que aparezcan al elegir Todo o un mes de 2023 en Inicio y Turnos. La revisión está en `tirillas-2023-revision.json`. La función temporal usada para cargar las fotos quedó desactivada después de verificar los 154 objetos y los 154 registros.

La vista `public.taxi_jornadas` presenta fecha, móvil, conductor, importes, kilómetros, fotos, origen y estado con un solo esquema de consulta. Cada jornada de 2023 aparece una sola vez, vinculada a su WebP. Las ocho fotos sin fecha figuran en la misma vista como `foto_pendiente`; no se suman a los indicadores hasta que se pueda identificar su jornada. Los cierres nuevos enviados desde el celular aparecerán automáticamente en la misma vista.

## Alcance actual

La API local escucha solo en `127.0.0.1`. Cualquier proceso local con acceso al puerto puede consultar y reemplazar su estado, por lo que no se debe publicar como servidor accesible desde una red. El panel sigue teniendo secciones que guardan datos localmente; solo las planillas y sus fotos se sincronizan mediante Supabase.

Inicio, Planillas, Conductores, Flota, Turnos, Calendario y Rendimiento consultan las jornadas unificadas. Movimientos y algunas funciones de edición conservan datos locales. El OCR con OpenAI y el MCP para ChatGPT tienen rutas reservadas, pero no están configurados ni ejecutan llamadas externas. Una tarea programada de ChatGPT Plus no tiene acceso automático a las imágenes privadas de este proyecto. Las claves de servicios futuros deben quedar en un backend privado, nunca en variables `VITE_` ni en el navegador. Ver [contratos de integración](server/CONTRATOS.md).
