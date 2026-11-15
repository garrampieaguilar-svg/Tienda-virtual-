import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ImagenProducto } from "@/components/tienda/imagen-producto";
import { SelectorCantidad } from "@/components/tienda/selector-cantidad";
import { GrillaProductos, TarjetaProducto } from "@/components/tienda/tarjeta-producto";
import { Badge } from "@/components/ui/badge";
import {
  getCategorias,
  getProductoPorSlug,
  getRelacionados,
  getSettings,
} from "@/lib/data/catalogo";
import {
  formatCantidad,
  formatContenido,
  formatPrecio,
  porcentajeDescuento,
  precioPorUnidadDeMedida,
} from "@/lib/format";

// Cada página se genera la primera vez que alguien la visita y queda guardada
// en caché; se actualiza como mucho una vez por minuto. (La lista vacía de abajo
// es lo que habilita ese caché para rutas con [slug].)
export const revalidate = 60;
export function generateStaticParams() {
  return [];
}

type Props = { params: { slug: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const producto = await getProductoPorSlug(params.slug);
  // Si no existe, se muestra la página "No encontramos esta página" (con noindex para buscadores).
  if (!producto) notFound();
  return {
    title: [producto.name, producto.brand].filter(Boolean).join(" · "),
    description: producto.description ?? undefined,
  };
}

export default async function PaginaProducto({ params }: Props) {
  const producto = await getProductoPorSlug(params.slug);
  if (!producto) notFound();

  const [settings, categorias, relacionados] = await Promise.all([
    getSettings(),
    getCategorias(),
    getRelacionados(producto),
  ]);

  // Camino de categorías: Inicio › Almacén › Yerba, café y té
  const principal = categorias.find(
    (c) => c.id === producto.category_id || c.hijas.some((h) => h.id === producto.category_id),
  );
  const sub = principal?.hijas.find((h) => h.id === producto.category_id);

  const tienePrecio = producto.price > 0;
  const descuento =
    producto.on_sale && producto.previous_price
      ? porcentajeDescuento(producto.previous_price, producto.price)
      : 0;
  const vendidoPorMedida = producto.sale_unit === "kilo" || producto.sale_unit === "litro";
  const contenido = formatContenido(producto.net_content, producto.net_content_unit);
  const precioMedida = vendidoPorMedida
    ? null
    : precioPorUnidadDeMedida(
        producto.price,
        producto.net_content,
        producto.net_content_unit,
        producto.sale_unit,
      );

  let textoStock: string;
  if (!settings.track_stock) textoStock = "Disponible";
  else if (producto.stock <= 0) textoStock = "Sin stock por ahora";
  else textoStock = `${formatCantidad(producto.stock, producto.sale_unit)} disponibles`;

  return (
    <div className="space-y-12">
      <nav aria-label="Estás en" className="text-sm text-neutral-600">
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <li>
            <Link href="/" className="rounded hover:underline">
              Inicio
            </Link>
          </li>
          {principal && (
            <li className="flex items-center gap-2">
              <span aria-hidden>›</span>
              <Link href={`/categoria/${principal.slug}`} className="rounded hover:underline">
                {principal.name}
              </Link>
            </li>
          )}
          {sub && (
            <li className="flex items-center gap-2">
              <span aria-hidden>›</span>
              <Link href={`/categoria/${sub.slug}`} className="rounded hover:underline">
                {sub.name}
              </Link>
            </li>
          )}
        </ol>
      </nav>

      <article className="grid gap-8 md:grid-cols-2 md:gap-12">
        <ImagenProducto
          src={producto.image_url}
          alt={producto.name}
          sizes="(max-width: 768px) 100vw, 36rem"
          prioridad
          className="mx-auto w-full max-w-md"
        />

        <div className="space-y-6">
          <header className="space-y-2">
            {producto.brand && <p className="text-sm text-neutral-600">{producto.brand}</p>}
            <h1 className="text-2xl font-semibold tracking-tight">{producto.name}</h1>
            {contenido && <p className="text-neutral-600">{contenido}</p>}
          </header>

          <div className="space-y-1">
            {tienePrecio ? (
              <>
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-3xl font-semibold">
                    {formatPrecio(producto.price)}
                    {vendidoPorMedida && (
                      <span className="text-lg font-normal text-neutral-600">
                        {producto.sale_unit === "kilo" ? " / kg" : " / l"}
                      </span>
                    )}
                  </span>
                  {descuento > 0 && producto.previous_price && (
                    <>
                      <span className="text-neutral-500 line-through">
                        <span className="sr-only">Antes: </span>
                        {formatPrecio(producto.previous_price)}
                      </span>
                      <Badge tono="oferta">-{descuento}%</Badge>
                    </>
                  )}
                  {producto.on_sale && descuento === 0 && <Badge tono="oferta">Oferta</Badge>}
                </p>
                {precioMedida && <p className="text-sm text-neutral-600">{precioMedida}</p>}
              </>
            ) : (
              <p className="text-neutral-600">Todavía no tenemos el precio cargado.</p>
            )}
          </div>

          <div className="max-w-xs space-y-2">
            <SelectorCantidad producto={producto} controlarStock={settings.track_stock} grande />
            <p className="text-sm text-neutral-600">{textoStock}</p>
          </div>

          {producto.description && (
            <section aria-labelledby="titulo-descripcion" className="space-y-2 border-t border-neutral-200 pt-6">
              <h2 id="titulo-descripcion" className="font-semibold">
                Descripción
              </h2>
              <p className="whitespace-pre-line text-neutral-700">{producto.description}</p>
            </section>
          )}

          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 border-t border-neutral-200 pt-6 text-sm">
            {producto.brand && (
              <>
                <dt className="text-neutral-600">Marca</dt>
                <dd>{producto.brand}</dd>
              </>
            )}
            {principal && (
              <>
                <dt className="text-neutral-600">Categoría</dt>
                <dd>{[principal.name, sub?.name].filter(Boolean).join(" › ")}</dd>
              </>
            )}
            {producto.barcode && (
              <>
                <dt className="text-neutral-600">Código de barras</dt>
                <dd className="tabular-nums">{producto.barcode}</dd>
              </>
            )}
          </dl>
        </div>
      </article>

      {relacionados.length > 0 && (
        <section aria-labelledby="titulo-relacionados" className="space-y-5">
          <h2 id="titulo-relacionados" className="text-xl font-semibold tracking-tight">
            También te puede interesar
          </h2>
          <GrillaProductos>
            {relacionados.map((r) => (
              <li key={r.id}>
                <TarjetaProducto producto={r} controlarStock={settings.track_stock} />
              </li>
            ))}
          </GrillaProductos>
        </section>
      )}
    </div>
  );
}
