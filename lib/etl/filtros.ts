import type { RegistroValido } from "./limpieza"

/**
 * Filtros tal como se escriben en el formulario (texto). Un campo vacío
 * significa "sin límite". Las fechas son "AAAA-MM-DDTHH:mm" en UTC.
 */
export interface Filtros {
  /** null = todas las ciudades. */
  ciudades: string[] | null
  desde: string
  hasta: string
  temperaturaMin: string
  temperaturaMax: string
  humedadMin: string
  humedadMax: string
  precipitacionMin: string
  precipitacionMax: string
  soloLluvia: boolean
}

export const FILTROS_INICIALES: Filtros = {
  ciudades: null,
  desde: "",
  hasta: "",
  temperaturaMin: "",
  temperaturaMax: "",
  humedadMin: "",
  humedadMax: "",
  precipitacionMin: "",
  precipitacionMax: "",
  soloLluvia: false,
}

interface Intervalo {
  min?: number
  max?: number
}

export interface Criterios {
  ciudades: Set<string> | null
  desdeMs?: number
  hastaMs?: number
  temperatura: Intervalo
  humedad: Intervalo
  precipitacion: Intervalo
  soloLluvia: boolean
}

export interface FiltrosInterpretados {
  criterios: Criterios
  /** Errores de formulario; el filtro afectado se ignora hasta corregirlo. */
  errores: string[]
  activos: number
}

function leerNumero(
  texto: string,
  etiqueta: string,
  errores: string[]
): number | undefined {
  const t = texto.trim().replace(",", ".")
  if (t === "") return undefined
  const n = Number(t)
  if (!Number.isFinite(n)) {
    errores.push(`«${texto}» no es un número válido en ${etiqueta}.`)
    return undefined
  }
  return n
}

function leerIntervalo(
  min: string,
  max: string,
  etiqueta: string,
  errores: string[]
): Intervalo {
  const a = leerNumero(min, `${etiqueta} mínima`, errores)
  const b = leerNumero(max, `${etiqueta} máxima`, errores)
  if (a !== undefined && b !== undefined && a > b) {
    errores.push(
      `En ${etiqueta}, el mínimo (${a}) es mayor que el máximo (${b}).`
    )
    return {}
  }
  return { min: a, max: b }
}

function leerFechaHora(
  texto: string,
  etiqueta: string,
  errores: string[]
): number | undefined {
  if (!texto) return undefined
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(texto)
  if (!m) {
    errores.push(`La fecha ${etiqueta} no es válida.`)
    return undefined
  }
  const [a, mes, d, h, min] = m.slice(1).map(Number)
  return Date.UTC(a, mes - 1, d, h, min)
}

export function interpretarFiltros(f: Filtros): FiltrosInterpretados {
  const errores: string[] = []
  let desdeMs = leerFechaHora(f.desde, "«desde»", errores)
  let hastaMs = leerFechaHora(f.hasta, "«hasta»", errores)
  if (desdeMs !== undefined && hastaMs !== undefined && desdeMs > hastaMs) {
    errores.push("La fecha «desde» es posterior a «hasta».")
    desdeMs = undefined
    hastaMs = undefined
  }
  const criterios: Criterios = {
    ciudades: f.ciudades === null ? null : new Set(f.ciudades),
    desdeMs,
    hastaMs,
    temperatura: leerIntervalo(
      f.temperaturaMin,
      f.temperaturaMax,
      "temperatura",
      errores
    ),
    humedad: leerIntervalo(f.humedadMin, f.humedadMax, "humedad", errores),
    precipitacion: leerIntervalo(
      f.precipitacionMin,
      f.precipitacionMax,
      "precipitación",
      errores
    ),
    soloLluvia: f.soloLluvia,
  }
  const activos = [
    criterios.ciudades !== null,
    desdeMs !== undefined,
    hastaMs !== undefined,
    criterios.temperatura.min !== undefined,
    criterios.temperatura.max !== undefined,
    criterios.humedad.min !== undefined,
    criterios.humedad.max !== undefined,
    criterios.precipitacion.min !== undefined,
    criterios.precipitacion.max !== undefined,
    criterios.soloLluvia,
  ].filter(Boolean).length
  return { criterios, errores, activos }
}

function dentro(valor: number, intervalo: Intervalo): boolean {
  if (intervalo.min !== undefined && valor < intervalo.min) return false
  if (intervalo.max !== undefined && valor > intervalo.max) return false
  return true
}

export function cumpleCriterios(r: RegistroValido, c: Criterios): boolean {
  if (c.ciudades !== null && !c.ciudades.has(r.ciudad)) return false
  if (c.desdeMs !== undefined || c.hastaMs !== undefined) {
    const ms = Date.parse(r.fecha_hora)
    if (c.desdeMs !== undefined && ms < c.desdeMs) return false
    if (c.hastaMs !== undefined && ms > c.hastaMs) return false
  }
  if (!dentro(r.temperatura_c, c.temperatura)) return false
  if (!dentro(r.humedad_pct, c.humedad)) return false
  if (!dentro(r.precipitacion_mm, c.precipitacion)) return false
  // "Con lluvia" se define estrictamente como precipitación > 0.
  if (c.soloLluvia && !(r.precipitacion_mm > 0)) return false
  return true
}

export function filtrar(
  registros: RegistroValido[],
  criterios: Criterios
): RegistroValido[] {
  return registros.filter((r) => cumpleCriterios(r, criterios))
}

export type CampoOrden =
  "ciudad" | "fecha_hora" | "temperatura_c" | "humedad_pct" | "precipitacion_mm"
export type Direccion = "asc" | "desc"

export interface Orden {
  campo: CampoOrden
  direccion: Direccion
}

export const ORDEN_INICIAL: Orden = { campo: "fecha_hora", direccion: "asc" }

export const ETIQUETAS_CAMPO: Record<CampoOrden, string> = {
  ciudad: "Ciudad",
  fecha_hora: "Fecha y hora (UTC)",
  temperatura_c: "Temperatura (°C)",
  humedad_pct: "Humedad (%)",
  precipitacion_mm: "Precipitación (mm)",
}

function comparar(
  a: RegistroValido,
  b: RegistroValido,
  campo: CampoOrden
): number {
  const va = a[campo]
  const vb = b[campo]
  if (typeof va === "number" && typeof vb === "number") return va - vb
  // Las fechas normalizadas ISO-UTC se ordenan bien como texto.
  return String(va).localeCompare(String(vb), "es")
}

/**
 * Ordena sin modificar el array original. Los empates se resuelven por
 * ciudad y fecha para que el orden sea determinista y reproducible.
 */
export function ordenar(
  registros: RegistroValido[],
  orden: Orden
): RegistroValido[] {
  const signo = orden.direccion === "asc" ? 1 : -1
  return [...registros].sort(
    (a, b) =>
      signo * comparar(a, b, orden.campo) ||
      comparar(a, b, "ciudad") ||
      comparar(a, b, "fecha_hora")
  )
}

/** Paginación: SOLO afecta a lo que se muestra. */
export function paginar<T>(filas: T[], pagina: number, tamano: number): T[] {
  const inicio = (pagina - 1) * tamano
  return filas.slice(inicio, inicio + tamano)
}

export function totalPaginas(total: number, tamano: number): number {
  return Math.max(1, Math.ceil(total / tamano))
}

export interface ResumenSeleccion {
  /** Filas seleccionadas que cumplen los filtros, en el orden elegido. */
  paraCargar: RegistroValido[]
  /** Seleccionadas que ya no cumplen los filtros: no se subirán. */
  fueraDeFiltros: number
}

/** datos válidos → filtros → ordenación → selección. */
export function resumirSeleccion(
  ordenados: RegistroValido[],
  seleccion: ReadonlySet<string>
): ResumenSeleccion {
  const paraCargar = ordenados.filter((r) => seleccion.has(r.clave))
  return { paraCargar, fueraDeFiltros: seleccion.size - paraCargar.length }
}
