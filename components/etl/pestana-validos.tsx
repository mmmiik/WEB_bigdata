"use client"

import { Popover } from "@base-ui/react/popover"
import { FunnelIcon, WarningIcon } from "@phosphor-icons/react"
import * as React from "react"

import {
  n,
  Paginacion,
  usePaginacion,
  Vacio,
  VIDRIO_OPACO,
} from "@/components/etl/comun"
import { BarraVista, Recuento, TablaDatos } from "@/components/etl/vista-datos"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
  FILTROS_INICIALES,
  paginar,
  type CampoOrden,
  type Filtros,
  type FiltrosInterpretados,
  type Orden,
} from "@/lib/etl/filtros"
import type { RegistroValido } from "@/lib/etl/limpieza"
import { cn } from "@/lib/utils"

interface Props {
  totalValidos: number
  ciudadesDisponibles: string[]
  ordenados: RegistroValido[]
  filtros: Filtros
  onFiltros: (f: Filtros) => void
  interpretados: FiltrosInterpretados
  orden: Orden
  onOrden: (o: Orden) => void
  seleccion: ReadonlySet<string>
  onSeleccion: (s: Set<string>) => void
  seleccionadosParaCargar: number
  fueraDeFiltros: number
}

export function PestanaValidos(props: Props) {
  const { ordenados, seleccion } = props
  const p = usePaginacion(ordenados.length)
  if (props.totalValidos === 0) {
    return <Vacio>No hay registros válidos todavía.</Vacio>
  }

  const visibles = paginar(ordenados, p.pagina, p.tamano)
  const marcadasPagina = visibles.filter((r) => seleccion.has(r.clave)).length
  const filtrando = props.interpretados.activos > 0

  const cambiarSeleccion = (claves: string[], marcar: boolean) => {
    const nueva = new Set(seleccion)
    for (const c of claves) {
      if (marcar) nueva.add(c)
      else nueva.delete(c)
    }
    props.onSeleccion(nueva)
  }

  // Pulsar el encabezado activo invierte el sentido; otro, ordena ascendente.
  const ordenarPor = (campo: string) =>
    props.onOrden({
      campo: campo as CampoOrden,
      direccion:
        props.orden.campo === campo && props.orden.direccion === "asc"
          ? "desc"
          : "asc",
    })

  const todasElegidas =
    ordenados.length > 0 && props.seleccionadosParaCargar === ordenados.length

  return (
    <div className="grid gap-3">
      <BarraVista
        acciones={
          <>
            <PanelFiltros {...props} />
            {seleccion.size > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => props.onSeleccion(new Set())}
              >
                Quitar selección
              </Button>
            )}
            {!todasElegidas && (
              <Button
                size="sm"
                disabled={ordenados.length === 0}
                onClick={() =>
                  cambiarSeleccion(
                    ordenados.map((r) => r.clave),
                    true
                  )
                }
              >
                Elegir los {n(ordenados.length)}
              </Button>
            )}
          </>
        }
      >
        <Recuento
          valor={ordenados.length}
          texto={
            filtrando
              ? `de ${n(props.totalValidos)} cumplen los filtros`
              : "registros válidos"
          }
        />
        {props.seleccionadosParaCargar > 0 && (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary tabular-nums">
            {n(props.seleccionadosParaCargar)} elegidos
          </span>
        )}
        {props.fueraDeFiltros > 0 && (
          <span
            className="flex items-center gap-1 text-amber-700 dark:text-amber-300"
            title="Están elegidos pero no cumplen los filtros actuales: no se subirán."
          >
            <WarningIcon weight="fill" className="size-3.5" aria-hidden />
            {n(props.fueraDeFiltros)} fuera de los filtros
          </span>
        )}
      </BarraVista>

      {ordenados.length === 0 ? (
        <Vacio>Ningún registro cumple los filtros.</Vacio>
      ) : (
        <>
          <TablaDatos
            filas={visibles}
            orden={props.orden}
            onOrden={ordenarPor}
            seleccionada={(r) => seleccion.has(r.clave)}
            antes={[
              {
                id: "elegir",
                className: "w-10",
                titulo: (
                  <Checkbox
                    aria-label="Elegir las filas de esta página"
                    checked={marcadasPagina === visibles.length}
                    indeterminate={
                      marcadasPagina > 0 && marcadasPagina < visibles.length
                    }
                    onCheckedChange={(v) =>
                      cambiarSeleccion(
                        visibles.map((r) => r.clave),
                        v
                      )
                    }
                  />
                ),
                celda: (r) => (
                  <Checkbox
                    aria-label={`Elegir ${r.ciudad} ${r.fecha_hora}`}
                    checked={seleccion.has(r.clave)}
                    onCheckedChange={(v) => cambiarSeleccion([r.clave], v)}
                  />
                ),
              },
            ]}
          />
          <Paginacion p={p} />
        </>
      )}
    </div>
  )
}

/** Filtros dentro de un popup: solo se ven si se piden. */
function PanelFiltros(props: Props) {
  const { filtros, interpretados } = props
  const set = (cambios: Partial<Filtros>) =>
    props.onFiltros({ ...filtros, ...cambios })

  const alternarCiudad = (ciudad: string) => {
    const actual = new Set(filtros.ciudades ?? props.ciudadesDisponibles)
    if (actual.has(ciudad)) actual.delete(ciudad)
    else actual.add(ciudad)
    const todas = props.ciudadesDisponibles.every((c) => actual.has(c))
    set({
      ciudades: todas
        ? null
        : props.ciudadesDisponibles.filter((c) => actual.has(c)),
    })
  }

  const rango = (
    etiqueta: string,
    unidad: string,
    min: keyof Filtros,
    max: keyof Filtros
  ) => (
    <Campo etiqueta={etiqueta}>
      <div className="flex items-center gap-1.5">
        {[min, max].map((id, i) => (
          <Input
            key={id}
            aria-label={`${etiqueta} ${i === 0 ? "mínima" : "máxima"}`}
            inputMode="decimal"
            placeholder={i === 0 ? "mín." : "máx."}
            value={filtros[id] as string}
            onChange={(e) => set({ [id]: e.target.value } as Partial<Filtros>)}
            className="h-8 w-20 text-right text-xs"
          />
        ))}
        <span className="w-6 text-xs text-muted-foreground">{unidad}</span>
      </div>
    </Campo>
  )

  return (
    <Popover.Root>
      <Popover.Trigger
        render={
          <Button
            size="sm"
            variant="outline"
            className={cn(
              interpretados.activos > 0 && "bg-primary/10 text-primary"
            )}
          />
        }
      >
        <FunnelIcon data-icon="inline-start" />
        Filtros
        {interpretados.activos > 0 && (
          <span className="tabular-nums">({interpretados.activos})</span>
        )}
        {interpretados.errores.length > 0 && (
          <span aria-hidden className="size-1.5 rounded-full bg-red-500" />
        )}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner
          side="bottom"
          align="end"
          sideOffset={8}
          collisionPadding={16}
          className="z-50"
        >
          <Popover.Popup
            className={cn(
              "grid w-[22rem] origin-(--transform-origin) gap-3 rounded-2xl p-4 text-xs transition duration-150 outline-none data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0",
              VIDRIO_OPACO
            )}
          >
            <div className="flex items-center justify-between">
              <Popover.Title className="texto-encabezado">
                Filtros
              </Popover.Title>
              <Button
                size="xs"
                variant="ghost"
                disabled={interpretados.activos === 0}
                onClick={() => props.onFiltros(FILTROS_INICIALES)}
              >
                Restablecer
              </Button>
            </div>

            <Campo etiqueta="Ciudades">
              <div className="flex flex-wrap justify-end gap-1">
                {props.ciudadesDisponibles.map((c) => {
                  const activa =
                    filtros.ciudades === null || filtros.ciudades.includes(c)
                  return (
                    <button
                      key={c}
                      type="button"
                      aria-pressed={activa}
                      onClick={() => alternarCiudad(c)}
                      className={cn(
                        "h-7 rounded-full px-2.5 font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                        activa
                          ? "bg-primary text-primary-foreground"
                          : "bg-black/[0.06] text-muted-foreground dark:bg-white/[0.1]"
                      )}
                    >
                      {c}
                    </button>
                  )
                })}
              </div>
            </Campo>
            <Campo etiqueta="Desde (UTC)">
              <Input
                type="datetime-local"
                aria-label="Desde, en UTC"
                value={filtros.desde}
                onChange={(e) => set({ desde: e.target.value })}
                className="h-8 w-auto text-xs"
              />
            </Campo>
            <Campo etiqueta="Hasta (UTC)">
              <Input
                type="datetime-local"
                aria-label="Hasta, en UTC"
                value={filtros.hasta}
                onChange={(e) => set({ hasta: e.target.value })}
                className="h-8 w-auto text-xs"
              />
            </Campo>
            {rango("Temperatura", "°C", "temperaturaMin", "temperaturaMax")}
            {rango("Humedad", "%", "humedadMin", "humedadMax")}
            {rango(
              "Precipitación",
              "mm",
              "precipitacionMin",
              "precipitacionMax"
            )}
            <label className="flex cursor-pointer items-center justify-between gap-3">
              <span className="text-muted-foreground">Solo con lluvia</span>
              <Checkbox
                checked={filtros.soloLluvia}
                onCheckedChange={(v) => set({ soloLluvia: v })}
              />
            </label>

            {interpretados.errores.length > 0 && (
              <ul className="grid gap-1 rounded-xl bg-red-500/10 p-2.5 text-red-700 dark:text-red-300">
                {interpretados.errores.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            )}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}

function Campo({
  etiqueta,
  children,
}: {
  etiqueta: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="shrink-0 text-muted-foreground">{etiqueta}</span>
      {children}
    </div>
  )
}
