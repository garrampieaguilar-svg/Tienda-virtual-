-- =====================================================================
-- 0006 · IMPORTACIÓN: no crear categorías para filas salteadas
--
-- Con "crear productos nuevos" apagado, import_products() salteaba las filas
-- de productos inexistentes, pero recién DESPUÉS de buscar (y crear) su
-- categoría. Ahora las saltea antes de tocar nada.
-- =====================================================================

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

      -- Si no existe y no hay que crear, se saltea ANTES de tocar nada (ni categorías).
      if v_id is null and not p_create then
        v_omitidos := v_omitidos + 1;
        continue;
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

      else
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

-- import_products() es SECURITY INVOKER: llama a import_category() con los
-- permisos de quien importa, así que esa persona tiene que poder ejecutarla.
-- import_category() también es INVOKER: RLS sigue frenando a quien no es del
-- personal (solo el personal puede crear categorías).
grant execute on function public.import_category(text, uuid) to authenticated;
