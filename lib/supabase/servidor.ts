import "server-only"

import { createClient, type SupabaseClient } from "@supabase/supabase-js"

export const TABLA_MEDICIONES = "mediciones_meteorologicas"

/** Variables necesarias. Ninguna lleva prefijo NEXT_PUBLIC_: nunca llegan al navegador. */
export const VARIABLES_SUPABASE = [
  "SUPABASE_URL",
  "SUPABASE_SECRET_KEY",
] as const

export function variablesFaltantes(): string[] {
  return VARIABLES_SUPABASE.filter((v) => !process.env[v]?.trim())
}

let cliente: SupabaseClient | null = null

/**
 * Cliente con clave secreta (rol service_role). Solo se crea en servidor.
 * Devuelve null si faltan variables de entorno.
 */
export function clienteSupabaseServidor(): SupabaseClient | null {
  if (variablesFaltantes().length > 0) return null
  if (!cliente) {
    cliente = createClient(
      process.env.SUPABASE_URL!.trim(),
      process.env.SUPABASE_SECRET_KEY!.trim(),
      { auth: { persistSession: false, autoRefreshToken: false } }
    )
  }
  return cliente
}

/**
 * El proyecto no tiene autenticación. Los endpoints quedan abiertos en
 * desarrollo local; en producción se bloquean salvo que se active
 * explícitamente ETL_PERMITIR_SIN_AUTENTICACION=true (desaconsejado).
 */
export function accesoPermitido():
  { ok: true } | { ok: false; mensaje: string } {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.ETL_PERMITIR_SIN_AUTENTICACION !== "true"
  ) {
    return {
      ok: false,
      mensaje:
        "Endpoints de Supabase deshabilitados en producción: añade autenticación antes de publicar la aplicación.",
    }
  }
  return { ok: true }
}

/** Registra un error sin incluir credenciales ni cabeceras. */
export function registrarError(contexto: string, error: unknown) {
  const e = error as { code?: string; message?: string } | null
  console.error(`[${contexto}]`, e?.code ?? "", e?.message ?? String(error))
}

export function respuestaError(
  mensaje: string,
  status: number,
  extra?: object
) {
  return Response.json({ ok: false, error: mensaje, ...extra }, { status })
}

/** Comprueba acceso y configuración; devuelve el cliente o una respuesta de error. */
export function prepararSupabase():
  { ok: true; supabase: SupabaseClient } | { ok: false; respuesta: Response } {
  const acceso = accesoPermitido()
  if (!acceso.ok)
    return { ok: false, respuesta: respuestaError(acceso.mensaje, 403) }
  const supabase = clienteSupabaseServidor()
  if (!supabase) {
    return {
      ok: false,
      respuesta: respuestaError(
        `Supabase no está configurado. Faltan: ${variablesFaltantes().join(", ")}.`,
        503,
        { faltan: variablesFaltantes() }
      ),
    }
  }
  return { ok: true, supabase }
}

/** Lee el cuerpo JSON respetando un tamaño máximo. */
export async function leerJsonLimitado(
  request: Request,
  maxBytes: number
): Promise<{ ok: true; cuerpo: unknown } | { ok: false; respuesta: Response }> {
  const declarado = Number(request.headers.get("content-length") ?? "0")
  if (declarado > maxBytes) {
    return {
      ok: false,
      respuesta: respuestaError(`La petición supera ${maxBytes} bytes.`, 413),
    }
  }
  const texto = await request.text()
  if (new TextEncoder().encode(texto).byteLength > maxBytes) {
    return {
      ok: false,
      respuesta: respuestaError(`La petición supera ${maxBytes} bytes.`, 413),
    }
  }
  try {
    return { ok: true, cuerpo: JSON.parse(texto) }
  } catch {
    return {
      ok: false,
      respuesta: respuestaError("El cuerpo no es JSON válido.", 400),
    }
  }
}
