"use client"

import {
  ArrowDownIcon,
  ArrowRightIcon,
  RotateCcwIcon,
  SearchIcon,
} from "lucide-react"
import * as React from "react"

import { BadgeEstado, ms, n, type EstadoFase } from "@/components/etl/comun"
import { Button } from "@/components/ui/button"
import { ciudadPorId, type CiudadId } from "@/lib/etl/ciudades"
import type { ExtraccionCiudad } from "@/lib/etl/extraccion"
import { cn } from "@/lib/utils"

export interface InfoFase {
  id: string
  titulo: string
  explicacion: string
  estado: EstadoFase
  entrada: { valor: number; etiqueta: string } | null
  salida: { valor: number; etiqueta: string } | null
  duracionMs: number | null
  detalle?: React.ReactNode
  pestana: string
}

export function Pipeline({
  fases,
  onInspeccionar,
}: {
  fases: InfoFase[]
  onInspeccionar: (pestana: string) => void
}) {
  return (
    <section
      aria-labelledby="titulo-pipeline"
      className="grid grid-cols-1 gap-3"
    >
      <h2
        id="titulo-pipeline"
        className="flex items-center gap-2 text-base font-medium"
      >
        <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
          2
        </span>
        Pipeline ETL
      </h2>
      <ol className="grid grid-cols-1 gap-2 lg:grid-cols-[repeat(5,minmax(0,1fr))] lg:gap-0">
        {fases.map((f, i) => (
          <li key={f.id} className="flex flex-col items-stretch lg:flex-row">
            <article
              aria-label={`Fase ${i + 1}: ${f.titulo}`}
              className={cn(
                "flex flex-1 flex-col gap-2 rounded-xl border bg-card p-3 text-sm",
                f.estado === "en_curso" && "border-sky-600/50",
                f.estado === "error" && "border-red-600/50"
              )}
            >
              <header className="flex flex-wrap items-center justify-between gap-1">
                <h3 className="font-medium">
                  <span className="text-muted-foreground">{i + 1}.</span>{" "}
                  {f.titulo}
                </h3>
                <BadgeEstado estado={f.estado} />
              </header>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {f.explicacion}
              </p>
              <dl className="mt-auto grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-xs tabular-nums">
                <dt className="text-muted-foreground">Entrada</dt>
                <dd>
                  {f.entrada
                    ? `${n(f.entrada.valor)} ${f.entrada.etiqueta}`
                    : "—"}
                </dd>
                <dt className="text-muted-foreground">Salida</dt>
                <dd className="font-medium">
                  {f.salida ? `${n(f.salida.valor)} ${f.salida.etiqueta}` : "—"}
                </dd>
                <dt className="text-muted-foreground">Duración</dt>
                <dd>{ms(f.duracionMs)}</dd>
              </dl>
              {f.detalle && <div className="text-xs">{f.detalle}</div>}
              <Button
                variant="outline"
                size="sm"
                onClick={() => onInspeccionar(f.pestana)}
              >
                <SearchIcon data-icon="inline-start" />
                Inspeccionar
              </Button>
            </article>
            {i < fases.length - 1 && (
              <div
                aria-hidden
                className="flex items-center justify-center py-0.5 text-muted-foreground lg:px-1 lg:py-0"
              >
                <ArrowDownIcon className="size-4 lg:hidden" />
                <ArrowRightIcon className="hidden size-4 lg:block" />
              </div>
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}

const ESTADO_CIUDAD: Record<ExtraccionCiudad["estado"], EstadoFase> = {
  pendiente: "pendiente",
  en_curso: "en_curso",
  completada: "completada",
  error: "error",
}

/** Progreso real por ciudad: procesadas, en curso, pendientes y errores. */
export function ProgresoCiudades({
  orden,
  extracciones,
  onReintentar,
  bloqueado,
}: {
  orden: CiudadId[]
  extracciones: Partial<Record<CiudadId, ExtraccionCiudad>>
  onReintentar: (id: CiudadId) => void
  bloqueado: boolean
}) {
  const lista = orden.map((id) => extracciones[id]!).filter(Boolean)
  const hechas = lista.filter((e) => e.estado === "completada").length
  const pendientes = lista.filter((e) => e.estado === "pendiente")
  const enCurso = lista.find((e) => e.estado === "en_curso")
  return (
    <div className="rounded-xl border bg-card p-3 text-sm">
      <p aria-live="polite" className="mb-2 font-medium">
        Extracción: {hechas} de {lista.length} ciudades descargadas
        {enCurso && <> · descargando {ciudadPorId(enCurso.ciudadId).nombre}</>}
        {pendientes.length > 0 && (
          <span className="font-normal text-muted-foreground">
            {" "}
            · pendientes:{" "}
            {pendientes.map((e) => ciudadPorId(e.ciudadId).nombre).join(", ")}
          </span>
        )}
      </p>
      <ul className="flex flex-wrap gap-2">
        {lista.map((e) => (
          <li
            key={e.ciudadId}
            className="flex flex-wrap items-center gap-2 rounded-lg border px-2 py-1"
          >
            <span className="font-medium">
              {ciudadPorId(e.ciudadId).nombre}
            </span>
            <BadgeEstado
              estado={ESTADO_CIUDAD[e.estado]}
              texto={e.estado === "completada" ? "Descargada" : undefined}
            />
            {e.duracionMs !== undefined && (
              <span className="text-xs text-muted-foreground tabular-nums">
                {ms(e.duracionMs)}
              </span>
            )}
            {e.estado === "error" && (
              <>
                <span className="max-w-80 text-xs text-red-700 dark:text-red-300">
                  {e.error}
                </span>
                <Button
                  size="xs"
                  variant="outline"
                  disabled={bloqueado}
                  onClick={() => onReintentar(e.ciudadId)}
                >
                  <RotateCcwIcon data-icon="inline-start" />
                  Reintentar {ciudadPorId(e.ciudadId).nombre}
                </Button>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

export interface Contador {
  etiqueta: string
  valor: number | null
  ayuda: string
  destacado?: boolean
  nota?: React.ReactNode
}

export function Contadores({ contadores }: { contadores: Contador[] }) {
  return (
    <section aria-label="Contadores del pipeline">
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {contadores.map((c) => (
          <div
            key={c.etiqueta}
            className={cn(
              "rounded-xl border bg-card p-3",
              c.destacado && "border-primary/60 ring-1 ring-primary/20"
            )}
          >
            <dt className="text-xs text-muted-foreground">{c.etiqueta}</dt>
            <dd className="text-2xl font-semibold tabular-nums">
              {c.valor === null ? "—" : n(c.valor)}
            </dd>
            <dd className="text-xs text-muted-foreground">{c.ayuda}</dd>
            {c.nota && <dd className="mt-1 text-xs">{c.nota}</dd>}
          </div>
        ))}
      </dl>
    </section>
  )
}
