"use client"

import { AlertTriangleIcon, DownloadCloudIcon, InfoIcon } from "lucide-react"

import { n } from "@/components/etl/comun"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CIUDADES, type CiudadId } from "@/lib/etl/ciudades"
import { VARIABLES_HORARIAS } from "@/lib/etl/extraccion"
import {
  FECHA_MINIMA_ARCHIVO,
  MAX_DIAS_EXTRACCION,
  type ValidacionPeriodo,
} from "@/lib/etl/fechas"

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

  const alternar = (id: CiudadId, marcada: boolean) => {
    const set = new Set(ciudades)
    if (marcada) set.add(id)
    else set.delete(id)
    // Se mantiene el orden canónico de las ciudades.
    props.onCiudades(CIUDADES.map((c) => c.id).filter((c) => set.has(c)))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
            1
          </span>
          Configuración de la extracción
        </CardTitle>
        <CardDescription>
          API histórica de Open-Meteo · variables horarias de temperatura a 2 m,
          humedad relativa y precipitación · fechas en UTC.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr_1fr]">
        <fieldset className="grid grid-cols-1 gap-2">
          <legend className="mb-2 text-sm font-medium">Ciudades</legend>
          <div className="flex flex-wrap gap-2">
            {CIUDADES.map((c) => {
              const marcada = ciudades.includes(c.id)
              return (
                <Label
                  key={c.id}
                  className="cursor-pointer rounded-lg border px-3 py-2 font-normal has-data-checked:border-primary has-data-checked:bg-muted"
                >
                  <Checkbox
                    checked={marcada}
                    disabled={props.ocupado}
                    onCheckedChange={(v) => alternar(c.id, v)}
                  />
                  <span>
                    {c.nombre}
                    <span className="block text-xs text-muted-foreground tabular-nums">
                      {c.latitud}, {c.longitud}
                    </span>
                  </span>
                </Label>
              )
            })}
          </div>
          <div className="flex gap-2 text-xs">
            <Button
              variant="link"
              size="xs"
              className="px-0"
              disabled={props.ocupado}
              onClick={() => props.onCiudades(CIUDADES.map((c) => c.id))}
            >
              Todas
            </Button>
            <Button
              variant="link"
              size="xs"
              className="px-0"
              disabled={props.ocupado}
              onClick={() => props.onCiudades([])}
            >
              Ninguna
            </Button>
          </div>
        </fieldset>

        <fieldset className="grid content-start gap-3">
          <legend className="mb-2 text-sm font-medium">
            Periodo (máx. {MAX_DIAS_EXTRACCION} días)
          </legend>
          <div className="grid grid-cols-1 gap-1.5">
            <Label htmlFor="fecha-inicio">Fecha inicial</Label>
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
          <div className="grid grid-cols-1 gap-1.5">
            <Label htmlFor="fecha-fin">Fecha final (incluida)</Label>
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
        </fieldset>

        <div className="grid content-start gap-3">
          <div className="rounded-lg bg-muted/60 p-3 text-sm">
            <p className="font-medium">Volumen previsto</p>
            {errores.length === 0 ? (
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 tabular-nums">
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
          <Button
            size="lg"
            disabled={errores.length > 0 || props.ocupado}
            onClick={props.onExtraer}
          >
            <DownloadCloudIcon data-icon="inline-start" />
            Extraer datos
          </Button>
          {props.ocupado && props.motivoOcupado && (
            <p className="text-xs text-muted-foreground">
              {props.motivoOcupado}
            </p>
          )}
        </div>

        {errores.length > 0 && (
          <Alert variant="destructive" className="lg:col-span-3">
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
          <Alert className="lg:col-span-3">
            <InfoIcon />
            <AlertTitle>Aviso</AlertTitle>
            <AlertDescription>{periodo.avisos.join(" ")}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}
