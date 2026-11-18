-- =====================================================================
-- 0005 · PANEL DE ADMINISTRACIÓN E IMPORTACIÓN
--
--   · admin_users()        → lista de usuarios con su email (solo admin).
--   · set_order_status()   → cambia el estado de un pedido; si se cancela y
--                            se controla stock, lo devuelve.
--   · import_products()    → alta y actualización masiva de productos.
--
-- set_order_status e import_products son SECURITY INVOKER: corren con los
-- permisos de quien las llama, así que las políticas de RLS siguen valiendo.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Usuarios (los emails están en auth.users, que no se puede leer desde la API)
-- ---------------------------------------------------------------------
create or replace function public.admin_users()
returns table (
  id              uuid,
  email           text,
  full_name       text,
  phone           text,
  role            public.user_role,
  created_at      timestamptz,
  last_sign_in_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede ver los usuarios.';
  end if;

  return query
    select p.id, u.email::text, p.full_name, p.phone, p.role, p.created_at, u.last_sign_in_at
    from public.profiles p
    join auth.users u on u.id = p.id
    order by (p.role = 'customer'), u.email;  -- primero el personal
end;
$$;

-- ---------------------------------------------------------------------
-- Estado de un pedido
-- ---------------------------------------------------------------------
create or replace function public.set_order_status(p_order_id uuid, p_status public.order_status)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_anterior public.order_status;
begin
  if not public.is_staff() then
    raise exception 'No tenés permiso para cambiar pedidos.';
  end if;

  select status into v_anterior from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'No encontramos el pedido.';
  end if;
  if v_anterior = p_status then
    return;
  end if;
  if v_anterior = 'cancelled' then
    raise exception 'Este pedido está cancelado: ya no se puede cambiar de estado.';
  end if;

  update public.orders set status = p_status where id = p_order_id;

  -- Si se cancela, la mercadería vuelve al stock (solo si el comercio controla stock,
  -- que es cuando create_order() la descontó).
  if p_status = 'cancelled' and (select track_stock from public.settings where id = 1) then
    update public.products p
    set stock = p.stock + i.quantity
    from public.order_items i
    where i.order_id = p_order_id and i.product_id = p.id;
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- Importación masiva
-- ---------------------------------------------------------------------

-- Busca una categoría por nombre (sin importar mayúsculas ni acentos) dentro de
-- su categoría madre; si no existe, la crea.
create or replace function public.import_category(p_name text, p_parent uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id   uuid;
  v_slug text;
begin
  select c.id into v_id
  from public.categories c
  where public.f_unaccent(lower(c.name)) = public.f_unaccent(lower(trim(p_name)))
    and c.parent_id is not distinct from p_parent
  limit 1;
  if found then
    return v_id;
  end if;

  v_slug := public.slugify(p_name);
  if v_slug = '' or exists (select 1 from public.categories c where c.slug = v_slug) then
    -- Ej: "Otros" en dos categorías distintas.
    v_slug := nullif(v_slug, '') || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 5);
  end if;

  insert into public.categories (name, slug, parent_id, sort_order)
  values (
    trim(p_name),
    coalesce(v_slug, substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
    p_parent,
    coalesce((select max(c.sort_order) + 1 from public.categories c where c.parent_id is not distinct from p_parent), 1)
  )
  returning id into v_id;
  return v_id;
end;
$$;

-- Recibe un lote de filas ya normalizadas por el panel (números como números,
-- unidades como los valores del enum) y por cada una:
--   · si existe un producto con ese SKU (o, si no hay SKU, con ese código de
--     barras), lo actualiza;
--   · si no existe y p_create es true, lo crea.
-- Solo se tocan las columnas que vienen en la fila: si el archivo no trae
-- "descripcion", la descripción que ya tenía el producto queda igual.
-- Un error en una fila no frena las demás: se informa en "errors".
create or replace function public.import_products(p_rows jsonb, p_create boolean default true)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_fila     jsonb;
  v_numero   integer;
  v_creados  integer := 0;
  v_actualiz integer := 0;
  v_omitidos integer := 0;
  v_errores  jsonb := '[]'::jsonb;
  v_id       uuid;
  v_cat      uuid;
  v_sku      text;
  v_barcode  text;
  v_nombre   text;
begin
  if not public.is_staff() then
    raise exception 'No tenés permiso para importar productos.';
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 1000 then
    raise exception 'El lote de productos no es válido.';
  end if;

  for v_fila in select * from jsonb_array_elements(p_rows)
  loop
    v_numero := (v_fila ->> 'row')::integer;
    begin
      v_sku     := nullif(trim(v_fila ->> 'sku'), '');
      v_barcode := nullif(trim(v_fila ->> 'barcode'), '');
      v_nombre  := nullif(trim(v_fila ->> 'name'), '');
      if v_sku is null and v_barcode is null then
        raise exception 'Falta el código (SKU o código de barras).';
      end if;

      v_id := null;
      if v_sku is not null then
        select p.id into v_id from public.products p where p.sku = v_sku;
      end if;
      if v_id is null and v_barcode is not null then
        select p.id into v_id from public.products p where p.barcode = v_barcode;
      end if;

      v_cat := null;
      if nullif(trim(v_fila ->> 'category'), '') is not null then
        v_cat := public.import_category(v_fila ->> 'category', null);
        if nullif(trim(v_fila ->> 'subcategory'), '') is not null then
          v_cat := public.import_category(v_fila ->> 'subcategory', v_cat);
        end if;
      end if;

      if v_id is not null then
        update public.products p set
          sku              = coalesce(v_sku, p.sku),
          barcode          = coalesce(v_barcode, p.barcode),
          name             = coalesce(v_nombre, p.name),
          brand            = case when v_fila ? 'brand' then nullif(trim(v_fila ->> 'brand'), '') else p.brand end,
          description      = case when v_fila ? 'description' then nullif(trim(v_fila ->> 'description'), '') else p.description end,
          category_id      = coalesce(v_cat, p.category_id),
          price            = case when v_fila ? 'price' then (v_fila ->> 'price')::numeric else p.price end,
          previous_price   = case when v_fila ? 'previous_price' then (v_fila ->> 'previous_price')::numeric else p.previous_price end,
          on_sale          = case when v_fila ? 'on_sale' then (v_fila ->> 'on_sale')::boolean else p.on_sale end,
          stock            = case when v_fila ? 'stock' then (v_fila ->> 'stock')::numeric else p.stock end,
          sale_unit        = case when v_fila ? 'sale_unit' then (v_fila ->> 'sale_unit')::public.sale_unit else p.sale_unit end,
          quantity_step    = case when v_fila ? 'quantity_step' then (v_fila ->> 'quantity_step')::numeric else p.quantity_step end,
          net_content      = case when v_fila ? 'net_content' then (v_fila ->> 'net_content')::numeric else p.net_content end,
          net_content_unit = case when v_fila ? 'net_content_unit' then (v_fila ->> 'net_content_unit')::public.content_unit else p.net_content_unit end,
          active           = case when v_fila ? 'active' then (v_fila ->> 'active')::boolean else p.active end
        where p.id = v_id;
        v_actualiz := v_actualiz + 1;

      elsif p_create then
        if v_nombre is null then
          raise exception 'Falta el nombre (el producto no existe y hay que crearlo).';
        end if;
        insert into public.products (
          sku, barcode, name, brand, description, category_id, price, previous_price,
          on_sale, stock, sale_unit, quantity_step, net_content, net_content_unit, active
        ) values (
          v_sku, v_barcode, v_nombre,
          nullif(trim(v_fila ->> 'brand'), ''),
          nullif(trim(v_fila ->> 'description'), ''),
          v_cat,
          coalesce((v_fila ->> 'price')::numeric, 0),
          (v_fila ->> 'previous_price')::numeric,
          coalesce((v_fila ->> 'on_sale')::boolean, false),
          coalesce((v_fila ->> 'stock')::numeric, 0),
          coalesce((v_fila ->> 'sale_unit')::public.sale_unit, 'unidad'),
          coalesce((v_fila ->> 'quantity_step')::numeric, 1),
          (v_fila ->> 'net_content')::numeric,
          (v_fila ->> 'net_content_unit')::public.content_unit,
          coalesce((v_fila ->> 'active')::boolean, true)
        );
        v_creados := v_creados + 1;

      else
        v_omitidos := v_omitidos + 1;
      end if;

    exception when others then
      v_errores := v_errores || jsonb_build_object(
        'row', v_numero,
        'error', case
          when sqlstate = '23505' then 'Ese código ya lo usa otro producto.'
          when sqlstate = '23514' then 'Hay un valor fuera de rango (por ej. un precio negativo).'
          when sqlstate in ('22P02', '22003') then 'Hay un número o una unidad que no es válida.'
          else sqlerrm
        end
      );
    end;
  end loop;

  return jsonb_build_object(
    'created', v_creados,
    'updated', v_actualiz,
    'skipped', v_omitidos,
    'errors',  v_errores
  );
end;
$$;

-- Permisos: Supabase da EXECUTE a anon por defecto en las funciones nuevas.
revoke execute on function public.admin_users() from public, anon;
revoke execute on function public.set_order_status(uuid, public.order_status) from public, anon;
revoke execute on function public.import_category(text, uuid) from public, anon, authenticated;
revoke execute on function public.import_products(jsonb, boolean) from public, anon;

grant execute on function public.admin_users() to authenticated;
grant execute on function public.set_order_status(uuid, public.order_status) to authenticated;
grant execute on function public.import_products(jsonb, boolean) to authenticated;
