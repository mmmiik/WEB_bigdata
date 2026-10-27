-- Tabla de destino del pipeline ETL Open-Meteo → Supabase.
-- Una fila por ciudad y hora (UTC).

create table if not exists public.mediciones_meteorologicas (
  id               bigint generated always as identity primary key,
  ciudad           text             not null,
  fecha_hora       timestamptz      not null,
  temperatura_c    double precision not null,
  humedad_pct      double precision not null,
  precipitacion_mm double precision not null,
  importado_en     timestamptz      not null default now(),

  -- Clave natural: permite el upsert y evita duplicados al recargar.
  constraint mediciones_meteorologicas_ciudad_fecha_hora_key
    unique (ciudad, fecha_hora),

  constraint mediciones_meteorologicas_ciudad_no_vacia
    check (btrim(ciudad) <> ''),
  -- double precision admite NaN e Infinity: se excluyen expresamente.
  -- En PostgreSQL NaN se considera mayor que cualquier número, así que
  -- "< 'Infinity'" también lo descarta. No se fijan umbrales de temperatura.
  constraint mediciones_meteorologicas_temperatura_finita
    check (temperatura_c > '-Infinity'::double precision
       and temperatura_c < 'Infinity'::double precision),
  constraint mediciones_meteorologicas_humedad_rango
    check (humedad_pct >= 0 and humedad_pct <= 100),
  constraint mediciones_meteorologicas_precipitacion_no_negativa
    check (precipitacion_mm >= 0
       and precipitacion_mm < 'Infinity'::double precision)
);

comment on table public.mediciones_meteorologicas is
  'Mediciones horarias de Open-Meteo (archivo histórico), cargadas por el pipeline ETL. Fechas en UTC.';
comment on column public.mediciones_meteorologicas.importado_en is
  'Momento de la primera inserción. El upsert no lo modifica al actualizar una fila existente.';

-- RLS activado y SIN políticas: anon y authenticated no pueden leer ni
-- escribir. La aplicación accede desde el servidor con la clave secreta
-- (rol service_role), que omite RLS.
alter table public.mediciones_meteorologicas enable row level security;

-- Defensa adicional: sin privilegios para los roles públicos.
revoke all on table public.mediciones_meteorologicas from anon, authenticated;
grant select, insert, update on table public.mediciones_meteorologicas to service_role;
