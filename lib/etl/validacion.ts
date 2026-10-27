// Reglas de calidad compartidas por la limpieza (navegador) y por la
// validación del servidor antes de escribir en Supabase.

export type CodigoMotivo =
  | "sin_ciudad"
  | "fecha_invalida"
  | "temperatura_invalida"
  | "humedad_invalida"
  | "humedad_fuera_de_rango"
  | "precipitacion_invalida"
  | "precipitacion_negativa"
  | "longitudes_incoherentes"
  | "duplicado"

export interface MotivoRechazo {
  codigo: CodigoMotivo
  detalle: string
}

export const ETIQUETAS_MOTIVO: Record<CodigoMotivo, string> = {
  sin_ciudad: "Sin ciudad",
  fecha_invalida: "Fecha ausente o no válida",
  temperatura_invalida: "Temperatura ausente o no numérica",
  humedad_invalida: "Humedad ausente o no numérica",
  humedad_fuera_de_rango: "Humedad fuera de 0–100 %",
  precipitacion_invalida: "Precipitación ausente o no numérica",
  precipitacion_negativa: "Precipitación negativa",
  longitudes_incoherentes: "Arrays de longitud incoherente",
  duplicado: "Duplicado (ciudad + fecha_hora)",
}

/** Describe por qué un valor no es un número finito, sin transformarlo. */
export function describirValor(valor: unknown): string {
  if (valor === undefined) return "ausente"
  if (valor === null) return "null"
  if (typeof valor === "string") {
    return valor.trim() === "" ? "cadena vacía" : `texto «${valor}»`
  }
  if (typeof valor === "number") {
    if (Number.isNaN(valor)) return "NaN"
    if (!Number.isFinite(valor)) return String(valor)
    return String(valor)
  }
  return `tipo ${typeof valor}`
}

/** Solo se aceptan números JavaScript finitos. Un null NUNCA es cero. */
export function esNumeroFinito(valor: unknown): valor is number {
  return typeof valor === "number" && Number.isFinite(valor)
}

export function validarMediciones(
  temperatura: unknown,
  humedad: unknown,
  precipitacion: unknown
): MotivoRechazo[] {
  const motivos: MotivoRechazo[] = []

  // Temperatura: solo se exige que sea un número finito. No se aplican
  // umbrales arbitrarios: un valor extremo puede ser real.
  if (!esNumeroFinito(temperatura)) {
    motivos.push({
      codigo: "temperatura_invalida",
      detalle: `temperatura_c = ${describirValor(temperatura)}`,
    })
  }

  if (!esNumeroFinito(humedad)) {
    motivos.push({
      codigo: "humedad_invalida",
      detalle: `humedad_pct = ${describirValor(humedad)}`,
    })
  } else if (humedad < 0 || humedad > 100) {
    motivos.push({
      codigo: "humedad_fuera_de_rango",
      detalle: `humedad_pct = ${humedad} (debe estar entre 0 y 100)`,
    })
  }

  if (!esNumeroFinito(precipitacion)) {
    motivos.push({
      codigo: "precipitacion_invalida",
      detalle: `precipitacion_mm = ${describirValor(precipitacion)}`,
    })
  } else if (precipitacion < 0) {
    motivos.push({
      codigo: "precipitacion_negativa",
      detalle: `precipitacion_mm = ${precipitacion} (debe ser ≥ 0)`,
    })
  }

  return motivos
}

export function validarCiudad(ciudad: unknown): MotivoRechazo[] {
  if (typeof ciudad !== "string" || ciudad.trim() === "") {
    return [
      { codigo: "sin_ciudad", detalle: `ciudad = ${describirValor(ciudad)}` },
    ]
  }
  return []
}

export function claveRegistro(ciudad: string, fechaHora: string): string {
  return `${ciudad}|${fechaHora}`
}
