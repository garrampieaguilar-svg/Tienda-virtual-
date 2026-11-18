-- =====================================================================
-- 0001 · ESQUEMA
-- Tablas, tipos, índices y triggers básicos de la tienda.
-- Los nombres de tablas y columnas están en inglés (convención de la base);
-- los comentarios y los textos que ve la gente, en español.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Extensiones
-- ---------------------------------------------------------------------
create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;   -- búsqueda tolerante a errores
create extension if not exists unaccent with schema extensions;  -- ignorar acentos
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- Tipos enumerados
-- ---------------------------------------------------------------------
create type public.user_role as enum ('customer', 'employee', 'admin');
create type public.sale_unit as enum ('unidad', 'kilo', 'litro', 'pack');
create type public.content_unit as enum ('g', 'kg', 'ml', 'l', 'un');
create type public.delivery_mode as enum ('pickup', 'delivery');       -- retiro / envío
create type public.payment_method as enum ('transfer', 'cash');        -- transferencia / efectivo
create type public.shipping_mode as enum ('fixed', 'zones');           -- monto fijo / por zona
create type public.order_status as enum (
  'new',               -- nuevo
  'preparing',         -- en preparación
  'ready_for_pickup',  -- listo para retirar
  'out_for_delivery',  -- en camino
  'delivered',         -- entregado
  'cancelled'          -- cancelado
);

-- ---------------------------------------------------------------------
-- Funciones utilitarias
-- ---------------------------------------------------------------------

-- unaccent() no es IMMUTABLE, y hace falta que lo sea para usarla en índices
-- y columnas generadas. Este envoltorio fija el diccionario y la declara inmutable.
create or replace function public.f_unaccent(texto text)
returns text
language sql
immutable
parallel safe
strict
set search_path = ''
as $$
  select extensions.unaccent('extensions.unaccent'::regdictionary, texto);
$$;

-- "Lácteos y Huevos" → "lacteos-y-huevos"
create or replace function public.slugify(texto text)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  select trim(both '-' from regexp_replace(lower(public.f_unaccent(texto)), '[^a-z0-9]+', '-', 'g'));
$$;

-- Mantiene updated_at al día en cada UPDATE.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- profiles: datos extra de cada usuario de Supabase Auth (rol y datos de entrega)
-- ---------------------------------------------------------------------
create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  role          public.user_role not null default 'customer',
  full_name     text,
  phone         text,
  address       text,
  address_notes text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- categories: dos niveles (categoría → subcategoría) con orden configurable
-- ---------------------------------------------------------------------
create table public.categories (
  id         uuid primary key default gen_random_uuid(),
  parent_id  uuid references public.categories (id) on delete restrict,
  name       text not null check (length(trim(name)) > 0),
  slug       text not null unique,
  sort_order integer not null default 0,
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index categories_parent_idx on public.categories (parent_id, sort_order);

-- Completa el slug si viene vacío y asegura que haya solo dos niveles.
create or replace function public.categories_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.slug is null or trim(new.slug) = '' then
    new.slug := public.slugify(new.name);
  end if;

  if new.parent_id is not null then
    if new.parent_id = new.id then
      raise exception 'Una categoría no puede ser subcategoría de sí misma.';
    end if;
    if exists (select 1 from public.categories c where c.id = new.parent_id and c.parent_id is not null) then
      raise exception 'Solo se permiten dos niveles: categoría y subcategoría.';
    end if;
    if exists (select 1 from public.categories c where c.parent_id = new.id) then
      raise exception 'Esta categoría tiene subcategorías: no puede pasar a ser subcategoría.';
    end if;
  end if;

  return new;
end;
$$;

create trigger categories_before_write
  before insert or update on public.categories
  for each row execute function public.categories_before_write();

create trigger categories_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------
create table public.products (
  id               uuid primary key default gen_random_uuid(),
  sku              text unique,                 -- código interno del sistema de facturación
  barcode          text unique,                 -- código de barras (EAN)
  name             text not null check (length(trim(name)) > 0),
  slug             text not null unique,        -- se completa solo (ver trigger)
  brand            text,
  description      text,
  -- Apunta a la categoría más específica: la subcategoría si tiene, si no la categoría.
  category_id      uuid references public.categories (id) on delete set null,
  price            numeric(12,2) not null default 0 check (price >= 0),  -- 0 = precio todavía sin cargar
  previous_price   numeric(12,2) check (previous_price is null or previous_price >= 0),
  on_sale          boolean not null default false,                       -- aparece en "Ofertas"
  sale_unit        public.sale_unit not null default 'unidad',
  -- De a cuánto se suma en el carrito. 1 para la mayoría; 0.25 para algo que se vende por kilo, por ej.
  quantity_step    numeric(6,3) not null default 1 check (quantity_step > 0),
  net_content      numeric(10,3) check (net_content is null or net_content > 0),  -- ej: 500
  net_content_unit public.content_unit,                                           -- ej: 'g'
  image_url        text,                        -- vacío = se muestra la imagen placeholder
  stock            numeric(12,3) not null default 0,
  active           boolean not null default true,
  -- Texto normalizado (minúsculas, sin acentos) para el buscador.
  search_text      text generated always as (
                     public.f_unaccent(lower(name || ' ' || coalesce(brand, '')))
                   ) stored,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Búsqueda rápida y tolerante a errores (trigramas) sobre nombre + marca.
create index products_search_trgm_idx on public.products
  using gin (search_text extensions.gin_trgm_ops);

-- Listado por categoría (solo activos), ordenado por nombre: es la consulta del catálogo.
create index products_category_idx on public.products (category_id, name) where active;

-- Sección de ofertas.
create index products_on_sale_idx on public.products (name) where active and on_sale;

-- Tabla de productos del panel, ordenada por nombre.
create index products_name_idx on public.products (name);

-- Completa el slug: "yerba-mate-suave-500-g-a1b2c3". El sufijo sale del id y evita
-- choques entre productos con el mismo nombre (muy común al importar miles).
create or replace function public.products_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.slug is null or trim(new.slug) = '' then
    new.slug := public.slugify(new.name) || '-' || substr(replace(new.id::text, '-', ''), 1, 6);
  end if;
  -- Códigos vacíos se guardan como NULL para no chocar con la restricción UNIQUE.
  new.sku := nullif(trim(new.sku), '');
  new.barcode := nullif(trim(new.barcode), '');
  return new;
end;
$$;

create trigger products_before_insert
  before insert on public.products
  for each row execute function public.products_before_insert();

create trigger products_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- settings: configuración del comercio. Tiene UNA sola fila (id = 1).
-- ---------------------------------------------------------------------
create table public.settings (
  id                  smallint primary key default 1 check (id = 1),
  store_name          text not null default 'Mi Supermercado',
  store_address       text,
  whatsapp_phone      text,           -- con código de país, solo números. Ej: 5491123456789
  opening_hours       text,           -- texto libre. Ej: "Lun a sáb de 8 a 21 h"
  logo_url            text,
  bank_alias          text,
  bank_cbu            text,
  bank_holder         text,           -- titular de la cuenta
  min_order_amount    numeric(12,2) not null default 0 check (min_order_amount >= 0),
  pickup_enabled      boolean not null default true,
  delivery_enabled    boolean not null default true,
  shipping_mode       public.shipping_mode not null default 'fixed',
  shipping_fixed_cost numeric(12,2) not null default 0 check (shipping_fixed_cost >= 0),
  free_shipping_from  numeric(12,2) check (free_shipping_from is null or free_shipping_from >= 0),
  -- Si está activo, no se puede pedir más que el stock y cada pedido lo descuenta.
  -- Conviene apagarlo si el stock del sistema de facturación no es confiable.
  track_stock         boolean not null default false,
  updated_at          timestamptz not null default now()
);

create trigger settings_updated_at
  before update on public.settings
  for each row execute function public.set_updated_at();

insert into public.settings (id) values (1);

-- ---------------------------------------------------------------------
-- delivery_zones: zonas de envío con su costo (se usan si shipping_mode = 'zones')
-- ---------------------------------------------------------------------
create table public.delivery_zones (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(trim(name)) > 0),
  cost       numeric(12,2) not null default 0 check (cost >= 0),
  sort_order integer not null default 0,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- time_slots: franjas horarias de entrega o retiro
-- ---------------------------------------------------------------------
create table public.time_slots (
  id            uuid primary key default gen_random_uuid(),
  -- NULL = la franja sirve para retiro y para envío.
  delivery_mode public.delivery_mode,
  -- Días en que está disponible: 0 = domingo … 6 = sábado.
  weekdays      smallint[] not null default '{1,2,3,4,5,6}',
  start_time    time not null,
  end_time      time not null,
  sort_order    integer not null default 0,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  check (end_time > start_time),
  check (weekdays <@ array[0,1,2,3,4,5,6]::smallint[])
);

-- ---------------------------------------------------------------------
-- orders y order_items
-- Los pedidos se crean SOLO con la función create_order() (ver 0002),
-- que calcula precios y totales en el servidor.
-- ---------------------------------------------------------------------
create sequence public.order_number_seq start with 1001;

create table public.orders (
  -- El id (uuid aleatorio) funciona como "link secreto" del pedido para quien compra
  -- sin registrarse. El número que ve la gente es order_number.
  id                 uuid primary key default gen_random_uuid(),
  order_number       bigint not null unique default nextval('public.order_number_seq'),
  user_id            uuid references auth.users (id) on delete set null,  -- NULL = compró sin cuenta
  status             public.order_status not null default 'new',

  customer_name      text not null,
  customer_phone     text not null,
  customer_email     text,

  delivery_mode      public.delivery_mode not null,
  address            text,
  address_notes      text,
  delivery_zone_id   uuid references public.delivery_zones (id) on delete set null,
  delivery_zone_name text,          -- copia del nombre, por si después se borra la zona
  delivery_date      date,
  time_slot_id       uuid references public.time_slots (id) on delete set null,
  time_slot_label    text,          -- copia: "10:00 a 13:00"

  payment_method     public.payment_method not null,
  cash_amount        numeric(12,2), -- con cuánto paga (para preparar el vuelto)
  receipt_path       text,          -- comprobante de transferencia (ruta en Storage)
  comments           text,

  subtotal           numeric(12,2) not null,
  shipping_cost      numeric(12,2) not null default 0,
  total              numeric(12,2) not null,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index orders_created_idx on public.orders (created_at desc);
create index orders_status_idx on public.orders (status, created_at desc);
create index orders_user_idx on public.orders (user_id, created_at desc) where user_id is not null;

create trigger orders_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

create table public.order_items (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders (id) on delete cascade,
  product_id    uuid references public.products (id) on delete set null,
  -- Copia de los datos del producto al momento de la compra:
  -- el pedido no cambia aunque después se edite o borre el producto.
  product_name  text not null,
  product_brand text,
  sku           text,
  barcode       text,
  sale_unit     public.sale_unit not null default 'unidad',
  unit_price    numeric(12,2) not null,
  quantity      numeric(10,3) not null check (quantity > 0),
  line_total    numeric(12,2) not null
);

create index order_items_order_idx on public.order_items (order_id);

alter sequence public.order_number_seq owned by public.orders.order_number;
