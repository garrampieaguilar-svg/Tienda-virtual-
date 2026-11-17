"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { COLUMNAS_TARJETA, type ProductoTarjeta } from "@/lib/data/consultas";
import { formatPrecio } from "@/lib/format";
import { ETIQUETA_ENTREGA, ETIQUETA_ESTADO, ZONA_HORARIA } from "@/lib/pedido";
import { createClient } from "@/lib/supabase/client";
import { useCarrito } from "@/store/carrito";
import type { DeliveryMode, OrderStatus } from "@/types/database";

export type PedidoResumen = {
  id: string;
  order_number: number;
  status: OrderStatus;
  total: number;
  created_at: string;
  delivery_mode: DeliveryMode;
  items: { product_id: string | null; product_name: string; quantity: number }[];
};

const formatoDia = new Intl.DateTimeFormat("es-AR", {
  timeZone: ZONA_HORARIA,
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** Historial de pedidos de la cuenta, con la opción de volver a pedir lo mismo. */
export function MisPedidos({ pedidos }: { pedidos: PedidoResumen[] }) {
  const router = useRouter();
  const agregarVarios = useCarrito((e) => e.agregarVarios);
  const [repitiendo, setRepitiendo] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ id: string; texto: string } | null>(null);

  if (pedidos.length === 0) {
    return (
      <p className="rounded-lg bg-neutral-50 px-4 py-6 text-center text-neutral-600">
        Todavía no hiciste pedidos con esta cuenta.
      </p>
    );
  }

  /** Suma al carrito los productos de un pedido anterior que se sigan vendiendo, con el precio de hoy. */
  async function repetir(pedido: PedidoResumen) {
    setRepitiendo(pedido.id);
    setAviso(null);
    const ids = pedido.items.flatMap((i) => (i.product_id ? [i.product_id] : []));
    const { data, error } = ids.length
      ? await createClient().from("products").select(COLUMNAS_TARJETA).in("id", ids).eq("active", true)
      : { data: [], error: null };
    setRepitiendo(null);

    const disponibles = ((data ?? []) as ProductoTarjeta[]).filter((p) => p.price > 0);
    if (error || disponibles.length === 0) {
      setAviso({
        id: pedido.id,
        texto: error
          ? "No pudimos armar el carrito. Probá de nuevo."
          : "Ninguno de esos productos está disponible ahora.",
      });
      return;
    }

    agregarVarios(
      disponibles.map((producto) => ({
        producto,
        cantidad: pedido.items.find((i) => i.product_id === producto.id)?.quantity ?? 0,
      })),
    );
    const faltan = pedido.items.length - disponibles.length;
    router.push(faltan > 0 ? `/carrito?faltan=${faltan}` : "/carrito");
  }

  return (
    <ul className="divide-y divide-neutral-200 border-y border-neutral-200">
      {pedidos.map((pedido) => {
        const nombres = pedido.items.map((i) => i.product_name);
        const resumen =
          nombres.slice(0, 3).join(", ") + (nombres.length > 3 ? ` y ${nombres.length - 3} más` : "");
        return (
          <li key={pedido.id} className="space-y-3 py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 space-y-1">
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <Link
                    href={`/pedido/${pedido.id}`}
                    className="rounded font-semibold tabular-nums hover:underline"
                  >
                    Pedido #{pedido.order_number}
                  </Link>
                  <Badge tono={pedido.status === "cancelled" ? "peligro" : "acento"}>
                    {ETIQUETA_ESTADO[pedido.status]}
                  </Badge>
                </p>
                <p className="text-sm text-neutral-600">
                  {formatoDia.format(new Date(pedido.created_at))} ·{" "}
                  {ETIQUETA_ENTREGA[pedido.delivery_mode]}
                </p>
                <p className="line-clamp-2 text-sm text-neutral-700">{resumen}</p>
              </div>
              <p className="shrink-0 font-semibold tabular-nums">{formatPrecio(pedido.total)}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href={`/pedido/${pedido.id}`}
                className="inline-flex h-10 items-center rounded-lg border border-neutral-300 px-4 text-sm font-medium hover:bg-neutral-50"
              >
                Ver detalle
              </Link>
              <Button
                type="button"
                variante="fantasma"
                onClick={() => repetir(pedido)}
                cargando={repitiendo === pedido.id}
                className="text-accent"
              >
                Repetir pedido
              </Button>
            </div>
            {aviso?.id === pedido.id && (
              <p role="alert" className="text-sm text-red-700">
                {aviso.texto}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
