"use client"

import { AlertTriangleIcon, DownloadCloudIcon, InfoIcon } from "lucide-react"

import { n } from "@/components/etl/comun"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CIUDADES, type CiudadId } from "@/lib/etl/ciudades"
import { VARIABLES_HORARIAS } from "@/lib/etl/extraccion"
import {
  FECHA_MINIMA_ARCHIVO,
  MAX_DIAS_EXTRACCION,
  type ValidacionPeriodo,
} from "@/lib/etl/fechas"
import { cn } from "@/lib/utils"

interface Props {
  ciudades: CiudadId[]
  onCiudades: (c: CiudadId[]) => void
  inicio: string
  fin: string
  onInicio: (v: string) => void
  onFin: (v: string) => void
  periodo: ValidacionPeriodo
  hoy: string
  ocupado: boolean
  motivoOcupado?: string
  onExtraer: () => void
}

/** Alterna una ciudad manteniendo el orden canónico. */
export function alternarCiudad(ciudades: CiudadId[], id: CiudadId): CiudadId[] {
  const set = new Set(ciudades)
  if (set.has(id)) set.delete(id)
  else set.add(id)
  return CIUDADES.map((c) => c.id).filter((c) => set.has(c))
}

export function ConfiguracionExtraccion(props: Props) {
  const { ciudades, periodo } = props
  const sinCiudades = ciudades.length === 0
  const errores = [
    ...(sinCiudades ? ["Selecciona al menos una ciudad."] : []),
    ...periodo.errores,
  ]
  const dias = periodo.dias ?? 0
  const registros = ciudades.length * dias * 24
  const valores = registros * VARIABLES_HORARIAS.length

  return (
    <div className="grid gap-5">
      <p className="text-xs leading-relaxed text-muted-foreground">
        API histórica de Open-Meteo · temperatura a 2 m, humedad relativa y
        precipitación por horas · fechas en UTC.
      </p>

      <fieldset className="grid gap-2">
        <div className="flex items-baseline justify-between">
          <legend className="text-sm font-medium">Ciudades</legend>
          <div className="flex gap-3 text-xs">
            <Button
              variant="link"
              size="xs"
              className="h-auto px-0"
              disabled={props.ocupado}
              onClick={() => props.onCiudades(CIUDADES.map((c) => c.id))}
            >
              Todas
            </Button>
            <Button
              variant="link"
              size="xs"
              className="h-auto px-0"
              disabled={props.ocupado}
              onClick={() => props.onCiudades([])}
            >
              Ninguna
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {CIUDADES.map((c) => {
            const marcada = ciudades.includes(c.id)
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={marcada}
                disabled={props.ocupado}
                title={`${c.latitud}, ${c.longitud}`}
                onClick={() => props.onCiudades(alternarCiudad(ciudades, c.id))}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50",
                  marcada
                    ? "border-transparent bg-primary text-primary-foreground"
                    : "border-black/10 text-muted-foreground hover:text-foreground dark:border-white/15"
                )}
              >
                {c.nombre}
              </button>
            )
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          También puedes elegirlas pulsando sobre el mapa.
        </p>
      </fieldset>

      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-medium">
          Periodo{" "}
          <span className="font-normal text-muted-foreground">
            (máx. {MAX_DIAS_EXTRACCION} días)
          </span>
        </legend>
        <div className="grid grid-cols-2 gap-2">
          <div className="grid gap-1">
            <Label htmlFor="fecha-inicio" className="text-xs">
              Desde
            </Label>
            <Input
              id="fecha-inicio"
              type="date"
              value={props.inicio}
              min={FECHA_MINIMA_ARCHIVO}
              max={props.hoy}
              disabled={props.ocupado}
              aria-invalid={periodo.errores.length > 0}
              onChange={(e) => props.onInicio(e.target.value)}
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="fecha-fin" className="text-xs">
              Hasta (incluida)
            </Label>
            <Input
              id="fecha-fin"
              type="date"
              value={props.fin}
              min={FECHA_MINIMA_ARCHIVO}
              max={props.hoy}
              disabled={props.ocupado}
              aria-invalid={periodo.errores.length > 0}
              onChange={(e) => props.onFin(e.target.value)}
            />
          </div>
        </div>
      </fieldset>

      <div className="rounded-xl bg-black/[0.04] p-3 text-xs dark:bg-white/[0.06]">
        <p className="font-medium">Volumen previsto</p>
        {errores.length === 0 ? (
          <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 tabular-nums">
            <dt className="text-muted-foreground">Peticiones</dt>
            <dd>{n(ciudades.length)} (una por ciudad)</dd>
            <dt className="text-muted-foreground">Días</dt>
            <dd>{n(dias)}</dd>
            <dt className="text-muted-foreground">Registros</dt>
            <dd>
              {n(registros)}{" "}
              <span className="text-muted-foreground">
                = {ciudades.length} × {dias} × 24 h
              </span>
            </dd>
            <dt className="text-muted-foreground">Valores</dt>
            <dd>
              {n(valores)}{" "}
              <span className="text-muted-foreground">(3 variables)</span>
            </dd>
          </dl>
        ) : (
          <p className="mt-1 text-muted-foreground">
            Corrige la configuración para calcularlo.
          </p>
        )}
      </div>

      {errores.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangleIcon />
          <AlertTitle>No se puede extraer todavía</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4">
              {errores.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
      {errores.length === 0 && periodo.avisos.length > 0 && (
        <Alert>
          <InfoIcon />
          <AlertTitle>Aviso</AlertTitle>
          <AlertDescription>{periodo.avisos.join(" ")}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-1.5">
        <Button
          size="lg"
          disabled={errores.length > 0 || props.ocupado}
          onClick={props.onExtraer}
        >
          <DownloadCloudIcon data-icon="inline-start" />
          Extraer datos
        </Button>
        {props.ocupado && props.motivoOcupado && (
          <p className="text-xs text-muted-foreground">{props.motivoOcupado}</p>
        )}
      </div>
    </div>
  )
}
