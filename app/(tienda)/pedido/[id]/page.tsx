import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { DatoCopiable } from "@/components/tienda/dato-copiable";
import { SubirComprobante } from "@/components/tienda/subir-comprobante";
import { Badge } from "@/components/ui/badge";
import { IconoCheck, IconoWhatsapp } from "@/components/ui/iconos";
import { getSettings } from "@/lib/data/catalogo";
import { env } from "@/lib/env";
import { formatCantidad, formatPrecio } from "@/lib/format";
import {
  ETIQUETA_ENTREGA,
  ETIQUETA_ESTADO,
  ETIQUETA_PAGO,
  esUuid,
  formatFecha,
} from "@/lib/pedido";
import { createPublicClient } from "@/lib/supabase/publico";
import { linkWhatsapp, mensajePedido } from "@/lib/whatsapp";
import type { OrderWithItems } from "@/types/database";

/**
 * Pantalla del pedido (confirmación).
 *
 * No hace falta tener cuenta: el id de la URL es un código aleatorio imposible
 * de adivinar, y funciona como link secreto del pedido. Por eso la página
 * no se guarda en caché ni se deja indexar por buscadores.
 */
export const dynamic = "force-dynamic";

type Props = { params: { id: string }; searchParams: { comprobante?: string } };

const getPedido = cache(async function getPedido(id: string): Promise<OrderWithItems | null> {
  if (!esUuid(id)) return null;
  const { data, error } = await createPublicClient().rpc("get_order", { p_id: id });
  if (error) throw new Error(`No se pudo leer el pedido: ${error.message}`);
  return data;
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const pedido = await getPedido(params.id);
  // Si no existe, se muestra "No encontramos esta página" con el código 404.
  if (!pedido) notFound();
  return {
    title: `Pedido #${pedido.order_number}`,
    robots: { index: false, follow: false },
  };
}

export default async function PaginaPedido({ params, searchParams }: Props) {
  const [pedido, settings] = await Promise.all([getPedido(params.id), getSettings()]);
  if (!pedido) notFound();

  const esEnvio = pedido.delivery_mode === "delivery";
  const porTransferencia = pedido.payment_method === "transfer";
  const cerrado = pedido.status === "delivered" || pedido.status === "cancelled";
  const total = Number(pedido.total);
  const envio = Number(pedido.shipping_cost);
  const vuelto = pedido.cash_amount != null ? Number(pedido.cash_amount) - total : null;

  const whatsapp = linkWhatsapp(
    settings.whatsapp_phone,
    mensajePedido(pedido, settings.store_name, `${env.siteUrl}/pedido/${pedido.id}`),
  );

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <header className="space-y-3">
        {pedido.status === "new" ? (
          <>
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent">
              <IconoCheck width={28} height={28} />
            </span>
            <h1 className="text-2xl font-semibold tracking-tight">
              ¡Recibimos tu pedido, {pedido.customer_name.split(" ")[0]}!
            </h1>
          </>
        ) : (
          <h1 className="text-2xl font-semibold tracking-tight">Tu pedido</h1>
        )}
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-neutral-700">
          <span>
            Pedido <strong className="font-semibold tabular-nums">#{pedido.order_number}</strong>
          </span>
          <Badge tono={pedido.status === "cancelled" ? "peligro" : "acento"}>
            {ETIQUETA_ESTADO[pedido.status]}
          </Badge>
        </p>
        <p className="text-sm text-neutral-600">
          Guardá este link para volver a ver tu pedido cuando quieras.
        </p>
      </header>

      {/* ---------- Aviso por WhatsApp ---------- */}
      {whatsapp && !cerrado && (
        <section className="space-y-3 rounded-lg border border-neutral-200 p-4">
          <h2 className="font-semibold">Avisanos por WhatsApp</h2>
          <p className="text-sm text-neutral-600">
            Mandanos el pedido con un toque: el mensaje ya está escrito. Por ahí te confirmamos
            y te avisamos cuando esté listo.
          </p>
          <a
            href={whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-accent px-6 text-base font-medium text-accent-fg hover:bg-accent-hover sm:w-auto"
          >
            <IconoWhatsapp width={20} height={20} />
            Enviar pedido por WhatsApp
          </a>
        </section>
      )}

      {/* ---------- Pago ---------- */}
      <section aria-labelledby="titulo-pago" className="space-y-4 rounded-lg border border-neutral-200 p-4">
        <h2 id="titulo-pago" className="font-semibold">
          Pago: {ETIQUETA_PAGO[pedido.payment_method].toLowerCase()}
        </h2>

        {porTransferencia ? (
          <>
            <p className="text-sm text-neutral-700">
              Transferí <strong className="font-semibold">{formatPrecio(total)}</strong> a esta
              cuenta y mandanos el comprobante.
            </p>
            {(settings.bank_alias || settings.bank_cbu) && (
              <dl className="space-y-3 rounded-lg bg-neutral-50 p-4">
                {settings.bank_alias && <DatoCopiable etiqueta="Alias" valor={settings.bank_alias} />}
                {settings.bank_cbu && <DatoCopiable etiqueta="CBU" valor={settings.bank_cbu} />}
                {settings.bank_holder && (
                  <div>
                    <dt className="text-xs text-neutral-600">Titular</dt>
                    <dd className="font-medium">{settings.bank_holder}</dd>
                  </div>
                )}
              </dl>
            )}
            {cerrado ? (
              pedido.receipt_path && (
                <p className="flex items-center gap-2 text-sm font-medium text-accent">
                  <IconoCheck width={18} height={18} />
                  Recibimos tu comprobante.
                </p>
              )
            ) : (
              <SubirComprobante
                pedidoId={pedido.id}
                yaSubido={Boolean(pedido.receipt_path)}
                avisoInicial={
                  searchParams.comprobante === "pendiente" && !pedido.receipt_path
                    ? "Tu pedido quedó hecho, pero no pudimos guardar el comprobante. Subilo de nuevo o mandalo por WhatsApp."
                    : undefined
                }
              />
            )}
          </>
        ) : (
          <p className="text-sm text-neutral-700">
            Pagás <strong className="font-semibold">{formatPrecio(total)}</strong> en efectivo{" "}
            {esEnvio ? "cuando lo recibís" : "cuando lo retirás"}.
            {pedido.cash_amount != null && vuelto != null && (
              <>
                {" "}
                Pagás con {formatPrecio(Number(pedido.cash_amount))}
                {vuelto > 0 ? `: tu vuelto es de ${formatPrecio(vuelto)}.` : ", justo."}
              </>
            )}
          </p>
        )}
      </section>

      {/* ---------- Entrega ---------- */}
      <section aria-labelledby="titulo-entrega" className="space-y-3 rounded-lg border border-neutral-200 p-4">
        <h2 id="titulo-entrega" className="font-semibold">
          {ETIQUETA_ENTREGA[pedido.delivery_mode]}
        </h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          {esEnvio ? (
            <>
              <dt className="text-neutral-600">Dirección</dt>
              <dd>
                {pedido.address}
                {pedido.address_notes && (
                  <span className="block text-neutral-600">{pedido.address_notes}</span>
                )}
              </dd>
              {pedido.delivery_zone_name && (
                <>
                  <dt className="text-neutral-600">Zona</dt>
                  <dd>{pedido.delivery_zone_name}</dd>
                </>
              )}
            </>
          ) : (
            <>
              {settings.store_address && (
                <>
                  <dt className="text-neutral-600">Dónde</dt>
                  <dd>{settings.store_address}</dd>
                </>
              )}
            </>
          )}
          {pedido.delivery_date && (
            <>
              <dt className="text-neutral-600">Cuándo</dt>
              <dd>
                {formatFecha(pedido.delivery_date)}
                {pedido.time_slot_label && `, de ${pedido.time_slot_label} h`}
              </dd>
            </>
          )}
          <dt className="text-neutral-600">A nombre de</dt>
          <dd>
            {pedido.customer_name} · {pedido.customer_phone}
          </dd>
          {pedido.comments && (
            <>
              <dt className="text-neutral-600">Comentarios</dt>
              <dd className="whitespace-pre-line">{pedido.comments}</dd>
            </>
          )}
        </dl>
      </section>

      {/* ---------- Productos ---------- */}
      <section aria-labelledby="titulo-productos" className="space-y-3 rounded-lg border border-neutral-200 p-4">
        <h2 id="titulo-productos" className="font-semibold">
          Productos ({pedido.items.length})
        </h2>
        <ul className="divide-y divide-neutral-200 text-sm">
          {pedido.items.map((item) => (
            <li key={item.id} className="flex justify-between gap-4 py-2">
              <span className="min-w-0">
                <span className="font-medium tabular-nums">
                  {formatCantidad(Number(item.quantity), item.sale_unit)} ×
                </span>{" "}
                {item.product_name}
                {item.product_brand && <span className="text-neutral-600"> · {item.product_brand}</span>}
              </span>
              <span className="shrink-0 tabular-nums">{formatPrecio(Number(item.line_total))}</span>
            </li>
          ))}
        </ul>
        <dl className="space-y-2 border-t border-neutral-200 pt-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-neutral-600">Subtotal</dt>
            <dd className="tabular-nums">{formatPrecio(Number(pedido.subtotal))}</dd>
          </div>
          {esEnvio && (
            <div className="flex justify-between gap-4">
              <dt className="text-neutral-600">Envío</dt>
              <dd className="tabular-nums">{envio > 0 ? formatPrecio(envio) : "Gratis"}</dd>
            </div>
          )}
          <div className="flex items-baseline justify-between gap-4 border-t border-neutral-200 pt-3">
            <dt className="font-semibold">Total</dt>
            <dd className="text-xl font-semibold tabular-nums">{formatPrecio(total)}</dd>
          </div>
        </dl>
      </section>

      <p>
        <Link href="/" className="rounded text-accent underline underline-offset-2">
          Seguir comprando
        </Link>
      </p>
    </div>
  );
}
