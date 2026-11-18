"use client";

import Link from "next/link";
import { IconoCarrito } from "@/components/ui/iconos";
import { useMontado } from "@/lib/use-montado";
import { contarItems, useCarrito } from "@/store/carrito";

/** Ícono del carrito con el contador de productos. */
export function BotonCarrito() {
  const montado = useMontado();
  const cantidad = useCarrito(contarItems);
  const mostrar = montado && cantidad > 0;

  return (
    <Link
      href="/carrito"
      aria-label={mostrar ? `Ver carrito, ${cantidad} ${cantidad === 1 ? "producto" : "productos"}` : "Ver carrito"}
      className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-neutral-800 hover:bg-neutral-100"
    >
      <IconoCarrito />
      {mostrar && (
        <span
          aria-hidden
          className="absolute right-0.5 top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-xs font-semibold text-accent-fg"
        >
          {cantidad > 99 ? "99+" : cantidad}
        </span>
      )}
    </Link>
  );
}
