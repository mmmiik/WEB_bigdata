"use client"

import {
  AlertTriangleIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  FilterXIcon,
  ListChecksIcon,
  XIcon,
} from "lucide-react"

import {
  ConUnidad,
  dec,
  n,
  Paginacion,
  usePaginacion,
  Vacio,
} from "@/components/etl/comun"
import { celdaFecha } from "@/components/etl/pestanas-datos"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  ETIQUETAS_CAMPO,
  FILTROS_INICIALES,
  paginar,
  type CampoOrden,
  type Filtros,
  type FiltrosInterpretados,
  type Orden,
} from "@/lib/etl/filtros"
import type { RegistroValido } from "@/lib/etl/limpieza"

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
  const { ordenados, seleccion, filtros } = props
  const p = usePaginacion(ordenados.length)
  if (props.totalValidos === 0) {
    return <Vacio>No hay registros válidos todavía.</Vacio>
  }

  const visibles = paginar(ordenados, p.pagina, p.tamano)
  const marcadasPagina = visibles.filter((r) => seleccion.has(r.clave)).length
  const set = (cambios: Partial<Filtros>) =>
    props.onFiltros({ ...filtros, ...cambios })

  const cambiarSeleccion = (claves: string[], marcar: boolean) => {
    const nueva = new Set(seleccion)
    for (const c of claves) {
      if (marcar) nueva.add(c)
      else nueva.delete(c)
    }
    props.onSeleccion(nueva)
  }

  const alternarCiudad = (ciudad: string, marcada: boolean) => {
    const actual = new Set(filtros.ciudades ?? props.ciudadesDisponibles)
    if (marcada) actual.add(ciudad)
    else actual.delete(ciudad)
    const todas = props.ciudadesDisponibles.every((c) => actual.has(c))
    set({
      ciudades: todas
        ? null
        : props.ciudadesDisponibles.filter((c) => actual.has(c)),
    })
  }

  const numero = (id: keyof Filtros, etiqueta: string, placeholder: string) => (
    <div className="grid grid-cols-1 gap-1">
      <Label htmlFor={`f-${id}`} className="text-xs text-muted-foreground">
        {etiqueta}
      </Label>
      <Input
        id={`f-${id}`}
        inputMode="decimal"
        placeholder={placeholder}
        value={filtros[id] as string}
        onChange={(e) => set({ [id]: e.target.value } as Partial<Filtros>)}
      />
    </div>
  )

  return (
    <div className="grid grid-cols-1 gap-4">
      <p className="text-sm text-muted-foreground">
        Orden de operaciones:{" "}
        <strong>
          datos válidos → filtros → ordenación → selección → carga
        </strong>
        . La paginación solo cambia lo que ves; los filtros y el orden se
        aplican a todos los registros.
      </p>

      {/* Filtros */}
      <section
        aria-labelledby="titulo-filtros"
        className="grid grid-cols-1 gap-3 rounded-xl border bg-muted/30 p-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id="titulo-filtros" className="text-sm font-medium">
            Filtros{" "}
            <span className="font-normal text-muted-foreground">
              ({props.interpretados.activos} activos)
            </span>
          </h3>
          <Button
            size="sm"
            variant="outline"
            onClick={() => props.onFiltros(FILTROS_INICIALES)}
          >
            <FilterXIcon data-icon="inline-start" />
            Restablecer filtros
          </Button>
        </div>
        <fieldset className="flex flex-wrap items-center gap-2">
          <legend className="sr-only">Ciudades</legend>
          <span className="text-xs text-muted-foreground">Ciudades:</span>
          {props.ciudadesDisponibles.map((c) => (
            <Label
              key={c}
              className="cursor-pointer rounded-md border bg-background px-2 py-1 font-normal"
            >
              <Checkbox
                checked={
                  filtros.ciudades === null || filtros.ciudades.includes(c)
                }
                onCheckedChange={(v) => alternarCiudad(c, v)}
              />
              {c}
            </Label>
          ))}
        </fieldset>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          <div className="col-span-2 grid gap-1">
            <Label htmlFor="f-desde" className="text-xs text-muted-foreground">
              Desde (UTC, incluido)
            </Label>
            <Input
              id="f-desde"
              type="datetime-local"
              value={filtros.desde}
              onChange={(e) => set({ desde: e.target.value })}
            />
          </div>
          <div className="col-span-2 grid gap-1">
            <Label htmlFor="f-hasta" className="text-xs text-muted-foreground">
              Hasta (UTC, incluido)
            </Label>
            <Input
              id="f-hasta"
              type="datetime-local"
              value={filtros.hasta}
              onChange={(e) => set({ hasta: e.target.value })}
            />
          </div>
          {numero("temperaturaMin", "Temp. mín. (°C)", "sin límite")}
          {numero("temperaturaMax", "Temp. máx. (°C)", "sin límite")}
          {numero("humedadMin", "Humedad mín. (%)", "0")}
          {numero("humedadMax", "Humedad máx. (%)", "100")}
          {numero("precipitacionMin", "Precip. mín. (mm)", "0")}
          {numero("precipitacionMax", "Precip. máx. (mm)", "sin límite")}
          <Label className="col-span-2 cursor-pointer self-end rounded-md border bg-background px-2 py-2 font-normal">
            <Checkbox
              checked={filtros.soloLluvia}
              onCheckedChange={(v) => set({ soloLluvia: v })}
            />
            Solo con lluvia (precipitación &gt; 0)
          </Label>
        </div>
        {props.interpretados.errores.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangleIcon />
            <AlertTitle>Filtros ignorados hasta que se corrijan</AlertTitle>
            <AlertDescription>
              <ul className="list-disc pl-4">
                {props.interpretados.errores.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}
      </section>

      {/* Orden y selección */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="grid grid-cols-1 gap-1">
            <span id="etiqueta-orden" className="text-xs text-muted-foreground">
              Ordenar por
            </span>
            <Select
              value={props.orden.campo}
              onValueChange={(v) =>
                v && props.onOrden({ ...props.orden, campo: v as CampoOrden })
              }
              items={Object.entries(ETIQUETAS_CAMPO).map(([value, label]) => ({
                value,
                label,
              }))}
            >
              <SelectTrigger
                aria-labelledby="etiqueta-orden"
                className="min-w-48"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ETIQUETAS_CAMPO).map(([v, etiqueta]) => (
                  <SelectItem key={v} value={v}>
                    {etiqueta}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div role="group" aria-label="Dirección" className="flex gap-1">
            <Button
              variant={props.orden.direccion === "asc" ? "default" : "outline"}
              aria-pressed={props.orden.direccion === "asc"}
              onClick={() =>
                props.onOrden({ ...props.orden, direccion: "asc" })
              }
            >
              <ArrowUpIcon data-icon="inline-start" />
              Ascendente
            </Button>
            <Button
              variant={props.orden.direccion === "desc" ? "default" : "outline"}
              aria-pressed={props.orden.direccion === "desc"}
              onClick={() =>
                props.onOrden({ ...props.orden, direccion: "desc" })
              }
            >
              <ArrowDownIcon data-icon="inline-start" />
              Descendente
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={ordenados.length === 0}
            onClick={() =>
              cambiarSeleccion(
                ordenados.map((r) => r.clave),
                true
              )
            }
          >
            <ListChecksIcon data-icon="inline-start" />
            Seleccionar las {n(ordenados.length)} que coinciden
          </Button>
          <Button
            variant="outline"
            disabled={seleccion.size === 0}
            onClick={() => props.onSeleccion(new Set())}
          >
            <XIcon data-icon="inline-start" />
            Vaciar selección
          </Button>
        </div>
      </div>

      <p aria-live="polite" className="text-sm">
        <strong className="tabular-nums">{n(ordenados.length)}</strong>{" "}
        coinciden con los filtros ·{" "}
        <strong className="tabular-nums">
          {n(props.seleccionadosParaCargar)}
        </strong>{" "}
        seleccionados para cargar
        {props.fueraDeFiltros > 0 && (
          <span className="ml-1 inline-flex items-center gap-1 text-amber-800 dark:text-amber-300">
            <AlertTriangleIcon className="size-3.5" aria-hidden />
            {n(props.fueraDeFiltros)} seleccionados quedan fuera de los filtros
            y no se subirán
          </span>
        )}
      </p>

      {ordenados.length === 0 ? (
        <Vacio>Ningún registro válido cumple los filtros actuales.</Vacio>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    aria-label="Seleccionar las filas de esta página"
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
                </TableHead>
                <TableHead className="w-12 text-right">#</TableHead>
                {(Object.keys(ETIQUETAS_CAMPO) as CampoOrden[]).map((campo) => (
                  <TableHead
                    key={campo}
                    aria-sort={
                      props.orden.campo === campo
                        ? props.orden.direccion === "asc"
                          ? "ascending"
                          : "descending"
                        : undefined
                    }
                    className={
                      campo === "ciudad" || campo === "fecha_hora"
                        ? ""
                        : "text-right"
                    }
                  >
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 hover:underline"
                      onClick={() =>
                        props.onOrden({
                          campo,
                          direccion:
                            props.orden.campo === campo &&
                            props.orden.direccion === "asc"
                              ? "desc"
                              : "asc",
                        })
                      }
                    >
                      <Encabezado campo={campo} />
                      {props.orden.campo === campo &&
                        (props.orden.direccion === "asc" ? (
                          <ArrowUpIcon className="size-3.5" aria-hidden />
                        ) : (
                          <ArrowDownIcon className="size-3.5" aria-hidden />
                        ))}
                    </button>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibles.map((r, i) => {
                const marcada = seleccion.has(r.clave)
                return (
                  <TableRow
                    key={r.clave}
                    data-state={marcada ? "selected" : undefined}
                  >
                    <TableCell>
                      <Checkbox
                        aria-label={`Seleccionar ${r.ciudad} ${r.fecha_hora}`}
                        checked={marcada}
                        onCheckedChange={(v) => cambiarSeleccion([r.clave], v)}
                      />
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground tabular-nums">
                      {n((p.pagina - 1) * p.tamano + i + 1)}
                    </TableCell>
                    <TableCell>{r.ciudad}</TableCell>
                    <TableCell>{celdaFecha(r.fecha_hora)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {dec(r.temperatura_c)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {dec(r.humedad_pct)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {dec(r.precipitacion_mm)}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
          <Paginacion p={p} etiqueta="registros que coinciden" />
        </>
      )}
    </div>
  )
}

function Encabezado({ campo }: { campo: CampoOrden }) {
  switch (campo) {
    case "temperatura_c":
      return <ConUnidad titulo="Temperatura" unidad="°C" />
    case "humedad_pct":
      return <ConUnidad titulo="Humedad" unidad="%" />
    case "precipitacion_mm":
      return <ConUnidad titulo="Precipitación" unidad="mm" />
    case "fecha_hora":
      return <ConUnidad titulo="Fecha y hora" unidad="UTC" />
    default:
      return <>Ciudad</>
  }
}
