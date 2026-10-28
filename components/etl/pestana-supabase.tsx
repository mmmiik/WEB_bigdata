"use client"

import { Popover } from "@base-ui/react/popover"
import {
  ArrowClockwiseIcon,
  FunnelIcon,
  WarningIcon,
} from "@phosphor-icons/react"
import * as React from "react"

import {
  n,
  Paginacion,
  usePaginacion,
  Vacio,
  VIDRIO_OPACO,
} from "@/components/etl/comun"
import {
  AvisoSupabase,
  type EstadoSupabase,
} from "@/components/etl/pestana-carga"
import {
  BarraVista,
  fechaUtc,
  Recuento,
  TablaDatos,
  type OrdenTabla,
} from "@/components/etl/vista-datos"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NOMBRES_CIUDADES } from "@/lib/etl/ciudades"
import { cn } from "@/lib/utils"

interface FilaRemota {
  id: number
  ciudad: string
  fecha_hora: string
  temperatura_c: number
  humedad_pct: number
  precipitacion_mm: number
  importado_en: string
}

const CAMPOS_REMOTOS = [
  "ciudad",
  "fecha_hora",
  "temperatura_c",
  "humedad_pct",
  "precipitacion_mm",
  "importado_en",
]

function isoUtc(valor: string) {
  return new Date(valor).toISOString().replace(/\.000Z$/, "Z")
}

export function PestanaSupabase({
  supabase,
  pendientesLocales,
  version,
}: {
  supabase: EstadoSupabase | null
  pendientesLocales: number
  /** Cambia tras cada carga para refrescar automáticamente. */
  version: number
}) {
  const [ciudad, setCiudad] = React.useState<string | null>(null)
  const [desde, setDesde] = React.useState("")
  const [hasta, setHasta] = React.useState("")
  // ORDER BY de la consulta: se elige pulsando los encabezados.
  const [orden, setOrden] = React.useState<OrdenTabla>({
    campo: "fecha_hora",
    direccion: "asc",
  })
  const [total, setTotal] = React.useState(0)
  const [filas, setFilas] = React.useState<FilaRemota[]>([])
  const [estado, setEstado] = React.useState<"inactivo" | "cargando" | "error">(
    "inactivo"
  )
  const [error, setError] = React.useState<string | null>(null)
  const [leidoEn, setLeidoEn] = React.useState<string | null>(null)
  const [recargas, setRecargas] = React.useState(0)
  const p = usePaginacion(total)
  const disponible = supabase?.configurado === true && supabase.tablaAccesible
  const { pagina, tamano } = p

  React.useEffect(() => {
    if (!disponible) return
    const control = new AbortController()
    const params = new URLSearchParams({
      orden: orden.campo,
      dir: orden.direccion,
      pagina: String(pagina),
      tamano: String(tamano),
    })
    if (ciudad) params.append("ciudad", ciudad)
    if (desde) params.set("desde", desde)
    if (hasta) params.set("hasta", hasta)

    async function leer() {
      setEstado("cargando")
      try {
        const res = await fetch(`/api/supabase/mediciones?${params}`, {
          signal: control.signal,
          cache: "no-store",
        })
        const json = await res.json()
        if (!res.ok || !json.ok)
          throw new Error(json.error ?? `HTTP ${res.status}`)
        setFilas(json.filas)
        setTotal(json.total)
        setError(null)
        setEstado("inactivo")
        setLeidoEn(new Date().toLocaleTimeString("es-ES"))
      } catch (e) {
        if (control.signal.aborted) return
        setError(e instanceof Error ? e.message : String(e))
        setEstado("error")
      }
    }
    void leer()
    return () => control.abort()
  }, [
    disponible,
    ciudad,
    desde,
    hasta,
    orden,
    pagina,
    tamano,
    recargas,
    version,
  ])

  const cambiar =
    <T,>(fn: (v: T) => void) =>
    (v: T) => {
      fn(v)
      p.setPagina(1)
    }

  const ordenarPor = cambiar((campo: string) =>
    setOrden((o) => ({
      campo,
      direccion: o.campo === campo && o.direccion === "asc" ? "desc" : "asc",
    }))
  )
  const filtrosActivos = [ciudad, desde, hasta].filter(Boolean).length

  return (
    <div className="grid gap-3">
      <AvisoSupabase estado={supabase} />

      <BarraVista
        acciones={
          <>
            <Popover.Root>
              <Popover.Trigger
                render={
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!disponible}
                    className={cn(
                      filtrosActivos > 0 && "bg-primary/10 text-primary"
                    )}
                  />
                }
              >
                <FunnelIcon data-icon="inline-start" />
                Filtros
                {filtrosActivos > 0 && (
                  <span className="tabular-nums">({filtrosActivos})</span>
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
                        disabled={filtrosActivos === 0}
                        onClick={() => {
                          setCiudad(null)
                          setDesde("")
                          setHasta("")
                          p.setPagina(1)
                        }}
                      >
                        Restablecer
                      </Button>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Ciudad</span>
                      <div className="flex flex-wrap justify-end gap-1">
                        {[null, ...NOMBRES_CIUDADES].map((c) => (
                          <button
                            key={c ?? "todas"}
                            type="button"
                            aria-pressed={ciudad === c}
                            onClick={() => cambiar(setCiudad)(c)}
                            className={cn(
                              "h-7 rounded-full px-2.5 font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                              ciudad === c
                                ? "bg-primary text-primary-foreground"
                                : "bg-black/[0.06] text-muted-foreground dark:bg-white/[0.1]"
                            )}
                          >
                            {c ?? "Todas"}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Desde (UTC)</span>
                      <Input
                        type="date"
                        aria-label="Desde, en UTC"
                        value={desde}
                        onChange={(e) => cambiar(setDesde)(e.target.value)}
                        className="h-8 w-auto text-xs"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Hasta (UTC)</span>
                      <Input
                        type="date"
                        aria-label="Hasta, en UTC, incluido"
                        value={hasta}
                        onChange={(e) => cambiar(setHasta)(e.target.value)}
                        className="h-8 w-auto text-xs"
                      />
                    </div>
                  </Popover.Popup>
                </Popover.Positioner>
              </Popover.Portal>
            </Popover.Root>
            <Button
              size="sm"
              variant="outline"
              disabled={!disponible || estado === "cargando"}
              onClick={() => setRecargas((r) => r + 1)}
              title={leidoEn ? `Última lectura: ${leidoEn}` : undefined}
            >
              <ArrowClockwiseIcon
                data-icon="inline-start"
                className={estado === "cargando" ? "animate-spin" : undefined}
              />
              Actualizar
            </Button>
          </>
        }
      >
        <Recuento
          valor={total}
          texto={
            filtrosActivos > 0
              ? "filas guardadas con estos filtros"
              : "filas guardadas"
          }
        />
        {pendientesLocales > 0 && (
          <span className="rounded-full bg-black/[0.06] px-2 py-0.5 text-muted-foreground tabular-nums dark:bg-white/[0.1]">
            {n(pendientesLocales)} elegidos sin subir
          </span>
        )}
      </BarraVista>

      {error && (
        <Alert variant="destructive">
          <WarningIcon weight="fill" />
          <AlertTitle>No se pudo leer Supabase</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!disponible ? (
        <Vacio>Disponible cuando Supabase esté configurado.</Vacio>
      ) : filas.length === 0 && estado !== "cargando" ? (
        <Vacio>No hay filas guardadas con estos filtros.</Vacio>
      ) : (
        <>
          <TablaDatos
            filas={filas.map((f) => ({
              ...f,
              clave: String(f.id),
              fecha_hora: isoUtc(f.fecha_hora),
            }))}
            orden={orden}
            onOrden={ordenarPor}
            ordenables={CAMPOS_REMOTOS}
            despues={[
              {
                id: "importado_en",
                titulo: "Subido (UTC)",
                className: "text-muted-foreground tabular-nums",
                celda: (f) => fechaUtc(isoUtc(f.importado_en)),
              },
            ]}
          />
          <Paginacion p={p} />
        </>
      )}
    </div>
  )
}
