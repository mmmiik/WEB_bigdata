import { MAX_BYTES_PETICION, validarPeticionCarga } from "@/lib/etl/carga"
import {
  leerJsonLimitado,
  prepararSupabase,
  registrarError,
  respuestaError,
  TABLA_MEDICIONES,
} from "@/lib/supabase/servidor"

/**
 * Recibe UN lote (≤ 500 filas), lo vuelve a validar y hace upsert por
 * (ciudad, fecha_hora). La sentencia es atómica: o se escriben todas las
 * filas del lote o ninguna.
 */
export async function POST(request: Request) {
  const preparado = prepararSupabase()
  if (!preparado.ok) return preparado.respuesta

  const lectura = await leerJsonLimitado(request, MAX_BYTES_PETICION)
  if (!lectura.ok) return lectura.respuesta

  const validacion = validarPeticionCarga(lectura.cuerpo)
  if (!validacion.ok) {
    return respuestaError(validacion.mensaje, 400, {
      errores: validacion.errores,
    })
  }

  const { count, error, status } = await preparado.supabase
    .from(TABLA_MEDICIONES)
    .upsert(validacion.datos, {
      onConflict: "ciudad,fecha_hora",
      ignoreDuplicates: false,
      count: "exact",
    })

  if (error) {
    registrarError("carga", error)
    return respuestaError(
      `Supabase rechazó el lote: ${error.message || "error desconocido"}`,
      502,
      { codigo: error.code }
    )
  }

  // PostgREST devuelve el número de filas afectadas (insertadas + actualizadas)
  // pero no permite distinguir unas de otras: no se inventa ese desglose.
  return Response.json({
    ok: true,
    enviados: validacion.datos.length,
    confirmados: count ?? validacion.datos.length,
    recuentoDeSupabase: count !== null,
    status,
  })
}
