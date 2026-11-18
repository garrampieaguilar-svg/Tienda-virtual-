-- =====================================================================
-- 0003 · SEGURIDAD (Row Level Security)
--
-- Resumen:
--   · Catálogo (productos, categorías), configuración, zonas y franjas:
--     lectura pública. Escritura solo para el personal.
--   · Pedidos: cada cliente ve solo los suyos; admin y empleado ven todo.
--     Nadie inserta pedidos directo: se crean con create_order().
--   · Configuración, zonas y franjas: las modifica solo el administrador.
--   · Perfiles: cada uno ve y edita el suyo; el personal ve todos.
--
-- "anon" = visitante sin sesión · "authenticated" = usuario con sesión.
-- =====================================================================

alter table public.profiles       enable row level security;
alter table public.categories     enable row level security;
alter table public.products       enable row level security;
alter table public.settings       enable row level security;
alter table public.delivery_zones enable row level security;
alter table public.time_slots     enable row level security;
alter table public.orders         enable row level security;
alter table public.order_items    enable row level security;

-- ---------------------------------------------------------------------
-- Permisos de tabla (RLS decide después QUÉ filas).
-- Se dan explícitos para no depender de los permisos por defecto del proyecto.
-- ---------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;

grant select on public.categories, public.products, public.settings,
                public.delivery_zones, public.time_slots
  to anon, authenticated;

grant select, update on public.profiles to authenticated;
grant insert, update, delete on public.categories, public.products,
                                public.delivery_zones, public.time_slots
  to authenticated;
grant update on public.settings to authenticated;
grant select, update, delete on public.orders to authenticated;
grant select on public.order_items to authenticated;

-- ---------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------
create policy "perfil: ver el propio o ser personal"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_staff()));

create policy "perfil: editar el propio"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));
  -- El cambio de rol lo frena el trigger profiles_protect_role.

create policy "perfil: el admin edita cualquiera"
  on public.profiles for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- ---------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------
create policy "categorias: lectura publica de activas"
  on public.categories for select to anon, authenticated
  using (active or (select public.is_staff()));

create policy "categorias: el personal crea"
  on public.categories for insert to authenticated
  with check ((select public.is_staff()));

create policy "categorias: el personal edita"
  on public.categories for update to authenticated
  using ((select public.is_staff()))
  with check ((select public.is_staff()));

create policy "categorias: el personal borra"
  on public.categories for delete to authenticated
  using ((select public.is_staff()));

-- ---------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------
create policy "productos: lectura publica de activos"
  on public.products for select to anon, authenticated
  using (active or (select public.is_staff()));

create policy "productos: el personal crea"
  on public.products for insert to authenticated
  with check ((select public.is_staff()));

create policy "productos: el personal edita"
  on public.products for update to authenticated
  using ((select public.is_staff()))
  with check ((select public.is_staff()));

create policy "productos: el personal borra"
  on public.products for delete to authenticated
  using ((select public.is_staff()));

-- ---------------------------------------------------------------------
-- settings (una sola fila; nunca se inserta ni se borra)
-- ---------------------------------------------------------------------
create policy "configuracion: lectura publica"
  on public.settings for select to anon, authenticated
  using (true);

create policy "configuracion: solo el admin edita"
  on public.settings for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- ---------------------------------------------------------------------
-- delivery_zones
-- ---------------------------------------------------------------------
create policy "zonas: lectura publica de activas"
  on public.delivery_zones for select to anon, authenticated
  using (active or (select public.is_staff()));

create policy "zonas: solo el admin crea"
  on public.delivery_zones for insert to authenticated
  with check ((select public.is_admin()));

create policy "zonas: solo el admin edita"
  on public.delivery_zones for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "zonas: solo el admin borra"
  on public.delivery_zones for delete to authenticated
  using ((select public.is_admin()));

-- ---------------------------------------------------------------------
-- time_slots
-- ---------------------------------------------------------------------
create policy "franjas: lectura publica de activas"
  on public.time_slots for select to anon, authenticated
  using (active or (select public.is_staff()));

create policy "franjas: solo el admin crea"
  on public.time_slots for insert to authenticated
  with check ((select public.is_admin()));

create policy "franjas: solo el admin edita"
  on public.time_slots for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "franjas: solo el admin borra"
  on public.time_slots for delete to authenticated
  using ((select public.is_admin()));

-- ---------------------------------------------------------------------
-- orders
-- Sin política de INSERT a propósito: los pedidos se crean con create_order().
-- Quien compra sin cuenta consulta su pedido con get_order(id).
-- ---------------------------------------------------------------------
create policy "pedidos: ver los propios o ser personal"
  on public.orders for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_staff()));

create policy "pedidos: el personal edita"
  on public.orders for update to authenticated
  using ((select public.is_staff()))
  with check ((select public.is_staff()));

create policy "pedidos: solo el admin borra"
  on public.orders for delete to authenticated
  using ((select public.is_admin()));

-- ---------------------------------------------------------------------
-- order_items (se ven si se puede ver el pedido al que pertenecen)
-- ---------------------------------------------------------------------
create policy "items: ver los de pedidos propios o ser personal"
  on public.order_items for select to authenticated
  using (
    (select public.is_staff())
    or exists (
      select 1 from public.orders o
      where o.id = order_items.order_id and o.user_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------
-- Tiempo real: el panel escucha los pedidos nuevos para avisar con sonido.
-- (Realtime respeta RLS: solo el personal recibe los eventos.)
-- ---------------------------------------------------------------------
alter publication supabase_realtime add table public.orders;
