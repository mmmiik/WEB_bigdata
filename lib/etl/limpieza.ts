import type { CiudadId } from "./ciudades"
import { AVISO_LONGITUDES, type RegistroTransformado } from "./transformacion"
import {
  claveRegistro,
  describirValor,
  validarCiudad,
  validarMediciones,
  type CodigoMotivo,
  type MotivoRechazo,
} from "./validacion"

/** Registro que ha superado todas las reglas de calidad. */
export interface RegistroValido {
  clave: string
  ciudad: string
  fecha_hora: string
  temperatura_c: number
  humedad_pct: number
  precipitacion_mm: number
  origen: { ciudadId: CiudadId; indice: number }
}

export interface RegistroRechazado {
  registro: RegistroTransformado
  motivos: MotivoRechazo[]
}

export interface ResultadoLimpieza {
  validos: RegistroValido[]
  rechazados: RegistroRechazado[]
  resumenMotivos: Partial<Record<CodigoMotivo, number>>
}

/**
 * Aplica las reglas de calidad a los registros transformados.
 *
 * Duplicados: la clave es (ciudad, fecha_hora). Se conserva la PRIMERA
 * aparición válida en el orden de extracción (orden de ciudades y, dentro
 * de cada ciudad, orden de los arrays). Las apariciones posteriores se
 * rechazan indicando qué fila se conservó. Una fila que ya era inválida
 * no "ocupa" la clave.
 */
export function limpiar(registros: RegistroTransformado[]): ResultadoLimpieza {
  const validos: RegistroValido[] = []
  const rechazados: RegistroRechazado[] = []
  const resumenMotivos: ResultadoLimpieza["resumenMotivos"] = {}
  const vistos = new Map<string, RegistroValido>()

  const rechazar = (
    registro: RegistroTransformado,
    motivos: MotivoRechazo[]
  ) => {
    rechazados.push({ registro, motivos })
    for (const m of motivos) {
      resumenMotivos[m.codigo] = (resumenMotivos[m.codigo] ?? 0) + 1
    }
  }

  for (const r of registros) {
    const motivos: MotivoRechazo[] = []

    if (r.avisos.includes(AVISO_LONGITUDES)) {
      motivos.push({
        codigo: "longitudes_incoherentes",
        detalle: "Los arrays de la respuesta no tienen la misma longitud.",
      })
    }
    motivos.push(...validarCiudad(r.ciudad))
    if (r.fecha_hora === null) {
      motivos.push({
        codigo: "fecha_invalida",
        detalle: `fecha original = ${describirValor(r.fecha_original)}`,
      })
    }
    motivos.push(
      ...validarMediciones(r.temperatura_c, r.humedad_pct, r.precipitacion_mm)
    )

    if (motivos.length > 0) {
      rechazar(r, motivos)
      continue
    }

    const ciudad = r.ciudad as string
    const fechaHora = r.fecha_hora as string
    const clave = claveRegistro(ciudad, fechaHora)
    const previo = vistos.get(clave)
    if (previo) {
      rechazar(r, [
        {
          codigo: "duplicado",
          detalle: `Ya existe ${ciudad} ${fechaHora}; se conserva la primera aparición (índice ${previo.origen.indice}).`,
        },
      ])
      continue
    }

    const valido: RegistroValido = {
      clave,
      ciudad,
      fecha_hora: fechaHora,
      temperatura_c: r.temperatura_c as number,
      humedad_pct: r.humedad_pct as number,
      precipitacion_mm: r.precipitacion_mm as number,
      origen: r.origen,
    }
    vistos.set(clave, valido)
    validos.push(valido)
  }

  return { validos, rechazados, resumenMotivos }
}
