# Pipeline ETL: Open-Meteo → Supabase

Práctica de Big Data. Una sola pantalla para **extraer** datos horarios del
archivo histórico de Open-Meteo, **transformarlos**, **limpiarlos**,
**filtrarlos y seleccionarlos**, y **cargarlos** en Supabase, viendo qué
ocurre con los datos en cada fase.

Stack: Next.js 16 (App Router), TypeScript, Tailwind 4, shadcn/ui (Base UI),
`@supabase/supabase-js` y Vitest.

## Instalación y ejecución

```bash
npm install
cp .env.example .env.local   # y rellena los valores (ver más abajo)
npm run dev                  # http://localhost:3000
```

Sin credenciales de Supabase puedes extraer, transformar, limpiar, filtrar y
revisar la vista previa. La carga queda deshabilitada: no se simula.

| Script                     | Qué hace                                             |
| -------------------------- | ---------------------------------------------------- |
| `npm test`                 | Pruebas unitarias (usan fixtures controlados)        |
| `npm run test:integracion` | Prueba contra la API real de Open-Meteo (requiere red) |
| `npm run typecheck`        | Comprobación de tipos                                |
| `npm run lint`             | ESLint                                               |
| `npm run build`            | Build de producción                                  |

## Configurar Supabase

1. Crea un proyecto en Supabase.
2. Aplica la migración
   [`supabase/migrations/20261026120000_mediciones_meteorologicas.sql`](supabase/migrations/20261026120000_mediciones_meteorologicas.sql):
   pégala en el SQL Editor o ejecuta `supabase db push` con la CLI.
3. En `.env.local`:

   | Variable              | Valor                                                                       |
   | --------------------- | --------------------------------------------------------------------------- |
   | `SUPABASE_URL`        | URL del proyecto (`https://xxxx.supabase.co`)                               |
   | `SUPABASE_SECRET_KEY` | Clave secreta `sb_secret_…`, o la clave `service_role` en proyectos antiguos |

4. Reinicia `npm run dev`. La pestaña «Vista previa de la carga» indica si la
   conexión y la tabla están disponibles.

### Seguridad

- La escritura y la lectura de Supabase se hacen **solo en el servidor**
  (`app/api/supabase/*`, a través de `lib/supabase/servidor.ts`, marcado con
  `server-only`). Ninguna variable lleva el prefijo `NEXT_PUBLIC_`.
- El servidor vuelve a validar cada lote: tamaño del cuerpo (256 KB como
  máximo), entre 1 y 500 filas, campos permitidos, ciudad conocida, fecha
  ISO en UTC, números finitos, rangos y ausencia de claves duplicadas.
- La tabla tiene **RLS activado y ninguna política**. `anon` y `authenticated`
  no tienen privilegios. Solo el rol `service_role` (la clave secreta) accede.
- Los logs registran el código y el mensaje del error, nunca las credenciales.
- **El proyecto no tiene autenticación.** Los endpoints funcionan con
  `npm run dev`. En producción (`next start`) responden 403 salvo que se
  defina `ETL_PERMITIR_SIN_AUTENTICACION=true`. Antes de publicar la app hay
  que añadir autenticación y proteger `app/api/supabase/*`.

## El pipeline

```
Extracción → Transformación → Limpieza → Filtrado y selección → Carga
```

1. **Extracción** (`lib/etl/extraccion.ts`). Hace una petición por ciudad a
   `https://archive-api.open-meteo.com/v1/archive` con
   `hourly=temperature_2m,relative_humidity_2m,precipitation`,
   `timezone=UTC`, `temperature_unit=celsius` y `precipitation_unit=mm`.
   - Las peticiones van en serie, así que se ve qué ciudad se está procesando
     y cuáles quedan pendientes.
   - El texto JSON recibido se conserva tal cual durante la sesión y se puede
     descargar.
   - Si una ciudad falla, se reintenta solo esa ciudad. Su respuesta se
     reemplaza, de modo que no se duplican datos.
   - El periodo máximo es de 31 días.
2. **Transformación** (`lib/etl/transformacion.ts`). La API devuelve arrays
   paralelos. La posición `i` de cada array se convierte en un registro
   `{ ciudad, fecha_hora, temperatura_c, humedad_pct, precipitacion_mm }`.
   - Se exige `utc_offset_seconds = 0` y las unidades `°C`, `%` y `mm`.
   - La hora (`"2026-09-01T00:00"`) se interpreta explícitamente como UTC con
     `Date.UTC`, nunca con `new Date(texto)`.
   - Si los arrays no tienen la misma longitud, no se puede saber qué valor
     corresponde a cada hora. Se informa del problema y se rechazan todas las
     filas de esa ciudad.
   - Los valores se copian sin convertirlos: un `null` sigue siendo `null`.
3. **Limpieza** (`lib/etl/limpieza.ts`, `lib/etl/validacion.ts`).
   - Rechaza las filas sin ciudad o sin fecha válida, y las que tienen alguna
     medición que no es un número finito (`null`, `""`, ausente, texto, NaN).
   - Exige humedad entre 0 y 100 y precipitación ≥ 0.
   - La temperatura **no** tiene umbrales: un valor extremo puede ser real.
   - Cada fila rechazada guarda sus motivos.
   - **Duplicados** por `(ciudad, fecha_hora)`: se conserva la **primera**
     aparición válida en el orden de extracción (orden de las ciudades y, dentro
     de cada una, orden de los arrays). Las siguientes se rechazan indicando
     qué índice se conservó.
4. **Filtrado y selección** (`lib/etl/filtros.ts`). Las operaciones siguen
   este orden: **válidos → filtros → ordenación → selección → carga**.
   - Filtros disponibles: ciudades, intervalo de fecha y hora en UTC,
     mínimos y máximos de cada medición, y «solo con lluvia»
     (precipitación > 0).
   - La paginación solo afecta a lo que se ve.
   - Se suben únicamente las filas seleccionadas que siguen cumpliendo los
     filtros actuales. Se indica cuántas filas seleccionadas quedan fuera.
   - Cambiar los filtros nunca selecciona filas nuevas.
   - Las filas que excluyen los filtros **no** son rechazos de calidad y no
     aparecen en «Rechazados».
5. **Carga** (`lib/etl/carga.ts`, `app/api/supabase/carga`).
   - Al pulsar «Subir», se congela una copia del conjunto y de su orden.
   - El botón **«Subir los N registros válidos a Supabase»** es un atajo:
     restablece los filtros, selecciona todos los válidos y los sube en un
     solo clic. La vista previa queda igual a lo enviado.
   - Se envían lotes de hasta 500 filas, en serie, mediante
     `upsert(..., { onConflict: "ciudad,fecha_hora" })`. Repetir una carga
     no crea duplicados.
   - Se muestra el estado real de cada lote.
   - Si un lote falla, los demás conservan su estado y se pueden reintentar
     solo los fallidos.
   - Supabase devuelve el número de filas afectadas, pero no distingue
     insertadas de actualizadas, así que la app no inventa ese desglose.
   - Después de cargar, `app/api/supabase/verificacion` comprueba por lotes
     que todas las claves enviadas existen en el destino.

> Una tabla SQL **no conserva el orden de inserción**. Cualquier consulta
> posterior necesita `ORDER BY`, por ejemplo `ORDER BY fecha_hora, ciudad`.

La pestaña **«Datos en Supabase»** lee lo que realmente está persistido. Es
paginada y permite filtrar por ciudad y fechas, ordenar y actualizar. Así se
distingue lo persistido de los datos locales pendientes de subir.

## Pruebas

- `tests/pipeline.test.ts` y `tests/filtros-y-carga.test.ts` cubren:
  - la URL de la petición y la validación del periodo;
  - la transformación de arrays y la interpretación de fechas en UTC;
  - los `null` (que no se convierten en 0), los duplicados y los arrays
    desalineados;
  - filtros y orden aplicados antes de paginar, y la selección entre páginas;
  - la coincidencia entre la vista previa y lo enviado;
  - la segunda carga sin duplicados, el fallo parcial y el reintento;
  - la verificación por lotes y la validación del servidor.

  Usan los fixtures de `tests/fixtures/`, que nunca se mezclan con las
  extracciones reales.
- `tests/integracion/open-meteo.test.ts` usa la API real: una ciudad
  durante un día devuelve 24 registros horarios en UTC.
- Pendiente con credenciales: la carga real en Supabase, la segunda carga
  contra la restricción única real y la verificación de claves en destino.
