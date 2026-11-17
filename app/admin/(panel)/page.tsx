import type { Metadata } from "next";
import Link from "next/link";
import { AvisoPedidosNuevos } from "@/components/admin/aviso-pedidos-nuevos";
import { Paginacion, Titulo } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { exigirPersonal } from "@/lib/admin";
import { formatPrecio } from "@/lib/format";
import { ETIQUETA_ESTADO, ZONA_HORARIA, ahoraEnArgentina, formatFecha } from "@/lib/pedido";
import { cn } from "@/lib/utils";
import type { OrderStatus } from "@/types/database";

// "absolute": esta página comparte carpeta con el layout del panel, que no le aplica su plantilla.
export const metadata: Metadata = { title: { absolute: "Pedidos · Panel" } };

const POR_PAGINA = 30;

/** Pestañas de filtro. "abiertos" = todo lo que todavía hay que preparar o entregar. */
const FILTROS = {
  abiertos: { texto: "Abiertos", estados: ["new", "preparing", "ready_for_pickup", "out_for_delivery"] },
  new: { texto: "Nuevos", estados: ["new"] },
  preparing: { texto: "En preparación", estados: ["preparing"] },
  listos: { texto: "Listos / en camino", estados: ["ready_for_pickup", "out_for_delivery"] },
  delivered: { texto: "Entregados", estados: ["delivered"] },
  cancelled: { texto: "Cancelados", estados: ["cancelled"] },
  todos: { texto: "Todos", estados: [] },
} satisfies Record<string, { texto: string; estados: OrderStatus[] }>;
type Filtro = keyof typeof FILTROS;

const TONO: Record<OrderStatus, "aviso" | "acento" | "neutro" | "peligro"> = {
  new: "aviso",
  preparing: "acento",
  ready_for_pickup: "acento",
  out_for_delivery: "acento",
  delivered: "neutro",
  cancelled: "peligro",
};

const formatoHora = new Intl.DateTimeFormat("es-AR", {
  timeZone: ZONA_HORARIA,
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

type Props = { searchParams: { estado?: string; q?: string; pagina?: string } };

export default async function PaginaPedidos({ searchParams }: Props) {
  const { sb } = await exigirPersonal();
  const filtro: Filtro = searchParams.estado && searchParams.estado in FILTROS ? (searchParams.estado as Filtro) : "abiertos";
  const busqueda = (searchParams.q ?? "").trim().slice(0, 60);
  const pagina = Math.max(1, Number(searchParams.pagina) || 1);

  let consulta = sb
    .from("orders")
    .select(
      "id, order_number, status, customer_name, customer_phone, delivery_mode, delivery_date, time_slot_label, payment_method, receipt_path, total, created_at",
      { count: "exact" },
    );
  const estados: OrderStatus[] = FILTROS[filtro].estados;
  if (estados.length) consulta = consulta.in("status", estados);
  if (busqueda) {
    const soloNumero = busqueda.replace(/^#/, "");
    if (/^\d{1,9}$/.test(soloNumero) && soloNumero.length <= 6) {
      consulta = consulta.eq("order_number", Number(soloNumero));
    } else {
      // Sacamos los caracteres que tienen significado especial en el filtro "or" de la API.
      const limpio = busqueda.replace(/[,()*%\\:"]/g, " ").trim();
      consulta = consulta.or(`customer_name.ilike.*${limpio}*,customer_phone.ilike.*${limpio}*`);
    }
  }
  // Los abiertos se ordenan del más viejo al más nuevo (es el orden en que se preparan).
  const { data: pedidos, count, error } = await consulta
    .order("created_at", { ascending: filtro !== "abiertos" && filtro !== "new" ? false : true })
    .range((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA - 1);
  if (error) throw new Error(`No se pudieron leer los pedidos: ${error.message}`);

  const { count: nuevos } = await sb.from("orders").select("id", { count: "exact", head: true }).eq("status", "new");
  const { hoy } = ahoraEnArgentina();

  const href = (cambios: Partial<{ estado: string; q: string; pagina: number }>) => {
    const p = new URLSearchParams();
    const estado = cambios.estado ?? filtro;
    if (estado !== "abiertos") p.set("estado", estado);
    const q = cambios.q ?? busqueda;
    if (q) p.set("q", q);
    const pag = cambios.pagina ?? 1;
    if (pag > 1) p.set("pagina", String(pag));
    const s = p.toString();
    return `/admin${s ? `?${s}` : ""}`;
  };

  return (
    <div>
      <Titulo>Pedidos</Titulo>
      <AvisoPedidosNuevos nuevos={nuevos ?? 0} />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <nav aria-label="Filtrar por estado" className="no-scrollbar -mx-4 overflow-x-auto px-4">
          <ul className="flex gap-2">
            {(Object.keys(FILTROS) as Filtro[]).map((f) => (
              <li key={f}>
                <Link
                  href={href({ estado: f })}
                  aria-current={f === filtro ? "page" : undefined}
                  className={cn(
                    "block whitespace-nowrap rounded-full border px-3 py-1.5 text-sm",
                    f === filtro
                      ? "border-accent bg-accent text-accent-fg"
                      : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50",
                  )}
                >
                  {FILTROS[f].texto}
                  {f === "new" && (nuevos ?? 0) > 0 && ` (${nuevos})`}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <form action="/admin" className="flex gap-2">
          {filtro !== "abiertos" && <input type="hidden" name="estado" value={filtro} />}
          <label htmlFor="buscar-pedido" className="sr-only">
            Buscar pedido
          </label>
          <input
            id="buscar-pedido"
            name="q"
            defaultValue={busqueda}
            placeholder="Número, nombre o teléfono"
            className="h-10 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm sm:w-64"
          />
          <button type="submit" className="h-10 rounded-lg border border-neutral-300 bg-white px-3 text-sm hover:bg-neutral-50">
            Buscar
          </button>
        </form>
      </div>

      {!pedidos?.length ? (
        <p className="rounded-lg border border-dashed border-neutral-300 bg-white px-4 py-12 text-center text-neutral-600">
          {busqueda ? "No hay pedidos que coincidan con la búsqueda." : "No hay pedidos en esta lista."}
        </p>
      ) : (
        <ul className="divide-y divide-neutral-200 overflow-hidden rounded-lg border border-neutral-200 bg-white">
          {pedidos.map((p) => (
            <li key={p.id}>
              <Link href={`/admin/pedidos/${p.id}`} className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-neutral-50">
                <div className="min-w-0 space-y-0.5">
                  <p className="flex min-w-0 items-baseline gap-2">
                    <span className="shrink-0 font-semibold tabular-nums">#{p.order_number}</span>
                    <span className="truncate font-medium">{p.customer_name}</span>
                  </p>
                  <p className="truncate text-sm text-neutral-700">
                    {p.delivery_mode === "pickup" ? "Retira" : "Envío"}
                    {p.delivery_date && ` · ${formatFecha(p.delivery_date, hoy)}`}
                    {p.time_slot_label && ` · ${p.time_slot_label}`}
                  </p>
                  <p className="text-xs text-neutral-500">
                    {formatoHora.format(new Date(p.created_at))} ·{" "}
                    {p.payment_method === "cash" ? "Efectivo" : p.receipt_path ? "Transferencia ✓" : "Transferencia sin comprobante"}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <span className="font-semibold tabular-nums">{formatPrecio(Number(p.total))}</span>
                  <Badge tono={TONO[p.status]}>{ETIQUETA_ESTADO[p.status]}</Badge>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Paginacion pagina={pagina} total={count ?? 0} porPagina={POR_PAGINA} armarHref={(n) => href({ pagina: n })} />
    </div>
  );
}
