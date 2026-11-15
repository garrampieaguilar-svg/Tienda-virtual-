-- =====================================================================
-- 0002 · FUNCIONES
-- Roles, alta automática de perfiles, buscador y creación de pedidos.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Roles
-- SECURITY DEFINER: leen profiles salteando RLS (si no, las políticas que
-- las usan entrarían en un bucle). Solo devuelven true/false.
-- ---------------------------------------------------------------------
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role in ('employee', 'admin')
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------
-- Perfil automático: cada usuario nuevo de Supabase Auth recibe su fila
-- en profiles con rol 'customer'.
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Nadie puede cambiarse el rol a sí mismo: solo un administrador
-- (o el SQL Editor / service_role, donde auth.uid() es NULL; así se crea
-- el primer administrador).
-- ---------------------------------------------------------------------
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.role is distinct from old.role
     and (select auth.uid()) is not null
     and not public.is_admin() then
    raise exception 'No tenés permiso para cambiar roles.';
  end if;
  return new;
end;
$$;

create trigger profiles_protect_role
  before update on public.profiles
  for each row execute function public.protect_profile_role();

-- ---------------------------------------------------------------------
-- Buscador de productos
-- Tolera mayúsculas, acentos y errores simples de tipeo ("galetitas" encuentra
-- "Galletitas"). Usa el índice de trigramas, así que es rápido con miles de productos.
--
-- Cómo decide:
--   1. Si hay productos que CONTIENEN lo buscado, devuelve solo esos
--      (primero los que empiezan con ese texto).
--   2. Si no hay ninguno, devuelve los PARECIDOS (errores de tipeo), del más
--      parecido al menos. Así un error no deja la búsqueda vacía, y una
--      búsqueda bien escrita no se llena de resultados que no tienen nada que ver.
--
-- Por qué es SECURITY DEFINER: con RLS activo, Postgres no puede usar el índice
-- para el operador de similitud (no es "leakproof") y recorre toda la tabla.
-- La función saltea RLS pero devuelve SIEMPRE y SOLO productos activos, que es
-- exactamente lo que la política pública permite ver. (El panel de administración
-- no usa esta función para buscar productos inactivos.)
--
-- Sobre las opciones (SET) de la función:
--   · word_similarity_threshold: qué tan parecida tiene que ser una palabra (0 a 1).
--     Más bajo = más tolerante, pero aparecen resultados menos relacionados.
--   · enable_seqscan off: Postgres subestima lo que cuesta comparar texto fila por
--     fila y a veces prefiere recorrer toda la tabla; con esto usa el índice.
--   · jit off: para consultas tan cortas, compilar tarda más que ejecutar.
-- ---------------------------------------------------------------------
create or replace function public.search_products(
  p_query  text,
  p_limit  integer default 20,
  p_offset integer default 0
)
returns setof public.products
language plpgsql
stable
security definer
set search_path = ''
set pg_trgm.word_similarity_threshold = 0.45
set enable_seqscan = off
set jit = off
as $$
declare
  v_texto  text := public.f_unaccent(lower(trim(coalesce(p_query, ''))));
  -- Escapamos % y _ para que no actúen como comodines en el ILIKE.
  v_patron text := replace(replace(replace(v_texto, '\', '\\'), '%', '\%'), '_', '\_');
  v_limit  integer := least(greatest(coalesce(p_limit, 20), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  if length(v_texto) = 0 or length(v_texto) > 100 then
    return;
  end if;

  -- Nota: el filtro "active" se aplica DESPUÉS de buscar por texto (consulta interna
  -- materializada), para que la búsqueda entre siempre por el índice de trigramas.
  if exists (
    with candidatos as materialized (
      select p.active from public.products p
      where p.search_text ilike '%' || v_patron || '%'
    )
    select 1 from candidatos c where c.active
  ) then
    -- 1. Coincidencias exactas.
    return query
      with candidatos as materialized (
        select p.* from public.products p
        where p.search_text ilike '%' || v_patron || '%'
      )
      select c.*
      from candidatos c
      where c.active
      order by (c.search_text ilike v_patron || '%') desc,  -- primero los que empiezan con lo buscado
               c.name
      limit v_limit offset v_offset;
  else
    -- 2. Parecidos (errores de tipeo), del más parecido al menos.
    return query
      with candidatos as materialized (
        select p.* from public.products p
        where v_texto operator(extensions.<%) p.search_text
      )
      select c.*
      from candidatos c
      where c.active
      order by extensions.word_similarity(v_texto, c.search_text) desc, c.name
      limit v_limit offset v_offset;
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- create_order: la ÚNICA forma de crear un pedido.
--
-- El navegador manda solo qué productos y qué cantidad; los precios, el envío,
-- el mínimo de compra y el total se calculan acá, en el servidor. Así nadie
-- puede alterar precios desde el navegador.
--
-- p_order: { customer_name, customer_phone, customer_email, delivery_mode,
--            address, address_notes, delivery_zone_id, delivery_date,
--            time_slot_id, payment_method, cash_amount, comments }
-- p_items: [ { product_id, quantity }, ... ]
--
-- Devuelve { id, order_number }. Los errores salen con mensajes en español
-- pensados para mostrárselos directamente a quien compra.
-- ---------------------------------------------------------------------
create or replace function public.create_order(p_order jsonb, p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_settings      public.settings%rowtype;
  v_today         date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;

  v_name          text := nullif(trim(p_order ->> 'customer_name'), '');
  v_phone         text := nullif(trim(p_order ->> 'customer_phone'), '');
  v_email         text := nullif(trim(p_order ->> 'customer_email'), '');
  v_address       text := nullif(trim(p_order ->> 'address'), '');
  v_address_notes text := nullif(trim(p_order ->> 'address_notes'), '');
  v_comments      text := nullif(trim(p_order ->> 'comments'), '');
  v_mode          public.delivery_mode;
  v_payment       public.payment_method;
  v_zone_id       uuid;
  v_slot_id       uuid;
  v_date          date;
  v_cash          numeric(12,2);

  v_zone          public.delivery_zones%rowtype;
  v_slot          public.time_slots%rowtype;
  v_slot_label    text;
  v_needs_slot    boolean;

  v_ids           uuid[];
  v_qtys          numeric(10,3)[];
  v_item          record;
  v_subtotal      numeric(12,2) := 0;
  v_shipping      numeric(12,2) := 0;
  v_total         numeric(12,2);
  v_order_id      uuid := gen_random_uuid();
  v_order_number  bigint;
begin
  select * into v_settings from public.settings where id = 1;

  -- ---------- 1. Leer y validar los datos del formulario ----------
  begin
    v_mode    := (p_order ->> 'delivery_mode')::public.delivery_mode;
    v_payment := (p_order ->> 'payment_method')::public.payment_method;
    v_zone_id := nullif(p_order ->> 'delivery_zone_id', '')::uuid;
    v_slot_id := nullif(p_order ->> 'time_slot_id', '')::uuid;
    v_date    := nullif(p_order ->> 'delivery_date', '')::date;
    v_cash    := nullif(p_order ->> 'cash_amount', '')::numeric;
  exception when others then
    raise exception 'Hay datos del pedido que no son válidos. Revisá el formulario.';
  end;

  if v_mode is null or v_payment is null then
    raise exception 'Elegí cómo querés recibir el pedido y cómo vas a pagar.';
  end if;
  if v_name is null or length(v_name) > 120 then
    raise exception 'Decinos tu nombre.';
  end if;
  if v_phone is null or length(regexp_replace(v_phone, '\D', '', 'g')) not between 8 and 15 then
    raise exception 'Revisá el teléfono: lo necesitamos para avisarte por WhatsApp.';
  end if;
  if length(coalesce(v_email, '')) > 200
     or length(coalesce(v_address, '')) > 300
     or length(coalesce(v_address_notes, '')) > 300
     or length(coalesce(v_comments, '')) > 1000 then
    raise exception 'Alguno de los textos es demasiado largo.';
  end if;

  if v_mode = 'pickup' and not v_settings.pickup_enabled then
    raise exception 'Por ahora no estamos tomando pedidos para retirar.';
  end if;
  if v_mode = 'delivery' and not v_settings.delivery_enabled then
    raise exception 'Por ahora no estamos haciendo envíos.';
  end if;

  -- ---------- 2. Productos ----------
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Tu carrito está vacío.';
  end if;
  if jsonb_array_length(p_items) > 300 then
    raise exception 'El pedido tiene demasiados productos distintos.';
  end if;

  -- Carrito ya agrupado (por si un producto viene repetido), en dos listas paralelas.
  begin
    select array_agg(t.product_id), array_agg(t.quantity)
    into v_ids, v_qtys
    from (
      select (i ->> 'product_id')::uuid as product_id,
             sum((i ->> 'quantity')::numeric)::numeric(10,3) as quantity
      from jsonb_array_elements(p_items) as i
      group by 1
    ) t;
  exception when others then
    raise exception 'Hay productos del carrito que no son válidos. Vaciá el carrito y probá de nuevo.';
  end;

  -- Bloqueamos los productos del pedido (en orden, para evitar deadlocks):
  -- si dos personas compran la última unidad a la vez, solo una lo logra.
  perform 1
  from public.products p
  where p.id = any (v_ids)
  order by p.id
  for update;

  for v_item in
    select c.quantity, p.id, p.name, p.active, p.price, p.stock, p.quantity_step
    from unnest(v_ids, v_qtys) as c(product_id, quantity)
    left join public.products p on p.id = c.product_id
  loop
    if v_item.id is null or not v_item.active then
      raise exception '%',
        case when v_item.name is null
          then 'Uno de los productos de tu carrito ya no está disponible. Sacalo para continuar.'
          else format('"%s" ya no está disponible. Sacalo del carrito para continuar.', v_item.name)
        end;
    end if;
    if v_item.quantity is null or v_item.quantity <= 0
       or mod(v_item.quantity, v_item.quantity_step) <> 0 then
      raise exception 'La cantidad de "%" no es válida.', v_item.name;
    end if;
    if v_item.price <= 0 then
      raise exception '"%" todavía no tiene precio cargado. Sacalo del carrito para continuar.', v_item.name;
    end if;
    if v_settings.track_stock and v_item.quantity > v_item.stock then
      raise exception '%',
        case when v_item.stock <= 0
          then format('"%s" se quedó sin stock. Sacalo del carrito para continuar.', v_item.name)
          else format('De "%s" quedan solo %s. Bajá la cantidad para continuar.', v_item.name, trim_scale(v_item.stock))
        end;
    end if;

    v_subtotal := v_subtotal + round(v_item.price * v_item.quantity, 2);
  end loop;

  if v_subtotal < v_settings.min_order_amount then
    raise exception 'La compra mínima es de $%. Te faltan $%.',
      trim_scale(v_settings.min_order_amount),
      trim_scale(v_settings.min_order_amount - v_subtotal);
  end if;

  -- ---------- 3. Entrega y costo de envío ----------
  if v_mode = 'delivery' then
    if v_address is null then
      raise exception 'Decinos a qué dirección te lo llevamos.';
    end if;

    if v_settings.shipping_mode = 'zones' then
      select * into v_zone from public.delivery_zones where id = v_zone_id and active;
      if not found then
        raise exception 'Elegí tu zona de envío.';
      end if;
      v_shipping := v_zone.cost;
    else
      v_shipping := v_settings.shipping_fixed_cost;
    end if;

    -- Envío gratis a partir de cierto monto.
    if v_settings.free_shipping_from is not null and v_subtotal >= v_settings.free_shipping_from then
      v_shipping := 0;
    end if;
  else
    -- Retiro en el local: sin dirección ni zona.
    v_address := null;
    v_address_notes := null;
  end if;

  -- ---------- 4. Franja horaria ----------
  -- Es obligatoria solo si hay franjas cargadas para ese modo de entrega.
  select exists (
    select 1 from public.time_slots s
    where s.active and (s.delivery_mode is null or s.delivery_mode = v_mode)
  ) into v_needs_slot;

  if v_needs_slot then
    if v_slot_id is null or v_date is null then
      raise exception 'Elegí el día y el horario.';
    end if;

    select * into v_slot
    from public.time_slots s
    where s.id = v_slot_id and s.active
      and (s.delivery_mode is null or s.delivery_mode = v_mode);

    if not found
       or v_date < v_today
       or v_date > v_today + 14
       or not (extract(dow from v_date)::smallint = any (v_slot.weekdays)) then
      raise exception 'Ese día u horario no está disponible. Elegí otro.';
    end if;

    v_slot_label := to_char(v_slot.start_time, 'HH24:MI') || ' a ' || to_char(v_slot.end_time, 'HH24:MI');
  else
    v_slot_id := null;
    v_date := null;
  end if;

  -- ---------- 5. Pago ----------
  v_total := v_subtotal + v_shipping;

  if v_payment = 'cash' then
    if v_cash is not null and v_cash < v_total then
      raise exception 'El monto con el que pagás tiene que cubrir el total ($%).', trim_scale(v_total);
    end if;
  else
    v_cash := null;
  end if;

  -- ---------- 6. Guardar ----------
  insert into public.orders (
    id, user_id, customer_name, customer_phone, customer_email,
    delivery_mode, address, address_notes, delivery_zone_id, delivery_zone_name,
    delivery_date, time_slot_id, time_slot_label,
    payment_method, cash_amount, comments,
    subtotal, shipping_cost, total
  ) values (
    v_order_id, (select auth.uid()), v_name, v_phone, v_email,
    v_mode, v_address, v_address_notes,
    case when v_mode = 'delivery' then v_zone.id end,
    case when v_mode = 'delivery' then v_zone.name end,
    v_date, v_slot_id, v_slot_label,
    v_payment, v_cash, v_comments,
    v_subtotal, v_shipping, v_total
  )
  returning order_number into v_order_number;

  insert into public.order_items (
    order_id, product_id, product_name, product_brand, sku, barcode,
    sale_unit, unit_price, quantity, line_total
  )
  select v_order_id, p.id, p.name, p.brand, p.sku, p.barcode,
         p.sale_unit, p.price, c.quantity, round(p.price * c.quantity, 2)
  from unnest(v_ids, v_qtys) as c(product_id, quantity)
  join public.products p on p.id = c.product_id
  order by p.name;

  if v_settings.track_stock then
    update public.products p
    set stock = p.stock - c.quantity
    from unnest(v_ids, v_qtys) as c(product_id, quantity)
    where p.id = c.product_id;
  end if;

  return jsonb_build_object('id', v_order_id, 'order_number', v_order_number);
end;
$$;

-- ---------------------------------------------------------------------
-- get_order: devuelve un pedido con sus productos a partir de su id.
-- Sirve para la pantalla de confirmación de quien compró sin registrarse:
-- el id es un uuid aleatorio imposible de adivinar, y funciona como link secreto.
-- ---------------------------------------------------------------------
create or replace function public.get_order(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select to_jsonb(o) - 'user_id' || jsonb_build_object(
    'items', coalesce((
      select jsonb_agg(to_jsonb(i) - 'order_id' order by i.product_name)
      from public.order_items i
      where i.order_id = o.id
    ), '[]'::jsonb)
  )
  from public.orders o
  where o.id = p_id;
$$;

-- Permisos de ejecución: por defecto Postgres deja ejecutar funciones a todos (PUBLIC).
-- Lo cerramos y abrimos solo lo que corresponde.
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.is_staff() to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.f_unaccent(text) to anon, authenticated;
grant execute on function public.slugify(text) to anon, authenticated;
grant execute on function public.search_products(text, integer, integer) to anon, authenticated;
grant execute on function public.create_order(jsonb, jsonb) to anon, authenticated;
grant execute on function public.get_order(uuid) to anon, authenticated;
