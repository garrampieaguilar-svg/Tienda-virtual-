-- =====================================================================
-- 0004 · STORAGE (archivos)
--
--   · products  → público. Fotos de productos y logo del comercio.
--   · receipts  → privado. Comprobantes de transferencia.
--                 Los sube el servidor de la tienda (con la clave service_role,
--                 después de validar el pedido) y solo el personal puede verlos.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('products', 'products', true, 5 * 1024 * 1024,
   array['image/jpeg', 'image/png', 'image/webp', 'image/avif']),
  ('receipts', 'receipts', false, 10 * 1024 * 1024,
   array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

-- Fotos de productos: al ser un bucket público, cualquiera las ve por su URL.
-- Subir, reemplazar y borrar: solo el personal.
create policy "fotos: el personal lista"
  on storage.objects for select to authenticated
  using (bucket_id = 'products' and (select public.is_staff()));

create policy "fotos: el personal sube"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'products' and (select public.is_staff()));

create policy "fotos: el personal reemplaza"
  on storage.objects for update to authenticated
  using (bucket_id = 'products' and (select public.is_staff()))
  with check (bucket_id = 'products' and (select public.is_staff()));

create policy "fotos: el personal borra"
  on storage.objects for delete to authenticated
  using (bucket_id = 'products' and (select public.is_staff()));

-- Comprobantes: solo el personal puede verlos (con links firmados desde el panel).
create policy "comprobantes: el personal los ve"
  on storage.objects for select to authenticated
  using (bucket_id = 'receipts' and (select public.is_staff()));
