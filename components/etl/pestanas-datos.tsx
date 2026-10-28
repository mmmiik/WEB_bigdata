"use client"

import {
  ArrowSquareOutIcon,
  CircleNotchIcon,
  DownloadSimpleIcon,
  WarningIcon,
} from "@phosphor-icons/react"
import * as React from "react"

import {
  descargarArchivo,
  n,
  Paginacion,
  usePaginacion,
  Vacio,
} from "@/components/etl/comun"
import {
  BarraVista,
  Recuento,
  Segmentado,
  TablaDatos,
  type FilaMedicion,
} from "@/components/etl/vista-datos"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { ciudadPorId, type CiudadId } from "@/lib/etl/ciudades"
import type { ExtraccionCiudad } from "@/lib/etl/extraccion"
import { paginar } from "@/lib/etl/filtros"
import type { ResultadoLimpieza } from "@/lib/etl/limpieza"
import type {
  RegistroTransformado,
  ResultadoTransformacion,
} from "@/lib/etl/transformacion"
import { ETIQUETAS_MOTIVO, type CodigoMotivo } from "@/lib/etl/validacion"

/** Valores de un array que se enseñan en el resumen; el resto se cuenta. */
const MUESTRA = 4

/**
 * JSON legible con los arrays de valores en una sola línea. En modo resumen
 * cada array largo enseña sus primeros valores y cuántos quedan.
 */
function formatearJson(valor: unknown, resumen: boolean, sangria = 0): string {
  const pad = "  ".repeat(sangria)
  if (Array.isArray(valor)) {
    if (valor.every((v) => v === null || typeof v !== "object")) {
      const vistos = resumen ? valor.slice(0, MUESTRA) : valor
      const resto = valor.length - vistos.length
      return `[${vistos.map((v) => JSON.stringify(v)).join(", ")}${resto > 0 ? `, … ${n(resto)} más` : ""}]`
    }
    return `[\n${valor.map((v) => pad + "  " + formatearJson(v, resumen, sangria + 1)).join(",\n")}\n${pad}]`
  }
  if (valor && typeof valor === "object") {
    const entradas = Object.entries(valor)
    if (entradas.length === 0) return "{}"
    return `{\n${entradas
      .map(
        ([k, v]) =>
          `${pad}  ${JSON.stringify(k)}: ${formatearJson(v, resumen, sangria + 1)}`
      )
      .join(",\n")}\n${pad}}`
  }
  return JSON.stringify(valor)
}

export function PestanaJson({
  orden,
  extracciones,
  inicio,
  fin,
}: {
  orden: CiudadId[]
  extracciones: Partial<Record<CiudadId, ExtraccionCiudad>>
  inicio: string
  fin: string
}) {
  const conTexto = orden.filter((id) => extracciones[id]?.textoOriginal)
  const [elegida, setElegida] = React.useState<CiudadId | null>(null)
  const [completo, setCompleto] = React.useState(false)
  const actual =
    elegida && orden.includes(elegida) ? elegida : (orden[0] ?? null)
  const e = actual ? extracciones[actual] : undefined
  const json = e?.json
  const formateado = React.useMemo(
    () => (json !== undefined ? formatearJson(json, !completo) : ""),
    [json, completo]
  )

  if (orden.length === 0 || !actual) {
    return <Vacio>Todavía no hay extracciones. Pulsa «Extraer datos».</Vacio>
  }

  const descargarTodo = () => {
    const paquete = Object.fromEntries(
      conTexto.map((id) => {
        const x = extracciones[id]!
        return [
          ciudadPorId(id).nombre,
          { url: x.url, descargado_en: x.descargadoEn, respuesta: x.json },
        ]
      })
    )
    descargarArchivo(
      `open-meteo_${inicio}_${fin}.json`,
      JSON.stringify(paquete, null, 2)
    )
  }

  return (
    <div className="grid gap-3">
      <BarraVista
        acciones={
          <>
            {e?.textoOriginal && (
              <Segmentado
                etiqueta="Cantidad de datos"
                valor={completo ? "completo" : "resumen"}
                onCambio={(v) => setCompleto(v === "completo")}
                opciones={[
                  { valor: "resumen", etiqueta: "Resumen" },
                  { valor: "completo", etiqueta: "Completo" },
                ]}
              />
            )}
            {e && (
              <Button
                size="icon-sm"
                variant="outline"
                aria-label="Abrir la petición original"
                title={e.url}
                render={<a href={e.url} target="_blank" rel="noreferrer" />}
                nativeButton={false}
              >
                <ArrowSquareOutIcon />
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              disabled={conTexto.length === 0}
              onClick={descargarTodo}
              title="Descarga el JSON de todas las ciudades, tal como llegó"
            >
              <DownloadSimpleIcon data-icon="inline-start" />
              Descargar
            </Button>
          </>
        }
      >
        <Segmentado
          etiqueta="Ciudad"
          valor={actual}
          onCambio={setElegida}
          opciones={orden.map((id) => ({
            valor: id,
            etiqueta: ciudadPorId(id).nombre,
            aviso: extracciones[id]?.estado === "error",
          }))}
        />
      </BarraVista>

      {e?.estado === "en_curso" && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <CircleNotchIcon className="size-4 animate-spin" aria-hidden />
          Descargando…
        </p>
      )}
      {e?.error && (
        <Alert variant="destructive">
          <WarningIcon weight="fill" />
          <AlertTitle>No se pudo descargar</AlertTitle>
          <AlertDescription>{e.error}</AlertDescription>
        </Alert>
      )}
      {e?.textoOriginal && (
        <pre
          title={e.descargadoEn && `Descargado el ${e.descargadoEn}`}
          className="overflow-auto rounded-xl bg-black/[0.04] p-4 font-mono text-xs leading-relaxed break-all whitespace-pre-wrap dark:bg-white/[0.06]"
        >
          {formateado}
        </pre>
      )}
    </div>
  )
}

const aFila = (r: RegistroTransformado): FilaMedicion => ({
  clave: `${r.origen.ciudadId}-${r.origen.indice}`,
  ciudad: r.ciudad,
  fecha_hora: r.fecha_hora,
  fechaOriginal: r.fecha_original,
  temperatura_c: r.temperatura_c,
  humedad_pct: r.humedad_pct,
  precipitacion_mm: r.precipitacion_mm,
})

export function PestanaTransformados({
  transformacion,
}: {
  transformacion: ResultadoTransformacion | null
}) {
  const filas = transformacion?.registros ?? []
  const p = usePaginacion(filas.length)
  if (!transformacion) {
    return <Vacio>Sin datos transformados todavía.</Vacio>
  }
  const visibles = paginar(filas, p.pagina, p.tamano).map(aFila)
  return (
    <div className="grid gap-3">
      <BarraVista>
        <Recuento
          valor={filas.length}
          texto="registros, uno por ciudad y hora"
        />
      </BarraVista>
      {transformacion.errores.length > 0 && (
        <Alert variant="destructive">
          <WarningIcon weight="fill" />
          <AlertTitle>Problemas de estructura</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4">
              {transformacion.errores.map((e, i) => (
                <li key={i}>
                  <strong>{ciudadPorId(e.ciudadId).nombre}:</strong> {e.mensaje}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
      <TablaDatos filas={visibles} />
      <Paginacion p={p} />
    </div>
  )
}

type FiltroMotivo = CodigoMotivo | "todos"

export function PestanaRechazados({
  limpieza,
}: {
  limpieza: ResultadoLimpieza | null
}) {
  const [motivo, setMotivo] = React.useState<FiltroMotivo>("todos")
  const todos = limpieza?.rechazados ?? []
  const filas =
    motivo === "todos"
      ? todos
      : todos.filter((r) => r.motivos.some((m) => m.codigo === motivo))
  const p = usePaginacion(filas.length)
  if (!limpieza) return <Vacio>Sin datos limpiados todavía.</Vacio>
  if (todos.length === 0)
    return (
      <Vacio>Ningún registro rechazado: todos los datos son válidos.</Vacio>
    )

  const visibles = paginar(filas, p.pagina, p.tamano)
  const motivosDe = new Map(
    visibles.map((r) => [aFila(r.registro).clave, r.motivos])
  )
  return (
    <div className="grid gap-3">
      <BarraVista>
        <Segmentado
          etiqueta="Motivo"
          valor={motivo}
          onCambio={(v) => {
            setMotivo(v)
            p.setPagina(1)
          }}
          opciones={[
            { valor: "todos", etiqueta: `Todos (${n(todos.length)})` },
            ...Object.entries(limpieza.resumenMotivos).map(([c, cuenta]) => ({
              valor: c as CodigoMotivo,
              etiqueta: `${ETIQUETAS_MOTIVO[c as CodigoMotivo]} (${n(cuenta!)})`,
            })),
          ]}
        />
      </BarraVista>
      <TablaDatos
        filas={visibles.map((r) => aFila(r.registro))}
        despues={[
          {
            id: "motivo",
            titulo: "Motivo",
            className: "whitespace-normal",
            celda: (f) => {
              const motivos = motivosDe.get(f.clave) ?? []
              return (
                <span
                  className="text-red-700 dark:text-red-300"
                  title={motivos.map((m) => m.detalle).join("\n")}
                >
                  {motivos.map((m) => ETIQUETAS_MOTIVO[m.codigo]).join(", ")}
                </span>
              )
            },
          },
        ]}
      />
      <Paginacion p={p} />
    </div>
  )
}
