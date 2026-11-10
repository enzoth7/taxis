# Reglas de Taxi Control

- La interfaz usa blanco y azul profundo `#0B1F33`. Las etiquetas de estado son la única excepción: verde para activo o validado, rojo para inactivo y amarillo para en curso, mantenimiento o pendiente.
- Usar una tipografía sans serif sobria y legible.
- En los componentes de la interfaz están prohibidas las etiquetas HTML `<span>` y `<p>`.
- No usar el recurso visual ni la clase `eyebrow`.
- No usar flechas en la interfaz, salvo el ícono de enlace externo en accesos que abren una nueva pestaña.
- Prohibido el exceso de contenedores: no agregar marcos o tarjetas decorativas alrededor de títulos, íconos o botones cuando la sección o la tabla ya organiza el contenido. Los títulos van separados visualmente de las tablas y el botón de editar muestra solo el lápiz, sin doble marco.
- La vista del conductor pide ingresar y completar el cierre de su jornada: nombre, número de móvil, inicio, fin, odómetros, importes, gastos y fotos de planilla y taxímetro. Puede enviar una sola foto si falta la otra. No mostrar indicadores ni accesos al panel administrativo en esa pantalla.
- Cada jornada conserva ambas fuentes por separado. Las cifras extraídas o transcritas se revisan antes de validarse y las diferencias permanecen visibles.
- El directorio de conductores usa los nombres identificables de las hojas históricas. No atribuir matrículas ni estados actuales sin una fuente que los confirme; los registros con conductor desconocido permanecen sin asignar.
- La flota se identifica por número de móvil comprobado. No mostrar matrículas de ejemplo. Un móvil puede vincularse con varios conductores y un conductor con varios móviles según las jornadas.
- Los filtros de período admiten mes calendario y Todo, desde el primer registro hasta la fecha actual. No limitar títulos de Jornadas a años concretos.
- El calendario de cobertura usa dos turnos por día y por móvil; el mes actual se calcula hasta hoy. Los conductores y móviles proceden de Supabase o de las jornadas históricas, nunca de listas fijas en el código.
- No publicar en GitHub ni desplegar cambios sin una instrucción expresa y actual de Enzo.
- Cuando Enzo diga que una carpeta de tirillas está lista para leer, usar la habilidad `$leer-tirillas-taxis` instalada en `C:\Users\Enzog\.codex\skills\leer-tirillas-taxis`. Comparar kilómetros con jornadas cercanas del mismo móvil y dejar las inconsistencias para revisión; no inferir el móvil solo por el conductor.
- No usar el carácter Unicode U+00B7 en textos de interfaz, documentación o respuestas para Enzo.
