import { MAX_BYTES_PETICION, validarPeticionClaves } from "@/lib/etl/carga"
import { normalizarIso } from "@/lib/etl/fechas"
import { claveRegistro } from "@/lib/etl/validacion"
import {
  leerJsonLimitado,
  prepararSupabase,
  registrarError,
  respuestaError,
  TABLA_MEDICIONES,
} from "@/lib/supabase/servidor"

const PAGINA = 1000

/**
 * Recibe hasta 500 claves (ciudad, fecha_hora) y devuelve las que existen
 * en destino. Por cada ciudad consulta el intervalo [mín, máx] de fechas y
 * compara en memoria, paginando para no depender del límite de filas.
 */
export async function POST(request: Request) {
  const preparado = prepararSupabase()
  if (!preparado.ok) return preparado.respuesta

  const lectura = await leerJsonLimitado(request, MAX_BYTES_PETICION)
  if (!lectura.ok) return lectura.respuesta

  const validacion = validarPeticionClaves(lectura.cuerpo)
  if (!validacion.ok) return respuestaError(validacion.mensaje, 400)

  const porCiudad = new Map<string, string[]>()
  for (const c of validacion.datos) {
    porCiudad.set(c.ciudad, [...(porCiudad.get(c.ciudad) ?? []), c.fecha_hora])
  }

  const encontradas: string[] = []
  for (const [ciudad, fechas] of porCiudad) {
    const buscadas = new Set(fechas)
    const ordenadas = [...fechas].sort()
    for (let desde = 0; ; desde += PAGINA) {
      const { data, error } = await preparado.supabase
        .from(TABLA_MEDICIONES)
        .select("fecha_hora")
        .eq("ciudad", ciudad)
        .gte("fecha_hora", ordenadas[0])
        .lte("fecha_hora", ordenadas[ordenadas.length - 1])
        .order("fecha_hora", { ascending: true })
        .range(desde, desde + PAGINA - 1)
      if (error) {
        registrarError("verificacion", error)
        return respuestaError(`Error al verificar: ${error.message}`, 502)
      }
      for (const fila of data ?? []) {
        const iso = normalizarIso(new Date(fila.fecha_hora as string))
        if (buscadas.has(iso)) encontradas.push(claveRegistro(ciudad, iso))
      }
      if (!data || data.length < PAGINA) break
    }
  }

  return Response.json({ ok: true, encontradas })
}
