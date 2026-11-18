import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AccionesPedido } from "@/components/admin/acciones-pedido";
import { Tarjeta } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { exigirPersonal } from "@/lib/admin";
import { getSettings } from "@/lib/data/catalogo";
import { env } from "@/lib/env";
import { formatCantidad, formatPrecio } from "@/lib/format";
import {
  ETIQUETA_ENTREGA,
  ETIQUETA_ESTADO,
  ETIQUETA_PAGO,
  ZONA_HORARIA,
  esUuid,
  formatFecha,
  siguientesEstados,
  telefonoParaWhatsapp,
} from "@/lib/pedido";
import { mensajeEstado } from "@/lib/whatsapp";

type Props = { params: { id: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: esUuid(params.id) ? "Pedido" : "Pedido no encontrado" };
}

const formatoFechaHora = new Intl.DateTimeFormat("es-AR", {
  timeZone: ZONA_HORARIA,
  dateStyle: "long",
  timeStyle: "short",
});

export default async function DetallePedido({ params }: Props) {
  if (!esUuid(params.id)) notFound();
  const { sb, rol } = await exigirPersonal();
  const [{ data: pedido, error }, { data: items, error: errorItems }, settings] = await Promise.all([
    sb.from("orders").select("*").eq("id", params.id).maybeSingle(),
    sb.from("order_items").select("*").eq("order_id", params.id).order("product_name"),
    getSettings(),
  ]);
  if (error || errorItems) throw new Error("No se pudo leer el pedido.");
  if (!pedido) notFound();

  const telefono = telefonoParaWhatsapp(pedido.customer_phone);
  const mensaje = mensajeEstado(pedido, settings.store_name, settings.store_address, `${env.siteUrl}/pedido/${pedido.id}`);
  const whatsapp = telefono ? `https://wa.me/${telefono}?text=${encodeURIComponent(mensaje)}` : null;
  const total = Number(pedido.total);
  const vuelto = pedido.cash_amount != null ? Number(pedido.cash_amount) - total : null;
  const unidades = (items ?? []).length;

  return (
    <div className="space-y-4">
      <div className="print:hidden">
        <Link href="/admin" className="rounded text-sm text-neutral-600 hover:underline">
          ‹ Pedidos
        </Link>
      </div>

      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight tabular-nums">Pedido #{pedido.order_number}</h1>
        <Badge tono={pedido.status === "cancelled" ? "peligro" : pedido.status === "new" ? "aviso" : "acento"}>
          {ETIQUETA_ESTADO[pedido.status]}
        </Badge>
        <p className="w-full text-sm text-neutral-600">Hecho el {formatoFechaHora.format(new Date(pedido.created_at))}</p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem] lg:items-start">
        <div className="space-y-4">
          <Tarjeta>
            <h2 className="mb-3 font-semibold">
              Productos ({unidades})
            </h2>
            <table className="w-full text-sm">
              <thead className="sr-only">
                <tr>
                  <th>Cantidad</th>
                  <th>Producto</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {(items ?? []).map((i) => (
                  <tr key={i.id} className="align-top">
                    <td className="w-20 py-2 pr-3 font-semibold tabular-nums">
                      {formatCantidad(Number(i.quantity), i.sale_unit)}
                    </td>
                    <td className="py-2 pr-3">
                      {i.product_name}
                      {i.product_brand && <span className="text-neutral-600"> · {i.product_brand}</span>}
                      <span className="block text-xs text-neutral-500">
                        {formatPrecio(Number(i.unit_price))}
                        {i.sale_unit === "kilo" ? " / kg" : i.sale_unit === "litro" ? " / l" : " c/u"}
                        {i.sku && ` · SKU ${i.sku}`}
                        {i.barcode && ` · ${i.barcode}`}
                      </span>
                    </td>
                    <td className="py-2 text-right tabular-nums">{formatPrecio(Number(i.line_total))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <dl className="mt-3 space-y-1 border-t border-neutral-200 pt-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-neutral-600">Subtotal</dt>
                <dd className="tabular-nums">{formatPrecio(Number(pedido.subtotal))}</dd>
              </div>
              {pedido.delivery_mode === "delivery" && (
                <div className="flex justify-between">
                  <dt className="text-neutral-600">Envío</dt>
                  <dd className="tabular-nums">
                    {Number(pedido.shipping_cost) > 0 ? formatPrecio(Number(pedido.shipping_cost)) : "Gratis"}
                  </dd>
                </div>
              )}
              <div className="flex justify-between pt-1 text-base font-semibold">
                <dt>Total</dt>
                <dd className="tabular-nums">{formatPrecio(total)}</dd>
              </div>
            </dl>
          </Tarjeta>

          {pedido.comments && (
            <Tarjeta>
              <h2 className="mb-1 font-semibold">Comentarios</h2>
              <p className="whitespace-pre-line text-sm">{pedido.comments}</p>
            </Tarjeta>
          )}
        </div>

        <div className="space-y-4">
          <AccionesPedido
            id={pedido.id}
            estado={pedido.status}
            siguientes={siguientesEstados(pedido.status, pedido.delivery_mode)}
            whatsapp={whatsapp}
            tieneComprobante={Boolean(pedido.receipt_path)}
            esAdmin={rol === "admin"}
          />

          <Tarjeta>
            <h2 className="mb-2 font-semibold">Cliente</h2>
            <p className="text-sm">{pedido.customer_name}</p>
            <p className="text-sm">
              <a href={`tel:${pedido.customer_phone}`} className="text-accent underline underline-offset-2">
                {pedido.customer_phone}
              </a>
            </p>
            {pedido.customer_email && <p className="break-all text-sm text-neutral-600">{pedido.customer_email}</p>}
            {pedido.user_id && <p className="mt-1 text-xs text-neutral-500">Compró con cuenta</p>}
          </Tarjeta>

          <Tarjeta>
            <h2 className="mb-2 font-semibold">{ETIQUETA_ENTREGA[pedido.delivery_mode]}</h2>
            <dl className="space-y-1 text-sm">
              {pedido.delivery_mode === "delivery" && (
                <>
                  <dd>{pedido.address}</dd>
                  {pedido.address_notes && <dd className="text-neutral-600">{pedido.address_notes}</dd>}
                  {pedido.delivery_zone_name && <dd className="text-neutral-600">Zona: {pedido.delivery_zone_name}</dd>}
                </>
              )}
              {pedido.delivery_date && (
                <dd className="font-medium">
                  {formatFecha(pedido.delivery_date)}
                  {pedido.time_slot_label && `, ${pedido.time_slot_label} h`}
                </dd>
              )}
            </dl>
          </Tarjeta>

          <Tarjeta>
            <h2 className="mb-2 font-semibold">Pago: {ETIQUETA_PAGO[pedido.payment_method].toLowerCase()}</h2>
            {pedido.payment_method === "cash" ? (
              <p className="text-sm">
                {pedido.cash_amount != null
                  ? `Paga con ${formatPrecio(Number(pedido.cash_amount))}${vuelto && vuelto > 0 ? ` · vuelto ${formatPrecio(vuelto)}` : " (justo)"}`
                  : "No indicó con cuánto paga."}
              </p>
            ) : (
              <p className="text-sm">{pedido.receipt_path ? "Subió el comprobante." : "Todavía no subió el comprobante."}</p>
            )}
          </Tarjeta>
        </div>
      </div>
    </div>
  );
}
