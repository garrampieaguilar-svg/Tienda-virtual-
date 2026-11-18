-- =====================================================================
-- 0007 · AJUSTES DE RENDIMIENTO (avisos del "Performance Advisor")
-- =====================================================================

-- Claves foráneas sin índice: sin estos, borrar un producto, una zona o una
-- franja obliga a recorrer todos los pedidos.
create index if not exists order_items_product_idx on public.order_items (product_id);
create index if not exists orders_delivery_zone_idx on public.orders (delivery_zone_id);
create index if not exists orders_time_slot_idx on public.orders (time_slot_id);

-- Dos políticas de UPDATE sobre profiles se evaluaban las dos en cada cambio.
-- Las unimos en una sola con el mismo efecto: cada uno edita su perfil y el
-- admin edita cualquiera. (El cambio de rol lo sigue frenando el trigger
-- profiles_protect_role.)
drop policy if exists "perfil: editar el propio" on public.profiles;
drop policy if exists "perfil: el admin edita cualquiera" on public.profiles;

create policy "perfil: editar el propio o ser admin"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()))
  with check (id = (select auth.uid()) or (select public.is_admin()));
