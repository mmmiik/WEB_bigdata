// Utilidades de fechas. Todas las fechas del pipeline se tratan en UTC.

export const MAX_DIAS_EXTRACCION = 31
export const FECHA_MINIMA_ARCHIVO = "1940-01-01"
/** Open-Meteo publica algunos modelos con varios días de retraso. */
export const DIAS_RETRASO_ORIENTATIVO = 5

const MS_DIA = 86_400_000
const RE_FECHA = /^(\d{4})-(\d{2})-(\d{2})$/
const RE_FECHA_HORA =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]00:00)?$/

/** Convierte "AAAA-MM-DD" en milisegundos UTC, o null si no es una fecha real. */
export function fechaAMs(fecha: string): number | null {
  const m = RE_FECHA.exec(fecha)
  if (!m) return null
  const [a, mes, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const ms = Date.UTC(a, mes - 1, d)
  const f = new Date(ms)
  if (
    f.getUTCFullYear() !== a ||
    f.getUTCMonth() !== mes - 1 ||
    f.getUTCDate() !== d
  ) {
    return null
  }
  return ms
}

/** Días naturales incluidos entre dos fechas (ambas inclusive). */
export function diasInclusivos(inicio: string, fin: string): number | null {
  const a = fechaAMs(inicio)
  const b = fechaAMs(fin)
  if (a === null || b === null) return null
  return Math.round((b - a) / MS_DIA) + 1
}

export function hoyUtc(ahora: Date = new Date()): string {
  return ahora.toISOString().slice(0, 10)
}

export function sumarDias(fecha: string, dias: number): string {
  const ms = fechaAMs(fecha)
  if (ms === null) throw new Error(`Fecha no válida: ${fecha}`)
  return new Date(ms + dias * MS_DIA).toISOString().slice(0, 10)
}

export interface ValidacionPeriodo {
  errores: string[]
  avisos: string[]
  dias: number | null
}

export function validarPeriodo(
  inicio: string,
  fin: string,
  ahora: Date = new Date()
): ValidacionPeriodo {
  const errores: string[] = []
  const avisos: string[] = []
  const hoy = hoyUtc(ahora)

  if (!inicio) errores.push("Indica la fecha inicial.")
  else if (fechaAMs(inicio) === null)
    errores.push("La fecha inicial no es válida (formato AAAA-MM-DD).")
  if (!fin) errores.push("Indica la fecha final.")
  else if (fechaAMs(fin) === null)
    errores.push("La fecha final no es válida (formato AAAA-MM-DD).")
  if (errores.length > 0) return { errores, avisos, dias: null }

  const dias = diasInclusivos(inicio, fin)!
  if (dias < 1) {
    errores.push("La fecha final no puede ser anterior a la inicial.")
  } else if (dias > MAX_DIAS_EXTRACCION) {
    errores.push(
      `El periodo abarca ${dias} días; el máximo por extracción es ${MAX_DIAS_EXTRACCION}.`
    )
  }
  if (inicio < FECHA_MINIMA_ARCHIVO) {
    errores.push("El archivo histórico empieza el 1 de enero de 1940.")
  }
  if (fin > hoy) {
    errores.push(
      `La fecha final (${fin}) es posterior a hoy (${hoy} UTC): el archivo histórico solo contiene días pasados.`
    )
  } else if (fin > sumarDias(hoy, -DIAS_RETRASO_ORIENTATIVO)) {
    avisos.push(
      `Los últimos ${DIAS_RETRASO_ORIENTATIVO} días pueden llegar incompletos o con valores nulos por el retraso de publicación de algunos modelos.`
    )
  }

  return { errores, avisos, dias: errores.length === 0 ? dias : null }
}

/**
 * Interpreta la hora devuelta por Open-Meteo ("2026-09-01T00:00") como UTC
 * de forma explícita. Nunca se usa el constructor Date(texto) sin zona,
 * porque el navegador la interpretaría en hora local.
 * Devuelve la fecha normalizada "AAAA-MM-DDTHH:mm:ssZ" o null si no es válida.
 */
export function interpretarFechaHoraUtc(valor: unknown): string | null {
  if (typeof valor !== "string") return null
  const m = RE_FECHA_HORA.exec(valor.trim())
  if (!m) return null
  const [a, mes, d, h, min] = [m[1], m[2], m[3], m[4], m[5]].map(Number)
  const s = m[6] ? Number(m[6]) : 0
  const msFrac = m[7] ? Number(m[7].padEnd(3, "0")) : 0
  if (h > 23 || min > 59 || s > 59) return null
  const ms = Date.UTC(a, mes - 1, d, h, min, s, msFrac)
  const f = new Date(ms)
  if (
    f.getUTCFullYear() !== a ||
    f.getUTCMonth() !== mes - 1 ||
    f.getUTCDate() !== d
  ) {
    return null
  }
  return normalizarIso(f)
}

export function normalizarIso(fecha: Date): string {
  return fecha.toISOString().replace(/\.000Z$/, "Z")
}

/** "2026-09-01T00:00:00Z" → "2026-09-01 00:00 UTC" */
export function formatearFechaHoraUtc(iso: string): string {
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`
}
