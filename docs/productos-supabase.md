# Productos · Supabase: estado real, migración y bloqueador de autenticación

Este documento describe el estado verificado de `public.products`, la migración
segura del módulo de Productos (`docs/productos-supabase.sql`) y el bloqueador
que impide hoy operar productos desde el frontend.

Alcance exclusivo: módulo de Productos. No cubre ni modifica autenticación,
registro, login, pagos, planes, dashboards, inventario, movimientos, entradas,
salidas ni reportes.

## 1. Estado verificado de `public.products`

Verificado por sondeo de solo lectura a PostgREST con la publishable key. La
tabla existe y actualmente contiene únicamente estas columnas:

| Columna existente | Tipo inferido | Notas |
|---|---|---|
| `id` | `uuid` | Clave primaria |
| `name` | texto | Obligatorio para el módulo |
| `description` | texto | Opcional |
| `quantity` | `numeric` | Stock actual |
| `category` | texto | Opcional |
| `cost` | `numeric` | Precio de costo |
| `sales_price` | `numeric` | Precio de venta |
| `min_stock` | `numeric` | Stock mínimo |
| `initial_stock` | `numeric` | Stock inicial registrado al crear |
| `sku` | texto | Identificador de catálogo |

No existen `unit`, `is_active`, `created_at`, `updated_at` ni ninguna columna de
propiedad/tenant. La migración agrega únicamente `unit`, `is_active`, `created_at`
y `updated_at`; no crea columnas de propiedad.

Hechos adicionales verificados:

- `products` es la única tabla expuesta del proyecto.
- No existen tablas de usuarios, perfiles, negocios, organizaciones ni tenants.
- El login y el registro actuales usan `sessionStorage`; **no** existe sesión de
  Supabase Auth ni JWT.
- El rol `anon` recibe `42501 permission denied for table products`: no tiene
  privilegios sobre la tabla.

## 2. Bloqueador conocido: sin autenticación real no hay operación segura

El módulo de Productos **permanece bloqueado por RLS hasta que exista Supabase
Auth real o un modelo de tenant autenticado**. Esto es intencional:

- Sin `auth.uid()` no es posible determinar propiedad de forma segura.
- La publishable key es pública; otorgar permisos a `anon` expondría el catálogo
  completo a cualquier cliente que la posea.
- Por eso la migración no crea políticas permisivas (`USING (true)`), no otorga
  permisos a `anon` y no debilita RLS.

Consecuencia operativa actual: `js/productos.js` mostrará el mensaje de permisos
(código `42501`) y el listado no cargará. Ese comportamiento es el esperado y no
debe "arreglarse" abriendo la tabla.

Opciones para desbloquear (fuera del alcance de este documento):

1. Implementar Supabase Auth real y reemplazar el login simulado.
2. Definir un modelo de tenant autenticado y políticas basadas en él.

Las políticas permisivas para `anon` (`USING (true)` / `WITH CHECK (true)`) no
deben habilitarse: no son una estrategia de pruebas aceptada y expondrían el
catálogo completo a cualquiera que tenga la publishable key.

## 3. Modelo final de la tabla

Tras ejecutar `docs/productos-supabase.sql`, `public.products` queda así:

| Columna | Tipo | Reglas usadas por el frontend |
|---|---|---|
| `id` | `uuid` | `default gen_random_uuid()` |
| `name` | texto | Obligatorio, máx. 120 caracteres |
| `sku` | texto | Obligatorio, máx. 40, normalizado a MAYÚSCULAS |
| `description` | texto | Opcional, máx. 500 |
| `category` | texto | Opcional, máx. 80 |
| `unit` | texto | Opcional, máx. 20 |
| `sales_price` | `numeric` | No negativo, `default 0` |
| `cost` | `numeric` | No negativo, `default 0` |
| `min_stock` | `numeric` | No negativo, `default 0` |
| `quantity` | `numeric` | No negativo, `default 0`; solo lectura tras crear |
| `initial_stock` | `numeric` | No negativo, `default 0`; se fija al crear |
| `is_active` | `boolean` | Activación/desactivación lógica; no hay DELETE |
| `created_at` | `timestamptz` | `default now()` |
| `updated_at` | `timestamptz` | Automático por trigger |

`initial_stock` se completa en la creación con el valor del stock inicial
ingresado (`js/productos.js`). En edición, `quantity` e `initial_stock` no se
modifican: las existencias se gestionan desde Inventario y Movimientos.

### 3.1 Columnas de propiedad

No se agrega ninguna columna de propiedad porque no existe autenticación ni
tenant real. La propiedad segura de productos queda bloqueada hasta que se
diseñen Supabase Auth real y un modelo de tenant; la sesión simulada de
`sessionStorage` no es una frontera de seguridad y no se persiste en la tabla.
Si en el futuro se implementa, la migración debe incluir la columna y:

- Añadir políticas RLS basadas en `auth.uid()`.
- Cambiar el índice único de SKU para que la unicidad quede acotada al tenant,
  por ejemplo `(owner_id, upper(btrim(sku)))`.

El script incluye estos pasos como ejemplos comentados (sección 12 del SQL).

## 4. Cómo ejecutar la migración

1. Abrir Supabase Dashboard → SQL Editor.
2. Pegar el contenido completo de `docs/productos-supabase.sql` y ejecutar.
3. El script es idempotente: puede repetirse sin perder datos.
4. Al final incluye consultas de verificación (columnas, restricciones, índices,
   políticas, RLS, trigger, privilegios, placeholders y conteo de filas
   afectadas).
5. Si el script se cancela por SKU duplicados normales, corregir los registros
   indicados y volver a ejecutarlo. Nada se aplica parcialmente: la migración
   corre dentro de una transacción.

La migración es **aditiva**: no elimina, renombra ni recrea columnas y no
sobrescribe valores válidos.

## 5. Unicidad de SKU (aplicada por la base de datos)

El frontend normaliza con `trim` + mayúsculas, pero la protección final contra
duplicados y condiciones de carrera es la base de datos:

```sql
create unique index products_sku_normalized_key
    on public.products (upper(btrim(sku)));
```

Reglas:

- Unicidad insensible a mayúsculas y espacios (`upper(btrim(sku))`).
- Antes de crear el índice normalizado, la migración inspecciona todas las
  restricciones e índices únicos que cubren exactamente `(sku)` y elimina solo
  esos objetos redundantes. Verifica dependencias (por ejemplo claves foráneas)
  y cancela la migración si alguna impide la eliminación; no usa `CASCADE`.
- Si existen duplicados normalizados, la migración se cancela y los reporta con
  nombre y número de registros. No se borran, fusionan ni renombran datos.
- El frontend sigue manejando el error `23505` con el mensaje
  «Ya existe un producto con ese SKU.»
- Con un futuro modelo de tenant, el índice debe cambiar a
  `(owner_id, upper(btrim(sku)))`.

## 6. Backfills, placeholders y datos heredados

Todos los backfills rellenan únicamente valores ausentes o vacíos.

| Caso | Acción | Documentación |
|---|---|---|
| Numéricos `NULL` | Se rellenan con `0` | `RAISE NOTICE` si hubo filas |
| `name` `NULL`/blanco | `'Producto sin nombre ' || left(id::text, 8)` | `RAISE NOTICE` con el conteo |
| `sku` `NULL`/blanco | `'SKU-' || upper(replace(id::text, '-', ''))` (UUID completo) | `RAISE NOTICE` con el conteo |
| Valores negativos | **No se corrigen**, solo se reportan | `RAISE WARNING` con el conteo |

Sobre los placeholders:

- `Producto sin nombre <id>` es un marcador temporal identificable, **no** un
  nombre de negocio válido. Debe corregirse manualmente.
- Las consultas 13.5 y 13.6 del script listan y cuentan estos registros para su
  corrección posterior.

Restricciones `NOT VALID`:

- `products_quantity_nonnegative`, `products_cost_nonnegative`,
  `products_sales_price_nonnegative`, `products_min_stock_nonnegative`,
  `products_initial_stock_nonnegative` (los negativos heredados no bloquean la
  migración, pero toda escritura nueva queda validada).
- `products_name_not_blank`, `products_sku_not_blank`.
- Cuando los datos heredados estén corregidos, validarlas manualmente:
  `alter table public.products validate constraint <nombre>;`

## 7. Permisos y RLS (línea base segura)

| Rol | Permisos sobre `products` |
|---|---|
| `authenticated` | `SELECT`, `INSERT`, `UPDATE` (sin `DELETE`) |
| `anon` | Ninguno |
| `service_role` | No se toca; lo administra Supabase |

- RLS habilitado en `public.products`.
- Se revocan primero todos los privilegios y luego se conceden solo
  `SELECT`/`INSERT`/`UPDATE`, para neutralizar permisos heredados por defecto de
  Supabase (que pueden incluir `DELETE`).
- Sin políticas en la línea base: RLS deniega todo aunque existan los GRANT. Las
  políticas seguras se agregan cuando exista autenticación real.
- Nunca usar la `service_role` key en el frontend.

### 7.1 Políticas permisivas: no habilitar

No se incluyen políticas permisivas para `anon` (`USING (true)` / `WITH CHECK (true)`)
en la migración ejecutable ni como opción de prueba. Habilitarlas expondría el
catálogo completo a cualquiera que tenga la publishable key y no es una
estrategia de pruebas aceptada. La única vía válida es implementar Supabase Auth
real y políticas basadas en identidad autenticada o tenant.

## 8. Errores que la interfaz traduce

| Código | Significado | Mensaje mostrado |
|---|---|---|
| `23505` | SKU duplicado (índice normalizado) | «Ya existe un producto con ese SKU.» |
| `42501` | Permiso denegado por RLS/GRANT | Bloqueo por RLS hasta que exista autenticación real (este documento) |
| `42703` / `PGRST204` | Columna inexistente | «El modelo de datos del catálogo no coincide con la base de datos» |
| Red / offline | Fallo de conexión | «Sin conexión…» o «No pudimos comunicarnos con el servidor» |
| Otros | Error inesperado | Mensaje genérico sin detalles internos |

## 9. Fuera de alcance

No se modifican autenticación, registro, login, pagos, planes, dashboards,
inventario, movimientos, entradas, salidas, reportes ni estadísticas. La
integración de Supabase Auth queda pendiente como requisito externo para que el
módulo de Productos sea funcional y seguro.
