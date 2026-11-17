import type { Metadata } from "next";
import { FormularioCheckout } from "@/components/tienda/formulario-checkout";
import { getSettings } from "@/lib/data/catalogo";
import { ahoraEnArgentina } from "@/lib/pedido";
import { createPublicClient } from "@/lib/supabase/publico";

// Sin caché: los días y horarios disponibles dependen de la hora actual.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Finalizar compra", robots: { index: false } };

export default async function PaginaCheckout() {
  const sb = createPublicClient();
  const [settings, zonas, franjas] = await Promise.all([
    getSettings(),
    sb.from("delivery_zones").select("*").eq("active", true).order("sort_order").order("name"),
    sb.from("time_slots").select("*").eq("active", true).order("sort_order").order("start_time"),
  ]);
  if (zonas.error) throw new Error(`No se pudieron leer las zonas: ${zonas.error.message}`);
  if (franjas.error) throw new Error(`No se pudieron leer los horarios: ${franjas.error.message}`);

  return (
    <FormularioCheckout
      settings={settings}
      zonas={zonas.data ?? []}
      franjas={franjas.data ?? []}
      ahora={ahoraEnArgentina()}
    />
  );
}
