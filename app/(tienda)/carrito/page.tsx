import type { Metadata } from "next";
import { Suspense } from "react";
import { VistaCarrito } from "@/components/tienda/vista-carrito";
import { getSettings } from "@/lib/data/catalogo";

export const revalidate = 60;
export const metadata: Metadata = { title: "Tu carrito", robots: { index: false } };

export default async function PaginaCarrito() {
  const settings = await getSettings();
  // Suspense: VistaCarrito lee la URL (?faltan=) y la página se sirve desde el caché.
  return (
    <Suspense>
      <VistaCarrito
        compraMinima={Number(settings.min_order_amount)}
        envioGratisDesde={
          settings.delivery_enabled && settings.free_shipping_from != null
            ? Number(settings.free_shipping_from)
            : null
        }
        controlarStock={settings.track_stock}
      />
    </Suspense>
  );
}
