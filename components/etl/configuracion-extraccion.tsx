"use client"

import {
  CheckCircleIcon,
  CircleIcon,
  InfoIcon,
  PlayIcon,
  WarningIcon,
} from "@phosphor-icons/react"

import { Fila, n, plural, Seccion } from "@/components/etl/comun"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CIUDADES, type CiudadId } from "@/lib/etl/ciudades"
import { VARIABLES_HORARIAS } from "@/lib/etl/extraccion"
import { FECHA_MINIMA_ARCHIVO, type ValidacionPeriodo } from "@/lib/etl/fechas"
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
  const calculable = errores.length === 0

  return (
    <div className="grid gap-4">
      <Seccion
        titulo="Ciudades"
        accion={
          <span className="flex gap-3">
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
          </span>
        }
      >
        {CIUDADES.map((c) => {
          const marcada = ciudades.includes(c.id)
          const Marca = marcada ? CheckCircleIcon : CircleIcon
          return (
            <button
              key={c.id}
              type="button"
              aria-pressed={marcada}
              disabled={props.ocupado}
              title={`${c.latitud}, ${c.longitud}`}
              onClick={() => props.onCiudades(alternarCiudad(ciudades, c.id))}
              className="flex min-h-9 w-full items-center gap-2.5 px-3 py-1.5 text-left text-xs transition-colors outline-none hover:bg-black/[0.03] focus-visible:bg-black/[0.05] disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-white/[0.04] dark:focus-visible:bg-white/[0.06]"
            >
              <Marca
                aria-hidden
                weight={marcada ? "fill" : "regular"}
                className={cn(
                  "size-[18px] shrink-0",
                  marcada ? "text-blue-500" : "text-muted-foreground/50"
                )}
              />
              <span className="flex-1">{c.nombre}</span>
            </button>
          )
        })}
      </Seccion>

      <Seccion titulo="Periodo">
        <Fila etiqueta={<label htmlFor="fecha-inicio">Desde</label>}>
          <InputFecha
            {...props}
            id="fecha-inicio"
            value={props.inicio}
            onChange={props.onInicio}
          />
        </Fila>
        <Fila etiqueta={<label htmlFor="fecha-fin">Hasta, incluida</label>}>
          <InputFecha
            {...props}
            id="fecha-fin"
            value={props.fin}
            onChange={props.onFin}
          />
        </Fila>
      </Seccion>

      <div className="grid gap-3">
        {errores.length > 0 && (
          <Alert variant="destructive">
            <WarningIcon weight="fill" />
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
            <InfoIcon weight="fill" />
            <AlertTitle>Aviso</AlertTitle>
            <AlertDescription>{periodo.avisos.join(" ")}</AlertDescription>
          </Alert>
        )}
        {calculable && (
          // Resumen del volumen previsto: una línea; el desglose, en el título.
          <p
            className="text-center text-xs text-muted-foreground"
            title={`${n(dias)} días × 24 h × ${plural(ciudades.length, "ciudad", "ciudades")} = ${n(registros)} registros, ${n(valores)} valores`}
          >
            {plural(ciudades.length, "petición", "peticiones")} y {n(registros)}{" "}
            registros previstos
          </p>
        )}
        <Button
          size="xl"
          className="w-full shadow-md shadow-primary/30"
          disabled={errores.length > 0 || props.ocupado}
          onClick={props.onExtraer}
        >
          <PlayIcon weight="fill" data-icon="inline-start" />
          Extraer datos
        </Button>
        {props.ocupado && props.motivoOcupado && (
          <p className="text-center text-xs text-muted-foreground">
            {props.motivoOcupado}
          </p>
        )}
      </div>
    </div>
  )
}

/** Fecha compacta dentro de una fila, como el selector de fecha de iOS. */
function InputFecha({
  id,
  value,
  onChange,
  hoy,
  ocupado,
  periodo,
}: Props & {
  id: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <Input
      id={id}
      type="date"
      value={value}
      min={FECHA_MINIMA_ARCHIVO}
      max={hoy}
      disabled={ocupado}
      aria-invalid={periodo.errores.length > 0}
      onChange={(e) => onChange(e.target.value)}
      className="h-7 w-auto rounded-md border-0 bg-black/[0.05] px-2 text-xs tabular-nums shadow-none dark:bg-white/[0.08]"
    />
  )
}
