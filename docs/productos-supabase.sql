-- ============================================================================
-- Kingdom Nexus · Módulo de Productos
-- Migración de Supabase: public.products
-- Archivo: docs/productos-supabase.sql
--
-- CÓMO EJECUTAR
--   Supabase Dashboard → SQL Editor → pega este archivo completo → Run.
--   El script es idempotente: puede ejecutarse más de una vez sin perder datos.
--
-- BLOQUEADOR CONOCIDO (leer antes de ejecutar)
--   El login/registro actual usa sessionStorage y NO crea una sesión real de
--   Supabase Auth. Por eso esta migración:
--     · NO crea políticas RLS permisivas (nada de USING (true)).
--     · NO otorga permisos al rol anon.
--     · Otorga SELECT/INSERT/UPDATE únicamente al rol authenticated.
--   Consecuencia: el frontend seguirá recibiendo 42501 y el módulo de Productos
--   permanecerá bloqueado por RLS hasta que exista Supabase Auth real o un
--   modelo de tenant autenticado. Es el comportamiento esperado y documentado.
--
--   No se incluyen políticas permisivas para anon, ni ejecutables ni como
--   ejemplo: habilitarlas expondría el catálogo completo y no es una estrategia
--   de pruebas aceptada.
--
-- ALCANCE
--   Solo public.products. No modifica autenticación, registro, login, pagos,
--   planes, dashboards, inventario, movimientos, entradas, salidas ni reportes.
-- ============================================================================

-- ============================================================================
-- 0. DIAGNÓSTICO PREVIO (solo lectura, sin cambios)
--    Ejecuta estas consultas primero si quieres ver el estado antes de migrar.
-- ============================================================================

-- 0.1 Duplicados normalizados de SKU (debe devolver 0 filas para poder migrar)
-- select upper(btrim(sku)) as sku_normalizado, count(*) as registros
--   from public.products
--  group by upper(btrim(sku))
-- having count(*) > 1
--  order by count(*) desc, upper(btrim(sku));

-- 0.2 Valores negativos heredados (no se corrigen; solo se reportan)
-- select id, name, quantity, cost, sales_price, min_stock, initial_stock
--   from public.products
--  where quantity < 0 or cost < 0 or sales_price < 0
--     or min_stock < 0 or initial_stock < 0;

-- 0.3 Filas con name o sku NULL / en blanco
-- select id, name, sku
--   from public.products
--  where name is null or btrim(name) = ''
--     or sku is null or btrim(sku) = '';

-- 0.4 Objetos únicos existentes sobre (sku) y sus dependencias
-- select c.conname as nombre, 'constraint' as tipo, c.convalidated,
--        pg_get_constraintdef(c.oid) as definicion
--   from pg_constraint c
--  where c.conrelid = 'public.products'::regclass
--    and c.contype = 'u'
--    and c.conkey = array[
--        (select a.attnum from pg_attribute a
--          where a.attrelid = 'public.products'::regclass and a.attname = 'sku')
--    ];
--
-- select ic.relname as nombre, 'index' as tipo, pg_get_indexdef(i.indexrelid) as definicion
--   from pg_index i
--   join pg_class ic on ic.oid = i.indexrelid
--  where i.indrelid = 'public.products'::regclass
--    and i.indisunique
--    and not i.indisprimary
--    and not exists (select 1 from pg_constraint c where c.conindid = i.indexrelid);
--
-- select pg_describe_object(d.classid, d.objid, d.objsubid) as dependiente,
--        pg_describe_object(d.refclassid, d.refobjid, d.refobjsubid) as referenciado,
--        d.deptype
--   from pg_depend d
--  where d.refobjid in (
--        select c.oid from pg_constraint c
--         where c.conrelid = 'public.products'::regclass and c.contype = 'u'
--        union all
--        select i.indexrelid from pg_index i
--         where i.indrelid = 'public.products'::regclass and i.indisunique
--    )
--    and d.classid <> 'pg_class'::regclass;

begin;

-- ============================================================================
-- 1. COLUMNAS REQUERIDAS POR EL MÓDULO (solo aditivas; nunca elimina datos)
-- ============================================================================

alter table public.products add column if not exists unit text;
alter table public.products add column if not exists is_active boolean default true;
alter table public.products add column if not exists created_at timestamptz default now();
alter table public.products add column if not exists updated_at timestamptz default now();

update public.products set is_active = true where is_active is null;
update public.products set created_at = now() where created_at is null;
update public.products set updated_at = now() where updated_at is null;

alter table public.products alter column is_active set default true;
alter table public.products alter column is_active set not null;
alter table public.products alter column created_at set default now();
alter table public.products alter column created_at set not null;
alter table public.products alter column updated_at set default now();
alter table public.products alter column updated_at set not null;

-- ============================================================================
-- 2. VALORES POR DEFECTO EN COLUMNAS EXISTENTES
-- ============================================================================

alter table public.products alter column id set default gen_random_uuid();
alter table public.products alter column quantity set default 0;
alter table public.products alter column cost set default 0;
alter table public.products alter column sales_price set default 0;
alter table public.products alter column min_stock set default 0;
alter table public.products alter column initial_stock set default 0;

-- ============================================================================
-- 3. BACKFILL DE NULL EN COLUMNAS NUMÉRICAS
--    Solo rellena NULL. No sobrescribe ningún valor existente.
-- ============================================================================

update public.products set quantity = 0 where quantity is null;
update public.products set cost = 0 where cost is null;
update public.products set sales_price = 0 where sales_price is null;
update public.products set min_stock = 0 where min_stock is null;
update public.products set initial_stock = 0 where initial_stock is null;

alter table public.products alter column quantity set not null;
alter table public.products alter column cost set not null;
alter table public.products alter column sales_price set not null;
alter table public.products alter column min_stock set not null;
alter table public.products alter column initial_stock set not null;

-- ============================================================================
-- 4. REPORTE DE VALORES NEGATIVOS HEREDADOS
--    No se reemplazan. Las restricciones NOT VALID del paso 8 bloquearán
--    únicamente las nuevas escrituras inválidas.
-- ============================================================================

do $$
declare
    negativos integer;
begin
    select count(*) into negativos
      from public.products
     where quantity < 0 or cost < 0 or sales_price < 0
        or min_stock < 0 or initial_stock < 0;

    if negativos > 0 then
        raise warning 'Hay % productos con valores negativos heredados. No se modificaron. Corrígelos manualmente y valida luego las restricciones NOT VALID.', negativos;
    else
        raise notice 'Sin valores negativos heredados.';
    end if;
end $$;

-- ============================================================================
-- 5. BACKFILL DE name NULL / EN BLANCO
--    Placeholder determinista e identificable. No sobrescribe nombres válidos.
--    El conteo afectado se informa con RAISE NOTICE y queda verificable al
--    final del script (consulta 13.5).
-- ============================================================================

do $$
declare
    filas integer;
begin
    select count(*) into filas
      from public.products
     where name is null or btrim(name) = '';

    if filas > 0 then
        raise notice 'name NULL/en blanco rellenados con "Producto sin nombre <id>": % filas.', filas;

        update public.products
           set name = 'Producto sin nombre ' || left(id::text, 8)
         where name is null or btrim(name) = '';
    end if;
end $$;

alter table public.products alter column name set not null;

-- ============================================================================
-- 6. BACKFILL DE sku NULL / EN BLANCO
--    Determinista y sin colisiones: usa el UUID completo, no un prefijo.
--    No sobrescribe SKU válidos existentes.
-- ============================================================================

do $$
declare
    filas integer;
begin
    select count(*) into filas
      from public.products
     where sku is null or btrim(sku) = '';

    if filas > 0 then
        raise notice 'sku NULL/en blanco rellenados con "SKU-<uuid completo>": % filas.', filas;

        update public.products
           set sku = 'SKU-' || upper(replace(id::text, '-', ''))
         where sku is null or btrim(sku) = '';
    end if;
end $$;

-- ============================================================================
-- 7. VERIFICACIÓN BLOQUEANTE E ÍNDICE ÚNICO NORMALIZADO DE SKU
--    · Normalización: trim + mayúsculas (upper(btrim(sku))).
--    · Si hay duplicados normalizados, la migración se cancela y los reporta.
--      Nunca se borran, fusionan ni renombran registros automáticamente.
--    · Antes de crear el índice se inspeccionan las restricciones e índices
--      únicos que cubren exactamente (sku). Solo esos objetos redundantes se
--      eliminan; se verifican dependencias y no se usa CASCADE.
-- ============================================================================

do $$
declare
    conflictos text;
begin
    select string_agg(formato, E'\n  - ' order by formato)
      into conflictos
      from (
            select upper(btrim(sku)) || ' (' || count(*)::text || ' registros)' as formato
              from public.products
             group by upper(btrim(sku))
            having count(*) > 1
           ) duplicados;

    if conflictos is not null then
        raise exception E'Migración cancelada: existen SKU duplicados tras normalizar (trim + mayúsculas):\n  - %\n\nNo se borró, fusionó ni renombró ningún registro. Corrige los conflictos manualmente y vuelve a ejecutar la migración.', conflictos;
    end if;

    if exists (select 1 from public.products where sku is null or btrim(sku) = '') then
        raise exception 'Migración cancelada: aún existen SKU NULL o en blanco.';
    end if;

    if exists (select 1 from public.products where name is null or btrim(name) = '') then
        raise exception 'Migración cancelada: aún existen name NULL o en blanco.';
    end if;
end $$;

-- Elimina únicamente los objetos únicos "simples" sobre (sku) que quedarían
-- redundantes frente al índice normalizado. Distingue restricciones UNIQUE de
-- índices UNIQUE independientes, verifica dependencias (por ejemplo FK) y
-- cancela la migración si alguna impide la eliminación. Nunca usa CASCADE y
-- no toca índices o restricciones ajenos a (sku).
do $$
declare
    sku_attnum smallint;
    objeto record;
begin
    select a.attnum into sku_attnum
      from pg_attribute a
     where a.attrelid = 'public.products'::regclass
       and a.attname = 'sku'
       and not a.attisdropped;

    -- Restricciones UNIQUE simples sobre (sku)
    for objeto in
        select c.conname as nombre,
               c.oid as restriccion_oid,
               c.conindid as indice_oid
          from pg_constraint c
         where c.conrelid = 'public.products'::regclass
           and c.contype = 'u'
           and c.conkey = array[sku_attnum]
    loop
        if exists (
            select 1
              from pg_depend d
             where (d.refclassid = 'pg_constraint'::regclass
                    and d.refobjid = objeto.restriccion_oid
                    and d.classid <> 'pg_class'::regclass)
                or (d.refclassid = 'pg_class'::regclass
                    and d.refobjid = objeto.indice_oid
                    and d.classid <> 'pg_class'::regclass)
        ) then
            raise exception 'Migración cancelada: la restricción única % sobre (sku) tiene dependencias (por ejemplo una FK). Revísalas antes de eliminarla.', objeto.nombre;
        end if;

        execute format('alter table public.products drop constraint %I', objeto.nombre);
        raise notice 'Restricción única simple sobre (sku) eliminada: %.', objeto.nombre;
    end loop;

    -- Índices UNIQUE independientes sobre (sku) que no respaldan una restricción
    for objeto in
        select i.indexrelid as indice_oid,
               n.nspname as esquema,
               ic.relname as nombre
          from pg_index i
          join pg_class ic on ic.oid = i.indexrelid
          join pg_namespace n on n.oid = ic.relnamespace
         where i.indrelid = 'public.products'::regclass
           and i.indisunique
           and not i.indisprimary
           and i.indnkeyatts = 1
           and i.indkey[0] = sku_attnum
           and not exists (select 1 from pg_constraint c where c.conindid = i.indexrelid)
    loop
        if exists (
            select 1
              from pg_depend d
             where d.refclassid = 'pg_class'::regclass
               and d.refobjid = objeto.indice_oid
               and d.classid <> 'pg_class'::regclass
        ) then
            raise exception 'Migración cancelada: el índice único % sobre (sku) tiene dependencias (por ejemplo una FK). Revísalo antes de eliminarlo.', objeto.nombre;
        end if;

        execute format('drop index %I.%I', objeto.esquema, objeto.nombre);
        raise notice 'Índice único simple sobre (sku) eliminado: %.', objeto.nombre;
    end loop;
end $$;

alter table public.products alter column sku set not null;

create unique index if not exists products_sku_normalized_key
    on public.products (upper(btrim(sku)));

-- ============================================================================
-- 8. CHECK CONSTRAINTS (NOT VALID)
--    Protegen las nuevas escrituras sin bloquear la migración por datos
--    heredados. Cuando los datos heredados estén corregidos, valídalas con:
--      alter table public.products validate constraint <nombre>;
-- ============================================================================

do $$
begin
    if not exists (
        select 1 from pg_constraint
         where conname = 'products_quantity_nonnegative'
           and conrelid = 'public.products'::regclass
    ) then
        alter table public.products
            add constraint products_quantity_nonnegative
            check (quantity >= 0) not valid;
    end if;

    if not exists (
        select 1 from pg_constraint
         where conname = 'products_cost_nonnegative'
           and conrelid = 'public.products'::regclass
    ) then
        alter table public.products
            add constraint products_cost_nonnegative
            check (cost >= 0) not valid;
    end if;

    if not exists (
        select 1 from pg_constraint
         where conname = 'products_sales_price_nonnegative'
           and conrelid = 'public.products'::regclass
    ) then
        alter table public.products
            add constraint products_sales_price_nonnegative
            check (sales_price >= 0) not valid;
    end if;

    if not exists (
        select 1 from pg_constraint
         where conname = 'products_min_stock_nonnegative'
           and conrelid = 'public.products'::regclass
    ) then
        alter table public.products
            add constraint products_min_stock_nonnegative
            check (min_stock >= 0) not valid;
    end if;

    if not exists (
        select 1 from pg_constraint
         where conname = 'products_initial_stock_nonnegative'
           and conrelid = 'public.products'::regclass
    ) then
        alter table public.products
            add constraint products_initial_stock_nonnegative
            check (initial_stock >= 0) not valid;
    end if;

    if not exists (
        select 1 from pg_constraint
         where conname = 'products_name_not_blank'
           and conrelid = 'public.products'::regclass
    ) then
        alter table public.products
            add constraint products_name_not_blank
            check (btrim(name) <> '') not valid;
    end if;

    if not exists (
        select 1 from pg_constraint
         where conname = 'products_sku_not_blank'
           and conrelid = 'public.products'::regclass
    ) then
        alter table public.products
            add constraint products_sku_not_blank
            check (btrim(sku) <> '') not valid;
    end if;
end $$;

-- ============================================================================
-- 9. ACTUALIZACIÓN AUTOMÁTICA DE updated_at
-- ============================================================================

create or replace function public.set_products_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

revoke all on function public.set_products_updated_at() from public;
revoke all on function public.set_products_updated_at() from anon, authenticated;

drop trigger if exists products_set_updated_at on public.products;

create trigger products_set_updated_at
before update on public.products
for each row
execute function public.set_products_updated_at();

-- ============================================================================
-- 10. RLS Y PERMISOS MÍNIMOS
--     · RLS habilitado.
--     · authenticated: SELECT, INSERT, UPDATE (sin DELETE).
--     · anon: sin ningún privilegio.
--     · service_role: no se toca (Supabase lo administra).
--     · Sin políticas: RLS deniega todo hasta que exista auth real.
-- ============================================================================

alter table public.products enable row level security;

revoke all on public.products from anon;

-- Se revoca todo primero para neutralizar privilegios heredados por defecto
-- (Supabase puede otorgar ALL a authenticated al crear tablas). Después se
-- conceden únicamente los privilegios que el módulo necesita.
revoke all on public.products from authenticated;

grant usage on schema public to authenticated;
grant select, insert, update on public.products to authenticated;

-- No se otorga DELETE: el módulo desactiva productos; nunca los elimina.

commit;

-- ============================================================================
-- 11. POLÍTICAS PERMISIVAS: NO HABILITAR
--
--     No se incluyen políticas para anon (USING (true) / WITH CHECK (true)),
--     ni ejecutables ni como ejemplo. Otorgan acceso total a cualquiera que
--     tenga la publishable key (que es pública), no determinan propiedad y no
--     son una estrategia de pruebas aceptada. La única vía válida es Supabase
--     Auth real con políticas basadas en identidad o tenant (sección 12).
-- ============================================================================

-- ============================================================================
-- 12. POLÍTICAS RLS SEGURAS (EJEMPLOS COMENTADOS PARA EL FUTURO)
--     Requieren Supabase Auth real y una columna de propiedad/tenant.
--     No ejecutar todavía: el bloqueador actual es la ausencia de auth.
--     Si se agrega tenant, el índice único de SKU debe incluir el tenant
--     (ver índice products_owner_sku_normalized_key).
-- ============================================================================
--
-- alter table public.products
--     add column if not exists owner_id uuid not null default auth.uid()
--     references auth.users(id);
--
-- create unique index products_owner_sku_normalized_key
--     on public.products (owner_id, upper(btrim(sku)));
--
-- create policy products_select_own on public.products
--     for select to authenticated using (owner_id = auth.uid());
--
-- create policy products_insert_own on public.products
--     for insert to authenticated with check (owner_id = auth.uid());
--
-- create policy products_update_own on public.products
--     for update to authenticated using (owner_id = auth.uid())
--     with check (owner_id = auth.uid());

-- ============================================================================
-- 13. VERIFICACIÓN (solo lectura)
-- ============================================================================

-- 13.1 Columnas finales y tipos
select column_name, data_type, is_nullable, column_default
  from information_schema.columns
 where table_schema = 'public'
   and table_name = 'products'
 order by ordinal_position;

-- 13.2 Restricciones (convalidated = false en las NOT VALID)
select conname, contype, convalidated
  from pg_constraint
 where conrelid = 'public.products'::regclass
 order by conname;

-- 13.3 Índices (debe existir products_sku_normalized_key)
select indexname, indexdef
  from pg_indexes
 where schemaname = 'public'
   and tablename = 'products'
 order by indexname;

-- 13.4 Políticas RLS (debe estar vacío en la línea base segura)
select policyname, cmd, roles, qual, with_check
  from pg_policies
 where schemaname = 'public'
   and tablename = 'products';

-- 13.5 Registros con placeholder de nombre (revisar y corregir manualmente)
select id, name, sku
  from public.products
 where name like 'Producto sin nombre %'
 order by name, id;

-- 13.6 Conteo de registros afectados por backfills
select
    count(*) filter (where name like 'Producto sin nombre %') as nombres_placeholder,
    count(*) filter (where sku like 'SKU-%') as skus_generados,
    count(*) filter (
        where quantity < 0 or cost < 0 or sales_price < 0
           or min_stock < 0 or initial_stock < 0
    ) as negativos_heredados
  from public.products;

-- 13.7 RLS habilitado
select relname, relrowsecurity
  from pg_class
 where oid = 'public.products'::regclass;

-- 13.8 Trigger de updated_at habilitado (tgenabled = 'O' es el valor normal)
select tgname, tgenabled
  from pg_trigger
 where tgrelid = 'public.products'::regclass
   and not tgisinternal;

-- 13.9 Privilegios por rol (anon no debe aparecer; authenticated sin DELETE)
select grantee, privilege_type
  from information_schema.role_table_grants
 where table_schema = 'public'
   and table_name = 'products'
 order by grantee, privilege_type;
