// FIXTURES CONTROLADOS PARA PRUEBAS.
// No son datos reales y nunca se usan en la aplicación: solo los importan
// los tests para provocar casos (nulos, duplicados, arrays desalineados)
// que la API real rara vez devuelve.

const UNIDADES = {
  time: "iso8601",
  temperature_2m: "°C",
  relative_humidity_2m: "%",
  precipitation: "mm",
}

export function respuestaFixture(hourly: Record<string, unknown[]>) {
  return {
    latitude: 0,
    longitude: 0,
    utc_offset_seconds: 0,
    timezone: "GMT",
    timezone_abbreviation: "GMT",
    hourly_units: UNIDADES,
    hourly,
  }
}

/** 24 horas completas y correctas de un día. */
export function diaCompleto(fecha = "2026-09-01") {
  const time = Array.from(
    { length: 24 },
    (_, h) => `${fecha}T${String(h).padStart(2, "0")}:00`
  )
  return respuestaFixture({
    time,
    temperature_2m: time.map((_, h) => 20 + h / 2),
    relative_humidity_2m: time.map((_, h) => 50 + h),
    precipitation: time.map((_, h) => (h % 6 === 0 ? 0.4 : 0)),
  })
}

/** Valores ausentes o mal formados: ninguno debe convertirse en 0. */
export const conNulos = respuestaFixture({
  time: [
    "2026-09-01T00:00",
    "2026-09-01T01:00",
    "2026-09-01T02:00",
    "2026-09-01T03:00",
    "2026-09-01T04:00",
    "2026-09-01T05:00",
    "2026-09-01T06:00",
    null,
  ],
  temperature_2m: [null, 18.5, 18.1, "17", 16.9, 16.5, Number.NaN, 15],
  relative_humidity_2m: [70, "", 72, 73, 101, 75, 76, 77],
  precipitation: [0, 0, null, 0, 0, -0.1, 0, 0],
})

/** La hora 01:00 aparece dos veces con valores distintos. */
export const conDuplicados = respuestaFixture({
  time: [
    "2026-09-01T00:00",
    "2026-09-01T01:00",
    "2026-09-01T01:00",
    "2026-09-01T02:00",
  ],
  temperature_2m: [20, 21, 99, 22],
  relative_humidity_2m: [60, 61, 62, 63],
  precipitation: [0, 0, 0, 0],
})

/** Un array tiene un elemento menos que time. */
export const desalineado = respuestaFixture({
  time: ["2026-09-01T00:00", "2026-09-01T01:00", "2026-09-01T02:00"],
  temperature_2m: [20, 21, 22],
  relative_humidity_2m: [60, 61],
  precipitation: [0, 0, 0],
})
