"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ImagenProducto } from "@/components/tienda/imagen-producto";
import { SelectorCantidad } from "@/components/tienda/selector-cantidad";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { IconoBasura } from "@/components/ui/iconos";
import { Skeleton } from "@/components/ui/skeleton";
import { formatContenido, formatPrecio } from "@/lib/format";
import { problemaDelItem, useCarritoAlDia } from "@/lib/use-carrito-al-dia";
import { cn } from "@/lib/utils";
import { calcularSubtotal, useCarrito } from "@/store/carrito";

const estiloBoton =
  "inline-flex h-12 w-full items-center justify-center rounded-lg px-6 text-base font-medium transition-colors";

/**
 * Pantalla del carrito: lista de productos con sus cantidades, subtotal
 * y el paso al checkout. Todo vive en el navegador (localStorage).
 */
export function VistaCarrito({
  compraMinima,
  envioGratisDesde,
  controlarStock,
}: {
  compraMinima: number;
  /** null = no hay envío gratis (o no se hacen envíos). */
  envioGratisDesde: number | null;
  controlarStock: boolean;
}) {
  const { listo, fallo, noDisponibles } = useCarritoAlDia();
  const itemsPorId = useCarrito((e) => e.items);
  const subtotal = useCarrito(calcularSubtotal);
  const quitar = useCarrito((e) => e.quitar);
  const vaciar = useCarrito((e) => e.vaciar);
  // Viene de "Repetir pedido" cuando algunos productos ya no se venden.
  const faltan = Number(useSearchParams().get("faltan")) || 0;

  if (!listo) return <CarritoCargando />;

  const items = Object.values(itemsPorId).sort((a, b) =>
    a.producto.name.localeCompare(b.producto.name, "es"),
  );

  if (items.length === 0) {
    return (
      <EstadoVacio
        titulo="Tu carrito está vacío"
        descripcion="Sumá productos desde el catálogo y van a aparecer acá."
        accion={
          <Link href="/" className={cn(estiloBoton, "bg-accent text-accent-fg hover:bg-accent-hover")}>
            Ver productos
          </Link>
        }
      />
    );
  }

  const hayProblemas = items.some((i) => problemaDelItem(i, controlarStock, noDisponibles));
  const faltaParaMinimo = Math.max(0, compraMinima - subtotal);
  const faltaParaEnvioGratis =
    envioGratisDesde != null ? Math.max(0, envioGratisDesde - subtotal) : null;
  const puedeSeguir = !hayProblemas && faltaParaMinimo === 0;

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-xl font-semibold tracking-tight">Tu carrito</h1>
        <button
          type="button"
          onClick={() => {
            if (window.confirm("¿Vaciar el carrito?")) vaciar();
          }}
          className="rounded text-sm text-neutral-600 underline underline-offset-2 hover:text-neutral-900"
        >
          Vaciar carrito
        </button>
      </div>

      {faltan > 0 && (
        <p role="status" className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {faltan === 1
            ? "Un producto de ese pedido ya no está disponible y no se agregó."
            : `${faltan} productos de ese pedido ya no están disponibles y no se agregaron.`}
        </p>
      )}

      {fallo && (
        <p role="status" className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          No pudimos actualizar los precios. Los vas a ver confirmados antes de terminar el pedido.
        </p>
      )}

      <div className="grid gap-8 lg:grid-cols-[1fr_22rem] lg:items-start">
        <ul className="divide-y divide-neutral-200 border-y border-neutral-200">
          {items.map((item) => {
            const { producto, cantidad } = item;
            const problema = problemaDelItem(item, controlarStock, noDisponibles);
            const total = Math.round(producto.price * cantidad * 100) / 100;
            const detalle = [producto.brand, formatContenido(producto.net_content, producto.net_content_unit)]
              .filter(Boolean)
              .join(" · ");
            const unidad =
              producto.sale_unit === "kilo" ? " / kg" : producto.sale_unit === "litro" ? " / l" : " c/u";

            return (
              <li key={producto.id} className="flex gap-3 py-4 sm:gap-4">
                <Link href={`/producto/${producto.slug}`} className="w-16 shrink-0 rounded-lg sm:w-20" tabIndex={-1} aria-hidden>
                  <ImagenProducto src={producto.image_url} alt="" sizes="80px" />
                </Link>

                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link
                        href={`/producto/${producto.slug}`}
                        className="line-clamp-2 rounded text-sm font-medium text-neutral-900 hover:underline"
                      >
                        {producto.name}
                      </Link>
                      {detalle && <p className="truncate text-xs text-neutral-600">{detalle}</p>}
                      {producto.price > 0 && (
                        <p className="text-xs text-neutral-600">
                          {formatPrecio(producto.price)}
                          {unidad}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => quitar(producto.id)}
                      aria-label={`Sacar ${producto.name} del carrito`}
                      className="-mr-2 -mt-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
                    >
                      <IconoBasura width={20} height={20} />
                    </button>
                  </div>

                  {problema ? (
                    <p role="alert" className="text-sm text-red-700">
                      {problema}
                    </p>
                  ) : null}

                  <div className="flex items-center justify-between gap-3">
                    <div className="w-32">
                      {noDisponibles.has(producto.id) ? null : (
                        <SelectorCantidad producto={producto} controlarStock={controlarStock} />
                      )}
                    </div>
                    {producto.price > 0 && !noDisponibles.has(producto.id) && (
                      <p className="font-semibold tabular-nums">{formatPrecio(total)}</p>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        <section
          aria-labelledby="titulo-resumen"
          className="space-y-4 rounded-lg border border-neutral-200 p-4 lg:sticky lg:top-24"
        >
          <h2 id="titulo-resumen" className="font-semibold">
            Resumen
          </h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-neutral-600">
                Subtotal ({items.length} {items.length === 1 ? "producto" : "productos"})
              </dt>
              <dd className="text-base font-semibold tabular-nums">{formatPrecio(subtotal)}</dd>
            </div>
          </dl>
          <p className="text-sm text-neutral-600">
            El envío se calcula en el paso siguiente.
            {faltaParaEnvioGratis != null &&
              (faltaParaEnvioGratis > 0
                ? ` Te faltan ${formatPrecio(faltaParaEnvioGratis)} para tener envío gratis.`
                : " ¡Tenés envío gratis!")}
          </p>

          {faltaParaMinimo > 0 && (
            <p role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              La compra mínima es de {formatPrecio(compraMinima)}. Te faltan{" "}
              {formatPrecio(faltaParaMinimo)}.
            </p>
          )}
          {hayProblemas && (
            <p role="status" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              Hay productos que no se pueden comprar. Revisalos para continuar.
            </p>
          )}

          {puedeSeguir ? (
            <Link href="/checkout" className={cn(estiloBoton, "bg-accent text-accent-fg hover:bg-accent-hover")}>
              Continuar
            </Link>
          ) : (
            <span aria-disabled className={cn(estiloBoton, "cursor-not-allowed bg-accent text-accent-fg opacity-50")}>
              Continuar
            </span>
          )}
          <Link
            href="/"
            className={cn(estiloBoton, "h-10 text-sm text-neutral-700 hover:bg-neutral-100")}
          >
            Seguir comprando
          </Link>
        </section>
      </div>
    </div>
  );
}

function CarritoCargando() {
  return (
    <div className="space-y-6" aria-busy>
      <Skeleton className="h-7 w-32" />
      <div className="space-y-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex gap-4">
            <Skeleton className="h-20 w-20" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-10 w-32" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
