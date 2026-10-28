"use client"

import { ArrowDownIcon, ArrowUpIcon } from "@phosphor-icons/react"
import * as React from "react"

import { dec, n, ValorCrudo } from "@/components/etl/comun"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

// Piezas comunes de las vistas de la ventana de inspección: una barra arriba,
// la tabla de mediciones (siempre las mismas columnas) y la paginación.

/** Barra superior de una vista: datos a la izquierda, acciones a la derecha. */
export function BarraVista({
  children,
  acciones,
}: {
  children?: React.ReactNode
  acciones?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {children}
      </div>
      {acciones && (
        <div className="flex flex-wrap items-center gap-2">{acciones}</div>
      )}
    </div>
  )
}

/** Control segmentado, como el de iOS. */
export function Segmentado<T extends string>({
  opciones,
  valor,
  onCambio,
  etiqueta,
}: {
  opciones: { valor: T; etiqueta: React.ReactNode; aviso?: boolean }[]
  valor: T
  onCambio: (v: T) => void
  etiqueta: string
}) {
  return (
    <div
      role="group"
      aria-label={etiqueta}
      className="inline-flex flex-wrap gap-0.5 rounded-lg bg-black/[0.06] p-0.5 dark:bg-white/[0.08]"
    >
      {opciones.map((o) => (
        <button
          key={o.valor}
          type="button"
          aria-pressed={o.valor === valor}
          onClick={() => onCambio(o.valor)}
          className={cn(
            "flex h-7 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            o.valor === valor
              ? "bg-white text-foreground shadow-sm dark:bg-white/20"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {o.aviso && (
            <span aria-hidden className="size-1.5 rounded-full bg-red-500" />
          )}
          {o.etiqueta}
        </button>
      ))}
    </div>
  )
}

/** «2026-09-01T05:00:00Z» → «01/09/2026 05:00» (siempre en UTC). */
export function fechaUtc(iso: string) {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)} ${iso.slice(11, 16)}`
}

/** Valor con su unidad; si no es un número, se enseña tal cual llegó. */
function Medida({ valor, unidad }: { valor: unknown; unidad: string }) {
  if (typeof valor !== "number" || !Number.isFinite(valor))
    return <ValorCrudo valor={valor} />
  return (
    <span className="tabular-nums">
      {dec(valor)}
      <span className="text-muted-foreground"> {unidad}</span>
    </span>
  )
}

/** Una medición, validada o no (por eso los valores son `unknown`). */
export interface FilaMedicion {
  clave: string
  ciudad: unknown
  /** Fecha ISO en UTC; si no hay, se muestra `fechaOriginal`. */
  fecha_hora: string | null
  fechaOriginal?: unknown
  temperatura_c: unknown
  humedad_pct: unknown
  precipitacion_mm: unknown
}

export interface Columna<F> {
  id: string
  titulo: React.ReactNode
  className?: string
  celda: (fila: F, indice: number) => React.ReactNode
}

export interface OrdenTabla {
  campo: string
  direccion: "asc" | "desc"
}

const COLUMNAS_BASE = [
  { id: "ciudad", titulo: "Ciudad" },
  { id: "fecha_hora", titulo: "Fecha (UTC)" },
  { id: "temperatura_c", titulo: "Temperatura", derecha: true },
  { id: "humedad_pct", titulo: "Humedad", derecha: true },
  { id: "precipitacion_mm", titulo: "Precipitación", derecha: true },
] as const

/**
 * Tabla de mediciones con las mismas cinco columnas en todas las vistas.
 * `antes` y `despues` añaden columnas propias (selección, motivo…).
 */
export function TablaDatos<F extends FilaMedicion>({
  filas,
  antes = [],
  despues = [],
  orden,
  onOrden,
  ordenables,
  seleccionada,
}: {
  filas: F[]
  antes?: Columna<F>[]
  despues?: Columna<F>[]
  orden?: OrdenTabla
  /** Si existe, los encabezados ordenan al pulsarlos. */
  onOrden?: (campo: string) => void
  /** Campos ordenables; por defecto, las cinco columnas base. */
  ordenables?: string[]
  seleccionada?: (fila: F) => boolean
}) {
  const ordenable = (id: string) =>
    !!onOrden && (ordenables ?? COLUMNAS_BASE.map((c) => c.id)).includes(id)

  const encabezado = (id: string, titulo: React.ReactNode, derecha = false) => {
    if (!ordenable(id))
      return (
        <TableHead key={id} className={cn(derecha && "text-right")}>
          {titulo}
        </TableHead>
      )
    const activo = orden?.campo === id
    const Flecha = orden?.direccion === "desc" ? ArrowDownIcon : ArrowUpIcon
    return (
      <TableHead
        key={id}
        className={cn(derecha && "text-right")}
        aria-sort={
          activo
            ? orden!.direccion === "asc"
              ? "ascending"
              : "descending"
            : undefined
        }
      >
        <button
          type="button"
          title="Ordenar por esta columna"
          onClick={() => onOrden!(id)}
          className={cn(
            "inline-flex items-center gap-1 rounded transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
            activo && "text-foreground"
          )}
        >
          {titulo}
          {activo && <Flecha aria-hidden className="size-3" />}
        </button>
      </TableHead>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {antes.map((c) => (
            <TableHead key={c.id} className={c.className}>
              {c.titulo}
            </TableHead>
          ))}
          {COLUMNAS_BASE.map((c) =>
            encabezado(c.id, c.titulo, "derecha" in c && c.derecha)
          )}
          {despues.map((c) =>
            ordenable(c.id) ? (
              encabezado(c.id, c.titulo)
            ) : (
              <TableHead key={c.id} className={c.className}>
                {c.titulo}
              </TableHead>
            )
          )}
        </TableRow>
      </TableHeader>
      <TableBody>
        {filas.map((f, i) => (
          <TableRow
            key={f.clave}
            data-state={seleccionada?.(f) ? "selected" : undefined}
          >
            {antes.map((c) => (
              <TableCell key={c.id} className={c.className}>
                {c.celda(f, i)}
              </TableCell>
            ))}
            <TableCell className="font-medium">
              {typeof f.ciudad === "string" && f.ciudad !== "" ? (
                f.ciudad
              ) : (
                <ValorCrudo valor={f.ciudad} />
              )}
            </TableCell>
            <TableCell className="tabular-nums">
              {f.fecha_hora ? (
                fechaUtc(f.fecha_hora)
              ) : (
                <ValorCrudo valor={f.fechaOriginal} />
              )}
            </TableCell>
            <TableCell className="text-right">
              <Medida valor={f.temperatura_c} unidad="°C" />
            </TableCell>
            <TableCell className="text-right">
              <Medida valor={f.humedad_pct} unidad="%" />
            </TableCell>
            <TableCell className="text-right">
              <Medida valor={f.precipitacion_mm} unidad="mm" />
            </TableCell>
            {despues.map((c) => (
              <TableCell key={c.id} className={c.className}>
                {c.celda(f, i)}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

/** Recuento destacado en la barra: «3.597 registros». */
export function Recuento({
  valor,
  texto,
}: {
  valor: number
  texto: React.ReactNode
}) {
  return (
    <span className="text-[13px]">
      <strong className="font-semibold tabular-nums">{n(valor)}</strong>{" "}
      <span className="text-muted-foreground">{texto}</span>
    </span>
  )
}
