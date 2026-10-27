"use client"

import "maplibre-gl/dist/maplibre-gl.css"

import { MinusIcon, PlusIcon, ScanIcon } from "lucide-react"
import type { Map as MapaMapLibre } from "maplibre-gl"
import { useTheme } from "next-themes"
import * as React from "react"
import { createPortal } from "react-dom"

import { IconoEstado, VIDRIO, type EstadoFase } from "@/components/etl/comun"
import { Button } from "@/components/ui/button"
import { CIUDADES, type Ciudad, type CiudadId } from "@/lib/etl/ciudades"
import { cn } from "@/lib/utils"

/** La clave de MapTiler se usa en el navegador: restríngela por dominio en MapTiler. */
const CLAVE_MAPTILER = process.env.NEXT_PUBLIC_MAPTILER_KEY?.trim()

type Tema = "light" | "dark"

/** Estilos en escala de grises: mar gris claro / casi negro, nunca azul. */
const ESTILOS: Record<Tema, string> = {
  light: "dataviz-light",
  dark: "dataviz-dark",
}

const urlEstilo = (tema: Tema) =>
  `https://api.maptiler.com/maps/${ESTILOS[tema]}/style.json?key=${CLAVE_MAPTILER}`

/** Península y Baleares (oeste, sur, este, norte). */
const ESPANA: [number, number, number, number] = [-9.4, 35.9, 4.4, 43.8]

export interface Margenes {
  top: number
  right: number
  bottom: number
  left: number
}

export function MapaEspana({
  seleccionadas,
  onAlternar,
  estados,
  bloqueado,
  margenes,
  className,
}: {
  seleccionadas: readonly CiudadId[]
  onAlternar: (id: CiudadId) => void
  /** Estado de la última extracción por ciudad. */
  estados: Partial<Record<CiudadId, EstadoFase>>
  bloqueado: boolean
  /** Zona tapada por las cajas: España se encuadra en el hueco que queda. */
  margenes: Margenes
  className?: string
}) {
  const { resolvedTheme } = useTheme()
  const tema: Tema | null =
    resolvedTheme === "dark" ? "dark" : resolvedTheme ? "light" : null
  const hayTema = tema !== null

  const contenedor = React.useRef<HTMLDivElement>(null)
  const temaRef = React.useRef(tema)
  const estiloAplicado = React.useRef<Tema | null>(null)
  const margenesRef = React.useRef(margenes)
  const [mapa, setMapa] = React.useState<MapaMapLibre | null>(null)
  const [marcadores, setMarcadores] = React.useState<
    { ciudad: Ciudad; el: HTMLElement }[]
  >([])
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    temaRef.current = tema
    margenesRef.current = margenes
  })

  // El mapa se crea una sola vez, cuando ya se conoce el tema.
  React.useEffect(() => {
    if (!CLAVE_MAPTILER || !hayTema || !contenedor.current) return
    let cancelado = false
    let m: MapaMapLibre | null = null

    // maplibre-gl usa window/WebGL: se carga solo en el navegador.
    import("maplibre-gl").then((maplibre) => {
      if (cancelado || !contenedor.current) return
      const { Map, Marker } = maplibre
      // Copiado a public/ en postinstall (scripts/copiar-worker-maplibre.mjs).
      maplibre.setWorkerUrl("/maplibre-gl-worker.mjs")
      const tema = temaRef.current ?? "light"
      estiloAplicado.current = tema
      m = new Map({
        container: contenedor.current,
        style: urlEstilo(tema),
        bounds: ESPANA,
        fitBoundsOptions: { padding: margenesRef.current },
        // Sin giro ni inclinación: solo acercar y alejar.
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
        renderWorldCopies: false,
        maxZoom: 10,
        attributionControl: { compact: true },
      })
      m.touchZoomRotate.disableRotation()
      m.keyboard.disableRotation()
      m.on("error", (e) => {
        const estado = (e.error as { status?: number } | undefined)?.status
        if (estado === 401 || estado === 403)
          setError(
            "MapTiler ha rechazado la clave (¿es correcta y está permitido este dominio?)."
          )
        // Con un manejador propio maplibre deja de mostrar el error en consola.
        console.error("[mapa]", e.error)
      })

      const lista = CIUDADES.map((ciudad) => {
        const el = document.createElement("div")
        new Marker({ element: el, anchor: "bottom", offset: [0, 5] })
          .setLngLat([ciudad.longitud, ciudad.latitud])
          .addTo(m!)
        return { ciudad, el }
      })
      setMarcadores(lista)
      setMapa(m)
    })

    return () => {
      cancelado = true
      m?.remove()
    }
  }, [hayTema])

  // Encuadre fijo: el zoom mínimo y los límites son los de España, así que
  // solo se puede acercar y, ya acercado, moverse sin salir de ella.
  const { top, right, bottom, left } = margenes
  React.useEffect(() => {
    if (!mapa) return
    const encuadrar = () => {
      mapa.setMaxBounds(null)
      mapa.setMinZoom(null)
      mapa.fitBounds(ESPANA, {
        padding: { top, right, bottom, left },
        animate: false,
      })
      mapa.setMinZoom(mapa.getZoom())
      mapa.setMaxBounds(mapa.getBounds())
    }
    encuadrar()
    mapa.on("resize", encuadrar)
    return () => {
      mapa.off("resize", encuadrar)
    }
  }, [mapa, top, right, bottom, left])

  React.useEffect(() => {
    if (!mapa || !tema || estiloAplicado.current === tema) return
    estiloAplicado.current = tema
    mapa.setStyle(urlEstilo(tema))
  }, [mapa, tema])

  const reencuadrar = () =>
    mapa?.fitBounds(ESPANA, { padding: { top, right, bottom, left } })

  return (
    <div
      className={cn(
        "relative overflow-hidden bg-[hsl(240_2%_88%)] dark:bg-[hsl(0_0%_8%)]",
        // La atribución queda en el hueco central, no debajo de las cajas.
        "[&_.maplibregl-ctrl-bottom-right]:right-(--margen-dcho)!",
        // maplibre pinta la atribución en blanco; en oscuro se adapta.
        "dark:[&_.maplibregl-ctrl-attrib]:bg-zinc-900/70! dark:[&_.maplibregl-ctrl-attrib_a]:text-zinc-300! dark:[&_.maplibregl-ctrl-attrib-button]:invert",
        className
      )}
      style={{ "--margen-dcho": `${right}px` } as React.CSSProperties}
    >
      {!CLAVE_MAPTILER ? (
        <p className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-muted-foreground">
          Mapa no disponible: falta NEXT_PUBLIC_MAPTILER_KEY.
        </p>
      ) : (
        <div
          ref={contenedor}
          // maplibre fuerza position: relative en el contenedor: se usa h-full.
          className="h-full w-full"
          aria-label="Mapa de España con las ciudades seleccionables"
        />
      )}

      {marcadores.map(({ ciudad, el }) =>
        createPortal(
          <BotonCiudad
            ciudad={ciudad}
            seleccionada={seleccionadas.includes(ciudad.id)}
            estado={estados[ciudad.id]}
            bloqueado={bloqueado}
            onAlternar={() => onAlternar(ciudad.id)}
          />,
          el,
          ciudad.id
        )
      )}

      <div
        className="pointer-events-none absolute flex justify-center px-2"
        style={{ top: 16, left, right }}
      >
        <p
          className={cn(
            "rounded-full px-3 py-1 text-xs",
            VIDRIO,
            error ? "text-red-700 dark:text-red-300" : "text-muted-foreground"
          )}
        >
          {error ?? "Pulsa una ciudad para incluirla o quitarla"}
        </p>
      </div>

      {mapa && (
        <div
          className="pointer-events-none absolute flex justify-center"
          style={{ bottom: 40, left, right }}
        >
          <div
            className={cn(
              "pointer-events-auto flex items-center gap-0.5 rounded-full p-1",
              VIDRIO
            )}
          >
            <Button
              variant="ghost"
              size="icon-sm"
              className="rounded-full"
              aria-label="Alejar"
              onClick={() => mapa.zoomOut()}
            >
              <MinusIcon />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="rounded-full"
              aria-label="Ver toda España"
              onClick={reencuadrar}
            >
              <ScanIcon />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="rounded-full"
              aria-label="Acercar"
              onClick={() => mapa.zoomIn()}
            >
              <PlusIcon />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function BotonCiudad({
  ciudad,
  seleccionada,
  estado,
  bloqueado,
  onAlternar,
}: {
  ciudad: Ciudad
  seleccionada: boolean
  estado: EstadoFase | undefined
  bloqueado: boolean
  onAlternar: () => void
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        aria-pressed={seleccionada}
        disabled={bloqueado}
        title={
          seleccionada
            ? `Quitar ${ciudad.nombre} de la extracción`
            : `Incluir ${ciudad.nombre} en la extracción`
        }
        onClick={onAlternar}
        // Evita que un doble clic sobre el botón acerque el mapa.
        onDoubleClick={(e) => e.stopPropagation()}
        className={cn(
          "flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed",
          VIDRIO,
          seleccionada
            ? "border-white/30 bg-zinc-900/70 text-white dark:border-white/50 dark:bg-white/75 dark:text-zinc-900"
            : "text-foreground hover:bg-white/80 dark:hover:bg-zinc-900/80"
        )}
      >
        {seleccionada && estado && estado !== "pendiente" ? (
          <IconoEstado estado={estado} className="size-3.5 text-current" />
        ) : (
          <span
            aria-hidden
            className={cn(
              "size-2 rounded-full border-[1.5px] border-current",
              seleccionada && "bg-current"
            )}
          />
        )}
        {ciudad.nombre}
      </button>
      <span
        aria-hidden
        className={cn(
          "size-2.5 rounded-full border-2 border-white bg-zinc-900 shadow dark:border-zinc-900 dark:bg-white",
          !seleccionada && "opacity-50"
        )}
      />
    </div>
  )
}
