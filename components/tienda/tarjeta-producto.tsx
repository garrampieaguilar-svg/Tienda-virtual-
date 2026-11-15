import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { ProductoTarjeta } from "@/lib/data/consultas";
import {
  formatContenido,
  formatPrecio,
  porcentajeDescuento,
  precioPorUnidadDeMedida,
} from "@/lib/format";
import { ImagenProducto } from "./imagen-producto";
import { SelectorCantidad } from "./selector-cantidad";

/**
 * Tarjeta de producto del catálogo: imagen, nombre, precio, precio por kilo/litro
 * y botones para sumar o restar sin salir del listado.
 */
export function TarjetaProducto({
  producto,
  controlarStock,
}: {
  producto: ProductoTarjeta;
  controlarStock: boolean;
}) {
  const tienePrecio = producto.price > 0;
  const descuento =
    producto.on_sale && producto.previous_price
      ? porcentajeDescuento(producto.previous_price, producto.price)
      : 0;
  const contenido = formatContenido(producto.net_content, producto.net_content_unit);
  const precioMedida = precioPorUnidadDeMedida(
    producto.price,
    producto.net_content,
    producto.net_content_unit,
    producto.sale_unit,
  );
  // En productos por kilo/litro el precio ya es "por kg": no hace falta repetirlo abajo.
  const vendidoPorMedida = producto.sale_unit === "kilo" || producto.sale_unit === "litro";
  const detalle = [contenido, vendidoPorMedida ? null : precioMedida].filter(Boolean).join(" · ");

  return (
    <article className="flex h-full flex-col">
      <Link href={`/producto/${producto.slug}`} className="group flex flex-1 flex-col gap-2 rounded-lg">
        <div className="relative">
          <ImagenProducto
            src={producto.image_url}
            alt=""
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
          />
          {producto.on_sale && tienePrecio && (
            <Badge tono="oferta" className="absolute left-2 top-2">
              {descuento > 0 ? `-${descuento}%` : "Oferta"}
            </Badge>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-1">
          {producto.brand && <p className="text-xs text-neutral-500">{producto.brand}</p>}
          <h3 className="line-clamp-2 text-sm text-neutral-800 group-hover:underline">
            {producto.name}
          </h3>
        </div>

        <div>
          {tienePrecio ? (
            <p className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-base font-semibold text-neutral-900">
                {formatPrecio(producto.price)}
                {vendidoPorMedida && (
                  <span className="text-sm font-normal text-neutral-600">
                    {producto.sale_unit === "kilo" ? " / kg" : " / l"}
                  </span>
                )}
              </span>
              {descuento > 0 && producto.previous_price && (
                <span className="text-xs text-neutral-500 line-through">
                  <span className="sr-only">Antes: </span>
                  {formatPrecio(producto.previous_price)}
                </span>
              )}
            </p>
          ) : (
            <p className="text-sm text-neutral-500">Sin precio todavía</p>
          )}
          {/* Altura fija para que todas las tarjetas queden alineadas. */}
          <p className="h-4 truncate text-xs text-neutral-600">{detalle}</p>
        </div>
      </Link>

      <div className="mt-2">
        <SelectorCantidad producto={producto} controlarStock={controlarStock} />
      </div>
    </article>
  );
}

/** Grilla del catálogo: 2 columnas en celular, hasta 5 en escritorio. */
export function GrillaProductos({ children }: { children: React.ReactNode }) {
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {children}
    </ul>
  );
}
