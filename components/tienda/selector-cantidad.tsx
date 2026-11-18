"use client";

import { IconoMas, IconoMenos } from "@/components/ui/iconos";
import type { ProductoTarjeta } from "@/lib/data/consultas";
import { formatCantidad } from "@/lib/format";
import { useMontado } from "@/lib/use-montado";
import { cn } from "@/lib/utils";
import { useCarrito } from "@/store/carrito";

/**
 * Botones para sumar y restar un producto del carrito.
 * - Si no está en el carrito: botón "Agregar".
 * - Si está: [ − ] cantidad [ + ].
 * - Sin precio cargado o sin stock: no se puede agregar.
 */
export function SelectorCantidad({
  producto,
  controlarStock,
  grande,
}: {
  producto: ProductoTarjeta;
  /** true si el comercio controla stock (settings.track_stock). */
  controlarStock: boolean;
  /** Versión más alta, para la página del producto. */
  grande?: boolean;
}) {
  const montado = useMontado();
  const cantidad = useCarrito((e) => e.items[producto.id]?.cantidad ?? 0);
  const sumar = useCarrito((e) => e.sumar);
  const restar = useCarrito((e) => e.restar);

  const alto = grande ? "h-12 text-base" : "h-10 text-sm";

  if (producto.price <= 0) {
    return <Aviso className={alto}>Precio a confirmar</Aviso>;
  }
  if (controlarStock && producto.stock <= 0) {
    return <Aviso className={alto}>Sin stock</Aviso>;
  }

  const enCarrito = montado ? cantidad : 0;
  const llegoAlTope =
    controlarStock && enCarrito + Number(producto.quantity_step) > producto.stock;

  if (enCarrito === 0) {
    return (
      <button
        type="button"
        onClick={() => sumar(producto)}
        aria-label={`Agregar ${producto.name} al carrito`}
        className={cn(
          "w-full rounded-lg border border-accent font-medium text-accent transition-colors hover:bg-accent hover:text-accent-fg",
          alto,
        )}
      >
        Agregar
      </button>
    );
  }

  return (
    <div
      className={cn("flex w-full items-center rounded-lg bg-accent text-accent-fg", alto)}
      role="group"
      aria-label={`Cantidad de ${producto.name}`}
    >
      <button
        type="button"
        onClick={() => restar(producto.id)}
        aria-label={`Quitar uno de ${producto.name}`}
        className="flex h-full w-11 shrink-0 items-center justify-center rounded-l-lg hover:bg-accent-hover"
      >
        <IconoMenos width={18} height={18} />
      </button>
      <span className="flex-1 text-center font-semibold tabular-nums" aria-live="polite">
        {formatCantidad(enCarrito, producto.sale_unit)}
      </span>
      <button
        type="button"
        onClick={() => sumar(producto)}
        disabled={llegoAlTope}
        aria-label={`Sumar uno de ${producto.name}`}
        className="flex h-full w-11 shrink-0 items-center justify-center rounded-r-lg hover:bg-accent-hover disabled:opacity-40 disabled:hover:bg-transparent"
      >
        <IconoMas width={18} height={18} />
      </button>
    </div>
  );
}

function Aviso({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <p
      className={cn(
        "flex w-full items-center justify-center rounded-lg bg-neutral-100 text-neutral-600",
        className,
      )}
    >
      {children}
    </p>
  );
}
