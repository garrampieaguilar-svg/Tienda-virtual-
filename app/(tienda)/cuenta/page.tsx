import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FormularioPerfil } from "@/components/tienda/formulario-perfil";
import { MisPedidos, type PedidoResumen } from "@/components/tienda/mis-pedidos";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { cerrarSesion } from "./acciones";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Mi cuenta", robots: { index: false } };

/** Cuántos pedidos se muestran en el historial. */
const MAXIMO_PEDIDOS = 30;

export default async function PaginaCuenta() {
  const sb = createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect("/ingresar?next=/cuenta");

  // RLS se encarga de que cada persona vea solo su perfil y sus pedidos.
  const [perfil, pedidos] = await Promise.all([
    sb.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    sb
      .from("orders")
      .select("id, order_number, status, total, created_at, delivery_mode")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(MAXIMO_PEDIDOS),
  ]);
  if (pedidos.error) throw new Error(`No se pudieron leer los pedidos: ${pedidos.error.message}`);

  const ids = (pedidos.data ?? []).map((p) => p.id);
  const items = ids.length
    ? await sb
        .from("order_items")
        .select("order_id, product_id, product_name, quantity")
        .in("order_id", ids)
        .order("product_name")
    : { data: [], error: null };
  if (items.error) throw new Error(`No se pudieron leer los pedidos: ${items.error.message}`);

  const lista: PedidoResumen[] = (pedidos.data ?? []).map((p) => ({
    ...p,
    total: Number(p.total),
    items: (items.data ?? [])
      .filter((i) => i.order_id === p.id)
      .map((i) => ({
        product_id: i.product_id,
        product_name: i.product_name,
        quantity: Number(i.quantity),
      })),
  }));

  return (
    <div className="mx-auto max-w-2xl space-y-10">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Mi cuenta</h1>
        <p className="break-all text-neutral-600">{user.email}</p>
      </header>

      <section aria-labelledby="titulo-pedidos" className="space-y-4">
        <h2 id="titulo-pedidos" className="text-lg font-semibold tracking-tight">
          Mis pedidos
        </h2>
        <MisPedidos pedidos={lista} />
      </section>

      <section aria-labelledby="titulo-datos" className="space-y-4">
        <div className="space-y-1">
          <h2 id="titulo-datos" className="text-lg font-semibold tracking-tight">
            Mis datos
          </h2>
          <p className="text-sm text-neutral-600">
            Los usamos para completar el formulario cuando hacés un pedido.
          </p>
        </div>
        <FormularioPerfil
          inicial={{
            nombre: perfil.data?.full_name ?? "",
            telefono: perfil.data?.phone ?? "",
            direccion: perfil.data?.address ?? "",
            referencias: perfil.data?.address_notes ?? "",
          }}
        />
      </section>

      <form action={cerrarSesion} className="border-t border-neutral-200 pt-6">
        <Button type="submit" variante="secundario">
          Cerrar sesión
        </Button>
      </form>
    </div>
  );
}
