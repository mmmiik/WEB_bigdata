"use client"

import { Dialog } from "@base-ui/react/dialog"
import { AlertTriangleIcon, UploadCloudIcon, XIcon } from "lucide-react"
import * as React from "react"

import { BotonTema } from "@/components/boton-tema"
import {
  Caja,
  IconoEstado,
  ms,
  n,
  type EstadoFase,
} from "@/components/etl/comun"
import {
  alternarCiudad,
  ConfiguracionExtraccion,
} from "@/components/etl/configuracion-extraccion"
import { MapaEspana, type Margenes } from "@/components/etl/mapa-espana"
import {
  PestanaCarga,
  type EstadoCarga,
  type EstadoSupabase,
} from "@/components/etl/pestana-carga"
import { PestanaSupabase } from "@/components/etl/pestana-supabase"
import { PestanaValidos } from "@/components/etl/pestana-validos"
import {
  PestanaJson,
  PestanaRechazados,
  PestanaTransformados,
} from "@/components/etl/pestanas-datos"
import {
  CiudadesConError,
  PipelineCompacto,
  Registro,
  type EntradaRegistro,
  type InfoFase,
} from "@/components/etl/pipeline"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  aRegistroCarga,
  crearLotes,
  ejecutarLotes,
  resumirCarga,
  verificarClaves,
  type ClaveMedicion,
  type Lote,
  type RegistroCarga,
  type RespuestaEnvio,
} from "@/lib/etl/carga"
import { CIUDADES, ciudadPorId, type CiudadId } from "@/lib/etl/ciudades"
import {
  construirUrlArchivo,
  descargarCiudad,
  type ExtraccionCiudad,
} from "@/lib/etl/extraccion"
import { hoyUtc, validarPeriodo } from "@/lib/etl/fechas"
import {
  filtrar,
  FILTROS_INICIALES,
  interpretarFiltros,
  ordenar,
  ORDEN_INICIAL,
  resumirSeleccion,
  type Filtros,
  type Orden,
} from "@/lib/etl/filtros"
import {
  limpiar,
  type RegistroValido,
  type ResultadoLimpieza,
} from "@/lib/etl/limpieza"
import {
  transformar,
  type ResultadoTransformacion,
} from "@/lib/etl/transformacion"

type Extracciones = Partial<Record<CiudadId, ExtraccionCiudad>>

interface Ejecucion {
  ciudades: CiudadId[]
  inicio: string
  fin: string
}

interface ResultadoLocal {
  transformacion: ResultadoTransformacion
  limpieza: ResultadoLimpieza
  msTransformacion: number
  msLimpieza: number
  entradaTransformacion: number
}

// --- Llamadas a los endpoints del servidor (la escritura nunca sale del servidor) ---

async function postJson(url: string, cuerpo: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo),
  })
  let json: Record<string, unknown> = {}
  try {
    json = await res.json()
  } catch {
    // respuesta sin JSON
  }
  return { res, json }
}

async function enviarLote(registros: RegistroCarga[]): Promise<RespuestaEnvio> {
  const { res, json } = await postJson("/api/supabase/carga", { registros })
  if (!res.ok || json.ok !== true) {
    const errores = Array.isArray(json.errores)
      ? ` ${(json.errores as { indice: number; mensaje: string }[])
          .slice(0, 3)
          .map((e) => `[fila ${e.indice + 1}] ${e.mensaje}`)
          .join(" ")}`
      : ""
    return {
      ok: false,
      error: `HTTP ${res.status}: ${(json.error as string) ?? res.statusText}${errores}`,
    }
  }
  return { ok: true, confirmados: json.confirmados as number }
}

async function consultarClaves(lote: ClaveMedicion[]) {
  const { res, json } = await postJson("/api/supabase/verificacion", {
    claves: lote,
  })
  if (!res.ok || json.ok !== true) {
    throw new Error(
      `HTTP ${res.status}: ${(json.error as string) ?? res.statusText}`
    )
  }
  return { encontradas: json.encontradas as string[] }
}

async function consultarEstadoSupabase(): Promise<EstadoSupabase> {
  try {
    const res = await fetch("/api/supabase/estado", { cache: "no-store" })
    return await res.json()
  } catch (e) {
    return {
      configurado: false,
      tablaAccesible: false,
      error: `No se pudo consultar el servidor: ${e instanceof Error ? e.message : String(e)}`,
    }
  }
}

// --- Maquetación: mapa a pantalla completa con cajas a los lados ------------

const CONSULTA_ANCHA = "(min-width: 1024px)"

/** true en pantallas anchas, donde las cajas flotan sobre el mapa. */
function usePantallaAncha() {
  return React.useSyncExternalStore(
    (avisar) => {
      const mq = window.matchMedia(CONSULTA_ANCHA)
      mq.addEventListener("change", avisar)
      return () => mq.removeEventListener("change", avisar)
    },
    () => window.matchMedia(CONSULTA_ANCHA).matches,
    () => true
  )
}

// Ancho de las cajas (lg:w-[340px] y lg:w-[400px]) + separación de 16 px + aire.
const MARGENES_ANCHA: Margenes = { top: 64, bottom: 96, left: 380, right: 440 }
const MARGENES_ESTRECHA: Margenes = { top: 56, bottom: 88, left: 16, right: 16 }

export function EtlWorkbench() {
  const [hoy] = React.useState(() => hoyUtc())
  const [ciudadesSel, setCiudadesSel] = React.useState<CiudadId[]>(
    CIUDADES.map((c) => c.id)
  )
  const [inicio, setInicio] = React.useState("2026-09-01")
  const [fin, setFin] = React.useState("2026-09-30")
  const periodo = React.useMemo(
    () => validarPeriodo(inicio, fin, new Date(`${hoy}T12:00:00Z`)),
    [inicio, fin, hoy]
  )

  const [ejecucion, setEjecucion] = React.useState<Ejecucion | null>(null)
  const [extracciones, setExtracciones] = React.useState<Extracciones>({})
  const extraccionesRef = React.useRef<Extracciones>({})
  const [extrayendo, setExtrayendo] = React.useState(false)
  const [local, setLocal] = React.useState<ResultadoLocal | null>(null)

  const [filtros, setFiltros] = React.useState<Filtros>(FILTROS_INICIALES)
  const [orden, setOrden] = React.useState<Orden>(ORDEN_INICIAL)
  const filtrosRef = React.useRef<Filtros>(FILTROS_INICIALES)
  const ordenRef = React.useRef<Orden>(ORDEN_INICIAL)
  const [seleccion, setSeleccion] = React.useState<Set<string>>(new Set())
  // Resultado de filtrar + ordenar. Se calcula en los manejadores de eventos
  // (no durante el render) para poder medir su duración real.
  const [vista, setVista] = React.useState<{
    ordenados: RegistroValido[]
    msFiltrado: number | null
  }>({ ordenados: [], msFiltrado: null })

  const recalcularVista = (v: RegistroValido[], f: Filtros, o: Orden) => {
    const t0 = performance.now()
    const resultado = ordenar(filtrar(v, interpretarFiltros(f).criterios), o)
    setVista({ ordenados: resultado, msFiltrado: performance.now() - t0 })
  }

  const [carga, setCarga] = React.useState<EstadoCarga | null>(null)
  const [cargando, setCargando] = React.useState(false)
  const cargaEnCursoRef = React.useRef(false)
  const [versionDestino, setVersionDestino] = React.useState(0)
  const [supabase, setSupabase] = React.useState<EstadoSupabase | null>(null)

  const [pestana, setPestana] = React.useState("json")
  const [inspeccionAbierta, setInspeccionAbierta] = React.useState(false)
  const inspeccionar = (p: string) => {
    setPestana(p)
    setInspeccionAbierta(true)
  }

  const [registro, setRegistro] = React.useState<EntradaRegistro[]>([])
  const idRegistro = React.useRef(0)
  const anotar = (nivel: EntradaRegistro["nivel"], texto: string) => {
    const entrada: EntradaRegistro = {
      id: ++idRegistro.current,
      hora: new Date().toLocaleTimeString("es-ES"),
      nivel,
      texto,
    }
    setRegistro((r) => [...r, entrada].slice(-200))
  }

  const leerEstadoSupabase = async () =>
    setSupabase(await consultarEstadoSupabase())

  React.useEffect(() => {
    let activo = true
    consultarEstadoSupabase().then((e) => {
      if (!activo) return
      setSupabase(e)
      if (e.configurado && e.tablaAccesible)
        anotar("ok", `Supabase conectado · ${n(e.filas ?? 0)} filas en destino`)
      else
        anotar(
          "error",
          `Supabase no disponible: ${e.error ?? `faltan ${e.faltan?.join(", ") || "variables"}`}`
        )
    })
    return () => {
      activo = false
    }
  }, [])

  // --- Extracción -----------------------------------------------------------

  const actualizarExtraccion = (
    id: CiudadId,
    cambios: Partial<ExtraccionCiudad>
  ) => {
    const actual = extraccionesRef.current[id]!
    extraccionesRef.current = {
      ...extraccionesRef.current,
      [id]: { ...actual, ...cambios },
    }
    setExtracciones(extraccionesRef.current)
  }

  const descargar = async (id: CiudadId) => {
    const previa = extraccionesRef.current[id]!
    actualizarExtraccion(id, {
      estado: "en_curso",
      error: undefined,
      intentos: previa.intentos + 1,
    })
    const t0 = performance.now()
    const r = await descargarCiudad(previa.url)
    const duracionMs = performance.now() - t0
    // Al reintentar se REEMPLAZA la respuesta de la ciudad: nunca se acumula.
    actualizarExtraccion(id, {
      estado: r.ok ? "completada" : "error",
      error: r.error,
      textoOriginal: r.textoOriginal,
      json: r.json,
      duracionMs,
      descargadoEn:
        new Date().toLocaleString("es-ES", { timeZone: "UTC" }) + " UTC",
    })
    const nombre = ciudadPorId(id).nombre
    if (r.ok) anotar("ok", `${nombre}: JSON recibido (${ms(duracionMs)})`)
    else anotar("error", `${nombre}: ${r.error}`)
  }

  /** Transformación y limpieza sobre todas las ciudades descargadas. */
  const procesarLocal = (orden: CiudadId[]) => {
    const entradas = orden
      .map((id) => extraccionesRef.current[id])
      .filter((e): e is ExtraccionCiudad => e?.estado === "completada")
      .map((e) => ({ ciudadId: e.ciudadId, json: e.json }))
    if (entradas.length === 0) {
      anotar("error", "No hay ninguna ciudad descargada que transformar.")
      setLocal(null)
      setVista({ ordenados: [], msFiltrado: null })
      return
    }
    const entradaTransformacion = entradas.reduce((s, e) => {
      const time = (e.json as { hourly?: { time?: unknown[] } })?.hourly?.time
      return s + (Array.isArray(time) ? time.length : 0)
    }, 0)
    const t0 = performance.now()
    const transformacion = transformar(entradas)
    const t1 = performance.now()
    const limpieza = limpiar(transformacion.registros)
    const t2 = performance.now()
    const problemas = transformacion.errores.length
    anotar(
      problemas > 0 ? "error" : "ok",
      `Transformación: ${n(transformacion.registros.length)} registros (${ms(t1 - t0)})` +
        (problemas > 0 ? ` · ${problemas} problema(s) de estructura` : "")
    )
    anotar(
      "ok",
      `Limpieza: ${n(limpieza.validos.length)} válidos · ${n(limpieza.rechazados.length)} rechazados`
    )
    setLocal({
      transformacion,
      limpieza,
      msTransformacion: t1 - t0,
      msLimpieza: t2 - t1,
      entradaTransformacion,
    })
    recalcularVista(limpieza.validos, filtrosRef.current, ordenRef.current)
    // La selección solo conserva claves que siguen siendo válidas.
    const claves = new Set(limpieza.validos.map((v) => v.clave))
    setSeleccion((s) => new Set([...s].filter((k) => claves.has(k))))
  }

  const extraer = async () => {
    if (extrayendo || cargaEnCursoRef.current) return
    const ciudades = [...ciudadesSel]
    const nuevas: Extracciones = {}
    for (const id of ciudades) {
      nuevas[id] = {
        ciudadId: id,
        url: construirUrlArchivo(ciudadPorId(id), inicio, fin),
        estado: "pendiente",
        intentos: 0,
      }
    }
    extraccionesRef.current = nuevas
    setExtracciones(nuevas)
    setEjecucion({ ciudades, inicio, fin })
    setLocal(null)
    setVista({ ordenados: [], msFiltrado: null })
    setSeleccion(new Set())
    setCarga(null)
    filtrosRef.current = FILTROS_INICIALES
    setFiltros(FILTROS_INICIALES)
    setExtrayendo(true)
    setPestana("json")
    anotar(
      "info",
      `Extracción de ${ciudades.length} ciudad(es) · ${inicio} → ${fin}`
    )
    // Peticiones en serie: se ve qué ciudad se procesa y cuáles quedan.
    for (const id of ciudades) await descargar(id)
    setExtrayendo(false)
    procesarLocal(ciudades)
  }

  const reintentarCiudad = async (id: CiudadId) => {
    if (extrayendo || !ejecucion) return
    setExtrayendo(true)
    await descargar(id)
    setExtrayendo(false)
    procesarLocal(ejecucion.ciudades)
  }

  // --- Filtrado, ordenación y selección ---------------------------------------

  const validos = React.useMemo(() => local?.limpieza.validos ?? [], [local])
  const interpretados = React.useMemo(
    () => interpretarFiltros(filtros),
    [filtros]
  )
  const { ordenados, msFiltrado } = vista

  const cambiarFiltros = (f: Filtros) => {
    filtrosRef.current = f
    setFiltros(f)
    recalcularVista(validos, f, ordenRef.current)
  }
  const cambiarOrden = (o: Orden) => {
    ordenRef.current = o
    setOrden(o)
    recalcularVista(validos, filtrosRef.current, o)
  }
  const { paraCargar, fueraDeFiltros } = React.useMemo(
    () => resumirSeleccion(ordenados, seleccion),
    [ordenados, seleccion]
  )
  const registrosParaCargar = React.useMemo(
    () => paraCargar.map(aRegistroCarga),
    [paraCargar]
  )
  const ciudadesDisponibles = React.useMemo(
    () => [...new Set(validos.map((v) => v.ciudad))],
    [validos]
  )

  // --- Carga ----------------------------------------------------------------

  const ejecutarCarga = async (
    lotes: Lote[],
    snapshot: readonly RegistroCarga[],
    msPrevios: number
  ) => {
    const t0 = performance.now()
    anotar(
      "info",
      `Carga: ${n(snapshot.length)} registros en ${lotes.length} lote(s)`
    )
    setCarga({
      snapshot,
      lotes,
      fase: "enviando",
      verificacion: null,
      duracionMs: msPrevios,
    })
    const finales = await ejecutarLotes(lotes, enviarLote, (l) =>
      setCarga((c) => (c ? { ...c, lotes: l } : c))
    )
    setCarga((c) => (c ? { ...c, lotes: finales, fase: "verificando" } : c))
    const resumen = resumirCarga(finales)
    if (resumen.fallidos > 0)
      anotar(
        "error",
        `Carga: ${resumen.fallidos} lote(s) fallidos · ${n(resumen.registrosCorrectos)} registros confirmados`
      )
    else
      anotar(
        "ok",
        `Carga: ${n(resumen.registrosCorrectos)} registros confirmados`
      )
    const enviadas = finales
      .filter((l) => l.estado === "completado")
      .flatMap((l) =>
        l.registros.map((r) => ({ ciudad: r.ciudad, fecha_hora: r.fecha_hora }))
      )
    const verificacion =
      enviadas.length > 0
        ? await verificarClaves(enviadas, consultarClaves)
        : null
    if (verificacion?.error)
      anotar("error", `Verificación: ${verificacion.error}`)
    else if (verificacion)
      anotar(
        verificacion.faltan.length > 0 ? "error" : "ok",
        `Verificación: ${n(verificacion.encontradas)}/${n(verificacion.comprobadas)} claves en destino`
      )
    setCarga((c) =>
      c
        ? {
            ...c,
            fase: "terminada",
            verificacion,
            duracionMs: msPrevios + performance.now() - t0,
          }
        : c
    )
  }

  const conBloqueo = async (fn: () => Promise<void>) => {
    // Impide envíos simultáneos aunque se pulse dos veces muy rápido.
    if (cargaEnCursoRef.current) return
    cargaEnCursoRef.current = true
    setCargando(true)
    try {
      await fn()
    } finally {
      cargaEnCursoRef.current = false
      setCargando(false)
      setVersionDestino((v) => v + 1)
      void leerEstadoSupabase()
    }
  }

  const subir = () =>
    conBloqueo(async () => {
      // Copia congelada: cambios posteriores de filtros o selección no la alteran.
      const snapshot = Object.freeze(registrosParaCargar.map((r) => ({ ...r })))
      if (snapshot.length === 0) return
      await ejecutarCarga(crearLotes(snapshot), snapshot, 0)
    })

  /**
   * Atajo: restablece los filtros, selecciona TODOS los registros válidos y
   * los sube en el orden actual. La vista previa queda igual a lo enviado.
   */
  const subirTodos = () =>
    conBloqueo(async () => {
      if (validos.length === 0) return
      filtrosRef.current = FILTROS_INICIALES
      setFiltros(FILTROS_INICIALES)
      recalcularVista(validos, FILTROS_INICIALES, ordenRef.current)
      setSeleccion(new Set(validos.map((v) => v.clave)))
      setPestana("carga")
      const snapshot = Object.freeze(
        ordenar(validos, ordenRef.current).map(aRegistroCarga)
      )
      await ejecutarCarga(crearLotes(snapshot), snapshot, 0)
    })

  const supabaseDisponible =
    supabase?.configurado === true && supabase.tablaAccesible

  const reintentarLotes = () =>
    conBloqueo(async () => {
      if (!carga) return
      await ejecutarCarga(carga.lotes, carga.snapshot, carga.duracionMs)
    })

  // --- Estado de las fases ----------------------------------------------------

  const lista = ejecucion
    ? ejecucion.ciudades.map((id) => extracciones[id]!).filter(Boolean)
    : []
  const descargadas = lista.filter((e) => e.estado === "completada")
  const conError = lista.filter((e) => e.estado === "error")
  const horasBrutas = local?.entradaTransformacion ?? 0
  const totalExtraido = local?.transformacion.registros.length ?? 0
  const rechazados = local?.limpieza.rechazados.length ?? 0
  const resumenCarga = carga ? resumirCarga(carga.lotes) : null

  const estadoExtraccion: EstadoFase = !ejecucion
    ? "pendiente"
    : extrayendo
      ? "en_curso"
      : conError.length > 0
        ? "error"
        : "completada"

  const fases: InfoFase[] = [
    {
      id: "extraccion",
      titulo: "Extracción",
      explicacion:
        "Descarga el JSON horario del archivo de Open-Meteo: una petición HTTP por ciudad, en UTC, °C y mm.",
      estado: estadoExtraccion,
      entrada: ejecucion
        ? { valor: ejecucion.ciudades.length, etiqueta: "ciudades" }
        : null,
      salida: ejecucion
        ? { valor: descargadas.length, etiqueta: "JSON recibidos" }
        : null,
      duracionMs: lista.some((e) => e.duracionMs !== undefined)
        ? lista.reduce((s, e) => s + (e.duracionMs ?? 0), 0)
        : null,
      detalle:
        conError.length > 0 ? (
          <span className="text-red-700 dark:text-red-300">
            {conError.length} ciudad(es) con error: reinténtalas abajo.
          </span>
        ) : undefined,
      pestana: "json",
    },
    {
      id: "transformacion",
      titulo: "Transformación",
      explicacion:
        "Convierte los arrays paralelos (time, temperature_2m…) en un registro por ciudad y hora, con la fecha interpretada en UTC.",
      estado: !local
        ? "pendiente"
        : local.transformacion.errores.length > 0
          ? "error"
          : "completada",
      entrada: local ? { valor: horasBrutas, etiqueta: "horas en JSON" } : null,
      salida: local ? { valor: totalExtraido, etiqueta: "registros" } : null,
      duracionMs: local?.msTransformacion ?? null,
      detalle:
        local && local.transformacion.errores.length > 0 ? (
          <span className="text-red-700 dark:text-red-300">
            {local.transformacion.errores.length} problema(s) de estructura.
          </span>
        ) : undefined,
      pestana: "transformados",
    },
    {
      id: "limpieza",
      titulo: "Limpieza",
      explicacion:
        "Valida fechas, tipos numéricos y rangos; rechaza nulos (sin convertirlos en 0) y duplicados, anotando el motivo.",
      estado: local ? "completada" : "pendiente",
      entrada: local ? { valor: totalExtraido, etiqueta: "registros" } : null,
      salida: local ? { valor: validos.length, etiqueta: "válidos" } : null,
      duracionMs: local?.msLimpieza ?? null,
      detalle: local ? (
        <span className="text-muted-foreground">
          {n(rechazados)} rechazados por calidad
        </span>
      ) : undefined,
      pestana: rechazados > 0 ? "rechazados" : "validos",
    },
    {
      id: "filtrado",
      titulo: "Filtrado y selección",
      explicacion:
        "Aplica tus filtros y el orden elegido sobre los válidos; tú decides qué filas se cargan.",
      estado: !local
        ? "pendiente"
        : interpretados.errores.length > 0
          ? "error"
          : "completada",
      entrada: local ? { valor: validos.length, etiqueta: "válidos" } : null,
      salida: local
        ? { valor: paraCargar.length, etiqueta: "seleccionados" }
        : null,
      duracionMs: local ? msFiltrado : null,
      detalle: local ? (
        <span className="text-muted-foreground">
          {n(ordenados.length)} coinciden con los filtros
        </span>
      ) : undefined,
      pestana: "validos",
    },
    {
      id: "carga",
      titulo: "Carga",
      explicacion:
        "Upsert en Supabase por lotes de 500 desde el servidor y verificación posterior de las claves en destino.",
      estado: !carga
        ? "pendiente"
        : carga.fase !== "terminada"
          ? "en_curso"
          : resumenCarga!.fallidos > 0 ||
              carga.verificacion?.error ||
              (carga.verificacion?.faltan.length ?? 0) > 0
            ? "error"
            : "completada",
      entrada: carga
        ? { valor: carga.snapshot.length, etiqueta: "congelados" }
        : { valor: paraCargar.length, etiqueta: "por enviar" },
      salida: carga
        ? { valor: resumenCarga!.registrosCorrectos, etiqueta: "confirmados" }
        : null,
      duracionMs: carga?.duracionMs ?? null,
      detalle: carga ? (
        <span className="text-muted-foreground">
          Lotes {resumenCarga!.completados}/{resumenCarga!.lotes}
          {carga.verificacion &&
            ` · verificados ${n(carga.verificacion.encontradas)}/${n(carga.verificacion.comprobadas)}`}
        </span>
      ) : supabase && !supabase.configurado ? (
        <span className="text-muted-foreground">Supabase sin configurar</span>
      ) : undefined,
      pestana: "carga",
    },
  ]

  const motivoOcupado = cargando
    ? "Hay una carga en curso: espera a que termine para extraer de nuevo."
    : extrayendo
      ? "Extracción en curso…"
      : undefined

  const pantallaAncha = usePantallaAncha()
  const ocupado = extrayendo || cargando

  // Las ciudades muestran en el mapa el estado de su última descarga.
  const estadosCiudades = Object.fromEntries(
    lista.map((e) => [e.ciudadId, e.estado])
  ) as Partial<Record<CiudadId, EstadoFase>>

  const estadoGlobal: EstadoFase = fases.some((f) => f.estado === "error")
    ? "error"
    : fases.some((f) => f.estado === "en_curso")
      ? "en_curso"
      : local
        ? "completada"
        : "pendiente"
  const textoGlobal: Record<EstadoFase, string> = {
    pendiente: "Sin ejecutar",
    en_curso: "En curso",
    completada: "Todo OK",
    error: "Con errores",
  }

  const vistas = [
    {
      pestana: "json",
      etiqueta: "JSON original",
      valor: ejecucion ? descargadas.length : null,
    },
    {
      pestana: "transformados",
      etiqueta: "Transformados",
      valor: local ? totalExtraido : null,
    },
    {
      pestana: "validos",
      etiqueta: "Válidos",
      valor: local ? validos.length : null,
    },
    {
      pestana: "rechazados",
      etiqueta: "Rechazados",
      valor: local ? rechazados : null,
    },
    {
      pestana: "carga",
      etiqueta: "Vista previa",
      valor: local ? paraCargar.length : null,
    },
    {
      pestana: "supabase",
      etiqueta: "En Supabase",
      valor: supabase?.filas ?? null,
    },
  ]

  const textoSupabase = !supabase
    ? "Comprobando Supabase…"
    : supabaseDisponible
      ? "Supabase conectado"
      : !supabase.configurado
        ? "Supabase no disponible"
        : "Tabla no accesible"

  return (
    <div className="relative flex min-h-svh flex-col lg:block lg:h-svh lg:overflow-hidden">
      <MapaEspana
        className="h-[65svh] shrink-0 lg:absolute lg:inset-0 lg:h-auto"
        seleccionadas={ciudadesSel}
        onAlternar={(id) => setCiudadesSel((c) => alternarCiudad(c, id))}
        estados={estadosCiudades}
        bloqueado={ocupado}
        margenes={pantallaAncha ? MARGENES_ANCHA : MARGENES_ESTRECHA}
      />

      <div className="grid gap-4 p-4 lg:contents">
        {/* Izquierda: qué se extrae */}
        <aside className="lg:absolute lg:top-4 lg:left-4 lg:flex lg:max-h-[calc(100svh-2rem)] lg:w-[340px] lg:flex-col">
          <Caja
            titulo={
              <span className="grid">
                <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                  Práctica de Big Data · Pipeline ETL
                </span>
                <span className="text-base">Open-Meteo → Supabase</span>
              </span>
            }
            accion={<BotonTema />}
          >
            <ConfiguracionExtraccion
              ciudades={ciudadesSel}
              onCiudades={setCiudadesSel}
              inicio={inicio}
              fin={fin}
              onInicio={setInicio}
              onFin={setFin}
              periodo={periodo}
              hoy={hoy}
              ocupado={ocupado}
              motivoOcupado={motivoOcupado}
              onExtraer={extraer}
            />
          </Caja>
        </aside>

        {/* Derecha: pipeline y registro; debajo, inspección y subida */}
        <div className="grid gap-4 lg:absolute lg:top-4 lg:right-4 lg:bottom-4 lg:w-[400px] lg:grid-rows-[minmax(0,1fr)_auto] lg:gap-3">
          <Caja
            titulo="Pipeline"
            accion={
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <IconoEstado estado={estadoGlobal} className="size-3.5" />
                <span aria-hidden>{textoGlobal[estadoGlobal]}</span>
              </span>
            }
            cuerpoClassName="grid content-start gap-3 p-2"
          >
            <PipelineCompacto fases={fases} onInspeccionar={inspeccionar} />
            <CiudadesConError
              fallidas={conError}
              onReintentar={(e) => reintentarCiudad(e.ciudadId)}
              bloqueado={ocupado}
            />
            <div className="grid gap-1.5 border-t border-black/5 px-2 pt-3 dark:border-white/5">
              <h3 className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                Registro
              </h3>
              <Registro entradas={registro} />
            </div>
          </Caja>

          <div className="grid gap-3 sm:grid-cols-2">
            <Caja titulo="Inspección de datos" cuerpoClassName="p-1.5">
              <ul className="grid">
                {vistas.map((v) => (
                  <li key={v.pestana}>
                    <button
                      type="button"
                      onClick={() => inspeccionar(v.pestana)}
                      className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1 text-xs transition-colors outline-none hover:bg-black/5 focus-visible:ring-3 focus-visible:ring-ring/50 dark:hover:bg-white/5"
                    >
                      <span>{v.etiqueta}</span>
                      <span className="text-muted-foreground tabular-nums">
                        {v.valor === null ? "—" : n(v.valor)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </Caja>

            <Caja
              titulo="Subida de registros"
              cuerpoClassName="grid content-start gap-2 p-3 text-xs"
            >
              <p className="flex items-center gap-1.5" title={supabase?.error}>
                <IconoEstado
                  estado={
                    !supabase
                      ? "en_curso"
                      : supabaseDisponible
                        ? "completada"
                        : "error"
                  }
                  className="size-3.5"
                />
                <span aria-hidden>{textoSupabase}</span>
              </p>
              <dl className="grid grid-cols-[1fr_auto] gap-x-2 tabular-nums">
                <dt className="text-muted-foreground">Válidos</dt>
                <dd>{local ? n(validos.length) : "—"}</dd>
                <dt className="text-muted-foreground">Seleccionados</dt>
                <dd>{local ? n(paraCargar.length) : "—"}</dd>
              </dl>
              {fueraDeFiltros > 0 && (
                <p className="flex items-start gap-1 text-amber-800 dark:text-amber-300">
                  <AlertTriangleIcon
                    className="mt-px size-3.5 shrink-0"
                    aria-hidden
                  />
                  {n(fueraDeFiltros)} fuera de filtros (no se suben)
                </p>
              )}
              <Button
                size="sm"
                disabled={
                  !supabaseDisponible || ocupado || validos.length === 0
                }
                onClick={subirTodos}
                title="Restablece los filtros y sube todos los registros válidos en lotes de 500 (upsert, sin duplicados)."
              >
                <UploadCloudIcon data-icon="inline-start" />
                Subir todos
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={
                  !supabaseDisponible || ocupado || paraCargar.length === 0
                }
                onClick={subir}
              >
                Subir selección
              </Button>
              {carga && resumenCarga && (
                <p className="flex items-center gap-1.5 tabular-nums">
                  <IconoEstado estado={fases[4].estado} className="size-3.5" />
                  Lotes {resumenCarga.completados}/{resumenCarga.lotes}
                  {carga.verificacion &&
                    ` · ${n(carga.verificacion.encontradas)} verif.`}
                </p>
              )}
              <Button
                variant="link"
                size="xs"
                className="h-auto justify-self-start px-0"
                onClick={() => inspeccionar("carga")}
              >
                Ver detalles
              </Button>
            </Caja>
          </div>
        </div>
      </div>

      <Dialog.Root open={inspeccionAbierta} onOpenChange={setInspeccionAbierta}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/25 backdrop-blur-[2px]" />
          <Dialog.Popup className="fixed inset-3 z-50 flex flex-col overflow-hidden rounded-2xl border border-white/60 bg-background/90 shadow-2xl backdrop-blur-xl outline-none sm:inset-6 lg:inset-10 dark:border-white/10">
            <header className="flex items-center justify-between gap-2 border-b px-4 py-3">
              <Dialog.Title className="text-base font-semibold">
                Inspección de datos
              </Dialog.Title>
              <Dialog.Close
                aria-label="Cerrar"
                className={buttonVariants({
                  variant: "ghost",
                  size: "icon-sm",
                })}
              >
                <XIcon />
              </Dialog.Close>
            </header>
            <div className="min-h-0 flex-1 overflow-auto p-4">
              <Tabs
                value={pestana}
                onValueChange={(v) => setPestana(String(v))}
              >
                <div className="overflow-x-auto pb-1">
                  <TabsList>
                    <TabsTrigger value="json">JSON original</TabsTrigger>
                    <TabsTrigger value="transformados">
                      Transformados{" "}
                      {local && (
                        <Badge variant="secondary">{n(totalExtraido)}</Badge>
                      )}
                    </TabsTrigger>
                    <TabsTrigger value="validos">
                      Registros válidos{" "}
                      {local && (
                        <Badge variant="secondary">{n(validos.length)}</Badge>
                      )}
                    </TabsTrigger>
                    <TabsTrigger value="rechazados">
                      Rechazados{" "}
                      {local && (
                        <Badge variant="secondary">{n(rechazados)}</Badge>
                      )}
                    </TabsTrigger>
                    <TabsTrigger value="carga">
                      Vista previa de la carga{" "}
                      {local && (
                        <Badge variant="secondary">
                          {n(paraCargar.length)}
                        </Badge>
                      )}
                    </TabsTrigger>
                    <TabsTrigger value="supabase">
                      Datos en Supabase
                    </TabsTrigger>
                  </TabsList>
                </div>
                <div className="rounded-xl border bg-card p-3 sm:p-4">
                  <TabsContent value="json">
                    <PestanaJson
                      orden={ejecucion?.ciudades ?? []}
                      extracciones={extracciones}
                      inicio={ejecucion?.inicio ?? inicio}
                      fin={ejecucion?.fin ?? fin}
                    />
                  </TabsContent>
                  <TabsContent value="transformados">
                    <PestanaTransformados
                      transformacion={local?.transformacion ?? null}
                    />
                  </TabsContent>
                  <TabsContent value="validos">
                    <PestanaValidos
                      totalValidos={validos.length}
                      ciudadesDisponibles={ciudadesDisponibles}
                      ordenados={ordenados}
                      filtros={filtros}
                      onFiltros={cambiarFiltros}
                      interpretados={interpretados}
                      orden={orden}
                      onOrden={cambiarOrden}
                      seleccion={seleccion}
                      onSeleccion={setSeleccion}
                      seleccionadosParaCargar={paraCargar.length}
                      fueraDeFiltros={fueraDeFiltros}
                    />
                  </TabsContent>
                  <TabsContent value="rechazados">
                    <PestanaRechazados
                      limpieza={local?.limpieza ?? null}
                      excluidosPorFiltros={Math.max(
                        0,
                        validos.length - ordenados.length
                      )}
                    />
                  </TabsContent>
                  <TabsContent value="carga">
                    <PestanaCarga
                      supabase={supabase}
                      paraCargar={registrosParaCargar}
                      carga={carga}
                      enCurso={cargando}
                      onSubir={subir}
                      totalValidos={validos.length}
                      onSubirTodos={subirTodos}
                      onReintentar={reintentarLotes}
                    />
                  </TabsContent>
                  <TabsContent value="supabase">
                    <PestanaSupabase
                      supabase={supabase}
                      pendientesLocales={paraCargar.length}
                      version={versionDestino}
                    />
                  </TabsContent>
                </div>
              </Tabs>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
