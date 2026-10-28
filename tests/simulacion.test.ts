import { describe, expect, it } from "vitest"

import { ciudadPorId } from "@/lib/etl/ciudades"
import { construirUrlArchivo, descargarCiudad } from "@/lib/etl/extraccion"
import { limpiar } from "@/lib/etl/limpieza"
import { fetchSimulado, respuestaSimulada } from "@/lib/etl/simulacion"
import { transformar } from "@/lib/etl/transformacion"

describe("modo simulado", () => {
  it("responde con la forma de Open-Meteo y pasa la transformación", async () => {
    const url = construirUrlArchivo(
      ciudadPorId("madrid"),
      "2026-09-01",
      "2026-09-01"
    )
    const r = await descargarCiudad(url, fetchSimulado)
    expect(r.ok).toBe(true)
    const { registros, errores } = transformar([
      { ciudadId: "madrid", json: r.json },
    ])
    expect(errores).toEqual([])
    expect(registros).toHaveLength(24)
    expect(limpiar(registros).rechazados).toHaveLength(0)
  })

  it("incluye filas defectuosas en Bilbao para ver los rechazos", () => {
    const url = construirUrlArchivo(
      ciudadPorId("bilbao"),
      "2026-09-01",
      "2026-09-30"
    )
    const { registros } = transformar([
      { ciudadId: "bilbao", json: respuestaSimulada(url) },
    ])
    expect(registros).toHaveLength(720)
    expect(limpiar(registros).rechazados).toHaveLength(3)
  })

  it("es determinista: la misma petición da los mismos datos", () => {
    const url = construirUrlArchivo(
      ciudadPorId("sevilla"),
      "2026-09-01",
      "2026-09-02"
    )
    expect(respuestaSimulada(url)).toEqual(respuestaSimulada(url))
  })
})
