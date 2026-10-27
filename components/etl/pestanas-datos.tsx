"use client"

import { AlertTriangleIcon, DownloadIcon } from "lucide-react"
import * as React from "react"

import {
  BadgeEstado,
  ConUnidad,
  descargarArchivo,
  n,
  Paginacion,
  usePaginacion,
  ValorCrudo,
  Vacio,
} from "@/components/etl/comun"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ciudadPorId, type CiudadId } from "@/lib/etl/ciudades"
import type { ExtraccionCiudad } from "@/lib/etl/extraccion"
import { formatearFechaHoraUtc } from "@/lib/etl/fechas"
import { paginar } from "@/lib/etl/filtros"
import type { ResultadoLimpieza } from "@/lib/etl/limpieza"
import type {
  RegistroTransformado,
  ResultadoTransformacion,
} from "@/lib/etl/transformacion"
import { ETIQUETAS_MOTIVO, type CodigoMotivo } from "@/lib/etl/validacion"
import { cn } from "@/lib/utils"

/** JSON legible con los arrays de valores en una sola línea. */
function formatearJson(valor: unknown, sangria = 0): string {
  const pad = "  ".repeat(sangria)
  if (Array.isArray(valor)) {
    if (valor.every((v) => v === null || typeof v !== "object")) {
      return `[${valor.map((v) => JSON.stringify(v)).join(", ")}]`
    }
    return `[\n${valor.map((v) => pad + "  " + formatearJson(v, sangria + 1)).join(",\n")}\n${pad}]`
  }
  if (valor && typeof valor === "object") {
    const entradas = Object.entries(valor)
    if (entradas.length === 0) return "{}"
    return `{\n${entradas
      .map(
        ([k, v]) =>
          `${pad}  ${JSON.stringify(k)}: ${formatearJson(v, sangria + 1)}`
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
  const actual =
    elegida && orden.includes(elegida) ? elegida : (orden[0] ?? null)
  const e = actual ? extracciones[actual] : undefined
  const json = e?.json
  const formateado = React.useMemo(
    () => (json !== undefined ? formatearJson(json) : ""),
    [json]
  )

  if (orden.length === 0) {
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
    <div className="grid grid-cols-1 gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="group" aria-label="Ciudad" className="flex flex-wrap gap-1">
          {orden.map((id) => (
            <Button
              key={id}
              size="sm"
              variant={id === actual ? "default" : "outline"}
              aria-pressed={id === actual}
              onClick={() => setElegida(id)}
            >
              {ciudadPorId(id).nombre}
            </Button>
          ))}
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={conTexto.length === 0}
          onClick={descargarTodo}
        >
          <DownloadIcon data-icon="inline-start" />
          Descargar todos ({conTexto.length})
        </Button>
      </div>
      {e && (
        <div className="grid grid-cols-1 gap-2">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <BadgeEstado
              estado={
                e.estado === "en_curso"
                  ? "en_curso"
                  : e.estado === "completada"
                    ? "completada"
                    : e.estado === "error"
                      ? "error"
                      : "pendiente"
              }
            />
            {e.descargadoEn && <span>Descargado: {e.descargadoEn}</span>}
            {e.textoOriginal && (
              <span>· {n(e.textoOriginal.length)} caracteres</span>
            )}
            {e.intentos > 1 && <span>· {e.intentos} intentos</span>}
          </div>
          <p className="text-xs break-all">
            <span className="text-muted-foreground">Petición: </span>
            <a
              className="underline underline-offset-2"
              href={e.url}
              target="_blank"
              rel="noreferrer"
            >
              {e.url}
            </a>
          </p>
          {e.error && (
            <Alert variant="destructive">
              <AlertTriangleIcon />
              <AlertTitle>Error en la descarga</AlertTitle>
              <AlertDescription>{e.error}</AlertDescription>
            </Alert>
          )}
          {e.textoOriginal && (
            <>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  Formateado para leerlo; la descarga contiene el texto exacto
                  recibido.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    descargarArchivo(
                      `open-meteo_${e.ciudadId}_${inicio}_${fin}.json`,
                      e.textoOriginal!
                    )
                  }
                >
                  <DownloadIcon data-icon="inline-start" />
                  Descargar JSON
                </Button>
              </div>
              <pre className="max-h-[28rem] overflow-auto rounded-lg border bg-muted/40 p-3 font-mono text-xs leading-relaxed break-all whitespace-pre-wrap">
                {formateado}
              </pre>
            </>
          )}
        </div>
      )}
    </div>
  )
}

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
  const visibles = paginar(filas, p.pagina, p.tamano)
  return (
    <div className="grid grid-cols-1 gap-3">
      <p className="text-sm text-muted-foreground">
        Cada posición <code>i</code> de los arrays <code>time</code>,{" "}
        <code>temperature_2m</code>, <code>relative_humidity_2m</code> y{" "}
        <code>precipitation</code> se convierte en una fila. Los valores se
        muestran tal como llegaron: un <ValorCrudo valor={null} /> no se
        convierte en 0.
      </p>
      <ul className="flex flex-wrap gap-2 text-xs">
        {Object.entries(transformacion.porCiudad).map(([id, info]) => (
          <li key={id} className="rounded-md border px-2 py-1">
            <span className="font-medium">
              {ciudadPorId(id as CiudadId).nombre}
            </span>
            : {n(info!.registros)} filas · longitudes{" "}
            {Object.entries(info!.longitudes)
              .map(([k, v]) => `${k}=${v ?? "ausente"}`)
              .join(", ")}
          </li>
        ))}
      </ul>
      {transformacion.errores.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangleIcon />
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
      <TablaTransformados filas={visibles} desde={(p.pagina - 1) * p.tamano} />
      <Paginacion p={p} />
    </div>
  )
}

function TablaTransformados({
  filas,
  desde,
  motivos,
}: {
  filas: RegistroTransformado[]
  desde: number
  motivos?: React.ReactNode[]
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12 text-right">#</TableHead>
          <TableHead>Ciudad</TableHead>
          <TableHead>Índice</TableHead>
          <TableHead>Hora recibida</TableHead>
          <TableHead>fecha_hora (UTC)</TableHead>
          <TableHead className="text-right">
            <ConUnidad titulo="Temperatura" unidad="°C" />
          </TableHead>
          <TableHead className="text-right">
            <ConUnidad titulo="Humedad" unidad="%" />
          </TableHead>
          <TableHead className="text-right">
            <ConUnidad titulo="Precipitación" unidad="mm" />
          </TableHead>
          {motivos && <TableHead>Motivo del rechazo</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {filas.map((r, i) => (
          <TableRow key={`${r.origen.ciudadId}-${r.origen.indice}`}>
            <TableCell className="text-right text-muted-foreground tabular-nums">
              {n(desde + i + 1)}
            </TableCell>
            <TableCell>{r.ciudad ?? <ValorCrudo valor={r.ciudad} />}</TableCell>
            <TableCell className="tabular-nums">{r.origen.indice}</TableCell>
            <TableCell className="font-mono text-xs">
              {typeof r.fecha_original === "string" &&
              r.fecha_original !== "" ? (
                r.fecha_original
              ) : (
                <ValorCrudo valor={r.fecha_original} />
              )}
            </TableCell>
            <TableCell className="font-mono text-xs">
              {r.fecha_hora ?? <ValorCrudo valor={null} />}
            </TableCell>
            <TableCell className="text-right">
              <ValorCrudo valor={r.temperatura_c} />
            </TableCell>
            <TableCell className="text-right">
              <ValorCrudo valor={r.humedad_pct} />
            </TableCell>
            <TableCell className="text-right">
              <ValorCrudo valor={r.precipitacion_mm} />
            </TableCell>
            {motivos && (
              <TableCell className="whitespace-normal">{motivos[i]}</TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

export function PestanaRechazados({
  limpieza,
  excluidosPorFiltros,
}: {
  limpieza: ResultadoLimpieza | null
  excluidosPorFiltros: number
}) {
  const [motivo, setMotivo] = React.useState<CodigoMotivo | null>(null)
  const todos = limpieza?.rechazados ?? []
  const filas = motivo
    ? todos.filter((r) => r.motivos.some((m) => m.codigo === motivo))
    : todos
  const p = usePaginacion(filas.length)
  if (!limpieza) return <Vacio>Sin datos limpiados todavía.</Vacio>

  const visibles = paginar(filas, p.pagina, p.tamano)
  return (
    <div className="grid grid-cols-1 gap-3">
      <p className="text-sm text-muted-foreground">
        Descartes por <strong>calidad</strong>: filas que no cumplen las reglas
        de limpieza. Los {n(excluidosPorFiltros)} registros válidos que tus
        filtros dejan fuera <strong>no</strong> aparecen aquí: no son errores,
        solo no coinciden con lo que buscas.
      </p>
      {todos.length === 0 ? (
        <Vacio>
          Ningún registro rechazado: todos los valores recibidos son válidos y
          no hay duplicados.
        </Vacio>
      ) : (
        <>
          <div
            role="group"
            aria-label="Filtrar por motivo"
            className="flex flex-wrap gap-1"
          >
            <Button
              size="sm"
              variant={motivo === null ? "default" : "outline"}
              aria-pressed={motivo === null}
              onClick={() => setMotivo(null)}
            >
              Todos ({n(todos.length)})
            </Button>
            {Object.entries(limpieza.resumenMotivos).map(([codigo, cuenta]) => (
              <Button
                key={codigo}
                size="sm"
                variant={motivo === codigo ? "default" : "outline"}
                aria-pressed={motivo === codigo}
                onClick={() => setMotivo(codigo as CodigoMotivo)}
              >
                {ETIQUETAS_MOTIVO[codigo as CodigoMotivo]} ({n(cuenta!)})
              </Button>
            ))}
          </div>
          <TablaTransformados
            filas={visibles.map((r) => r.registro)}
            desde={(p.pagina - 1) * p.tamano}
            motivos={visibles.map((r, i) => (
              <ul key={i} className="grid grid-cols-1 gap-0.5">
                {r.motivos.map((m, j) => (
                  <li key={j} className="flex flex-wrap items-center gap-1">
                    <Badge
                      variant="outline"
                      className={cn(
                        "border-red-600/30 text-red-800 dark:text-red-200"
                      )}
                    >
                      <AlertTriangleIcon aria-hidden />
                      {ETIQUETAS_MOTIVO[m.codigo]}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {m.detalle}
                    </span>
                  </li>
                ))}
              </ul>
            ))}
          />
          <Paginacion p={p} etiqueta="rechazados" />
        </>
      )}
    </div>
  )
}

export function celdaFecha(iso: string) {
  return <span className="font-mono text-xs">{formatearFechaHoraUtc(iso)}</span>
}
