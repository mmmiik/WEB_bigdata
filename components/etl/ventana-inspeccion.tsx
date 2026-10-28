"use client"

import { Dialog } from "@base-ui/react/dialog"
import { Tabs } from "@base-ui/react/tabs"
import {
  CaretLeftIcon,
  CaretRightIcon,
  XCircleIcon,
  type Icon,
} from "@phosphor-icons/react"
import * as React from "react"

import { n, VIDRIO_OPACO } from "@/components/etl/comun"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/** Una vista de datos: se muestra en la caja lateral y en la ventana. */
export interface Vista {
  pestana: string
  etiqueta: string
  icono: Icon
  /** Degradado de la pastilla, como los iconos de los Ajustes de iOS. */
  tono: string
  valor: number | null
  /** Insignia roja, como las notificaciones de iOS (p. ej. errores). */
  aviso?: number
}

const TAMANOS = {
  sm: { caja: "size-5 rounded-[6px]", icono: "size-3" },
  md: { caja: "size-7 rounded-[8px]", icono: "size-4" },
}

export function PastillaIcono({
  vista,
  tamano = "sm",
  className,
}: {
  vista: Vista
  tamano?: keyof typeof TAMANOS
  className?: string
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center bg-linear-to-b text-white shadow-sm shadow-black/15",
        TAMANOS[tamano].caja,
        vista.tono,
        className
      )}
    >
      <vista.icono weight="fill" className={TAMANOS[tamano].icono} />
    </span>
  )
}

/** Controles que se escriben con las flechas: ahí no se cambia de vista. */
const EDITABLES =
  'input, textarea, select, [contenteditable="true"], [role="combobox"], [role="listbox"], [role="option"], [role="slider"], [role="spinbutton"]'

export function VentanaInspeccion({
  abierta,
  onAbierta,
  vistas,
  pestana,
  onPestana,
  contenido,
}: {
  abierta: boolean
  onAbierta: (abierta: boolean) => void
  vistas: Vista[]
  pestana: string
  onPestana: (pestana: string) => void
  /** Contenido de cada vista, por id de pestaña. */
  contenido: Record<string, React.ReactNode>
}) {
  const indice = Math.max(
    0,
    vistas.findIndex((v) => v.pestana === pestana)
  )
  const ir = (delta: number) =>
    onPestana(vistas[(indice + delta + vistas.length) % vistas.length].pestana)

  // Flechas ← → para recorrer las vistas; ↑ ↓ ya las gestiona la lista.
  const alTeclear = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
    if ((e.target as HTMLElement).closest(EDITABLES)) return
    e.preventDefault()
    ir(e.key === "ArrowRight" ? 1 : -1)
  }

  return (
    <Dialog.Root open={abierta} onOpenChange={onAbierta}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px] transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup
          onKeyDown={alTeclear}
          className={cn(
            "fixed top-1/2 left-1/2 z-50 flex h-[min(46rem,calc(100svh-2rem))] w-[min(72rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl transition duration-150 outline-none data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0",
            VIDRIO_OPACO
          )}
        >
          <header className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-black/5 pr-2.5 pl-4 dark:border-white/5">
            <Dialog.Title className="texto-encabezado">
              Inspección de datos
            </Dialog.Title>
            <div className="flex items-center gap-1">
              <span
                aria-live="polite"
                className="mr-1 text-xs text-muted-foreground tabular-nums"
              >
                {n(indice + 1)} de {n(vistas.length)}
              </span>
              <Button
                variant="outline"
                size="icon-sm"
                className="rounded-full"
                aria-label="Vista anterior"
                title="Vista anterior (←)"
                onClick={() => ir(-1)}
              >
                <CaretLeftIcon />
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                className="rounded-full"
                aria-label="Vista siguiente"
                title="Vista siguiente (→)"
                onClick={() => ir(1)}
              >
                <CaretRightIcon />
              </Button>
              <Dialog.Close
                aria-label="Cerrar"
                className="ml-1 rounded-full text-muted-foreground/50 transition-colors outline-none hover:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <XCircleIcon weight="fill" className="size-6" />
              </Dialog.Close>
            </div>
          </header>

          <Tabs.Root
            value={pestana}
            onValueChange={(v) => onPestana(String(v))}
            orientation="vertical"
            className="flex min-h-0 flex-1 flex-col sm:flex-row"
          >
            <Tabs.List
              activateOnFocus
              aria-label="Vistas de datos"
              className="flex shrink-0 gap-0.5 overflow-x-auto border-b border-black/5 p-2 sm:w-56 sm:flex-col sm:overflow-x-visible sm:overflow-y-auto sm:border-r sm:border-b-0 dark:border-white/5"
            >
              {vistas.map((v) => (
                <Tabs.Tab
                  key={v.pestana}
                  value={v.pestana}
                  className="flex min-h-8 shrink-0 items-center gap-2 rounded-lg px-2 py-1 text-left text-xs transition-colors outline-none hover:bg-black/[0.04] focus-visible:ring-3 focus-visible:ring-ring/50 dark:hover:bg-white/[0.05] data-active:bg-black/[0.07] data-active:font-medium dark:data-active:bg-white/[0.1]"
                >
                  <PastillaIcono vista={v} />
                  <span className="flex-1 whitespace-nowrap">{v.etiqueta}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {v.valor === null ? "—" : n(v.valor)}
                  </span>
                </Tabs.Tab>
              ))}
            </Tabs.List>
            {vistas.map((v) => (
              <Tabs.Panel
                key={v.pestana}
                value={v.pestana}
                className="min-h-0 min-w-0 flex-1 overflow-auto p-4 text-sm outline-none"
              >
                {contenido[v.pestana]}
              </Tabs.Panel>
            ))}
          </Tabs.Root>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
