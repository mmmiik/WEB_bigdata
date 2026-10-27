import { NOMBRES_CIUDADES } from "./ciudades"
import { interpretarFechaHoraUtc } from "./fechas"
import type { RegistroValido } from "./limpieza"
import { claveRegistro, validarCiudad, validarMediciones } from "./validacion"

export const TAMANO_LOTE = 500
/** Límite de tamaño del cuerpo de una petición de carga (bytes). */
export const MAX_BYTES_PETICION = 256 * 1024

/** Fila tal como se envía a la tabla mediciones_meteorologicas. */
export interface RegistroCarga {
  ciudad: string
  fecha_hora: string
  temperatura_c: number
  humedad_pct: number
  precipitacion_mm: number
}

export interface ClaveMedicion {
  ciudad: string
  fecha_hora: string
}

export function aRegistroCarga(r: RegistroValido): RegistroCarga {
  return {
    ciudad: r.ciudad,
    fecha_hora: r.fecha_hora,
    temperatura_c: r.temperatura_c,
    humedad_pct: r.humedad_pct,
    precipitacion_mm: r.precipitacion_mm,
  }
}

export function dividirEnLotes<T>(
  filas: readonly T[],
  tamano = TAMANO_LOTE
): T[][] {
  const lotes: T[][] = []
  for (let i = 0; i < filas.length; i += tamano) {
    lotes.push(filas.slice(i, i + tamano))
  }
  return lotes
}

// ---------------------------------------------------------------------------
// Validación en servidor (también se usa en las pruebas)
// ---------------------------------------------------------------------------

const CAMPOS_CARGA = [
  "ciudad",
  "fecha_hora",
  "temperatura_c",
  "humedad_pct",
  "precipitacion_mm",
] as const

export interface ErrorFila {
  indice: number
  mensaje: string
}

export type ResultadoValidacion<T> =
  { ok: true; datos: T } | { ok: false; errores: ErrorFila[]; mensaje: string }

function esObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}

/** Valida el cuerpo { registros: [...] } recibido por el endpoint de carga. */
export function validarPeticionCarga(
  cuerpo: unknown
): ResultadoValidacion<RegistroCarga[]> {
  if (!esObjeto(cuerpo) || !Array.isArray(cuerpo.registros)) {
    return {
      ok: false,
      errores: [],
      mensaje: "Se esperaba { registros: [...] }.",
    }
  }
  const lista = cuerpo.registros
  if (lista.length === 0 || lista.length > TAMANO_LOTE) {
    return {
      ok: false,
      errores: [],
      mensaje: `Cada lote debe tener entre 1 y ${TAMANO_LOTE} registros (recibidos: ${lista.length}).`,
    }
  }

  const errores: ErrorFila[] = []
  const datos: RegistroCarga[] = []
  const claves = new Set<string>()
  lista.forEach((fila, indice) => {
    if (!esObjeto(fila)) {
      errores.push({ indice, mensaje: "La fila no es un objeto." })
      return
    }
    const extra = Object.keys(fila).filter(
      (k) => !(CAMPOS_CARGA as readonly string[]).includes(k)
    )
    if (extra.length > 0) {
      errores.push({
        indice,
        mensaje: `Campos no permitidos: ${extra.join(", ")}.`,
      })
      return
    }
    const motivos = [
      ...validarCiudad(fila.ciudad),
      ...validarMediciones(
        fila.temperatura_c,
        fila.humedad_pct,
        fila.precipitacion_mm
      ),
    ].map((m) => m.detalle)
    if (
      typeof fila.ciudad === "string" &&
      !NOMBRES_CIUDADES.includes(fila.ciudad)
    ) {
      motivos.push(`Ciudad no admitida: «${fila.ciudad}».`)
    }
    // Se exige una fecha con zona UTC explícita (Z o +00:00).
    const fecha =
      typeof fila.fecha_hora === "string" &&
      /(Z|\+00:00)$/.test(fila.fecha_hora)
        ? interpretarFechaHoraUtc(fila.fecha_hora)
        : null
    if (fecha === null) motivos.push("fecha_hora debe ser ISO 8601 en UTC.")
    if (motivos.length > 0) {
      errores.push({ indice, mensaje: motivos.join(" ") })
      return
    }
    const clave = claveRegistro(fila.ciudad as string, fecha!)
    if (claves.has(clave)) {
      // PostgreSQL no permite que un mismo upsert afecte dos veces a la misma fila.
      errores.push({ indice, mensaje: `Clave duplicada en el lote: ${clave}.` })
      return
    }
    claves.add(clave)
    datos.push({
      ciudad: fila.ciudad as string,
      fecha_hora: fecha!,
      temperatura_c: fila.temperatura_c as number,
      humedad_pct: fila.humedad_pct as number,
      precipitacion_mm: fila.precipitacion_mm as number,
    })
  })

  if (errores.length > 0) {
    return {
      ok: false,
      errores: errores.slice(0, 20),
      mensaje: `${errores.length} fila(s) no superan la validación del servidor.`,
    }
  }
  return { ok: true, datos }
}

/** Valida el cuerpo { claves: [...] } del endpoint de verificación. */
export function validarPeticionClaves(
  cuerpo: unknown
): ResultadoValidacion<ClaveMedicion[]> {
  if (!esObjeto(cuerpo) || !Array.isArray(cuerpo.claves)) {
    return { ok: false, errores: [], mensaje: "Se esperaba { claves: [...] }." }
  }
  const lista = cuerpo.claves
  if (lista.length === 0 || lista.length > TAMANO_LOTE) {
    return {
      ok: false,
      errores: [],
      mensaje: `Cada consulta debe tener entre 1 y ${TAMANO_LOTE} claves.`,
    }
  }
  const datos: ClaveMedicion[] = []
  const errores: ErrorFila[] = []
  lista.forEach((c, indice) => {
    const fecha =
      esObjeto(c) && typeof c.fecha_hora === "string"
        ? interpretarFechaHoraUtc(c.fecha_hora)
        : null
    if (
      !esObjeto(c) ||
      typeof c.ciudad !== "string" ||
      !NOMBRES_CIUDADES.includes(c.ciudad) ||
      fecha === null
    ) {
      errores.push({ indice, mensaje: "Clave no válida." })
      return
    }
    datos.push({ ciudad: c.ciudad, fecha_hora: fecha })
  })
  if (errores.length > 0) {
    return {
      ok: false,
      errores: errores.slice(0, 20),
      mensaje: "Claves no válidas.",
    }
  }
  return { ok: true, datos }
}

// ---------------------------------------------------------------------------
// Orquestación de la carga por lotes (navegador)
// ---------------------------------------------------------------------------

export type EstadoLote = "pendiente" | "enviando" | "completado" | "error"

export interface Lote {
  numero: number
  registros: RegistroCarga[]
  estado: EstadoLote
  intentos: number
  error?: string
  /** Filas que Supabase confirma como escritas (insertadas o actualizadas). */
  confirmados?: number
  duracionMs?: number
}

export interface RespuestaEnvio {
  ok: boolean
  /** Filas afectadas según Supabase (no distingue insertadas de actualizadas). */
  confirmados?: number
  error?: string
}

export type EnviarLote = (registros: RegistroCarga[]) => Promise<RespuestaEnvio>

export function crearLotes(registros: readonly RegistroCarga[]): Lote[] {
  return dividirEnLotes(registros).map((r, i) => ({
    numero: i + 1,
    registros: r,
    estado: "pendiente",
    intentos: 0,
  }))
}

/**
 * Envía en serie los lotes que no estén completados. Un fallo no detiene
 * el resto ni modifica los lotes ya completados; basta con volver a llamar
 * a esta función para reintentar solo los fallidos. Gracias al upsert por
 * (ciudad, fecha_hora), reenviar un lote no crea duplicados.
 */
export async function ejecutarLotes(
  lotes: Lote[],
  enviar: EnviarLote,
  alActualizar: (lotes: Lote[]) => void,
  ahora: () => number = () => performance.now()
): Promise<Lote[]> {
  let estado = lotes.map((l) => ({ ...l }))
  const publicar = (indice: number, cambios: Partial<Lote>) => {
    estado = estado.map((l, i) => (i === indice ? { ...l, ...cambios } : l))
    alActualizar(estado)
  }

  for (let i = 0; i < estado.length; i++) {
    if (estado[i].estado === "completado") continue
    publicar(i, {
      estado: "enviando",
      error: undefined,
      intentos: estado[i].intentos + 1,
    })
    const t0 = ahora()
    let respuesta: RespuestaEnvio
    try {
      respuesta = await enviar(estado[i].registros)
    } catch (e) {
      respuesta = {
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      }
    }
    const duracionMs = ahora() - t0
    if (respuesta.ok) {
      publicar(i, {
        estado: "completado",
        confirmados: respuesta.confirmados,
        duracionMs,
      })
    } else {
      publicar(i, {
        estado: "error",
        error: respuesta.error ?? "Error desconocido.",
        duracionMs,
      })
    }
  }
  return estado
}

export interface ResumenCarga {
  totalRegistros: number
  lotes: number
  completados: number
  fallidos: number
  pendientes: number
  registrosCorrectos: number
  registrosFallidos: number
}

export function resumirCarga(lotes: Lote[]): ResumenCarga {
  const r: ResumenCarga = {
    totalRegistros: 0,
    lotes: lotes.length,
    completados: 0,
    fallidos: 0,
    pendientes: 0,
    registrosCorrectos: 0,
    registrosFallidos: 0,
  }
  for (const l of lotes) {
    r.totalRegistros += l.registros.length
    if (l.estado === "completado") {
      r.completados++
      r.registrosCorrectos += l.registros.length
    } else if (l.estado === "error") {
      r.fallidos++
      r.registrosFallidos += l.registros.length
    } else {
      r.pendientes++
    }
  }
  return r
}

export interface ResultadoVerificacion {
  comprobadas: number
  encontradas: number
  faltan: ClaveMedicion[]
  error?: string
}

/** Comprueba por lotes que las claves enviadas existen en destino. */
export async function verificarClaves(
  claves: readonly ClaveMedicion[],
  consultar: (lote: ClaveMedicion[]) => Promise<{ encontradas: string[] }>
): Promise<ResultadoVerificacion> {
  const faltan: ClaveMedicion[] = []
  let encontradas = 0
  for (const lote of dividirEnLotes(claves)) {
    let respuesta: { encontradas: string[] }
    try {
      respuesta = await consultar(lote)
    } catch (e) {
      return {
        comprobadas: encontradas + faltan.length,
        encontradas,
        faltan,
        error: e instanceof Error ? e.message : String(e),
      }
    }
    const set = new Set(respuesta.encontradas)
    for (const c of lote) {
      if (set.has(claveRegistro(c.ciudad, c.fecha_hora))) encontradas++
      else faltan.push(c)
    }
  }
  return { comprobadas: claves.length, encontradas, faltan }
}
