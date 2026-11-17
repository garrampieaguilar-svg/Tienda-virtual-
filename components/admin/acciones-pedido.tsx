"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { borrarPedido, cambiarEstado, verComprobante } from "@/app/admin/(panel)/pedidos/acciones";
import { Tarjeta } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { IconoWhatsapp } from "@/components/ui/iconos";
import { ETIQUETA_ESTADO } from "@/lib/pedido";
import type { OrderStatus } from "@/types/database";

/** Botones del detalle del pedido: avanzar de estado, avisar por WhatsApp, comprobante, imprimir. */
export function AccionesPedido({
  id,
  estado,
  siguientes,
  whatsapp,
  tieneComprobante,
  esAdmin,
}: {
  id: string;
  estado: OrderStatus;
  siguientes: OrderStatus[];
  /** Link de WhatsApp con el mensaje del estado actual, o null si el teléfono no sirve. */
  whatsapp: string | null;
  tieneComprobante: boolean;
  esAdmin: boolean;
}) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [recienCambiado, setRecienCambiado] = useState(false);

  async function pasarA(nuevo: OrderStatus) {
    if (nuevo === "cancelled" && !window.confirm("¿Cancelar el pedido? No se puede deshacer.")) return;
    setOcupado(nuevo);
    setError("");
    const r = await cambiarEstado(id, nuevo);
    setOcupado(null);
    if (!r.ok) return setError(r.error);
    setRecienCambiado(true);
    router.refresh();
  }

  async function abrirComprobante() {
    // La ventana se abre antes de esperar al servidor: si no, el navegador la bloquea.
    const ventana = window.open("", "_blank");
    setOcupado("comprobante");
    const r = await verComprobante(id);
    setOcupado(null);
    if (!r.ok) {
      ventana?.close();
      return setError(r.error);
    }
    if (ventana) ventana.location.href = r.data;
    else window.location.href = r.data;
  }

  async function borrar() {
    if (!window.confirm("¿Borrar el pedido para siempre? Para el día a día conviene cancelarlo.")) return;
    setOcupado("borrar");
    const r = await borrarPedido(id);
    if (!r.ok) {
      setOcupado(null);
      return setError(r.error);
    }
    router.replace("/admin");
    router.refresh();
  }

  const [principal, ...resto] = siguientes;

  return (
    <Tarjeta className="space-y-3 print:hidden">
      <h2 className="font-semibold">Acciones</h2>

      {principal && (
        <Button type="button" tamano="lg" className="w-full" onClick={() => pasarA(principal)} cargando={ocupado === principal}>
          Pasar a “{ETIQUETA_ESTADO[principal]}”
        </Button>
      )}
      {resto.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {resto.map((e) => (
            <Button key={e} type="button" variante="secundario" tamano="sm" onClick={() => pasarA(e)} cargando={ocupado === e}>
              {ETIQUETA_ESTADO[e]}
            </Button>
          ))}
        </div>
      )}

      {whatsapp && (
        <a
          href={whatsapp}
          target="_blank"
          rel="noopener noreferrer"
          className={
            recienCambiado
              ? "flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-accent-fg hover:bg-accent-hover"
              : "flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 text-sm font-medium hover:bg-neutral-50"
          }
        >
          <IconoWhatsapp width={18} height={18} />
          Avisar “{ETIQUETA_ESTADO[estado]}” por WhatsApp
        </a>
      )}

      <div className="flex flex-wrap gap-2">
        {tieneComprobante && (
          <Button type="button" variante="secundario" tamano="sm" onClick={abrirComprobante} cargando={ocupado === "comprobante"}>
            Ver comprobante
          </Button>
        )}
        <Button type="button" variante="secundario" tamano="sm" onClick={() => window.print()}>
          Imprimir
        </Button>
        {siguientes.length > 0 && estado !== "cancelled" && (
          <Button type="button" variante="fantasma" tamano="sm" className="text-red-700" onClick={() => pasarA("cancelled")} cargando={ocupado === "cancelled"}>
            Cancelar pedido
          </Button>
        )}
        {esAdmin && (estado === "cancelled" || estado === "delivered") && (
          <Button type="button" variante="fantasma" tamano="sm" className="text-red-700" onClick={borrar} cargando={ocupado === "borrar"}>
            Borrar
          </Button>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </Tarjeta>
  );
}
