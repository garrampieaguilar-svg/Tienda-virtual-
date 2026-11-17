import { formatCantidad, formatPrecio } from "@/lib/format";
import { ETIQUETA_ENTREGA, ETIQUETA_PAGO, formatFecha, soloDigitos } from "@/lib/pedido";
import type { OrderWithItems } from "@/types/database";

/** Más de esto y el link de WhatsApp queda demasiado largo para algunos teléfonos. */
const MAXIMO_RENGLONES = 40;

/**
 * Texto del mensaje que quien compra le manda al comercio por WhatsApp
 * después de hacer el pedido. Va con asteriscos porque WhatsApp los muestra en negrita.
 */
export function mensajePedido(
  pedido: OrderWithItems,
  nombreComercio: string,
  linkPedido: string,
): string {
  const renglones = pedido.items
    .slice(0, MAXIMO_RENGLONES)
    .map(
      (i) =>
        `• ${formatCantidad(Number(i.quantity), i.sale_unit)} × ${i.product_name}` +
        `${i.product_brand ? ` (${i.product_brand})` : ""} — ${formatPrecio(Number(i.line_total))}`,
    );
  const resto = pedido.items.length - MAXIMO_RENGLONES;
  if (resto > 0) renglones.push(`…y ${resto} ${resto === 1 ? "producto más" : "productos más"}`);

  const entrega = [ETIQUETA_ENTREGA[pedido.delivery_mode]];
  if (pedido.delivery_mode === "delivery" && pedido.address) {
    entrega.push(
      [pedido.address, pedido.address_notes, pedido.delivery_zone_name && `zona: ${pedido.delivery_zone_name}`]
        .filter(Boolean)
        .join(", "),
    );
  }

  let pago = ETIQUETA_PAGO[pedido.payment_method];
  if (pedido.payment_method === "transfer") {
    pago += pedido.receipt_path ? " (ya subí el comprobante)" : " (te mando el comprobante por acá)";
  } else if (pedido.cash_amount) {
    pago += ` (pago con ${formatPrecio(Number(pedido.cash_amount))})`;
  }

  const lineas = [
    `Hola, soy ${pedido.customer_name}. Hice el *pedido #${pedido.order_number}* en ${nombreComercio}.`,
    "",
    ...renglones,
    "",
    `Subtotal: ${formatPrecio(Number(pedido.subtotal))}`,
    pedido.delivery_mode === "delivery"
      ? `Envío: ${Number(pedido.shipping_cost) > 0 ? formatPrecio(Number(pedido.shipping_cost)) : "gratis"}`
      : null,
    `*Total: ${formatPrecio(Number(pedido.total))}*`,
    "",
    `Entrega: ${entrega.join(" — ")}`,
    pedido.delivery_date
      ? `Día: ${formatFecha(pedido.delivery_date)}${pedido.time_slot_label ? `, de ${pedido.time_slot_label} h` : ""}`
      : null,
    `Pago: ${pago}`,
    pedido.comments ? `Comentarios: ${pedido.comments}` : null,
    "",
    `Ver el pedido: ${linkPedido}`,
  ];

  return lineas.filter((l) => l !== null).join("\n");
}

/** Link que abre WhatsApp con el mensaje ya escrito. Devuelve null si el comercio no cargó su número. */
export function linkWhatsapp(telefono: string | null, mensaje: string): string | null {
  const numero = soloDigitos(telefono ?? "");
  if (!numero) return null;
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
}
