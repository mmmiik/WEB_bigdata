"use client"

import { RotateCcwIcon } from "lucide-react"
import * as React from "react"

import { IconoEstado, ms, n, type EstadoFase } from "@/components/etl/comun"
import { Button } from "@/components/ui/button"
import { ciudadPorId } from "@/lib/etl/ciudades"
import type { ExtraccionCiudad } from "@/lib/etl/extraccion"
import { cn } from "@/lib/utils"

export interface InfoFase {
  id: string
  titulo: string
  explicacion: string
  estado: EstadoFase
  entrada: { valor: number; etiqueta: string } | null
  salida: { valor: number; etiqueta: string } | null
  duracionMs: number | null
  detalle?: React.ReactNode
  pestana: string
}

const cifra = (x: { valor: number; etiqueta: string } | null) =>
  x ? `${n(x.valor)} ${x.etiqueta}` : "—"

/** Una fila por fase: estado, entrada → salida y duración. */
export function PipelineCompacto({
  fases,
  onInspeccionar,
}: {
  fases: InfoFase[]
  onInspeccionar: (pestana: string) => void
}) {
  return (
    <ol className="grid gap-0.5">
      {fases.map((f, i) => (
        <li key={f.id}>
          <button
            type="button"
            title={`${f.explicacion} Pulsa para inspeccionar.`}
            onClick={() => onInspeccionar(f.pestana)}
            className={cn(
              "grid w-full grid-cols-[auto_1fr_auto] items-center gap-x-2 gap-y-0.5 rounded-lg px-2 py-1.5 text-left text-xs transition-colors outline-none hover:bg-black/5 focus-visible:ring-3 focus-visible:ring-ring/50 dark:hover:bg-white/5",
              f.estado === "error" && "bg-red-500/5"
            )}
          >
            <IconoEstado estado={f.estado} />
            <span className="truncate font-medium">
              <span className="text-muted-foreground tabular-nums">
                {i + 1}.
              </span>{" "}
              {f.titulo}
            </span>
            <span className="text-muted-foreground tabular-nums">
              {ms(f.duracionMs)}
            </span>
            <span className="col-span-2 col-start-2 truncate text-muted-foreground tabular-nums">
              {cifra(f.entrada)} → {cifra(f.salida)}
            </span>
            {f.detalle && (
              <span className="col-span-2 col-start-2">{f.detalle}</span>
            )}
          </button>
        </li>
      ))}
    </ol>
  )
}

/** Ciudades cuya descarga falló, con su botón de reintento. */
export function CiudadesConError({
  fallidas,
  onReintentar,
  bloqueado,
}: {
  fallidas: ExtraccionCiudad[]
  onReintentar: (e: ExtraccionCiudad) => void
  bloqueado: boolean
}) {
  if (fallidas.length === 0) return null
  return (
    <ul className="grid gap-1.5 rounded-lg bg-red-500/5 p-2 text-xs">
      {fallidas.map((e) => (
        <li key={e.ciudadId} className="grid gap-1">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium">
              {ciudadPorId(e.ciudadId).nombre}
            </span>
            <Button
              size="xs"
              variant="outline"
              disabled={bloqueado}
              onClick={() => onReintentar(e)}
            >
              <RotateCcwIcon data-icon="inline-start" />
              Reintentar
            </Button>
          </div>
          <span className="break-words text-red-700 dark:text-red-300">
            {e.error}
          </span>
        </li>
      ))}
    </ul>
  )
}

export interface EntradaRegistro {
  id: number
  hora: string
  nivel: "info" | "ok" | "error"
  texto: string
}

const PUNTO: Record<EntradaRegistro["nivel"], string> = {
  info: "bg-sky-500",
  ok: "bg-emerald-500",
  error: "bg-red-500",
}

/** Registro de actividad, lo más reciente arriba. */
export function Registro({ entradas }: { entradas: EntradaRegistro[] }) {
  if (entradas.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Aún no hay actividad. Elige ciudades y pulsa «Extraer datos».
      </p>
    )
  }
  return (
    <ol
      aria-live="polite"
      aria-relevant="additions"
      className="grid gap-1 font-mono text-[11px] leading-snug"
    >
      {entradas.toReversed().map((e) => (
        <li
          key={e.id}
          className="grid grid-cols-[auto_auto_1fr] items-baseline gap-1.5"
        >
          <span className="text-muted-foreground tabular-nums">{e.hora}</span>
          <span
            aria-hidden
            className={cn(
              "size-1.5 translate-y-[-1px] rounded-full",
              PUNTO[e.nivel]
            )}
          />
          <span
            className={cn(
              "break-words",
              e.nivel === "error" && "text-red-700 dark:text-red-300"
            )}
          >
            {e.texto}
          </span>
        </li>
      ))}
    </ol>
  )
}
