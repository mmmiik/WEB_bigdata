"use client"

import {
  ArrowCounterClockwiseIcon,
  CloudArrowUpIcon,
  LockSimpleIcon,
  WarningIcon,
} from "@phosphor-icons/react"

import {
  ms,
  n,
  Paginacion,
  plural,
  usePaginacion,
  Vacio,
} from "@/components/etl/comun"
import { BarraVista, Recuento, TablaDatos } from "@/components/etl/vista-datos"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  resumirCarga,
  TAMANO_LOTE,
  type Lote,
  type RegistroCarga,
  type ResultadoVerificacion,
} from "@/lib/etl/carga"
import { paginar } from "@/lib/etl/filtros"
import { cn } from "@/lib/utils"

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

const TEXTO_LOTE: Record<Lote["estado"], string> = {
  pendiente: "pendiente",
  enviando: "enviando",
  completado: "completado",
  error: "fallido",
}

const COLOR_LOTE: Record<Lote["estado"], string> = {
  pendiente: "bg-black/10 dark:bg-white/15",
  enviando: "animate-pulse bg-sky-500",
  completado: "bg-emerald-500",
  error: "bg-red-500",
}

/** Solo aparece si Supabase no está listo: si todo va bien, no ocupa sitio. */
export function AvisoSupabase({ estado }: { estado: EstadoSupabase | null }) {
  if (!estado || (estado.configurado && estado.tablaAccesible)) return null
  if (!estado.configurado) {
    return (
      <Alert>
        <LockSimpleIcon weight="fill" />
        <AlertTitle>Supabase no está configurado</AlertTitle>
        <AlertDescription>
          {estado.error ?? (
            <>
              Faltan <code>{(estado.faltan ?? []).join(", ")}</code> en{" "}
              <code>.env.local</code>. Consulta el README.
            </>
          )}
        </AlertDescription>
      </Alert>
    )
  }
  return (
    <Alert variant="destructive">
      <WarningIcon weight="fill" />
      <AlertTitle>No se puede acceder a la tabla</AlertTitle>
      <AlertDescription>{estado.error}</AlertDescription>
    </Alert>
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
  /** Si existe, la subida está desactivada por este motivo. */
  bloqueo?: string
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
  bloqueo,
}: Props) {
  // Durante una carga se muestra la copia congelada que realmente se envía.
  const filas = enCurso && carga ? carga.snapshot : paraCargar
  const p = usePaginacion(filas.length)
  const visibles = paginar(filas as RegistroCarga[], p.pagina, p.tamano)
  const disponible =
    supabase?.configurado === true && supabase.tablaAccesible && !bloqueo
  const nLotes = Math.ceil(filas.length / TAMANO_LOTE)
  const desde = (p.pagina - 1) * p.tamano

  return (
    <div className="grid gap-3">
      <AvisoSupabase estado={supabase} />
      {bloqueo && (
        <Alert>
          <LockSimpleIcon weight="fill" />
          <AlertTitle>{bloqueo}</AlertTitle>
        </Alert>
      )}

      <BarraVista
        acciones={
          <>
            <Button
              size="sm"
              variant="outline"
              disabled={!disponible || totalValidos === 0 || enCurso}
              onClick={onSubirTodos}
              title="Restablece los filtros y sube todos los registros válidos."
            >
              Subir todos ({n(totalValidos)})
            </Button>
            <Button
              size="sm"
              disabled={!disponible || paraCargar.length === 0 || enCurso}
              onClick={onSubir}
              title="Al pulsar se congela una copia del conjunto y de su orden."
            >
              <CloudArrowUpIcon data-icon="inline-start" />
              Subir {n(paraCargar.length)} registros a Supabase
            </Button>
          </>
        }
      >
        <Recuento
          valor={filas.length}
          texto={
            enCurso
              ? `registros enviándose en ${plural(nLotes, "lote", "lotes")}`
              : `registros en ${plural(nLotes, "lote", "lotes")} de ${TAMANO_LOTE}`
          }
        />
      </BarraVista>

      {carga && (
        <InformeCarga
          carga={carga}
          enCurso={enCurso}
          onReintentar={onReintentar}
        />
      )}

      {filas.length === 0 ? (
        <Vacio>Aún no has elegido registros. Hazlo en «Válidos».</Vacio>
      ) : (
        <>
          <TablaDatos
            filas={visibles.map((r) => ({
              ...r,
              clave: `${r.ciudad}|${r.fecha_hora}`,
            }))}
            antes={[
              {
                id: "posicion",
                titulo: "#",
                className: "w-12 text-right text-muted-foreground tabular-nums",
                celda: (_, i) => n(desde + i + 1),
              },
              {
                id: "lote",
                titulo: "Lote",
                className: "w-12 text-right text-muted-foreground tabular-nums",
                celda: (_, i) => Math.floor((desde + i) / TAMANO_LOTE) + 1,
              },
            ]}
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Se envían en este orden, pero la base de datos no lo guarda: para
              leerlos ordenados hay que usar <code>ORDER BY</code>.
            </p>
            <Paginacion p={p} />
          </div>
        </>
      )}
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
  const fallidos = carga.lotes.filter((l) => l.estado === "error")
  return (
    <section
      aria-label="Resultado de la carga"
      className="grid gap-3 rounded-xl bg-black/[0.04] p-3 dark:bg-white/[0.06]"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="texto-encabezado">
          {enCurso ? "Subiendo…" : "Última subida"}
        </h3>
        {r.fallidos > 0 && !enCurso && (
          <Button size="sm" variant="outline" onClick={onReintentar}>
            <ArrowCounterClockwiseIcon data-icon="inline-start" />
            Reintentar {plural(r.fallidos, "lote", "lotes")}
          </Button>
        )}
      </div>

      {/* Un segmento por lote; el detalle de cada uno, al pasar el ratón. */}
      <div className="flex gap-0.5" aria-hidden>
        {carga.lotes.map((l) => (
          <span
            key={l.numero}
            title={`Lote ${l.numero}: ${TEXTO_LOTE[l.estado]}, ${plural(l.registros.length, "registro", "registros")}, ${plural(l.intentos, "intento", "intentos")}, ${ms(l.duracionMs)}`}
            className={cn("h-2 flex-1 rounded-full", COLOR_LOTE[l.estado])}
          />
        ))}
      </div>

      <dl
        aria-live="polite"
        className="grid grid-cols-3 gap-2 text-xs tabular-nums"
      >
        <Dato etiqueta="Confirmados" valor={n(r.registrosCorrectos)} />
        <Dato
          etiqueta="Fallidos"
          valor={n(r.registrosFallidos)}
          error={r.registrosFallidos > 0}
        />
        <Dato
          etiqueta="Verificados en destino"
          valor={
            carga.fase === "verificando"
              ? "…"
              : v
                ? `${n(v.encontradas)} de ${n(v.comprobadas)}`
                : "—"
          }
          error={!!v && (v.faltan.length > 0 || !!v.error)}
        />
      </dl>

      {fallidos.map((l) => (
        <p key={l.numero} className="text-xs text-red-700 dark:text-red-300">
          Lote {l.numero}: {l.error}
        </p>
      ))}
      {v?.error && (
        <p className="text-xs text-red-700 dark:text-red-300">
          La verificación no pudo completarse: {v.error}
        </p>
      )}
      {v && v.faltan.length > 0 && (
        <p className="text-xs text-red-700 dark:text-red-300">
          Faltan {n(v.faltan.length)} en destino, por ejemplo{" "}
          {v.faltan
            .slice(0, 3)
            .map((c) => `${c.ciudad} ${c.fecha_hora}`)
            .join(", ")}
          .
        </p>
      )}
    </section>
  )
}

function Dato({
  etiqueta,
  valor,
  error,
}: {
  etiqueta: string
  valor: string
  error?: boolean
}) {
  return (
    <div>
      <dt className="text-muted-foreground">{etiqueta}</dt>
      <dd
        className={cn(
          "texto-titulo",
          error && "text-red-600 dark:text-red-400"
        )}
      >
        {valor}
      </dd>
    </div>
  )
}
