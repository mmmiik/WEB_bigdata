import {
  accesoPermitido,
  clienteSupabaseServidor,
  registrarError,
  TABLA_MEDICIONES,
  variablesFaltantes,
} from "@/lib/supabase/servidor"

/** Indica si Supabase está configurado y la tabla es accesible. Nunca devuelve valores de variables. */
export async function GET() {
  const acceso = accesoPermitido()
  if (!acceso.ok) {
    return Response.json({
      configurado: false,
      tablaAccesible: false,
      error: acceso.mensaje,
    })
  }
  const faltan = variablesFaltantes()
  const supabase = clienteSupabaseServidor()
  if (!supabase) {
    return Response.json({ configurado: false, tablaAccesible: false, faltan })
  }
  const { count, error } = await supabase
    .from(TABLA_MEDICIONES)
    .select("id", { count: "exact", head: true })
  if (error) {
    registrarError("estado", error)
    return Response.json({
      configurado: true,
      tablaAccesible: false,
      faltan,
      error: `No se pudo leer la tabla ${TABLA_MEDICIONES}: ${error.message || "error desconocido"}. ¿Has aplicado la migración?`,
    })
  }
  return Response.json({
    configurado: true,
    tablaAccesible: true,
    faltan,
    filas: count,
  })
}
