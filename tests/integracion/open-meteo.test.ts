// Prueba de integración contra la API REAL de Open-Meteo (requiere red).
// Ejecutar con: npm run test:integracion
import { describe, expect, it } from "vitest"

import { ciudadPorId } from "@/lib/etl/ciudades"
import { construirUrlArchivo, descargarCiudad } from "@/lib/etl/extraccion"
import { limpiar } from "@/lib/etl/limpieza"
import { transformarCiudad } from "@/lib/etl/transformacion"

describe("Open-Meteo (real)", () => {
  it("una ciudad durante un día devuelve 24 registros horarios en UTC", async () => {
    const url = construirUrlArchivo(
      ciudadPorId("barcelona"),
      "2026-09-01",
      "2026-09-01"
    )
    const descarga = await descargarCiudad(url)
    expect(descarga.ok, descarga.error).toBe(true)

    const json = descarga.json as {
      utc_offset_seconds: number
      hourly: { time: string[] }
    }
    expect(json.utc_offset_seconds).toBe(0)
    expect(json.hourly.time).toHaveLength(24)

    const t = transformarCiudad("barcelona", descarga.json)
    expect(t.errores).toEqual([])
    expect(t.registros).toHaveLength(24)
    expect(t.registros.map((r) => r.fecha_hora)).toEqual(
      Array.from(
        { length: 24 },
        (_, h) => `2026-09-01T${String(h).padStart(2, "0")}:00:00Z`
      )
    )
    const { validos, rechazados } = limpiar(t.registros)
    console.log(
      `Barcelona 2026-09-01: ${validos.length} válidos, ${rechazados.length} rechazados`
    )
    expect(validos.length + rechazados.length).toBe(24)
  }, 30_000)

  it("devuelve un error legible ante un parámetro incorrecto", async () => {
    const url = construirUrlArchivo(
      ciudadPorId("madrid"),
      "2026-09-01",
      "2026-09-01"
    ).replace("precipitation", "variable_inexistente")
    const descarga = await descargarCiudad(url)
    expect(descarga.ok).toBe(false)
    expect(descarga.error).toMatch(/HTTP 400/)
  }, 30_000)
})
