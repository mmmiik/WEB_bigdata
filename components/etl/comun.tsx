"use client"

import * as React from "react"
import {
  CaretLeftIcon,
  CaretRightIcon,
  CheckCircleIcon,
  CircleDashedIcon,
  CircleNotchIcon,
  WarningCircleIcon,
  type IconWeight,
} from "@phosphor-icons/react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { totalPaginas } from "@/lib/etl/filtros"
import { cn } from "@/lib/utils"

export type EstadoFase = "pendiente" | "en_curso" | "completada" | "error"

const ESTADOS: Record<
  EstadoFase,
  { texto: string; icono: React.ElementType; peso: IconWeight; clase: string }
> = {
  pendiente: {
    texto: "Pendiente",
    icono: CircleDashedIcon,
    peso: "bold",
    clase: "border-transparent text-muted-foreground bg-transparent",
  },
  en_curso: {
    texto: "En curso",
    icono: CircleNotchIcon,
    peso: "bold",
    clase: "border-transparent bg-sky-500/10 text-sky-700 dark:text-sky-300",
  },
  completada: {
    texto: "Completada",
    icono: CheckCircleIcon,
    peso: "fill",
    clase:
      "border-transparent bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  error: {
    texto: "Con errores",
    icono: WarningCircleIcon,
    peso: "fill",
    clase: "border-transparent bg-red-500/10 text-red-700 dark:text-red-300",
  },
}

/** Estado con icono y texto: no depende solo del color. */
export function BadgeEstado({
  estado,
  texto,
  className,
}: {
  estado: EstadoFase
  texto?: string
  className?: string
}) {
  const e = ESTADOS[estado]
  const Icono = e.icono
  return (
    <Badge variant="outline" className={cn(e.clase, className)}>
      <Icono
        aria-hidden
        weight={e.peso}
        className={cn(estado === "en_curso" && "animate-spin")}
      />
      {texto ?? e.texto}
    </Badge>
  )
}

const COLOR_ESTADO: Record<EstadoFase, string> = {
  pendiente: "text-muted-foreground",
  en_curso: "text-sky-600 dark:text-sky-400",
  completada: "text-emerald-600 dark:text-emerald-400",
  error: "text-red-600 dark:text-red-400",
}

/** Versión compacta de BadgeEstado: solo icono, con el texto para lectores de pantalla. */
export function IconoEstado({
  estado,
  className,
}: {
  estado: EstadoFase
  className?: string
}) {
  const { icono: Icono, peso } = ESTADOS[estado]
  return (
    <>
      <Icono
        aria-hidden
        weight={peso}
        className={cn(
          "size-4 shrink-0",
          COLOR_ESTADO[estado],
          estado === "en_curso" && "animate-spin",
          className
        )}
      />
      <span className="sr-only">{ESTADOS[estado].texto}</span>
    </>
  )
}

/** Vidrio esmerilado: se apoya sobre el mapa y deja intuirlo detrás. */
export const VIDRIO =
  "border border-white/60 bg-white/55 shadow-lg shadow-black/5 backdrop-blur-xl backdrop-saturate-150 dark:border-white/10 dark:bg-zinc-900/55 dark:shadow-black/30"

/** Vidrio más opaco para ventanas con tablas encima: se lee mejor. */
export const VIDRIO_OPACO =
  "border border-white/60 bg-white/80 shadow-2xl backdrop-blur-2xl backdrop-saturate-150 dark:border-white/10 dark:bg-zinc-900/80"

/** Caja rectangular de los laterales. */
export function Caja({
  titulo,
  accion,
  className,
  cuerpoClassName,
  children,
}: {
  titulo: React.ReactNode
  accion?: React.ReactNode
  className?: string
  cuerpoClassName?: string
  children: React.ReactNode
}) {
  return (
    <section
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-2xl",
        VIDRIO,
        className
      )}
    >
      <header className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-black/5 px-4 dark:border-white/5">
        <h2 className="texto-encabezado">{titulo}</h2>
        {accion}
      </header>
      <div
        className={cn("min-h-0 flex-1 overflow-y-auto p-3", cuerpoClassName)}
      >
        {children}
      </div>
    </section>
  )
}

/** Fondo de los grupos de filas: un tono por encima del vidrio. */
export const GRUPO =
  "overflow-hidden rounded-xl bg-white/55 divide-y divide-black/[0.06] dark:bg-white/[0.06] dark:divide-white/[0.06]"

/** Bloque con título y filas agrupadas, como las listas de Ajustes de iOS. */
export function Seccion({
  titulo,
  accion,
  className,
  children,
}: {
  titulo: React.ReactNode
  accion?: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  return (
    <section className={cn("grid gap-1.5", className)}>
      <header className="flex min-h-5 items-center justify-between gap-2 px-3">
        <h3 className="texto-seccion">{titulo}</h3>
        {accion}
      </header>
      <div className={GRUPO}>{children}</div>
    </section>
  )
}

/** Fila «etiqueta — valor» dentro de una Seccion. */
export function Fila({
  etiqueta,
  children,
  className,
}: {
  etiqueta: React.ReactNode
  children?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex min-h-9 items-center justify-between gap-3 px-3 py-1.5 text-xs",
        className
      )}
    >
      <span className="text-muted-foreground">{etiqueta}</span>
      <span className="text-right tabular-nums">{children}</span>
    </div>
  )
}

/** Plural sencillo en castellano: «1 ciudad», «5 ciudades». */
export function plural(cantidad: number, singular: string, varias: string) {
  return `${n(cantidad)} ${cantidad === 1 ? singular : varias}`
}

const fmtEntero = new Intl.NumberFormat("es-ES")
const fmtDecimal = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 })

export function n(valor: number): string {
  return fmtEntero.format(valor)
}

export function dec(valor: number): string {
  return fmtDecimal.format(valor)
}

export function ms(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return "—"
  if (valor < 1) return "< 1 ms"
  if (valor < 1000) return `${Math.round(valor)} ms`
  return `${dec(valor / 1000)} s`
}

/** Muestra un valor crudo sin convertirlo (null, ausente, texto…). */
export function ValorCrudo({ valor }: { valor: unknown }) {
  if (typeof valor === "number" && Number.isFinite(valor)) {
    return <span className="tabular-nums">{dec(valor)}</span>
  }
  let texto: string
  if (valor === undefined) texto = "ausente"
  else if (valor === null) texto = "null"
  else if (typeof valor === "string")
    texto = valor === "" ? '""' : JSON.stringify(valor)
  else texto = String(valor)
  return (
    <span className="rounded bg-amber-100 px-1 font-mono text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200">
      {texto}
    </span>
  )
}

export function descargarArchivo(nombre: string, contenido: string) {
  const blob = new Blob([contenido], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = nombre
  a.click()
  URL.revokeObjectURL(url)
}

export function usePaginacion(total: number, tamano = 25) {
  const [pagina, setPagina] = React.useState(1)
  const paginas = totalPaginas(total, tamano)
  return {
    pagina: Math.min(pagina, paginas),
    paginas,
    tamano,
    total,
    setPagina,
  }
}

export type EstadoPaginacion = ReturnType<typeof usePaginacion>

/** «1–25 de 3.600» y flechas: la paginación solo cambia lo que se ve. */
export function Paginacion({ p }: { p: EstadoPaginacion }) {
  if (p.total <= p.tamano) return null
  const desde = (p.pagina - 1) * p.tamano + 1
  const hasta = Math.min(p.pagina * p.tamano, p.total)
  return (
    <nav
      aria-label="Paginación"
      className="flex items-center justify-end gap-2 text-xs text-muted-foreground"
    >
      <span aria-live="polite" className="tabular-nums">
        {n(desde)}–{n(hasta)} de {n(p.total)}
      </span>
      <Button
        variant="outline"
        size="icon-sm"
        className="rounded-full"
        aria-label="Página anterior"
        disabled={p.pagina <= 1}
        onClick={() => p.setPagina(p.pagina - 1)}
      >
        <CaretLeftIcon />
      </Button>
      <Button
        variant="outline"
        size="icon-sm"
        className="rounded-full"
        aria-label="Página siguiente"
        disabled={p.pagina >= p.paginas}
        onClick={() => p.setPagina(p.pagina + 1)}
      >
        <CaretRightIcon />
      </Button>
    </nav>
  )
}

export function Vacio({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-black/[0.04] p-8 text-center text-xs text-muted-foreground dark:bg-white/[0.06]">
      {children}
    </div>
  )
}
