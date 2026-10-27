import { ciudadPorId, type CiudadId } from "./ciudades"
import {
  UNIDADES_ESPERADAS,
  VARIABLES_HORARIAS,
  type VariableHoraria,
} from "./extraccion"
import { interpretarFechaHoraUtc } from "./fechas"

/**
 * Registro tras convertir los arrays paralelos en filas.
 * Los valores de las mediciones se conservan TAL CUAL llegaron (null,
 * undefined, texto...). La fase de limpieza decide si son válidos; aquí
 * no se convierte nada en cero.
 */
export interface RegistroTransformado {
  /** Posición original: ciudad e índice dentro de los arrays. */
  origen: { ciudadId: CiudadId; indice: number }
  ciudad: string | null
  /** Fecha normalizada en UTC, o null si el valor original no era válido. */
  fecha_hora: string | null
  fecha_original: unknown
  temperatura_c: unknown
  humedad_pct: unknown
  precipitacion_mm: unknown
  /** Avisos estructurales que afectan a la fila (p. ej. arrays desalineados). */
  avisos: string[]
}

export interface ErrorEstructura {
  ciudadId: CiudadId
  mensaje: string
}

export interface ResultadoTransformacionCiudad {
  registros: RegistroTransformado[]
  errores: ErrorEstructura[]
  /** Longitud de cada array recibido, útil para explicar la transformación. */
  longitudes: Record<string, number | null>
}

export const AVISO_LONGITUDES = "longitudes_incoherentes"

function esObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}

/**
 * Convierte la respuesta de Open-Meteo de una ciudad (arrays paralelos)
 * en un registro por hora.
 */
export function transformarCiudad(
  ciudadId: CiudadId,
  json: unknown
): ResultadoTransformacionCiudad {
  const ciudad = ciudadPorId(ciudadId)
  const errores: ErrorEstructura[] = []
  const longitudes: Record<string, number | null> = {}
  const fallo = (mensaje: string): ResultadoTransformacionCiudad => ({
    registros: [],
    errores: [...errores, { ciudadId, mensaje }],
    longitudes,
  })

  if (!esObjeto(json)) return fallo("La respuesta no es un objeto JSON.")
  if (json.utc_offset_seconds !== 0) {
    return fallo(
      `Se esperaba UTC (utc_offset_seconds = 0) y se recibió ${JSON.stringify(json.utc_offset_seconds)}.`
    )
  }
  const hourly = json.hourly
  if (!esObjeto(hourly)) return fallo("Falta el bloque «hourly».")
  const unidades = esObjeto(json.hourly_units) ? json.hourly_units : {}

  for (const variable of VARIABLES_HORARIAS) {
    const unidad = unidades[variable]
    if (unidad !== UNIDADES_ESPERADAS[variable]) {
      return fallo(
        `Unidad inesperada para ${variable}: ${JSON.stringify(unidad)} (se esperaba «${UNIDADES_ESPERADAS[variable]}»).`
      )
    }
  }

  const tiempos = hourly.time
  if (!Array.isArray(tiempos)) return fallo("Falta el array «hourly.time».")
  longitudes.time = tiempos.length

  const arrays = {} as Record<VariableHoraria, unknown[] | null>
  for (const variable of VARIABLES_HORARIAS) {
    const valor = hourly[variable]
    arrays[variable] = Array.isArray(valor) ? valor : null
    longitudes[variable] = Array.isArray(valor) ? valor.length : null
  }

  const longitudesValidas = Object.values(longitudes).filter(
    (n): n is number => n !== null
  )
  const coherentes =
    Object.values(longitudes).every((n) => n !== null) &&
    longitudesValidas.every((n) => n === tiempos.length)
  const avisos: string[] = []
  if (!coherentes) {
    const detalle = Object.entries(longitudes)
      .map(([k, n]) => `${k}=${n ?? "ausente"}`)
      .join(", ")
    errores.push({
      ciudadId,
      mensaje: `Arrays de longitud incoherente (${detalle}). No se puede garantizar qué valor corresponde a cada hora; todas sus filas se rechazarán en la limpieza.`,
    })
    avisos.push(AVISO_LONGITUDES)
  }

  // Se recorren todas las posiciones existentes para que ninguna fila
  // desaparezca en silencio: las sobrantes se rechazarán con su motivo.
  const total = Math.max(tiempos.length, ...longitudesValidas)
  const registros: RegistroTransformado[] = []
  for (let i = 0; i < total; i++) {
    const fechaOriginal = i < tiempos.length ? tiempos[i] : undefined
    registros.push({
      origen: { ciudadId, indice: i },
      ciudad: ciudad.nombre,
      fecha_hora: interpretarFechaHoraUtc(fechaOriginal),
      fecha_original: fechaOriginal,
      temperatura_c: valorEn(arrays.temperature_2m, i),
      humedad_pct: valorEn(arrays.relative_humidity_2m, i),
      precipitacion_mm: valorEn(arrays.precipitation, i),
      avisos: [...avisos],
    })
  }

  return { registros, errores, longitudes }
}

/** Devuelve undefined (ausente) si el array no existe o es más corto. */
function valorEn(array: unknown[] | null, i: number): unknown {
  if (!array || i >= array.length) return undefined
  return array[i]
}

export interface EntradaTransformacion {
  ciudadId: CiudadId
  json: unknown
}

export interface ResultadoTransformacion {
  registros: RegistroTransformado[]
  errores: ErrorEstructura[]
  porCiudad: Partial<
    Record<
      CiudadId,
      { registros: number; longitudes: Record<string, number | null> }
    >
  >
}

export function transformar(
  entradas: EntradaTransformacion[]
): ResultadoTransformacion {
  const registros: RegistroTransformado[] = []
  const errores: ErrorEstructura[] = []
  const porCiudad: ResultadoTransformacion["porCiudad"] = {}
  for (const entrada of entradas) {
    const r = transformarCiudad(entrada.ciudadId, entrada.json)
    registros.push(...r.registros)
    errores.push(...r.errores)
    porCiudad[entrada.ciudadId] = {
      registros: r.registros.length,
      longitudes: r.longitudes,
    }
  }
  return { registros, errores, porCiudad }
}
