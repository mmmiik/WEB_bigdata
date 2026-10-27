import type { NextRequest } from "next/server"

import { NOMBRES_CIUDADES } from "@/lib/etl/ciudades"
import { fechaAMs, sumarDias } from "@/lib/etl/fechas"
import {
  prepararSupabase,
  registrarError,
  respuestaError,
  TABLA_MEDICIONES,
} from "@/lib/supabase/servidor"

const CAMPOS_ORDEN = [
  "fecha_hora",
  "ciudad",
  "temperatura_c",
  "humedad_pct",
  "precipitacion_mm",
  "importado_en",
] as const
const TAMANOS = [25, 50, 100]

/** Lectura paginada de lo que realmente está almacenado en Supabase. */
export async function GET(request: NextRequest) {
  const preparado = prepararSupabase()
  if (!preparado.ok) return preparado.respuesta

  const p = request.nextUrl.searchParams
  const ciudades = p.getAll("ciudad")
  if (ciudades.some((c) => !NOMBRES_CIUDADES.includes(c))) {
    return respuestaError("Ciudad no admitida.", 400)
  }
  const desde = p.get("desde") ?? ""
  const hasta = p.get("hasta") ?? ""
  if (
    (desde && fechaAMs(desde) === null) ||
    (hasta && fechaAMs(hasta) === null)
  ) {
    return respuestaError("Las fechas deben tener formato AAAA-MM-DD.", 400)
  }
  const orden = (p.get("orden") ??
    "fecha_hora") as (typeof CAMPOS_ORDEN)[number]
  if (!CAMPOS_ORDEN.includes(orden))
    return respuestaError("Orden no válido.", 400)
  const ascendente = p.get("dir") !== "desc"
  const tamano = Number(p.get("tamano") ?? 25)
  const pagina = Math.max(1, Math.floor(Number(p.get("pagina") ?? 1)) || 1)
  if (!TAMANOS.includes(tamano))
    return respuestaError("Tamaño de página no válido.", 400)

  let consulta = preparado.supabase
    .from(TABLA_MEDICIONES)
    .select(
      "id, ciudad, fecha_hora, temperatura_c, humedad_pct, precipitacion_mm, importado_en",
      { count: "exact" }
    )
  if (ciudades.length > 0) consulta = consulta.in("ciudad", ciudades)
  if (desde) consulta = consulta.gte("fecha_hora", `${desde}T00:00:00Z`)
  if (hasta)
    consulta = consulta.lt("fecha_hora", `${sumarDias(hasta, 1)}T00:00:00Z`)

  const inicio = (pagina - 1) * tamano
  const { data, count, error } = await consulta
    .order(orden, { ascending: ascendente })
    .order("id", { ascending: true })
    .range(inicio, inicio + tamano - 1)

  if (error) {
    registrarError("mediciones", error)
    return respuestaError(`No se pudo leer Supabase: ${error.message}`, 502)
  }
  return Response.json({
    ok: true,
    filas: data ?? [],
    total: count ?? 0,
    pagina,
    tamano,
  })
}
