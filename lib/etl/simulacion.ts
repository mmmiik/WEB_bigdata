// MODO SIMULADO: solo para ver la interfaz sin depender de Open-Meteo (p. ej.
// cuando la API limita las peticiones). Se activa a mano con «?simulado» en la
// URL, la interfaz lo indica y la subida a Supabase queda bloqueada: estos
// datos no son reales y nunca deben llegar a la base de datos.

import { UNIDADES_ESPERADAS } from "@/lib/etl/extraccion"

/** Generador pseudoaleatorio con semilla: la misma ciudad da siempre lo mismo. */
function aleatorio(semilla: number) {
  let x = Math.floor(Math.abs(semilla) * 1e4) || 1
  return () => {
    x = (x * 16807) % 2147483647
    return x / 2147483647
  }
}

const redondear = (v: number) => Math.round(v * 10) / 10

/** Respuesta con la misma forma que la de Open-Meteo para una URL de archivo. */
export function respuestaSimulada(url: string) {
  const p = new URL(url).searchParams
  const latitud = Number(p.get("latitude"))
  const longitud = Number(p.get("longitude"))
  const inicio = Date.parse(`${p.get("start_date")}T00:00:00Z`)
  const fin = Date.parse(`${p.get("end_date")}T23:00:00Z`)
  const azar = aleatorio(latitud * longitud)

  const time: string[] = []
  for (let t = inicio; t <= fin; t += 3_600_000)
    time.push(new Date(t).toISOString().slice(0, 16))

  // Más fresco al norte, ciclo diario con mínimo al amanecer y algo de ruido.
  const base = 33 - (latitud - 36) * 1.4
  const temperature_2m: (number | null)[] = time.map((_, i) => {
    const hora = i % 24
    return redondear(
      base + 6 * Math.sin(((hora - 9) / 24) * 2 * Math.PI) + (azar() - 0.5) * 3
    )
  })
  const relative_humidity_2m: (number | null)[] = temperature_2m.map((t) =>
    Math.round(Math.min(100, Math.max(15, 120 - (t ?? 20) * 2.6 + azar() * 12)))
  )
  const precipitation: (number | null)[] = time.map(() =>
    azar() < 0.06 ? redondear(azar() * 4) : 0
  )

  // Unas pocas filas defectuosas para que la limpieza tenga qué rechazar.
  if (latitud > 43 && time.length > 30) {
    temperature_2m[5] = null
    relative_humidity_2m[17] = 104
    precipitation[29] = null
  }

  return {
    latitude: latitud,
    longitude: longitud,
    generationtime_ms: 0,
    utc_offset_seconds: 0,
    timezone: "GMT",
    timezone_abbreviation: "GMT",
    elevation: 0,
    hourly_units: { time: "iso8601", ...UNIDADES_ESPERADAS },
    hourly: { time, temperature_2m, relative_humidity_2m, precipitation },
  }
}

/** Sustituto de fetch: responde como Open-Meteo tras una pequeña espera. */
export const fetchSimulado: typeof fetch = async (entrada) => {
  const url = entrada instanceof Request ? entrada.url : String(entrada)
  await new Promise((r) => setTimeout(r, 150 + Math.random() * 250))
  return new Response(JSON.stringify(respuestaSimulada(url)), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })
}
