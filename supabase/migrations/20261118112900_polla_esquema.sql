-- ============ LA POLLA · VAR y BAR ============
-- Esquema aplicado en el proyecto de Supabase "VarYBar" (dzcnquvkedpammqjucie).
create extension if not exists pgcrypto with schema extensions;

-- ---------- tablas públicas (solo lectura para el público) ----------
create table public.participantes (
  id       text primary key,
  nombre   text not null,
  orden    smallint not null default 0,
  activo   boolean not null default true
);

create table public.partidos (
  id               text primary key,
  torneo           text not null default 'Liga BetPlay 2026-II',
  fase             text not null default 'Cuadrangulares',
  fecha            smallint not null check (fecha between 1 and 20),
  grupo            text check (grupo in ('A','B')),
  local            text not null,
  visitante        text not null,
  inicio           timestamptz,
  estadio          text,
  goles_local      smallint check (goles_local between 0 and 30),
  goles_visitante  smallint check (goles_visitante between 0 and 30),
  multiplicador    smallint not null default 1 check (multiplicador between 1 and 5),
  orden            smallint not null default 0,
  constraint resultado_completo check ((goles_local is null) = (goles_visitante is null))
);
create index partidos_fecha_idx on public.partidos (fecha, orden);

create table public.pronosticos (
  partido_id       text not null references public.partidos(id) on delete cascade,
  participante_id  text not null references public.participantes(id) on delete cascade,
  goles_local      smallint not null check (goles_local between 0 and 30),
  goles_visitante  smallint not null check (goles_visitante between 0 and 30),
  actualizado      timestamptz not null default now(),
  primary key (partido_id, participante_id)
);
create index pronosticos_participante_idx on public.pronosticos (participante_id);

-- Lo que está saliendo al aire en este momento (una sola fila)
create table public.al_aire (
  id           smallint primary key default 1 check (id = 1),
  vista        text not null default 'fecha' check (vista in ('fecha','tabla')),
  fecha        smallint not null default 1 check (fecha between 1 and 20),
  actualizado  timestamptz not null default now()
);
insert into public.al_aire (id) values (1);

-- RLS: todo el mundo puede leer; nadie escribe directo (se escribe solo con las funciones con PIN)
alter table public.participantes enable row level security;
alter table public.partidos      enable row level security;
alter table public.pronosticos   enable row level security;
alter table public.al_aire       enable row level security;

create policy "lectura publica" on public.participantes for select to anon, authenticated using (true);
create policy "lectura publica" on public.partidos      for select to anon, authenticated using (true);
create policy "lectura publica" on public.pronosticos   for select to anon, authenticated using (true);
create policy "lectura publica" on public.al_aire       for select to anon, authenticated using (true);

grant usage on schema public to anon, authenticated;
grant select on public.participantes, public.partidos, public.pronosticos, public.al_aire to anon, authenticated;
revoke insert, update, delete, truncate on public.participantes, public.partidos, public.pronosticos, public.al_aire from anon, authenticated;

-- ---------- esquema privado: el PIN del máster ----------
create schema if not exists privado;
revoke all on schema privado from public, anon, authenticated;

create table privado.ajustes (
  id               smallint primary key default 1 check (id = 1),
  pin_hash         text,
  fallos           smallint not null default 0,
  bloqueado_hasta  timestamptz
);
insert into privado.ajustes (id) values (1);
revoke all on privado.ajustes from public, anon, authenticated;

-- Revisa el PIN. Devuelve: ok | sin_pin | pin_incorrecto | bloqueado
-- (no lanza errores para que el conteo de intentos fallidos quede guardado)
create or replace function privado.chequear_pin(p_pin text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hash   text;
  v_fallos smallint;
  v_hasta  timestamptz;
begin
  select pin_hash, fallos, bloqueado_hasta into v_hash, v_fallos, v_hasta
    from privado.ajustes where id = 1 for update;
  if v_hash is null then
    return 'sin_pin';
  end if;
  if v_hasta is not null and v_hasta > now() then
    return 'bloqueado';
  end if;
  if p_pin is null or extensions.crypt(p_pin, v_hash) <> v_hash then
    if v_fallos + 1 >= 10 then
      update privado.ajustes set fallos = 0, bloqueado_hasta = now() + interval '5 minutes' where id = 1;
    else
      update privado.ajustes set fallos = v_fallos + 1, bloqueado_hasta = null where id = 1;
    end if;
    return 'pin_incorrecto';
  end if;
  if v_fallos <> 0 or v_hasta is not null then
    update privado.ajustes set fallos = 0, bloqueado_hasta = null where id = 1;
  end if;
  return 'ok';
end;
$$;
revoke execute on function privado.chequear_pin(text) from public, anon, authenticated;

-- ---------- funciones públicas (las que usa la página) ----------
create or replace function public.estado_pin()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case when exists (select 1 from privado.ajustes where id = 1 and pin_hash is not null)
              then 'con_pin' else 'sin_pin' end;
$$;

create or replace function public.crear_pin(p_pin text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_pin is null or length(btrim(p_pin)) < 4 then
    return 'pin_corto';
  end if;
  update privado.ajustes
     set pin_hash = extensions.crypt(btrim(p_pin), extensions.gen_salt('bf', 8)),
         fallos = 0, bloqueado_hasta = null
   where id = 1 and pin_hash is null;
  if found then
    return 'ok';
  end if;
  return 'ya_existe';
end;
$$;

create or replace function public.verificar_pin(p_pin text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  return privado.chequear_pin(btrim(p_pin));
end;
$$;

create or replace function public.cambiar_pin(p_pin text, p_nuevo text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare v text;
begin
  v := privado.chequear_pin(btrim(p_pin));
  if v <> 'ok' then return v; end if;
  if p_nuevo is null or length(btrim(p_nuevo)) < 4 then return 'pin_corto'; end if;
  update privado.ajustes set pin_hash = extensions.crypt(btrim(p_nuevo), extensions.gen_salt('bf', 8)) where id = 1;
  return 'ok';
end;
$$;

-- Guarda (o borra, si llegan vacíos) el pronóstico de un participante para un partido
create or replace function public.guardar_pronostico(p_pin text, p_partido text, p_participante text, p_local int, p_visitante int)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare v text;
begin
  v := privado.chequear_pin(btrim(p_pin));
  if v <> 'ok' then return v; end if;
  if not exists (select 1 from public.partidos where id = p_partido)
     or not exists (select 1 from public.participantes where id = p_participante) then
    return 'no_existe';
  end if;
  if p_local is null or p_visitante is null then
    delete from public.pronosticos where partido_id = p_partido and participante_id = p_participante;
    return 'ok';
  end if;
  if p_local not between 0 and 30 or p_visitante not between 0 and 30 then
    return 'invalido';
  end if;
  insert into public.pronosticos (partido_id, participante_id, goles_local, goles_visitante, actualizado)
  values (p_partido, p_participante, p_local, p_visitante, now())
  on conflict (partido_id, participante_id)
  do update set goles_local = excluded.goles_local,
                goles_visitante = excluded.goles_visitante,
                actualizado = now();
  return 'ok';
end;
$$;

-- Guarda (o borra, si llegan vacíos) el resultado real de un partido
create or replace function public.guardar_resultado(p_pin text, p_partido text, p_local int, p_visitante int)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare v text;
begin
  v := privado.chequear_pin(btrim(p_pin));
  if v <> 'ok' then return v; end if;
  if not exists (select 1 from public.partidos where id = p_partido) then return 'no_existe'; end if;
  if p_local is null or p_visitante is null then
    update public.partidos set goles_local = null, goles_visitante = null where id = p_partido;
    return 'ok';
  end if;
  if p_local not between 0 and 30 or p_visitante not between 0 and 30 then
    return 'invalido';
  end if;
  update public.partidos set goles_local = p_local, goles_visitante = p_visitante where id = p_partido;
  return 'ok';
end;
$$;

-- Corrige equipos, día/hora o estadio de un partido (ej. cuando la Dimayor confirme horarios)
create or replace function public.editar_partido(p_pin text, p_partido text, p_local text, p_visitante text, p_inicio timestamptz, p_estadio text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare v text;
begin
  v := privado.chequear_pin(btrim(p_pin));
  if v <> 'ok' then return v; end if;
  if not exists (select 1 from public.partidos where id = p_partido) then return 'no_existe'; end if;
  if coalesce(btrim(p_local), '') = '' or coalesce(btrim(p_visitante), '') = '' then return 'invalido'; end if;
  update public.partidos
     set local = btrim(p_local),
         visitante = btrim(p_visitante),
         inicio = p_inicio,
         estadio = nullif(btrim(coalesce(p_estadio, '')), '')
   where id = p_partido;
  return 'ok';
end;
$$;

-- Cambia lo que sale al aire: vista 'fecha' o 'tabla', y qué fecha
create or replace function public.poner_al_aire(p_pin text, p_vista text, p_fecha int)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare v text;
begin
  v := privado.chequear_pin(btrim(p_pin));
  if v <> 'ok' then return v; end if;
  if p_vista not in ('fecha','tabla') or p_fecha not between 1 and 20 then return 'invalido'; end if;
  update public.al_aire set vista = p_vista, fecha = p_fecha, actualizado = now() where id = 1;
  return 'ok';
end;
$$;

revoke execute on function public.estado_pin() from public;
revoke execute on function public.crear_pin(text) from public;
revoke execute on function public.verificar_pin(text) from public;
revoke execute on function public.cambiar_pin(text, text) from public;
revoke execute on function public.guardar_pronostico(text, text, text, int, int) from public;
revoke execute on function public.guardar_resultado(text, text, int, int) from public;
revoke execute on function public.editar_partido(text, text, text, text, timestamptz, text) from public;
revoke execute on function public.poner_al_aire(text, text, int) from public;

grant execute on function public.estado_pin() to anon, authenticated;
grant execute on function public.crear_pin(text) to anon, authenticated;
grant execute on function public.verificar_pin(text) to anon, authenticated;
grant execute on function public.cambiar_pin(text, text) to anon, authenticated;
grant execute on function public.guardar_pronostico(text, text, text, int, int) to anon, authenticated;
grant execute on function public.guardar_resultado(text, text, int, int) to anon, authenticated;
grant execute on function public.editar_partido(text, text, text, text, timestamptz, text) to anon, authenticated;
grant execute on function public.poner_al_aire(text, text, int) to anon, authenticated;

-- Tiempo real: la vista al aire se entera sola de cada cambio
alter publication supabase_realtime add table public.participantes, public.partidos, public.pronosticos, public.al_aire;
