"use client"

import { AlertTriangleIcon, DatabaseIcon, RefreshCwIcon } from "lucide-react"
import * as React from "react"

import {
  ConUnidad,
  dec,
  n,
  Paginacion,
  usePaginacion,
  Vacio,
} from "@/components/etl/comun"
import {
  AvisoSupabase,
  type EstadoSupabase,
} from "@/components/etl/pestana-carga"
import { celdaFecha } from "@/components/etl/pestanas-datos"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { NOMBRES_CIUDADES } from "@/lib/etl/ciudades"

interface FilaRemota {
  id: number
  ciudad: string
  fecha_hora: string
  temperatura_c: number
  humedad_pct: number
  precipitacion_mm: number
  importado_en: string
}

const ORDENES = {
  fecha_hora: "Fecha y hora",
  ciudad: "Ciudad",
  temperatura_c: "Temperatura",
  humedad_pct: "Humedad",
  precipitacion_mm: "Precipitación",
  importado_en: "Importado en",
} as const
type CampoRemoto = keyof typeof ORDENES

const TODAS = "__todas__"

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
  const [ciudad, setCiudad] = React.useState(TODAS)
  const [desde, setDesde] = React.useState("")
  const [hasta, setHasta] = React.useState("")
  const [orden, setOrden] = React.useState<CampoRemoto>("fecha_hora")
  const [dir, setDir] = React.useState<"asc" | "desc">("asc")
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
      orden,
      dir,
      pagina: String(pagina),
      tamano: String(tamano),
    })
    if (ciudad !== TODAS) params.append("ciudad", ciudad)
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
    dir,
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

  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <AvisoSupabase estado={supabase} />
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge
            variant="outline"
            className="border-emerald-600/30 text-emerald-800 dark:text-emerald-200"
          >
            <DatabaseIcon aria-hidden />
            Persistido en Supabase: {n(supabase?.filas ?? total)} filas en total
          </Badge>
          <Badge variant="outline">
            Local pendiente de subir: {n(pendientesLocales)} seleccionados
          </Badge>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        Esta pestaña lee la tabla real a través del servidor. Lo que ves aquí
        está persistido; los registros de las demás pestañas solo existen en
        esta sesión del navegador.
      </p>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-muted/30 p-3">
        <div className="grid grid-cols-1 gap-1">
          <span id="sb-ciudad" className="text-xs text-muted-foreground">
            Ciudad
          </span>
          <Select
            value={ciudad}
            onValueChange={(v) => v && cambiar(setCiudad)(v)}
            items={[
              { value: TODAS, label: "Todas" },
              ...NOMBRES_CIUDADES.map((c) => ({ value: c, label: c })),
            ]}
          >
            <SelectTrigger aria-labelledby="sb-ciudad" className="min-w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODAS}>Todas</SelectItem>
              {NOMBRES_CIUDADES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-1 gap-1">
          <Label htmlFor="sb-desde" className="text-xs text-muted-foreground">
            Desde (UTC)
          </Label>
          <Input
            id="sb-desde"
            type="date"
            value={desde}
            onChange={(e) => cambiar(setDesde)(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-1 gap-1">
          <Label htmlFor="sb-hasta" className="text-xs text-muted-foreground">
            Hasta (UTC, incluido)
          </Label>
          <Input
            id="sb-hasta"
            type="date"
            value={hasta}
            onChange={(e) => cambiar(setHasta)(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-1 gap-1">
          <span id="sb-orden" className="text-xs text-muted-foreground">
            Ordenar por (ORDER BY)
          </span>
          <Select
            value={orden}
            onValueChange={(v) => v && cambiar(setOrden)(v as CampoRemoto)}
            items={Object.entries(ORDENES).map(([value, label]) => ({
              value,
              label,
            }))}
          >
            <SelectTrigger aria-labelledby="sb-orden" className="min-w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(ORDENES).map(([v, l]) => (
                <SelectItem key={v} value={v}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div role="group" aria-label="Dirección" className="flex gap-1">
          <Button
            variant={dir === "asc" ? "default" : "outline"}
            aria-pressed={dir === "asc"}
            onClick={() => cambiar(setDir)("asc")}
          >
            Asc.
          </Button>
          <Button
            variant={dir === "desc" ? "default" : "outline"}
            aria-pressed={dir === "desc"}
            onClick={() => cambiar(setDir)("desc")}
          >
            Desc.
          </Button>
        </div>
        <Button
          variant="outline"
          disabled={!disponible || estado === "cargando"}
          onClick={() => setRecargas((r) => r + 1)}
        >
          <RefreshCwIcon
            data-icon="inline-start"
            className={estado === "cargando" ? "animate-spin" : undefined}
          />
          Actualizar
        </Button>
        {leidoEn && (
          <span className="text-xs text-muted-foreground" aria-live="polite">
            Última lectura: {leidoEn}
          </span>
        )}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangleIcon />
          <AlertTitle>No se pudo leer Supabase</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!disponible ? (
        <Vacio>
          La lectura estará disponible cuando Supabase esté configurado.
        </Vacio>
      ) : filas.length === 0 && estado !== "cargando" ? (
        <Vacio>No hay filas almacenadas que cumplan estos criterios.</Vacio>
      ) : (
        <>
          <Table aria-busy={estado === "cargando"}>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">id</TableHead>
                <TableHead>Ciudad</TableHead>
                <TableHead>
                  <ConUnidad titulo="Fecha y hora" unidad="UTC" />
                </TableHead>
                <TableHead className="text-right">
                  <ConUnidad titulo="Temperatura" unidad="°C" />
                </TableHead>
                <TableHead className="text-right">
                  <ConUnidad titulo="Humedad" unidad="%" />
                </TableHead>
                <TableHead className="text-right">
                  <ConUnidad titulo="Precipitación" unidad="mm" />
                </TableHead>
                <TableHead>
                  <ConUnidad titulo="Importado en" unidad="UTC" />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="text-right text-muted-foreground tabular-nums">
                    {f.id}
                  </TableCell>
                  <TableCell>{f.ciudad}</TableCell>
                  <TableCell>{celdaFecha(isoUtc(f.fecha_hora))}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {dec(f.temperatura_c)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {dec(f.humedad_pct)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {dec(f.precipitacion_mm)}
                  </TableCell>
                  <TableCell>{celdaFecha(isoUtc(f.importado_en))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Paginacion p={p} etiqueta="filas persistidas" />
        </>
      )}
    </div>
  )
}
