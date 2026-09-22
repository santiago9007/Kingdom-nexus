-- ============================================================================
-- Kingdom Nexus · Módulo de Productos
-- ACCESO TEMPORAL DE DESARROLLO — INSEGURO — NO USAR EN PRODUCCIÓN
-- Archivo: docs/productos-supabase-dev-insecure.sql
--
-- QUÉ ES
--   Habilita al rol anon (la publishable key) para SELECT/INSERT/UPDATE sobre
--   public.products mediante políticas RLS permisivas (USING (true)).
--
-- POR QUÉ EXISTE
--   El login actual usa sessionStorage y NO crea sesión de Supabase Auth.
--   Sin este bloque, RLS deniega todo y el módulo no puede guardar productos.
--
-- ADVERTENCIA
--   La publishable key es pública. Mientras este bloque esté activo, cualquier
--   cliente que la tenga podrá leer, crear y modificar TODOS los productos.
--   Úsalo solo en desarrollo, nunca con datos reales ni en producción.
--
-- REQUISITO PREVIO
--   Haber ejecutado docs/productos-supabase.sql (esquema + línea base segura).
--
-- REVERSIÓN
--   Ejecutar el bloque de limpieza al final de este archivo.
-- ============================================================================

begin;

grant select, insert, update on public.products to anon;

drop policy if exists products_dev_select on public.products;
drop policy if exists products_dev_insert on public.products;
drop policy if exists products_dev_update on public.products;

create policy products_dev_select on public.products
    for select to anon using (true);

create policy products_dev_insert on public.products
    for insert to anon with check (true);

create policy products_dev_update on public.products
    for update to anon using (true) with check (true);

commit;

-- ============================================================================
-- LIMPIEZA — ejecutar para revertir el acceso temporal
-- ============================================================================
-- begin;
--
-- drop policy if exists products_dev_select on public.products;
-- drop policy if exists products_dev_insert on public.products;
-- drop policy if exists products_dev_update on public.products;
--
-- revoke select, insert, update on public.products from anon;
--
-- commit;
