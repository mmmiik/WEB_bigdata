"use client"

import * as React from "react"
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  CircleDashedIcon,
  Loader2Icon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { totalPaginas } from "@/lib/etl/filtros"
import { cn } from "@/lib/utils"

export type EstadoFase = "pendiente" | "en_curso" | "completada" | "error"

const ESTADOS: Record<
  EstadoFase,
  { texto: string; icono: React.ElementType; clase: string }
> = {
  pendiente: {
    texto: "Pendiente",
    icono: CircleDashedIcon,
    clase: "border-border text-muted-foreground bg-transparent",
  },
  en_curso: {
    texto: "En curso",
    icono: Loader2Icon,
    clase:
      "border-sky-600/30 bg-sky-50 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
  },
  completada: {
    texto: "Completada",
    icono: CheckCircle2Icon,
    clase:
      "border-emerald-600/30 bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  },
  error: {
    texto: "Con errores",
    icono: AlertTriangleIcon,
    clase:
      "border-red-600/30 bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200",
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
        className={cn(estado === "en_curso" && "animate-spin")}
      />
      {texto ?? e.texto}
    </Badge>
  )
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

export const TAMANOS_PAGINA = [25, 50, 100]

export function usePaginacion(total: number, tamanoInicial = 25) {
  const [pagina, setPagina] = React.useState(1)
  const [tamano, setTamanoState] = React.useState(tamanoInicial)
  const paginas = totalPaginas(total, tamano)
  return {
    pagina: Math.min(pagina, paginas),
    paginas,
    tamano,
    total,
    setPagina,
    setTamano: (t: number) => {
      setTamanoState(t)
      setPagina(1)
    },
  }
}

export type EstadoPaginacion = ReturnType<typeof usePaginacion>

export function Paginacion({
  p,
  etiqueta = "registros",
}: {
  p: EstadoPaginacion
  etiqueta?: string
}) {
  const desde = p.total === 0 ? 0 : (p.pagina - 1) * p.tamano + 1
  const hasta = Math.min(p.pagina * p.tamano, p.total)
  return (
    <nav
      aria-label="Paginación"
      className="flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-sm"
    >
      <p className="text-muted-foreground" aria-live="polite">
        Mostrando {n(desde)}–{n(hasta)} de {n(p.total)} {etiqueta}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground">Filas por página</span>
        <Select
          value={String(p.tamano)}
          onValueChange={(v) => p.setTamano(Number(v))}
          items={TAMANOS_PAGINA.map((t) => ({ value: String(t), label: t }))}
        >
          <SelectTrigger size="sm" aria-label="Filas por página">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TAMANOS_PAGINA.map((t) => (
              <SelectItem key={t} value={String(t)}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Primera página"
            disabled={p.pagina <= 1}
            onClick={() => p.setPagina(1)}
          >
            <ChevronsLeftIcon />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Página anterior"
            disabled={p.pagina <= 1}
            onClick={() => p.setPagina(p.pagina - 1)}
          >
            <ChevronLeftIcon />
          </Button>
          <span className="min-w-24 text-center tabular-nums">
            Página {n(p.pagina)} de {n(p.paginas)}
          </span>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Página siguiente"
            disabled={p.pagina >= p.paginas}
            onClick={() => p.setPagina(p.pagina + 1)}
          >
            <ChevronRightIcon />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Última página"
            disabled={p.pagina >= p.paginas}
            onClick={() => p.setPagina(p.paginas)}
          >
            <ChevronsRightIcon />
          </Button>
        </div>
      </div>
    </nav>
  )
}

export function Vacio({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
      {children}
    </div>
  )
}

/** Encabezado de columna numérica con unidad. */
export function ConUnidad({
  titulo,
  unidad,
}: {
  titulo: string
  unidad: string
}) {
  return (
    <>
      {titulo}{" "}
      <span className="font-normal text-muted-foreground">({unidad})</span>
    </>
  )
}
