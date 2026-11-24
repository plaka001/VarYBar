-- ============ TRIVIA + RULETA · VAR y BAR ============
-- Trivia en vivo: el primero que acierte en el chat gana 1 punto; al final, ruleta donde cada punto es una oportunidad.
-- Todo el estado de la trivia va en una sola fila (estado jsonb). La página del máster calcula cada cambio
-- (src/lib/trivia.ts) y lo guarda con guardar_trivia, que pide el PIN.
-- `version` evita que dos másteres se pisen: si otro guardó primero, la función responde 'conflicto'.

-- La vista al aire ahora también puede mostrar la trivia
alter table public.al_aire drop constraint al_aire_vista_check;
alter table public.al_aire add constraint al_aire_vista_check check (vista in ('fecha', 'tabla', 'trivia'));

create table public.trivia (
  id           smallint primary key default 1 check (id = 1),
  estado       jsonb not null default '{}'::jsonb,
  version      integer not null default 0,
  actualizado  timestamptz not null default now()
);
insert into public.trivia (id) values (1);

alter table public.trivia enable row level security;
create policy "lectura publica" on public.trivia for select to anon, authenticated using (true);
grant select on public.trivia to anon, authenticated;
revoke insert, update, delete, truncate on public.trivia from anon, authenticated;

-- Guarda el estado de la trivia.
-- Devuelve: ok | conflicto (otro máster cambió algo primero) | invalido | sin_pin | pin_incorrecto | bloqueado
create or replace function public.guardar_trivia(p_pin text, p_estado jsonb, p_version int)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare v text;
begin
  v := privado.chequear_pin(btrim(p_pin));
  if v <> 'ok' then return v; end if;
  if p_estado is null or jsonb_typeof(p_estado) <> 'object' or octet_length(p_estado::text) > 60000 then
    return 'invalido';
  end if;
  update public.trivia
     set estado = p_estado, version = version + 1, actualizado = now()
   where id = 1 and version = p_version;
  if not found then return 'conflicto'; end if;
  return 'ok';
end;
$$;

-- poner_al_aire acepta también 'trivia'
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
  if p_vista not in ('fecha', 'tabla', 'trivia') or p_fecha not between 1 and 20 then return 'invalido'; end if;
  update public.al_aire set vista = p_vista, fecha = p_fecha, actualizado = now() where id = 1;
  return 'ok';
end;
$$;

revoke execute on function public.guardar_trivia(text, jsonb, int) from public;
grant execute on function public.guardar_trivia(text, jsonb, int) to anon, authenticated;

-- Tiempo real: la vista al aire se entera sola de cada punto
alter publication supabase_realtime add table public.trivia;
