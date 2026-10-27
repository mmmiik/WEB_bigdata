"use client"

import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  DatabaseIcon,
  InfoIcon,
  LockIcon,
  RotateCcwIcon,
  UploadCloudIcon,
} from "lucide-react"

import {
  BadgeEstado,
  ConUnidad,
  dec,
  ms,
  n,
  Paginacion,
  usePaginacion,
  Vacio,
  type EstadoFase,
} from "@/components/etl/comun"
import { celdaFecha } from "@/components/etl/pestanas-datos"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  resumirCarga,
  TAMANO_LOTE,
  type Lote,
  type RegistroCarga,
  type ResultadoVerificacion,
} from "@/lib/etl/carga"
import { paginar } from "@/lib/etl/filtros"

export interface EstadoSupabase {
  configurado: boolean
  tablaAccesible: boolean
  faltan?: string[]
  error?: string
  filas?: number | null
}

export interface EstadoCarga {
  /** Copia congelada del conjunto seleccionado, en el orden elegido. */
  snapshot: readonly RegistroCarga[]
  lotes: Lote[]
  fase: "enviando" | "verificando" | "terminada"
  verificacion: ResultadoVerificacion | null
  duracionMs: number
}

const ESTADO_LOTE: Record<Lote["estado"], EstadoFase> = {
  pendiente: "pendiente",
  enviando: "en_curso",
  completado: "completada",
  error: "error",
}
const TEXTO_LOTE: Record<Lote["estado"], string> = {
  pendiente: "Pendiente",
  enviando: "Enviando",
  completado: "Completado",
  error: "Fallido",
}

export function AvisoSupabase({ estado }: { estado: EstadoSupabase | null }) {
  if (!estado) {
    return (
      <p className="text-sm text-muted-foreground">
        Comprobando la configuración de Supabase…
      </p>
    )
  }
  if (!estado.configurado) {
    return (
      <Alert>
        <LockIcon />
        <AlertTitle>Supabase no está configurado</AlertTitle>
        <AlertDescription>
          {estado.error ?? (
            <>
              Faltan las variables de entorno del servidor{" "}
              <code>{(estado.faltan ?? []).join(", ")}</code>. Cópialas de{" "}
              <code>.env.example</code> a <code>.env.local</code>, aplica la
              migración SQL y reinicia <code>npm run dev</code>. Mientras tanto
              puedes preparar la selección, pero no se simulará ninguna carga.
            </>
          )}
        </AlertDescription>
      </Alert>
    )
  }
  if (!estado.tablaAccesible) {
    return (
      <Alert variant="destructive">
        <AlertTriangleIcon />
        <AlertTitle>No se puede acceder a la tabla</AlertTitle>
        <AlertDescription>{estado.error}</AlertDescription>
      </Alert>
    )
  }
  return (
    <p className="flex items-center gap-2 text-sm text-muted-foreground">
      <DatabaseIcon className="size-4" aria-hidden />
      Supabase conectado · la tabla <code>mediciones_meteorologicas</code>{" "}
      contiene {n(estado.filas ?? 0)} filas.
    </p>
  )
}

interface Props {
  supabase: EstadoSupabase | null
  paraCargar: readonly RegistroCarga[]
  carga: EstadoCarga | null
  enCurso: boolean
  onSubir: () => void
  totalValidos: number
  onSubirTodos: () => void
  onReintentar: () => void
}

export function PestanaCarga({
  supabase,
  paraCargar,
  carga,
  enCurso,
  onSubir,
  totalValidos,
  onSubirTodos,
  onReintentar,
}: Props) {
  // Durante una carga se muestra la copia congelada que realmente se envía.
  const filas = enCurso && carga ? carga.snapshot : paraCargar
  const p = usePaginacion(filas.length)
  const visibles = paginar(filas as RegistroCarga[], p.pagina, p.tamano)
  const disponible = supabase?.configurado === true && supabase.tablaAccesible
  const nLotes = Math.ceil(paraCargar.length / TAMANO_LOTE)

  return (
    <div className="grid grid-cols-1 gap-4">
      <AvisoSupabase estado={supabase} />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3">
        <div className="text-sm">
          <p>
            Se enviarán{" "}
            <strong className="tabular-nums">{n(paraCargar.length)}</strong>{" "}
            registros en <strong className="tabular-nums">{n(nLotes)}</strong>{" "}
            {nLotes === 1 ? "lote" : "lotes"} de hasta {TAMANO_LOTE}, mediante{" "}
            <em>upsert</em> por (ciudad, fecha_hora).
          </p>
          <p className="text-muted-foreground">
            Al pulsar se congela una copia del conjunto y de su orden; cambiar
            después los filtros no altera la carga en curso.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="lg"
            disabled={!disponible || paraCargar.length === 0 || enCurso}
            onClick={onSubir}
          >
            <UploadCloudIcon data-icon="inline-start" />
            Subir {n(paraCargar.length)} registros a Supabase
          </Button>
          <Button
            size="lg"
            variant="outline"
            disabled={!disponible || totalValidos === 0 || enCurso}
            onClick={onSubirTodos}
          >
            <UploadCloudIcon data-icon="inline-start" />
            Subir todos los válidos ({n(totalValidos)})
          </Button>
        </div>
      </div>

      {carga && (
        <InformeCarga
          carga={carga}
          enCurso={enCurso}
          onReintentar={onReintentar}
        />
      )}

      <section
        aria-labelledby="titulo-vista-previa"
        className="grid grid-cols-1 gap-2"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id="titulo-vista-previa" className="text-sm font-medium">
            {enCurso && carga
              ? "Conjunto congelado que se está enviando"
              : "Vista previa: conjunto exacto que se enviará"}
          </h3>
          <Badge variant="outline">
            {enCurso ? <LockIcon aria-hidden /> : <InfoIcon aria-hidden />}
            Datos locales · aún no persistidos
          </Badge>
        </div>
        <Alert>
          <InfoIcon />
          <AlertDescription>
            Los registros se envían en este orden, pero una tabla SQL no
            garantiza conservar el orden de inserción: cualquier consulta
            posterior debe indicar <code>ORDER BY</code> (por ejemplo,{" "}
            <code>ORDER BY fecha_hora, ciudad</code>).
          </AlertDescription>
        </Alert>
        {filas.length === 0 ? (
          <Vacio>
            No hay registros seleccionados que cumplan los filtros.
            Selecciónalos en la pestaña «Registros válidos».
          </Vacio>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">Posición</TableHead>
                  <TableHead className="text-right">Lote</TableHead>
                  <TableHead>ciudad</TableHead>
                  <TableHead>
                    <ConUnidad titulo="fecha_hora" unidad="UTC" />
                  </TableHead>
                  <TableHead className="text-right">
                    <ConUnidad titulo="temperatura_c" unidad="°C" />
                  </TableHead>
                  <TableHead className="text-right">
                    <ConUnidad titulo="humedad_pct" unidad="%" />
                  </TableHead>
                  <TableHead className="text-right">
                    <ConUnidad titulo="precipitacion_mm" unidad="mm" />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibles.map((r, i) => {
                  const pos = (p.pagina - 1) * p.tamano + i
                  return (
                    <TableRow key={`${r.ciudad}|${r.fecha_hora}`}>
                      <TableCell className="text-right tabular-nums">
                        {n(pos + 1)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground tabular-nums">
                        {Math.floor(pos / TAMANO_LOTE) + 1}
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
            <Paginacion p={p} etiqueta="registros a enviar" />
          </>
        )}
      </section>
    </div>
  )
}

function InformeCarga({
  carga,
  enCurso,
  onReintentar,
}: {
  carga: EstadoCarga
  enCurso: boolean
  onReintentar: () => void
}) {
  const r = resumirCarga(carga.lotes)
  const v = carga.verificacion
  return (
    <section
      aria-labelledby="titulo-informe"
      className="grid grid-cols-1 gap-3 rounded-xl border p-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="titulo-informe" className="text-sm font-medium">
          {enCurso ? "Carga en curso" : "Informe de la última carga"}{" "}
          <span className="font-normal text-muted-foreground">
            ({n(carga.snapshot.length)} registros congelados ·{" "}
            {ms(carga.duracionMs)})
          </span>
        </h3>
        {r.fallidos > 0 && !enCurso && (
          <Button size="sm" variant="outline" onClick={onReintentar}>
            <RotateCcwIcon data-icon="inline-start" />
            Reintentar{" "}
            {r.fallidos === 1
              ? "el lote fallido"
              : `los ${r.fallidos} lotes fallidos`}
          </Button>
        )}
      </div>

      <dl
        className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4"
        aria-live="polite"
      >
        <div>
          <dt className="text-xs text-muted-foreground">
            Procesados correctamente
          </dt>
          <dd className="text-lg font-semibold tabular-nums">
            {n(r.registrosCorrectos)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Fallidos</dt>
          <dd className="text-lg font-semibold tabular-nums">
            {n(r.registrosFallidos)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Lotes</dt>
          <dd className="tabular-nums">
            {r.completados}/{r.lotes} completados
            {r.fallidos > 0 && ` · ${r.fallidos} fallidos`}
            {r.pendientes > 0 && ` · ${r.pendientes} pendientes`}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">
            Verificación en destino
          </dt>
          <dd>
            {carga.fase === "verificando" && "Comprobando claves…"}
            {carga.fase !== "verificando" && !v && "—"}
            {v && (
              <span className="inline-flex items-center gap-1">
                {v.faltan.length === 0 && !v.error ? (
                  <CheckCircle2Icon
                    className="size-4 text-emerald-700"
                    aria-hidden
                  />
                ) : (
                  <AlertTriangleIcon
                    className="size-4 text-red-700"
                    aria-hidden
                  />
                )}
                {n(v.encontradas)} de {n(v.comprobadas)} claves encontradas
              </span>
            )}
          </dd>
        </div>
      </dl>
      <p className="text-xs text-muted-foreground">
        Supabase confirma cuántas filas escribió cada lote, pero el upsert no
        indica cuántas fueron inserciones nuevas y cuántas actualizaciones de
        filas existentes, así que no se muestra ese desglose.
      </p>
      {v?.error && (
        <Alert variant="destructive">
          <AlertTriangleIcon />
          <AlertTitle>La verificación no pudo completarse</AlertTitle>
          <AlertDescription>{v.error}</AlertDescription>
        </Alert>
      )}
      {v && v.faltan.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangleIcon />
          <AlertTitle>
            {n(v.faltan.length)} claves enviadas no aparecen en destino
          </AlertTitle>
          <AlertDescription>
            Primeras:{" "}
            {v.faltan
              .slice(0, 5)
              .map((c) => `${c.ciudad} ${c.fecha_hora}`)
              .join("; ")}
          </AlertDescription>
        </Alert>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Lote</TableHead>
            <TableHead className="text-right">Registros</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Intentos</TableHead>
            <TableHead className="text-right">Filas confirmadas</TableHead>
            <TableHead className="text-right">Duración</TableHead>
            <TableHead>Detalle</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {carga.lotes.map((l) => (
            <TableRow key={l.numero}>
              <TableCell>#{l.numero}</TableCell>
              <TableCell className="text-right tabular-nums">
                {n(l.registros.length)}
              </TableCell>
              <TableCell>
                <BadgeEstado
                  estado={ESTADO_LOTE[l.estado]}
                  texto={TEXTO_LOTE[l.estado]}
                />
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {l.intentos}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {l.confirmados !== undefined ? n(l.confirmados) : "—"}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {ms(l.duracionMs)}
              </TableCell>
              <TableCell className="max-w-96 text-xs whitespace-normal text-red-700 dark:text-red-300">
                {l.error}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  )
}
