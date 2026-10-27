import type { Ciudad, CiudadId } from "./ciudades"

export const URL_ARCHIVO_OPEN_METEO =
  "https://archive-api.open-meteo.com/v1/archive"
export const VARIABLES_HORARIAS = [
  "temperature_2m",
  "relative_humidity_2m",
  "precipitation",
] as const
export type VariableHoraria = (typeof VARIABLES_HORARIAS)[number]

/** Unidades que exigimos en la respuesta para aceptar los datos. */
export const UNIDADES_ESPERADAS: Record<VariableHoraria, string> = {
  temperature_2m: "°C",
  relative_humidity_2m: "%",
  precipitation: "mm",
}

export function construirUrlArchivo(
  ciudad: Ciudad,
  inicio: string,
  fin: string
): string {
  const params = new URLSearchParams({
    latitude: String(ciudad.latitud),
    longitude: String(ciudad.longitud),
    start_date: inicio,
    end_date: fin,
    hourly: VARIABLES_HORARIAS.join(","),
    timezone: "UTC",
    timeformat: "iso8601",
    temperature_unit: "celsius",
    precipitation_unit: "mm",
  })
  return `${URL_ARCHIVO_OPEN_METEO}?${params.toString()}`
}

export type EstadoExtraccion = "pendiente" | "en_curso" | "completada" | "error"

/** Resultado de descargar una ciudad. Se conserva el texto exacto recibido. */
export interface ExtraccionCiudad {
  ciudadId: CiudadId
  url: string
  estado: EstadoExtraccion
  error?: string
  /** Texto JSON exactamente como lo devolvió la API. */
  textoOriginal?: string
  /** El mismo JSON ya parseado. */
  json?: unknown
  duracionMs?: number
  descargadoEn?: string
  intentos: number
}

export interface ResultadoDescarga {
  ok: boolean
  textoOriginal?: string
  json?: unknown
  error?: string
}

/**
 * Descarga el JSON de una ciudad. No interpreta los datos: eso corresponde
 * a la fase de transformación. Sí detecta errores HTTP y JSON no válido.
 */
export async function descargarCiudad(
  url: string,
  fetcher: typeof fetch = fetch,
  signal?: AbortSignal
): Promise<ResultadoDescarga> {
  let respuesta: Response
  try {
    respuesta = await fetcher(url, { signal, cache: "no-store" })
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      return { ok: false, error: "Petición cancelada." }
    }
    return {
      ok: false,
      error: `No se pudo conectar con Open-Meteo: ${e instanceof Error ? e.message : String(e)}`,
    }
  }

  const texto = await respuesta.text()
  let json: unknown
  try {
    json = JSON.parse(texto)
  } catch {
    return {
      ok: false,
      textoOriginal: texto,
      error: `Respuesta HTTP ${respuesta.status} que no es JSON válido.`,
    }
  }

  if (!respuesta.ok) {
    const motivo =
      typeof json === "object" &&
      json !== null &&
      "reason" in json &&
      typeof json.reason === "string"
        ? json.reason
        : respuesta.statusText
    return {
      ok: false,
      textoOriginal: texto,
      json,
      error: `Open-Meteo respondió HTTP ${respuesta.status}: ${motivo}`,
    }
  }

  return { ok: true, textoOriginal: texto, json }
}
