import { describe, expect, it } from "vitest"

import {
  aRegistroCarga,
  crearLotes,
  ejecutarLotes,
  resumirCarga,
  validarPeticionCarga,
  verificarClaves,
  type EnviarLote,
  type RegistroCarga,
} from "@/lib/etl/carga"
import {
  FILTROS_INICIALES,
  filtrar,
  interpretarFiltros,
  ordenar,
  paginar,
  resumirSeleccion,
} from "@/lib/etl/filtros"
import { limpiar, type RegistroValido } from "@/lib/etl/limpieza"
import { transformar } from "@/lib/etl/transformacion"
import { claveRegistro } from "@/lib/etl/validacion"

import { diaCompleto, respuestaFixture } from "./fixtures/open-meteo"

/** 3 ciudades × 10 días × 24 h = 720 registros válidos (fixture). */
function validosFixture(): RegistroValido[] {
  const entradas = (["barcelona", "madrid", "sevilla"] as const).flatMap(
    (ciudadId, c) =>
      Array.from({ length: 10 }, (_, d) => {
        const dia = diaCompleto(`2026-09-${String(d + 1).padStart(2, "0")}`)
        const h = dia.hourly
        return {
          ciudadId,
          json: respuestaFixture({
            ...h,
            temperature_2m: (h.temperature_2m as number[]).map(
              (t, i) => t + c * 3 + d * 0.1 + i * 0.01
            ),
          }),
        }
      })
  )
  return limpiar(transformar(entradas).registros).validos
}

/** Destino simulado con la misma semántica que la restricción única + upsert. */
function destinoSimulado() {
  const filas = new Map<string, RegistroCarga>()
  const enviados: RegistroCarga[][] = []
  const enviar: EnviarLote = async (lote) => {
    enviados.push(lote)
    for (const r of lote) filas.set(claveRegistro(r.ciudad, r.fecha_hora), r)
    return { ok: true, confirmados: lote.length }
  }
  return { filas, enviados, enviar }
}

describe("filtros y ordenación antes de paginar", () => {
  it("filtra y ordena el conjunto completo; la página solo recorta", () => {
    const validos = validosFixture()
    expect(validos).toHaveLength(720)
    const { criterios } = interpretarFiltros({
      ...FILTROS_INICIALES,
      ciudades: ["Madrid", "Sevilla"],
      temperaturaMin: "25",
    })
    const filtrados = filtrar(validos, criterios)
    const ordenados = ordenar(filtrados, {
      campo: "temperatura_c",
      direccion: "desc",
    })
    const pagina1 = paginar(ordenados, 1, 25)

    const maximo = Math.max(...filtrados.map((r) => r.temperatura_c))
    expect(pagina1[0].temperatura_c).toBe(maximo)
    expect(pagina1).toHaveLength(25)
    expect(
      filtrados.every((r) => r.ciudad !== "Barcelona" && r.temperatura_c >= 25)
    ).toBe(true)
    // El máximo global no estaba en la primera página sin ordenar.
    expect(
      paginar(filtrados, 1, 25).some((r) => r.temperatura_c === maximo)
    ).toBe(false)
  })

  it("intervalo de fechas UTC inclusivo y 'solo lluvia' (> 0)", () => {
    const validos = validosFixture()
    const { criterios, errores } = interpretarFiltros({
      ...FILTROS_INICIALES,
      ciudades: ["Barcelona"],
      desde: "2026-09-02T00:00",
      hasta: "2026-09-02T23:00",
      soloLluvia: true,
    })
    expect(errores).toEqual([])
    const r = filtrar(validos, criterios)
    expect(r.map((x) => x.fecha_hora.slice(11, 13))).toEqual([
      "00",
      "06",
      "12",
      "18",
    ])
    expect(r.every((x) => x.precipitacion_mm > 0)).toBe(true)
  })

  it("informa de filtros mal escritos o incoherentes", () => {
    const { errores } = interpretarFiltros({
      ...FILTROS_INICIALES,
      humedadMin: "80",
      humedadMax: "20",
      precipitacionMin: "abc",
    })
    expect(errores).toHaveLength(2)
  })
})

describe("selección entre páginas", () => {
  it("seleccionar todo lo filtrado incluye filas de otras páginas", () => {
    const validos = validosFixture()
    const { criterios } = interpretarFiltros({
      ...FILTROS_INICIALES,
      ciudades: ["Sevilla"],
    })
    const ordenados = ordenar(filtrar(validos, criterios), {
      campo: "fecha_hora",
      direccion: "asc",
    })
    const seleccion = new Set(ordenados.map((r) => r.clave))
    const { paraCargar, fueraDeFiltros } = resumirSeleccion(
      ordenados,
      seleccion
    )
    expect(paraCargar).toHaveLength(240)
    expect(
      paginar(ordenados, 10, 25).every((r) => seleccion.has(r.clave))
    ).toBe(true)
    expect(fueraDeFiltros).toBe(0)
  })

  it("cambiar filtros no selecciona nuevas filas y cuenta las seleccionadas que quedan fuera", () => {
    const validos = validosFixture()
    const seleccion = new Set<string>()
    // Selecciono a mano 2 filas de la página 1 y 1 de la página 3 (Madrid).
    const madrid = ordenar(
      filtrar(
        validos,
        interpretarFiltros({ ...FILTROS_INICIALES, ciudades: ["Madrid"] })
          .criterios
      ),
      { campo: "fecha_hora", direccion: "asc" }
    )
    seleccion.add(paginar(madrid, 1, 25)[0].clave)
    seleccion.add(paginar(madrid, 1, 25)[1].clave)
    seleccion.add(paginar(madrid, 3, 25)[4].clave)

    // Nuevo filtro: solo la primera hora del día 1 → solo una seleccionada sigue dentro.
    const filtro2 = interpretarFiltros({
      ...FILTROS_INICIALES,
      ciudades: ["Madrid", "Sevilla"],
      hasta: "2026-09-01T00:00",
    }).criterios
    const ordenados2 = ordenar(filtrar(validos, filtro2), {
      campo: "ciudad",
      direccion: "desc",
    })
    const { paraCargar, fueraDeFiltros } = resumirSeleccion(
      ordenados2,
      seleccion
    )
    expect(ordenados2).toHaveLength(2) // coinciden 2 (Madrid y Sevilla 00:00)
    expect(paraCargar.map((r) => r.ciudad)).toEqual(["Madrid"]) // Sevilla no se autoselecciona
    expect(fueraDeFiltros).toBe(2)
  })
})

describe("carga por lotes", () => {
  it("la vista previa coincide exactamente con lo enviado (contenido y orden)", async () => {
    const validos = validosFixture()
    const ordenados = ordenar(validos, {
      campo: "humedad_pct",
      direccion: "desc",
    })
    const seleccion = new Set(
      ordenados.filter((_, i) => i % 3 !== 0).map((r) => r.clave)
    )
    const vistaPrevia = resumirSeleccion(ordenados, seleccion).paraCargar.map(
      aRegistroCarga
    )

    const destino = destinoSimulado()
    const lotes = crearLotes(vistaPrevia)
    expect(lotes.map((l) => l.registros.length)).toEqual([480])
    await ejecutarLotes(lotes, destino.enviar, () => {})
    expect(destino.enviados.flat()).toEqual(vistaPrevia)
  })

  it("divide en lotes de 500 como máximo", () => {
    const filas = validosFixture().map(aRegistroCarga)
    expect(
      crearLotes([...filas, ...filas]).map((l) => l.registros.length)
    ).toEqual([500, 500, 440])
  })

  it("una segunda carga de los mismos registros no crea duplicados (upsert)", async () => {
    const filas = validosFixture().map(aRegistroCarga)
    const destino = destinoSimulado()
    await ejecutarLotes(crearLotes(filas), destino.enviar, () => {})
    await ejecutarLotes(crearLotes(filas), destino.enviar, () => {})
    expect(destino.filas.size).toBe(720)
  })

  it("si falla un lote conserva los anteriores y reintenta solo los fallidos", async () => {
    const otroAno = validosFixture().map((r) => ({
      ...r,
      fecha_hora: r.fecha_hora.replace("2026-", "2025-"),
    }))
    const filas = [...validosFixture(), ...otroAno].map(aRegistroCarga) // 1440 → 500, 500, 440
    const destino = destinoSimulado()
    let fallar = true
    const enviar: EnviarLote = async (lote) => {
      if (lote === lotesIniciales[1].registros && fallar) {
        fallar = false
        return { ok: false, error: "HTTP 502: tiempo de espera agotado" }
      }
      return destino.enviar(lote)
    }
    const lotesIniciales = crearLotes(filas)
    const actualizaciones: string[][] = []
    const tras1 = await ejecutarLotes(lotesIniciales, enviar, (l) =>
      actualizaciones.push(l.map((x) => x.estado))
    )
    expect(tras1.map((l) => l.estado)).toEqual([
      "completado",
      "error",
      "completado",
    ])
    expect(tras1[1].error).toMatch(/502/)
    expect(resumirCarga(tras1)).toMatchObject({
      registrosCorrectos: 940,
      registrosFallidos: 500,
    })
    expect(destino.filas.size).toBe(940)
    // Mientras se enviaba el lote 2, el lote 1 ya figuraba como completado.
    expect(actualizaciones).toContainEqual([
      "completado",
      "enviando",
      "pendiente",
    ])

    const enviadosAntes = destino.enviados.length
    const tras2 = await ejecutarLotes(tras1, enviar, () => {})
    expect(destino.enviados.length - enviadosAntes).toBe(1) // solo el lote fallido
    expect(tras2.every((l) => l.estado === "completado")).toBe(true)
    expect(tras2[1].intentos).toBe(2)
    expect(destino.filas.size).toBe(1440)
  })

  it("verifica por lotes las claves en destino e informa de las que faltan", async () => {
    const filas = validosFixture().map(aRegistroCarga)
    const destino = destinoSimulado()
    await destino.enviar(filas.slice(0, 700))
    const consultas: number[] = []
    const r = await verificarClaves(filas, async (lote) => {
      consultas.push(lote.length)
      return {
        encontradas: lote
          .map((c) => claveRegistro(c.ciudad, c.fecha_hora))
          .filter((k) => destino.filas.has(k)),
      }
    })
    expect(consultas).toEqual([500, 220])
    expect(r).toMatchObject({ comprobadas: 720, encontradas: 700 })
    expect(r.faltan).toHaveLength(20)
  })
})

describe("validación en servidor", () => {
  const fila = {
    ciudad: "Madrid",
    fecha_hora: "2026-09-01T00:00:00Z",
    temperatura_c: 21.3,
    humedad_pct: 55,
    precipitacion_mm: 0,
  }

  it("acepta un lote correcto", () => {
    expect(validarPeticionCarga({ registros: [fila] }).ok).toBe(true)
  })

  it("rechaza nulos, rangos, fechas sin zona, campos extra, ciudades desconocidas y duplicados", () => {
    const casos = [
      { ...fila, temperatura_c: null },
      { ...fila, humedad_pct: 120 },
      { ...fila, precipitacion_mm: -1 },
      { ...fila, fecha_hora: "2026-09-01T00:00" },
      { ...fila, id: 5 },
      { ...fila, ciudad: "Tokio" },
    ]
    for (const c of casos) {
      expect(
        validarPeticionCarga({ registros: [c] }).ok,
        JSON.stringify(c)
      ).toBe(false)
    }
    expect(validarPeticionCarga({ registros: [fila, fila] }).ok).toBe(false)
  })

  it("rechaza lotes vacíos o de más de 500 filas", () => {
    expect(validarPeticionCarga({ registros: [] }).ok).toBe(false)
    const muchas = Array.from({ length: 501 }, (_, i) => ({
      ...fila,
      fecha_hora: new Date(Date.UTC(2026, 0, 1, i)).toISOString(),
    }))
    expect(validarPeticionCarga({ registros: muchas }).ok).toBe(false)
    expect(validarPeticionCarga({ registros: muchas.slice(0, 500) }).ok).toBe(
      true
    )
  })
})
