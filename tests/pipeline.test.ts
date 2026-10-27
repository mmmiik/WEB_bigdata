import { describe, expect, it } from "vitest"

import { CIUDADES, ciudadPorId } from "@/lib/etl/ciudades"
import { construirUrlArchivo } from "@/lib/etl/extraccion"
import { interpretarFechaHoraUtc, validarPeriodo } from "@/lib/etl/fechas"
import { limpiar } from "@/lib/etl/limpieza"
import { transformar, transformarCiudad } from "@/lib/etl/transformacion"

import {
  conDuplicados,
  conNulos,
  desalineado,
  diaCompleto,
  respuestaFixture,
} from "./fixtures/open-meteo"

describe("extracción: petición a Open-Meteo", () => {
  it("pide UTC, °C, mm y las tres variables horarias", () => {
    const url = new URL(
      construirUrlArchivo(ciudadPorId("madrid"), "2026-09-01", "2026-09-30")
    )
    expect(url.origin + url.pathname).toBe(
      "https://archive-api.open-meteo.com/v1/archive"
    )
    expect(url.searchParams.get("latitude")).toBe("40.4168")
    expect(url.searchParams.get("longitude")).toBe("-3.7038")
    expect(url.searchParams.get("timezone")).toBe("UTC")
    expect(url.searchParams.get("temperature_unit")).toBe("celsius")
    expect(url.searchParams.get("precipitation_unit")).toBe("mm")
    expect(url.searchParams.get("hourly")).toBe(
      "temperature_2m,relative_humidity_2m,precipitation"
    )
  })

  it("valida el periodo: máximo 31 días, orden y fechas futuras", () => {
    const ahora = new Date("2026-10-26T12:00:00Z")
    expect(validarPeriodo("2026-09-01", "2026-09-30", ahora).dias).toBe(30)
    expect(validarPeriodo("2026-08-01", "2026-08-31", ahora).errores).toEqual(
      []
    )
    expect(
      validarPeriodo("2026-08-01", "2026-09-01", ahora).errores[0]
    ).toMatch(/32 días/)
    expect(
      validarPeriodo("2026-09-10", "2026-09-01", ahora).errores[0]
    ).toMatch(/anterior/)
    expect(
      validarPeriodo("2026-10-20", "2026-10-27", ahora).errores[0]
    ).toMatch(/posterior a hoy/)
    expect(
      validarPeriodo("2026-10-20", "2026-10-25", ahora).avisos
    ).toHaveLength(1)
    expect(
      validarPeriodo("2026-02-30", "2026-03-01", ahora).errores[0]
    ).toMatch(/no es válida/)
  })
})

describe("transformación: arrays paralelos → registros", () => {
  it("genera 24 registros de un día con la hora interpretada en UTC", () => {
    const { registros, errores } = transformarCiudad("barcelona", diaCompleto())
    expect(errores).toEqual([])
    expect(registros).toHaveLength(24)
    expect(registros[0]).toMatchObject({
      ciudad: "Barcelona",
      fecha_hora: "2026-09-01T00:00:00Z",
      temperatura_c: 20,
      humedad_pct: 50,
      precipitacion_mm: 0.4,
    })
    expect(registros[23].fecha_hora).toBe("2026-09-01T23:00:00Z")
    expect(registros[13]).toMatchObject({
      temperatura_c: 26.5,
      humedad_pct: 63,
    })
    // UTC explícito: no depende de la zona horaria del equipo.
    expect(Date.parse(registros[5].fecha_hora!)).toBe(Date.UTC(2026, 8, 1, 5))
  })

  it("interpreta fechas sin zona como UTC y rechaza fechas imposibles", () => {
    expect(interpretarFechaHoraUtc("2026-03-29T02:00")).toBe(
      "2026-03-29T02:00:00Z"
    )
    expect(interpretarFechaHoraUtc("2026-09-01T00:00Z")).toBe(
      "2026-09-01T00:00:00Z"
    )
    expect(interpretarFechaHoraUtc("2026-02-30T00:00")).toBeNull()
    expect(interpretarFechaHoraUtc("2026-09-01T24:00")).toBeNull()
    expect(interpretarFechaHoraUtc("")).toBeNull()
    expect(interpretarFechaHoraUtc(null)).toBeNull()
  })

  it("rechaza respuestas que no estén en UTC o con unidades inesperadas", () => {
    const noUtc = { ...diaCompleto(), utc_offset_seconds: 7200 }
    expect(transformarCiudad("madrid", noUtc).errores[0].mensaje).toMatch(/UTC/)
    const fahrenheit = {
      ...diaCompleto(),
      hourly_units: { ...diaCompleto().hourly_units, temperature_2m: "°F" },
    }
    expect(transformarCiudad("madrid", fahrenheit).errores[0].mensaje).toMatch(
      /°F/
    )
  })

  it("detecta arrays de longitud incoherente y rechaza todas sus filas", () => {
    const t = transformarCiudad("bilbao", desalineado)
    expect(t.errores[0].mensaje).toMatch(/relative_humidity_2m=2/)
    expect(t.registros).toHaveLength(3)
    const { validos, rechazados } = limpiar(t.registros)
    expect(validos).toHaveLength(0)
    expect(
      rechazados.every((r) =>
        r.motivos.some((m) => m.codigo === "longitudes_incoherentes")
      )
    ).toBe(true)
    // El valor que falta se mantiene como ausente, no como 0.
    expect(t.registros[2].humedad_pct).toBeUndefined()
  })
})

describe("limpieza", () => {
  it("no convierte null, cadenas vacías ni ausentes en cero y registra el motivo", () => {
    const t = transformarCiudad("sevilla", conNulos)
    const { validos, rechazados } = limpiar(t.registros)

    // Cada fila del fixture tiene exactamente un problema.
    expect(validos).toEqual([])
    expect(rechazados).toHaveLength(8)

    const motivosDe = (i: number) => rechazados[i].motivos.map((m) => m.codigo)
    expect(motivosDe(0)).toEqual(["temperatura_invalida"]) // null
    expect(rechazados[0].registro.temperatura_c).toBeNull() // sigue siendo null
    expect(rechazados[0].motivos[0].detalle).toBe("temperatura_c = null")
    expect(motivosDe(1)).toEqual(["humedad_invalida"]) // ""
    expect(rechazados[1].motivos[0].detalle).toBe("humedad_pct = cadena vacía")
    expect(motivosDe(2)).toEqual(["precipitacion_invalida"]) // null
    expect(motivosDe(3)).toEqual(["temperatura_invalida"]) // "17" (texto)
    expect(motivosDe(4)).toEqual(["humedad_fuera_de_rango"]) // 101
    expect(motivosDe(5)).toEqual(["precipitacion_negativa"]) // -0.1
    expect(motivosDe(6)).toEqual(["temperatura_invalida"]) // NaN
    expect(motivosDe(7)).toEqual(["fecha_invalida"]) // time null
  })

  it("no descarta temperaturas extremas", () => {
    const r = respuestaFixture({
      time: ["2026-01-01T00:00", "2026-07-01T00:00"],
      temperature_2m: [-45.3, 52.1],
      relative_humidity_2m: [0, 100],
      precipitation: [0, 0],
    })
    expect(
      limpiar(transformarCiudad("madrid", r).registros).validos
    ).toHaveLength(2)
  })

  it("elimina duplicados por ciudad + fecha_hora conservando la primera aparición", () => {
    const { validos, rechazados } = limpiar(
      transformarCiudad("valencia", conDuplicados).registros
    )
    expect(validos).toHaveLength(3)
    const una = validos.find((v) => v.fecha_hora === "2026-09-01T01:00:00Z")!
    expect(una.temperatura_c).toBe(21) // la primera, no la de 99 °C
    expect(rechazados).toHaveLength(1)
    expect(rechazados[0].motivos[0].codigo).toBe("duplicado")
    expect(rechazados[0].motivos[0].detalle).toMatch(/índice 1/)
  })

  it("la misma hora en ciudades distintas no es un duplicado", () => {
    const t = transformar([
      { ciudadId: "madrid", json: diaCompleto() },
      { ciudadId: "bilbao", json: diaCompleto() },
    ])
    const { validos, rechazados } = limpiar(t.registros)
    expect(validos).toHaveLength(48)
    expect(rechazados).toHaveLength(0)
  })

  it("procesa las cinco ciudades configuradas", () => {
    expect(CIUDADES.map((c) => c.nombre)).toEqual([
      "Barcelona",
      "Madrid",
      "Sevilla",
      "Bilbao",
      "Valencia",
    ])
  })
})
