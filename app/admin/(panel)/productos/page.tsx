import type { Metadata } from "next";
import Link from "next/link";
import { FilaProducto } from "@/components/admin/fila-producto";
import { BotonLink, Paginacion, Titulo } from "@/components/admin/ui";
import { exigirPersonal } from "@/lib/admin";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Productos" };

const POR_PAGINA = 50;

const FILTROS = {
  todos: "Todos",
  "sin-precio": "Sin precio",
  "sin-stock": "Sin stock",
  ofertas: "En oferta",
  "sin-foto": "Sin foto",
  inactivos: "Ocultos",
} as const;
type Filtro = keyof typeof FILTROS;

type Props = { searchParams: { q?: string; filtro?: string; pagina?: string } };

export default async function PaginaProductos({ searchParams }: Props) {
  const { sb } = await exigirPersonal();
  const filtro: Filtro = searchParams.filtro && searchParams.filtro in FILTROS ? (searchParams.filtro as Filtro) : "todos";
  const busqueda = (searchParams.q ?? "").trim().slice(0, 80);
  const pagina = Math.max(1, Number(searchParams.pagina) || 1);

  let consulta = sb
    .from("products")
    .select("id, name, brand, sku, barcode, price, stock, active, on_sale, image_url, sale_unit", { count: "exact" });
  if (filtro === "sin-precio") consulta = consulta.lte("price", 0);
  if (filtro === "sin-stock") consulta = consulta.lte("stock", 0);
  if (filtro === "ofertas") consulta = consulta.eq("on_sale", true);
  if (filtro === "sin-foto") consulta = consulta.is("image_url", null);
  if (filtro === "inactivos") consulta = consulta.eq("active", false);
  if (busqueda) {
    // search_text está en minúsculas y sin acentos. Sacamos los caracteres especiales del filtro "or".
    const limpio = busqueda
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[,()*%\\:"]/g, " ")
      .trim();
    consulta = consulta.or(`search_text.ilike.*${limpio}*,sku.ilike.*${limpio}*,barcode.ilike.*${limpio}*`);
  }
  const { data: productos, count, error } = await consulta
    .order("name")
    .order("id")
    .range((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA - 1);
  if (error) throw new Error(`No se pudieron leer los productos: ${error.message}`);

  const href = (cambios: Partial<{ filtro: Filtro; pagina: number }>) => {
    const p = new URLSearchParams();
    const f = cambios.filtro ?? filtro;
    if (f !== "todos") p.set("filtro", f);
    if (busqueda) p.set("q", busqueda);
    if ((cambios.pagina ?? 1) > 1) p.set("pagina", String(cambios.pagina));
    const s = p.toString();
    return `/admin/productos${s ? `?${s}` : ""}`;
  };

  return (
    <div>
      <Titulo
        accion={
          <div className="flex gap-2">
            <BotonLink href="/admin/importar" variante="secundario">
              Importar
            </BotonLink>
            <BotonLink href="/admin/productos/nuevo">Nuevo producto</BotonLink>
          </div>
        }
      >
        Productos <span className="text-base font-normal text-neutral-500">({count ?? 0})</span>
      </Titulo>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <nav aria-label="Filtrar productos" className="no-scrollbar -mx-4 overflow-x-auto px-4">
          <ul className="flex gap-2">
            {(Object.keys(FILTROS) as Filtro[]).map((f) => (
              <li key={f}>
                <Link
                  href={href({ filtro: f })}
                  aria-current={f === filtro ? "page" : undefined}
                  className={cn(
                    "block whitespace-nowrap rounded-full border px-3 py-1.5 text-sm",
                    f === filtro ? "border-accent bg-accent text-accent-fg" : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50",
                  )}
                >
                  {FILTROS[f]}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <form action="/admin/productos" className="flex gap-2">
          {filtro !== "todos" && <input type="hidden" name="filtro" value={filtro} />}
          <label htmlFor="buscar-producto" className="sr-only">
            Buscar producto
          </label>
          <input
            id="buscar-producto"
            name="q"
            defaultValue={busqueda}
            placeholder="Nombre, marca, SKU o código"
            className="h-10 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm sm:w-72"
          />
          <button type="submit" className="h-10 rounded-lg border border-neutral-300 bg-white px-3 text-sm hover:bg-neutral-50">
            Buscar
          </button>
        </form>
      </div>

      {!productos?.length ? (
        <p className="rounded-lg border border-dashed border-neutral-300 bg-white px-4 py-12 text-center text-neutral-600">
          No hay productos en esta lista.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
          <table className="w-full min-w-[44rem] text-sm">
            <thead className="border-b border-neutral-200 text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-3 py-2 font-medium">Producto</th>
                <th className="px-3 py-2 font-medium">SKU</th>
                <th className="w-32 px-3 py-2 font-medium">Precio</th>
                <th className="w-28 px-3 py-2 font-medium">Stock</th>
                <th className="px-3 py-2 text-center font-medium">Oferta</th>
                <th className="px-3 py-2 text-center font-medium">Visible</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {productos.map((p) => (
                <FilaProducto key={p.id} producto={{ ...p, price: Number(p.price), stock: Number(p.stock) }} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Paginacion pagina={pagina} total={count ?? 0} porPagina={POR_PAGINA} armarHref={(n) => href({ pagina: n })} />
    </div>
  );
}
