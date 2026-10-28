"use client"

import { Popover } from "@base-ui/react/popover"
import {
  ArrowCounterClockwiseIcon,
  CaretRightIcon,
  CheckCircleIcon,
  InfoIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react"
import * as React from "react"

import {
  GRUPO,
  IconoEstado,
  ms,
  n,
  Seccion,
  VIDRIO_OPACO,
  type EstadoFase,
} from "@/components/etl/comun"
import { Button } from "@/components/ui/button"
import { ciudadPorId } from "@/lib/etl/ciudades"
import type { ExtraccionCiudad } from "@/lib/etl/extraccion"
import { cn } from "@/lib/utils"

export interface Cifra {
  valor: number
  etiqueta: string
}

export interface InfoFase {
  id: string
  titulo: string
  /** Qué hace la fase: se lee en el popup de la fase. */
  explicacion: string
  /** Dato de la última ejecución; en curso o con error también se ve en la fila. */
  nota?: { texto: string; error?: boolean }
  /** Contenido extra del popup, p. ej. las ciudades que reintentar. */
  detalle?: React.ReactNode
  estado: EstadoFase
  entrada: Cifra | null
  salida: Cifra | null
  duracionMs: number | null
  pestana: string
}

const cifra = (x: Cifra | null) => (x ? `${n(x.valor)} ${x.etiqueta}` : "—")

/**
 * Las cinco fases, unidas por una línea. Cada fila solo muestra su estado;
 * al pulsarla se abre un popup con la explicación, las cifras y la duración.
 */
export function PipelineCompacto({
  fases,
  onInspeccionar,
}: {
  fases: InfoFase[]
  onInspeccionar: (pestana: string) => void
}) {
  return (
    <ol className="flex flex-1 flex-col">
      {fases.map((f) => (
        <FilaFase key={f.id} fase={f} onInspeccionar={onInspeccionar} />
      ))}
    </ol>
  )
}

function FilaFase({
  fase: f,
  onInspeccionar,
}: {
  fase: InfoFase
  onInspeccionar: (pestana: string) => void
}) {
  const [abierto, setAbierto] = React.useState(false)
  // En la fila solo se ve lo que no puede pasar desapercibido.
  const aviso =
    f.nota && (f.nota.error || f.estado === "en_curso") ? f.nota : undefined
  return (
    <li
      // Tramo de línea hasta la fase siguiente: el flujo se lee de arriba abajo.
      className="relative flex min-h-12 flex-1 not-last:after:absolute not-last:after:top-[calc(50%+14px)] not-last:after:bottom-[calc(-50%+14px)] not-last:after:left-[21.5px] not-last:after:w-px not-last:after:bg-black/10 dark:not-last:after:bg-white/15"
    >
      <Popover.Root open={abierto} onOpenChange={setAbierto}>
        <Popover.Trigger
          title="Ver detalles"
          className={cn(
            "flex w-full items-center gap-3 rounded-xl px-3 text-left transition-colors outline-none hover:bg-black/[0.04] focus-visible:ring-3 focus-visible:ring-ring/50 data-popup-open:bg-black/[0.06] dark:hover:bg-white/[0.05] dark:data-popup-open:bg-white/[0.08]",
            f.estado === "error" && "bg-red-500/[0.07]"
          )}
        >
          <IconoEstado estado={f.estado} className="size-5" />
          <span className="flex-1 text-[13px] font-medium">{f.titulo}</span>
          {aviso && (
            <span
              className={cn(
                "flex items-center gap-1 text-xs",
                aviso.error
                  ? "text-red-600 dark:text-red-400"
                  : "text-muted-foreground"
              )}
            >
              {aviso.texto}
              {aviso.error && <CaretRightIcon aria-hidden className="size-3" />}
            </span>
          )}
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner
            side="left"
            align="center"
            sideOffset={16}
            collisionPadding={16}
            className="z-50"
          >
            <Popover.Popup
              className={cn(
                "grid w-80 origin-(--transform-origin) gap-3 rounded-2xl p-4 text-xs transition duration-150 outline-none data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0",
                VIDRIO_OPACO
              )}
            >
              <div className="flex items-center gap-2">
                <IconoEstado estado={f.estado} className="size-5" />
                <Popover.Title className="texto-encabezado">
                  {f.titulo}
                </Popover.Title>
              </div>
              <Popover.Description className="text-muted-foreground">
                {f.explicacion}
              </Popover.Description>
              {f.nota && (
                <p
                  className={cn(
                    "font-medium",
                    f.nota.error && "text-red-600 dark:text-red-400"
                  )}
                >
                  {f.nota.texto}
                </p>
              )}
              {f.detalle}
              <dl className="grid grid-cols-3 gap-2 rounded-xl bg-black/[0.04] p-3 tabular-nums dark:bg-white/[0.06]">
                <div>
                  <dt className="text-[11px] text-muted-foreground">Entrada</dt>
                  <dd>{cifra(f.entrada)}</dd>
                </div>
                <div>
                  <dt className="text-[11px] text-muted-foreground">Salida</dt>
                  <dd>{cifra(f.salida)}</dd>
                </div>
                <div>
                  <dt className="text-[11px] text-muted-foreground">
                    Duración
                  </dt>
                  <dd>{f.duracionMs === null ? "—" : ms(f.duracionMs)}</dd>
                </div>
              </dl>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setAbierto(false)
                  onInspeccionar(f.pestana)
                }}
              >
                Ver datos
              </Button>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    </li>
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
    <Seccion titulo="Descargas fallidas">
      {fallidas.map((e) => (
        <div key={e.ciudadId} className="grid gap-1 px-3 py-2 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 font-medium">
              <WarningCircleIcon
                weight="fill"
                aria-hidden
                className="size-4 text-red-600 dark:text-red-400"
              />
              {ciudadPorId(e.ciudadId).nombre}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={bloqueado}
              onClick={() => onReintentar(e)}
            >
              <ArrowCounterClockwiseIcon data-icon="inline-start" />
              Reintentar
            </Button>
          </div>
          <span className="pl-6 break-words text-muted-foreground">
            {e.error}
          </span>
        </div>
      ))}
    </Seccion>
  )
}

export interface EntradaRegistro {
  id: number
  hora: string
  nivel: "info" | "ok" | "error"
  texto: string
}

const ICONO_NIVEL: Record<
  EntradaRegistro["nivel"],
  { icono: React.ElementType; clase: string; texto: string }
> = {
  info: {
    icono: InfoIcon,
    clase: "text-sky-500",
    texto: "Información",
  },
  ok: {
    icono: CheckCircleIcon,
    clase: "text-emerald-500",
    texto: "Correcto",
  },
  error: {
    icono: WarningCircleIcon,
    clase: "text-red-500",
    texto: "Error",
  },
}

/** Registro de actividad, lo más reciente arriba. */
export function Registro({ entradas }: { entradas: EntradaRegistro[] }) {
  if (entradas.length === 0) {
    return (
      <p className="px-1 py-1 text-xs text-muted-foreground">
        Aún no hay actividad.
      </p>
    )
  }
  return (
    <ol aria-live="polite" aria-relevant="additions" className={GRUPO}>
      {entradas.toReversed().map((e) => {
        const nivel = ICONO_NIVEL[e.nivel]
        const Icono = nivel.icono
        return (
          <li
            key={e.id}
            className="grid grid-cols-[auto_1fr_auto] items-start gap-2 px-3 py-2 text-xs"
          >
            <Icono
              weight="fill"
              aria-hidden
              className={cn("mt-px size-3.5", nivel.clase)}
            />
            <span
              className={cn(
                "leading-4 break-words",
                e.nivel === "error" && "text-red-700 dark:text-red-300"
              )}
            >
              <span className="sr-only">{nivel.texto}: </span>
              {e.texto}
            </span>
            <time className="text-[11px] leading-4 text-muted-foreground tabular-nums">
              {e.hora}
            </time>
          </li>
        )
      })}
    </ol>
  )
}
